"use client";
/** Auteurs — /room/auteurs (v3 upgrade of the Auteur Conquest instrument).
 *  REAL data via me_auteur_conquest(p_limit): for every director the user has
 *  started (seen >=1 visible film of), show OEUVRE COMPLETION (seen / total
 *  films in our catalog — the denominator is our catalog, disclosed honestly)
 *  with the 4-state bar (Locked<50 · In progress 50–74 · Near 75–99 ·
 *  Complete 100), the average of my stars (shared read-only <Stars>), and the
 *  unseen essentials (highest Standing, with TakeScore U = V−R) as conquest
 *  candidates. v3 fixes the read/write asymmetry: every conquest candidate
 *  gets Keep / Seen / Rate through useRoomActions, and films acted on this
 *  session drop out of the candidate lists via SessionStore.
 *  PostgREST numerics arrive as strings → coerce with num() before any math. */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useInspector } from "./InspectorContext";
import { useRoomActions } from "./useRoomActions";
import CinecodexCard from "./CinecodexCard";
import Stars from "./Stars";
import ICard from "./insp/ICard";
import KV from "./insp/KV";
import SelHead from "./insp/SelHead";
import ActBar, { type Act } from "./insp/ActBar";
import { num, IMG, REASON_MAP } from "@/lib/room/format";
import { STR } from "./strings";

/* ── typed RPC shape (numerics may arrive as strings from PostgREST) ── */
export type UnseenFilm = {
  slug: string; title: string; year: number | null; poster_path: string | null;
  prestige: number | string | null; u: number | string | null;
};
export type AuteurRow = {
  slug: string; name: string | null; profile_path: string | null;
  seen: number | string | null; total: number | string | null; pct: number | string | null;
  avg_rating: number | string | null; unseen_top: UnseenFilm[] | null;
};

/* Honest-denominator gloss (spec §3.8.4) — shown wherever completion renders. */
const DENOM_GLOSS = "% of this director's films in our catalog that you've seen — the denominator is our catalog, not the full filmography.";
const STATE_GLOSS = "Locked <50 · In progress 50-74 · Near 75-99 · Complete 100";

/* 4-state completion (spec §3.8.2): Locked<50 gray · In progress 50–74 --canon ·
   Near 75–99 --canon(glow) · Complete 100 --conquer. */
function covState(pct: number): { cls: string; label: string; col: string } {
  if (pct >= 100) return { cls: "st-done", label: "Complete", col: "var(--conquer)" };
  if (pct >= 75) return { cls: "st-near", label: "Near", col: "var(--canon)" };
  if (pct >= 50) return { cls: "st-prog", label: "In progress", col: "var(--canon)" };
  return { cls: "st-lock", label: "Locked", col: "var(--sub)" };
}

/* ── derived normalizers ── */
type Unseen = {
  slug: string; title: string; year: number | null; poster_path: string | null;
  prestige: number | null; u: number | null;
};
type Auteur = {
  slug: string; name: string; profile_path: string | null;
  seen: number; total: number; pct: number; remaining: number;
  avg_rating: number | null; unseen: Unseen[];
};
function normUnseen(f: UnseenFilm): Unseen {
  return {
    slug: f.slug, title: f.title, year: f.year, poster_path: f.poster_path,
    prestige: num(f.prestige), u: num(f.u),
  };
}
function normAuteur(r: AuteurRow): Auteur {
  const seen = num(r.seen) ?? 0;
  const total = num(r.total) ?? 0;
  const pct = num(r.pct) ?? (total ? Math.round((seen / total) * 100) : 0);
  return {
    slug: r.slug, name: r.name ?? r.slug, profile_path: r.profile_path,
    seen, total, pct, remaining: Math.max(0, total - seen),
    avg_rating: num(r.avg_rating), unseen: (r.unseen_top ?? []).map(normUnseen),
  };
}

/* ── shared avg-star cell (read-only shared <Stars>, no unicode string builders) ── */
function AvgStars({ value, size = 12 }: { value: number | null; size?: number }) {
  if (value == null) return <div className="au-stars"><div className="me">Unrated</div></div>;
  return (
    <div className="au-stars" title={`My average ★ ${value.toFixed(2)}`}>
      <Stars value={value} size={size} />
      <div className="me">{value.toFixed(1)}</div>
    </div>
  );
}

/* ── inspector: one conquest candidate — now with verbs (spec §3.8.3).
 *  A client component with its own hooks so mutations re-render it live. ── */
function ConquerInsp({ f, dir }: { f: Unseen; dir?: string }) {
  const { session, doKeep, doSeen, doRate } = useRoomActions();
  const [rating, setRating] = useState<number | null>(null);
  // React reuses the instance across consecutive select() calls — reset on film change.
  useEffect(() => { setRating(null); }, [f.slug]);

  const kept = session.kept.has(f.slug);
  const seen = session.gone.has(f.slug);
  const conquer = REASON_MAP.conquer;

  const acts: Act[] = [
    { label: kept ? `✓ ${STR.row.kept}` : STR.row.keep, primary: !kept, disabled: kept, onClick: () => { void doKeep(f.slug, f.title); } },
    { label: seen ? `✓ ${STR.row.seen}` : STR.row.seen, disabled: seen, onClick: () => { void doSeen(f.slug, f.title); } },
  ];

  return (
    <div>
      <SelHead title={f.title} sub={<>{f.year ?? "?"}{dir ? ` · ${dir}` : ""} · Conquest candidate</>} posterPath={f.poster_path} />
      <ICard icon="ti-target-arrow" title="Conquest target · unseen essential">
        <div className="bigscore" style={{ color: "var(--canon)" }}>
          {f.prestige != null ? Math.round(f.prestige) : "—"}
          <span style={{ fontSize: 12, color: "var(--sub)", marginLeft: 8 }}>Standing</span>
        </div>
        <div style={{ marginTop: 8 }}>
          <KV k={<span className="gloss" title="TakeScore U = V (earned value) - R (risk). Higher = more worth watching.">TakeScore U (V−R)</span>}
            v={<span style={{ color: f.u != null && f.u >= 40 ? "var(--safe)" : "var(--ink)" }}>{f.u != null ? f.u : "—"}</span>} />
        </div>
        <div className="au-rsn-line"><span className={`rsn ${conquer.cls}`}><i className="ti ti-flag" /> {conquer.label}</span></div>
      </ICard>
      <CinecodexCard d={{ v: null, c: null, r: null, prestige: f.prestige }} slug={f.slug} />
      <ICard icon="ti-player-play" title={STR.insp.actNow}>
        <ActBar acts={acts} style={{ marginTop: 0, marginBottom: 10 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Stars value={rating ?? 0} onPick={(v) => { setRating(v); void doRate(f.slug, f.title, v); }} title={STR.insp.myRating} />
          <span style={{ fontSize: 10.5, color: "var(--sub)" }}>{STR.insp.ratingHint}</span>
        </div>
      </ICard>
    </div>
  );
}

/* ── inspector: one director (oeuvre + conquest rows) ── */
function AuteurInsp({ a, onFilm }: { a: Auteur; onFilm: (f: Unseen, dir: string) => void }) {
  const st = covState(a.pct);
  return (
    <div>
      <SelHead title={a.name} sub={<>Director · {a.pct}% complete · {st.label}</>} posterPath={a.profile_path} />

      <ICard icon="ti-crown" title="Oeuvre completion">
        <div className="bigscore" style={{ color: st.col }}>
          {a.pct}%<span style={{ fontSize: 12, color: "var(--sub)", marginLeft: 8 }}>{a.seen} / {a.total} seen · {st.label}</span>
        </div>
        <div className="crow" style={{ marginTop: 8 }}>
          <span className="cl"><span className="gloss" title={DENOM_GLOSS}>Completion</span></span>
          <span className="cbar"><i style={{ width: `${Math.max(a.pct, a.pct > 0 ? 3 : 1)}%`, background: st.col }} /></span>
          <span className="cvv">{a.pct}</span>
        </div>
        <div className="au-ms">
          {[50, 75, 100].map((m) => {
            const on = a.pct >= m;
            const cls = on ? (m === 100 ? "conquer" : "canon") : "";
            return <span key={m} className={`rsn ${cls}`} style={on ? {} : { opacity: 0.4 }}>{m === 100 ? "Complete" : `${m}%`}</span>;
          })}
        </div>
        <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5 }}>
          <span style={{ color: "var(--mut)" }}>My average ★</span>
          <AvgStars value={a.avg_rating} />
        </div>
        <div style={{ fontSize: 11, color: "var(--canon)", marginTop: 6 }}>
          <i className="ti ti-flag" /> {a.pct >= 100 ? "Complete — every film of this director in our catalog" : `${a.remaining} film${a.remaining === 1 ? "" : "s"} to complete`}
        </div>
      </ICard>

      <ICard icon="ti-target-arrow" title={<>Conquest candidates {a.unseen.length ? `(${a.unseen.length})` : ""}</>}>
        {a.unseen.length ? (
          <div className="au-conqlist">
            {a.unseen.map((f) => (
              <div key={f.slug} className="au-conqrow" onClick={() => onFilm(f, a.name)}>
                <span className="au-cpo" style={f.poster_path ? { backgroundImage: `url(${IMG}${f.poster_path})` } : {}} />
                <div className="au-cbody">
                  <div className="au-ctt">{f.title}</div>
                  <div className="au-csub">{f.year ?? "?"}</div>
                </div>
                <div className="au-cnum"><div className="pv" style={{ color: "var(--canon)" }}>{f.prestige != null ? Math.round(f.prestige) : "—"}</div><div className="pl">Standing</div></div>
                <div className="au-cnum"><div className="pv" style={{ color: f.u != null && f.u >= 40 ? "var(--safe)" : "var(--ink)" }}>{f.u != null ? f.u : "—"}</div><div className="pl">U</div></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="emptyins">No unseen candidates — this director is either complete or has no further films in our catalog.</div>
        )}
      </ICard>
    </div>
  );
}

/* ═══════════ main ═══════════ */
type SortKey = "seen" | "pct" | "remain" | "name";
const LIST_FIRST = 30;

export default function AuteursWorkspace({ rows }: { rows: AuteurRow[] }) {
  const insp = useInspector();
  const { setDefault } = insp;
  const { session } = useRoomActions();
  const [sort, setSort] = useState<SortKey>("seen");
  const [sel, setSel] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const auteurs = useMemo(() => rows.map(normAuteur), [rows]);

  /* Session overlay: candidates acted on this session (Seen / rated) drop out of
     the conquest lists. Server completion numbers stay untouched (no fake math —
     they refresh on the next load). */
  const live = useMemo(
    () => auteurs.map((a) => ({ ...a, unseen: a.unseen.filter((f) => !session.gone.has(f.slug)) })),
    [auteurs, session.gone],
  );

  /* ── KPI ── */
  const started = live.length;
  const conquered = useMemo(() => live.filter((a) => a.pct >= 100).length, [live]);
  const avgPct = useMemo(() => {
    if (!live.length) return null;
    return Math.round(live.reduce((s, a) => s + a.pct, 0) / live.length);
  }, [live]);
  const conquerCount = useMemo(() => live.reduce((s, a) => s + a.unseen.length, 0), [live]);

  /* ── conquest desk: flat cross-director list of top unseen essentials, Standing desc ── */
  const conquerDesk = useMemo(() => {
    const flat: (Unseen & { dir: string })[] = [];
    for (const a of live) for (const f of a.unseen) flat.push({ ...f, dir: a.name });
    return flat.sort((x, y) => (y.prestige ?? -1) - (x.prestige ?? -1)).slice(0, 12);
  }, [live]);

  /* ── sorted director list (v3 adds "Closest to complete" = remaining asc;
        complete directors sink to the end — nothing left to close there) ── */
  const sorted = useMemo(() => {
    const s = [...live];
    if (sort === "pct") s.sort((x, y) => y.pct - x.pct || y.seen - x.seen);
    else if (sort === "remain") s.sort((x, y) => {
      const doneX = x.remaining <= 0 ? 1 : 0, doneY = y.remaining <= 0 ? 1 : 0;
      return doneX - doneY || x.remaining - y.remaining || y.pct - x.pct;
    });
    else if (sort === "name") s.sort((x, y) => x.name.localeCompare(y.name));
    else s.sort((x, y) => y.seen - x.seen || y.pct - x.pct);
    return s;
  }, [live, sort]);
  const view = showAll ? sorted : sorted.slice(0, LIST_FIRST);
  const hiddenCount = sorted.length - view.length;

  const openFilm = (f: Unseen, dir: string) => { setSel(f.slug); insp.select(<ConquerInsp f={f} dir={dir} />, `${f.title} · Conquest`); };
  const openAuteur = (a: Auteur) => { setSel(a.slug); insp.select(<AuteurInsp a={a} onFilm={openFilm} />, `${a.name} · Conquest`); };

  /* ── page brief (opened by the app-bar Brief button) ── */
  useEffect(() => {
    const brief: ReactNode = (
      <div>
        <ICard icon="ti-crown" title="Auteurs — conquest summary">
          <KV k="Directors started" v={started} />
          <KV k="Complete (100%)" v={<span style={{ color: conquered ? "var(--conquer)" : "var(--ink)" }}>{conquered}</span>} />
          <KV k="Avg completion" v={avgPct != null ? `${avgPct}%` : "—"} />
          <KV k="Conquest candidates" v={conquerCount} />
        </ICard>
        <ICard icon="ti-info-circle" title="How to read this">
          <div style={{ fontSize: 11.5, color: "var(--mut)", lineHeight: 1.55 }}>
            Completion is the share of this director&apos;s films <b style={{ color: "var(--ink)" }}>in our catalog</b> that
            you&apos;ve seen — not the full filmography. States: {STATE_GLOSS}. Click a director or a conquest candidate;
            every candidate can be kept, logged as seen, or rated right from the inspector.
          </div>
        </ICard>
      </div>
    );
    setDefault(brief);
  }, [started, conquered, avgPct, conquerCount, setDefault]);

  /* ── honest empty state (unlocks at the first seen film with a director) ── */
  if (!auteurs.length) {
    return (
      <div className="mainpad">
        <h1 className="secttl">Auteurs</h1>
        <p className="secsub">
          Oeuvre <span className="gloss" title={DENOM_GLOSS}>completion</span> for every director you&apos;ve started —
          with the unseen essentials queued as conquest targets.
        </p>
        <div className="mod"><div className="modbody">
          <div className="emptyins" style={{ padding: "32px 12px 16px" }}>{STR.empty.auteurs}</div>
          <ActBar acts={[
            { label: STR.forming.defaultCta, href: "/room/ledger" },
            { label: STR.forming.importCta, href: "/me/import" },
          ]} style={{ marginBottom: 10 }} />
        </div></div>
      </div>
    );
  }

  return (
    <div className="mainpad">
      <h1 className="secttl">Auteurs</h1>
      <p className="secsub">
        Oeuvre <span className="gloss" title={DENOM_GLOSS}>completion</span> for every director you&apos;ve started,
        on the <span className="gloss" title={STATE_GLOSS}>4-state</span> track — the unseen essentials are your{" "}
        <span className="gloss" title="Conquest candidate = an unseen essential of a director you've started. The next target.">conquest</span> candidates.
        Every number is measured.
      </p>

      {/* ═══ KPI STRIP ═══ */}
      <div className="au-kpis">
        <div className="kpi"><div className="kl">Directors started</div><div className="kn">{started}</div><div className="ks">seen ≥ 1 film</div></div>
        <div className="kpi"><div className="kl">Complete</div><div className="kn" style={{ color: conquered ? "var(--conquer)" : "var(--ink)" }}>{conquered}</div><div className="ks">100% of catalog</div></div>
        <div className="kpi"><div className="kl">Avg completion</div><div className="kn">{avgPct != null ? avgPct : "—"}<small>%</small></div><div className="ks">across all started</div></div>
        <div className="kpi"><div className="kl">Conquest candidates</div><div className="kn" style={{ color: "var(--canon)" }}>{conquerCount}</div><div className="ks">next targets</div></div>
      </div>

      {/* ═══ CONQUEST BOARD (directors) ═══ */}
      <div className="mod">
        <div className="au-modh">
          <h3><i className="ti ti-crown" /> Conquest board</h3>
          <div className="xseg">
            {([["seen", "Most seen"], ["pct", "Completion"], ["remain", "Closest to complete"], ["name", "A–Z"]] as const).map(([k, l]) => (
              <button key={k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{l}</button>
            ))}
          </div>
        </div>
        <div>
          {view.map((a) => {
            const st = covState(a.pct);
            return (
              <div key={a.slug} className={`au-row ${st.cls}${sel === a.slug ? " sel" : ""}`} onClick={() => openAuteur(a)} title={`${a.name} — ${a.seen}/${a.total}`}>
                <span className="au-thumb" style={a.profile_path ? { backgroundImage: `url(${IMG}${a.profile_path})` } : {}} />
                <div className="au-name">
                  <div className="au-nm">{a.name}</div>
                  <div className="au-sub">{a.seen}/{a.total} seen · {a.unseen.length ? `${a.unseen.length} candidate${a.unseen.length === 1 ? "" : "s"}` : a.pct >= 100 ? "complete" : `${a.remaining} to go`}</div>
                </div>
                <div className="au-barwrap">
                  <div className="au-track"><i style={{ width: `${Math.max(a.pct, a.pct > 0 ? 3 : 1)}%`, background: st.col }} /></div>
                  <span className="au-pct" style={{ color: st.col }}>{a.pct}%</span>
                </div>
                <AvgStars value={a.avg_rating} />
                <span className="au-statetag">{st.label}</span>
              </div>
            );
          })}
        </div>
        {hiddenCount > 0 ? (
          <div className="pgn">
            <button onClick={() => setShowAll(true)}>{STR.common.showAll} ({sorted.length})</button>
          </div>
        ) : null}
      </div>

      {/* ═══ CONQUEST DESK (flat next-target list) ═══ */}
      <div className="mod">
        <div className="au-modh">
          <h3><i className="ti ti-target-arrow" /> Conquest desk · next targets</h3>
          <span className="au-meta">unseen essentials of directors you love · by Standing</span>
        </div>
        <div>
          {conquerDesk.length ? conquerDesk.map((f, i) => {
            const kept = session.kept.has(f.slug);
            const conquer = REASON_MAP.conquer;
            return (
              <div key={`${f.slug}-${f.dir}`} className="au-conqdesk-row" onClick={() => openFilm(f, f.dir)}>
                <div className="au-rk">{i + 1}</div>
                <span className="au-cpo" style={f.poster_path ? { backgroundImage: `url(${IMG}${f.poster_path})` } : {}} />
                <div className="au-cbody">
                  <div className="au-ctt">{f.title} <small>{f.year ?? ""}</small></div>
                  <div className="au-csub">{f.dir}</div>
                  <div className="au-rsn-line">
                    <span className={`rsn ${conquer.cls}`}><i className="ti ti-flag" /> {conquer.label}</span>
                    {kept ? <span className="rsn safe"><i className="ti ti-check" /> {STR.row.kept}</span> : null}
                  </div>
                </div>
                <div className="au-cnum"><div className="pv" style={{ color: "var(--canon)" }}>{f.prestige != null ? Math.round(f.prestige) : "—"}</div><div className="pl">Standing</div></div>
                <div className="au-cnum"><div className="pv" style={{ color: f.u != null && f.u >= 40 ? "var(--safe)" : "var(--ink)" }}>{f.u != null ? f.u : "—"}</div><div className="pl">U</div></div>
              </div>
            );
          }) : <div className="emptyins">No conquest candidates left — every director you&apos;ve started is complete.</div>}
        </div>
      </div>
    </div>
  );
}
