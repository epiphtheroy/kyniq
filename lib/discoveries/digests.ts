// lib/discoveries/digests.ts
// Metatake Discoveries — the newborn-film-site radar at /discoveries.
// Append-only: prepend new digests at the TOP (newest first).
//
// Canonical spec: HANDOFF-발견피드.md (repo root).
//
// TWO TIERS:
//  - observed[]  : the observation log (nofollow). A record that we saw the site.
//  - featured[]  : editor's picks (dofollow). Owner writes a real note by hand.
//
// ⚠️ HARD RULE (learned the hard way — HANDOFF §14): NOTHING goes in observed[]
// until a human (or a deep per-site verify pass) has actually OPENED it. The
// scanner's Haiku pass is a triage, not a safety gate: it cannot tell a real
// cinema from a phishing reverse-proxy clone or a "members-only cinema" that is
// really a piracy player. Week-one deep-verify caught a payment-interceptor
// phishing site and a piracy site that the cheap classifier had waved through as
// "venue". Publish only sites confirmed reachable, real, and clean.
//
// Regenerate a draft: cd discovery && python3 build_digest.py …  (produces a
// candidate list) → THEN verify each by opening it → then keep only the clean
// ones here.

/**
 * OFF (owner, 2026-08-05): the surface is paused, not deleted — "다음에 다시 열
 * 수는 있지만 당분간 서비스 하지 않으려 합니다."
 *
 * One digest (Jul 18) with no scanner running behind it is a page that says the
 * project stopped, which is worse than no page. So the route and its feed 404,
 * the footer link and the sitemap entry disappear, and everything else — the
 * digests, the components, the scanner — stays exactly where it is.
 *
 * To reopen: flip this to true. Nothing else to remember.
 */
export const DISCOVERIES_ENABLED = false;

export type DiscoveryCategory =
  | "criticism" | "journal" | "news" | "festival" | "venue"
  | "archive" | "podcast" | "education" | "database" | "curation";

export const CATEGORY_LABEL: Record<DiscoveryCategory, string> = {
  criticism: "Criticism",
  journal: "Journal",
  news: "Film news",
  festival: "Festival",
  venue: "Cinema / venue",
  archive: "Archive",
  podcast: "Podcast",
  education: "Education",
  database: "Database",
  curation: "Curation",
};

export type Observed = {
  domain: string;
  category: DiscoveryCategory;
  /** ISO-ish language tag from the page, or "?" */
  lang: string;
};

export type Featured = {
  domain: string;
  /** the site's own name */
  title: string;
  /** owner's editorial note, 1–2 sentences */
  note: string;
  category: DiscoveryCategory;
  lang: string;
};

export type Digest = {
  /** permanent anchor "YYYY-MM-DD-slug". NEVER change after publish. */
  id: string;
  /** publish date, KST, YYYY-MM-DD */
  date: string;
  /** human range label, e.g. "Week of Jul 10–16, 2026" */
  rangeLabel: string;
  /** newly registered domains read that period (context number) */
  scanned: number;
  /** factual prose lead — one paragraph. No links (links live in the lists). */
  intro: string;
  featured: Featured[];
  observed: Observed[];
};

export const DIGESTS: Digest[] = [
  {
    id: "2026-07-18-wk29",
    date: "2026-07-18",
    rangeLabel: "Week of Jul 10–16, 2026",
    scanned: 490000,
    intro:
      "About 490,000 domains were registered in the week of July 10–16, 2026. A scanner kept the ones whose names point at film, and each candidate was then opened and read by hand — most turned out to be piracy mirrors, parked names, content farms, or, in a couple of cases, sites dressed up as cinemas that were nothing of the kind. Eight were the real thing, and they are a good spread of how film culture actually starts: a Kurdish film festival touring Denmark and a Jewish film-days program in Hamburg; a grassroots neighborhood cinema in Mexico City's Tepito barrio; new festivals in San Jose and New York; a long-running Gujarati-language critic writing three-thousand-word reviews; a Dutch film podcast; and a German review blog. The links below are an observation record, not an endorsement, and any site can ask to be removed.",
    featured: [
      // Owner promotes here and writes a real 1–2 sentence note. dofollow.
    ],
    observed: [
      { domain: "kurdiskfilmfestival.dk", category: "festival", lang: "da" },
      { domain: "juedischefilmtage.hamburg", category: "festival", lang: "de" },
      { domain: "cinematepito.com", category: "venue", lang: "es" },
      { domain: "docafilmfestival.com", category: "festival", lang: "en" },
      { domain: "newfilmmakersny.com", category: "festival", lang: "en" },
      { domain: "gujaratifilmreview.in", category: "criticism", lang: "gu" },
      { domain: "themoviemen.nl", category: "podcast", lang: "nl" },
      { domain: "infernomovies.blog", category: "criticism", lang: "de" },
    ],
  },
];
