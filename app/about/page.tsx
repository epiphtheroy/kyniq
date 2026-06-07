import type { Metadata } from "next";
import Link from "next/link";

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
        <span className="disp" style={{ fontSize: 18 }}>FilmCurio</span> blends{" "}
        <em>Kino</em> — German and Russian for &ldquo;film,&rdquo; the word cinephiles reach for — with{" "}
        <em>IQ</em> and <em>Unique</em>. It holds a double meaning: intelligence about film, and the{" "}
        <em>question</em> (Q) at the heart of every page.
      </p>

      <hr className="rule" />

      <div className="seclbl">How a reading is built</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Anyone can share an interpretation. The strongest readings are folded into a single canonical answer
        that the community keeps editing — so each page grows more precise over time, while the original
        perspectives stay visible beneath it. There are no wrong readings here, and no downvotes.
      </p>

      <hr className="rule" />

      <div className="seclbl">AI-assisted content</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Some initial readings are drafted with AI and reviewed by the FilmCurio editorial team. These are always
        clearly labeled with an editorial byline and disclosure. AI never creates fake users, fake upvotes,
        or fabricated engagement. All upvotes, contributions, and reputation come from real readers only.
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
