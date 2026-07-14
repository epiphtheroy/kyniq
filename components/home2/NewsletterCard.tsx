"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import SubscribeForm from "@/components/SubscribeForm";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const W342 = "https://image.tmdb.org/t/p/w342";

type Entry = { ehead?: string; event?: string; film_title?: string; film_slug?: string; bd?: string | null };
type Post = { slug: string; title: string; edition_date: string; dek: string | null; intro: string | null; entries: Entry[] };

const fullDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

// Home foot — "Today's newsletter": the latest Between-Film-and-the-World edition
// shown as a blog-summary card (date · specific headline · event→film · excerpt),
// with the subscribe field beneath it.
export default function NewsletterCard() {
  const [post, setPost] = useState<Post | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await sb
        .from("posts")
        .select("slug, title, edition_date, dek, intro, entries")
        .eq("status", "published")
        .order("edition_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setPost(data as Post);
    })();
  }, []);

  const e0 = post?.entries?.[0];
  const head = e0?.ehead || post?.title || "Today's edition";
  const excerpt = post?.dek || post?.intro || "";

  return (
    <aside className="nlc">
      <div className="nlc-kick"><span className="nlc-dot" /> Today&apos;s newsletter{post ? <> · {fullDate(post.edition_date)}</> : null}</div>

      {post ? (
        <Link className="nlc-card" href={`/blog/${post.slug}`}>
          {e0?.bd ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="nlc-th" src={`${W342}${e0.bd}`} alt={e0?.film_title ? `${e0.film_title} — still` : ""} loading="lazy" />
          ) : null}
          <div className="nlc-body">
            {e0?.event ? (
              <div className="nlc-rel"><b>{e0.event}</b>{e0.film_title ? <> <span className="nlc-ar">→</span> {e0.film_title}</> : null}</div>
            ) : null}
            <div className="nlc-head">{head}</div>
            {excerpt ? <p className="nlc-ex">{excerpt}</p> : null}
            <span className="nlc-go">Read today&apos;s edition →</span>
          </div>
        </Link>
      ) : (
        <div className="nlc-card nlc-card--skel" />
      )}

      <div className="nlc-sub">
        <div className="nlc-sk">Get it each morning — free</div>
        <SubscribeForm source="home-newsletter" />
        <p className="nlc-fine">No spam. Unsubscribe anytime.</p>
      </div>
    </aside>
  );
}
