"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import SiteNavClient from "@/components/home2/SiteNavClient";
import { REG, type Cite } from "@/components/AskReadings";
import FurtherReading, { type AcademicRef } from "@/app/rag/_components/FurtherReading";

type Critic = { snippet: string; outlet: string; author: string | null; url: string; year: number | null };
type Result = {
  answer: string;
  citations: Cite[];
  readings: { slug: string; title: string }[];
  critics?: Critic[];
  further_reading?: AcademicRef[];
};
type Turn = { q: string; res?: Result; err?: string; loading?: boolean };

const EXAMPLES = [
  "How does Bong Joon-ho use space?",
  "What does the color red tend to mean?",
  "How do films show grief without dialogue?",
  "What is the meaning of mirrors on screen?",
];

function citeTarget(c: Cite) {
  return c.meta_slug ? `/trope/${c.meta_slug}` : `/film/${c.film_slug}/figure/${c.figure_slug}`;
}

// Render one answer paragraph, linkifying [n] (corpus) and [C#] (critic) markers.
// Anchors are namespaced by `pfx` (the turn id) so ids never collide across turns.
function renderPara(para: string, map: Map<number, Cite>, k: string, pfx: string, criticsLen = 0) {
  const parts = para.split(/(\[C?\d+\])/g);
  return (
    <p key={k} className="ak-p">
      {parts.map((p, i) => {
        const mc = p.match(/^\[C(\d+)\]$/);
        if (mc) {
          const n = Number(mc[1]);
          if (n >= 1 && n <= criticsLen) {
            return (
              <a key={i} href={`#${pfx}-crit-${n}`} className="ak-cite ak-cite--crit" title="Critic source">[C{mc[1]}]</a>
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
              <a key={i} href={`#${pfx}-src-${n}`} className="ak-cite" title={`${c.figure_label} · ${c.film_title}`}>[{m[1]}]</a>
            );
          }
        }
        return <span key={i}>{p}</span>;
      })}
    </p>
  );
}

// One assistant turn: grounded answer + threads + sources + critics + further reading.
function Answer({ res, pfx }: { res: Result; pfx: string }) {
  const map = new Map(res.citations.map((c) => [c.rank, c]));
  return (
    <div className="ak-out">
      <div className="ak-answer">
        {res.answer.split(/\n\n+/).map((para, i) => renderPara(para, map, `${pfx}p${i}`, pfx, res.critics?.length ?? 0))}
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
                <li key={c.rank} id={`${pfx}-src-${c.rank}`}>
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
              <li key={i} id={`${pfx}-crit-${i + 1}`}>
                <em className="ak-critq">&ldquo;{c.snippet}&rdquo;</em>{" "}
                <span className="ak-film">— {[c.author, c.outlet, c.year != null ? String(c.year) : null].filter(Boolean).join(", ")}</span>{" "}
                <a href={c.url} target="_blank" rel="noopener noreferrer nofollow" className="ak-to">source ↗</a>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <FurtherReading items={res.further_reading} />
    </div>
  );
}

function ChatInner() {
  const sp = useSearchParams();
  const ranRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState<Turn[]>([]);
  const loading = msgs.some((m) => m.loading);

  async function run(question?: string) {
    const query = (question ?? q).trim();
    if (query.length < 3 || loading) return;
    setQ("");
    // Build conversation history from completed turns (last ~3 turns).
    const history = msgs
      .filter((m) => m.res)
      .flatMap((m) => [
        { role: "user", content: m.q },
        { role: "assistant", content: m.res!.answer },
      ])
      .slice(-6);
    const idx = msgs.length;
    setMsgs((m) => [...m, { q: query, loading: true }]);
    try {
      const r = await fetch("/api/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, history }),
      });
      const d = await r.json();
      setMsgs((m) =>
        m.map((t, i) => (i === idx ? (r.ok ? { q: query, res: d as Result } : { q: query, err: d.error || "Couldn't answer that." }) : t))
      );
    } catch {
      setMsgs((m) => m.map((t, i) => (i === idx ? { q: query, err: "Network error — try again." } : t)));
    }
  }

  useEffect(() => {
    const q0 = sp.get("q");
    if (q0 && q0.trim().length >= 3 && !ranRef.current) {
      ranRef.current = true;
      run(q0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  return (
    <div className="mt">
      <SiteNavClient />
      <div className="ak-wrap">
        <div className="ak-head">
          <h1 className="ak-h1">Metatake AI · Chat</h1>
          <p className="ak-sub">
            A grounded conversation about cinema. Every answer is drawn <em>only</em> from Metatake&apos;s 18,004 close
            readings — every claim links back to its source — and it remembers the thread, so you can ask follow-ups.
          </p>
          <p className="ak-stamp"><span className="ak-gl">▦</span> Grounded in the corpus · retrieved, not generated</p>

          {msgs.length === 0 ? (
            <div className="ak-eg">
              {EXAMPLES.map((x) => (
                <button key={x} type="button" className="ak-chip" onClick={() => run(x)} disabled={loading}>{x}</button>
              ))}
            </div>
          ) : null}
        </div>

        {msgs.length > 0 ? (
          <div className="ak-chat">
            {msgs.map((m, ti) => (
              <div className="ak-turn" key={ti}>
                <div className="ak-q">
                  <span className="ak-q__lbl">You</span>
                  <b className="ak-q__txt">{m.q}</b>
                </div>
                {m.loading ? <p className="ak-loading">Searching 18,004 readings, then composing…</p> : null}
                {m.err ? <p className="ak-err">{m.err}</p> : null}
                {m.res ? <Answer res={m.res} pfx={`t${ti}`} /> : null}
              </div>
            ))}
            <div ref={endRef} />
          </div>
        ) : null}

        <form className="ak-bar ak-bar--chat" onSubmit={(e) => { e.preventDefault(); run(); }}>
          <input
            className="ak-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={msgs.length ? "Ask a follow-up…" : "How does Bong Joon-ho use space?"}
            maxLength={300}
            autoFocus
            aria-label="Chat with Metatake AI"
          />
          <button className="ak-go" type="submit" disabled={loading || q.trim().length < 3}>
            {loading ? "Reading…" : "Send"}
          </button>
          {msgs.length ? (
            <button type="button" className="ak-chip ak-chip--new" onClick={() => { setMsgs([]); setQ(""); }}>
              New chat
            </button>
          ) : null}
        </form>

        <p className="ak-foot">
          Answers are synthesized by an AI <b>strictly from our close readings</b> — interpretations, not citations of
          record. Follow the links to read the source. No claim appears that isn&apos;t traceable to a reading in the
          corpus. &nbsp;Prefer a single grounded answer?{" "}
          <Link href="/ask-ai" className="ak-foot__link">Use Ask →</Link>
        </p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatInner />
    </Suspense>
  );
}
