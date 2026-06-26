"use client";

import { useState } from "react";
import Link from "next/link";
import type { HomeV2 } from "@/lib/home2";
import { hashTone, tone, initials, directorHref, profileUrl } from "./helpers";
import Rail from "./Rail";

export default function Directors({ data }: { data: HomeV2 }) {
  const spots = data.directorSpots;
  const [dc, setDc] = useState(0);
  const dstep = (x: number) => setDc((c) => (c + x + spots.length) % spots.length);
  const d = spots[dc];

  return (
    <section className="band p2">
      <div className="wrap">
        <div className="shead">
          <div>
            <h2>
              Directors — an auteur&apos;s obsessions <span className="chev">›</span>
            </h2>
            <div className="sub">
              {data.stats.directors} directors · per card: films · readings mapped
            </div>
          </div>
          <Link className="seeall" href="/director">
            All {data.stats.directors} directors ›
          </Link>
        </div>

        {d ? (
          <div className="dspot" id="dspot">
            <div className="portrait" style={{ background: tone(hashTone(d.slug)) }}>
              {profileUrl(d.image) ? (
                <img src={profileUrl(d.image)!} alt="" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              ) : null}
              <div className="pchip">Director in focus</div>
              {profileUrl(d.image) ? null : <div className="pin">{initials(d.name)}</div>}
              <div className="pname">
                <div className="nm">{d.name}</div>
                <div className="pl">{d.place}</div>
              </div>
            </div>
            <div className="dbody">
              <div className="dmrow">
                <div className="dm">
                  <div className="v">{d.films}</div>
                  <div className="k">Films</div>
                </div>
                <div className="dm">
                  <div className="v">{d.readings}</div>
                  <div className="k">Readings</div>
                </div>
                <div className="dm">
                  <div className="v">{d.tropes}</div>
                  <div className="k">Tropes</div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <button
                    onClick={() => dstep(1)}
                    style={{
                      border: "1px solid var(--line-strong)",
                      color: "var(--ink-soft)",
                      background: "transparent",
                      fontFamily: "var(--ui)",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      borderRadius: 7,
                      padding: "7px 13px",
                      cursor: "pointer",
                    }}
                  >
                    ↻ Another auteur
                  </button>
                </div>
              </div>
              <div className="sk">Signature tropes — what recurs across the films</div>
              {d.sig.map((s, i) => (
                <div className="sig" key={i}>
                  <div>
                    <span className="st">{s.title}</span> <span className="sx">{s.count}</span>
                    <span className="sv">{s.via}</span>
                  </div>
                </div>
              ))}
              <div className="sk" style={{ marginTop: 18 }}>
                Filmography
              </div>
              <div className="filmo">
                {d.filmo.map((film, i) => (
                  <span className="fl" key={i}>
                    {film.title}
                    <b>{film.year}</b>
                  </span>
                ))}
              </div>
              <Link className="dopen" href={directorHref(d.slug)}>
                Open the director →
              </Link>
            </div>
          </div>
        ) : null}

        <div className="shead" style={{ marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: 19 }}>Auteurs on the map</h2>
          </div>
        </div>
        <Rail>
          {data.directors.map((dir) => (
            <Link className="dcard" href={directorHref(dir.slug)} key={dir.slug}>
              <div className="dpic" style={{ background: tone(hashTone(dir.slug)) }}>
                {profileUrl(dir.image) ? (
                  <img src={profileUrl(dir.image)!} alt="" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div className="di">{initials(dir.name)}</div>
                )}
              </div>
              <div className="dcn">{dir.name}</div>
              <div className="dcm">
                {dir.country} · {dir.films} films on the map
              </div>
              <div className="dcs">&ldquo;{dir.signature}&rdquo;</div>
            </Link>
          ))}
        </Rail>
        <div className="railcount">{data.directors.length} directors — scroll ›</div>
      </div>
    </section>
  );
}
