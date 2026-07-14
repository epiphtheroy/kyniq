import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import TVSingle from "@/components/TVSingle";
import type { TVEntry } from "@/components/TVProgramPlayer";
import "@/app/home2.css";

// /tv/[slug] — the canonical, indexable page for a film's METATAKE TV broadcast
// (the "upload"). One program per film (slug === film slug), compiled LLM-free by
// tv_compile_film. Carries the video SEO signals — VideoObject + Clip (key
// moments) JSON-LD, og:video / og:image, a video-typed Open Graph — so each
// broadcast is eligible for video rich results. ISR (revalidate 300), per-slug
// lazy like the film page.
export const revalidate = 300;
export const dynamicParams = true;
export const maxDuration = 30;
export function generateStaticParams() { return []; }

const IMG = "https://image.tmdb.org/t/p";
const SITE = "https://metatake.net";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Prog = { built_at: string | null; duration_ms: number | null; seg_count: number | null };
type Params = { params: Promise<{ slug: string }> };

// One program + its timing row. React cache() dedupes across generateMetadata + page.
const load = cache(async (slug: string): Promise<{ entry: TVEntry; prog: Prog | null } | null> => {
  const sb = db();
  const [watchRes, progRes] = await Promise.all([
    sb.rpc("tv_watch", { p_list: null, p_program: slug }),
    sb.from("tv_programs").select("built_at,duration_ms,seg_count").eq("slug", slug).eq("status", "published").maybeSingle(),
  ]);
  const entry = ((watchRes.data as { entries?: TVEntry[] } | null)?.entries ?? [])[0] ?? null;
  if (!entry) return null;
  return { entry, prog: (progRes.data as Prog | null) ?? null };
});

// A rotating slice of other broadcasts for the rail (deterministic per slug so ISR
// caches cleanly). The default shelf is alphabetical; offset by a slug hash.
const moreList = cache(async (): Promise<{ slug: string; title: string; film: TVEntry["film"] }[]> => {
  const { data } = await db().rpc("tv_watch", { p_list: null, p_program: null });
  return ((data as { programs?: { slug: string; title: string; film: TVEntry["film"] }[] } | null)?.programs ?? []);
});

function totalMs(entry: TVEntry, prog: Prog | null): number {
  const summed = (entry.segments ?? []).reduce((s, x) => s + (x.duration_ms || 0), 0);
  return summed > 0 ? summed : (prog?.duration_ms || 0);
}
function isoDuration(ms: number): string {
  const sec = Math.max(1, Math.round(ms / 1000));
  return `PT${Math.floor(sec / 60)}M${sec % 60}S`;
}
// built_at is a Postgres timestamptz text ("2026-07-10 03:22:45.38+00"); guard so a
// malformed value can never throw during render (would 500 the page).
function safeIso(s: string | null): string | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
function describe(entry: TVEntry): string {
  const f = entry.film;
  return `${entry.dek ? entry.dek + " — " : ""}A chapter-by-chapter video essay on ${f?.title}${f?.year ? ` (${f.year})` : ""}${f?.director ? `, directed by ${f.director}` : ""}, compiled from the Metatake record with no LLM: strong misreadings, the theorist's lens, figures, reception, honors and the film's map. On METATAKE TV.`;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) return { title: "METATAKE TV", robots: { index: false, follow: true } };
  const { entry } = d;
  const f = entry.film;
  const title = `${entry.title} — ${f?.title}${f?.year ? ` (${f.year})` : ""} · METATAKE TV`;
  const desc = describe(entry);
  const img = f?.backdrop ? `${IMG}/w1280${f.backdrop}` : f?.poster ? `${IMG}/w780${f.poster}` : undefined;
  const ytEmbed = f?.clip ? `https://www.youtube.com/embed/${f.clip}` : undefined;
  return {
    title,
    description: desc,
    alternates: { canonical: `/tv/${slug}` },
    openGraph: {
      title, description: desc, url: `${SITE}/tv/${slug}`, siteName: "Metatake", type: "video.other",
      ...(img ? { images: [{ url: img, width: 1280, height: 720, alt: `${f?.title} — METATAKE TV` }] } : {}),
      ...(ytEmbed ? { videos: [{ url: ytEmbed, type: "text/html", width: 1280, height: 720 }] } : {}),
    },
    twitter: { card: "summary_large_image", title, description: desc, ...(img ? { images: [img] } : {}) },
  };
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) notFound();
  const { entry, prog } = d;
  const f = entry.film;

  const all = await moreList();
  const others = all.filter((p) => p.slug !== slug);
  const off = [...slug].reduce((a, c) => a + c.charCodeAt(0), 0) % Math.max(1, others.length);
  const more = [...others.slice(off), ...others.slice(0, off)].slice(0, 10);

  // ── Video SEO: a VideoObject for the broadcast + Clip parts for its chapters
  // (Google "key moments"). Offsets run in editorial seq order; playback random-
  // samples, but the chapters and their durations are real.
  const ms = totalMs(entry, prog);
  const thumb = f?.backdrop ? `${IMG}/w1280${f.backdrop}` : f?.poster ? `${IMG}/w780${f.poster}` : undefined;
  const uploadIso = safeIso(prog?.built_at ?? null);
  let acc = 0;
  const clips = (entry.segments ?? []).map((s) => {
    const start = Math.round(acc / 1000);
    acc += s.duration_ms || 0;
    const end = Math.round(acc / 1000);
    return { "@type": "Clip", name: s.title, startOffset: start, endOffset: Math.max(start + 1, end), url: `${SITE}/tv/${slug}#chapter-${s.seq}` };
  });
  const videoLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: entry.title,
    description: describe(entry),
    ...(thumb ? { thumbnailUrl: [thumb] } : {}),
    ...(uploadIso ? { uploadDate: uploadIso } : {}),
    duration: isoDuration(ms),
    // embedUrl must point at the PLAYER, not the page — and match the on-page
    // iframe + the video sitemap's player_loc (all youtube-nocookie/embed) so
    // Google can resolve one consistent player for this watch page. Pointing
    // embedUrl at the page itself is what left these flagged "not on a watch page."
    ...(f?.clip
      ? { embedUrl: `https://www.youtube-nocookie.com/embed/${f.clip}`, contentUrl: `https://www.youtube.com/watch?v=${f.clip}` }
      : { embedUrl: `${SITE}/tv/${slug}` }),
    inLanguage: "en",
    isFamilyFriendly: true,
    genre: "film criticism",
    publisher: { "@type": "Organization", "@id": `${SITE}/#org`, name: "Metatake", url: SITE },
    ...(f?.slug ? { about: { "@type": "Movie", name: f.title, url: `${SITE}/film/${f.slug}` } } : {}),
    ...(clips.length ? { hasPart: clips } : {}),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "METATAKE TV", item: `${SITE}/tv` },
      { "@type": "ListItem", position: 3, name: `${f?.title}${f?.year ? ` (${f.year})` : ""}`, item: `${SITE}/tv/${slug}` },
    ],
  };

  return (
    <>
      {f?.clip ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(videoLd) }} /> : null}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <TVSingle entry={entry} more={more} />
    </>
  );
}
