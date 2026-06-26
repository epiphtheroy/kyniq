import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";

export const revalidate = 600;
export const metadata: Metadata = { title: "Genres" };

function slugifyGenre(g: string) { return g.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

export default async function GenreIndex() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: films } = await supabase.from("films").select("genres").eq("visible", true).not("genres", "is", null).limit(5000);
  const counts = new Map<string, number>();
  for (const f of films ?? []) for (const g of (f.genres ?? []) as string[]) counts.set(g, (counts.get(g) ?? 0) + 1);
  const list = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap">
        <h1 className="mt-h1">Genres</h1>
        {list.length === 0 ? (
          <p style={{ color: "var(--muted)", marginTop: 16 }}>Genre data is being enriched from TMDB.</p>
        ) : (
          <div className="mt-cols" style={{ marginTop: 14 }}>
            {list.map(([g, n]) => (
              <div key={g}><Link href={`/genre/${slugifyGenre(g)}`}>{g}</Link> <span style={{ color: "var(--subtle)" }}>{n}</span></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
