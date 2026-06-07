import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — FilmCurio",
  description: "A place to read films closely — together, and out loud.",
};

export default function AboutPage() {
  return (
    <main className="shell">
      <h1 className="disp" style={{ fontSize: 30, margin: "28px 0 0" }}>About FilmCurio</h1>
      <p className="standfirst" style={{ margin: "14px 0 0", maxWidth: "60ch" }}>
        A place to read films closely — together, and out loud.
      </p>

      <hr className="rule" />

      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Difficult films leave us with questions: what did that image mean, why that cut, whose memory are we inside?
        FilmCurio gathers those questions, one film at a time, and lets readers build an answer together — a single,
        evolving interpretation that anyone can deepen, beside the many readings that disagree with it.
      </p>

      <hr className="rule" />

      <div className="seclbl">The name</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        <span className="disp" style={{ fontSize: 18 }}>FilmCurio</span> joins{" "}
        <em>film</em> with <em>curio</em> — a small, intriguing object you keep because it rewards
        a second look. The site is a cabinet of cinema&apos;s curiosities, and the{" "}
        <em>question</em> (the &ldquo;?&rdquo; in the mark) sits at the heart of every page.
      </p>

      <hr className="rule" />

      <div className="seclbl">How a reading is built</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Each page centers on one canonical answer — the clearest interpretation we can assemble for
        a given question — refined over time so the page grows more precise. Anyone can add their
        own reading beneath it, and the strongest community contributions are merged upward into
        that canonical answer, with the original perspectives staying visible underneath. There are
        no wrong readings here, and no downvotes.
      </p>

      <hr className="rule" />

      <div className="seclbl">How our interpretations are written</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        We want to be straight with you about this. The featured readings are written by{" "}
        <span className="disp" style={{ fontSize: 18 }}>FilmCurio Editorial</span>, an AI system
        built for close film analysis. It checks its own facts and sourcing as it writes, and we
        publish directly — there is no separate human or second-model review before a reading goes
        up. Instead we audit published pages on an ongoing basis and revise them as readers, and our
        own spot-checks, surface mistakes. We&apos;d rather tell you plainly that this is AI
        writing, published as written and corrected in the open, than pretend a person signs off on
        every line. Film stills and related videos are attached by{" "}
        <span className="disp" style={{ fontSize: 18 }}>Curiobot</span>, with images from TMDB.
        Spot something off? Tell us — corrections are welcome at the address below.
      </p>

      <hr className="rule" />

      <div className="seclbl">Who&apos;s behind it</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        FilmCurio is an independent project based in Seoul, Republic of Korea. It&apos;s small and
        built in the open; the quickest way to reach a human is email.
      </p>

      <hr className="rule" />

      <p className="ui muted" style={{ fontSize: 13 }}>
        Questions, press, or partnerships:{" "}
        <a href="mailto:channel.wonwoo@gmail.com" className="accent" style={{ textDecoration: "none" }}>
          channel.wonwoo@gmail.com
        </a>
      </p>
    </main>
  );
}
