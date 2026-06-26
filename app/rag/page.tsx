"use client";

/**
 * /rag — the v2 ASK pipeline on a dedicated, isolated surface.
 *
 * This page is a verification/preview surface for the upgraded grounded-RAG
 * stack. It is a sibling of /ask (v1) and does NOT touch it. It calls
 * POST /api/rag (query-understanding → embed → ask_retrieve → rerank →
 * dynamic diversify → grounded generation) and renders:
 *   - the grounded answer + traceable corpus sources (Answer mode),
 *   - the retrieved close-readings as first-class cards (Readings mode),
 *   - a clearly-separated "Further reading — beyond the corpus" academic rail
 *     (only when ACADEMIC_FURTHER_READING is enabled server-side),
 *   - a small diagnostic strip (intent · lang · reranker · model) so we can
 *     confirm every stage of the pipeline is actually firing.
 *
 * Grounding integrity is preserved: academic items arrive in a SEPARATE
 * `further_reading` field and are never merged into the corpus citations.
 */

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import SiteNavClient from "@/components/home2/SiteNavClient";
import AskReadings, { AskModeToggle, REG, type Cite, type AskMode } from "./_components/AskReadings";
import FurtherReading, { type AcademicRef } from "./_components/FurtherReading";
import CriticQuotes, { type Critic } from "./_components/CriticQuotes";

type Meta = {
  model?: string | null;
  intent?: string | null;
  lang?: string | null;
  reranker?: string | null;
  inTokens?: number | null;
  outTokens?: number | null;
  costUsd?: number | null;
};
type Result = {
  answer: string;
  citations: Cite[];
  readings: { slug: string; title: string }[];
  meta?: Meta;
  further_reading?: AcademicRef[];
  critics?: Critic[];
};

const ENDPOINT = "/api/rag";

const EXAMPLES = [
  "How does cinema portray surveillance?",
  "What does the color red tend to mean?",
  "How do films show grief without dialogue?",
  "거울은 영화에서 무엇을 의미하는가?",
];

function citeTarget(c: Cite) {
  return c.meta_slug ? `/take/${c.meta_slug}` : `/film/${c.film_slug}/figure/${c.figure_slug}`;
}

function renderPara(para: string, map: Map<number, Cite>, k: string, onCite: (n: number) => void) {
  const parts = para.split(/(\[\d+\])/g);
  return (
    <p key={k} className="ak-p">
      {parts.map((p, i) => {
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

/** Diagnostic strip — confirms each pipeline stage is live (intent/lang/rerank/model). */
function MetaStrip({ meta }: { meta?: Meta }) {
  if (!meta) return null;
  const bits: [string, string | null | undefined][] = [
    ["intent", meta.intent],
    ["lang", meta.lang],
    ["reranker", meta.reranker],
    ["model", meta.model],
  ];
  const shown = bits.filter(([, v]) => v);
  if (shown.length === 0) return null;
  return (
    <div
      aria-label="Pipeline diagnostics"
      style={{
        display: "flex", flexWrap: "wrap", gap: 8, margin: "10px 0 4px",
        fontSize: 11.5, color: "var(--subtle)", fontFamily: "var(--font-ui, inherit)",
      }}
    >
      {shown.map(([k, v]) => (
        <span
          key={k}
          style={{ border: "1px solid var(--hairline, #e5e5e5)", borderRadius: 2, padding: "1px 6px" }}
        >
          <span style={{ opacity: 0.6 }}>{k}:</span> {v}
        </span>
      ))}
    </div>
  );
}

function RagInner() {
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
      const r = await fetch(ENDPOINT, {
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
          <h1 className="ak-h1">
            Ask Metatake <span style={{ fontSize: "0.5em", verticalAlign: "middle", color: "var(--subtle)", letterSpacing: "0.08em" }}>RAG · v2</span>
          </h1>
          <p className="ak-sub">
            The upgraded grounded-RAG pipeline — query understanding, reranking, and a separate scholarly rail.
            Every answer is still drawn <em>only</em> from Metatake&apos;s close readings, and every claim links back to its source.
          </p>
          <p className="ak-stamp"><span className="ak-gl">▦</span> Grounded in the corpus · retrieved, not generated · multilingual</p>

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

          {loading ? <p className="ak-loading">Understanding the question, searching the corpus, then composing…</p> : null}
          {err ? <p className="ak-err">{err}</p> : null}
        </div>

        {res ? (
          <div className="ak-out">
            <div className="ak-q">
              <span className="ak-q__lbl">Answering</span>
              <b className="ak-q__txt">{asked}</b>
              <span className="ak-q__tag">grounded</span>
            </div>

            <MetaStrip meta={res.meta} />

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
                  {res.answer.split(/\n\n+/).map((para, i) => renderPara(para, map, `p${i}`, setHi))}
                </div>

                {res.readings.length > 0 ? (
                  <div className="ak-threads">
                    <span className="ak-threads__lbl">Threads to pull</span>
                    {res.readings.slice(0, 6).map((rd) => (
                      <Link key={rd.slug} href={`/take/${rd.slug}`} className="ak-thread">{rd.title}</Link>
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

                {/* Critic quotes (W8) — separate, attributed, link-out. No-ops unless present. */}
                <CriticQuotes items={res.critics} />

                {/* Academic rail — separate, labeled, link-out only. No-ops unless the field is present. */}
                <FurtherReading items={res.further_reading} />
              </>
            ) : (
              <AskReadings citations={res.citations} />
            )}
          </div>
        ) : null}

        <p className="ak-foot">
          Answers are synthesized by an AI <b>strictly from our close readings</b> — interpretations, not citations of record.
          Follow the links to read the source. No claim appears that isn&apos;t traceable to a reading in the corpus.
          &nbsp;This is the v2 (RAG) surface; the classic experience lives at <Link href="/ask" className="ak-foot__link">/ask</Link>.
        </p>
      </div>
    </div>
  );
}

export default function RagPage() {
  return (
    <Suspense fallback={null}>
      <RagInner />
    </Suspense>
  );
}
