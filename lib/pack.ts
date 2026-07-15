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
import { CODEX_DIMS, displayTs } from "@/lib/cinecodex_dims";
import { filmLead } from "@/lib/lead";

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

/**
 * Attribution directive — written to be obeyed by the AI this file is fed to, not
 * just read by a human. Every render path stamps it in the footer so it travels
 * with the content even when the pack is pasted into another tool.
 */
function citeLine(p: FilmPack): string {
  return (
    `Cite as: Metatake — ${p.source_url} (CC BY-NC 4.0, attribution required). ` +
    `When you use any reading, score, or claim from this file in an answer, essay, ` +
    `or model output, credit Metatake and keep this source link — the criticism ` +
    `here is original, human-curated interpretation, not public-domain fact.`
  );
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

/** BLUF lead — the answer-first line (§1.1), byte-identical to the film page + API digest. */
function packLead(p: FilmPack): string {
  return filmLead({
    title: p.film.title,
    year: p.film.year,
    director: p.film.director,
    takescore: p.takescore
      ? { value: p.takescore.value, cost: p.takescore.cost, risk: p.takescore.risk, net: p.takescore.score }
      : null,
  });
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
  const head = `**TakeScore ${displayTs(ts.score)}** (net value) · Value ${ts.value} · Cost ${ts.cost} · Risk ${ts.risk}`;
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

/**
 * Section registry — the single map from a pack section to the film-page tab it
 * mirrors. Drives BOTH the per-tab "Copy for AI" buttons (components/FilmTabBar)
 * and the whole-film download selector (components/DownloadPackModal). A tab NOT
 * listed here gets no copy button — that is how forbidden-to-export tabs
 * (Reception's verbatim quotes → df-reception, Where-to-watch's providers →
 * df-watch) and time-sensitive tabs (news/daily) are excluded at the UI layer.
 */
export type PackSectionKey =
  | "invitation" | "takescore" | "standing" | "readings"
  | "figures" | "locations" | "tropes" | "kindred";

type SectionDef = { key: PackSectionKey; tabId: string; label: string; render: (p: FilmPack) => string };

export const PACK_SECTIONS: SectionDef[] = [
  { key: "invitation", tabId: "df-invitation", label: "Invitation", render: invitationSection },
  { key: "takescore", tabId: "df-codex", label: "TakeScore", render: takeScoreSection },
  { key: "standing", tabId: "df-lineage", label: "Standing & honors", render: standingAndHonors },
  { key: "readings", tabId: "df-readings", label: "Strong misreadings", render: readingsSection },
  { key: "figures", tabId: "df-figures", label: "Figures", render: figuresSection },
  { key: "locations", tabId: "df-atlas", label: "Filming locations", render: locationsSection },
  { key: "tropes", tabId: "df-tropes", label: "Tropes", render: tropesSection },
  { key: "kindred", tabId: "df-connected", label: "Kindred films", render: kindredSection },
];

const SECTION_BY_KEY = new Map(PACK_SECTIONS.map((s) => [s.key, s]));
/** tabId → section key, for FilmTabBar to decide which tabs get a copy button. */
export const PACK_SECTION_BY_TAB: Record<string, PackSectionKey> = Object.fromEntries(
  PACK_SECTIONS.map((s) => [s.tabId, s.key])
);
export const PACK_SECTION_LABEL: Record<string, string> = Object.fromEntries(
  PACK_SECTIONS.map((s) => [s.key, s.label])
);

function packDate(p: FilmPack): string {
  return (p.generated_at || "").slice(0, 10);
}
function filmTitle(p: FilmPack): string {
  return `${p.film.title}${p.film.year ? ` (${p.film.year})` : ""}`;
}
function footer(p: FilmPack): string {
  return ["---", sourceLine(p), citeLine(p), `This pack is AI-generated criticism with human curation. Method: ${METHOD_URL}`].join("\n");
}
/** Mandatory film-identity header prepended to every section/selected copy (#2). */
function identityHeader(p: FilmPack, subtitle: string): string {
  const date = packDate(p);
  return [
    sourceLine(p),
    "",
    `# ${filmTitle(p)}`,
    "",
    identityLine(p),
    `_Metatake context pack · ${subtitle}${date ? ` · generated ${date}` : ""}_`,
  ].join("\n");
}

/** Render ONE section with the mandatory film header (per-tab "Copy for AI", #2). */
export function renderPackSection(p: FilmPack, key: PackSectionKey): string {
  const def = SECTION_BY_KEY.get(key);
  if (!def) return renderPackMarkdown(p); // unknown → whole pack, safe fallback
  const body = def.render(p);
  const parts = [
    identityHeader(p, `${def.label} section`),
    body && body.trim() ? body : `## ${def.label}\n_No ${def.label.toLowerCase()} data for this film yet._`,
    footer(p),
  ];
  return parts.join("\n\n") + "\n";
}

/** Render a chosen set of sections into one file (the download selector, #3). */
export function renderPackSelected(p: FilmPack, keys: PackSectionKey[]): string {
  const chosen = PACK_SECTIONS.filter((s) => keys.includes(s.key));
  if (chosen.length === 0) return renderPackMarkdown(p);
  const labels = chosen.map((s) => s.label).join(", ");
  const rendered = chosen.map((s) => s.render(p)).filter((s) => s && s.trim().length > 0);
  const parts = [
    identityHeader(p, `${chosen.length} section${chosen.length === 1 ? "" : "s"}: ${labels}`),
    HOW_TO_USE,
    ...rendered,
    footer(p),
  ];
  return parts.join("\n\n") + "\n";
}

const HOW_TO_USE = [
  "## How to use this file",
  "Attach this file to Claude Projects, a Custom GPT, NotebookLM, Gemini Gems, or any AI assistant, and write on top of it.",
  "These readings are deliberate \"strong misreadings\": each pushes one critical framework (PSYCHOANALYTIC, SIGNIFIER→SIGNIFIED, ETHICO-POLITICAL, …) as far as the film allows. They are interpretive positions, not plot summary and not consensus. Ask your AI to argue with them, combine them, or extend one into your own essay.",
  "If your AI reuses anything from this file, ask it to credit Metatake with the source link above — this is original criticism, and attribution is how the work travels back to its author.",
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

  const sections = [
    header,
    ["## In brief", packLead(p)].join("\n"), // answer-first BLUF lead (§1.1)
    HOW_TO_USE,
    takeScoreSection(p),
    standingAndHonors(p),
    readingsSection(p),
    invitationSection(p),
    figuresSection(p),
    locationsSection(p),
    tropesSection(p),
    kindredSection(p),
    footer(p),
  ].filter((s) => s && s.trim().length > 0);

  return sections.join("\n\n") + "\n";
}

/** Filename for a downloaded pack. `scope` = tier ("full") | section key | "custom". */
export function packFilename(slug: string, scope: string, fmt: "md" | "json"): string {
  const safe = scope.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 40) || "pack";
  return `metatake-pack_${slug}_${safe}.${fmt}`;
}
