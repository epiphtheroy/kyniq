"use client";

import { useState } from "react";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";

type Cite = {
  rank: number; take_id: string; rationale: string; register: string | null; theorist: string | null;
  film_title: string; film_slug: string; figure_label: string; figure_slug: string;
  meta_title: string | null; meta_slug: string | null;
};
type Result = { answer: string; citations: Cite[]; readings: { slug: string; title: string }[] };

const EXAMPLES = [
  "How does cinema portray surveillance?",
  "What does the color red tend to mean?",
  "How do films show grief without dialogue?",
  "What is the meaning of mirrors on screen?",
];

function citeTarget(c: Cite) {
  return c.meta_slug ? `/take/${c.meta_slug}` : `/film/${c.film_slug}/figure/${c.figure_slug}`;
}

function renderPara(para: string, map: Map<number, Cite>, k: string) {
  const parts = para.split(/(\[\d+\])/g);
  return (
    <p key={k} className="ask-p">
      {parts.map((p, i) => {
        const m = p.match(/^\[(\d+)\]$/);
        if (m) {
          const c = map.get(Number(m[1]));
          if (c) return <Link key={i} href={citeTarget(c)} className="ask-cite" title={`${c.figure_label} · ${c.film_title}`}>[{m[1]}]</Link>;
        }
        return <span key={i}>{p}</span>;
      })}
    </p>
  );
}

export default function AskPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function run(question?: string) {
    const query = (question ?? q).trim();
    if (query.length < 3 || loading) return;
    if (question) setQ(question);
    setLoading(true); setErr(null); setRes(null);
    try {
      const r = await fetch("/api/ask", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: query }),
      });
      const d = await r.json();
      if (!r.ok) setErr(d.error || "Couldn't answer that.");
      else setRes(d as Result);
    } catch {
      setErr("Network error — try again.");
    }
    setLoading(false);
  }

  const map = new Map((res?.citations ?? []).map((c) => [c.rank, c]));

  return (
    <div className="mt">
      <MetatakeNav active="ask" />
      <div className="mt-wrap">
        <h1 className="mt-h1" style={{ borderBottom: "none", marginBottom: 2 }}>Ask Metatake</h1>
        <p className="mt-laconic" style={{ margin: "0 0 14px", maxWidth: "64ch" }}>
          Ask a question about cinema. Every answer is drawn <em>only</em> from Metatake&rsquo;s {`18,004`} close readings — and every claim links back to the reading it came from.
        </p>

        <form className="askbar" onSubmit={(e) => { e.preventDefault(); run(); }}>
          <input
            className="ask-input" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="How does cinema portray surveillance?" maxLength={300} autoFocus
            aria-label="Ask a question about cinema"
          />
          <button className="ask-go" type="submit" disabled={loading || q.trim().length < 3}>
            {loading ? "Reading…" : "Ask"}
          </button>
        </form>

        <div className="ask-eg">
          {EXAMPLES.map((x) => (
            <button key={x} type="button" className="ask-chip" onClick={() => run(x)} disabled={loading}>{x}</button>
          ))}
        </div>

        {err ? <p className="ask-err">{err}</p> : null}
        {loading ? <p className="ask-loading">Searching 18,004 readings, then composing&hellip;</p> : null}

        {res ? (
          <div className="ask-out">
            <div className="ask-answer">
              {res.answer.split(/\n\n+/).map((para, i) => renderPara(para, map, `p${i}`))}
            </div>

            {res.readings.length > 0 ? (
              <div className="ask-threads">
                <span className="ask-threads__lbl">Threads to pull</span>
                {res.readings.slice(0, 6).map((rd) => (
                  <Link key={rd.slug} href={`/take/${rd.slug}`} className="ask-thread">{rd.title}</Link>
                ))}
              </div>
            ) : null}

            {res.citations.length > 0 ? (
              <div className="ask-sources">
                <div className="ask-sources__lbl">Sources</div>
                <ol className="ask-srclist">
                  {res.citations.map((c) => (
                    <li key={c.rank} id={`src-${c.rank}`}>
                      <Link href={`/film/${c.film_slug}/figure/${c.figure_slug}`} className="mt-fig">{c.figure_label}</Link>
                      <span className="ask-src-film"> · {c.film_title}</span>
                      {c.meta_slug && c.meta_title ? <> &nbsp;→&nbsp; <Link href={`/take/${c.meta_slug}`}>{c.meta_title}</Link></> : null}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        ) : null}

        <p className="ask-foot">
          Answers are synthesized by an AI strictly from our close readings — interpretations, not citations of record. Follow the links to read the source. Looking to post a question for others?{" "}
          <Link href="/ask/new" className="mt-link">Ask the community →</Link>
        </p>
      </div>
    </div>
  );
}
