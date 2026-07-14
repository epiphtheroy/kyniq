"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import NewsletterCard from "./NewsletterCard";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const IMG = "https://image.tmdb.org/t/p/w500";

type Entry = { ehead?: string; event?: string; film_title?: string; bd?: string | null };
type Post = { slug: string; title: string; edition_date: string; dek: string | null; intro: string | null; read_min: number | null; entries: Entry[] };

const mon = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
// The edition's own headline (recipe lever 5) leads; item-1's head is the
// fallback for legacy rows that still carry the bare series name.
const headOf = (p: Post) =>
  (p.title && p.title.toLowerCase() !== "between film and the world" ? p.title : "") ||
  p.entries?.[0]?.ehead ||
  p.title;
const relOf = (p: Post) => { const e = p.entries?.[0]; return e ? [e.event, e.film_title].filter(Boolean).join(" → ") : ""; };

// "Between Film and the World" — the daily column rendered as specific edition
// cards (real headline · the event→film it turns on · excerpt · still), with the
// "Today's newsletter" subscribe card on the right.
export default function BlogGraph() {
  const [posts, setPosts] = useState<Post[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await sb
        .from("posts")
        .select("slug, title, edition_date, dek, intro, read_min, entries")
        .eq("status", "published")
        .order("edition_date", { ascending: false })
        .limit(5);
      setPosts((data as Post[] | null) ?? []);
    })();
  }, []);

  const lead = posts?.[0] ?? null;
  const more = posts ? posts.slice(1) : [];
  const leadBd = lead?.entries?.[0]?.bd ?? null;

  return (
    <section className="band p2">
      <div className="wrap">
        <div className="shead">
          <div>
            <h2>Between Film and the World <span className="chev">›</span></h2>
            <div className="sub">The daily column — each day&apos;s events, read through the film that already knew.</div>
          </div>
          <Link className="seeall" href="/blog">All editions ›</Link>
        </div>
        <div className="news">
          <div className="newsmain">
            {lead ? (
              <Link className="lead" href={`/blog/${lead.slug}`} id="lead">
                <div className="th">
                  {leadBd ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`${IMG}${leadBd}`} alt={lead?.entries?.[0]?.film_title ? `${lead.entries[0].film_title} — still` : ""} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : null}
                </div>
                <div>
                  <div className="hl">{headOf(lead)}</div>
                  {relOf(lead) ? <div className="blg-rel">{relOf(lead)}</div> : null}
                  <div className="ex">{lead.dek || lead.intro}</div>
                  <div className="src">{mon(lead.edition_date)} · {new Date(lead.edition_date + "T00:00:00").getFullYear()} · {lead.read_min ?? 6} min read</div>
                </div>
              </Link>
            ) : <div className="lead lead--skel" />}
            <div className="sub2" id="sub2">
              {more.map((p) => (
                <Link className="na" href={`/blog/${p.slug}`} key={p.slug}>
                  <div className="th">
                    {p.entries?.[0]?.bd ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`${IMG}${p.entries[0].bd}`} alt={p.entries?.[0]?.film_title ? `${p.entries[0].film_title} — still` : ""} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : null}
                  </div>
                  <div>
                    <div className="hl">{headOf(p)}</div>
                    {p.entries?.[0]?.film_title ? <div className="blg-rel">{p.entries[0].film_title}</div> : null}
                    <div className="src">{mon(p.edition_date)} · {p.read_min ?? 5} min</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
          <NewsletterCard />
        </div>
      </div>
    </section>
  );
}
