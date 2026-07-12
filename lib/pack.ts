/**
 * Context-pack renderer — turns the `film_context_pack` RPC jsonb into a
 * human-and-LLM-friendly Markdown file (and typed access to the raw JSON).
 *
 * Product contract: HANDOFF-컨텍스트팩-실행.md §4. LLM-free, deterministic.
 * The RPC (supabase/migrations/0085) is the single source of truth for what
 * fields exist — this file only shapes them. Forbidden fields (coordinates,
 * TMDB editorial, ratings, watch providers, verbatim quotes) are excluded at
 * the RPC layer and never reach here.
 */
import { CODEX_DIMS } from "@/lib/cinecodex_dims";

export type PackTier = "trim" | "full";

export type FilmPack = {
  pack_version: number;
  tier: PackTier;
  generated_at: string;
  license: string;
  source_url: string;
  film: {
    slug: string;
    title: string;
    original_title: string | null;
    year: number | null;
    director: string | null;
    imdb_id: string | null;
    wikidata_id: string | null;
    tmdb_id: number | null;
  };
  takescore: {
    score: number;
    value: number;
    cost: number;
    risk: number;
    dims: Record<string, number | null>;
    low_confidence: boolean;
  } | null;
  standing: { prestige: number | null; discovery: number | null } | null;
  honors: Array<{ list: string; facet: string; result: string; rank: number | null }>;
  readings: Array<{
    framework: string;
    title: string | null;
    theorist: string | null;
    concept: string | null;
    text: string;
    figure: { label: string | null; kind: string | null } | null;
  }>;
  open_question: { text: string } | null;
  figures: Array<{ label: string | null; kind: string | null; description: string | null }> | null;
  locations: Array<{
    name: string | null;
    layer: string | null;
    narrative_setting: string | null;
    scene_role: string | null;
    country: string | null;
  }> | null;
  tropes: Array<{ title: string | null; laconic: string | null; thesis: string | null }> | null;
  kindred: Array<{ title: string | null; year: number | null; slug: string | null; shared_threads: number }>;
  counts: { readings_total: number; included: number };
};

const STORE_URL = "https://metatake.net/data";
const METHOD_URL = "https://metatake.net/methodology";

/** Source + license line stamped at the very top and very bottom of every pack. */
function sourceLine(p: FilmPack): string {
  return `Source: Metatake — ${p.source_url} · License: ${p.license} · Full packs & bundles: ${STORE_URL}`;
}

/** Identity line: director, original title (only if it differs), and cross-IDs. */
function identityLine(p: FilmPack): string {
  const bits: string[] = [];
  if (p.film.director) bits.push(`Directed by ${p.film.director}`);
  if (p.film.original_title && p.film.original_title !== p.film.title) {
    bits.push(`Original title: ${p.film.original_title}`);
  }
  const ids: string[] = [];
  if (p.film.imdb_id) ids.push(`imdb ${p.film.imdb_id}`);
  if (p.film.wikidata_id) ids.push(`wikidata ${p.film.wikidata_id}`);
  if (p.film.tmdb_id) ids.push(`tmdb ${p.film.tmdb_id}`);
  ids.push(`metatake ${p.film.slug}`);
  bits.push(`IDs: ${ids.join(" · ")}`);
  return bits.join(" · ");
}

function takeScoreSection(p: FilmPack): string {
  if (!p.takescore) return "";
  const ts = p.takescore;
  const groups: Record<"value" | "cost" | "risk", string[]> = { value: [], cost: [], risk: [] };
  for (const dim of CODEX_DIMS) {
    const val = ts.dims[dim.key];
    if (val == null) continue;
    groups[dim.group].push(`- ${dim.label}: ${val}`);
  }
  const lines: string[] = [];
  lines.push("## TakeScore — Metatake's 13-dimension critical assessment");
  const head = `**TakeScore ${ts.score}** (net value) · Value ${ts.value} · Cost ${ts.cost} · Risk ${ts.risk}` +
    (ts.low_confidence ? "  ·  ⚠ low-confidence (single-panel) score" : "");
  lines.push(head);
  lines.push("");
  lines.push("_Value = what the film delivers (higher is better) · Cost = prior knowledge it demands · Risk = how it can fail as art (higher is worse)._");
  if (groups.value.length) { lines.push("", "**Value**", ...groups.value); }
  if (groups.cost.length) { lines.push("", "**Cost**", ...groups.cost); }
  if (groups.risk.length) { lines.push("", "**Risk**", ...groups.risk); }
  lines.push("", `Scale & method: ${METHOD_URL}`);
  return lines.join("\n");
}

function standingAndHonors(p: FilmPack): string {
  const lines: string[] = [];
  const hasStanding = p.standing && (p.standing.prestige != null || p.standing.discovery != null);
  if (!hasStanding && (!p.honors || p.honors.length === 0)) return "";
  lines.push("## Standing & honors");
  if (hasStanding) {
    const s = p.standing!;
    const bits: string[] = [];
    if (s.prestige != null) bits.push(`Prestige ${s.prestige}`);
    if (s.discovery != null) bits.push(`Discovery ${s.discovery}`);
    lines.push(`${bits.join(" · ")} — Metatake canon-standing model`);
  }
  for (const h of p.honors ?? []) {
    const rank = h.rank != null ? ` #${h.rank}` : "";
    lines.push(`- ${h.list} — ${h.result}${rank}`);
  }
  return lines.join("\n");
}

function readingsSection(p: FilmPack): string {
  if (!p.readings || p.readings.length === 0) return "";
  const lines: string[] = [];
  lines.push(`## Readings — ${p.counts.included} of ${p.counts.readings_total} critical frameworks`);
  lines.push("Each reading pushes a single critical framework as far as the film allows. These are interpretive positions — not plot summary, not consensus.");
  for (const r of p.readings) {
    lines.push("", `### ${r.framework}${r.title ? ` — "${r.title}"` : ""}`);
    const attr: string[] = [];
    if (r.theorist) attr.push(`Theorist: ${r.theorist}`);
    if (r.concept) attr.push(`Concept: ${r.concept}`);
    if (r.figure?.label) attr.push(`On: ${r.figure.label}${r.figure.kind ? ` (${r.figure.kind})` : ""}`);
    if (attr.length) lines.push(`*${attr.join(" · ")}*`);
    lines.push("", r.text);
  }
  return lines.join("\n");
}

function figuresSection(p: FilmPack): string {
  if (!p.figures || p.figures.length === 0) return "";
  const lines: string[] = ["## Motifs & figures"];
  for (const g of p.figures) {
    if (!g.label) continue;
    lines.push("", `### ${g.label}${g.kind ? ` (${g.kind})` : ""}`);
    if (g.description) lines.push(g.description);
  }
  return lines.join("\n");
}

function locationsSection(p: FilmPack): string {
  if (!p.locations || p.locations.length === 0) return "";
  const lines: string[] = ["## Filming locations & settings"];
  for (const l of p.locations) {
    if (!l.name) continue;
    const meta: string[] = [];
    if (l.layer) meta.push(l.layer);
    if (l.country) meta.push(l.country);
    lines.push("", `- **${l.name}**${meta.length ? ` — ${meta.join(", ")}` : ""}`);
    const prose = l.scene_role || l.narrative_setting;
    if (prose) lines.push(`  ${prose}`);
  }
  lines.push("", `_Coordinates are not included in packs; the interactive map lives at ${p.source_url}/locations._`);
  return lines.join("\n");
}

function tropesSection(p: FilmPack): string {
  if (!p.tropes || p.tropes.length === 0) return "";
  const lines: string[] = ["## Tropes in play"];
  for (const t of p.tropes) {
    if (!t.title) continue;
    lines.push("", `### ${t.title}`);
    if (t.laconic) lines.push(`*${t.laconic}*`);
    if (t.thesis) lines.push("", t.thesis);
  }
  return lines.join("\n");
}

function kindredSection(p: FilmPack): string {
  if (!p.kindred || p.kindred.length === 0) return "";
  const lines: string[] = ["## Kindred films"];
  for (const k of p.kindred) {
    if (!k.title) continue;
    const yr = k.year ? ` (${k.year})` : "";
    const threads = k.shared_threads > 0
      ? `${k.shared_threads} shared interpretive thread${k.shared_threads === 1 ? "" : "s"}`
      : "related on Metatake";
    lines.push(`- ${k.title}${yr} — ${threads}`);
  }
  return lines.join("\n");
}

function invitationSection(p: FilmPack): string {
  if (!p.open_question?.text) return "";
  return ["## An invitation — a spoiler-free way in", p.open_question.text].join("\n");
}

const HOW_TO_USE = [
  "## How to use this file",
  "Attach this file to Claude Projects, a Custom GPT, NotebookLM, Gemini Gems, or any AI assistant, and write on top of it.",
  "These readings are deliberate \"strong misreadings\": each pushes one critical framework (PSYCHOANALYTIC, SIGNIFIER→SIGNIFIED, ETHICO-POLITICAL, …) as far as the film allows. They are interpretive positions, not plot summary and not consensus. Ask your AI to argue with them, combine them, or extend one into your own essay.",
].join("\n");

/** Render the pack jsonb to a single Markdown document (§4.1 / §4.2). */
export function renderPackMarkdown(p: FilmPack): string {
  const date = (p.generated_at || "").slice(0, 10);
  const title = `${p.film.title}${p.film.year ? ` (${p.film.year})` : ""}`;
  const tierNote = p.tier === "trim"
    ? " — the full pack adds every reading plus figures, filming locations, tropes, complete honors, and more kindred films."
    : "";
  const header = [
    sourceLine(p),
    "",
    `# ${title} — Metatake Context Pack`,
    "",
    identityLine(p),
    `Pack: ${p.tier}${date ? ` · generated ${date}` : ""} · ${p.counts.included} of ${p.counts.readings_total} readings included${tierNote}`,
  ].join("\n");

  const footer = [
    "---",
    sourceLine(p),
    `This pack is AI-generated criticism with human curation. Method: ${METHOD_URL}`,
  ].join("\n");

  const sections = [
    header,
    HOW_TO_USE,
    takeScoreSection(p),
    standingAndHonors(p),
    readingsSection(p),
    invitationSection(p),
    figuresSection(p),
    locationsSection(p),
    tropesSection(p),
    kindredSection(p),
    footer,
  ].filter((s) => s && s.trim().length > 0);

  return sections.join("\n\n") + "\n";
}

/** Filename for a downloaded pack (W1.5 uses this; safe for content-disposition). */
export function packFilename(slug: string, tier: PackTier, fmt: "md" | "json"): string {
  return `metatake-pack_${slug}_${tier}.${fmt}`;
}
