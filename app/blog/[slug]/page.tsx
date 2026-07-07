import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SubscribeForm from "@/components/SubscribeForm";
import EditionBody, { type EditionPost } from "@/components/EditionBody";

/**
 * One edition of The Daily — ScreenRant grain (shell in app/blog/layout.tsx):
 * the date as the gold kicker, the edition's own headline (posts.title) as
 * the H1, the print-look body on a paper sheet under the dark chrome.
 */
export const revalidate = 120;
export async function generateStaticParams() { return []; }

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Post = EditionPost & { title: string; edition_date: string; dek: string | null; read_min: number };
interface Props { params: Promise<{ slug: string }>; }

const full = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const mon = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const isSeriesName = (t: string | null) => !t || t.toLowerCase() === "between film and the world";

async function load(slug: string) {
  const supabase = db();
  const { data } = await supabase.from("posts").select("slug, title, edition_date, dek, read_min, intro, entries, floor").eq("slug", slug).eq("status", "published").maybeSingle();
  return (data as Post | null) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) return { title: "Edition not found — metatake blog" };
  const title = isSeriesName(p.title)
    ? `Between Film and the World · ${mon(p.edition_date)}`
    : p.title;
  const description = p.dek ?? undefined;
  return { title, description, openGraph: { title, ...(description ? { description } : {}), type: "article" }, alternates: { canonical: `/blog/${slug}` } };
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) notFound();

  const headline = isSeriesName(p.title) ? `Between Film and the World · ${mon(p.edition_date)}` : p.title;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://metatake.net";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline,
    ...(p.dek ? { description: p.dek } : {}),
    datePublished: p.edition_date,
    url: `${siteUrl}/blog/${slug}`,
    isPartOf: { "@type": "Blog", name: "Between Film and the World", url: `${siteUrl}/blog` },
    author: { "@type": "Organization", name: "Metatake", url: siteUrl },
    publisher: { "@type": "Organization", name: "Metatake", url: siteUrl },
  };

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <div className="cur-wrap" style={{ maxWidth: 900 }}>
      <header className="cur-head" style={{ paddingTop: 30 }}>
        <div className="cur-datekick">
          <span>{full(p.edition_date)}</span>
          <span className="d" />
          <span className="sub">The daily edition</span>
        </div>
        <h1 style={{ marginTop: 10 }}>{headline}</h1>
        {p.dek ? <p className="dek">{p.dek}</p> : null}
        <p className="cur-edby">
          <b>{p.read_min} min read</b> · The Metatake desk · every film and reading below is live in the corpus
        </p>
      </header>

      <article className="cur-paper blg">
        <EditionBody post={p} />
      </article>

      <div className="cur-foot" style={{ display: "flex", gap: 22 }}>
        <Link href="/blog">← All editions</Link>
        <Link href="/curious">Curious — the question desk →</Link>
      </div>
    </div>

    <div className="cur-band">
      <div className="cur-band__in">
        <p className="k">Between Film and the World</p>
        <h3>The day&apos;s news, read as cinema.</h3>
        <p>One short edition, almost every morning — five events and the films that already knew. Free. No spam, unsubscribe anytime.</p>
        <SubscribeForm source="blog-post" />
        <p className="fine">Join the readers getting the wire through cinema.</p>
      </div>
    </div>
    </>
  );
}
