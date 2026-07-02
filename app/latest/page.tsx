import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import LatestMagazine, { type LatestPool } from "@/components/LatestMagazine";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Latest — what's newest across Metatake",
  description:
    "Fresh film readings, meta takes, tropes, directors and concepts — the newest of everything on Metatake, edited like a magazine.",
  alternates: { canonical: "/latest" },
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

const LEGEND: [string, string][] = [
  ["#26303B", "Film"], ["#E3120B", "Meta take"], ["#167C6B", "Trope"],
  ["#6B4E9E", "Director"], ["#2E6F8E", "Concept"], ["#A8434F", "Reading"],
];

export default async function LatestPage() {
  const supabase = db();
  const { data } = await supabase.rpc("latest_pool");
  const pool = (data as LatestPool | null) ?? { films: [], metas: [], tropes: [], directors: [], concepts: [], readings: [] };

  const now = new Date();
  const TZ = "Asia/Seoul";
  const wd = now.toLocaleDateString("en-US", { weekday: "long", timeZone: TZ }).toUpperCase();
  const md = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: TZ }).toUpperCase();

  return (
    <div className="mt">
      <SiteNav />
      <div className="lt-wrap">
        <div className="lt-edition">
          <span className="date">{wd} · {md}</span>
          <span className="tag">A critical map of cinema — edited as it grows</span>
        </div>

        <div className="lt-h1row">
          <h1 className="lt-h1">Latest</h1>
          <span className="lt-toggle">
            <a data-on>Latest</a>
            <Link href="/trending">Trending</Link>
          </span>
        </div>
        <p className="lt-subline">What&apos;s newest across Metatake — fresh film readings, meta takes, tropes, directors and concepts, edited like a magazine.</p>

        <div className="lt-legend">
          {LEGEND.map(([c, label]) => (
            <span key={label}><i style={{ background: c }} />{label}{label === "Reading" ? <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>&nbsp;· coloured by critical register</span> : null}</span>
          ))}
        </div>

        <LatestMagazine pool={pool} />
      </div>
    </div>
  );
}
