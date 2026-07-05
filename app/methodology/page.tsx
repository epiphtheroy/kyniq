import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { pageRobots } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Methodology — Metatake",
  description:
    "How a Metatake reading is made: an AI system drafts, a human editor reviews and approves every one before it publishes, and pages stay open to correction.",
  alternates: { canonical: "/methodology" },
  robots: pageRobots(true),
};

type Stats = {
  films: number; figures: number; readings: number; tropes: number; concepts: number;
  concept_links: number; theorists: number; kin_edges: number; counterpoints: number; locations: number;
} | null;

const nf = (n: number) => n.toLocaleString("en-US");

export default async function MethodologyPage() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data } = await db.rpc("methodology_stats_json");
  const s = (data ?? null) as Stats;

  const tiles: [number, string, string][] = s ? [
    [s.films, "films read closely", "every one broken into figures and readings — no stub pages"],
    [s.figures, "figures", "the objects, gestures and devices we read — the unit of analysis"],
    [s.readings, "close readings", "each drafted under a named framework, human-reviewed before publishing"],
    [s.tropes, "cross-film tropes", "recurring patterns that connect figures across films"],
    [s.theorists, "theorists cited", "the scholarship our anchored readings point back to"],
    [s.concepts, "canonical concepts", `${nf(s.concept_links)} phrasing variants resolved onto them`],
    [s.kin_edges, "kinship connections", "film-to-film edges, each carrying its shared-trope evidence"],
    [s.counterpoints, "counterpoints", "pairs that share a trope but read it in opposite directions"],
    [s.locations, "mapped locations", "geocoded shooting and setting places behind the Atlas"],
  ] : [];

  return (
    <main className="shell">
      <h1 className="disp" style={{ fontSize: 30, margin: "28px 0 0" }}>Methodology</h1>
      <p className="standfirst" style={{ margin: "14px 0 0", maxWidth: "62ch" }}>
        How a reading on Metatake actually gets made — the pipeline, what the AI does and doesn&apos;t do, and how to
        flag it when we get something wrong.
      </p>

      {tiles.length > 0 ? (
        <>
          <hr className="rule" />
          <div className="seclbl">The corpus, in numbers</div>
          <div className="tick" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, margin: 0 }}>
            {tiles.map(([n, label, meaning]) => (
              <div key={label} style={{ border: "1px solid rgba(0,0,0,.08)", borderRadius: 10, padding: "14px 14px 12px", background: "rgba(0,0,0,.015)" }}>
                <div className="disp" style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{nf(n)}</div>
                <div style={{ fontSize: 13, fontWeight: 700, margin: "6px 0 2px" }}>{label}</div>
                <div style={{ fontSize: 12, opacity: .62, lineHeight: 1.45 }}>{meaning}</div>
              </div>
            ))}
          </div>
          <p className="ui muted" style={{ fontSize: 12, marginTop: 10 }}>
            Counts are read live from the database — they grow as the corpus does.
          </p>
        </>
      ) : null}

      <hr className="rule" />

      <div className="seclbl">Why we publish our method</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        People reasonably ask how a reading gets made — and whether an AI wrote it. We&apos;d rather answer plainly
        than let the question hang. This page is that answer: the actual pipeline, without the gloss, and what to do
        if we get something wrong.
      </p>

      <hr className="rule" />

      <div className="seclbl">The pipeline</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Every reading passes through six stages before and after it goes live. <strong>1. Film breakdown</strong> —
        we decompose a film into its <em>figures</em>, the objects, gestures, colors, and recurring devices worth
        reading closely. <strong>2. Drafting, by framework</strong> — Metatake Editorial, our AI system, drafts a
        reading of each figure under one of fourteen interpretive frameworks. <strong>3. Scholarly anchoring, where
        it applies</strong> — some readings are anchored to a specific piece of published film scholarship; most
        are original interpretations in their own right. <strong>4. Human editorial review</strong> — every reading,
        no exceptions, is checked for accuracy and edited or cut by{" "}
        <Link href="/editor" className="accent" style={{ textDecoration: "none" }}>Wonwoo Yoon</Link>, Metatake&apos;s
        human editor, before it goes live. <strong>5. Publication</strong> — only reviewed readings publish, under
        his sign-off. <strong>6. Audit and correction</strong> — publication isn&apos;t the end; we and our readers
        keep checking pages against the facts, and this loop runs continuously.
      </p>

      <hr className="rule" />

      <div className="seclbl">What AI does and doesn&apos;t do</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        AI drafts and connects; a human judges and answers for it. Metatake Editorial writes the first version of a
        reading and, separately, the embeddings that place it in relation to every other reading on the site. What it
        doesn&apos;t do is decide what stands on the site. That&apos;s Wonwoo&apos;s job, and his alone — he reads every
        draft, checks its factual claims, and either signs off on it or sends it back. If a reading is live, a human
        has looked at it and taken responsibility for that specific page. The AI proposes; the editor disposes.
      </p>

      <hr className="rule" />

      <div className="seclbl">The embedding map</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        The lines you follow between films aren&apos;t hand-tagged categories — they&apos;re distances in a
        high-dimensional space. Each reading becomes an embedding, a point positioned by what it&apos;s actually
        about, so two films thinking about the same thing drift close together even with no genre, director, or
        decade in common.
      </p>
      <p className="body reading" style={{ fontSize: 18, margin: "12px 0 0" }}>
        That&apos;s what lets you start at one figure and land somewhere you wouldn&apos;t have guessed to look — not
        because a human filed both films under the same tag, but because their readings sit near each other in
        meaning. It&apos;s a map built from content, not taxonomy, and it grows with every reading added.
      </p>

      <hr className="rule" />

      <div className="seclbl" id="connections">How connections are computed</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Every &ldquo;films most connected&rdquo; list on the site is computed, not curated, and it recomputes as the
        corpus grows — so the lists you see change as new readings are published. Two signals are fused. First,{" "}
        <strong>shared tropes</strong>: when two films&apos; figures belong to the same{" "}
        <Link href="/tropes" className="accent" style={{ textDecoration: "none" }}>trope</Link>, that&apos;s a
        connection, and rarer tropes count for more than common ones. Second, <strong>taste distance</strong>: each
        film&apos;s readings are averaged into one vector, and films whose vectors sit close are neighbours even when
        they share no trope at all. The two rankings are blended, and the strongest two dozen kin are kept per film —
        always with the shared tropes shown, so a connection can be checked, not just believed.
      </p>
      <p className="body reading" style={{ fontSize: 18, margin: "12px 0 0" }}>
        <strong>Counterpoints</strong> are the inverse, and they&apos;re the connection only a reading-level database
        can make: two films that stage the <em>same</em> trope, whose readings of it point in opposite directions.
        Similarity engines can find lookalikes; they can&apos;t find arguments. We keep the pair whose readings are
        farthest apart in meaning and show both takes side by side, so the disagreement is legible on the page. All of
        it — kinship, counterpoints, the <Link href="/map" className="accent" style={{ textDecoration: "none" }}>map</Link>,
        the galaxy view — reads from the same computed ledger, and none of it is hand-weighted.
        {s ? <> As of today that ledger holds <strong>{nf(s.kin_edges)} kinship edges</strong> and{" "}
        <strong>{nf(s.counterpoints)} counterpoints</strong> across {nf(s.films)} films, and it is rebuilt as the
        corpus grows.</> : null}
      </p>

      <hr className="rule" />

      <div className="seclbl">The Atlas — location data</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        The <Link href="/atlas" className="accent" style={{ textDecoration: "none" }}>Atlas</Link> — the map layer
        behind &ldquo;where was this filmed?&rdquo; pages — is compiled, not scraped. Metatake Editorial researches
        each film&apos;s shooting places from public sources and production records, geolocates them, and files every
        pin with the scene it carries, a precision label (exact spot, venue, area, or city level), its source, and a
        confidence score. Filmed places and the places a story merely <em>claims</em> to be set in are kept apart —
        the map tells you which is which. Locations are collected through two independent passes and fused before
        display; where the record is thin, the pin says city level rather than pretending to an address. Location
        facts sit under the same correction loop as everything else on this page — if we&apos;ve put a pin in the
        wrong place, tell us and we&apos;ll move it.
      </p>

      <hr className="rule" />

      <div className="seclbl">Corrections</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        If something on Metatake is factually wrong — a date, a credit, a plot detail, a mischaracterized scholarly
        source — tell us and we&apos;ll fix it. Email{" "}
        <a href="mailto:wonwoo@metatake.net" className="accent" style={{ textDecoration: "none" }}>
          wonwoo@metatake.net
        </a>{" "}
        with the page and the issue; corrections get made as they&apos;re verified. What we won&apos;t do is flatten an
        interpretation because you disagree with it — facts get corrected, readings stay open. A film sustains more
        than one strong reading, and logged-in readers can add their own beneath any figure.
      </p>

      <hr className="rule" />

      <div className="seclbl">Sources &amp; attribution</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Film stills and posters are sourced from TMDB. Where a reading draws on published film scholarship, we credit
        the source rather than passing the idea off as our own — that&apos;s what &ldquo;anchored&rdquo; means above.
        Readings that aren&apos;t anchored to a specific source are original interpretations, built the way described on
        this page: one reading a film can sustain, not a settled verdict on it.
      </p>

      <hr className="rule" />

      <p className="ui muted" style={{ fontSize: 13 }}>
        More on the project as a whole:{" "}
        <Link href="/about" className="accent" style={{ textDecoration: "none" }}>About Metatake</Link>. Questions,
        press, or partnerships:{" "}
        <a href="mailto:wonwoo@metatake.net" className="accent" style={{ textDecoration: "none" }}>
          wonwoo@metatake.net
        </a>
      </p>
    </main>
  );
}
