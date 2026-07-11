"use client";

// TVRecommended — "Recommended next" under a playing broadcast, YouTube-style
// rows WITH the reason spelled out: the shared figure/trope files the two films
// have in common (film_affinities) and/or "also by the director". Follows the
// currently playing program (refetches when it changes; responses CDN-cache).
// `onPick` plays a rec in place (the /tv watch page); without it, rows navigate
// to the rec's own /tv/[slug] page.
import { useEffect, useState } from "react";

const IMG = "https://image.tmdb.org/t/p";

type Rec = {
  slug: string; title: string; dek: string | null; seg_count: number | null; duration_ms: number | null;
  film: { title: string | null; year: number | null; slug: string | null; director: string | null; backdrop: string | null } | null;
  because: string[]; same_director: boolean; director: string | null;
};

const fmtDur = (ms?: number | null) => {
  if (!ms) return null;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export default function TVRecommended({ program, onPick }: {
  program: string | null | undefined;   // the playing program's slug (null → render nothing)
  onPick?: (slug: string) => void;
}) {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [forProgram, setForProgram] = useState<string | null>(null);

  useEffect(() => {
    if (!program || program.startsWith("intro-") || program.startsWith("seg-")) return;
    let on = true;
    fetch(`/api/tv/recommend?v=${encodeURIComponent(program)}`)
      .then((r) => r.json())
      .then((j) => { if (on) { setRecs((j.recs as Rec[] | undefined) ?? []); setForProgram(program); } })
      .catch(() => { /* keep the previous set */ });
    return () => { on = false; };
  }, [program]);

  if (!recs.length || !forProgram) return null;

  return (
    <section className="tvw-shelves tvrec" aria-label="Recommended broadcasts">
      <h2 className="tvw-shelf__h">Recommended next</h2>
      <div className="tvyt-rows">
        {recs.map((r) => {
          const why: string[] = [];
          if (r.same_director && r.director) why.push(`Also by ${r.director}`);
          why.push(...r.because);
          return (
            <a key={r.slug} className="tvyt-row" href={`/tv/${r.slug}`}
              onClick={onPick ? (e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                onPick(r.slug);
              } : undefined}>
              <span className={`tvyt-row__th${r.film?.backdrop ? "" : " tvyt-th--noimg"}`}
                style={r.film?.backdrop ? { backgroundImage: `url(${IMG}/w500${r.film.backdrop})` } : undefined}>
                {fmtDur(r.duration_ms) ? <b className="tvyt-dur">{fmtDur(r.duration_ms)}</b> : null}
              </span>
              <span className="tvyt-row__b">
                <span className="tvyt-row__t">{r.title}</span>
                <span className="tvyt-row__m">
                  Broadcast · {r.film?.title}{r.film?.year ? ` (${r.film.year})` : ""}{r.seg_count ? ` · ${r.seg_count} chapters` : ""}
                </span>
                {why.length ? (
                  <span className="tvrec-why"><b>Why</b>{why.slice(0, 3).join(" · ")}</span>
                ) : r.dek ? <span className="tvyt-row__d">{r.dek}</span> : null}
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
