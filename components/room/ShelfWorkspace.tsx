"use client";
/** Shelf — the pin archive (/room/shelf, v3 successor of /room/library).
 *  Spec §3.12. REAL data via me_library() (user_pins normalized, per-pin
 *  visibility), pulled through .range() chunks server-side.
 *
 *  v3 rules honored here:
 *  - poster-less chip cards — me_library returns no poster_path and we do NOT
 *    fake covers (§8-R3 me_library v2 adds real posters later);
 *  - the two permanently-empty pin types (director / lineage) are hidden from
 *    KPIs and filters — one honest line says "Directors & lineages: coming.";
 *  - every card links OUT to its public page (/film/ /trope/ /take/) and IN to
 *    the Details inspector;
 *  - Unpin is a disabled action ("Unpinning ships soon." — §8-R5a) while
 *    public/private (set_pin_visibility) and favorite (me_toggle_fav) stay
 *    live mutations;
 *  - sorts Newest / Oldest / Type / A–Z. */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useInspector } from "./InspectorContext";
import { useRoomActions } from "./useRoomActions";
import { STR } from "./strings";
import ICard from "./insp/ICard";
import KV from "./insp/KV";
import SelHead from "./insp/SelHead";
import ActBar, { type Act } from "./insp/ActBar";

export type ShelfRow = {
  entity_type: string;      // film | trope | misreading | figure (director/lineage: coming)
  slug: string | null;
  film_slug: string | null; // set for figures (their public page is film-scoped)
  title: string | null;
  sub: string | null;
  def: string | null;
  film_count: number | null;
  maturity: string | null;
  prestige: number | null;
  rating: number | null;
  seen: boolean | null;
  fav: boolean;
  visibility: string | null;
  created_at: string;
};

type TypeKey = "film" | "trope" | "misreading" | "figure";
/* Literal colors (not island CSS vars) — inspector content renders outside .sh-wrap. */
const TYPES: Record<TypeKey, { l: string; c: string; i: string }> = {
  film: { l: "Film", c: "#ECEAE5", i: "ti-movie" },
  trope: { l: "Trope", c: "#1FB286", i: "ti-affiliate" },
  misreading: { l: "Misreading", c: "#C8922B", i: "ti-quote" },
  figure: { l: "Figure", c: "#86b9ec", i: "ti-eye" },
};
const ORDER: TypeKey[] = ["film", "trope", "misreading", "figure"];
const isType = (t: string): t is TypeKey => t in TYPES;

/** Public page for a pin — the shelf always links out (spec §3.12-2). */
function publicHref(r: ShelfRow): string | null {
  if (!r.slug) return null;
  switch (r.entity_type) {
    case "film": return `/film/${r.slug}`;
    case "trope": return `/trope/${r.slug}`;
    case "misreading": return `/take/${r.slug}`;
    case "figure": return r.film_slug ? `/film/${r.film_slug}/figure/${r.slug}` : null;
    default: return null;
  }
}

type SortKey = "new" | "old" | "type" | "az";
const SORTS: { k: SortKey; l: string }[] = [
  { k: "new", l: "Newest" }, { k: "old", l: "Oldest" }, { k: "type", l: "Type" }, { k: "az", l: "A–Z" },
];
const PAGE = 60;

/* Per-pin overlay (fav + public), seeded from server values, saved on toggle. */
type Ov = { fav: boolean; pub: boolean };

function DetailInsp({ it, ov, href, onTogglePub, onToggleFav }: {
  it: ShelfRow; ov: Ov; href: string | null; onTogglePub: () => void; onToggleFav: () => void;
}) {
  const tk = isType(it.entity_type) ? it.entity_type : "misreading";
  const col = TYPES[tk].c;
  const acts: Act[] = [
    { label: <><i className="ti ti-star" /> {ov.fav ? "Favorited" : "Favorite"}</>, onClick: onToggleFav, primary: ov.fav, title: "Like-pin — saves instantly (me_toggle_fav)" },
    { label: <><i className="ti ti-pinned-off" /> Unpin</>, disabled: true, title: "Unpinning ships soon." },
  ];
  if (href) acts.push({ label: <>View page <i className="ti ti-arrow-right" /></>, href, title: "Open the public page" });
  return (
    <div>
      {tk === "misreading" ? (
        <ICard icon="ti-quote" title={<span style={{ color: col }}>Misreading</span>}>
          <div className="sh-insp-quote">&ldquo;{it.sub || it.title}&rdquo;</div>
          {it.title ? <div style={{ fontSize: 10.5, color: "var(--sub)", marginTop: 9 }}>— {it.title}</div> : null}
        </ICard>
      ) : (
        <SelHead title={it.title ?? "—"} sub={<><span style={{ color: col }}>{TYPES[tk].l}</span>{it.sub ? <> · {it.sub}</> : null}</>} href={href ?? undefined} />
      )}

      {tk === "film" ? (
        <ICard icon="ti-coin" title="Position">
          <KV k="Standing" v={it.prestige != null ? Math.round(it.prestige) : "Not computed"} />
          <KV k="My rating" v={it.rating != null ? `★${it.rating.toFixed(1)}` : it.seen ? "Logged" : "—"} />
          <KV k="Status" v={it.seen ? "Seen" : "Not seen yet"} />
        </ICard>
      ) : null}

      {(tk === "trope" || tk === "figure" || tk === "misreading") && it.def ? (
        <ICard icon="ti-text-caption" title={tk === "misreading" ? "Thesis" : "Definition"}>
          <div style={{ fontSize: 12.5, fontFamily: "var(--ser)", lineHeight: 1.55, color: "var(--ink)" }}>{it.def}</div>
        </ICard>
      ) : null}

      {tk === "trope" ? (
        <ICard icon="ti-movie" title="Reach">
          <KV k="Films" v={it.film_count != null ? it.film_count : "—"} />
          {it.maturity ? <KV k="Maturity" v={it.maturity} /> : null}
        </ICard>
      ) : null}

      <ICard icon="ti-adjustments" title="Shelf meta">
        <div className="sh-pubtog">
          <span className={`sh-sw${ov.pub ? " on" : ""}`} role="switch" aria-checked={ov.pub} tabIndex={0} onClick={onTogglePub}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTogglePub(); } }} />
          <span>{ov.pub ? <><i className="ti ti-world" style={{ color: "var(--safe)" }} /> Public — shows on your profile</> : <><i className="ti ti-lock" /> Private</>}</span>
        </div>
        <ActBar acts={acts} style={{ marginTop: 11 }} />
        <div className="sh-note">
          Public/private and favorites save instantly. Unpinning ships soon.
        </div>
      </ICard>
    </div>
  );
}

export default function ShelfWorkspace({ rows: allRows }: { rows: ShelfRow[] }) {
  const insp = useInspector();
  const { setDefault } = insp;
  const { supabase, say } = useRoomActions();

  /* Pins removed server-side this session (like-only pin unfavorited → unpinned). */
  const [gone, setGone] = useState<Set<string>>(new Set());
  /* director/lineage pins can't exist yet — and stay hidden if a stray row appears. */
  const rows = useMemo(
    () => allRows.filter((r) => isType(r.entity_type) && !gone.has(`${r.entity_type}|${r.slug ?? r.title ?? ""}`)),
    [allRows, gone],
  );

  const keyOf = (r: ShelfRow) => `${r.entity_type}|${r.slug ?? r.title ?? ""}`;
  const [selKey, setSelKey] = useState<string | null>(null);
  const [ovs, setOvs] = useState<Record<string, Ov>>(() => {
    const o: Record<string, Ov> = {};
    for (const r of rows) o[keyOf(r)] = { fav: r.fav, pub: r.visibility === "public" };
    return o;
  });
  const ov = useCallback(
    (r: ShelfRow): Ov => ovs[keyOf(r)] ?? { fav: r.fav, pub: r.visibility === "public" },
    [ovs],
  );

  /* public toggle → set_pin_visibility (optimistic; toast via the shared provider) */
  const setPub = useCallback((r: ShelfRow) => {
    const next = !ov(r).pub;
    setOvs((p) => { const k = keyOf(r); const cur = p[k] ?? { fav: r.fav, pub: r.visibility === "public" }; return { ...p, [k]: { ...cur, pub: next } }; });
    if (!r.slug) { say("This item has no identifier — the change lives in this session only"); return; }
    supabase.rpc("set_pin_visibility", { p_entity_type: r.entity_type, p_slug: r.slug, p_public: next })
      .then(({ error }) => say(error ? STR.toast.saveFail(error.message) : next ? `"${r.title}" is now public` : `"${r.title}" is now private`));
  }, [ov, supabase, say]);

  /* favorite → me_toggle_fav (creates/removes the kind='like' pin) */
  const setFav = useCallback((r: ShelfRow) => {
    const next = !ov(r).fav;
    setOvs((p) => { const k = keyOf(r); const cur = p[k] ?? { fav: r.fav, pub: r.visibility === "public" }; return { ...p, [k]: { ...cur, fav: next } }; });
    if (!r.slug) { say("This item has no identifier — the change lives in this session only"); return; }
    supabase.rpc("me_toggle_fav", { p_entity_type: r.entity_type, p_slug: r.slug })
      .then(({ error }) => say(error ? STR.toast.saveFail(error.message) : next ? "★ Favorited" : "Favorite removed"));
  }, [ov, supabase, say]);

  const [tfilter, setTfilter] = useState<Set<TypeKey>>(new Set());
  const [pubFilter, setPubFilter] = useState<"all" | "public" | "private">("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("new");
  const [shown, setShown] = useState(PAGE);
  const [selKey, setSelKey] = useState<string | null>(null);

  const cnt = useCallback((t: TypeKey) => rows.filter((r) => r.entity_type === t).length, [rows]);
  const total = rows.length;
  const favN = rows.filter((r) => ov(r).fav).length;
  const pubN = rows.filter((r) => ov(r).pub).length;

  const view = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (tfilter.size && !tfilter.has(r.entity_type as TypeKey)) return false;
      if (pubFilter === "public" && !ov(r).pub) return false;
      if (pubFilter === "private" && ov(r).pub) return false;
      if (q) {
        const hay = `${r.title ?? ""}${r.sub ?? ""}${r.def ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
    const byDate = (a: ShelfRow, b: ShelfRow) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sort === "new") filtered.sort(byDate);
    else if (sort === "old") filtered.sort((a, b) => byDate(b, a));
    else if (sort === "az") filtered.sort((a, b) => (a.title ?? "").localeCompare(b.title ?? ""));
    else filtered.sort((a, b) => (ORDER.indexOf(a.entity_type as TypeKey) - ORDER.indexOf(b.entity_type as TypeKey)) || byDate(a, b));
    return filtered;
  }, [rows, tfilter, pubFilter, q, sort, ov]);

  useEffect(() => { setShown(PAGE); }, [tfilter, pubFilter, q, sort]);

  const hasFilters = tfilter.size > 0 || pubFilter !== "all" || q.trim() !== "";
  const clearFilters = () => { setTfilter(new Set()); setPubFilter("all"); setQ(""); };
  const toggleType = (t: TypeKey) => setTfilter((p) => { const n = new Set(p); if (n.has(t)) n.delete(t); else n.add(t); return n; });

  /* page brief (Brief button) — shelf composition, English, no fake numbers */
  useEffect(() => {
    setDefault(
      <div>
        <ICard icon="ti-books" title="Shelf · by type">
          {ORDER.map((t) => (
            <KV key={t} k={<span><span style={{ color: TYPES[t].c }}>●</span> {TYPES[t].l}</span>} v={cnt(t)} />
          ))}
          <div className="sh-note">Directors &amp; lineages: coming.</div>
        </ICard>
        <ICard icon="ti-bulb" title="What the shelf holds">
          <div style={{ fontSize: 11.5, color: "var(--mut)", lineHeight: 1.6 }}>
            Not just films. <b style={{ color: "var(--ink)" }}>Films, tropes, misreadings and figures</b> pin
            here the same way — each with a public/private toggle and a favorite star.
            Pin from any public page.
          </div>
        </ICard>
      </div>
    );
  }, [setDefault, cnt]);

  const openDetail = useCallback((r: ShelfRow) => {
    setSelKey(keyOf(r));
    insp.select(
      <DetailInsp it={r} ov={ov(r)} href={publicHref(r)} onTogglePub={() => setPub(r)} onToggleFav={() => setFav(r)} />,
      r.title ?? "Pin"
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ov, setPub, setFav]);

  /* inspector content is a snapshot — re-select when the overlay changes */
  useEffect(() => {
    if (!selKey || !insp.open) return;
    const r = rows.find((x) => keyOf(x) === selKey);
    if (r) {
      insp.select(
        <DetailInsp it={r} ov={ov(r)} href={publicHref(r)} onTogglePub={() => setPub(r)} onToggleFav={() => setFav(r)} />,
        r.title ?? "Pin"
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ovs]);
  useEffect(() => { if (!insp.open) setSelKey(null); }, [insp.open]);

  const pubList = rows.filter((r) => ov(r).pub).slice(0, 6);

  return (
    <div className="mainpad sh-wrap">
      <div className="sh-head">
        <h1 className="v2title">Shelf</h1>
        <p className="v2sub">Your pin archive — films, tropes, misreadings, figures. Directors &amp; lineages: coming.</p>
      </div>

      {/* KPI strip — visible types only (the empty two are hidden, honestly) */}
      <div className="kpis">
        <div className="kpi"><div className="kl">Pins</div><div className="kn">{total}</div><div className="ks">across {ORDER.filter((t) => cnt(t) > 0).length} of 4 types</div></div>
        <div className="kpi"><div className="kl">Favorites</div><div className="kn">{favN}</div><div className="ks">★ like-pins</div></div>
        <div className="kpi"><div className="kl">Public</div><div className="kn">{pubN}<small style={{ fontSize: 13, color: "var(--sub)" }}>/{total}</small></div><div className="ks">shown on your profile</div></div>
        <div className="kpi"><div className="kl">Non-film</div><div className="kn">{total - cnt("film")}</div><div className="ks">tropes · misreadings · figures</div></div>
      </div>

      {/* PINS */}
      <div className="mod">
        <div className="modh"><h3><i className="ti ti-books" /> Pins</h3><span className="meta">{view.length} / {total}</span></div>
        <div className="sh-toolbar">
          <div className="sh-tchips">
            {ORDER.map((t) => (
              <span key={t} className={`sh-tc${tfilter.has(t) ? " on" : ""}`} onClick={() => toggleType(t)} title={`Show ${TYPES[t].l.toLowerCase()} pins`}>
                <i className={`ti ${TYPES[t].i}`} style={{ fontSize: 12, color: tfilter.has(t) ? "inherit" : TYPES[t].c }} />{TYPES[t].l}
                <span className="n">{cnt(t)}</span>
              </span>
            ))}
          </div>
          {hasFilters ? <span className="sh-clear" onClick={clearFilters}><i className="ti ti-x" style={{ fontSize: 11 }} />Clear</span> : null}
          <div className="sh-pubfilt">
            {(["all", "public", "private"] as const).map((p) => (
              <button key={p} className={pubFilter === p ? "on" : ""} onClick={() => setPubFilter(p)}>
                {p !== "all" ? <span className="dt" style={{ background: p === "public" ? "var(--safe)" : "var(--sub)" }} /> : null}
                {p === "all" ? "All" : p === "public" ? "Public" : "Private"}
              </button>
            ))}
          </div>
          <div className="xseg">
            {SORTS.map((s) => (
              <button key={s.k} className={sort === s.k ? "on" : ""} onClick={() => setSort(s.k)}>{s.l}</button>
            ))}
          </div>
          <span className="sh-srch"><i className="ti ti-search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the shelf" /></span>
        </div>
        <div className="modbody">
          <div className="sh-grid">
            {view.length ? view.slice(0, shown).map((r) => {
              const tk = isType(r.entity_type) ? r.entity_type : "misreading";
              const col = TYPES[tk].c;
              const o = ov(r);
              const href = publicHref(r);
              return (
                <div key={keyOf(r)} className={`sh-card${selKey === keyOf(r) ? " sel" : ""}`} style={{ borderLeftColor: col }}
                  role="button" tabIndex={0} onClick={() => openDetail(r)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); openDetail(r); } }}>
                  <div className="sh-ttag" style={{ color: col }}>
                    <i className={`ti ${TYPES[tk].i} tyi`} />{TYPES[tk].l}
                    <span className={`sh-pubpill${o.pub ? " pub" : ""}`} role="switch" aria-checked={o.pub} tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setPub(r); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setPub(r); } }}
                      title="Toggle public profile visibility">
                      <i className={`ti ${o.pub ? "ti-world" : "ti-lock"}`} />{o.pub ? "Public" : "Private"}
                    </span>
                  </div>
                  <i className={`ti ti-star sh-fav${o.fav ? " on" : ""}`} onClick={(e) => { e.stopPropagation(); setFav(r); }} title="Favorite" />

                  {/* poster-less chip cards by design — no fake covers */}
                  {tk === "film" ? (
                    <>
                      <div className="sh-ftitle">{r.title}</div>
                      <div className="sh-fsub">{r.sub}</div>
                      <div style={{ marginTop: 8 }}>
                        {r.prestige != null ? <span className="sh-chip2">Standing {Math.round(r.prestige)}</span> : null}
                        {r.seen
                          ? <span className="sh-chip2" style={{ color: "var(--safe)", borderColor: "#1d5145", marginLeft: r.prestige != null ? 4 : 0 }}>Seen</span>
                          : null}
                        {r.rating != null ? <span className="sh-chip2" style={{ marginLeft: 4 }}>★{r.rating.toFixed(1)}</span> : null}
                      </div>
                    </>
                  ) : tk === "misreading" ? (
                    <>
                      <div className="sh-quote">&ldquo;{r.sub || r.title}&rdquo;</div>
                      <div className="sh-qmeta">— {r.title}</div>
                      {r.def ? <div className="sh-deftease">{r.def}</div> : null}
                    </>
                  ) : (
                    <>
                      <div className="sh-ftitle">{r.title}</div>
                      <div className="sh-fsub">
                        {tk === "trope"
                          ? <>{r.film_count != null ? `Crosses ${r.film_count} films` : "Trope"}{r.maturity ? ` · ${r.maturity}` : ""}</>
                          : r.sub || "Figure"}
                      </div>
                      {r.def ? <div className="sh-deftease">{r.def}</div> : r.sub && tk === "trope" ? <div className="sh-deftease">{r.sub}</div> : null}
                    </>
                  )}

                  <span className="sh-cfoot">
                    <span className="sh-open"><i className="ti ti-layout-sidebar-right-expand" style={{ fontSize: 11 }} /> Details</span>
                    {href ? (
                      <Link className="sh-view" href={href} onClick={(e) => e.stopPropagation()} title="Open the public page">
                        View page <i className="ti ti-arrow-right" style={{ fontSize: 11 }} />
                      </Link>
                    ) : null}
                  </span>
                </div>
              );
            }) : (
              <div className="sh-empty">
                {hasFilters ? (
                  <>
                    <i className="ti ti-filter-off eico" />
                    <div className="et">Nothing matches these filters</div>
                    <div className="es">Adjust the type or visibility filters, or the search term.</div>
                    <span className="eclr" onClick={clearFilters}><i className="ti ti-x" style={{ fontSize: 11 }} /> Clear all filters</span>
                  </>
                ) : (
                  <>
                    <i className="ti ti-books eico" />
                    <div className="et">Your shelf is empty</div>
                    <div className="es">{STR.empty.shelf}</div>
                  </>
                )}
              </div>
            )}
          </div>
          {view.length > shown ? (
            <div className="pgn">
              <button onClick={() => setShown((s) => s + PAGE)}>{STR.common.loadMore}</button>
              <span className="pc">{shown} / {view.length}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* PUBLIC SHELF — what your profile shows */}
      <div className="mod">
        <div className="modh"><h3><i className="ti ti-world" /> Public shelf</h3><span className="meta">{pubN} public</span></div>
        <div className="modbody">
          {pubList.length ? pubList.map((r) => {
            const tk = isType(r.entity_type) ? r.entity_type : "misreading";
            return (
              <div className="sh-pubitem" key={keyOf(r)}>
                <span className="d" style={{ background: TYPES[tk].c }} />
                <span className="nm" title={r.title ?? ""}>{r.title}</span>
                <i className="ti ti-world ico" title="Public" />
              </div>
            );
          }) : (
            <div style={{ fontSize: 11.5, color: "var(--sub)", padding: "6px 2px" }}>
              Nothing public yet — flip a pin&apos;s <i className="ti ti-lock" /> badge and it shows on your profile.
            </div>
          )}
          <Link className="sh-pubgo" href="/u/me">View your public profile <i className="ti ti-arrow-right" style={{ fontSize: 11 }} /></Link>
        </div>
      </div>
    </div>
  );
}
