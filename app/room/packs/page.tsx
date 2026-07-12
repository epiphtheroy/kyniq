import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CopyForAI from "@/components/CopyForAI";

export const dynamic = "force-dynamic";

/** /room/packs — the reader's downloaded AI context packs (library).
 *  Auth is enforced by app/room/layout.tsx. Rows are the user's own via RLS
 *  (pack_downloads_own_select, migration 0086). Re-download and re-copy are free. */
export default async function RoomPacksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // layout redirects; guard for types

  const { data: dls } = await supabase
    .from("pack_downloads")
    .select("slug, film_id, sections, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  // Distinct films, latest download first. Quota counts only NEW films this month
  // (a film whose EARLIEST download is this month) — mirrors pack_download_claim so
  // re-downloading a film from a prior month is free. Derived from RLS'd own-rows.
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const seen = new Set<string>();
  const minByFilm = new Map<string, string>();
  const rows: { slug: string; sections: string[]; created_at: string }[] = [];
  for (const d of (dls as { slug: string; film_id: string; sections: string[]; created_at: string }[] | null) ?? []) {
    const prev = minByFilm.get(d.film_id);
    if (prev === undefined || d.created_at < prev) minByFilm.set(d.film_id, d.created_at);
    if (seen.has(d.film_id)) continue;
    seen.add(d.film_id);
    rows.push({ slug: d.slug, sections: d.sections ?? [], created_at: d.created_at });
  }
  let used = 0;
  for (const mn of minByFilm.values()) if ((mn || "").slice(0, 7) === monthKey) used++;

  const slugs = rows.map((r) => r.slug);
  const { data: films } = slugs.length
    ? await supabase.from("films").select("slug, title, year, poster_path").in("slug", slugs)
    : { data: [] as { slug: string; title: string; year: number | null; poster_path: string | null }[] };
  const fmap = new Map((films ?? []).map((f) => [f.slug, f]));

  return (
    <div className="mainpad">
      <div className="rp-head">
        <h1>Pack Library</h1>
        <p>Your downloaded AI context packs. Re-downloading and copying are always free.</p>
        <span className="rp-quota">{used} of 10 film downloads used this month</span>
      </div>

      {rows.length === 0 ? (
        <div className="rp-empty">
          <p>No packs yet. On any analyzed film, use <b>Download film</b> in the section bar to save a Markdown pack for your AI — or hit <b>Copy for AI</b> to copy without saving.</p>
          <Link className="rp-go" href="/film">Browse films →</Link>
        </div>
      ) : (
        <ul className="rp-list">
          {rows.map((r) => {
            const f = fmap.get(r.slug);
            const title = f ? `${f.title}${f.year ? ` (${f.year})` : ""}` : r.slug;
            const date = (r.created_at || "").slice(0, 10);
            return (
              <li key={r.slug} className="rp-row">
                {f?.poster_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="rp-poster" src={`https://image.tmdb.org/t/p/w92${f.poster_path}`} alt="" loading="lazy" />
                ) : (
                  <div className="rp-poster rp-poster--none" aria-hidden />
                )}
                <div className="rp-meta">
                  <Link href={`/film/${r.slug}`} className="rp-title">{title}</Link>
                  <span className="rp-date">Saved {date}{r.sections?.length ? ` · ${r.sections.length} sections` : ""}</span>
                </div>
                <div className="rp-actions">
                  <CopyForAI slug={r.slug} label="Copy" />
                  <a className="rp-dl" href={`/api/pack/${encodeURIComponent(r.slug)}/download?dl=1`} download>⭳ .md</a>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <style>{`
        .rp-head h1{font-size:1.5rem;font-weight:800;margin:0 0 4px;}
        .rp-head p{color:var(--muted,#9aa4b2);font-size:.9rem;margin:0 0 6px;}
        .rp-quota{display:inline-block;font-size:.76rem;font-weight:700;color:#c9d3e0;
          background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:.3em .7em;}
        .rp-empty{margin-top:24px;color:var(--muted,#9aa4b2);font-size:.92rem;line-height:1.5;}
        .rp-go{display:inline-block;margin-top:10px;font-weight:700;color:#c9d3e0;}
        .rp-list{list-style:none;padding:0;margin:20px 0 0;display:flex;flex-direction:column;gap:8px;}
        .rp-row{display:flex;align-items:center;gap:12px;padding:8px 10px;border:1px solid rgba(255,255,255,.1);
          border-radius:10px;background:rgba(255,255,255,.03);}
        .rp-poster{width:40px;height:60px;object-fit:cover;border-radius:4px;flex:0 0 auto;background:rgba(255,255,255,.06);}
        .rp-poster--none{}
        .rp-meta{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px;}
        .rp-title{font-weight:700;font-size:.98rem;color:#eef2f7;text-decoration:none;}
        .rp-title:hover{text-decoration:underline;}
        .rp-date{font-size:.76rem;color:var(--muted,#9aa4b2);}
        .rp-actions{display:flex;align-items:center;gap:8px;flex:0 0 auto;}
        .rp-dl{font-size:.8rem;font-weight:700;color:#c9d3e0;background:rgba(255,255,255,.08);
          border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:.42em .8em;text-decoration:none;white-space:nowrap;}
        .rp-dl:hover{background:rgba(255,255,255,.16);}
      `}</style>
    </div>
  );
}
