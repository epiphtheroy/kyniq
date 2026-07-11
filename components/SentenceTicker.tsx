"use client";

/**
 * SentenceTicker — a site-wide "disaster-broadcast" strip of rule-based connection
 * sentences (from the film_sentences layer). Client-fetched from /api/sentences/ticker,
 * which is seeded on the UTC hour, so the body is stable within the hour (edge-cacheable).
 *
 * Default: a horizontal marquee (duplicated track). Reduced-motion OR mobile: falls back
 * to a single-item rotator (no scrolling, battery/readability). Fixed height → zero CLS.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

type TItem = { id: number; pattern: string; sentence: string; slug: string };

const TAG_COLOR: Record<string, string> = {
  A_affinity: "#A8434F", B_bridge: "#A8434F", H_dense: "#A8434F",
  G_theorist_twin: "#2E6F8E",
  D_award: "#8A6D1F", E_rank: "#8A6D1F",
  J_location: "#167C6B", L_trope: "#167C6B",
};
const TAG_LABEL: Record<string, string> = {
  A_affinity: "shared reading", B_bridge: "bridge", H_dense: "connection",
  G_theorist_twin: "same lens",
  D_award: "honor", E_rank: "rank",
  J_location: "location", L_trope: "trope",
};

function Item({ it }: { it: TItem }) {
  return (
    <Link href={`/film/${it.slug}`} className="stk-item">
      <span className="stk-tag" style={{ background: TAG_COLOR[it.pattern] ?? "var(--ink2)" }}>
        {TAG_LABEL[it.pattern] ?? "link"}
      </span>
      <span className="stk-txt">{it.sentence}</span>
    </Link>
  );
}

export default function SentenceTicker({ variant = "home", n = 40 }: { variant?: "home" | "room"; n?: number }) {
  const [items, setItems] = useState<TItem[]>([]);
  const [reduced, setReduced] = useState(false);
  const [idx, setIdx] = useState(0);

  // reduced-motion OR narrow viewport → rotator mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mqm = window.matchMedia("(max-width: 640px)");
    const upd = () => setReduced(mq.matches || mqm.matches);
    upd();
    mq.addEventListener("change", upd);
    mqm.addEventListener("change", upd);
    return () => { mq.removeEventListener("change", upd); mqm.removeEventListener("change", upd); };
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(`/api/sentences/ticker?n=${n}`)
      .then((r) => r.json())
      .then((j) => { if (alive) setItems(Array.isArray(j.items) ? j.items : []); })
      .catch(() => {});
    return () => { alive = false; };
  }, [n]);

  // rotator tick (only used in reduced mode)
  useEffect(() => {
    if (!reduced || items.length < 2) return;
    const t = window.setInterval(() => setIdx((x) => (x + 1) % items.length), 7000);
    return () => window.clearInterval(t);
  }, [reduced, items.length]);

  // fixed-height wrapper always renders → no CLS even before fetch
  if (!items.length) return <div className={`stk stk--${variant}`} aria-hidden />;

  if (reduced) {
    const it = items[idx % items.length];
    return (
      <div className={`stk stk--${variant} stk--rot`} aria-label="Cinema connection ticker">
        <Item it={it} />
      </div>
    );
  }

  // marquee: duration scales with item count (~6s each) so speed is constant
  const dur = `${Math.max(items.length * 6, 30)}s`;
  return (
    <div className={`stk stk--${variant}`} aria-label="Cinema connection ticker">
      <div className="stk-track" style={{ animationDuration: dur }}>
        {items.map((it) => <Item key={`a-${it.id}`} it={it} />)}
        {items.map((it) => <Item key={`b-${it.id}`} it={it} />)}
      </div>
    </div>
  );
}
