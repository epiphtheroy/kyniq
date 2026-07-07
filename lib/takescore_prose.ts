/**
 * TakeScore prose — deterministic band tables that turn cinecodex_card numbers
 * into English sentences for the public /takescore/film/[slug] page.
 * No randomness, no LLM calls: same numbers in, same sentences out.
 * Band index = clamp(1..5, round(score/20)) — the same lvOf step the private
 * Appraisal (components/room/EvalCard.tsx) uses, so public and private bands
 * stay aligned. Public vocabulary is 2–3-word interpretive phrases that state
 * what the band MEANS (value: what you keep / cost: what entry takes /
 * risk: how it can go wrong) — honest and terse, no hype.
 */
import type { CodexDimGroup } from "@/lib/cinecodex_dims";

export const BAND_WORDS: Record<CodexDimGroup, [string, string, string, string, string]> = {
  value: ["Faint traces", "Fair returns", "Solid, not peak", "Strong, lasting", "Exceptional — canon-grade"],
  cost: ["Walk right in", "Some homework", "Real preparation", "Advanced viewing", "Expert terrain"],
  risk: ["Nearly riskless", "Low downside", "Some hazard", "High letdown risk", "Severe — a gamble"],
};

/** 1..5 band step, identical to EvalCard's lvOf. */
export function bandOf(score: number): 1 | 2 | 3 | 4 | 5 {
  return Math.max(1, Math.min(5, Math.round(score / 20))) as 1 | 2 | 3 | 4 | 5;
}

export function bandWord(group: CodexDimGroup, score: number): string {
  return BAND_WORDS[group][bandOf(score) - 1];
}

/* ── verdict ──────────────────────────────────────────────────────────────── */

/**
 * Quadrant sentence + what U = V − R means for this film.
 * Thresholds match the private Appraisal: high value ≥ 72, low risk ≤ 20.
 */
export function verdictSentence(v: number, c: number, r: number, u: number): string {
  const V = Math.round(v), C = Math.round(c), R = Math.round(r), U = Math.round(u);
  const hiV = V >= 72, loR = R <= 20;
  const quadrant = hiV && loR
    ? "High value · low risk — a safe masterpiece."
    : hiV && !loR
      ? "High value · high risk — ambitious but divisive."
      : !hiV && loR
        ? "Solid but not peak — a stable choice."
        : "Mid value, mid risk — approach with care.";
  const net = U >= 70
    ? "one of the safest high-yield propositions in the catalog"
    : U >= 50
      ? "a strong net return for a serious viewer"
      : U >= 30
        ? "a real but hedged return — the value is there, discounted by genuine risk"
        : U >= 10
          ? "a thin net return — much of what it earns, it puts back at hazard"
          : "a net return close to zero — the risk consumes nearly all of the value";
  const cost = C >= 70
    ? `Entry cost ${C} asks real preparation on top of that.`
    : C >= 40
      ? `Entry cost ${C} asks some preparation — a price, never a merit.`
      : `Entry cost ${C} is low: you can walk in without preparation.`;
  return `${quadrant} Value ${V} minus risk ${R} leaves a TakeScore of ${U} — ${net}. ${cost}`;
}

/* ── the 13 dimensions ────────────────────────────────────────────────────── */

/** Five one-sentence band readings per dimension, keyed by cinecodex sub key. */
const DIM_BANDS: Record<string, [string, string, string, string, string]> = {
  cog: [
    "Little cognitive residue — the film asks for attention but leaves almost no idea behind once the images fade.",
    "A few genuine notions surface, but nothing that outlasts the credits.",
    "Real ideas, conventionally delivered — the film argues something and lands it.",
    "It reorganizes how you see something specific — a film you find yourself thinking with afterward.",
    "A lasting conceptual or perceptual shift — the rare film that actually changes how you think.",
  ],
  aff: [
    "Pleasant or gripping in the moment, and gone by the lobby.",
    "A scene or two lingers briefly, then fades.",
    "A few moments genuinely stay — images that return unprompted for a while.",
    "The emotional imprint keeps returning for weeks — durability, not just intensity.",
    "An indelible emotional imprint — the kind a viewer carries permanently.",
  ],
  form: [
    "Form here is invisible or unsteady — craft that never becomes a signature.",
    "Competent craft without a distinct authorial hand.",
    "Distinct craft — composition, cutting and sound carry a recognizable signature.",
    "Disciplined, distinctive authorial form, inseparable from what the film is about.",
    "Formal achievement at the innovation line — form that enlarges what the medium can do.",
  ],
  moral: [
    "No real moral or existential stake is put on the table.",
    "It gestures at a theme without holding a genuine dilemma open.",
    "Sincere but safe — a real subject, settled more cheaply than it deserves.",
    "Sustained moral complexity — the film holds a genuine dilemma open at its own expense.",
    "A profound ethical or existential reckoning that costs the film, and you, something.",
  ],
  dur: [
    "One viewing genuinely suffices — the payload spends itself on first contact.",
    "It survives a rewatch without especially rewarding one.",
    "It holds up — a second viewing confirms rather than diminishes it.",
    "It deepens on rewatch — the second and fifth viewings find more, not less.",
    "An inexhaustible lifetime object — a film you never finish.",
  ],
  itx: [
    "You can walk in cold — no film-history preparation is assumed.",
    "A passing familiarity with the genre or tradition helps, but is not required.",
    "The film is embedded in a tradition — some film-history literacy raises what you can see in it.",
    "It leans hard on the canon it quotes and inverts — film-history literacy is part of the ticket price.",
    "Encyclopedic and meta-cinematic — the film barely exists except in conversation with other films.",
  ],
  fr: [
    "Fully classical grammar — nothing about the form asks you to travel.",
    "Mostly conventional, with a few departures from mainstream pacing or shape.",
    "It bends familiar grammar enough that you feel the climb.",
    "Far from mainstream grammar — elliptical, demanding form that prices the ticket steeply.",
    "Avant-garde and endurance-testing — a deliberate refusal of conventional story, priced accordingly.",
  ],
  etx: [
    "Effectively universal — no outside knowledge is assumed.",
    "A broad general awareness is enough to open the film.",
    "A working sense of its history, politics or culture raises what the film gives back.",
    "It assumes reading you may not have done — history, philosophy, or the texture of a particular culture.",
    "Specialized field knowledge is close to mandatory before the film opens at all.",
  ],
  ctx: [
    "It stands completely alone — no knowledge of the director's other work is assumed.",
    "It stands alone, though the director's other films add a rhyme or two.",
    "Knowing the director's earlier work noticeably changes what this one means.",
    "This is a chapter, not a book — much of it only rhymes if you know the oeuvre.",
    "It presumes sequential mastery of the director's whole filmography.",
  ],
  bank: [
    "Substance beyond dispute — nothing here reads as intellectually hollow.",
    "Sound and substantive, with only minor stretches of banality.",
    "Real patches of banality, or pretension with too little behind it, thin the film out.",
    "A serious hollowness reading — much of what the film claims has little behind the curtain.",
    "Insultingly hollow or incoherent — the film wastes the attention it demands.",
  ],
  insincere: [
    "Style and substance are one thing — every choice reads as intentional and integrated.",
    "An occasional flourish outruns its purpose, but the machinery rarely shows.",
    "Stretches where style detaches from substance — dazzle outrunning control.",
    "Style substantially detached from substance — pastiche and display doing the work of meaning.",
    "Pure surface pretending otherwise — derivative, incoherent style with nothing beneath.",
  ],
  coward: [
    "Bold and uncompromised — every effect is honestly earned.",
    "Largely uncompromised, with only the occasional safe choice.",
    "Professional risk-management — the safe choice taken at enough forks that you feel it.",
    "Persistent pandering — sentiment extracted by formula rather than built from truth.",
    "Cynical, manipulative and soulless — the audience treated as a market segment to be milked.",
  ],
  polar: [
    "Near-consensus — informed, engaged viewers barely disagree about this one.",
    "Broad agreement among informed viewers, with scattered dissent.",
    "Strong consensus with a vocal-minority backlash — worth knowing the objection before you press play.",
    "Informed viewers split hard on this film — know which camp you are likely in first.",
    "A genuine half-acclaim, half-dismissal war among serious viewers.",
  ],
};

/** One-sentence reading of a dimension's band. Returns "" for unknown keys. */
export function dimSentence(key: string, score: number): string {
  const bands = DIM_BANDS[key];
  if (!bands) return "";
  return bands[bandOf(score) - 1];
}

/* ── confidence & reproducibility ─────────────────────────────────────────── */

export function confidenceSentence(
  conf: number | null,
  tier: string | null,
  n_samples: number | null,
  sd_v: number | null,
  flagged: boolean | null
): string {
  const parts: string[] = [];
  if (conf != null) parts.push(`Confidence ${Math.round(conf)}${tier ? ` — ${tier} tier` : ""}.`);
  else if (tier) parts.push(`Confidence tier: ${tier}.`);
  if (n_samples != null && n_samples <= 1) {
    parts.push(
      `The score comes from a single scoring pass (n=1), so run-to-run spread is unmeasured${
        flagged ? " and the card is flagged for re-scoring" : ""
      }; on a re-score each sub-score can move by a few points. Flagged means unverified, not low quality.`
    );
  } else if (n_samples != null) {
    parts.push(
      `The score aggregates ${n_samples} independent scoring passes${
        sd_v != null ? `, with a measured run-to-run spread of ±${sd_v} on Value` : ""
      }.${flagged ? " The card is flagged for review — flagged means unverified, not low quality." : ""}`
    );
  } else if (flagged) {
    parts.push("The card is flagged for re-scoring — flagged means unverified, not low quality.");
  }
  return parts.join(" ");
}

/* ── standing ─────────────────────────────────────────────────────────────── */

export function standingSentence(prestige: number | null, labels: string[] | null): string | null {
  if (prestige == null && !(labels && labels.length)) return null;
  const tier = prestige == null
    ? null
    : prestige >= 85
      ? "world-canon territory"
      : prestige >= 70
        ? "national-canon territory"
        : prestige >= 50
          ? "notable standing"
          : "below the canon's usual radar";
  const head = prestige != null
    ? `Standing ${Math.round(prestige)} — ${tier}: the canon's market price for this film, built from listings and awards`
    : "The canon's market price for this film, built from listings and awards";
  const tail = labels && labels.length ? `, carrying the labels ${labels.join(", ")}` : "";
  return `${head}${tail}. Standing is a separate axis — it never enters the TakeScore.`;
}

/* ── external signals ─────────────────────────────────────────────────────── */

/**
 * How external consensus relates to our Value reading — agreement or
 * divergence stated neutrally. The two are never blended.
 */
export function extSentence(
  imdb: number | null,
  rt: number | null,
  meta: number | null,
  v: number
): string | null {
  const norm: number[] = [];
  if (imdb != null) norm.push(imdb * 10);
  if (rt != null) norm.push(rt);
  if (meta != null) norm.push(meta);
  if (!norm.length) return null;
  const mean = Math.round(norm.reduce((a, b) => a + b, 0) / norm.length);
  const V = Math.round(v);
  const diff = mean - V;
  const rel = Math.abs(diff) <= 8
    ? `sits close to our Value reading of ${V} — the crowd and the fundamentals broadly agree here`
    : diff > 0
      ? `sits above our Value reading of ${V} — the crowd rates this film more warmly than the fundamentals do`
      : `sits below our Value reading of ${V} — the fundamentals find more here than the crowd does`;
  return `Taken together, the external consensus (≈${mean} on a 0–100 scale) ${rel}. Both are shown side by side; neither adjusts the other.`;
}
