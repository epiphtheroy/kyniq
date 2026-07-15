"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import LensToggle from "@/components/LensToggle";
import { clearLocalTakeDrafts } from "@/lib/room/drafts";

export type NavCounts = {
  films?: number; directors?: number; tropes?: number; concepts?: number;
  readings?: number; theorists?: number; traditions?: number;
};

type Item = { t: string; h: string; c?: number };
type Group = { id: string; label: string; items: Item[]; href?: string };

function sb() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

/** Client-side auth state for the nav. Server HTML stays non-personalized
 *  (pages are edge-cached); the account control hydrates after mount. */
type Acct =
  | { state: "loading" }
  | { state: "out" }
  | { state: "in"; name: string; username: string | null };

function buildGroups(c: NavCounts, acct: Acct): Group[] {
  return [
    { id: "watch", label: "Watch", items: [
      { t: "Films", h: "/film", c: c.films },
      { t: "Directors", h: "/director", c: c.directors },
      { t: "Latest", h: "/latest" },
      { t: "Trending", h: "/trending" },
    ] },
    { id: "wander", label: "Wander", items: [
      { t: "Metatake TV", h: "/tv" },
      { t: "TakeScore", h: "/takescore" },
      { t: "What to Watch", h: "/what-to-watch" },
      { t: "Lineage", h: "/lineage" },
      { t: "Locations", h: "/locations" },
      { t: "Movements", h: "/movements" },
      { t: "Connections", h: "/network" },
      { t: "Where to watch", h: "/where-to-watch" },
      { t: "Credits", h: "/credits" },
    ] },
    { id: "read", label: "Read", items: [
      { t: "Now Playing", h: "/now" },
      { t: "The Daily", h: "/blog" },
      { t: "Updates", h: "/updates" },
      { t: "Curious", h: "/curious" },
      { t: "Newsletter", h: "/blog/subscribe" },
    ] },
    { id: "ideas", label: "Theory", items: [
      { t: "Concepts", h: "/concept", c: c.concepts },
      { t: "Theorists", h: "/theorist", c: c.theorists },
      { t: "Traditions", h: "/tradition", c: c.traditions },
      { t: "Strong Misreadings", h: "/strong-misreadings", c: c.readings },
      { t: "Methodology", h: "/methodology" },
    ] },
    { id: "lenses", label: "Patterns", items: [
      { t: "Tropes", h: "/tropes", c: c.tropes },
      { t: "Archetypes", h: "/catalog" },
    ] },
    { id: "you", label: "You", items: [
      { t: "My Room", h: "/room" },
      { t: "Import your films", h: "/me/import" },
      ...(acct.state === "in"
        ? [{ t: "Settings", h: "/settings" }]
        : acct.state === "out"
          ? [{ t: "Sign in", h: "/login" }, { t: "Create account", h: "/signup" }]
          : []),
    ] },
  ];
}

// Counts removed (owner request — several were stale/wrong): nav shows labels + arrow only.
const arrow = (_c?: number) => "→";

// Render a nav label, painting a trailing "TV" red (e.g. "Metatake TV").
const navLabel = (t: string) =>
  t.endsWith("TV") ? (<>{t.slice(0, -2)}<span className="nav-tv">TV</span></>) : t;

export default function Nav({ counts = {} }: { counts?: NavCounts }) {
  const router = useRouter();
  const [acct, setAcct] = useState<Acct>({ state: "loading" });
  const groups = buildGroups(counts, acct);
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

  useEffect(() => {
    let alive = true;
    const c = sb();
    async function refresh() {
      const { data } = await c.auth.getUser();
      const user = data?.user;
      if (!alive) return;
      if (!user) { setAcct({ state: "out" }); return; }
      const { data: p } = await c.from("profiles").select("username, display_name").eq("id", user.id).maybeSingle();
      if (!alive) return;
      setAcct({
        state: "in",
        name: (p?.display_name as string) || (p?.username as string) || user.email?.split("@")[0] || "Account",
        username: (p?.username as string) ?? null,
      });
    }
    refresh();
    // Re-resolve on sign-in/out so client-side navigations (router.push after
    // password login, signOut elsewhere) update the header without a reload.
    // setTimeout: never call supabase inside the callback synchronously (deadlock).
    const { data: sub } = c.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") { clearLocalTakeDrafts(); setAcct({ state: "out" }); }
      else if (event === "SIGNED_IN" || event === "USER_UPDATED") setTimeout(refresh, 0);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  async function logout() {
    await sb().auth.signOut();
    clearLocalTakeDrafts();
    setAcct({ state: "out" });
    setOpen(null);
    router.refresh();
  }

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
              {g.href ? (
                // a category that is itself a destination (Watch → /watch): the
                // label navigates on click, the dropdown still opens on hover.
                <Link className="ngl" href={g.href} aria-expanded={grp === g.id}>
                  {g.label}
                </Link>
              ) : (
                <button
                  type="button"
                  className="ngl"
                  onClick={() => setGrp((cur) => (cur === g.id ? null : g.id))}
                  aria-expanded={grp === g.id}
                >
                  {g.label}
                </button>
              )}
              <div className={`drop${grp === g.id ? " open" : ""}`}>
                {g.items.map((it) => (
                  <Link key={it.t + it.h} href={it.h}>
                    <span className="nl">{navLabel(it.t)}</span>
                    <span className="ar">{arrow(it.c)}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <button
          type="button"
          className="navsearch navsearch--cmdk"
          aria-label="Search Metatake (Cmd+K)"
          onClick={() => window.dispatchEvent(new CustomEvent("metatake:cmdk"))}
        >
          <span className="nsico" aria-hidden="true">⌕</span>
          <span className="nsph">Search all of Metatake…</span>
          <kbd className="nskbd" aria-hidden="true">⌘K</kbd>
        </button>
        {/* the palette needs JS; keep a native path to /search without it */}
        <noscript>
          <form className="navsearch" action="/search" method="get">
            <input name="q" placeholder="Search all of Metatake…" aria-label="Search Metatake" />
            <button type="submit" className="go" aria-label="Search" style={{ border: 0, background: "transparent", cursor: "pointer" }}>⌕</button>
          </form>
        </noscript>

        <div className="navright">
          <Link className="nicon" href="/room" title="My Room">
            <svg viewBox="0 0 24 24">
              <path d="M6 3h12v18l-6-4-6 4z" />
            </svg>
            <span>Room</span>
          </Link>
          <LensToggle />
          <div className="acct">
            {acct.state === "loading" && (
              <div className="avatar avatar--ph" aria-hidden="true" />
            )}
            {acct.state === "out" && (
              <>
                <Link className="signin-pill" href="/login">Sign in</Link>
                <div className="avatar avatar--join" title="Create account · what you get" onClick={() => tog("am")}>
                  ＋
                </div>
              </>
            )}
            {acct.state === "in" && (
              <div
                className="avatar avatar--in"
                title={acct.name}
                role="button"
                aria-haspopup="menu"
                aria-expanded={open === "am"}
                onClick={() => tog("am")}
              >
                {acct.name.charAt(0).toUpperCase()}
              </div>
            )}

            {acct.state === "out" && (
              <div className={`acctmenu${open === "am" ? " open" : ""}`} id="am">
                <div className="me">
                  <div className="av">✦</div>
                  <div>
                    <div className="nm">Start your map</div>
                    <div className="lk">Free account · save films &amp; readings</div>
                  </div>
                </div>
                <div className="authbtns">
                  <Link className="ab ab--primary" href="/signup" onClick={() => setOpen(null)}>
                    Create account
                  </Link>
                  <Link className="ab" href="/login" onClick={() => setOpen(null)}>
                    Sign in
                  </Link>
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
            )}

            {acct.state === "in" && (
              <div className={`acctmenu${open === "am" ? " open" : ""}`} id="am" role="menu">
                <div className="me">
                  <div className="av">{acct.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <div className="nm">{acct.name}</div>
                    <Link className="lk" href="/room" onClick={() => setOpen(null)}>
                      Signed in · My Room →
                    </Link>
                  </div>
                </div>
                <Link className="mrow" href="/room" role="menuitem" onClick={() => setOpen(null)}>
                  My Room<span className="ar">→</span>
                </Link>
                {acct.username && (
                  <Link className="mrow" href={`/u/${acct.username}`} role="menuitem" onClick={() => setOpen(null)}>
                    Public profile<span className="ar">→</span>
                  </Link>
                )}
                <Link className="mrow" href="/me/import" role="menuitem" onClick={() => setOpen(null)}>
                  Import your films<span className="ar">→</span>
                </Link>
                <Link className="mrow" href="/settings" role="menuitem" onClick={() => setOpen(null)}>
                  Settings<span className="ar">→</span>
                </Link>
                <div className="acctfoot">
                  <Link href="/about">About</Link>
                  <Link href="/blog/subscribe">Newsletter</Link>
                  <button type="button" className="logout" role="menuitem" onClick={logout}>
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="lang">EN ▾</div>
        </div>
      </div>

      {/* Hamburger mega (narrow / overflow) — same five groups */}
      <div className={`mega${open === "mega" ? " open" : ""}`} id="mega">
        <div className="wrap megasearchwrap">
          <button
            type="button"
            className="megasearch"
            aria-label="Search Metatake (Cmd+K)"
            onClick={() => {
              setOpen(null);
              window.dispatchEvent(new CustomEvent("metatake:cmdk"));
            }}
          >
            <span className="nsico" aria-hidden="true">⌕</span>
            <span className="nsph">Search all of Metatake…</span>
            <kbd className="nskbd" aria-hidden="true">⌘K</kbd>
          </button>
        </div>
        <div className="wrap">
          {groups.map((g) => (
            <div className="mcol" key={g.id}>
              <h4>{g.label}</h4>
              {g.items.map((it) => (
                <Link key={it.t + it.h} href={it.h}>
                  <span className="nl">{navLabel(it.t)}</span>
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
