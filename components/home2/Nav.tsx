"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export type NavCounts = {
  films?: number; directors?: number; tropes?: number; concepts?: number;
  readings?: number; theorists?: number; traditions?: number;
};

type Item = { t: string; h: string; c?: number };
type Group = { id: string; label: string; items: Item[] };

function buildGroups(c: NavCounts): Group[] {
  return [
    { id: "watch", label: "Watch", items: [
      { t: "Films", h: "/film", c: c.films },
      { t: "Directors", h: "/director", c: c.directors },
      { t: "Latest", h: "/latest" },
      { t: "Trending", h: "/trending" },
    ] },
    { id: "wander", label: "Wander", items: [
      { t: "Atlas", h: "/atlas" },
      { t: "Connections", h: "/map" },
      { t: "Surprise me", h: "/random" },
      { t: "Blog", h: "/blog" },
    ] },
    { id: "ideas", label: "Ideas", items: [
      { t: "Concepts", h: "/idea", c: c.concepts },
      { t: "Theorists", h: "/theorist", c: c.theorists },
      { t: "Traditions", h: "/tradition", c: c.traditions },
    ] },
    { id: "lenses", label: "Lenses", items: [
      { t: "Tropes", h: "/tropes", c: c.tropes },
      { t: "Archetypes", h: "/catalog" },
      { t: "Strong Misreadings", h: "/strong-misreadings", c: c.readings },
    ] },
    { id: "you", label: "You", items: [
      { t: "Your Shelf", h: "/me" },
      { t: "Saved Readings", h: "/me" },
      { t: "For You", h: "/me" },
      { t: "Ask metatake AI", h: "/ask" },
    ] },
  ];
}

const arrow = (c?: number) => (c != null ? `${c.toLocaleString()} →` : "→");

export default function Nav({ counts = {} }: { counts?: NavCounts }) {
  const groups = buildGroups(counts);
  const [open, setOpen] = useState<"mega" | "am" | null>(null);
  const [grp, setGrp] = useState<string | null>(null); // open dropdown group (desktop)
  const rootRef = useRef<HTMLElement>(null);

  const tog = (id: "mega" | "am") => setOpen((cur) => (cur === id ? null : id));

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(null);
        setGrp(null);
      }
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  return (
    <header className="nav" ref={rootRef}>
      <div className="wrap navrow">
        <Link className="logo" href="/">
          Metatake
        </Link>

        {/* Narrow / overflow: single Menu → full mega */}
        <div className="menubtn" onClick={() => tog("mega")}>
          <span className="bars">
            <i />
            <i />
            <i />
          </span>
          Menu
        </div>

        {/* Wide: the five top groups, each with a dropdown */}
        <nav className="navgroups" onMouseLeave={() => setGrp(null)}>
          {groups.map((g) => (
            <div
              className="ng"
              key={g.id}
              onMouseEnter={() => setGrp(g.id)}
            >
              <button
                type="button"
                className="ngl"
                onClick={() => setGrp((cur) => (cur === g.id ? null : g.id))}
                aria-expanded={grp === g.id}
              >
                {g.label}
              </button>
              <div className={`drop${grp === g.id ? " open" : ""}`}>
                {g.items.map((it) => (
                  <Link key={it.t + it.h} href={it.h}>
                    {it.t}
                    <span className="ar">{arrow(it.c)}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <form className="navsearch" action="/search" method="get">
          <div className="scope">All ▾</div>
          <input name="q" placeholder="Search films, directors, ideas…" />
          <button type="submit" className="go" aria-label="Search" style={{ border: 0, background: "transparent", cursor: "pointer" }}>
            ⌕
          </button>
        </form>

        <div className="navright">
          <Link className="npro" href="/ask">
            <span className="dot" />
            <span className="t">Ask&nbsp;metatake&nbsp;AI</span>
          </Link>
          <Link className="nicon" href="/me" title="Your Shelf">
            <svg viewBox="0 0 24 24">
              <path d="M6 3h12v18l-6-4-6 4z" />
            </svg>
            <span>Shelf</span>
          </Link>
          <div className="acct">
            <div className="avatar" onClick={() => tog("am")}>
              ＋
            </div>
            <div className={`acctmenu${open === "am" ? " open" : ""}`} id="am">
              <div className="me">
                <div className="av">✦</div>
                <div>
                  <div className="nm">Start your map</div>
                  <Link className="lk" href="/login">
                    Sign in · Create account →
                  </Link>
                </div>
              </div>
              <div className="prow">
                <div className="l">
                  <div className="ico">▦</div>
                  <div>
                    <div className="t">Your Shelf</div>
                    <div className="s">SAVE FILMS AS YOU WANDER</div>
                  </div>
                </div>
                <div className="n">+</div>
              </div>
              <div className="prow">
                <div className="l">
                  <div className="ico">❝</div>
                  <div>
                    <div className="t">Saved Readings</div>
                    <div className="s">BOOKMARK A STRONG MISREADING</div>
                  </div>
                </div>
                <div className="n">+</div>
              </div>
              <div className="prow">
                <div className="l">
                  <div className="ico">⌖</div>
                  <div>
                    <div className="t">Follow directors &amp; figures</div>
                    <div className="s">NEW READINGS COME TO YOU</div>
                  </div>
                </div>
                <div className="n">+</div>
              </div>
              <div className="acctfoot">
                <Link href="/about">About</Link>
                <Link href="/blog/subscribe">Newsletter</Link>
                <Link href="/login" style={{ marginLeft: "auto" }}>
                  Sign in
                </Link>
              </div>
            </div>
          </div>
          <div className="lang">EN ▾</div>
        </div>
      </div>

      {/* Hamburger mega (narrow / overflow) — same five groups */}
      <div className={`mega${open === "mega" ? " open" : ""}`} id="mega">
        <div className="wrap">
          {groups.map((g) => (
            <div className="mcol" key={g.id}>
              <h4>{g.label}</h4>
              {g.items.map((it) => (
                <Link key={it.t + it.h} href={it.h}>
                  {it.t}
                  <span className="ar">{arrow(it.c)}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </header>
  );
}
