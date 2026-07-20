import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteNav from "@/components/home2/SiteNav";
import mapData from "@/public/odyssey/map.v1.json";
import type { OdyMap, OdyStation } from "@/lib/odyssey/types";
import "../../odyssey.css";

// Fully static line pages driven by the same compile-time map artifact as
// /odyssey. One page per line, prerendered at build.

const map = mapData as unknown as OdyMap;
const siteUrl = "https://metatake.net";
const stationBy = new Map(map.stations.map((s) => [s.s, s]));

export function generateStaticParams() {
  return map.lines.map((l) => ({ slug: l.id }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const line = map.lines.find((l) => l.id === slug);
  if (!line) return {};
  return {
    title: `${line.name_en} — Odyssey`,
    description:
      (line.desc_en ||
        `${line.stations.length} films in chronological riding order on the ${line.name_en} of the Metatake Odyssey map.`) +
      " Films as stations, transfers marked, altitude rated.",
    alternates: { canonical: `/odyssey/line/${line.id}` },
    robots: { index: true, follow: true },
  };
}

export default async function OdysseyLinePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const line = map.lines.find((l) => l.id === slug);
  if (!line) notFound();
  const stops = line.stations
    .map((s) => stationBy.get(s))
    .filter((s): s is OdyStation => !!s);
  const first = stops[0]?.y;
  const last = stops[stops.length - 1]?.y;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${line.name_en} — Odyssey`,
    url: `${siteUrl}/odyssey/line/${line.id}`,
    numberOfItems: stops.length,
    itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: stops.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: s.t,
      url: `${siteUrl}/film/${s.s}`,
    })),
  };

  return (
    <>
      <SiteNav />
      <main className="ody-line-page">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <div className="crumb">
          <Link href="/odyssey">Odyssey</Link> / line
        </div>
        <div className="lp-head">
          <span className="dot" style={{ background: line.color }} />
          <h1 className="disp">{line.name_en}</h1>
        </div>
        {line.desc_en ? <p className="lp-desc standfirst">{line.desc_en}</p> : null}
        <p className="lp-meta">
          {stops.length} stops
          {first && last ? ` · ${first}–${last}` : ""} · ride in order, transfer where lines cross ·
          altitude ▲ = how much a film asks of you
        </p>
        <Link className="lp-map-link" href={`/odyssey?line=${line.id}`}>
          See this line on the map →
        </Link>

        <ol className="ody-stops" style={{ ["--lc" as string]: line.color }}>
          {stops.map((s) => {
            const others = (s.ln ?? []).filter((x) => x !== line.id);
            return (
              <li key={s.s} className={`ody-stop${others.length ? " tf" : ""}`}>
                <div className="t">
                  <Link href={`/film/${s.s}`}>{s.t}</Link>
                  <span className="yr">{s.y ?? ""}</span>
                </div>
                {s.d ? <div className="sub">{s.d}</div> : null}
                <div className="alt">
                  {"▲".repeat(s.c)}
                  {"△".repeat(5 - s.c)}
                  <span>
                    altitude {s.c}/5{s.pk ? " · canon peak" : ""}
                  </span>
                </div>
                {others.length ? (
                  <div className="xfer">
                    {others.map((lid) => {
                      const other = map.lines.find((x) => x.id === lid);
                      if (!other) return null;
                      return (
                        <Link key={lid} href={`/odyssey/line/${lid}`}>
                          <span className="dot" style={{ background: other.color }} /> transfer ·{" "}
                          {other.name_en}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </main>
    </>
  );
}
