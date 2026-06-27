"use client";

import Link from "next/link";
import type { HomeV2 } from "@/lib/home2";
import { hashTone, tone, blogHref, backdropUrl } from "./helpers";
import NewsletterCard from "./NewsletterCard";

// "Between Film and the World" — daily column + the original constellation graph
// (EntityGraph force renderer), with film-still thumbnails on the article cards.
export default function BlogGraph({ data }: { data: HomeV2 }) {
  const { lead, more } = data.blog;
  // Decorative film stills for the article thumbnails (the column is "the films
  // that already knew") — reuse newly-mapped backdrops, deterministic per card.
  const stills = data.newly.map((n) => n.backdrop).filter(Boolean) as string[];
  const leadBd = stills[0] ?? null;

  return (
    <section className="band p2">
      <div className="wrap">
        <div className="shead">
          <div>
            <h2>
              Between Film and the World <span className="chev">›</span>
            </h2>
            <div className="sub">
              The daily column — the day&apos;s events, and the films that already knew · with the live map
            </div>
          </div>
          <Link className="seeall" href="/blog">
            All editions ›
          </Link>
        </div>
        <div className="news">
          <div className="newsmain">
            <Link className="lead" href={blogHref(lead.slug)} id="lead">
              <div className="th" style={{ background: tone(hashTone(lead.title)) }}>
                {leadBd ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={backdropUrl(leadBd)!} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : null}
              </div>
              <div>
                <div className="hl">
                  <em>Between Film and the World</em> — the day&apos;s events, and the films that already knew
                </div>
                <div className="ex">{lead.dek}</div>
                <div className="src">{lead.meta}</div>
              </div>
            </Link>
            <div className="sub2" id="sub2">
              {more.map((a, i) => {
                const bd = stills[(i + 1) % Math.max(1, stills.length)] ?? null;
                return (
                  <Link className="na" href={blogHref(a.slug)} key={i}>
                    <div className="th" style={{ background: tone(hashTone(a.title)) }}>
                      {bd ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={backdropUrl(bd)!} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : null}
                    </div>
                    <div>
                      <div className="hl">{a.title}</div>
                      <div className="src">{a.meta}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
          <NewsletterCard />
        </div>
      </div>
    </section>
  );
}
