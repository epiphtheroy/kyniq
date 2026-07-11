"use client";

// TVSingle — the per-film broadcast page body (/tv/[slug]). Plays ONE compiled
// program (tv_segments beats over the film's trailer), lists its chapters, and
// rails a few other broadcasts. The page is the canonical, indexable "upload"
// of the film's METATAKE TV video; the film page embeds the same program in its
// hero. Reuses the /tv/watch furniture (.tvw-*, .tvpg-*, .tv-embed via player).
import { useState } from "react";
import SiteNavClient from "@/components/home2/SiteNavClient";
import TVProgramPlayer, { type TVEntry, type TVSegment } from "@/components/TVProgramPlayer";

const IMG = "https://image.tmdb.org/t/p";

type MoreItem = { slug: string; title: string; film: TVEntry["film"] };

export default function TVSingle({ entry, more }: { entry: TVEntry; more: MoreItem[] }) {
  const [nonce, setNonce] = useState(0);           // remount → a fresh random cut on loop
  const [nowSeg, setNowSeg] = useState<TVSegment | null>(null);
  const chapters = entry.segments ?? [];
  const jump = (i: number) => window.dispatchEvent(new CustomEvent("tvw-jump", { detail: i }));

  return (
    <div className="mt tvpg tvw">
      <SiteNavClient />
      <div className="tvw-wrap">
        <header className="tvpg-head">
          <div className="tvpg-brand">
            <span className="tvpg-brand__n">METATAKE</span>
            <span className="tvpg-brand__tv">TV</span>
            <span className="tvpg-brand__live">● ON AIR</span>
          </div>
          <p className="tvpg-tag">A single-film broadcast, compiled from the Metatake record with no LLM. Chapters play in a random cut — reload for a new one.</p>
          <a className="tvpg-full" href="/watch">Browse all watch lists ↗</a>
        </header>

        <div className="tvw-main">
          <div className="tvw-left">
            <div className="tvw-player">
              <TVProgramPlayer key={nonce} entries={[entry]} entryIdx={0} onEntryEnd={() => setNonce((n) => n + 1)} onNow={setNowSeg} />
            </div>

            <div className="tvw-meta">
              <h1 className="tvw-title">{entry.title}</h1>
              <p className="tvw-sub">
                {entry.film?.slug ? <a href={`/film/${entry.film.slug}`}>{entry.film?.title}</a> : entry.film?.title}
                {entry.film?.year ? ` (${entry.film.year})` : ""}
                {entry.film?.director ? <> · dir. {entry.film.director}</> : null}
                {entry.dek ? <> — {entry.dek}</> : null}
              </p>
              <div className="tvw-chapters">
                {chapters.map((s, i) => (
                  <button key={s.id} className={`tvw-chap${nowSeg?.id === s.id ? " on" : ""}`}
                    style={{ "--acc": s.accent ?? "#C8102E" } as React.CSSProperties}
                    onClick={() => jump(i)} title={s.title}>
                    <i /><span>{s.topic}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <aside className="tvw-next">
            <div className="tvw-next__h">
              <span>More on METATAKE TV</span>
              <p>Each film gets its own broadcast — bundled into watch lists.</p>
            </div>
            <ul className="tvw-list">
              {more.map((e) => (
                <li key={e.slug}>
                  <a className="tvw-item" href={`/tv/${e.slug}`}>
                    <span className="tvw-item__th" style={e.film?.backdrop ? { backgroundImage: `url(${IMG}/w500${e.film.backdrop})` } : undefined} />
                    <span className="tvw-item__b">
                      <span className="tvw-item__t">{e.title}</span>
                      <span className="tvw-item__f">{e.film?.title}{e.film?.year ? ` (${e.film.year})` : ""}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
