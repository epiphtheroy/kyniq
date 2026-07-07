"use client";
/** Shared film row — the same judgment unit on every screen.
 *  Number budget: one number per row (Fit). Availability dot only when state
 *  is "on" (no unknown-noise). One reason chip max; chips render ONLY
 *  server-sent codes and deep-link per the canonical taxonomy (REASON_MAP —
 *  the taxonomy teaching itself). Rows and actions are real focusable elements.
 *  Expander variant (Screener): pass `expand` — a chevron toggles the block
 *  under the row (score anatomy bars live there, built by the caller). */
import { useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { IMG, REASON_MAP } from "@/lib/room/format";
import { STR } from "./strings";

export type FilmRowData = {
  slug: string; title: string;
  year?: number | null; director?: string | null; poster_path?: string | null;
  /** Canonical reason code (server-sent) — renders the REASON_MAP chip with its deep link. */
  reason?: string | null;
  /** Custom chip escape hatch (still server-derived data only — never invent). */
  chip?: { cls: string; label: string; href?: string } | null;
  /** Fit (WWI). null → no number shown. */
  fit?: number | null;
  /** Availability — rendered only when state === "on". */
  avail?: { state: string; provider?: string } | null;
  /** Letdown-risk R — badge only when ≥ 26 (uses --risk, never --red). */
  risk?: number | null;
  kept?: boolean;
};

const onKey = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); fn(); }
};

export default function FilmRow({ f, onOpen, onKeep, onSeen, onDismiss, expand }: {
  f: FilmRowData;
  onOpen: () => void;
  onKeep?: () => void; onSeen?: () => void; onDismiss?: () => void;
  /** Expander variant: content rendered under the row behind a chevron toggle. */
  expand?: ReactNode;
}) {
  const [xOpen, setXOpen] = useState(false);
  const chip = f.chip ?? (f.reason ? REASON_MAP[f.reason] ?? null : null);
  const chipHref = chip?.href ?? null;

  return (
    <div className="frowg">
      <div className={`frow${expand ? " xp" : ""}`} onClick={onOpen} role="button" tabIndex={0} onKeyDown={onKey(onOpen)}>
        <span className="fpo" style={f.poster_path ? { backgroundImage: `url(${IMG}${f.poster_path})` } : {}} />
        <div style={{ minWidth: 0 }}>
          <div className="ft">{f.title}<small>{f.year ?? ""}{f.director ? ` · ${f.director}` : ""}</small></div>
          <div className="fm">
            {f.avail?.state === "on" ? <><span className="avdot" />{f.avail.provider ?? STR.row.streaming}</> : null}
            {chip ? (
              chipHref
                ? <Link className={`rsn ${chip.cls}`} href={chipHref} onClick={(e) => e.stopPropagation()}>{chip.label}</Link>
                : <span className={`rsn ${chip.cls}`}>{chip.label}</span>
            ) : null}
            {f.risk != null && f.risk >= 26 ? <span className="rsn" style={{ color: "var(--risk)" }}>{STR.row.risk(Math.round(f.risk))}</span> : null}
            {f.kept ? <span className="rsn safe">{STR.row.kept}</span> : null}
          </div>
        </div>
        {f.fit != null ? <div className="fit">{Math.round(f.fit)}<small>{STR.row.fit}</small></div> : <span />}
        <div className="fact" onClick={(e) => e.stopPropagation()}>
          {onKeep ? <span className={`fb${f.kept ? " done" : ""}`} title={STR.row.keep} role="button" tabIndex={0} onClick={onKeep} onKeyDown={onKey(onKeep)}><i className="ti ti-bookmark-plus" /></span> : null}
          {onSeen ? <span className="fb" title={STR.row.seen} role="button" tabIndex={0} onClick={onSeen} onKeyDown={onKey(onSeen)}><i className="ti ti-check" /></span> : null}
          {onDismiss ? <span className="fb" title={STR.row.dismiss} role="button" tabIndex={0} onClick={onDismiss} onKeyDown={onKey(onDismiss)}><i className="ti ti-x" /></span> : null}
        </div>
        {expand ? (
          <span
            className={`fx${xOpen ? " on" : ""}`}
            role="button"
            tabIndex={0}
            aria-expanded={xOpen}
            title={STR.row.expand}
            onClick={(e) => { e.stopPropagation(); setXOpen((v) => !v); }}
            onKeyDown={onKey(() => setXOpen((v) => !v))}
          >
            <i className="ti ti-chevron-right" />
          </span>
        ) : null}
      </div>
      {expand && xOpen ? <div className="fexp">{expand}</div> : null}
    </div>
  );
}
