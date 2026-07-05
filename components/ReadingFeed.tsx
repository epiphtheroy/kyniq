"use client";

/**
 * ReadingFeed — Strong Misreadings browse for one framework (or "all").
 * - typeahead suggestions (trigram) as you type
 * - semantic search results (embeddings) when a query is present
 * - rotating random "featured" cards under the search
 * - decade facet + sort; infinite scroll; right-side film thumbnail per row
 * Classes are `smb-*` to stay isolated from the film page's bold-take `sm-*`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fw } from "@/lib/frameworks";
import SaveChip from "@/components/SaveChip";
import { useLens } from "@/components/LensProvider";

const W185 = "https://image.tmdb.org/t/p/w185";

export type FeedRow = {
  id: string; tt: string | null; fw: string; snip: string;
  fig: string; figslug: string | null; film: string; filmslug: string; year: number | null;
  bd: string | null; poster: string | null;
  trope: string | null; tropeslug: string | null; sim?: number;
};
export type Facets = {
  total: number;
  decades: { d: number; n: number }[];
  top_tropes: { slug: string; title: string; n: number }[];
};
type Init = { total: number; rows: FeedRow[] };
type Suggestion = { tt: string; film: string; filmslug: string; figslug: string | null };

const LIMIT = 24;
const SORTS: [string, string][] = [
  ["film", "Film A–Z"], ["year_desc", "Newest film"], ["year_asc", "Oldest film"],
  ["bold", "Boldest"], ["recent", "Just added"],
];

function thumb(r: { bd: string | null; poster: string | null }) {
  return r.bd ? `${W185}${r.bd}` : r.poster ? `${W185}${r.poster}` : null;
}
function figHref(r: { filmslug: string; figslug: string | null }) {
  return r.figslug ? `/film/${r.filmslug}/figure/${r.figslug}` : `/film/${r.filmslug}`;
}

export default function ReadingFeed(
  { fwSlug, isAll, initial, facets }: { fwSlug: string; isAll: boolean; initial: Init; facets: Facets }
) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("film");
  const [decade, setDecade] = useState<number | null>(null);
  const [rows, setRows] = useState<FeedRow[]>(initial.rows);
  const [total, setTotal] = useState(initial.total);
  const [offset, setOffset] = useState(initial.rows.length);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(initial.rows.length >= initial.total);
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [sugOpen, setSugOpen] = useState(false);
  const [featured, setFeatured] = useState<FeedRow[]>([]);
  const [fIdx, setFIdx] = useState(0);

  const pristine = useRef(true);
  const sentinel = useRef<HTMLDivElement>(null);
  const debTimer = useRef<number | undefined>(undefined);
  const searching = q.trim().length > 0;

  // My Films lens, only-mode: the whole endless feed swaps its data source to
  // the authed per-user endpoint — every page of scroll is readings of films
  // you've seen. (Search stays global; highlight-mode keeps the visual overlay.)
  const lens = useLens();
  const mine = !!lens && lens.mode === "only" && lens.seenCount > 0;

  const buildUrl = useCallback((off: number) => {
    const p = new URLSearchParams();
    p.set("fw", fwSlug);
    if (q) p.set("q", q);
    if (!q && sort) p.set("sort", sort);
    if (decade != null) p.set("decade", String(decade));
    p.set("limit", String(LIMIT));
    p.set("offset", String(off));
    return `${mine && !q ? "/api/lens/readings" : "/api/readings"}?${p.toString()}`;
  }, [fwSlug, q, sort, decade, mine]);

  // featured rotator — fetch a batch once, cycle 3 at a time
  useEffect(() => {
    fetch(`/api/readings/featured?fw=${encodeURIComponent(fwSlug)}&n=12`)
      .then((r) => r.json()).then((d) => setFeatured((d.rows ?? []) as FeedRow[])).catch(() => {});
  }, [fwSlug]);
  useEffect(() => {
    if (featured.length <= 3) return;
    const t = window.setInterval(() => setFIdx((i) => (i + 3) % featured.length), 5000);
    return () => window.clearInterval(t);
  }, [featured]);

  // results: refetch page 0 on query/sort/decade change (skip first render —
  // SSR seeded — unless the lens is already in only-mode, whose rows are per-user)
  useEffect(() => {
    if (pristine.current) { pristine.current = false; if (!mine) return; }
    let cancelled = false;
    setLoading(true);
    fetch(buildUrl(0)).then((r) => r.json()).then((d) => {
      if (cancelled) return;
      const rs: FeedRow[] = d.rows ?? [];
      setRows(rs); setTotal(d.total ?? 0); setOffset(rs.length);
      setDone(rs.length < LIMIT); setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [buildUrl]);

  // infinite scroll
  useEffect(() => {
    const el = sentinel.current; if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !loading && !done) {
          setLoading(true);
          fetch(buildUrl(offset)).then((r) => r.json()).then((d) => {
            const rs: FeedRow[] = d.rows ?? [];
            setRows((prev) => [...prev, ...rs]);
            setOffset((o) => o + rs.length);
            setDone(rs.length < LIMIT);
            setLoading(false);
          }).catch(() => setLoading(false));
        }
      });
    }, { rootMargin: "700px" });
    io.observe(el);
    return () => io.disconnect();
  }, [buildUrl, offset, loading, done]);

  // typeahead + query (one debounce drives both suggestions and the semantic search)
  const onType = (v: string) => {
    setDraft(v);
    window.clearTimeout(debTimer.current);
    debTimer.current = window.setTimeout(() => {
      const term = v.trim();
      setQ(term);
      if (term.length >= 2) {
        fetch(`/api/readings/suggest?fw=${encodeURIComponent(fwSlug)}&q=${encodeURIComponent(term)}`)
          .then((r) => r.json()).then((d) => { setSugs((d.rows ?? d) as Suggestion[]); setSugOpen(true); }).catch(() => {});
      } else { setSugs([]); setSugOpen(false); }
    }, 280);
  };
  const clearSearch = () => { setDraft(""); setQ(""); setSugs([]); setSugOpen(false); };

  const fcards = featured.length ? Array.from({ length: Math.min(3, featured.length) }, (_, k) => featured[(fIdx + k) % featured.length]) : [];

  return (
    <>
      {/* search + typeahead */}
      <div className="smb-searchwrap">
        <input
          className="smb-search" type="search" value={draft}
          placeholder={isAll ? "Search all Strong Misreadings…" : "Search these readings…"}
          onChange={(e) => onType(e.target.value)}
          onFocus={() => { if (sugs.length) setSugOpen(true); }}
          onBlur={() => window.setTimeout(() => setSugOpen(false), 150)}
          aria-label="Search readings"
        />
        {draft ? <button className="smb-clear" onClick={clearSearch} aria-label="Clear">×</button> : null}
        {sugOpen && sugs.length > 0 && (
          <ul className="smb-sugs">
            {sugs.map((s, i) => (
              <li key={i}>
                <button className="smb-sug" onMouseDown={(e) => { e.preventDefault(); router.push(figHref(s)); }}>
                  <span className="smb-sug__tt">{s.tt}</span>
                  <span className="smb-sug__film">{s.film}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* rotating featured examples */}
      {!searching && fcards.length > 0 && (
        <div className="smb-feat">
          <div className="smb-feat__lbl">Dip in —</div>
          <div className="smb-feat__row">
            {fcards.map((r) => {
              const F = fw(r.fw); const im = thumb(r);
              return (
                <Link key={r.id} className="smb-fcard" href={figHref(r)}>
                  {im ? /* eslint-disable-next-line @next/next/no-img-element */ <img className="smb-fcard__img" src={im} alt="" loading="lazy" /> : <span className="smb-fcard__img smb-fcard__img--blank" />}
                  <span className="smb-fcard__body">
                    <span className="smb-fcard__fw" style={{ color: F.color }}>{F.label}</span>
                    <span className="smb-fcard__tt">{r.tt ?? r.fig}</span>
                    <span className="smb-fcard__film">{r.film}{r.year ? ` (${r.year})` : ""}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* controls */}
      <div className="smb-controls">
        {!searching && (
          <label className="smb-sortwrap">Sort
            <select className="smb-sort" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        )}
        {facets.decades.length > 0 && (
          <div className="smb-decades">
            <button className={`smb-chip${decade === null ? " on" : ""}`} onClick={() => setDecade(null)}>All years</button>
            {facets.decades.map((d) => (
              <button key={d.d} className={`smb-chip${decade === d.d ? " on" : ""}`}
                onClick={() => setDecade(decade === d.d ? null : d.d)}>{d.d}s <span className="n">{d.n}</span></button>
            ))}
          </div>
        )}
      </div>

      <div className="smb-count">
        {searching
          ? <>Closest matches for <b>“{q}”</b></>
          : mine
          ? <><b>{total.toLocaleString()}</b> {total === 1 ? "reading" : "readings"} from films you&rsquo;ve seen{decade != null ? ` · ${decade}s` : ""}</>
          : <><b>{total.toLocaleString()}</b> {total === 1 ? "reading" : "readings"}{decade != null ? ` · ${decade}s` : ""}</>}
      </div>

      <ul className="smb-list">
        {rows.map((r) => {
          const F = fw(r.fw); const href = figHref(r); const im = thumb(r);
          return (
            <li className="smb-row" key={r.id}>
              <div className="smb-row__col">
                <Link className="smb-row__main" href={href}>
                  <span className="smb-row__top">
                    {isAll ? <span className="smb-row__fw" style={{ color: F.color }}>{F.label}</span> : null}
                    <span className="smb-row__film">{r.film}</span>
                    {r.year ? <span className="smb-row__yr">({r.year})</span> : null}
                    <span className="smb-row__via">via {r.fig}</span>
                  </span>
                  <span className="smb-row__tt">{r.tt ?? r.fig}<span className="arr"> →</span></span>
                  {r.snip ? <span className="smb-row__snip">{r.snip}…</span> : null}
                </Link>
                {r.trope && r.tropeslug ? <Link className="smb-row__trope" href={`/trope/${r.tropeslug}`}># {r.trope}</Link> : null}
                <div className="smb-row__act"><SaveChip entityType="take" entityRef={r.id} /></div>
              </div>
              {im ? (
                <Link className="smb-row__thumb" href={href} aria-hidden="true" tabIndex={-1}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im} alt="" loading="lazy" />
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>

      {rows.length === 0 && !loading ? (
        <p className="smb-empty">{mine && !searching ? "No readings from your films here yet — switch the lens to All to browse everything." : "No readings match that."}</p>
      ) : null}
      {!done ? <div className="smb-loader" ref={sentinel}>{loading ? "Loading…" : "Scroll for more"}</div>
             : rows.length > 0 && !searching ? <div className="smb-end">— all {total.toLocaleString()} shown —</div> : null}
    </>
  );
}
