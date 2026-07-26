"use client";
/**
 * NavigatorPicker — the destination list. On desktop it is the persistent LEFT
 * rail of the two-pane shell (map on the right); on mobile it is the full-page
 * "Where to?" screen. Lists the journeys the viewer can complete: in-progress
 * director conquests + canon/list lineages (each with a progress ring), plus two
 * computed families — decade TakeScore essentials and the my-subscription list —
 * linking into the drive (?dir= / ?lineage= / ?decade= / ?sub=). Assembled from
 * me_auteur_conquest + me_coverage + the ledger's own seen∩decade counts (decade/
 * sub coverage is only known once the drive loads, so those cards carry a seen
 * hint instead of a ring). `activeKey` marks the destination currently driving.
 *
 * Below the recommended groups sits "All lists" — the full lineage catalog
 * (lineage_index + movements) grouped by facet, searchable. The search box does
 * two things at once: it name-filters the loaded catalog instantly, and it asks
 * /api/navigator/lists for the lineages that CONTAIN a matching film. Every list
 * card links into the drive exactly like the canon cards (?lineage=<slug>).
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

export type PickDest = {
  kind: "dir" | "lineage" | "decade" | "sub";
  key: string;
  label: string;
  facet?: string;
  seen: number;
  total: number;   // 0 → no progress ring (decade/sub: coverage unknown until the drive loads)
  pct: number;
};

/** One row of the full lineage catalog (browse-all). Coverage is optional —
 *  present only for lists the viewer has partial data on (overlaid from me_coverage). */
export type CatalogEntry = {
  slug: string;
  label: string;
  facet: string;
  film_count: number;
  seen?: number;
  total?: number;
  pct?: number;
};

/** Singular facet name, used inside a card's meta line ("Award · 3/12 watched"). */
const FACET_EN: Record<string, string> = {
  canon: "Canon", critics: "Critics' pick", festival: "Festival", award: "Award",
  national: "National canon", movement: "Movement", auteur: "Auteur line",
  section: "Festival section", style: "Style", other: "List",
};
/** Plural facet name, used as an "All lists" section heading. */
const FACET_SECTION: Record<string, string> = {
  canon: "Canon", critics: "Critics' picks", festival: "Festivals", award: "Awards",
  national: "National cinemas", movement: "Movements", auteur: "Auteur lines",
  section: "Festival sections", style: "Styles", other: "Lists",
};
const FACET_ORDER = ["canon", "critics", "festival", "award", "national", "movement", "auteur", "section", "style", "other"];
const PER_FACET = 8;      // cards shown per facet before "Show all"
const NAME_CAP = 30;      // cap on the name-filter result list

/** The stable identity of a destination card — matches `activeKey` from the page. */
export function destKey(d: PickDest): string {
  return `${d.kind}:${d.key}`;
}

function hrefOf(d: PickDest): string {
  const label = `&label=${encodeURIComponent(d.label)}`;
  switch (d.kind) {
    case "dir": return `/room/navigator?dir=${encodeURIComponent(d.key)}`;
    case "lineage": return `/room/navigator?lineage=${encodeURIComponent(d.key)}${label}`;
    case "decade": return `/room/navigator?decade=${encodeURIComponent(d.key)}${label}`;
    case "sub": return `/room/navigator?sub=1${label}`;
  }
}

function metaOf(d: PickDest): string {
  switch (d.kind) {
    case "dir": return `Director · ${d.seen}/${d.total} watched · ${d.total - d.seen} to go`;
    case "lineage": return `${FACET_EN[d.facet ?? "other"] ?? d.facet ?? "List"} · ${d.seen}/${d.total} watched · ${d.total - d.seen} to go`;
    case "decade": return d.seen > 0 ? `Top TakeScore by year · ${d.seen} already logged` : "Top TakeScore by year";
    case "sub": return "Best on your services · before they leave";
  }
}

function card(d: PickDest, activeKey?: string) {
  const ring = d.total > 0;
  const on = activeKey === destKey(d);
  return (
    <Link key={destKey(d)} className={`np-card${on ? " on" : ""}`} href={hrefOf(d)} aria-current={on ? "page" : undefined}>
      {ring ? (
        <span className="np-ring" style={{ ["--p" as string]: `${Math.min(360, d.pct * 3.6)}deg` }}><span>{d.pct}%</span></span>
      ) : null}
      <span className="np-l">
        <span className="np-n">{d.label}</span>
        <span className="np-m">{metaOf(d)}</span>
      </span>
      <span className="np-go">{on ? "Driving" : "Drive →"}</span>
    </Link>
  );
}

/** A browse-all catalog list → the same drive link a canon card uses. Shows a
 *  coverage ring when the viewer has partial data, else the list's film count. */
function catalogCard(c: CatalogEntry, activeKey?: string) {
  const key = `lineage:${c.slug}`;
  const on = activeKey === key;
  const hasCov = typeof c.total === "number" && c.total > 0;
  const facetName = FACET_EN[c.facet] ?? c.facet ?? "List";
  const meta = hasCov
    ? `${facetName} · ${c.seen ?? 0}/${c.total} watched · ${(c.total ?? 0) - (c.seen ?? 0)} to go`
    : `${facetName} · ${c.film_count} film${c.film_count === 1 ? "" : "s"}`;
  const href = `/room/navigator?lineage=${encodeURIComponent(c.slug)}&label=${encodeURIComponent(c.label)}`;
  return (
    <Link key={key} className={`np-card${on ? " on" : ""}`} href={href} aria-current={on ? "page" : undefined}>
      {hasCov ? (
        <span className="np-ring" style={{ ["--p" as string]: `${Math.min(360, (c.pct ?? 0) * 3.6)}deg` }}><span>{c.pct ?? 0}%</span></span>
      ) : null}
      <span className="np-l">
        <span className="np-n">{c.label}</span>
        <span className="np-m">{meta}</span>
      </span>
      <span className="np-go">{on ? "Driving" : "Drive →"}</span>
    </Link>
  );
}

type ApiFilm = { slug: string; title: string; year: number | null };
type ApiList = { slug: string; label: string; facet: string; film_count: number };

export default function NavigatorPicker({
  directors, canon, decades = [], sub = null, catalog = [], activeKey, resume = null,
}: {
  directors: PickDest[];
  canon: PickDest[];
  decades?: PickDest[];
  sub?: PickDest | null;
  catalog?: CatalogEntry[];
  activeKey?: string;
  resume?: { label: string; href: string; kind: string } | null;
}) {
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // film→lists from /api/navigator/lists (debounced)
  const [apiFilm, setApiFilm] = useState<ApiFilm | null>(null);
  const [apiLists, setApiLists] = useState<ApiList[]>([]);
  const acRef = useRef<AbortController | null>(null);

  const query = q.trim();
  const searching = query.length > 0;

  // Catalog grouped by facet, in a stable presentation order.
  const grouped = useMemo(() => {
    const m: Record<string, CatalogEntry[]> = {};
    for (const c of catalog) (m[c.facet] ??= []).push(c);
    for (const k in m) m[k].sort((a, b) => (b.total ?? 0) - (a.total ?? 0) || b.film_count - a.film_count || a.label.localeCompare(b.label));
    const facets = Object.keys(m).sort((a, b) => {
      const ia = FACET_ORDER.indexOf(a), ib = FACET_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    return { m, facets };
  }, [catalog]);

  // Instant client-side name filter over the whole catalog.
  const nameHits = useMemo(() => {
    if (!searching) return [];
    const s = query.toLowerCase();
    return catalog
      .filter((c) => c.label.toLowerCase().includes(s))
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0) || b.film_count - a.film_count || a.label.localeCompare(b.label))
      .slice(0, NAME_CAP);
  }, [catalog, query, searching]);

  // Debounced film→lists lookup. Same-origin fetch (CSP-safe), aborts stale calls.
  useEffect(() => {
    if (query.length < 2) { setApiFilm(null); setApiLists([]); return; }
    const t = setTimeout(async () => {
      acRef.current?.abort();
      const ac = new AbortController();
      acRef.current = ac;
      try {
        const r = await fetch(`/api/navigator/lists?q=${encodeURIComponent(query)}`, { signal: ac.signal });
        if (!r.ok) return;
        const j = (await r.json()) as { films: ApiFilm[]; lists: ApiList[] };
        setApiFilm(j.films?.[0] ?? null);
        setApiLists(j.lists ?? []);
      } catch { /* aborted or offline — keep the instant name filter */ }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const empty = directors.length === 0 && canon.length === 0;

  return (
    <div className="navd np">
      <div className="np-head">
        <div className="np-k">The Navigator</div>
        <h1 className="np-h">Where to?</h1>
        <p className="np-p">Pick a destination and your unwatched films become the route — the Navigator guides your next film, turn by turn.</p>
      </div>
      <div className="np-body">
        <input
          className="np-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search lists — or a film, to find the lists it's on…"
          aria-label="Search lists or a film"
        />

        {searching ? (
          <>
            {apiFilm && apiLists.length ? (
              <>
                <div className="np-sect">
                  Lists containing “{apiFilm.title}{apiFilm.year ? ` (${apiFilm.year})` : ""}”
                </div>
                {apiLists.map((l) => catalogCard({ slug: l.slug, label: l.label, facet: l.facet, film_count: l.film_count }, activeKey))}
              </>
            ) : null}
            <div className="np-sect">
              {nameHits.length ? `Lists matching “${query}”` : `No lists match “${query}”`}
            </div>
            {nameHits.map((c) => catalogCard(c, activeKey))}
            {!nameHits.length && !(apiFilm && apiLists.length) ? (
              <div className="np-emptycard">Nothing found. Try a country, movement, award, canon — or a film title.</div>
            ) : null}
          </>
        ) : (
          <>
            {resume ? (
              <Link className="np-resume" href={resume.href}>
                <span className="np-resume-ic">▶</span>
                <span className="np-resume-l">
                  <span className="np-resume-k">Continue your drive</span>
                  <span className="np-resume-n">{resume.label}</span>
                </span>
                <span className="np-resume-go">Resume →</span>
              </Link>
            ) : null}
            {empty ? (
              <div className="np-emptycard">
                No journeys in progress yet. <Link href="/room/ledger" className="np-lnk">Log</Link> a few films or{" "}
                <Link href="/me/import" className="np-lnk">import</Link> your history, and canon &amp; director destinations appear here.{" "}
                <Link href="/room/navigator?dir=stanley-kubrick" className="np-lnk">Try Kubrick →</Link>
              </div>
            ) : null}
            {directors.length ? (
              <>
                <div className="np-sect">Director conquests — pick up where you left off</div>
                {directors.map((d) => card(d, activeKey))}
              </>
            ) : null}
            {canon.length ? (
              <>
                <div className="np-sect">Canon &amp; lists in progress</div>
                {canon.map((d) => card(d, activeKey))}
              </>
            ) : null}
            {decades.length ? (
              <>
                <div className="np-sect">By decade</div>
                {decades.map((d) => card(d, activeKey))}
              </>
            ) : null}
            {sub ? (
              <>
                <div className="np-sect">Your subscriptions</div>
                {card(sub, activeKey)}
              </>
            ) : null}

            {grouped.facets.length ? (
              <>
                <div className="np-allhead">All lists</div>
                {grouped.facets.map((f) => {
                  const rows = grouped.m[f];
                  const open = expanded[f];
                  const shown = open ? rows : rows.slice(0, PER_FACET);
                  return (
                    <div key={f}>
                      <div className="np-sect">{FACET_SECTION[f] ?? f} <span className="np-sect-n">{rows.length}</span></div>
                      {shown.map((c) => catalogCard(c, activeKey))}
                      {rows.length > PER_FACET ? (
                        <button
                          type="button"
                          className="np-more"
                          onClick={() => setExpanded((e) => ({ ...e, [f]: !open }))}
                        >
                          {open ? "Show fewer" : `Show all ${rows.length} →`}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
