"use client";

/** Compact "Ask Metatake" entry for the homepage — routes to /ask-ai?q=… which auto-runs. */

import { useState } from "react";
import { useRouter } from "next/navigation";

const EG = [
  "How does cinema portray surveillance?",
  "What does the colour red mean?",
  "How do films show grief without dialogue?",
];

export default function AskBox() {
  const [q, setQ] = useState("");
  const router = useRouter();
  const go = (query?: string) => {
    const v = (query ?? q).trim();
    if (v.length < 3) return;
    router.push(`/ask-ai?q=${encodeURIComponent(v)}`);
  };

  return (
    <section className="askhome">
      <div className="askhome-h">Ask Metatake</div>
      <p className="mt-sub" style={{ margin: "0 0 8px" }}>
        Ask a question about cinema — answered only from our readings, every claim linked to its source.
      </p>
      <form className="askbar" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <input
          className="ask-input" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="How does cinema portray surveillance?" maxLength={300} aria-label="Ask a question about cinema"
        />
        <button className="ask-go" type="submit" disabled={q.trim().length < 3}>Ask</button>
      </form>
      <div className="ask-eg">
        {EG.map((x) => <button key={x} type="button" className="ask-chip" onClick={() => go(x)}>{x}</button>)}
      </div>
    </section>
  );
}
