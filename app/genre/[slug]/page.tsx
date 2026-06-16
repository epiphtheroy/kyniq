import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import ListFilter from "@/components/ListFilter";

export const revalidate = 600;
export async function generateStaticParams() { return []; }

interface Props { params: Promise<{ slug: string }>; }
function unslug(s: string) { return s.replace(/-/g, " "); }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${unslug(slug)} — films` };
}

export default async function GenrePage({ params }: Props) {
  const { slug } = await params;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: films } = await supabase.from("films").select("title, slug, year, genres").limit(5000);
  const want = slug.toLowerCase();
  const inGenre = (films ?? []).filter((f) =>
    ((f.genres ?? []) as string[]).some((g) => g.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") === want)
  ).sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  if (inGenre.length === 0) notFound();
  return (
    <div className="mt">
      <MetatakeNav active="genres" />
      <div className="mt-wrap">
        <div className="mt-crumb"><Link href="/genre">Genres</Link></div>
        <h1 className="mt-h1" style={{ textTransform: "capitalize" }}>{unslug(slug)}</h1>
        <ListFilter targetId="genre-list" total={inGenre.length} placeholder="Filter these films…" />
        <ul className="mt-list" id="genre-list" style={{ marginTop: 12 }}>
          {inGenre.map((f) => (
            <li key={f.slug} data-filter-item data-filter-text={`${f.title} ${f.year ?? ""}`.toLowerCase()}><Link href={`/film/${f.slug}`}>{f.title}</Link> <span className="meta">({f.year ?? "?"})</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}
