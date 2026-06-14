import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Meta takes — the readings that recur across cinema",
  description: "Every critical reading that recurs across films, grouped by the theory it comes from.",
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default async function MetaTakesIndex() {
  const supabase = db();
  const [{ data: mts }, { data: counts }] = await Promise.all([
    supabase.from("meta_takes")
      .select("id, slug, title, theory_family:theory_families(name, slug)")
      .eq("status", "published").order("title"),
    supabase.from("meta_take_film_counts").select("meta_take_id, film_count"),
  ]);
  const countMap = new Map<string, number>(
    (counts ?? []).map((c) => [c.meta_take_id as string, c.film_count as number] as [string, number])
  );

  type MT = { id: string; slug: string; title: string; family: string; familySlug: string | null };
  const groups = new Map<string, { slug: string | null; items: MT[] }>();
  for (const m of mts ?? []) {
    const fam = (m.theory_family as unknown as { name: string; slug: string } | null);
    const famName = fam?.name ?? "Uncategorised";
    const g = groups.get(famName) ?? { slug: fam?.slug ?? null, items: [] };
    g.items.push({ id: m.id, slug: m.slug, title: m.title, family: famName, familySlug: fam?.slug ?? null });
    groups.set(famName, g);
  }
  // order families by total films desc
  const ordered = [...groups.entries()].sort((a, b) =>
    b[1].items.reduce((s, m) => s + (countMap.get(m.id) ?? 0), 0) -
    a[1].items.reduce((s, m) => s + (countMap.get(m.id) ?? 0), 0)
  );
  const total = (mts ?? []).length;

  return (
    <div className="mt">
      <MetatakeNav active="takes" />
      <div className="mt-wrap">
        <h1 className="mt-h1">Meta takes</h1>
        <div className="mt-tabs">
          <span style={{ color: "var(--ink)" }}>By theory</span>
          <Link href="/genre">By genre</Link>
          <span style={{ marginLeft: "auto", color: "var(--subtle)" }}>{total} published</span>
        </div>

        {ordered.map(([fam, g]) => (
          <div key={fam} style={{ marginTop: 14 }}>
            <div className="mt-h2" style={{ fontSize: 13, marginBottom: 6 }}>{fam}</div>
            <div className="mt-cols">
              {g.items
                .sort((a, b) => (countMap.get(b.id) ?? 0) - (countMap.get(a.id) ?? 0))
                .map((m) => (
                  <div key={m.id}>
                    <Link href={`/take/${m.slug}`}>{m.title}</Link>{" "}
                    <span style={{ color: "var(--subtle)" }}>{countMap.get(m.id) ?? 0}</span>
                  </div>
                ))}
            </div>
          </div>
        ))}

        {total === 0 && <p style={{ color: "var(--muted)" }}>The catalogue is being assembled.</p>}
      </div>
    </div>
  );
}
