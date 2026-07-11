import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { pageRobots } from "@/lib/seo";
import { cachedLineageMeta } from "@/lib/lineage";

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
    [s.locations, "mapped locations", "geocoded shooting and setting places behind the Locations layer"],
  ] : [];
  // Lineage counts live in their own layer (film_lineage) — same live-count rule.
  const lm = await cachedLineageMeta();
  if (tiles.length && lm.memberships) {
    tiles.push([lm.memberships, "lineage memberships", "films filed to awards, canons and national cinemas — lists enumerated whole, resolved to TMDb"]);
  }

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
        it — kinship, counterpoints, the <Link href="/network" className="accent" style={{ textDecoration: "none" }}>map</Link>,
        the galaxy view — reads from the same computed ledger, and none of it is hand-weighted.
        {s ? <> As of today that ledger holds <strong>{nf(s.kin_edges)} kinship edges</strong> and{" "}
        <strong>{nf(s.counterpoints)} counterpoints</strong> across {nf(s.films)} films, and it is rebuilt as the
        corpus grows.</> : null}
      </p>

      <hr className="rule" />

      <div className="seclbl" id="rankings">The numbers on ranked lists</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Wherever the site shows a percentage or a ranked list — a trope page ranking its films, an archetype page
        ordering its figures, a &ldquo;% match&rdquo; badge — the number is computed the same way and never typed in
        by hand. Every reading, figure and trope on Metatake has an embedding: a position in meaning-space derived
        from its actual text. A <strong>match&nbsp;%</strong> is the cosine similarity between two of those positions.
        On a trope page, it measures how centrally a film&apos;s reading sits in that trope&apos;s meaning — the #1
        film isn&apos;t the most famous one, it&apos;s the one whose reading is most purely <em>about</em> what the
        trope is about. A <strong>kin&nbsp;%</strong> between two tropes, or between two figures, is the same cosine
        applied to their own embeddings.
      </p>
      <p className="body reading" style={{ fontSize: 18, margin: "12px 0 0" }}>
        Two other numbers appear alongside. <strong>Confidence</strong>, on archetype pages, is how surely a figure
        belongs to its classification — assigned when the figure is classified, on a 0–100% scale, and used to order
        the member list. <strong>Coherence</strong>, on trope pages, is how tightly a trope&apos;s readings cluster in
        meaning-space: a high-coherence trope is a sharp idea, a low-coherence one is still finding its edges. The
        maturity badges (Fresh → Emerging → Established → Cliché) are plain member-count tiers, nothing more. All of
        these recompute as the corpus grows — a ranking you see today can legitimately change next month, because a
        new film&apos;s reading moved the space. Same input, same output: nothing is shuffled, nothing is promoted by
        hand, and no ranking is ever frozen into the page.
      </p>

      <hr className="rule" />

      <div className="seclbl" id="locations">Locations — location data</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        The <Link href="/locations" className="accent" style={{ textDecoration: "none" }}>Locations</Link> — the map layer
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

      <div className="seclbl">Lineage — the awards, canons and national record</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Alongside the readings, Metatake keeps a second, plainer kind of knowledge about each film: where it sits in
        cinema&apos;s public record. <Link href="/lineage" className="accent" style={{ textDecoration: "none" }}>Lineage</Link>{" "}
        is a separate structured layer — not embeddings, not close readings — that files a film against the
        traditions it belongs to: national cinemas, film movements, award histories, ranked canons, and auteur lines.
        Across more than a hundred populated award, canon and national lists it holds over ten thousand film-to-list
        memberships spanning nearly six thousand films. Where a reading tells you what a film is thinking about,
        lineage tells you what company it keeps.
      </p>
      <p className="body reading" style={{ fontSize: 18, margin: "12px 0 0" }}>
        The method is <strong>complete enumeration, not sampling</strong>. When we add the Palme d&apos;Or we add
        every Palme d&apos;Or; a ranked canon goes in whole and in order, not as a hand-picked highlight reel. Every
        entry is then <strong>resolved to the film&apos;s TMDb identity</strong> — the same identity the rest of the
        site is built on — so a lineage membership and a close reading point at the same film. Where a title
        can&apos;t be matched with confidence it is <strong>held rather than guessed</strong>: a list may honestly
        read &ldquo;N of M matched&rdquo; instead of pretending to be complete. A short count is a real count, not a
        rounded one.
      </p>
      <p className="body reading" style={{ fontSize: 18, margin: "12px 0 0" }}>
        Every entry names where it came from. Lists are compiled from <strong>official records — award bodies and
        festival archives — and from Wikipedia/Wikidata</strong>, cross-read against the canon-owners&apos; own
        published lists; each list page cites the specific source it was drawn from, linked to the award&apos;s
        Wikidata entity where one exists. Where a list has a known published length, ours is checked against it and
        any shortfall is disclosed on the page. The occasional list for which no clean public source exists is held
        back — hidden — pending verification rather than shown as authoritative. Lineage sits under the same{" "}
        <a href="#corrections" className="accent" style={{ textDecoration: "none" }}>corrections</a> loop as
        everything else: if a film is filed under the wrong award or missing from a canon it belongs to, tell us and
        we&apos;ll fix the row.
      </p>
      <p className="body reading" style={{ fontSize: 18, margin: "12px 0 0" }}>
        A word on limits. These are <strong>winners and ranked members, not full nominee slates</strong> — a Best
        Picture list holds the film that won, not the four it beat. And box office and audience ratings aren&apos;t
        kept here; those live where they belong, on{" "}
        <a href="https://www.themoviedb.org/" className="accent" style={{ textDecoration: "none" }}>TMDb</a>, not in
        the lineage layer.
      </p>

      <hr className="rule" />

      <div className="seclbl" id="index">to.W — why a film is in the index</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Every film Metatake catalogues carries a short note — a letter, addressed <em>To&nbsp;W.H.</em> and signed{" "}
        <em>W.&nbsp;Yoon</em> — saying plainly why it earned a place in the index. You&apos;ll see it on a film&apos;s{" "}
        <Link href="/takescore" className="accent" style={{ textDecoration: "none" }}>TakeScore&trade;</Link> page and,
        aggregated across a filmography, on a{" "}
        <Link href="/director" className="accent" style={{ textDecoration: "none" }}>director&apos;s</Link> page. The note
        is <strong>assembled, not written by an AI</strong>: each film is filed on a handful of plain axes — its standing
        in the critics&apos; canon, how widely it&apos;s known, which door it came in through (a canon, a festival, a
        national cinema, an auteur&apos;s body of work), and a one-line verdict — and those filings are stitched into
        English by a fixed template. Same filings in, same sentence out.
      </p>
      <p className="body reading" style={{ fontSize: 18, margin: "12px 0 0" }}>
        The verdict is the honest part. A film is called <strong>essential</strong> only when it sits in the critics&apos;
        canon proper — the standing lists, not merely an award. Below that come <strong>start here</strong> (canonical
        but approachable), <strong>deep cut</strong> (for when you&apos;re digging further), <strong>popular, not
        canon</strong> (famous, but not required viewing for a cinephile), and <strong>optional</strong>. We keep two
        rules against overclaiming. A film that&apos;s on the canon lists but scores low on TakeScore is <strong>not
        called &ldquo;canon&rdquo;</strong> — it&apos;s described as much-seen and much-talked-about, which is the true
        thing to say. And the optional films aren&apos;t hidden: each gets the same courtesy of an honest, understated
        line — <em>not a canon title, not a festival standout, not a household name</em> — rather than silence.
      </p>
      <p className="body reading" style={{ fontSize: 18, margin: "12px 0 0" }}>
        to.W is kept <strong>separate from the TakeScore appraisal</strong> it sits beside. TakeScore weighs a film&apos;s
        value against its cost and risk; to.W only says where the film stands in the catalog and why it was collected.
        The two can disagree — a canon title can score low — and the page lets them, rather than forcing one number to
        settle it. Like everything here, the filings sit under the same{" "}
        <a href="#corrections" className="accent" style={{ textDecoration: "none" }}>corrections</a> loop: if a film is
        filed under the wrong standing, tell us and we&apos;ll re-file it.
      </p>

      <hr className="rule" />

      <div className="seclbl" id="now">Now Playing — the live layer</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        <Link href="/now" className="accent" style={{ textDecoration: "none" }}>Now Playing</Link> is Metatake&apos;s
        live desk. When a film or filmmaker spikes in the world&apos;s search traffic, it publishes a short
        editor&apos;s letter within the hour, anchored to one film already in the corpus. It is deliberately the
        opposite of a generated news blurb: each letter carries{" "}
        <Link href="/editor" className="accent" style={{ textDecoration: "none" }}>Wonwoo Yoon&apos;s</Link> byline,
        is timestamped to the minute for both when it was <em>written</em> and when it was <em>published</em>, and
        argues a case the wire doesn&apos;t — not what happened, but why it matters and where it sits in film history.
      </p>
      <p className="body reading" style={{ fontSize: 18, margin: "12px 0 0" }}>
        What keeps it from being &ldquo;AI writing about the news&rdquo; is the data underneath. A candidate story is
        matched to the corpus through the same <strong>embeddings</strong> that power the rest of the site — the spike
        has to resolve to a film we actually hold before a letter is even attempted. Every figure a letter cites is
        then <strong>retrieved, not remembered</strong>: the film&apos;s{" "}
        <Link href="/takescore" className="accent" style={{ textDecoration: "none" }}>TakeScore&trade;</Link> verdict,
        its reception arc, its place in the{" "}
        <Link href="/lineage" className="accent" style={{ textDecoration: "none" }}>lineage</Link>, the places it was
        shot, the figures it deposits — each pulled live from the database and linked back so a reader can check it.
        Nothing archival is invented; the letter may only caption what the corpus already knows.
      </p>
      <p className="body reading" style={{ fontSize: 18, margin: "12px 0 0" }}>
        Two standing rules govern the tone. TakeScore appears as a <strong>verdict</strong> — &ldquo;high value, high
        risk,&rdquo; &ldquo;solid but not peak&rdquo; — rather than a corpus rank, because a rank invites an argument
        the number can&apos;t settle; a rank is named only when a film stands inside the top thousand. And the letter
        is written to <strong>wound no one</strong>: it takes positions on works, ideas and institutions, never on a
        person&apos;s character, and it reports praise and criticism alike from a neutral distance, never as an attack
        on the people who made or appear in the film. Every letter still passes the editor&apos;s factual review before
        it goes live, and sits under the same{" "}
        <a href="#corrections" className="accent" style={{ textDecoration: "none" }}>corrections</a> loop as the rest
        of the site.
      </p>

      <hr className="rule" />

      <div className="seclbl" id="corrections">Corrections</div>
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
