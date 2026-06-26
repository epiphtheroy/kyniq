"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { HomeV2 } from "@/lib/home2";

type OpenId = "mega" | "am" | null;

export default function Nav({ data }: { data?: HomeV2 }) {
  const stats = data?.stats;
  const [open, setOpen] = useState<OpenId>(null);
  const rootRef = useRef<HTMLElement>(null);

  // tog(id): if already open → close; else open it (closing the other). (mockup: tog)
  const tog = (id: Exclude<OpenId, null>) => setOpen((cur) => (cur === id ? null : id));

  // Close on outside click (mockup: document click listener).
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  return (
    <header className="nav" ref={rootRef}>
      <div className="wrap navrow">
        <Link className="logo" href="/">
          Meta
          <br />
          take
        </Link>
        <div className="menubtn" onClick={() => tog("mega")}>
          <span className="bars">
            <i />
            <i />
            <i />
          </span>
          Menu
        </div>
        <form className="navsearch" action="/search" method="get">
          <div className="scope">All ▾</div>
          <input name="q" placeholder="Search films, directors, figures, tropes…" />
          <button type="submit" className="go" aria-label="Search" style={{ border: 0, background: "transparent", cursor: "pointer" }}>
            ⌕
          </button>
        </form>
        <div className="navright">
          <Link className="npro" href="/ask">
            <span className="dot" />
            <span className="t">Ask&nbsp;metatake&nbsp;AI</span>
          </Link>
          <Link className="nicon" href="/lineage" title="Wander the map">
            <svg viewBox="0 0 24 24">
              <circle cx="6" cy="7" r="2" />
              <circle cx="18" cy="6" r="2" />
              <circle cx="13" cy="17" r="2" />
              <path d="M8 8l9 7M16 7l-7 8" />
            </svg>
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
              <div className="prow">
                <div className="l">
                  <div className="ico">✦</div>
                  <div>
                    <div className="t">Recommended</div>
                    <div className="s">FILMS FOUND BY SHARED READINGS</div>
                  </div>
                </div>
                <div className="n">›</div>
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
      <div className={`mega${open === "mega" ? " open" : ""}`} id="mega">
        <div className="wrap">
          <div className="mcol">
            <h4>Browse the map</h4>
            <Link href="/film">
              Films<span className="ar">{stats ? `${stats.films.toLocaleString()} →` : "→"}</span>
            </Link>
            <Link href="/director">
              Directors<span className="ar">{stats ? `${stats.directors.toLocaleString()} →` : "→"}</span>
            </Link>
            <Link href="/tropes">
              Tropes<span className="ar">{stats ? `${stats.tropes.toLocaleString()} →` : "→"}</span>
            </Link>
            <Link href="/idea">
              Concepts<span className="ar">{stats ? `${stats.concepts.toLocaleString()} →` : "→"}</span>
            </Link>
          </div>
          <div className="mcol">
            <h4>Ways through</h4>
            <Link href="/lineage">
              Lineage<span className="ar">→</span>
            </Link>
            <Link href="/strong-misreadings">
              Archetype<span className="ar">→</span>
            </Link>
            <Link href="/strong-misreadings">
              Strong Misreadings<span className="ar">→</span>
            </Link>
            <Link href="/lineage">
              Wander the map<span className="ar">→</span>
            </Link>
          </div>
          <div className="mcol">
            <h4>Fresh</h4>
            <Link href="/latest">
              Latest<span className="ar">→</span>
            </Link>
            <Link href="/trending">
              Trending<span className="ar">→</span>
            </Link>
            <Link href="/latest">
              Just added<span className="ar">→</span>
            </Link>
            <Link href="/blog">
              Blog<span className="ar">→</span>
            </Link>
          </div>
          <div className="mcol">
            <h4>You</h4>
            <Link href="/me">
              Your Shelf<span className="ar">→</span>
            </Link>
            <Link href="/me">
              Saved Readings<span className="ar">→</span>
            </Link>
            <Link href="/me">
              For You<span className="ar">→</span>
            </Link>
            <Link href="/ask">
              Ask metatake AI<span className="ar">→</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
