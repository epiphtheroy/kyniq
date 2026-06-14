import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";

export const revalidate = 120;

export const metadata: Metadata = {
  title: "Metatake — the genealogy of meaning in cinema",
  description: "A wiki of critical readings (meta takes) that recur across film history — figure by figure, film by film.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default async function Home() {
  const supabase = db();
  const [{ data: mts }, { data: counts }, { data: figs }] = await Promise.all([
    supabase.from("meta_takes").select("id, slug, title, laconic").eq("status", "published"),
    supabase.from("meta_take_film_counts").select("meta_take_id, film_count"),
    supabase.from("figures").select("slug, label, film:films!inner(slug, title)")
      .not("slug", "is", null).eq("status", "approved").limit(10),
  ]);
  const enriched = (figs ?? []) as unknown as { slug: string; label: string; film: { slug: string; title: string } }[];
  const countMap = new Map((counts ?? []).map((c) => [c.meta_take_id as string, c.film_count as number]));
  const featured = (mts ?? [])
    .map((m) => ({ ...m, n: countMap.get(m.id) ?? 0 }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 12);

  return (
    <div className="mt">
      <MetatakeNav />
      <div className="mt-wrap">
        <h1 className="mt-h1" style={{ borderBottom: "none", fontSize: 22 }}>The genealogy of meaning in cinema</h1>
        <p style={{ marginTop: 6 }}>
          Every film is built from <b style={{ fontWeight: 400 }}>figures</b> — a face, an object, a place, a scene.
          Each figure carries a <b style={{ fontWeight: 400 }}>take</b>: a reading of what it means. When a reading recurs
          across films it becomes a <b style={{ fontWeight: 400 }}>meta take</b> — and below it gather, not lookalikes,
          but kin. Start anywhere; fall down the rabbit hole.
        </p>
        <div className="mt-tabs" style={{ marginTop: 4 }}>
          <Link href="/meta-takes">Browse meta takes</Link>
          <Link href="/film">Films</Link>
          <Link href="/director">Directors</Link>
        </div>

        {featured.length > 0 && (
          <>
            <h2 className="mt-h2">Most-connected readings</h2>
            <div className="mt-cols">
              {featured.map((m) => (
                <div key={m.id} style={{ marginBottom: 6 }}>
                  <Link href={`/take/${m.slug}`}>{m.title}</Link>{" "}
                  <span style={{ color: "var(--subtle)" }}>{m.n}</span>
                  {m.laconic ? <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.4 }}>{m.laconic}</div> : null}
                </div>
              ))}
            </div>
          </>
        )}

        {enriched.length > 0 && (
          <>
            <h2 className="mt-h2">New — figure pages</h2>
            <p className="mt-laconic" style={{ margin: "0 0 8px" }}>
              Each figure now carries several register-tagged readings, each opening onto a meta take. Try one:
            </p>
            <div className="mt-cols">
              {enriched.map((f) => (
                <div key={`${f.film.slug}-${f.slug}`} style={{ marginBottom: 6 }}>
                  <Link href={`/film/${f.film.slug}/figure/${f.slug}`}>{f.label}</Link>{" "}
                  <span style={{ color: "var(--subtle)" }}>{f.film.title}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {featured.length === 0 && (
          <p style={{ color: "var(--muted)", marginTop: 20 }}>
            The archive is being assembled — meta takes appear here as they are published.
          </p>
        )}
      </div>
    </div>
  );
}
