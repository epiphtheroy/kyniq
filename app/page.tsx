import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

export const revalidate = 3600; // ISR: 1h

function supabaseAnon() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default async function HomePage() {
  const supabase = supabaseAnon();

  // Questions needing a reading (published, 0 contributions)
  const { data: needingReadings } = await supabase
    .from("questions")
    .select("id, title, slug, film:films!inner(title, year, slug)")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(20);

  // Filter to those without contributions (simple approach)
  const questionIds = (needingReadings ?? []).map((q) => q.id);
  const { data: contribCounts } = questionIds.length > 0
    ? await supabase.from("contributions").select("question_id").in("question_id", questionIds).eq("status", "published")
    : { data: [] };

  const contribSet = new Set((contribCounts ?? []).map((c) => c.question_id));
  const unanswered = (needingReadings ?? []).filter((q) => !contribSet.has(q.id)).slice(0, 4);

  // Active now (recently contributed)
  const { data: recentContribs } = await supabase
    .from("contributions")
    .select("question:questions!inner(title, slug, film:films!inner(title, slug))")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(3);

  // Recently improved (canonical answers recently updated)
  const { data: recentlyImproved } = await supabase
    .from("canonical_answers")
    .select("updated_at, question:questions!inner(title, slug, film:films!inner(title, slug))")
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(3);

  // Notable readers
  const { data: notableReaders } = await supabase
    .from("profiles")
    .select("username")
    .eq("is_public", true)
    .neq("role", "system")
    .not("username", "is", null)
    .order("reputation", { ascending: false })
    .limit(5);

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 1) return "today";
    if (days === 1) return "1d ago";
    return `${days}d ago`;
  };

  return (
    <main className="shell">
      {/* Search */}
      <Link href="/film" className="field search" style={{ marginTop: 18, display: "flex", textDecoration: "none", color: "var(--muted)" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
        Search a film to begin…
      </Link>

      <hr className="rule" style={{ marginTop: 24 }} />

      {/* Questions needing a reading */}
      <div className="seclbl">Questions needing a reading</div>
      <div className="tick" />

      {unanswered.map((q: any) => {
        const film = q.film as { title: string; year: number; slug: string };
        return (
          <div key={q.id} className="qrow">
            <div>
              <Link href={`/film/${film.slug}/q/${q.slug}`} className="disp" style={{ fontSize: 18, textDecoration: "none", color: "var(--ink)" }}>
                {q.title}
              </Link>
              <div className="ui muted" style={{ fontSize: 12, marginTop: 3 }}>
                {film.title} ({film.year}) · no reading yet
              </div>
            </div>
            <Link href={`/film/${film.slug}/q/${q.slug}`} className="ui accent" style={{ fontSize: 12.5, whiteSpace: "nowrap", textDecoration: "none" }}>
              Be the first ▸
            </Link>
          </div>
        );
      })}

      {unanswered.length === 0 && (
        <p className="ui muted" style={{ fontSize: 14 }}>All questions have readings — <Link href="/ask" className="accent" style={{ textDecoration: "none" }}>ask a new one</Link>.</p>
      )}

      <hr className="rule" />

      {/* Two-column: Active now + Recently improved */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 24 }}>
        <div>
          <div className="seclbl">Active now</div>
          {(recentContribs ?? []).map((rc: any, i: number) => {
            const q = rc.question as { title: string; slug: string; film: { title: string; slug: string } };
            return (
              <Link key={i} href={`/film/${q.film.slug}/q/${q.slug}`} style={{ display: "block", marginTop: i === 0 ? 11 : 12, textDecoration: "none", color: "inherit" }}>
                <div className="disp" style={{ fontSize: 15.5 }}>{q.title}</div>
                <div className="ui muted" style={{ fontSize: 11.5, marginTop: 2 }}>{q.film.title}</div>
              </Link>
            );
          })}
          {(recentContribs ?? []).length === 0 && (
            <p className="ui muted" style={{ fontSize: 13, marginTop: 10 }}>No activity yet.</p>
          )}
        </div>
        <div>
          <div className="seclbl">Recently improved</div>
          {(recentlyImproved ?? []).map((ri: any, i: number) => {
            const q = ri.question as { title: string; slug: string; film: { title: string; slug: string } };
            return (
              <Link key={i} href={`/film/${q.film.slug}/q/${q.slug}`} style={{ display: "block", marginTop: i === 0 ? 11 : 12, textDecoration: "none", color: "inherit" }}>
                <div className="disp" style={{ fontSize: 15.5 }}>{q.title}</div>
                <div className="ui muted" style={{ fontSize: 11.5, marginTop: 2 }}>{q.film.title} · updated {timeAgo(ri.updated_at)}</div>
              </Link>
            );
          })}
          {(recentlyImproved ?? []).length === 0 && (
            <p className="ui muted" style={{ fontSize: 13, marginTop: 10 }}>No updates yet.</p>
          )}
        </div>
      </div>

      <hr className="rule" />

      {/* Notable readers */}
      <div className="ui muted" style={{ fontSize: 12.5 }}>
        <span className="seclbl" style={{ marginRight: 10 }}>Notable readers</span>
        {(notableReaders ?? []).map((r: any, i: number) => (
          <span key={r.username}>
            {i > 0 && " · "}
            <Link href={`/u/${r.username}`} style={{ color: "var(--muted)", textDecoration: "none" }}>
              {r.username}
            </Link>
          </span>
        ))}
      </div>
    </main>
  );
}
