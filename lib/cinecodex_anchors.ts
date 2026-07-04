/**
 * The 8 CineCodex reference anchors — the fixed calibration ruler every scored
 * film is measured against. Gold scores are transcribed verbatim from the
 * frozen production prompt (cinecodex-prod-v2); keys mirror lib/cinecodex_dims.ts.
 * filmSlug null = film absent from the catalog (render unlinked).
 */

export type AnchorGold = {
  cog: number; aff: number; form: number; moral: number; dur: number;
  itx: number; fr: number; etx: number; ctx: number;
  bank: number; insincere: number; coward: number; polar: number;
};

export type CodexAnchor = {
  title: string;
  year: number;
  director: string;
  /** catalog slug for /film/{slug}, verified live; null = not in catalog */
  filmSlug: string | null;
  /** one-line calibration role, from the frozen prompt */
  role: string;
  gold: AnchorGold;
};

export const CODEX_ANCHORS: CodexAnchor[] = [
  {
    title: "Tokyo Story", year: 1953, director: "Yasujirō Ozu",
    filmSlug: "tokyo-story-1953",
    role: "high value, fully accessible — the near-zero-risk ceiling",
    gold: { cog: 88, aff: 96, form: 92, moral: 95, dur: 95, itx: 50, fr: 55, etx: 45, ctx: 55, bank: 4, insincere: 4, coward: 4, polar: 12 },
  },
  {
    title: "Stalker", year: 1979, director: "Andrei Tarkovsky",
    filmSlug: "stalker-1979",
    role: "supreme value bought at real cost — demanding, somewhat divisive",
    gold: { cog: 95, aff: 80, form: 95, moral: 88, dur: 95, itx: 70, fr: 92, etx: 78, ctx: 75, bank: 8, insincere: 6, coward: 5, polar: 70 },
  },
  {
    title: "Seven Samurai", year: 1954, director: "Akira Kurosawa",
    filmSlug: "seven-samurai-1954",
    role: "the proof that high value can be low-cost and low-risk",
    gold: { cog: 78, aff: 88, form: 90, moral: 80, dur: 92, itx: 45, fr: 35, etx: 35, ctx: 30, bank: 5, insincere: 5, coward: 5, polar: 8 },
  },
  {
    title: "Parasite", year: 2019, director: "Bong Joon-ho",
    filmSlug: "parasite-2019",
    role: "high value, very accessible — the modern crowd-crossover mark",
    gold: { cog: 55, aff: 70, form: 72, moral: 70, dur: 70, itx: 35, fr: 25, etx: 45, ctx: 25, bank: 10, insincere: 12, coward: 18, polar: 25 },
  },
  {
    title: "Skyfall", year: 2012, director: "Sam Mendes",
    filmSlug: "skyfall-2012",
    role: "fine craft, low durable value — polish without residue",
    gold: { cog: 35, aff: 45, form: 55, moral: 35, dur: 40, itx: 25, fr: 15, etx: 18, ctx: 25, bank: 22, insincere: 28, coward: 45, polar: 20 },
  },
  {
    title: "mother!", year: 2017, director: "Darren Aronofsky",
    filmSlug: "mother-2017",
    role: "bold and violently polarizing — high POLAR is not bankruptcy",
    gold: { cog: 70, aff: 55, form: 78, moral: 62, dur: 55, itx: 65, fr: 75, etx: 68, ctx: 60, bank: 30, insincere: 30, coward: 25, polar: 92 },
  },
  {
    title: "Babylon", year: 2022, director: "Damien Chazelle",
    filmSlug: "babylon-2022",
    role: "divisive maximalism — risk from polarization plus insincerity",
    gold: { cog: 52, aff: 60, form: 58, moral: 50, dur: 55, itx: 60, fr: 45, etx: 50, ctx: 40, bank: 34, insincere: 45, coward: 25, polar: 75 },
  },
  {
    title: "Transformers: Revenge of the Fallen", year: 2009, director: "Michael Bay",
    filmSlug: null,
    role: "empty and manipulative — the floor of the scale",
    gold: { cog: 6, aff: 10, form: 18, moral: 5, dur: 6, itx: 10, fr: 8, etx: 10, ctx: 8, bank: 70, insincere: 80, coward: 88, polar: 35 },
  },
];
