import Link from "next/link";
import type { ReadingCard } from "@/lib/home2";
import { posterUrl, figureHref } from "./helpers";

/**
 * "From the readings desk" — the front page of the readings corpus, replacing
 * the bare trope list (owner's note 2026-07-11: draw from the READINGS, make it
 * something you want to read — a news box with titles and body showing).
 * One lead reading (big serif title + 3-line excerpt) + four secondary items
 * (title + 1-line excerpt), all deep-linking to their figure page, plus a
 * "corners" strip introducing the desks the readings feed. Rotates hourly with
 * the rest of the home (home_readings_desk, seeded). Renders nothing if empty.
 */
export default function ReadingsDesk({ items }: { items: ReadingCard[] | null }) {
  if (!items || items.length === 0) return null;
  const [lead, ...rest] = items;
  const side = rest.slice(0, 4);

  return (
    <section className="band p2">
      <div className="wrap">
        <div className="shead">
          <div>
            <h2>From the readings <span className="chev">›</span></h2>
            <div className="sub">What the desk is arguing right now — strong readings pulled live from the corpus, one figure at a time.</div>
          </div>
          <Link className="seeall" href="/curious">All the desks ›</Link>
        </div>

        <div className="rdx">
          {/* lead article */}
          <Link className="rdx-lead" href={figureHref(lead.slug, lead.figSlug)}>
            {posterUrl(lead.poster) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="rdx-art" src={posterUrl(lead.poster)!} alt={`${lead.film}${lead.year ? ` (${lead.year})` : ""} poster`} loading="lazy" />
            ) : null}
            <div className="rdx-lead-body">
              <div className="rdx-kick">
                {lead.framework ? <span className="rdx-fw">{lead.framework}</span> : null}
                <span className="rdx-film">{lead.film}{lead.year ? ` (${lead.year})` : ""}</span>
              </div>
              <h3 className="rdx-title">{lead.title}</h3>
              <p className="rdx-ex">{lead.excerpt}…</p>
              <div className="rdx-meta">
                {lead.figure ? <>via <b>{lead.figure}</b> · </> : null}read the full take →
              </div>
            </div>
          </Link>

          {/* secondary column */}
          <div className="rdx-side">
            {side.map((r, i) => (
              <Link className="rdx-item" href={figureHref(r.slug, r.figSlug)} key={i}>
                <div className="rdx-kick">
                  {r.framework ? <span className="rdx-fw">{r.framework}</span> : null}
                  <span className="rdx-film">{r.film}{r.year ? ` (${r.year})` : ""}</span>
                </div>
                <h4 className="rdx-t2">{r.title}</h4>
                <p className="rdx-ex2">{r.excerpt}…</p>
              </Link>
            ))}
          </div>
        </div>

        {/* the corners these readings feed */}
        <div className="rdx-corners">
          <span className="rdx-c-k">The corners</span>
          <Link href="/curious/misreadings">Strong misreadings</Link>
          <Link href="/curious">Curious questions</Link>
          <Link href="/tropes">The tropes</Link>
          <Link href="/concept">The concepts</Link>
          <Link href="/theorist">The theorists</Link>
        </div>
      </div>
    </section>
  );
}
