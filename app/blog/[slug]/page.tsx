import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import SubscribeForm from "@/components/SubscribeForm";
import EditionBody, { type EditionPost } from "@/components/EditionBody";

export const revalidate = 120;
export async function generateStaticParams() { return []; }

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

type Post = EditionPost & { title: string; edition_date: string; dek: string | null; read_min: number };
interface Props { params: Promise<{ slug: string }>; }

const full = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const mon = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

async function load(slug: string) {
  const supabase = db();
  const { data } = await supabase.from("posts").select("slug, title, edition_date, dek, read_min, intro, entries, floor").eq("slug", slug).eq("status", "published").maybeSingle();
  return (data as Post | null) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) return { title: "Edition not found — metatake blog" };
  const title = p.title
    ? `${p.title} — Between Film and the World`
    : `Between Film and the World · ${mon(p.edition_date)}`;
  const description = p.dek ?? undefined;
  return { title, description, openGraph: { title, ...(description ? { description } : {}), type: "article" }, alternates: { canonical: `/blog/${slug}` } };
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params;
  const p = await load(slug);
  if (!p) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://metatake.net";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: p.title || `Between Film and the World · ${mon(p.edition_date)}`,
    ...(p.dek ? { description: p.dek } : {}),
    datePublished: p.edition_date,
    url: `${siteUrl}/blog/${slug}`,
    isPartOf: { "@type": "Blog", name: "Between Film and the World", url: `${siteUrl}/blog` },
    author: { "@type": "Organization", name: "Metatake", url: siteUrl },
    publisher: { "@type": "Organization", name: "Metatake", url: siteUrl },
  };

  return (
    <div className="mt">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteNav />
      <div className="blg">
        <div className="blg-bar">
          <div className="blg-bar__row">
            <Link className="col" href="/blog">Between Film and the <span className="red">World</span></Link>
            <span className="tag">Metatake&apos;s daily</span>
            <span className="sp" />
            <Link className="sub-btn" href="/blog/subscribe">Subscribe</Link>
          </div>
        </div>

        <article className="blg-article">
          <p className="blg-eyebrow">Metatake&apos;s daily · The wire, read as a film</p>
          <h1 className="blg-title">Between Film and the World</h1>
          {p.dek && <p className="dek">{p.dek}</p>}
          <div className="blg-byline"><b>{full(p.edition_date)}</b><span className="dot" /><span>{p.read_min} min read</span><span className="dot" /><span>The Metatake desk</span></div>

          <EditionBody post={p} />

          <div className="blg-sub-box" id="sub">
            <p className="k">Between Film and the World</p>
            <h3>The day&apos;s news, read as cinema.</h3>
            <p>One short edition, almost every morning — five events and the films that already knew. Free. No spam, unsubscribe anytime.</p>
            <SubscribeForm source="blog-post" />
            <p className="fine">Join the readers getting the wire through cinema.</p>
          </div>

          <div className="blg-endrow">
            <Link className="wander" href="/">Wander Metatake →</Link>
            <Link className="wander" href="/blog">All editions →</Link>
          </div>
        </article>
      </div>
    </div>
  );
}
