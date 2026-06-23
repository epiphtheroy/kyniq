import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import ReadingFeed, { type FeedRow, type Facets } from "@/components/ReadingFeed";
import { fwBySlug } from "@/lib/frameworks";

export const revalidate = 600;
export async function generateStaticParams() { return []; }

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

interface Props { params: Promise<{ fw: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { fw: slug } = await params;
  if (slug === "all") return { title: "All Strong Misreadings — every critical reading on Metatake" };
  const f = fwBySlug(slug);
  if (!f) return { title: "Strong Misreadings — Metatake" };
  return {
    title: `${f.label} — Strong Misreadings`,
    description: `${f.short} Every ${f.label} Strong Misreading across cinema, searchable on Metatake.`,
  };
}

export default async function FrameworkPage({ params }: Props) {
  const { fw: slug } = await params;
  const isAll = slug === "all";
  const f = isAll ? null : fwBySlug(slug);
  if (!isAll && !f) redirect("/strong-misreadings");

  const supabase = db();
  const [{ data: facetsRaw }, { data: initRaw }] = await Promise.all([
    supabase.rpc("framework_facets", { p_fw: f?.key ?? null }),
    supabase.rpc("readings_by_framework", { p_fw: f?.key ?? null, p_sort: "film", p_limit: 24, p_offset: 0 }),
  ]);
  const facets = (facetsRaw as Facets | null) ?? { total: 0, decades: [], top_tropes: [] };
  const initial = (initRaw as { total: number; rows: FeedRow[] } | null) ?? { total: 0, rows: [] };

  return (
    <div className="mt">
      <MetatakeNav active="misreadings" />
      <div className="mt-wrap sm-fw">
        <div className="sm-crumb"><Link href="/strong-misreadings">Strong Misreadings</Link></div>
        <h1 className="sm-fw__h" style={isAll ? undefined : { color: f!.color }}>
          {isAll ? "All readings" : f!.label}
        </h1>
        <p className="sm-fw__short">
          {isAll ? "Every Strong Misreading on Metatake, across all 14 frameworks." : f!.short}
        </p>
        <ReadingFeed fwSlug={isAll ? "all" : f!.slug} isAll={isAll} initial={initial} facets={facets} />
      </div>
    </div>
  );
}
