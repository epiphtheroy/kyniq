import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import SiteNav from "@/components/home2/SiteNav";
import "@/app/curious/curious.css";
import "./daily.css";

/**
 * The Daily section shell — ScreenRant-style masthead shared by /blog,
 * /blog/[slug] and /blog/subscribe (same grain as /curious): wordmark,
 * a strip of recent edition dates (the dates ARE the nav here), the
 * subscribe pill, and the bridge to Curious.
 */

const stripDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default async function DailyLayout({ children }: { children: React.ReactNode }) {
  let editions: { slug: string; edition_date: string }[] = [];
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await db
      .from("posts")
      .select("slug, edition_date")
      .eq("status", "published")
      .order("edition_date", { ascending: false })
      .limit(10)
      .abortSignal(AbortSignal.timeout(3500));
    editions = data ?? [];
  } catch {
    /* strip degrades to the label alone */
  }

  return (
    <div className="mt cur">
      <SiteNav />
      <div className="cur-mast">
        <div className="cur-mast__row">
          <Link className="cur-brand" href="/blog">
            <span className="cur-brand__mark">The Daily<span className="q">.</span></span>
            <span className="cur-brand__tag">Between Film and the World</span>
          </Link>
          <span style={{ flex: 1 }} />
          <Link className="cur-mast__daily" href="/curious">Curious — the question desk ↗</Link>
          <Link className="cur-mast__pill" href="/blog/subscribe">Subscribe</Link>
        </div>
        <nav className="cur-strip" aria-label="Recent editions">
          <div className="cur-strip__in">
            <Link href="/blog">Latest</Link>
            {editions.map((e) => (
              <span key={e.slug} style={{ display: "contents" }}>
                <span className="d" />
                <Link href={`/blog/${e.slug}`}>{stripDate(e.edition_date)}</Link>
              </span>
            ))}
          </div>
        </nav>
      </div>
      {children}
    </div>
  );
}
