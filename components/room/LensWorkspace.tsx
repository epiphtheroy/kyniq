"use client";
/** Lens (/room/lens) — my collection refracted through the theory spine (spec §3.11).
 *
 *  Coupled to public lens APIs — any change to app/api/lens/** requires
 *  regression-testing this screen.
 *
 *  DATA CONTRACT (inviolable):
 *   - entity profiles: fetch('/api/lens/entities?kind=tropes|concepts|theorists|traditions|directors')
 *   - readings:        fetch('/api/lens/readings') — server-side readings_mine
 *                      pagination (p_offset); NEVER call trope_readings (repo invariant)
 *   - takescore:       fetch('/api/lens/takescore') — v2 module, placeholder-only here
 *  The *_mine RPCs stay service-role-only behind session-validated routes —
 *  never create client-callable variants. Responses are Cache-Control:
 *  private, no-store, so nothing here caches beyond component state.
 *
 *  This is the ONLY /room screen that is client-fetch-first: the shell renders
 *  immediately and each panel carries its own skeleton. */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useInspector } from "./InspectorContext";
import { STR } from "./strings";
import { IMG185 } from "@/lib/room/format";
import { BROWSABLE, fw as fwOf } from "@/lib/frameworks";
import ICard from "./insp/ICard";
import KV from "./insp/KV";
import CRow from "./insp/CRow";
import SelHead from "./insp/SelHead";
import ActBar from "./insp/ActBar";

/* ── API row shapes (bound to app/api/lens/** responses) ─────────────── */
type EntityKind = "tropes" | "concepts" | "theorists" | "traditions" | "directors";
type TabKey = EntityKind | "readings";
type EntityRow = { slug: string | null; label: string; sub: string | null; n: number; img?: string | null };
type ReadingRow = {
  id: string; tt: string | null; fw: string; snip: string;
  fig: string; figslug: string | null; film: string; filmslug: string; year: number | null;
  bd: string | null; poster: string | null; trope: string | null; tropeslug: string | null;
};
type Fetched<T> = { status: "loading" | "more" | "error" | "done"; total: number; rows: T[] };

const ENT_PAGE = 500; // API default page; total beyond this pages via offset
const ENT_SHOWN_STEP = 60;
const READ_PAGE = 24;

const KIND_META: Record<EntityKind, { label: string; one: string; icon: string; pub: string }> = {
  tropes: { label: "Tropes", one: "Trope", icon: "ti-hash", pub: "/trope" },
  concepts: { label: "Concepts", one: "Concept", icon: "ti-bulb", pub: "/concept" },
  theorists: { label: "Theorists", one: "Theorist", icon: "ti-user-circle", pub: "/theorist" },
  traditions: { label: "Traditions", one: "Tradition", icon: "ti-building-bank", pub: "/tradition" },
  directors: { label: "Directors", one: "Director", icon: "ti-video", pub: "/director" },
};
const KINDS: EntityKind[] = ["tropes", "concepts", "theorists", "traditions", "directors"];

const SORTS: [string, string][] = [
  ["film", "Film A–Z"], ["recent", "Just added"], ["bold", "Boldest"],
  ["year_desc", "Newest film"], ["year_asc", "Oldest film"],
];
const DECADES = [2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950, 1940, 1930, 1920];

/** Public take page for a reading (same rule as the public feed). */
const figHref = (r: { filmslug: string; figslug: string | null }) =>
  r.figslug ? `/film/${r.filmslug}/figure/${r.figslug}` : `/film/${r.filmslug}`;
const thumb = (r: { bd: string | null; poster: string | null }) =>
  r.bd ? `${IMG185}${r.bd}` : r.poster ? `${IMG185}${r.poster}` : null;

const ErrCard = ({ onRetry }: { onRetry?: () => void }) => (
  <div className="errcard">
    <i className="ti ti-alert-triangle" />{STR.common.errorLoad}
    {onRetry ? <button className="actbtn" style={{ flex: "0 0 auto", padding: "4px 12px" }} onClick={onRetry}>{STR.common.retry}</button> : null}
  </div>
);

const Ghost = ({ rows = 8 }: { rows?: number }) => (
  <div aria-hidden>
    {Array.from({ length: rows }, (_, i) => <div key={i} className={`ghline ${i % 3 === 0 ? "w80" : i % 3 === 1 ? "w60" : "w40"}`} />)}
  </div>
);

const onKey = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); fn(); }
};

/* ── entity inspector ─────────────────────────────────────────────────── */
function EntityInsp({ kind, row, rank, maxN }: { kind: EntityKind; row: EntityRow; rank: number; maxN: number }) {
  const meta = KIND_META[kind];
  const href = row.slug ? `${meta.pub}/${row.slug}` : null;
  return (
    <div>
      <SelHead
        title={row.label}
        sub={row.sub ?? meta.one}
        posterPath={kind === "directors" ? row.img ?? null : null}
        href={href ?? undefined}
      />
      <ICard icon={meta.icon} title={meta.one} right={`#${rank}`}>
        <KV k="My films" v={row.n} />
        {row.sub ? <KV k={kind === "traditions" ? "Theorist" : kind === "directors" ? "Origin" : "Note"} v={row.sub} /> : null}
        <div style={{ marginTop: 8 }}>
          <CRow label="vs top" value={row.n} max={maxN} color="var(--reading)" text={String(row.n)} />
        </div>
        <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 8, lineHeight: 1.5 }}>
          Count = films you&rsquo;ve marked Seen that this {meta.one.toLowerCase()} crosses in published site data. Private to you (no-store).
        </div>
      </ICard>
      <ActBar acts={[{ label: "Open public page →", href: href ?? undefined, primary: true, disabled: !href, title: href ? undefined : "No public page for this entity yet" }]} />
    </div>
  );
}

/* ═══════════ main ═══════════ */
export default function LensWorkspace() {
  const insp = useInspector();
  const { setDefault } = insp;

  const [tab, setTab] = useState<TabKey>("tropes");
  const [entities, setEntities] = useState<Partial<Record<EntityKind, Fetched<EntityRow>>>>({});
  const [shown, setShown] = useState<Partial<Record<EntityKind, number>>>({});

  /* readings state */
  const [rd, setRd] = useState<Fetched<ReadingRow> | null>(null);
  const [fwSlug, setFwSlug] = useState<string | null>(null);
  const [sort, setSort] = useState("film");
  const [decade, setDecade] = useState<number | null>(null);
  const [trope, setTrope] = useState<{ slug: string; label: string } | null>(null);
  const [tq, setTq] = useState("");
  const [sugOpen, setSugOpen] = useState(false);
  const blurTimer = useRef<number | undefined>(undefined);

  /* ── entity fetch (paged via limit/offset; append past ENT_PAGE) ── */
  const loadEntities = useCallback((kind: EntityKind, offset = 0) => {
    setEntities((s) => ({
      ...s,
      [kind]: offset === 0
        ? { status: "loading", total: 0, rows: [] }
        : { ...(s[kind] as Fetched<EntityRow>), status: "more" },
    }));
    fetch(`/api/lens/entities?kind=${kind}&limit=${ENT_PAGE}&offset=${offset}`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<{ total?: number; rows?: EntityRow[] }>; })
      .then((d) => {
        setEntities((s) => {
          const prev = offset === 0 ? [] : (s[kind]?.rows ?? []);
          return { ...s, [kind]: { status: "done", total: d.total ?? 0, rows: [...prev, ...(d.rows ?? [])] } };
        });
      })
      .catch(() => {
        setEntities((s) => ({ ...s, [kind]: { status: "error", total: s[kind]?.total ?? 0, rows: s[kind]?.rows ?? [] } }));
      });
  }, []);

  /* ── readings fetch (server-side readings_mine pagination) ── */
  const loadReadings = useCallback((offset: number) => {
    setRd((s) => offset === 0
      ? { status: "loading", total: 0, rows: [] }
      : { ...(s as Fetched<ReadingRow>), status: "more" });
    const p = new URLSearchParams();
    p.set("fw", fwSlug ?? "all");
    p.set("sort", sort);
    if (decade != null) p.set("decade", String(decade));
    if (trope) p.set("trope", trope.slug);
    p.set("limit", String(READ_PAGE));
    p.set("offset", String(offset));
    fetch(`/api/lens/readings?${p.toString()}`, { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<{ total?: number; rows?: ReadingRow[] }>; })
      .then((d) => {
        setRd((s) => {
          const prev = offset === 0 ? [] : (s?.rows ?? []);
          return { status: "done", total: d.total ?? 0, rows: [...prev, ...(d.rows ?? [])] };
        });
      })
      .catch(() => setRd((s) => ({ status: "error", total: s?.total ?? 0, rows: offset === 0 ? [] : (s?.rows ?? []) })));
  }, [fwSlug, sort, decade, trope]);

  /* activate tab → load its panel (once for entities; on every filter change for readings) */
  useEffect(() => {
    if (tab === "readings") { loadReadings(0); return; }
    if (!entities[tab]) loadEntities(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, loadReadings]);

  /* trope suggestions come from the tropes-that-cross-my-films index (tropes_mine
     keys are slugs — free text can't hit the RPC filter, so we pick from the real list) */
  const tropeRows = entities.tropes?.rows ?? [];
  const sugs = useMemo(() => {
    const q = tq.trim().toLowerCase();
    if (!q) return [];
    return tropeRows.filter((r) => r.slug && r.label.toLowerCase().includes(q)).slice(0, 12);
  }, [tq, tropeRows]);

  /* ── page brief ── */
  useEffect(() => {
    setDefault(
      <div>
        <ICard icon="ti-telescope" title="Lens">
          <div style={{ fontSize: 12.5, fontFamily: "var(--ser)", lineHeight: 1.6, color: "var(--ink)" }}>
            Your collection refracted through the theory spine: tropes, concepts, theorists, traditions
            and directors ranked by how many of your seen films they cross — plus every published
            reading on a film you&rsquo;ve seen. The more you log, the more opens. Content compounds; nothing here is a score.
          </div>
        </ICard>
        <ICard icon="ti-lock" title="Private by contract">
          <div style={{ fontSize: 11.5, color: "var(--mut)", lineHeight: 1.55 }}>
            Everything flows through session-validated /api/lens routes and is never cached
            (private, no-store). Public pages never see this data.
          </div>
        </ICard>
      </div>
    );
  }, [setDefault]);

  const openEntity = (kind: EntityKind, row: EntityRow, rank: number, maxN: number) =>
    insp.select(<EntityInsp kind={kind} row={row} rank={rank} maxN={maxN} />, `${row.label} · ${KIND_META[kind].one}`);

  /* ── entity tab panel ── */
  const renderEntities = (kind: EntityKind) => {
    const st = entities[kind];
    if (!st || (st.status === "loading" && st.rows.length === 0)) return <Ghost />;
    if (st.status === "error" && st.rows.length === 0) return <ErrCard onRetry={() => loadEntities(kind)} />;
    if (st.rows.length === 0) return <div className="lx-empty">{STR.empty.lensEntities}</div>;

    const nShown = shown[kind] ?? ENT_SHOWN_STEP;
    const visible = st.rows.slice(0, nShown);
    const maxN = st.rows.reduce((m, r) => Math.max(m, r.n), 1);
    const meta = KIND_META[kind];
    const hasMore = nShown < st.rows.length || st.rows.length < st.total;

    return (
      <>
        <div className="lx-count"><b>{st.total.toLocaleString()}</b> {meta.label.toLowerCase()} cross films you&rsquo;ve seen</div>
        {visible.map((r, i) => (
          <div
            key={`${r.slug ?? r.label}-${i}`}
            className="lx-row"
            role="button"
            tabIndex={0}
            onClick={() => openEntity(kind, r, i + 1, maxN)}
            onKeyDown={onKey(() => openEntity(kind, r, i + 1, maxN))}
          >
            <span className="lx-rk">{i + 1}</span>
            <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <span className="lx-lb">{r.label}</span>
              {r.sub ? <span className="lx-sub">{r.sub}</span> : null}
            </div>
            <div className="lx-bar"><i style={{ width: `${Math.max(3, Math.round((r.n / maxN) * 100))}%` }} /></div>
            <span className="lx-n">{r.n}</span>
            {r.slug ? (
              <Link className="lx-out" href={`${meta.pub}/${r.slug}`} title="Open public page" onClick={(e) => e.stopPropagation()}>
                <i className="ti ti-external-link" />
              </Link>
            ) : <span />}
          </div>
        ))}
        {st.status === "error" ? <ErrCard onRetry={() => loadEntities(kind, st.rows.length)} /> : null}
        {hasMore ? (
          <div className="pgn">
            <button
              disabled={st.status === "more"}
              onClick={() => {
                if (nShown < st.rows.length) setShown((s) => ({ ...s, [kind]: nShown + ENT_SHOWN_STEP }));
                else { loadEntities(kind, st.rows.length); setShown((s) => ({ ...s, [kind]: nShown + ENT_SHOWN_STEP })); }
              }}
            >
              {st.status === "more" ? "Loading…" : STR.common.loadMore}
            </button>
            <span className="pc">{Math.min(nShown, st.rows.length)} / {st.total}</span>
          </div>
        ) : null}
      </>
    );
  };

  /* ── readings tab panel ── */
  const renderReadings = () => (
    <>
      {/* framework chips — the canonical 14 (lib/frameworks.ts colors) */}
      <div className="lx-fwchips">
        <button className={`lx-fw all${fwSlug === null ? " on" : ""}`} onClick={() => setFwSlug(null)}>All frames</button>
        {BROWSABLE.map((f) => (
          <button
            key={f.slug}
            className={`lx-fw${fwSlug === f.slug ? " on" : ""}`}
            style={{ color: fwSlug === f.slug ? f.color : undefined }}
            title={f.short}
            onClick={() => setFwSlug(fwSlug === f.slug ? null : f.slug)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="lx-controls">
        <div className="lx-tsearch">
          {trope ? (
            <span className="lx-tchip">
              # {trope.label}
              <button title="Clear trope filter" onClick={() => setTrope(null)}><i className="ti ti-x" /></button>
            </span>
          ) : (
            <span className="srch">
              <i className="ti ti-hash" />
              <input
                value={tq}
                placeholder="Filter by trope"
                aria-label="Filter by trope"
                onChange={(e) => { setTq(e.target.value); setSugOpen(true); if (!entities.tropes) loadEntities("tropes"); }}
                onFocus={() => { if (!entities.tropes) loadEntities("tropes"); if (sugs.length) setSugOpen(true); }}
                onBlur={() => { blurTimer.current = window.setTimeout(() => setSugOpen(false), 150); }}
              />
            </span>
          )}
          {sugOpen && sugs.length > 0 ? (
            <div className="lx-sugs">
              {sugs.map((s) => (
                <button
                  key={s.slug}
                  className="lx-sug"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    window.clearTimeout(blurTimer.current);
                    setTrope({ slug: s.slug as string, label: s.label });
                    setTq(""); setSugOpen(false);
                  }}
                >
                  <span>{s.label}</span><span className="n">{s.n}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <select className="select" value={decade ?? ""} aria-label="Decade" onChange={(e) => setDecade(e.target.value ? Number(e.target.value) : null)}>
          <option value="">All years</option>
          {DECADES.map((d) => <option key={d} value={d}>{d}s</option>)}
        </select>
        <select className="select" value={sort} aria-label="Sort" onChange={(e) => setSort(e.target.value)}>
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      {rd == null || (rd.status === "loading" && rd.rows.length === 0) ? <Ghost /> :
        rd.status === "error" && rd.rows.length === 0 ? <ErrCard onRetry={() => loadReadings(0)} /> :
        rd.rows.length === 0 ? (
          <div className="lx-empty">
            {fwSlug || decade || trope
              ? "No published readings on your films match these filters."
              : STR.empty.lensReadings}
            {" "}Every film you log can bring its readings here.
          </div>
        ) : (
          <>
            <div className="lx-count"><b>{rd.total.toLocaleString()}</b> {rd.total === 1 ? "reading" : "readings"} from films you&rsquo;ve seen</div>
            <div className="lx-cards">
              {rd.rows.map((r) => {
                const F = fwOf(r.fw);
                const im = thumb(r);
                return (
                  <div key={r.id} className="lx-card">
                    {im
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img className="lx-cimg" src={im} alt="" loading="lazy" />
                      : <span className="lx-cimg lx-cimg--blank" />}
                    <div className="lx-cbody">
                      <span className="lx-cfw" style={{ color: F.color }}>{F.label}</span>
                      <Link className="lx-ctt" href={figHref(r)}>{r.tt ?? r.fig} →</Link>
                      <span className="lx-cfilm">{r.film}{r.year ? ` (${r.year})` : ""} · via {r.fig}</span>
                      {r.snip ? <div className="lx-csnip">{r.snip}…</div> : null}
                      {r.trope && r.tropeslug ? <Link className="lx-ctrope" href={`/trope/${r.tropeslug}`}># {r.trope}</Link> : null}
                    </div>
                  </div>
                );
              })}
            </div>
            {rd.status === "error" ? <ErrCard onRetry={() => loadReadings(rd.rows.length)} /> : null}
            {rd.rows.length < rd.total ? (
              <div className="pgn">
                <button disabled={rd.status === "more"} onClick={() => loadReadings(rd.rows.length)}>
                  {rd.status === "more" ? "Loading…" : STR.common.loadMore}
                </button>
                <span className="pc">{rd.rows.length} / {rd.total}</span>
              </div>
            ) : null}
          </>
        )}
    </>
  );

  return (
    <div className="mainpad">
      <h1 className="secttl">Lens</h1>
      <p className="secsub">
        Your collection refracted through the theory spine — entities and published readings
        cross only films you&rsquo;ve seen. The more you log, the more opens.
      </p>

      <div className="lx-tabs" role="tablist" aria-label="Lens panels">
        {KINDS.map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`lx-tab${tab === k ? " on" : ""}`} onClick={() => setTab(k)}>
            <i className={`ti ${KIND_META[k].icon}`} />{KIND_META[k].label}
            {entities[k]?.status === "done" ? <span className="n">{entities[k]!.total}</span> : null}
          </button>
        ))}
        <button role="tab" aria-selected={tab === "readings"} className={`lx-tab${tab === "readings" ? " on" : ""}`} onClick={() => setTab("readings")}>
          <i className="ti ti-book" />Readings
          {rd?.status === "done" ? <span className="n">{rd.total}</span> : null}
        </button>
      </div>

      <div className="mod">
        <div className="modbody">
          {tab === "readings" ? renderReadings() : renderEntities(tab)}
        </div>
      </div>

      {/* TakeScore Explorer — v2 module, out of scope for this build (placeholder slot only). */}
      <div className="mod lx-v2">
        <div className="modh">
          <h3><i className="ti ti-adjustments" /> TakeScore Explorer</h3>
          <span className="meta">v2 module · out of scope</span>
        </div>
        <div className="modbody">
          The TakeScore ranking of your seen films — a λ dial and year range over the private
          /api/lens/takescore endpoint — ships as a v2 module. The endpoint is live; the instrument
          panel is not built yet, so no numbers are shown here.
        </div>
      </div>
    </div>
  );
}
