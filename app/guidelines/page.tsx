import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Community Guidelines — Metatake",
  description: "Metatake community guidelines for film interpretation and discussion.",
  alternates: { canonical: "/guidelines" },
};

export default function GuidelinesPage() {
  return (
    <main className="shell">
      <h1 className="disp" style={{ fontSize: 30, margin: "28px 0 0" }}>Community Guidelines</h1>
      <p className="standfirst" style={{ margin: "14px 0 0", maxWidth: "60ch" }}>
        How we talk about films here.
      </p>

      <hr className="rule" />

      <div className="seclbl">Be generous with reading</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Every interpretation is worth hearing. When you disagree, offer a richer reading rather than dismissing one.
        Interpretations aren&apos;t right or wrong — only shallower or deeper. Factual errors, though, are always worth flagging.
      </p>

      <hr className="rule" />

      <div className="seclbl">No downvotes, only upvotes</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Metatake has no downvote button. Quality comes from curation and promotion, not punishment.
        If you see something that doesn&apos;t belong, use the flag system to report it quietly.
      </p>

      <hr className="rule" />

      <div className="seclbl">Write for the reader who comes next</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Your reading may be folded into the canonical answer. Write clearly, cite specifics from the film,
        and consider how your interpretation connects to or extends what&apos;s already there.
      </p>

      <hr className="rule" />

      <div className="seclbl">Keep it about the film</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Metatake is for film interpretation — meaning, symbolism, technique, and intent.
        Avoid trivia, plot recaps, personal attacks, spam, or off-topic content.
      </p>
    </main>
  );
}
