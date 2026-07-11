"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import SiteNavClient from "@/components/home2/SiteNavClient";
import AskReadings, { AskModeToggle, REG, type Cite, type AskMode } from "@/components/AskReadings";
import FurtherReading, { type AcademicRef } from "@/app/rag/_components/FurtherReading";

type Critic = { snippet: string; outlet: string; author: string | null; url: string; year: number | null };
type Result = { answer: string; citations: Cite[]; readings: { slug: string; title: string }[]; critics?: Critic[]; further_reading?: AcademicRef[] };

const EXAMPLES = [
  "How does cinema portray surveillance?",
  "What does the color red tend to mean?",
  "How do films show grief without dialogue?",
  "What is the meaning of mirrors on screen?",
];

function citeTarget(c: Cite) {
  return c.meta_slug ? `/trope/${c.meta_slug}` : `/film/${c.film_slug}/figure/${c.figure_slug}`;
}

function renderPara(para: string, map: Map<number, Cite>, k: string, onCite: (n: number) => void, criticsLen = 0) {
  const parts = para.split(/(\[C?\d+\])/g);
  return (
    <p key={k} className="ak-p">
      {parts.map((p, i) => {
        const mc = p.match(/^\[C(\d+)\]$/);
        if (mc) {
          const n = Number(mc[1]);
          if (n >= 1 && n <= criticsLen) {
            return (
              <a key={i} href={`#ak-crit-${n}`} className="ak-cite ak-cite--crit" title="Critic source">[C{mc[1]}]</a>
            );
          }
          return <span key={i}>{p}</span>;
        }
        const m = p.match(/^\[(\d+)\]$/);
        if (m) {
          const n = Number(m[1]);
          const c = map.get(n);
          if (c) {
            return (
              <a
                key={i}
                href={`#ak-src-${n}`}
                className="ak-cite"
                title={`${c.figure_label} · ${c.film_title}`}
                onClick={() => onCite(n)}
              >
                [{m[1]}]
              </a>
            );
          }
        }
        return <span key={i}>{p}</span>;
      })}
    </p>
  );
}

function AskInner() {
  const sp = useSearchParams();
  const ranRef = useRef(false);
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [hi, setHi] = useState<number | null>(null);
  const [mode, setMode] = useState<AskMode>("answer");

  async function run(question?: string) {
    const query = (question ?? q).trim();
    if (query.length < 3 || loading) return;
    if (question) setQ(question);
    setAsked(query);
    setLoading(true); setErr(null); setRes(null); setHi(null); setMode("answer");
    try {
      const r = await fetch("/api/rag", {
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

  useEffect(() => {
    const q0 = sp.get("q");
    if (q0 && q0.trim().length >= 3 && !ranRef.current) { ranRef.current = true; setQ(q0); run(q0); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const map = new Map((res?.citations ?? []).map((c) => [c.rank, c]));

  return (
    <div className="mt">
      <SiteNavClient />
      <div className="ak-wrap">
        <div className="ak-head">
          <h1 className="ak-h1">Metatake AI</h1>
          <p className="ak-sub">
            Ask a question about cinema. Every answer is drawn <em>only</em> from Metatake&apos;s 18,004 close readings — and every claim links back to the reading it came from.
          </p>
          <p className="ak-stamp"><span className="ak-gl">▦</span> Grounded in the corpus · retrieved, not generated · <Link href="/chat" className="ak-foot__link">Try Chat →</Link></p>

          <form className="ak-bar" onSubmit={(e) => { e.preventDefault(); run(); }}>
            <input
              className="ak-input" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="How does cinema portray surveillance?" maxLength={300} autoFocus
              aria-label="Ask a question about cinema"
            />
            <button className="ak-go" type="submit" disabled={loading || q.trim().length < 3}>
              {loading ? "Reading…" : "Ask"}
            </button>
          </form>

          <div className="ak-eg">
            {EXAMPLES.map((x) => (
              <button key={x} type="button" className="ak-chip" onClick={() => run(x)} disabled={loading}>{x}</button>
            ))}
          </div>

          {loading ? <p className="ak-loading">Searching 18,004 readings, then composing…</p> : null}
          {err ? <p className="ak-err">{err}</p> : null}
        </div>

        {res ? (
          <div className="ak-out">
            <div className="ak-q">
              <span className="ak-q__lbl">Answering</span>
              <b className="ak-q__txt">{asked}</b>
              <span className="ak-q__tag">grounded</span>
            </div>

            {res.citations.length > 0 ? (
              <div className="ak-modebar">
                <AskModeToggle mode={mode} onChange={setMode} readingCount={res.citations.length} />
                {mode === "answer" ? (
                  <button
                    type="button"
                    className="ak-modebar__cue"
                    onClick={() => setMode("readings")}
                    aria-label={`Browse the ${res.citations.length} retrieved readings`}
                  >
                    <span className="ak-modebar__n">{res.citations.length}</span> readings retrieved
                  </button>
                ) : null}
              </div>
            ) : null}

            {mode === "answer" ? (
              <>
                <div className="ak-answer">
                  {res.answer.split(/\n\n+/).map((para, i) => renderPara(para, map, `p${i}`, setHi, res.critics?.length ?? 0))}
                </div>

                {res.readings.length > 0 ? (
                  <div className="ak-threads">
                    <span className="ak-threads__lbl">Tropes to pull</span>
                    {res.readings.slice(0, 6).map((rd) => (
                      <Link key={rd.slug} href={`/trope/${rd.slug}`} className="ak-thread">{rd.title}</Link>
                    ))}
                  </div>
                ) : null}

                {res.citations.length > 0 ? (
                  <div className="ak-sources">
                    <div className="ak-sources__lbl">Sources — every claim above, traceable</div>
                    <ol className="ak-srclist">
                      {res.citations.map((c) => {
                        const reg = c.register ? REG[c.register] : null;
                        return (
                          <li key={c.rank} id={`ak-src-${c.rank}`} className={hi === c.rank ? "ak-hi" : undefined}>
                            <Link href={`/film/${c.film_slug}/figure/${c.figure_slug}`} className="ak-fig">{c.figure_label}</Link>
                            <span className="ak-film"> · {c.film_title}</span>
                            {reg ? <span className="ak-reg" style={{ background: reg[1] }}>{reg[0]}</span> : null}
                            {c.meta_slug && c.meta_title ? (
                              <> &nbsp;→&nbsp; <Link href={citeTarget(c)} className="ak-to">{c.meta_title}</Link></>
                            ) : null}
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                ) : null}

                {res.critics && res.critics.length > 0 ? (
                  <div className="ak-sources ak-critics">
                    <div className="ak-sources__lbl">Critics — short quotes, attributed &amp; linked to the source</div>
                    <ol className="ak-srclist">
                      {res.critics.map((c, i) => (
                        <li key={i} id={`ak-crit-${i + 1}`}>
                          <em className="ak-critq">&ldquo;{c.snippet}&rdquo;</em>{" "}
                          <span className="ak-film">— {[c.author, c.outlet, c.year != null ? String(c.year) : null].filter(Boolean).join(", ")}</span>{" "}
                          <a href={c.url} target="_blank" rel="noopener nofollow" className="ak-to">source ↗</a>
                        </li>
                      ))}
                    </ol>
                  </div>
                ) : null}

                <FurtherReading items={res.further_reading} />
              </>
            ) : (
              <AskReadings citations={res.citations} />
            )}
          </div>
        ) : null}

        <p className="ak-foot">
          Answers are synthesized by an AI <b>strictly from our close readings</b> — interpretations, not citations of record. Follow the links to read the source. No claim appears that isn&apos;t traceable to a reading in the corpus. &nbsp;Looking to post a question for others?{" "}
          <Link href="/ask/new" className="ak-foot__link">Ask the community →</Link>
        </p>
      </div>
    </div>
  );
}

export default function AskPage() {
  return (
    <Suspense fallback={null}>
      <AskInner />
    </Suspense>
  );
}
