"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CATEGORY_LABEL, type UpdateCategory, type UpdatePost } from "@/lib/updates/posts";

const PAGE_SIZE = 30;

// Canonical category order for the filter bar (only those present are shown).
const CAT_ORDER: UpdateCategory[] = [
  "feature", "films", "data", "api", "policy", "index", "milestone",
];

// Local-parse (append T00:00:00) so YYYY-MM-DD never rolls back a day.
const asDate = (d: string) => new Date(d + "T00:00:00");
const shortDate = (d: string) =>
  asDate(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const longDate = (d: string) =>
  asDate(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const monthLabel = (d: string) =>
  asDate(d).toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase();

// Body mini-grammar: [text](href) links only. Internal → Link, external → <a>.
function renderBody(body: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(body))) {
    if (m.index > last) out.push(body.slice(last, m.index));
    const [, text, href] = m;
    out.push(
      href.startsWith("/") ? (
        <Link key={k++} href={href}>{text}</Link>
      ) : (
        <a key={k++} href={href} target="_blank" rel="noopener">{text}</a>
      )
    );
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push(body.slice(last));
  return out;
}

export default function UpdatesThread({ posts }: { posts: UpdatePost[] }) {
  const [page, setPage] = useState(1);
  const [cat, setCat] = useState<"all" | UpdateCategory>("all");
  // Set when the user drives navigation (page/filter), so the scroll-to-top
  // fires AFTER the new page renders — not against the old, taller layout.
  const navScrollRef = useRef(false);

  const cats = useMemo(() => {
    const present = new Set(posts.map((p) => p.cat));
    return CAT_ORDER.filter((c) => present.has(c));
  }, [posts]);

  const filtered = useMemo(
    () => (cat === "all" ? posts : posts.filter((p) => p.cat === cat)),
    [posts, cat]
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  // A shared link is always /updates#id. As new posts are prepended, a post
  // drifts across pages — so on load (and on hashchange) we find the page that
  // now holds the target, clear any filter, switch to it, and scroll there.
  const goToHash = useCallback(() => {
    const raw = window.location.hash.slice(1);
    if (!raw) return;
    const idx = posts.findIndex((p) => p.id === raw);
    if (idx < 0) return;
    setCat("all");
    setPage(Math.floor(idx / PAGE_SIZE) + 1);
    // instant, not smooth: the site sets html{scroll-behavior:smooth} globally,
    // and a smooth programmatic scroll to a far target here is silently dropped
    // by the browser — instant is the only reliable option.
    requestAnimationFrame(() => {
      document.getElementById(raw)?.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "start" });
    });
  }, [posts]);

  useEffect(() => {
    goToHash();
    window.addEventListener("hashchange", goToHash);
    return () => window.removeEventListener("hashchange", goToHash);
  }, [goToHash]);

  // Scroll to the top of the thread after a user-driven page/filter change has
  // rendered. Hash navigation leaves the flag false (it scrolls to its post).
  useEffect(() => {
    if (!navScrollRef.current) return;
    navScrollRef.current = false;
    // instant, not smooth — see goToHash: global scroll-behavior:smooth drops
    // far programmatic scrolls, so force an instant jump to the thread top.
    document.getElementById("upd-top")?.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "start" });
  }, [safePage, cat]);

  const changePage = (n: number) => {
    if (n < 1 || n > pageCount) return;
    navScrollRef.current = true;
    setPage(n);
  };

  const changeCat = (c: "all" | UpdateCategory) => {
    navScrollRef.current = true;
    setCat(c);
    setPage(1);
  };

  let lastMonth = "";

  return (
    <div className="upd-wrap">
      <span id="upd-top" style={{ position: "absolute", scrollMarginTop: 70 }} />

      <div className="upd-filters" role="group" aria-label="Filter updates by type">
        <button
          type="button"
          className={"upd-filter" + (cat === "all" ? " is-on" : "")}
          onClick={() => changeCat("all")}
          aria-pressed={cat === "all"}
        >
          All
        </button>
        {cats.map((c) => (
          <button
            key={c}
            type="button"
            className={"upd-filter" + (cat === c ? " is-on" : "")}
            onClick={() => changeCat(c)}
            aria-pressed={cat === c}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      <ol className="upd-thread">
        {visible.map((p) => {
          const month = p.date.slice(0, 7);
          const newMonth = month !== lastMonth;
          lastMonth = month;
          return (
            <Fragment key={p.id}>
              {newMonth && (
                <li className="upd-month">
                  <span className="upd-month-label">{monthLabel(p.date)}</span>
                </li>
              )}
              <li className="upd-li">
                <article id={p.id} className="upd-item">
                  <div className="upd-kicker">
                    <time className="upd-date" dateTime={p.date} title={longDate(p.date)}>
                      {shortDate(p.date)}
                    </time>
                    <span className="upd-tag">{CATEGORY_LABEL[p.cat]}</span>
                    <a href={`#${p.id}`} className="upd-permalink" aria-label="Link to this update">
                      §
                    </a>
                  </div>
                  <h2 className="upd-title">{p.title}</h2>
                  <p className="upd-body">{renderBody(p.body)}</p>
                </article>
              </li>
            </Fragment>
          );
        })}
      </ol>

      {pageCount > 1 && (
        <nav className="upd-pager" aria-label="Updates pages">
          <button
            type="button"
            className="upd-pg upd-pg-arrow"
            onClick={() => changePage(safePage - 1)}
            disabled={safePage <= 1}
            aria-label="Previous page"
          >
            ‹
          </button>
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              type="button"
              key={n}
              className={"upd-pg" + (n === safePage ? " is-current" : "")}
              onClick={() => changePage(n)}
              aria-current={n === safePage ? "page" : undefined}
              aria-label={`Page ${n}`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            className="upd-pg upd-pg-arrow"
            onClick={() => changePage(safePage + 1)}
            disabled={safePage >= pageCount}
            aria-label="Next page"
          >
            ›
          </button>
          <div className="upd-pager-label">
            Page {safePage} of {pageCount}
          </div>
        </nav>
      )}
    </div>
  );
}
