import type { Metadata } from "next";
import Link from "next/link";

// Fully static: this page has no server data. It's prerendered at build and
// served from the edge (regenerated on every deploy). The old stale-prerender
// issue this used to force-SSR around is now handled by /api/revalidate.

export const metadata: Metadata = {
  title: "About — Metatake",
  description:
    "Metatake is an independent project of large-scale film interpretation: 1,900+ films connected through 26,000+ close readings in a single embedding space — AI-drafted, reviewed and edited by a named human editor.",
  alternates: { canonical: "/about" },
  robots: { index: true, follow: true },
};

const aboutJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "About Metatake",
  url: "https://metatake.net/about",
  mainEntity: {
    "@type": "Organization",
    "@id": "https://metatake.net/#org",
    name: "Metatake",
    url: "https://metatake.net",
    founder: {
      "@type": "Person",
      "@id": "https://metatake.net/editor#person",
      name: "Wonwoo Yoon",
      url: "https://metatake.net/editor",
    },
  },
};

export default function AboutPage() {
  return (
    <main className="shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }} />
      <h1 className="disp" style={{ fontSize: 30, margin: "28px 0 0" }}>About Metatake</h1>
      <p className="standfirst" style={{ margin: "14px 0 0", maxWidth: "62ch" }}>
        An independent project of large-scale film interpretation: 1,900+ films connected through 26,000+
        close readings in a single embedding space — drafted by AI, reviewed and answered for by a named
        human editor.
      </p>

      <hr className="rule" />

      <div className="seclbl">What Metatake is</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Metatake is a close-reading companion for cinema. Instead of scores and stars, it publishes{" "}
        <em>readings</em> — short, careful interpretations built around the <em>figures</em> a film keeps
        returning to: an object, a gesture, a color, a particular kind of silence. Each figure opens onto
        other films that share it, and the connections are yours to follow.
      </p>
      <p className="body reading" style={{ fontSize: 18, margin: "12px 0 0" }}>
        As of July 2026 the map holds 1,900+ films, 870+ directors, 4,700+ tropes and 26,000+ readings, and
        grows daily. Every reading lives in one embedding space, so what the database really stores is{" "}
        <em>relations</em> — which meanings sit close to which — rather than rows about titles. The scale is
        the means, not the point: a body of interpretation organized as one connected map, not a shelf of
        separate reviews.
      </p>

      <hr className="rule" />

      <div className="seclbl">Why it exists</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Most of the film web is busy telling you whether a movie is &ldquo;good.&rdquo; Very little of it
        helps with the quieter question you carry out of the theatre: <em>what was that — and what did it
        connect to?</em> A rating flattens a film into a thumbs-up. Metatake is built for the opposite
        impulse — to slow down, look again, and trace how one film rhymes with another, and with the ideas
        it&apos;s wrestling with off-screen.
      </p>

      <hr className="rule" />

      <div className="seclbl">How it works — figures, readings, tropes</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Three pieces. A <em>figure</em> is a meaningful element a film keeps returning to — a mirror, a
        staircase, a held look. A <em>Strong Misreading</em> is one bold reading of that figure, filed under
        one of fourteen <em>frameworks</em> — from the film&apos;s hidden ontology to a real place it was
        shot, a theorist it summons, or a single life it secretly rhymes with. And a <em>trope</em> is what
        surfaces when the same reading recurs across films: a coded pattern on a maturity arc, from a
        singular reading no one has made before to a full-blown cliché. Follow a figure and you don&apos;t
        get a verdict; you get a doorway to the next film.
      </p>

      <hr className="rule" />

      <div className="seclbl" id="strong-misreadings" style={{ scrollMarginTop: 70 }}>Strong Misreadings</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        The critic Harold Bloom argued that no reading is innocent — that <em>&ldquo;reading is always
        misreading,&rdquo;</em> and that the readings worth having are the strong ones: forceful
        interpretations that wrest a new meaning from a work rather than dutifully recovering its obvious
        sense. A strong misreading earns its keep not by being correct, but by how much it lets you see.
        That is the wager here. Each one takes a surface detail — an image, a line, a fact about how the
        film was made — distrusts it, and turns it into something the film never says aloud.
      </p>
      <p className="body reading" style={{ fontSize: 18, margin: "12px 0 0" }}>
        Which is why the name is what it is. To call these <em>Strong Misreadings</em> is to keep a promise:
        we push a reading as far as it will go, and we do not pretend the result is the truth of the film.
        &ldquo;Misreading&rdquo; is the disclaimer built into the title — a reading this bold forfeits any
        right to also call itself the correct one, so it doesn&apos;t. Read them as provocations, not
        verdicts. If one changes how a film looks to you, it has done the only thing it set out to do.
      </p>

      <hr className="rule" />

      <div className="seclbl">How the connections are drawn</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        The links between films aren&apos;t hand-filed into tidy categories. Every reading is turned into a
        point in a high-dimensional space — an <em>embedding</em> — so that films thinking about the same
        thing drift close together, even when they share no genre, era, or language. What you walk when you
        pull a thread is that map: the quiet, often unconscious lines that run between one film and another,
        and between a film and the world it&apos;s trying to make sense of.
      </p>
      <p className="ui muted" style={{ fontSize: 14.5, margin: "12px 0 0", maxWidth: "62ch", lineHeight: 1.6 }}>
        <em>For the technically minded:</em> embeddings don&apos;t match keywords, genres, or tags — they
        place each reading by <strong>meaning</strong>, in a space of thousands of dimensions, where distance{" "}
        <em>is</em> similarity of sense. That makes them unusually good at surfacing the affinities no one
        filed by hand: the latent kinship between films. Metatake is a sustained test of that instrument
        across a whole body of cinema.
      </p>

      <hr className="rule" />

      <div className="seclbl">Editorial standards</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Every reading is drafted by <span className="disp" style={{ fontSize: 18 }}>Metatake Editorial</span> —
        an AI system built for close film analysis — and reviewed by{" "}
        <Link href="/editor" className="accent" style={{ textDecoration: "none" }}>Wonwoo Yoon</Link>, the
        human editor, before it publishes. Nothing goes live without that pass; each page states how it was
        made and when. Factual claims — dates, credits, plot details, scholarly attributions — are checked
        at review and corrected after publication as readers and our own audits surface issues.
        Interpretations stay open: a film sustains many readings, so logged-in readers can add their own
        beneath any figure, and we don&apos;t flatten a reading because someone disagrees with it.
      </p>
      <p className="body reading" style={{ fontSize: 18, margin: "12px 0 0" }}>
        No reading is sponsored, and no one can pay to place, remove, or change one. Where a reading draws
        on published scholarship, the source is credited. Film stills and posters come from TMDB. The full
        pipeline, stage by stage, is documented in{" "}
        <Link href="/methodology" className="accent" style={{ textDecoration: "none" }}>Methodology</Link>;
        corrections are welcome at{" "}
        <a href="mailto:wonwoo@metatake.net" className="accent" style={{ textDecoration: "none" }}>
          wonwoo@metatake.net
        </a>.
      </p>

      <hr className="rule" />

      <div className="seclbl">Who&apos;s behind it</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Metatake is founded, edited, and run by{" "}
        <Link href="/editor" className="accent" style={{ textDecoration: "none" }}>Wonwoo Yoon</Link>, a
        writer on cinema based in Seoul. He was trained as a management scholar — a Ph.D. in business
        administration, with doctoral research on shared leadership and social capital — is the lead author
        of a six-volume series on Peter Drucker&apos;s management thought, and serves as global strategy
        officer of a healthcare-technology company. That training is not a detour from the method here; it
        is the method. Social capital is the study of how value lives in relations rather than in things,
        and Metatake asks the same question of cinema: not &ldquo;what is this film worth?&rdquo; but
        &ldquo;what does it connect to?&rdquo; Every reading on the site publishes under his review, and he
        answers for what stands.
      </p>

      <hr className="rule" />

      <div className="seclbl">Who it&apos;s for</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        For the viewer who leaves the cinema still turning the film over. For{" "}
        <strong>students and teachers</strong>, a thinking partner, and a way to watch a single idea — the
        gaze, cruel optimism, the double — move across dozens of films. For{" "}
        <strong>filmmakers and writers</strong>, a look at how a choice reads from the other side of the
        screen, with a working vocabulary of the devices (our{" "}
        <Link href="/tropes" className="accent" style={{ textDecoration: "none" }}>tropes</Link>) underneath.
        For <strong>critics and journalists</strong>, a sparring partner and a fast way to find the film
        that rhymes with the one in front of you. For <strong>scholars</strong>, a concept mapped across the
        corpus, with links out to the literature when you want to go deeper. No answer key, no downvotes.
      </p>

      <hr className="rule" />

      <div className="seclbl">Where it&apos;s going</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        The aim isn&apos;t to be the last word on any film. It&apos;s to become a living map of how cinema
        talks to itself — and to the world — grown reading by reading, and more and more by the people who
        use it. Connective tissue for film, not a scoreboard.
      </p>

      <hr className="rule" />

      <div className="seclbl">A note from the editor</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        I built Metatake because the after-film feeling — the one that wants to talk, to connect, to look
        once more — never had anywhere to go. The web had summaries and hot takes; it didn&apos;t have a
        room for thinking. So I made one.
      </p>
      <p className="body reading" style={{ fontSize: 18, margin: "12px 0 0" }}>
        None of this would exist without the films, or the people who made them. To the directors, writers,
        actors, cinematographers, editors, composers, and crews whose work we read here, and to the critics
        and scholars who taught all of us how to look: thank you. Metatake only rearranges light that others
        made first, and we try not to forget whose shoulders we stand on. Start anywhere — a film you love,
        a figure that catches your eye — and pull the thread.
      </p>
      <p className="body reading" style={{ fontSize: 18, margin: "12px 0 0" }}>
        — <Link href="/editor" className="accent" style={{ textDecoration: "none" }}>Wonwoo Yoon</Link>, Seoul
      </p>

      <hr className="rule" />

      <p className="ui muted" style={{ fontSize: 13 }}>
        Questions, press, or partnerships:{" "}
        <a href="mailto:wonwoo@metatake.net" className="accent" style={{ textDecoration: "none" }}>
          wonwoo@metatake.net
        </a>
        {" "}· See also{" "}
        <Link href="/methodology" className="accent" style={{ textDecoration: "none" }}>Methodology</Link>
        {" "}·{" "}
        <Link href="/editor" className="accent" style={{ textDecoration: "none" }}>The editor</Link>
      </p>
    </main>
  );
}
