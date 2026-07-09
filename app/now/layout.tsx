import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import SiteNav from "@/components/home2/SiteNav";
import { fmtTime } from "@/lib/now";
import "@/app/curious/curious.css";
import "./now.css";

/**
 * Now Playing section shell — same newspaper grain as /blog and /curious:
 * wordmark, a strip of the latest pieces (times ARE the nav — the clock is
 * the product), the bridge to The Daily, the subscribe pill.
 * Spec: hourly/README.md (v2).
 */

const stripDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default async function NowLayout({ children }: { children: React.ReactNode }) {
  let pieces: { slug: string; published_at: string }[] = [];
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await db
      .from("now_articles")
      .select("slug, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(8)
      .abortSignal(AbortSignal.timeout(3500));
    pieces = data ?? [];
  } catch {
    /* strip degrades to the label alone */
  }

  return (
    <div className="mt cur">
      <SiteNav />
      <div className="cur-mast">
        <div className="cur-mast__row">
          <Link className="cur-brand" href="/now">
            <span className="cur-brand__mark">Now Playing<span className="q">.</span></span>
            <span className="cur-brand__tag">What&apos;s spiking, read through the archive</span>
          </Link>
          <span style={{ flex: 1 }} />
          <Link className="cur-mast__daily" href="/blog">The Daily — the morning edition ↗</Link>
          <Link className="cur-mast__pill" href="/blog/subscribe">Subscribe</Link>
        </div>
        <nav className="cur-strip" aria-label="Latest pieces">
          <div className="cur-strip__in">
            {/* "Latest" opens the newest piece directly; "All pieces" is the list. */}
            {pieces.length ? <Link href={`/now/${pieces[0].slug}`} className="on">Latest ↗</Link> : <Link href="/now" className="on">Latest</Link>}
            <span className="d" />
            <Link href="/now">All pieces</Link>
            <span className="d" />
            <Link href="/now/wire">The wire</Link>
            {pieces.map((p) => (
              <span key={p.slug} style={{ display: "contents" }}>
                <span className="d" />
                <Link href={`/now/${p.slug}`}>{stripDay(p.published_at)} {fmtTime(p.published_at)}</Link>
              </span>
            ))}
          </div>
        </nav>
      </div>
      {children}
    </div>
  );
}
