"use client";
/* eslint-disable @next/next/no-img-element */

import { Fragment, useEffect, useReducer, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArtistData, Award, Collab, CraftKey, CrewEntry, CreditsPayload, TFilm,
  CRAFTS, FAM, GRP2CRAFT,
  buildTabs, computeArtist, fmtV, img, personSlug, primeCredits, styleFor, wdAwards, yrsFmt,
} from "./credits-logic";

/* ---------- bridges to Metatake's own pages (film/director slugs) ---------- */
type MetaLinks = { filmSlug: string | null; filmTitle: string | null; directorSlug: string | null; directorName: string | null; native?: string | null };
const linksCache = new Map<string, MetaLinks | null>();
function useMetaLinks(query: string | null): MetaLinks | null {
  const [links, setLinks] = useState<MetaLinks | null>(query ? linksCache.get(query) ?? null : null);
  useEffect(() => {
    let dead = false;
    if (!query) { setLinks(null); return; }
    const hit = linksCache.get(query);
    if (hit !== undefined) { setLinks(hit); return; }
    setLinks(null);
    fetch(`/api/credits/links?${query}`)
      .then((r) => (r.ok ? (r.json() as Promise<MetaLinks>) : null))
      .then((j) => { linksCache.set(query, j); if (!dead) setLinks(j); })
      .catch(() => { if (!dead) setLinks(null); });
    return () => { dead = true; };
  }, [query]);
  return links;
}
// The canonical Metatake page for a person seen in the explorer: directors go
// to /director/[slug] (their editorial home); every key-craft person has a
// /credits/[person] read page.
function personHref(name: string, id: number, isDirector: boolean, directorSlug: string | null): string | null {
  if (isDirector) return directorSlug ? `/director/${directorSlug}` : null;
  return `/credits/${personSlug(name, id)}`;
}

/* Exit buttons from the explorer to Metatake's own pages — deliberately
   button-shaped, not text links: the generated views must always offer a
   visible way out to the real (indexable) pages. */
const PILL: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, background: "#16233F", color: "#FBF8F1",
  padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, textDecoration: "none", lineHeight: 1,
};
const PILL_OUTLINE: CSSProperties = {
  ...PILL, background: "transparent", color: "#16233F", boxShadow: "inset 0 0 0 1.5px #16233F",
};
function ExitPill({ href, children, outline = false }: { href: string; children: ReactNode; outline?: boolean }) {
  return (
    <a href={href} style={outline ? PILL_OUTLINE : PILL}>
      <span aria-hidden style={{ color: "#E0922A" }}>◉</span>
      {children}
    </a>
  );
}

/* ---------- proxy fetcher ---------- */
async function api(path: string, params?: Record<string, string>): Promise<unknown> {
  const u = new URLSearchParams({ p: path, ...(params || {}) });
  const r = await fetch(`/api/credits?${u.toString()}`);
  if (!r.ok) {
    const msg = r.status === 404 ? "Not found on TMDB." : `The credits service answered ${r.status}. Try again in a moment.`;
    throw new Error(msg);
  }
  return r.json();
}

/* ---------- film nav ---------- */
interface FilmMeta { id: number; title: string; year: string; poster: string | null; backdrop: string | null; director: string | null; }
interface Tab { craft: CraftKey; people: CrewEntry[]; }
interface NavState { film: FilmMeta; tabs: Tab[]; active: CraftKey; }

const filmNavCache = new Map<number, { film: FilmMeta; tabs: Tab[] }>();
async function loadFilmNav(fid: number): Promise<{ film: FilmMeta; tabs: Tab[] }> {
  const hit = filmNavCache.get(fid);
  if (hit) return hit;
  const d = (await api(`/movie/${fid}`)) as {
    id: number; title: string; release_date?: string; poster_path: string | null;
    backdrop_path: string | null; credits?: CreditsPayload;
  };
  const credits = d.credits || {};
  primeCredits(fid, credits);
  const director = (credits.crew || []).find((c) => c.job === "Director")?.name ?? null;
  const out = {
    film: { id: fid, title: d.title, year: (d.release_date || "").slice(0, 4), poster: d.poster_path, backdrop: d.backdrop_path, director },
    tabs: buildTabs(credits.crew || []),
  };
  filmNavCache.set(fid, out);
  return out;
}

/* ---------- seen tracker (quiet, localStorage only) ---------- */
let SEEN = new Set<number>();
let seenLoaded = false;
function hydrateSeen() {
  if (seenLoaded || typeof window === "undefined") return;
  seenLoaded = true;
  try { SEEN = new Set(JSON.parse(localStorage.getItem("mt_seen") || "[]") as number[]); } catch { /* fresh */ }
}
function persistSeen() {
  try { localStorage.setItem("mt_seen", JSON.stringify([...SEEN])); } catch { /* private mode */ }
}

/* ============================================================ */

export default function CreditsExplorer({
  embed = false,
  initialP,
  initialC,
  initialD,
}: {
  // Embed mode (person/director pages): navigation is component state instead
  // of the URL, so following the credits never leaves the page underneath.
  // initialD seeds by name (director pages); initialP/initialC by TMDB id.
  embed?: boolean;
  initialP?: number;
  initialC?: CraftKey;
  initialD?: string;
} = {}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [local, setLocal] = useState<{ f: number | null; p: number | null; c: CraftKey | null; d: string | null }>(
    { f: null, p: initialP ?? null, c: initialC ?? null, d: initialP ? null : initialD ?? null },
  );
  // The page's own subject — their profile box is redundant with the server
  // header above the embed, so ArtistView hides it for this id only.
  const homePidRef = useRef<number | null>(initialP ?? null);
  const fParam = embed ? (local.f != null ? String(local.f) : null) : sp.get("f");
  const pParam = embed ? (local.p != null ? String(local.p) : null) : sp.get("p");
  const cParam = embed ? local.c : sp.get("c");
  const dParam = embed ? local.d : sp.get("d");

  const [nav, setNav] = useState<NavState | null>(null);
  const [artist, setArtist] = useState<ArtistData | null>(null);
  const [emptyMsg, setEmptyMsg] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dossier, setDossier] = useState<Collab | null>(null);
  const seqRef = useRef(0);
  const [, bump] = useReducer((x: number) => x + 1, 0);

  useEffect(() => { hydrateSeen(); bump(); }, []);

  const navFilm = (id: number) => {
    if (embed) setLocal({ f: id, p: null, c: null, d: null });
    else router.push(`/credits?f=${id}`);
  };
  const navArtist = (pid: number, craft: CraftKey, fid?: number | null) => {
    if (embed) setLocal({ f: fid ?? null, p: pid, c: craft, d: null });
    else router.push(`/credits?p=${pid}&c=${craft}${fid ? `&f=${fid}` : ""}`);
  };
  const toggleSeen = (id: number) => {
    if (SEEN.has(id)) SEEN.delete(id); else SEEN.add(id);
    persistSeen(); bump();
  };

  useEffect(() => {
    const seq = ++seqRef.current;
    setDossier(null); setError(null); setEmptyMsg(null);
    const run = async () => {
      try {
        if (pParam) {
          const pid = +pParam;
          const craft: CraftKey = (cParam && cParam in CRAFTS ? cParam : "dir") as CraftKey;
          if (fParam) {
            const navData = await loadFilmNav(+fParam);
            if (seq !== seqRef.current) return;
            setNav({ ...navData, active: craft });
          } else setNav(null);
          setArtist(null); setStatus("Reading the filmography…");
          const S = await computeArtist(api, pid, craft, (msg) => { if (seq === seqRef.current) setStatus(msg); });
          if (seq !== seqRef.current) return;
          setStatus(null);
          if ("empty" in S) setEmptyMsg(S.empty); else setArtist(S);
        } else if (fParam) {
          setArtist(null); setNav(null); setStatus("Reading the credits…");
          const navData = await loadFilmNav(+fParam);
          if (seq !== seqRef.current) return;
          if (!navData.tabs.length) {
            setStatus(null);
            setEmptyMsg("No head-of-department credits on TMDB for this title. That's the archive, not the film.");
            return;
          }
          const first = navData.tabs[0];
          setNav({ ...navData, active: first.craft });
          setStatus("Reading the filmography…");
          const S = await computeArtist(api, first.people[0].id, first.craft, (msg) => { if (seq === seqRef.current) setStatus(msg); });
          if (seq !== seqRef.current) return;
          setStatus(null);
          if ("empty" in S) setEmptyMsg(S.empty); else setArtist(S);
        } else if (dParam) {
          // Director-page entry: resolve a name to a TMDB person, then canonicalise the URL.
          setNav(null); setArtist(null); setStatus("Finding them in the credits…");
          const j = (await api("/search/person", { query: dParam })) as { results?: Array<{ id: number; name: string; known_for_department?: string | null }> };
          if (seq !== seqRef.current) return;
          const rs = j.results || [];
          const hit = rs.find((r) => r.known_for_department === "Directing") || rs[0];
          if (!hit) {
            setStatus(null);
            setEmptyMsg(`No one by that name in the credits on TMDB. That's the archive, not the person.`);
            return;
          }
          if (embed) {
            if (homePidRef.current == null) homePidRef.current = hit.id;
            setLocal({ f: null, p: hit.id, c: "dir", d: null });
          } else router.replace(`/credits?p=${hit.id}&c=dir`);
        } else {
          setNav(null); setArtist(null); setStatus(null);
        }
      } catch (e) {
        if (seq === seqRef.current) {
          setStatus(null);
          setError(e instanceof Error ? e.message : "Something went wrong.");
        }
      }
    };
    void run();
    if (!embed && (fParam || pParam || dParam)) window.scrollTo({ top: 0, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fParam, pParam, cParam, dParam]);

  return (
    <div className="cr-wrap">
      {!fParam && !pParam && !dParam ? (
        <header className="cr-hero">
          <div className="cr-eyebrow">A Metatake experiment · 크레딧 탐험</div>
          <h1 className="cr-h1">Follow the credits.</h1>
          <p className="cr-lede">
            Every film is signed by more than its director. Pick the craft that moved you — the light, the cut,
            the score, the rooms — and follow its author through a whole body of work: where to begin, the
            essentials, the B-sides, and the repertory company they keep.
          </p>
        </header>
      ) : null}

      {/* Embed: the host page is the entry point — no search chrome. */}
      {!embed ? <SearchBox onPick={navFilm} onPickPerson={(pid, craft) => navArtist(pid, craft, null)} /> : null}

      {nav ? <FilmTabs nav={nav} onTab={(craft, pid) => navArtist(pid, craft, nav.film.id)} /> : null}
      {status ? <div className="cr-status"><span className="cr-spin" aria-hidden />{status}</div> : null}
      {error ? <div className="cr-error">{error}</div> : null}
      {emptyMsg ? <div className="cr-empty">{emptyMsg}</div> : null}

      {artist && !status ? (
        <ArtistView
          S={artist} nav={nav}
          hideProfile={embed && homePidRef.current != null && artist.person.id === homePidRef.current}
          onFilm={navFilm} onArtist={navArtist} onDossier={setDossier}
          isSeen={(id) => SEEN.has(id)} toggleSeen={toggleSeen}
        />
      ) : null}

      {dossier && artist ? (
        <Dossier o={dossier} S={artist} onClose={() => setDossier(null)} onFilm={navFilm} onArtist={navArtist} />
      ) : null}

      <footer className="cr-method">
        <b>Method.</b> Rankings use a Bayesian weighted consensus: each film&apos;s rating is shrunk toward the
        artist&apos;s own average in proportion to how few ratings it has. Popularity is never used, for anything.
        Collaboration counts are exact within the analysed corpus and are labelled &ldquo;of N films&rdquo; whenever the
        corpus is a sample. Sparse crew data on older or non-English titles means <i>unknown</i>, not <i>none</i> —
        that&apos;s the archive, not the career. This page uses the TMDB API but is not endorsed or certified by TMDB.
        Awards: Wikidata (CC0). Watched-marks live only in this browser.
      </footer>
    </div>
  );
}

/* ============ search — films + people, with fuzzy fallback ============ */
type SearchRow =
  | { kind: "film"; id: number; title: string; year: string; poster: string | null }
  | { kind: "person"; id: number; name: string; craft: CraftKey; img: string | null };
const SAMPLES = ["In the Mood for Love", "Blade Runner 2049", "Parasite", "There Will Be Blood", "Raging Bull", "The Grand Budapest Hotel", "Oldboy", "The Tree of Life"];
const DEPT2CRAFT: Partial<Record<string, CraftKey>> = {
  Directing: "dir", Writing: "writer", Camera: "dp", Editing: "editor", Sound: "composer", Art: "pd",
};
const cleanQuery = (s: string) => s.replace(/['’´`".,:;!?()[\]]/g, " ").replace(/\s+/g, " ").trim();

async function searchBoth(q: string): Promise<SearchRow[]> {
  const [mv, pp] = await Promise.all([
    api("/search/movie", { query: q }) as Promise<{ results?: Array<{ id: number; title: string; release_date?: string; poster_path: string | null }> }>,
    api("/search/person", { query: q }) as Promise<{ results?: Array<{ id: number; name: string; known_for_department?: string | null; profile_path: string | null }> }>,
  ]);
  const films: SearchRow[] = (mv.results || []).slice(0, 6)
    .map((m) => ({ kind: "film" as const, id: m.id, title: m.title, year: (m.release_date || "").slice(0, 4), poster: m.poster_path }));
  const people: SearchRow[] = (pp.results || [])
    .filter((p) => p.known_for_department && DEPT2CRAFT[p.known_for_department])
    .slice(0, 4)
    .map((p) => ({ kind: "person" as const, id: p.id, name: p.name, craft: DEPT2CRAFT[p.known_for_department as string] as CraftKey, img: p.profile_path }));
  return [...films, ...people];
}

/* Progressive fuzzy fallback: exact → punctuation-stripped → last-token dropped (typo tolerance). */
async function searchFuzzy(s: string): Promise<SearchRow[]> {
  let out = await searchBoth(s);
  if (!out.length) {
    const c = cleanQuery(s);
    if (c && c.toLowerCase() !== s.toLowerCase()) out = await searchBoth(c);
  }
  if (!out.length) {
    const toks = cleanQuery(s).split(" ");
    if (toks.length >= 2) out = await searchBoth(toks.slice(0, -1).join(" "));
  }
  return out;
}

function SearchBox({ onPick, onPickPerson }: { onPick: (id: number) => void; onPickPerson: (pid: number, craft: CraftKey) => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SearchRow[] | null>(null);
  const [sel, setSel] = useState(-1);
  const seqRef = useRef(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = q.trim();
    setSel(-1);
    if (s.length < 2) { setRows(null); return; }
    const seq = ++seqRef.current;
    const t = setTimeout(async () => {
      try {
        const out = await searchFuzzy(s);
        if (seq !== seqRef.current) return;
        setRows(out);
      } catch { if (seq === seqRef.current) setRows([]); }
    }, 280);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setRows(null); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const pick = (row: SearchRow) => {
    setRows(null); setQ("");
    if (row.kind === "film") onPick(row.id); else onPickPerson(row.id, row.craft);
  };
  const pickSample = async (title: string) => {
    try {
      const j = (await api("/search/movie", { query: title })) as { results?: Array<{ id: number }> };
      if (j.results && j.results[0]) onPick(j.results[0].id);
    } catch { /* ignore */ }
  };

  const firstPersonIdx = rows ? rows.findIndex((r) => r.kind === "person") : -1;

  return (
    <div className="cr-search">
      <div className="cr-searchbox" ref={boxRef}>
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search a film — or a cinematographer, editor, composer…"
          aria-label="Film or person search" autoComplete="off"
          onKeyDown={(e) => {
            if (!rows?.length) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, rows.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            else if (e.key === "Enter" && sel >= 0) { e.preventDefault(); pick(rows[sel]); }
            else if (e.key === "Escape") setRows(null);
          }}
        />
        {rows ? (
          <div className="cr-dd" role="listbox">
            {rows.length ? rows.map((r, i) => (
              <Fragment key={`${r.kind}-${r.id}`}>
                {i === 0 && r.kind === "film" ? <div className="cr-dd-h" role="presentation">Films</div> : null}
                {i === firstPersonIdx ? <div className="cr-dd-h" role="presentation">People · 사람으로 바로</div> : null}
                {r.kind === "film" ? (
                  <button type="button" role="option" aria-selected={i === sel}
                    className={`cr-drow${i === sel ? " is-sel" : ""}`} onClick={() => pick(r)}>
                    {r.poster ? <img alt="" src={img(r.poster, "w92") || undefined} /> : <span className="cr-drow-ph" />}
                    <span><b>{r.title}</b> <span className="cr-dim">{r.year}</span></span>
                  </button>
                ) : (
                  <button type="button" role="option" aria-selected={i === sel}
                    className={`cr-drow is-p${i === sel ? " is-sel" : ""}`} onClick={() => pick(r)}>
                    {r.img ? <img alt="" src={img(r.img, "w185") || undefined} /> : <span className="cr-drow-ph is-p" />}
                    <span><b>{r.name}</b> <span className="cr-dim">{CRAFTS[r.craft].label}</span></span>
                  </button>
                )}
              </Fragment>
            )) : <div className="cr-drow cr-dim" role="presentation">No results — try fewer words or the original title.</div>}
          </div>
        ) : null}
      </div>
      <div className="cr-chips">
        <span className="cr-chips-lbl">Try</span>
        {SAMPLES.map((t) => (
          <button key={t} type="button" className="cr-chip" onClick={() => void pickSample(t)}>{t}</button>
        ))}
      </div>
    </div>
  );
}

/* ============ film tabs ============ */
function FilmTabs({ nav, onTab }: { nav: NavState; onTab: (craft: CraftKey, pid: number) => void }) {
  const f = nav.film;
  const links = useMetaLinks(`film=${f.id}`);
  // Film not in the catalog (or missing a director slug)? The director may
  // still have a Metatake page — resolve by the name TMDB's credits carry.
  const dirFallback = useMetaLinks(
    links && !links.directorSlug && f.director ? `person=${encodeURIComponent(f.director)}` : null,
  );
  const directorSlug = links?.directorSlug ?? dirFallback?.directorSlug ?? null;
  const directorName = links?.directorName ?? dirFallback?.directorName ?? f.director;
  return (
    <div className="cr-filmnav">
      <div className="cr-fhead">
        {f.poster ? <img alt="" src={img(f.poster, "w185") || undefined} /> : null}
        <div>
          <h2 className="cr-ftitle">{f.title} <span className="cr-dim">{f.year}</span></h2>
          <div className="cr-fsub">Whose film was it, for you? Follow that credit.</div>
          {links?.filmSlug || directorSlug ? (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
              {links?.filmSlug ? <ExitPill href={`/film/${links.filmSlug}`}>Read {f.title} on Metatake →</ExitPill> : null}
              {directorSlug ? <ExitPill href={`/director/${directorSlug}`} outline>Director: {directorName} →</ExitPill> : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className="cr-tabs" role="tablist">
        {nav.tabs.map((t) => {
          const cf = CRAFTS[t.craft]; const p = t.people[0]; const on = t.craft === nav.active;
          return (
            <button key={t.craft} type="button" role="tab" aria-selected={on} className={`cr-tab${on ? " is-on" : ""}`}
              onClick={() => onTab(t.craft, p.id)}>
              {p.profile_path
                ? <img alt="" src={img(p.profile_path, "w185") || undefined} />
                : <span className="cr-tab-ph">{cf.role[0]}</span>}
              <span className="cr-tab-txt">
                <span className="cr-tab-l">{cf.label} {cf.kr}</span>
                <span className="cr-tab-n">{p.name}{t.people.length > 1 ? <span className="cr-tab-plus">+{t.people.length - 1}</span> : null}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============ artist page ============ */
interface ViewProps {
  S: ArtistData; nav: NavState | null;
  hideProfile?: boolean;
  onFilm: (id: number) => void;
  onArtist: (pid: number, craft: CraftKey, fid?: number | null) => void;
  onDossier: (o: Collab) => void;
  isSeen: (id: number) => boolean; toggleSeen: (id: number) => void;
}

function ScoreTag({ f }: { f: TFilm }) {
  return f.WR != null
    ? <><span className="cr-score" title="Bayesian weighted consensus">{f.WR.toFixed(2)}</span> <span className="cr-dim">· {fmtV(f.v)} ratings</span></>
    : <span className="cr-dim">unrated</span>;
}

function PCard({ f, num, onFilm, isSeen, toggleSeen }: { f: TFilm; num?: number } & Pick<ViewProps, "onFilm" | "isSeen" | "toggleSeen">) {
  return (
    <div className="cr-pcard" role="link" tabIndex={0}
      onClick={() => onFilm(f.id)}
      onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onFilm(f.id); } }}>
      <button type="button" className={`cr-seenb${isSeen(f.id) ? " is-on" : ""}`} aria-label="Mark as watched"
        title="Mark as watched (stays in this browser)"
        onClick={(e) => { e.stopPropagation(); toggleSeen(f.id); }}>✓</button>
      {f.poster ? <img className="cr-po" alt={f.title} loading="lazy" src={img(f.poster, "w342") || undefined} /> : <div className="cr-po" />}
      <div className="cr-cap">
        {num ? <div className="cr-num">{String(num).padStart(2, "0")}</div> : null}
        <div className="cr-tt">{f.title}</div>
        <div className="cr-mm">{f.year || ""} · <ScoreTag f={f} /></div>
      </div>
    </div>
  );
}

function CollabCard({ o, onDossier }: { o: Collab; onDossier: (o: Collab) => void }) {
  const color = FAM[o.grp].color;
  return (
    <button type="button" className="cr-collab" onClick={() => onDossier(o)}>
      {o.img ? <img className="cr-face" alt="" src={img(o.img, "w185") || undefined} /> : <span className="cr-face cr-face-ph">·</span>}
      <span className="cr-cwrap">
        <span className="cr-cn">
          {o.name}
          {o.reunion ? (
            <span className="cr-reunion" title={`First film together since ${o.reunion.afterTitle} (${o.reunion.afterYear}) — ${o.reunion.gapFilms} films and ${o.reunion.gapYears} years apart`}>
              reunited
            </span>
          ) : null}
        </span>
        <span className="cr-cd"><b style={{ color }}>×{o.count}</b> films · {o.primary} · {yrsFmt(o.y0, o.y1)}</span>
        <span className="cr-cfilms">
          {o.filmsArr.slice(0, 8).map((f) =>
            f.poster
              ? <img key={f.id} title={`${f.title} (${f.year})`} alt="" loading="lazy" src={img(f.poster, "w92") || undefined} />
              : <span key={f.id} className="cr-pox" title={`${f.title} (${f.year})`} />)}
          {o.filmsArr.length > 8 ? <span className="cr-dim cr-more">+{o.filmsArr.length - 8}</span> : null}
        </span>
        <span className="cr-doss">Open the dossier →</span>
      </span>
    </button>
  );
}

function AwardsBox({ imdbId }: { imdbId: string | null | undefined }) {
  const [state, setState] = useState<"loading" | "none" | "error" | "nolink" | Award[]>("loading");
  useEffect(() => {
    let alive = true;
    if (!imdbId || !/^(nm|tt|co)\d+$/.test(imdbId)) { setState("nolink"); return; }
    setState("loading");
    wdAwards(imdbId)
      .then((items) => { if (alive) setState(items.length ? items : "none"); })
      .catch(() => { if (alive) setState("error"); });
    return () => { alive = false; };
  }, [imdbId]);
  if (state === "loading") return <div className="cr-dim"><span className="cr-spin" aria-hidden />Looking up the record…</div>;
  if (state === "nolink") return <div className="cr-dim">No IMDb link on record — awards can&apos;t be looked up.</div>;
  if (state === "none") return <div className="cr-dim">No awards on record (per Wikidata).</div>;
  if (state === "error") return <div className="cr-dim">Wikidata didn&apos;t answer in time — awards unavailable right now.</div>;
  return (
    <>
      {state.slice(0, 40).map((a, i) => (
        <div className="cr-awrow" key={i}>
          <span className="cr-awn">{a.award}</span>
          {a.year ? <span className="cr-awy">{a.year}</span> : null}
          {a.forw ? <span className="cr-awf">— {a.forw}</span> : null}
        </div>
      ))}
      <div className="cr-dim" style={{ marginTop: 6 }}>{state.length} entries listed · Wikidata (CC0)</div>
    </>
  );
}

function SecHead({ en, kr, sub }: { en: string; kr: string; sub?: ReactNode }) {
  return (
    <div className="cr-sechead">
      <div className="cr-eyebrow">{en}<span className="cr-eyebrow-kr">{kr}</span></div>
      {sub ? <div className="cr-secsub">{sub}</div> : null}
    </div>
  );
}

function ArtistView({ S, nav, hideProfile = false, onFilm, onArtist, onDossier, isSeen, toggleSeen }: ViewProps) {
  const { person, craftKey, films, byWR, essentials, deep, further, startHere, notStart, partners, partnerIds, troupe, topCollab, totalWorks, corpus, failed, gTop, isDir } = S;
  const dirLinks = useMetaLinks(isDir ? `person=${encodeURIComponent(person.name)}` : null);
  const metaHref = personHref(person.name, person.id, isDir, dirLinks?.directorSlug ?? null);
  const nativeInfo = useMetaLinks(`native=${person.id}`);
  const cf = CRAFTS[craftKey];
  const yr0 = films[0].year, yr1 = films[films.length - 1].year;
  const bg = startHere?.backdrop ? img(startHere.backdrop, "w780") : null;
  const seenCount = films.filter((f) => isSeen(f.id)).length;

  /* siblings — always computed against the CURRENT film nav, never cached */
  let siblings: CrewEntry[] = [];
  if (nav) {
    const tab = nav.tabs.find((t) => t.craft === craftKey);
    if (tab && tab.people.some((p) => p.id === person.id)) siblings = tab.people.filter((p) => p.id !== person.id);
  }

  const fam = troupe
    .filter((o) => !partnerIds.has(o.id) && (isDir ? true : o.grp !== "director"))
    .sort((a, b) => (FAM[a.grp].order - FAM[b.grp].order) || b.count - a.count);
  const byG = new Map<string, Collab[]>();
  fam.forEach((o) => { const arr = byG.get(o.grp) || []; arr.push(o); byG.set(o.grp, arr); });
  const mrows = [...partners, ...fam].sort((a, b) => b.count - a.count).slice(0, 28);

  return (
    <div className="cr-artist">
      {/* Identity header — redundant for the host page's own subject (their
          server-rendered header sits right above); shown again the moment
          exploration moves to someone else. */}
      {!hideProfile ? (
      <section className="cr-arthead">
        {bg ? <div className="cr-arthead-bg" style={{ backgroundImage: `url('${bg}')` }} aria-hidden /> : null}
        <div className="cr-arthead-in">
          {person.profile_path ? <img className="cr-artface" alt="" src={img(person.profile_path, "w185") || undefined} /> : null}
          <div className="cr-arthead-txt">
            <h1 className="cr-artname">
              {person.name}
              {nativeInfo?.native ? <span style={{ fontWeight: 400, opacity: 0.72, fontSize: "0.68em" }}> ({nativeInfo.native})</span> : null}{" "}
              <a className="cr-ext" href={`https://www.themoviedb.org/person/${person.id}`} target="_blank" rel="noopener nofollow">TMDB ↗</a>
            </h1>
            <div className="cr-artrole">{cf.label} · {cf.kr}</div>
            <div className="cr-artstyle">{styleFor(person.name, cf.role, topCollab, films.length, yr0, yr1)}</div>
            <div className="cr-artmeta">
              {films.length} films as {cf.role.toLowerCase()} · {yrsFmt(yr0, yr1)}
              {seenCount ? <span className="cr-seen-ct"> · seen {seenCount} of {films.length}</span> : null}
            </div>
            {metaHref ? (
              <div style={{ marginTop: 10 }}>
                <ExitPill href={metaHref}>{isDir ? `${person.name} — director page →` : `${person.name} — full Metatake profile →`}</ExitPill>
              </div>
            ) : null}
            {gTop.length ? (
              <div className="cr-gline">
                <span className="cr-gbar">{gTop.map((g) => <i key={g.name} style={{ width: `${g.pct}%`, background: g.color }} />)}</span>
                <span className="cr-gtxt">{gTop.map((g) => `${g.name} ${g.pct}%`).join(" · ")}</span>
              </div>
            ) : null}
          </div>
        </div>
      </section>
      ) : null}

      {siblings.length && nav ? (
        <div className="cr-also">
          Also credited for {cf.label.toLowerCase()} on <i>{nav.film.title}</i>:{" "}
          {siblings.map((p) => (
            <button key={p.id} type="button" className="cr-chip" onClick={() => onArtist(p.id, craftKey, nav.film.id)}>{p.name}</button>
          ))}
        </div>
      ) : null}

      {/* Redundant when embedded under a page that already carries the same
          subject's header — hidden for the page's own person, shown again the
          moment exploration moves to someone else. */}
      {!hideProfile ? (
        <section className="cr-profile">
          <div className="cr-facts">
            <div className="cr-frow"><span className="cr-fk">Field 분야</span><span>{person.known_for_department || "—"}</span></div>
            <div className="cr-frow"><span className="cr-fk">Credits 참여작</span><span>{totalWorks} works <span className="cr-dim">({films.length} as {cf.role.toLowerCase()})</span></span></div>
            <div className="cr-frow"><span className="cr-fk">Born 출생</span><span>{person.birthday || "—"}{person.deathday ? ` — ${person.deathday}` : ""}</span></div>
            <div className="cr-frow"><span className="cr-fk">From 출신</span><span>{person.place_of_birth || "—"}</span></div>
          </div>
          <div className="cr-awards">
            <div className="cr-awhdr">Awards 수상 · Wikidata</div>
            <AwardsBox imdbId={person.imdb_id} />
          </div>
        </section>
      ) : null}

      {/* Directors already have "Where to Start" on their Metatake director page — no duplication here. */}
      {!isDir ? (
        <>
          <SecHead en="Where to begin" kr="입문" sub="The consensus door into the filmography." />
          <div className="cr-begin" role="link" tabIndex={0}
            onClick={() => onFilm(startHere.id)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onFilm(startHere.id); } }}>
            {startHere.poster ? <img alt={startHere.title} src={img(startHere.poster, "w342") || undefined} /> : <div className="cr-po" style={{ width: 76 }} />}
            <div>
              <div className="cr-begin-t">{startHere.title} <span className="cr-dim">{startHere.year}</span></div>
              <div className="cr-begin-why">
                {startHere.WR != null
                  ? <>High consensus with enough eyes on it to trust — weighted {startHere.WR.toFixed(2)} across {fmtV(startHere.v)} ratings.</>
                  : <>The most visible entry in a thinly-rated filmography.</>}
              </div>
            </div>
          </div>
          {notStart ? (
            <div className="cr-notstart">
              Where <b>not</b> to start: <i>{notStart.title}</i> ({notStart.year}) — the consensus is unkind. Save it for the completist phase.
            </div>
          ) : null}
        </>
      ) : null}

      {/* Directors: the Metatake director page already curates the filmography
          ("Where to Start", picks) — consensus rankings would compete with it. */}
      {!isDir ? (
        <>
          <SecHead en="The Essentials" kr="정본" sub="The films the consensus keeps returning to." />
          {essentials.length ? (
            <div className="cr-posters">
              {essentials.map((f, i) => <PCard key={f.id} f={f} num={i + 1} onFilm={onFilm} isSeen={isSeen} toggleSeen={toggleSeen} />)}
            </div>
          ) : <div className="cr-empty">Too thinly rated to call essentials — the full filmography below is the honest view.</div>}
        </>
      ) : null}

      {partners.length ? (
        <>
          <SecHead en="The Long Collaborations" kr="오랜 협업"
            sub={isDir ? "The crew this director keeps bringing back. Click a card for the dossier." : "The directors this artist keeps returning to — the partnership is where the signature lives. Click a card for the dossier."} />
          <div className="cr-collabs">{partners.map((p) => <CollabCard key={p.id} o={p} onDossier={onDossier} />)}</div>
        </>
      ) : null}

      {!isDir ? (
        <>
          <SecHead en="Deep Cuts" kr="B면" sub="B-sides and wayward experiments — credible work the crowds haven't found." />
          {deep.length ? (
            <div className="cr-posters">{deep.map((f) => <PCard key={f.id} f={f} onFilm={onFilm} isSeen={isSeen} toggleSeen={toggleSeen} />)}</div>
          ) : <div className="cr-empty">No B-sides here — a filmography that&apos;s all essentials.</div>}
        </>
      ) : null}

      <SecHead en="The Repertory Company" kr="사단"
        sub={<>
          The people who recur across {corpus.length === films.length ? `all ${films.length} films` : <b>{corpus.length} of {films.length} films analysed</b>} (≥2 together; ≥3 for producers and cast).{" "}
          <span className="cr-warn">reunited</span> = the artist made films without them, then brought them back.
          {failed ? <span className="cr-warn"> {failed} films failed to load — counts may run low.</span> : null}
        </>} />
      {fam.length ? (
        [...byG.entries()].map(([g, arr]) => (
          <div key={g}>
            <div className="cr-grphead">
              <span className="cr-dot" style={{ background: FAM[g as keyof typeof FAM].color }} />
              {FAM[g as keyof typeof FAM].label} <span className="cr-eyebrow-kr">{FAM[g as keyof typeof FAM].kr}</span>
              <span className="cr-dim">({arr.length})</span>
            </div>
            <div className="cr-collabs">{arr.slice(0, 9).map((o) => <CollabCard key={o.id} o={o} onDossier={onDossier} />)}</div>
          </div>
        ))
      ) : (!partners.length ? <div className="cr-empty">A career of one-off partnerships — every film a new crew.</div> : null)}

      {mrows.length >= 2 && corpus.length >= 4 ? (
        <>
          <SecHead en="The Repertory Timeline" kr="시간축"
            sub="Rows are the company; columns are the films in order. Streaks are long partnerships — broken streaks that resume are reunions." />
          <Matrix rows={mrows} corpus={corpus} curFilmId={nav ? nav.film.id : null} />
        </>
      ) : null}

      {further.length ? (
        <>
          <SecHead en="Further Viewing" kr="더 보기" sub="Widely seen, ranked below the essentials." />
          <div className="cr-further">
            {further.map((f) => (
              <button key={f.id} type="button" className="cr-fv" onClick={() => onFilm(f.id)}>
                <b>{f.title}</b> {f.year}{f.WR != null ? ` · ${f.WR.toFixed(2)}` : ""}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <details className="cr-full">
        <summary>Full {cf.role.toLowerCase()} filmography ({films.length}) — by weighted consensus</summary>
        <table>
          <thead><tr><th /><th>Film</th><th>Year</th><th>Consensus</th><th>Rating</th><th>Ratings</th></tr></thead>
          <tbody>
            {byWR.map((f) => (
              <tr key={f.id}>
                <td>
                  <button type="button" className={`cr-seenb cr-seenb-s${isSeen(f.id) ? " is-on" : ""}`} aria-label="Mark as watched"
                    onClick={() => toggleSeen(f.id)}>✓</button>
                </td>
                <td><button type="button" className="cr-linkish" onClick={() => onFilm(f.id)}>{f.title}</button></td>
                <td>{f.year || ""}</td>
                <td>{f.WR != null ? <span className="cr-score">{f.WR.toFixed(2)}</span> : <span className="cr-dim">—</span>}</td>
                <td>{f.v ? f.R.toFixed(1) : "—"}</td>
                <td>{f.v ? fmtV(f.v) : "0"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <div className="cr-mnote">
        Weighted consensus shrinks thin ratings toward this artist&apos;s own average ({S.C.toFixed(2)}, m={S.m}) — never popularity.
      </div>
    </div>
  );
}

/* ============ repertory timeline matrix ============ */
function Matrix({ rows, corpus, curFilmId }: { rows: Collab[]; corpus: TFilm[]; curFilmId: number | null }) {
  return (
    <div className="cr-mxscroll">
      <table className="cr-mx">
        <thead>
          <tr>
            <th className="cr-rowh" />
            {corpus.map((f) => (
              <th key={f.id} className={curFilmId === f.id ? "is-cur" : undefined}>
                {f.poster
                  ? <img className="cr-colposter" alt="" loading="lazy" title={`${f.title} (${f.year})`} src={img(f.poster, "w92") || undefined} />
                  : <div className="cr-colposter" />}
                <div className="cr-colyr">{f.year}</div>
                <div className="cr-colcnt">↩ {rows.filter((o) => o.filmIds.has(f.id)).length}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <th className="cr-rowh">
                <span className="cr-rn">{o.name}</span>
                <span className="cr-rr"><span className="cr-dot" style={{ background: FAM[o.grp].color, width: 7, height: 7 }} /> {o.primary} · ×{o.count}</span>
              </th>
              {corpus.map((f) => (
                <td key={f.id} className={`cr-cell${curFilmId === f.id ? " is-cur" : ""}`}>
                  {o.filmIds.has(f.id) ? <span className="cr-fill" style={{ background: FAM[o.grp].color }} title={`${o.name} — ${f.title} (${f.year})`} /> : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ============ partnership dossier ============ */
function Dossier({ o, S, onClose, onFilm, onArtist }: {
  o: Collab; S: ArtistData; onClose: () => void;
  onFilm: (id: number) => void; onArtist: (pid: number, craft: CraftKey, fid?: number | null) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shared = o.filmsArr;
  const sharedIds = o.filmIds;
  const sharedRated = shared.filter((f) => f.WR != null);
  const otherRated = S.films.filter((f) => !sharedIds.has(f.id) && f.WR != null);
  let delta: { a: number; d: number } | null = null;
  if (sharedRated.length >= 2 && otherRated.length >= 3) {
    const a = sharedRated.reduce((s, f) => s + (f.WR as number), 0) / sharedRated.length;
    const b = otherRated.reduce((s, f) => s + (f.WR as number), 0) / otherRated.length;
    delta = { a, d: a - b };
  }
  const first = shared[0], last = shared[shared.length - 1];
  const craft = GRP2CRAFT[o.grp];
  const G = FAM[o.grp];
  const isDirCollab = o.grp === "director";
  const dirLinks = useMetaLinks(isDirCollab ? `person=${encodeURIComponent(o.name)}` : null);
  const detailHref = personHref(o.name, o.id, isDirCollab, dirLinks?.directorSlug ?? null);

  return (
    <div className="cr-modalback" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cr-modal" role="dialog" aria-modal="true" aria-label="Collaboration dossier">
        <button type="button" className="cr-modal-x" aria-label="Close" onClick={onClose}>✕</button>
        <div className="cr-eyebrow">Collaboration dossier<span className="cr-eyebrow-kr">협업 기록</span></div>
        <h3 className="cr-modal-h">{S.person.name} × {o.name}</h3>
        <div className="cr-modal-sub">
          <b style={{ color: G.color }}>×{o.count} films</b> · {o.primary} · {yrsFmt(o.y0, o.y1)}
          {o.count >= 5 && o.y1 - o.y0 >= 10 ? " · a repertory partnership" : o.count >= 3 ? " · a frequent collaborator" : ""}
        </div>
        <div className="cr-mstats">
          <div className="cr-mstat"><span>First film</span><span><i>{first.title}</i> ({first.year})</span></div>
          <div className="cr-mstat"><span>Latest film</span><span><i>{last.title}</i> ({last.year})</span></div>
          {delta ? (
            <div className="cr-mstat"><span>The pair effect</span>
              <span>Together they average <b>{delta.a.toFixed(2)}</b> — {delta.d >= 0 ? "+" : "−"}{Math.abs(delta.d).toFixed(2)} vs the rest of the filmography.</span>
            </div>
          ) : null}
          {o.reunion ? (
            <div className="cr-mstat"><span>Reunion</span>
              <span>Back together on <i>{o.reunion.backTitle}</i> ({o.reunion.backYear}) — first film since <i>{o.reunion.afterTitle}</i> ({o.reunion.afterYear}), {o.reunion.gapFilms} films apart.</span>
            </div>
          ) : null}
        </div>
        <div className="cr-mposters">
          {shared.slice(0, 12).map((f) => (
            <div key={f.id} className="cr-mp" role="link" tabIndex={0}
              onClick={() => { onClose(); onFilm(f.id); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClose(); onFilm(f.id); } }}>
              {f.poster ? <img alt="" title={f.title} src={img(f.poster, "w92") || undefined} /> : <div className="cr-mp-ph" />}
              <div className="cr-mpy">{f.year}</div>
            </div>
          ))}
        </div>
        <div className="cr-mfoot">
          {detailHref ? (
            <a className="cr-btn" href={detailHref} style={{ textDecoration: "none" }}>
              Their Metatake page →
            </a>
          ) : null}
          {craft ? (
            <button type="button" className="cr-btn" onClick={() => { onClose(); onArtist(o.id, craft, null); }}>
              Explore here ↓
            </button>
          ) : null}
          <a className="cr-dim" href={`https://www.themoviedb.org/person/${o.id}`} target="_blank" rel="noopener nofollow">TMDB ↗</a>
        </div>
        <div className="cr-mnote">Counted within the {S.corpus.length} films analysed for {S.person.name}.</div>
      </div>
    </div>
  );
}
