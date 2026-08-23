import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { loadFilmTitles, filmTitle } from "@/lib/i18n/filmTitles";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import NextFilmBeacon from "./NextFilmBeacon";

/**
 * NextFilm — "watch next": three OTHER films, each with the bridge that earns it.
 * (정본: HANDOFF-두번째페이지-P0-설계.md §4)
 *
 * WHY THIS EXISTS. 90.0% of sessions are exactly one pageview (mt_events, 21d).
 * Every long-tail page already ends with fourteen doors — and all fourteen lead
 * back into the SAME film. A reader who came to answer "where can I watch X"
 * finishes that job and leaves, because nothing on the page proposes a next
 * FILM. This block is that proposal, and it is the P0 of the conversion funnel:
 * a visitor who never reaches a second page never becomes a candidate for
 * anything else.
 *
 * The picks are not computed here — `film_next` already holds 17,317 curated
 * rows (a written `reason` on 17,216 of them) covering 1,953 of 1,959 visible
 * films. The engine was built and then buried in an unclicked tab. This only
 * puts it where the reading ends.
 *
 * Self-contained like ReadPlates: fetch by slug, cached an hour under the film's
 * tag, and the whole block renders nothing rather than an empty shell.
 *
 * SERVER COMPONENT ON PURPOSE — the content is identical for every visitor, so
 * it belongs in the server HTML where crawlers follow the links. (Contrast
 * JoinCard, which is account-dependent and therefore client-only.) It must never
 * grow a signed-in branch; that would break the non-personalized-HTML invariant.
 */

const IMG = "https://image.tmdb.org/t/p";
const N = 3;
/**
 * Pool target per film. Two full slots, not three: slot 0 (whereto/reception) and
 * slot 1 (locations/takescore) are the high-traffic surfaces and get disjoint
 * sets; slot 2 wraps bare. Chasing a third distinct set would fire the top-up
 * queries on 1,923 of 1,955 films instead of 1,138 — and this repository has a
 * DB-saturation history that says do not buy small wins with cold-cache reads.
 */
const POOL = 6;

/**
 * Surface → slot (0,1,2), a deterministic third of the film's pick list. A reader
 * who passes through two surfaces of the same film meets DIFFERENT films, and no
 * `reason` sentence is ever duplicated across that film's pages — these are thin
 * long-tail pages under indexing scrutiny, and repeating the same prose across
 * them is exactly the duplication we cannot afford. (design §5.3)
 *
 * ⚠️ The pool is not always deep enough to give every slot its own three. Measured
 * over the 1,955 visible films with picks: 32 have 9+ usable curated picks, 785
 * have 6–8, but 956 have only 3–5 and 169 have 1–2. So slots are honoured up to
 * `floor(pool/3)`; past that the block still renders (a door to another film is
 * the point) but WITHOUT the reason prose — see `bare` in the component. That is
 * what actually holds the no-duplicate-prose invariant, rather than a rotation
 * that silently wraps onto itself on 58% of the catalogue.
 */
const SLOTS: Record<string, number> = {
  whereto: 0, reception: 0, credits: 0, "film-main": 0,
  locations: 1, takescore: 1, lineage: 1, desk: 1,
  "movies-like": 2, q: 2, misreadings: 2, gallery: 2,
};

/** ReadPlates passes compound surface keys ("desk:<key>", "q:<slug>"). */
function slotFor(surface: string): number {
  const head = surface.split(":")[0];
  return SLOTS[surface] ?? SLOTS[head] ?? 0;
}

/** Row shape of the `film_next` RPC (see migration; mirrors WnRow in film/[slug]/_shared.tsx). */
type NextRow = {
  pos: number; rec_title: string; rec_year: number | null; rec_director: string | null;
  reason: string | null; target_slug: string | null; target_title: string | null;
  target_year: number | null; target_poster: string | null; tmdb_id: number | null;
  poster_path: string | null;
};

export type NextItem = {
  slug: string; title: string; year: number | null;
  poster: string | null; director: string | null; reason: string | null;
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

/** Word-boundary clamp for the bridge sentence — reasons run long, the card does not. */
function clip(text: string, max = 140): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > 40 ? cut.slice(0, sp) : cut).replace(/[\s,;:.!?—–-]+$/, "") + "…";
}

/**
 * The film's full pick list, unrotated — ONE cache entry serves every surface
 * (the per-surface rotation is a slice applied by the caller, below).
 *
 * Errors THROW inside the cache so a transient failure is never stored: caching
 * a null here would silently delete this block from a live film for an hour.
 * That exact bug bit loadPlates in ReadPlates.tsx; the comment there is the
 * receipt. The caller swallows the throw.
 */
const loadNext = (slug: string) =>
  unstable_cache(
    async (): Promise<NextItem[]> => {
      const supabase = db();
      const { data: film, error: filmErr } = await supabase
        .from("films").select("id").eq("slug", slug).maybeSingle<{ id: string }>();
      if (filmErr) throw filmErr;
      if (!film) return [];

      const { data: rows, error: nextErr } = await supabase.rpc("film_next", { p_film_id: film.id });
      if (nextErr) throw nextErr;

      // `film_next` left-joins films ON visible, so target_slug is null both for
      // picks we don't carry and for hidden ones. Either way it is not a second
      // page — an outbound TMDB link is a bounce wearing a recommendation's hat.
      const picks: NextItem[] = ((rows ?? []) as NextRow[])
        .filter((r) => !!r.target_slug)
        .map((r) => ({
          slug: r.target_slug!,
          title: r.target_title ?? r.rec_title,
          year: r.target_year ?? r.rec_year,
          poster: r.target_poster ?? r.poster_path,
          director: r.rec_director,
          reason: r.reason?.trim() ? clip(r.reason.trim()) : null,
        }));
      if (picks.length >= POOL) return picks;

      // Top-up from the connection engine (which covers 100% of visible films):
      // curated picks run thin on most of the catalogue, and a deeper pool is what
      // lets two surfaces of the same film show two different sets. No written
      // bridge on these — they render bare.
      const { data: aff } = await supabase
        .from("film_affinities").select("related_film_id")
        .eq("film_id", film.id).order("score", { ascending: false }).limit(8);
      const ids = (aff ?? []).map((a) => a.related_film_id as string);
      if (!ids.length) return picks;
      const { data: kin } = await supabase
        .from("films").select("id, slug, title, year, poster_path, director")
        .in("id", ids).eq("visible", true);
      const have = new Set(picks.map((p) => p.slug));
      for (const id of ids) {
        if (picks.length >= POOL) break;
        const f = (kin ?? []).find((k) => k.id === id);
        if (!f || have.has(f.slug) || f.slug === slug) continue;
        have.add(f.slug);
        picks.push({ slug: f.slug, title: f.title, year: f.year, poster: f.poster_path, director: f.director, reason: null });
      }
      return picks;
    },
    ["film-next-1", slug],
    { revalidate: 3600, tags: [`film:${slug}`] }
  )();

export default async function NextFilm({
  slug,
  title,
  surface,
  variant = "full",
  tone = "dark",
  locale = DEFAULT_LOCALE,
}: {
  /** the film being read — the source of the picks */
  slug: string;
  /** its display title, for the heading (callers already have it; saves a read) */
  title?: string;
  /** which page this is, for rotation (§5.3) and for the click event name */
  surface: string;
  /** "full" = with the bridge sentence · "bare" = posters + titles only */
  variant?: "full" | "bare";
  /** "dark" = on the ReadPlates band · "light" = on a Newspaper-v3 page */
  tone?: "dark" | "light";
  locale?: Locale;
}) {
  const all = await loadNext(slug).catch(() => [] as NextItem[]);
  if (all.length === 0) return null;

  // How many slots this film's pool can serve with a DISJOINT set of three.
  const slot = slotFor(surface);
  const capacity = Math.floor(all.length / N);

  // Within capacity: this slot owns its own three, prose and all. Past it: wrap
  // for the links (still a door to another film) but drop the reasons, so the
  // same sentence never appears on two pages of the same film.
  const bare = variant === "bare" || slot >= capacity;
  const items = slot < capacity
    ? all.slice(slot * N, slot * N + N)
    : (() => { const off = (slot * N) % all.length; return [...all.slice(off), ...all.slice(0, off)].slice(0, N); })();
  if (items.length === 0) return null;

  const titles = await loadFilmTitles(locale, items.map((i) => i.slug));
  const withReason = !bare && items.some((i) => i.reason);

  const c = tone === "dark"
    ? { head: "#F2F2F2", kick: "#FF4F43", sub: "#B6B4B5", card: "#1F1F1F", line: "#3A3A3A", ti: "#F2F2F2", meta: "#B6B4B5", why: "#CFCFCF" }
    : { head: "#0D0D0D", kick: "#E3120B", sub: "#6B6B6B", card: "#FFFFFF", line: "#DCDCDC", ti: "#0D0D0D", meta: "#6B6B6B", why: "#4A4A4A" };

  return (
    <section className="mtnext" aria-label="Watch next">
      <NextFilmBeacon surface={surface} />
      <div className="mtnext-kick">WATCH NEXT</div>
      <h2 className="mtnext-h">
        {title ? `After ${title} — three films that continue its conversation.` : "Three films that continue this conversation."}
      </h2>
      {withReason ? (
        <p className="mtnext-sub">Each chosen for a specific bridge, not a distance score. Argued by Metatake AI.</p>
      ) : null}

      <div className="mtnext-grid">
        {items.map((it, i) => (
          <Link
            key={it.slug}
            href={`/film/${it.slug}`}
            className="mtnext-card"
            data-mt={`next:${surface}:${i + 1}`}
          >
            {it.poster ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img className="mtnext-po" src={`${IMG}/w185${it.poster}`} alt="" width={72} height={108} loading="lazy" />
            ) : <span className="mtnext-po mtnext-po--empty" aria-hidden="true" />}
            <span className="mtnext-tx">
              <span className="mtnext-ti">
                {filmTitle(titles, locale, it.slug, it.title)}
                {it.year ? <span className="mtnext-yr"> ({it.year})</span> : null}
              </span>
              {it.director ? <span className="mtnext-dir">{it.director}</span> : null}
              {!bare && it.reason ? <span className="mtnext-why">{it.reason}</span> : null}
            </span>
          </Link>
        ))}
      </div>

      <style>{`
        .mtnext{margin:30px 0 6px}
        .mtnext-kick{font-family:var(--font-ui,Inter,sans-serif);font-size:11px;font-weight:800;letter-spacing:.9px;
          text-transform:uppercase;color:${c.kick};margin:0 0 5px}
        .mtnext-h{font-family:var(--font-display,Georgia,serif);font-size:21px;line-height:1.22;margin:0 0 5px;
          color:${c.head};text-wrap:balance;font-weight:700}
        .mtnext-sub{font-family:var(--font-ui,Inter,sans-serif);font-size:13px;line-height:1.5;color:${c.sub};margin:0 0 16px;max-width:62ch}
        .mtnext-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
        .mtnext-card{display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid ${c.line};
          border-radius:10px;background:${c.card};text-decoration:none;transition:border-color .12s ease}
        .mtnext-card:hover{border-color:${c.kick}}
        .mtnext-po{flex:0 0 72px;width:72px;height:108px;object-fit:cover;border-radius:5px;display:block}
        .mtnext-po--empty{background:rgba(128,128,128,.14)}
        .mtnext-tx{min-width:0;display:flex;flex-direction:column;gap:3px}
        .mtnext-ti{font-family:var(--font-display,Georgia,serif);font-size:15px;font-weight:700;line-height:1.25;color:${c.ti}}
        .mtnext-yr{font-weight:400;color:${c.meta}}
        .mtnext-dir{font-family:var(--font-ui,Inter,sans-serif);font-size:12px;color:${c.meta}}
        .mtnext-why{font-family:var(--font-ui,Inter,sans-serif);font-size:12.5px;line-height:1.45;color:${c.why};margin-top:2px}
        @media (max-width:860px){.mtnext-grid{grid-template-columns:1fr}.mtnext-h{font-size:19px}}
      `}</style>
    </section>
  );
}
