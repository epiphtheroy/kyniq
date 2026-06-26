"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Film, HomeV2 } from "@/lib/home2";
import { backdropUrl, hashTone, tone, filmHref } from "./helpers";

function star(r: number | null) {
  return r != null ? r.toFixed(1) : "—";
}

export default function Hero({ data }: { data: HomeV2 }) {
  const pool = data.hero;
  const [cur, setCur] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    stop();
    timer.current = setInterval(() => setCur((c) => (c + 1) % pool.length), 8000);
  };
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    if (pool.length > 1) start();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.length]);

  const hstep = (d: number) => setCur((c) => (c + d + pool.length) % pool.length);
  const hgoto = (i: number) => setCur(i);

  if (!pool.length) return null;
  const f: Film = pool[cur];
  const bd = backdropUrl(f.backdrop);

  // Up next = next 3.
  const order = [1, 2, 3].map((k) => (cur + k) % pool.length);

  return (
    <div className="hero">
      <div className="wrap">
        <div className="vh">
          <div
            className="vmain"
            id="vmain"
            onMouseEnter={stop}
            onClick={() => (window.location.href = filmHref(f.slug))}
          >
            <div style={{ position: "absolute", inset: 0, background: tone(hashTone(f.slug)) }}>
              {bd ? (
                <img
                  src={bd}
                  alt=""
                  loading="eager"
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : null}
            </div>
            <div className="vbadge">metatake · Today&apos;s Feature</div>
            <div className="vplus">＋</div>
            <button
              className="varr l"
              onClick={(e) => {
                e.stopPropagation();
                hstep(-1);
              }}
              aria-label="Previous"
            >
              ‹
            </button>
            <button
              className="varr r"
              onClick={(e) => {
                e.stopPropagation();
                hstep(1);
              }}
              aria-label="Next"
            >
              ›
            </button>
            <div className="vplay" title="Play the trailer">
              ▶
            </div>
            <div className="vbottom">
              <div className="vtitle">
                {f.title} <span className="yr">{f.year ?? ""}</span>
              </div>
              <div className="vwatch">
                <span className="vstar">★ {star(f.imdb)}</span>
                <span>· Watch the trailer</span>
                <span className="dur">2:18</span>
                <span>· dir. {f.director ?? "—"}</span>
              </div>
              <div className="vread">
                <b>READING</b>One of {f.readings ?? 0} readings — argued via {f.figureLabel ?? "a figure"}.
              </div>
              <div className="vchips">
                <span className="mc">
                  <span className="lz" />
                  {f.figures ?? 0} figures
                </span>
                <span className="mc">{f.readings ?? 0} readings</span>
                <span className="mc">{f.tropes ?? 0} tropes</span>
              </div>
            </div>
          </div>
          <div className="upnext">
            <div className="unh">Up next</div>
            <div id="upnext">
              {order.map((i) => {
                const u = pool[i];
                const ubd = backdropUrl(u.backdrop);
                return (
                  <div className="unv" key={`${u.slug}-${i}`} onClick={() => hgoto(i)}>
                    <div className="unt" style={{ background: tone(hashTone(u.slug)) }}>
                      {ubd ? (
                        <img
                          src={ubd}
                          alt=""
                          loading="lazy"
                          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : null}
                      <span className="pc">▶</span>
                      <span className="du">2:0{(i % 6) + 1}</span>
                    </div>
                    <div className="uni">
                      <div className="un1">{u.title}</div>
                      <div className="un2">★ {star(u.imdb)} · Watch the trailer</div>
                      <div className="un3">
                        {u.readings ?? 0} readings · {u.figures ?? 0} figures
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Link className="browse" href="/lineage">
              Browse the map ›
            </Link>
          </div>
        </div>
        <div className="topicchips">
          <Link className="tc" href="/strong-misreadings">
            Strong Misreadings <span className="ch">›</span>
          </Link>
          <Link className="tc" href="/search?q=grief">
            Films about grief <span className="ch">›</span>
          </Link>
          <Link className="tc" href="/director">
            Auteur fingerprints <span className="ch">›</span>
          </Link>
          <Link className="tc" href="/strong-misreadings">
            Most-shared readings <span className="ch">›</span>
          </Link>
          <Link className="tc" href="/idea">
            The Real (le réel) <span className="ch">›</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
