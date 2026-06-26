"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const DECK_N = 4;

function pickBatch(total: number, n: number, prev: number[]): number[] {
  if (total <= n) return Array.from({ length: total }, (_, i) => i);
  const avoid = new Set(prev);
  const pool = Array.from({ length: total }, (_, i) => i).filter((i) => !avoid.has(i));
  const src = pool.length >= n ? pool : Array.from({ length: total }, (_, i) => i);
  for (let i = src.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [src[i], src[j]] = [src[j], src[i]];
  }
  return src.slice(0, n).sort((a, b) => a - b);
}

/* Generic rotating card deck — same engine as the meta-takes/tropes index.
   7s auto-advance, 5-min reshuffle, hover-pause; front card flies off right. */
export default function CardDeck<T>({
  items,
  renderCard,
  keyOf,
  dieText,
  autoNote,
  rollLabel = "↻ reshuffle",
  tall = false,
  cardClassName = "",
}: {
  items: T[];
  renderCard: (item: T, isFront: boolean) => ReactNode;
  keyOf: (item: T) => string;
  dieText: string;
  autoNote: string;
  rollLabel?: string;
  tall?: boolean;
  cardClassName?: string;
}) {
  // Deterministic first render (server === client) so hydration never mismatches.
  // The client reshuffles to a random batch on mount (effect below).
  const [batch, setBatch] = useState<number[]>(() =>
    Array.from({ length: Math.min(DECK_N, Math.max(items.length, 0)) }, (_, i) => i)
  );
  const k = batch.length;
  const [order, setOrder] = useState<number[]>(() => batch.map((_, i) => i));
  const [flying, setFlying] = useState<number | null>(null);
  const busy = useRef(false);
  const paused = useRef(false);
  const batchRef = useRef(batch);
  batchRef.current = batch;

  const advance = useCallback(() => {
    if (busy.current || k < 2) return;
    busy.current = true;
    setFlying(order[0]);
    window.setTimeout(() => {
      setOrder((o) => [...o.slice(1), o[0]]);
      setFlying(null);
      busy.current = false;
    }, 520);
  }, [order, k]);

  const reverse = useCallback(() => {
    if (busy.current || k < 2) return;
    setOrder((o) => [o[o.length - 1], ...o.slice(0, -1)]);
  }, [k]);

  const setFront = useCallback((bp: number) => {
    setOrder((o) => {
      const i = o.indexOf(bp);
      if (i <= 0) return o;
      return [...o.slice(i), ...o.slice(0, i)];
    });
  }, []);

  const newBatch = useCallback(() => {
    const nb = pickBatch(items.length, DECK_N, batchRef.current);
    setBatch(nb);
    setOrder(nb.map((_, i) => i));
  }, [items.length]);

  const advanceRef = useRef(advance); advanceRef.current = advance;
  const newBatchRef = useRef(newBatch); newBatchRef.current = newBatch;

  // Client-only: shuffle once after hydration (SSR stays deterministic → no #418).
  useEffect(() => {
    if (items.length > DECK_N) {
      const nb = pickBatch(items.length, DECK_N, []);
      setBatch(nb);
      setOrder(nb.map((_, i) => i));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  useEffect(() => {
    if (items.length < 2) return;
    const a = window.setInterval(() => { if (!paused.current) advanceRef.current(); }, 7000);
    const b = window.setInterval(() => { if (!paused.current) newBatchRef.current(); }, 300000);
    return () => { window.clearInterval(a); window.clearInterval(b); };
  }, [items.length]);

  const cardStyle = (bp: number): CSSProperties => {
    const p = order.indexOf(bp);
    if (flying === bp) {
      return {
        transform: "translate3d(135%,-6px,0) rotateY(-24deg) scale(.95)",
        opacity: 0, zIndex: 61, pointerEvents: "none",
        transition: "transform .55s cubic-bezier(.5,0,.3,1), opacity .55s",
      };
    }
    return {
      transform: p === 0 ? "translate3d(0,0,0) scale(1)" : `translate3d(${p * 15}px,${p * 9}px,0) scale(${1 - p * 0.045})`,
      opacity: p === 0 ? 1 : 1 - p * 0.16,
      zIndex: 60 - p,
      pointerEvents: p === 0 ? "auto" : "none",
      transition: "transform .55s cubic-bezier(.4,0,.2,1), opacity .55s",
    };
  };

  const frontBp = order[0];
  if (items.length === 0) return null;

  return (
    <>
      <div className="idx-kick">
        <span className="die">{dieText}</span>
        <span className="auto"><i />{autoNote}</span>
        <span className="idx-ctl">
          <button className="idx-arw" aria-label="previous" onClick={reverse}>‹</button>
          <span className="idx-dots">
            {batch.map((_, bp) => (
              <button key={bp} aria-label={`card ${bp + 1}`} data-on={bp === frontBp ? "" : undefined} onClick={() => setFront(bp)} />
            ))}
          </span>
          <button className="idx-arw" aria-label="next" onClick={advance}>›</button>
          <button className="idx-roll" onClick={newBatch}>{rollLabel}</button>
        </span>
      </div>

      <div className="idx-deckwrap" onMouseEnter={() => (paused.current = true)} onMouseLeave={() => (paused.current = false)}>
        <div className={`idx-deck${tall ? " idx-deck--tall" : ""}`}>
          {batch.map((idx, bp) => {
            const it = items[idx];
            if (it == null) return null;
            return (
              <article key={keyOf(it)} className={`idx-dcard ${cardClassName}`} style={cardStyle(bp)} aria-hidden={bp !== frontBp}>
                {renderCard(it, bp === frontBp)}
              </article>
            );
          })}
        </div>
      </div>
    </>
  );
}
