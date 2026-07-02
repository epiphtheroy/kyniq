import type { Metadata } from "next";
import Link from "next/link";

// Fully static: this page has no server data. It's prerendered at build and
// served from the edge (regenerated on every deploy). The old stale-prerender
// issue this used to force-SSR around is now handled by /api/revalidate.

export const metadata: Metadata = {
  title: "About — Metatake",
  description: "A large-scale AI project that uses embeddings to map the unconscious lines between films — and between film and the world.",
  alternates: { canonical: "/about" },
  robots: { index: true, follow: true },
};

export default function AboutPage() {
  return (
    <main className="shell">
      <h1 className="disp" style={{ fontSize: 30, margin: "28px 0 0" }}>About Metatake</h1>
      <p className="standfirst" style={{ margin: "14px 0 0", maxWidth: "62ch" }}>
        A large-scale AI project that uses embeddings to map the unconscious lines between films —
        and between film and the world.
      </p>

      <p className="body reading" style={{ fontSize: 18, margin: "18px 0 0", maxWidth: "62ch" }}>
        <strong>I&apos;m Wonwoo Yoon, and I watch a lot of films.</strong> Metatake is how I watch them: closely,
        then following the lines that run from one to the next. Welcome — make yourself at home.
      </p>

      <hr className="rule" />

      <div className="seclbl">What Metatake is</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Metatake is a close-reading companion for cinema — and, under the hood, a large-scale AI project that
        uses <em>embeddings</em> to map the unconscious connections between films, and between film and the world.
        Instead of scores and stars, it offers <em>readings</em> — short, careful interpretations built around the
        <em> figures</em> a film keeps returning to: an object, a gesture, a color, a particular kind of silence.
        Each figure opens onto other films that share it, and the connections are yours to follow.
      </p>
      <p className="body reading" style={{ fontSize: 18, margin: "12px 0 0" }}>
        The map is already substantial — 1,900+ films, 870+ directors, 4,700+ tropes and 26,000+ readings, growing
        daily — which makes it one of the largest structured, interconnected bodies of film interpretation anywhere.
        But the scale is the means, not the point: every reading lives in one embedding space, so what the database
        really stores is <em>relations</em> — which meanings sit close to which — rather than rows about titles.
      </p>

      <hr className="rule" />

      <div className="seclbl">Why it exists</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Most of the film web is busy telling you whether a movie is &ldquo;good.&rdquo; Very little of it helps with the
        quieter question you carry out of the theatre: <em>what was that — and what did it connect to?</em> A rating
        flattens a film into a thumbs-up. Metatake is built for the opposite impulse — to slow down, look again, and
        trace how one film rhymes with another, and with the ideas it&apos;s wrestling with off-screen.
      </p>

      <hr className="rule" />

      <div className="seclbl">How it works — figures, readings, tropes</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Three pieces. A <em>figure</em> is a meaningful element a film keeps returning to — a mirror, a staircase, a
        held look. A <em>Strong Misreading</em> is one bold reading of that figure, filed under one of fourteen{" "}
        <em>frameworks</em> — from the film&apos;s hidden ontology to a real place it was shot, a theorist it summons,
        or a single life it secretly rhymes with. And a <em>trope</em> is what surfaces when the same reading recurs
        across films: a coded pattern on a maturity arc, from a singular reading no one has made before to a full-blown
        cliché. Follow a figure and you don&apos;t get a verdict; you get a doorway to the next film.
      </p>

      <hr className="rule" />

      <div className="seclbl" id="strong-misreadings" style={{ scrollMarginTop: 70 }}>Strong Misreadings</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        The critic Harold Bloom argued that no reading is innocent — that <em>&ldquo;reading is always
        misreading,&rdquo;</em> and that the readings worth having are the strong ones: forceful interpretations that
        wrest a new meaning from a work rather than dutifully recovering its obvious sense. A strong misreading earns
        its keep not by being correct, but by how much it lets you see. That is the wager here. Each one takes a
        surface detail — an image, a line, a fact about how the film was made — distrusts it, and turns it into
        something the film never says aloud.
      </p>
      <p className="body reading" style={{ fontSize: 18, margin: "12px 0 0" }}>
        Which is why the name is what it is. To call these <em>Strong Misreadings</em> is to keep a promise: we push a
        reading as far as it will go, and we do not pretend the result is the truth of the film. &ldquo;Misreading&rdquo;
        is the disclaimer built into the title — a reading this bold forfeits any right to also call itself the correct
        one, so it doesn&apos;t. Read them as provocations, not verdicts. If one changes how a film looks to you, it has
        done the only thing it set out to do.
      </p>

      <hr className="rule" />

      <div className="seclbl">How the connections are drawn</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        The links between films aren&apos;t hand-filed into tidy categories. Every reading is turned into a point in a
        high-dimensional space — an <em>embedding</em> — so that films thinking about the same thing drift close
        together, even when they share no genre, era, or language. What you walk when you pull a thread is that map:
        the quiet, often unconscious lines that run between one film and another, and between a film and the world it&apos;s
        trying to make sense of. The map grows with every reading, and it&apos;s made to be wandered, not finished.
      </p>
      <p className="ui muted" style={{ fontSize: 14.5, margin: "12px 0 0", maxWidth: "62ch", lineHeight: 1.6 }}>
        <em>For the technically minded:</em> this is where film and AI genuinely meet. Embeddings don&apos;t match
        keywords, genres, or tags — they place each reading by <strong>meaning</strong>, in a space of thousands of
        dimensions, where distance <em>is</em> similarity of sense. That makes them unusually good at surfacing the
        affinities no one filed by hand: the latent, unconscious kinship between films. Metatake is, at bottom, a wager
        that this is the right instrument for that job — and an attempt to see how far it can be pushed across a whole
        body of cinema.
      </p>

      <hr className="rule" />

      <div className="seclbl">Who it&apos;s for</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        For the viewer who leaves the cinema still turning the film over — this is the room for that. For{" "}
        <strong>students and teachers</strong>, a thinking partner, and a way to watch a single idea — the gaze, cruel
        optimism, the double — move across dozens of films. For <strong>filmmakers and writers</strong>, a look at how
        a choice reads from the other side of the screen, with a working vocabulary of the devices (our{" "}
        <Link href="/tropes" className="accent" style={{ textDecoration: "none" }}>tropes</Link>) underneath. For{" "}
        <strong>critics and journalists</strong>, a sparring partner and a fast way to find the film that rhymes with
        the one in front of you. For <strong>scholars</strong>, a concept mapped across the corpus, with links out to
        the literature when you want to go deeper. No answer key, no downvotes. If watching closely is your idea of a
        good time, this was made for you.
      </p>

      <hr className="rule" />

      <div className="seclbl">Why I made it</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        I built Metatake because that after-film feeling — the one that wants to talk, to connect, to look once
        more — never had anywhere to go. The web had summaries and hot takes; it didn&apos;t have a room for thinking.
        So I made one.
      </p>

      <hr className="rule" />

      <div className="seclbl">Where it&apos;s going</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        The aim isn&apos;t to be the last word on any film. It&apos;s to become a living map of how cinema talks to
        itself — and to the world — grown reading by reading, and more and more by the people who use it. Connective
        tissue for film, not a scoreboard.
      </p>

      <hr className="rule" />

      <div className="seclbl">How to wander</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Start anywhere — a film you love, a figure that catches your eye — and pull the thread. One figure leads to
        another film, which opens another reading, which suggests the next. It&apos;s a rabbit hole, the good kind; we
        won&apos;t apologize for the hours you lose in it. Add your own take beneath any figure — there are no wrong
        readings here. More than anything, it just wants you to keep looking.
      </p>

      <hr className="rule" />

      <div className="seclbl">With gratitude</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        A last word, and the most important one. None of this would exist without the films — or the people who made
        them. To the directors, writers, actors, cinematographers, editors, composers, and crews whose work we read
        here, and to the critics and scholars who taught all of us how to look: thank you. Metatake only rearranges
        light that others made first. The same is true of the system that drafts these readings — it can write about
        film only because a century of film, and of writing about film, came before it. Every new work leans on the
        work that made it possible, and we try not to forget whose shoulders we stand on.
      </p>

      <hr className="rule" />

      <div className="seclbl">How our readings are written</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        The readings are drafted by{" "}
        <span className="disp" style={{ fontSize: 18 }}>Metatake Editorial</span> — an AI system built for close film
        analysis — and every reading is reviewed and edited by{" "}
        <Link href="/editor" className="accent" style={{ textDecoration: "none" }}>Wonwoo Yoon</Link>, the human editor,
        who signs off on what stands on the site. They draw on the language and concepts of film criticism
        and theory, but each reading is an <em>interpretation, not a citation</em>. Quality is kept up by that
        editorial pass and an ongoing audit-and-revision loop: we and
        our readers flag errors, and pages are corrected as issues surface. We fix factual mistakes; interpretations
        stay open — a film sustains many readings, so logged-in readers can add their own beneath any figure (no
        downvotes). Film stills and posters come from TMDB. Spot something off? Corrections are welcome at the address
        below. For the full pipeline, step by step, see{" "}
        <Link href="/methodology" className="accent" style={{ textDecoration: "none" }}>Methodology</Link>.
      </p>

      <hr className="rule" />

      <div className="seclbl">Who&apos;s behind it</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Metatake is made and edited by{" "}
        <Link href="/editor" className="accent" style={{ textDecoration: "none" }}>Wonwoo Yoon</Link> — a cinephile in
        Seoul, trained as a management scholar, who started Metatake to give the after-film feeling somewhere to go.
        The readings are drafted by Metatake Editorial, then reviewed, edited and published under his name. Questions,
        corrections, and disagreements are all welcome.
      </p>

      <hr className="rule" />

      <p className="ui muted" style={{ fontSize: 13 }}>
        Questions, press, or partnerships:{" "}
        <a href="mailto:wonwoo@metatake.net" className="accent" style={{ textDecoration: "none" }}>
          wonwoo@metatake.net
        </a>
      </p>
    </main>
  );
}
