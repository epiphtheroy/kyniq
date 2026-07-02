import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import MovementHubClient from "@/components/MovementHubClient";

export const revalidate = 1800;
type Props = { params: Promise<{ slug: string }> };

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export type MvFilm = { slug: string; title: string; year: number | null; poster_path: string | null; director: string | null; authority: boolean; demand: number | null };
export type MvDetail = {
  kind: "national" | "movement";
  hub: { slug: string; label: string; kind: string; region: string | null; tier: string | null; status: string | null; country_code: string | null; description: string | null };
  films: MvFilm[];
  auteurs: { director: string; n: number }[];
};

// Cached per slug so the page is ISR-cached instead of re-querying on every
// request (uncached Supabase calls otherwise force dynamic rendering).
function load(slug: string): Promise<MvDetail | null> {
  return unstable_cache(
    async () => {
      const { data } = await db().rpc("movement_detail", { p_slug: slug });
      return (data as MvDetail | null) ?? null;
    },
    ["movement", slug],
    { revalidate: 1800, tags: [`movement:${slug}`] },
  )();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) return { title: "Not found" };
  const t = `${d.hub.label} — ${d.kind === "national" ? "national cinema" : "film movement"} · Metatake`;
  // Phase-0 origins final. Index hubs with enough films; keep thin hubs (<8) out of the index.
  const thin = (d.films?.length ?? 0) < 8;
  return { title: t, description: `The canon, auteurs and where to start with ${d.hub.label} on Metatake.`, alternates: { canonical: `/movements/${slug}` }, robots: thin ? { index: false, follow: true } : undefined };
}

export default async function MovementHub({ params }: Props) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d || !d.films) notFound();
  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap lh">
        <div className="lh-crumb"><Link href="/movements">Movements</Link></div>
        <MovementHubClient d={d} />
      </div>
    </div>
  );
}
