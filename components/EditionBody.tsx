import Link from "next/link";
import SubscribeForm from "@/components/SubscribeForm";

const W500 = "https://image.tmdb.org/t/p/w500";

export type Entry = {
  rank: number; ehead: string; event: string; film_title: string; film_slug: string;
  film_year: number | null; stars: number; bd: string | null; news: string; read: string; deposit: string;
};
export type EditionPost = { slug: string; intro: string | null; entries: Entry[]; floor: { html: string }[] };

export function Stars({ n }: { n: number }) {
  const f = Math.max(0, Math.min(5, n));
  return <span className="stars">{"★".repeat(f)}{f < 5 ? <span className="o">{"★".repeat(5 - f)}</span> : null}</span>;
}

/** The reading body of one edition — shared by /blog (today's edition, in full) and /blog/[slug].
 *  Email-look: a full-width film still on top of each item, a numbered serif headline, the
 *  event→film→rhyme line, the news, the reading in a red-ruled blockquote, then the deposit box. */
export default function EditionBody({ post, inlineSub = true }: { post: EditionPost; inlineSub?: boolean }) {
  const entries = post.entries ?? [];
  return (
    <div className="blg-entries">
      {post.intro && <p className="intro" dangerouslySetInnerHTML={{ __html: post.intro }} />}
      {entries.map((e, i) => (
        <div key={e.rank}>
          <article className="blg-item">
            {e.bd && (
              <Link className="blg-shot" href={`/film/${e.film_slug}`}>
                <img src={`${W500}${e.bd}`} alt={e.film_title} loading="lazy" />
              </Link>
            )}
            <h2 className="blg-ihead"><span className="n">{e.rank}.</span> {e.ehead}</h2>
            <div className="blg-imap">
              <b className="ev">{e.event}</b><span className="ar">→</span>
              <Link className="film" href={`/film/${e.film_slug}`}>{e.film_title}</Link>
              <Stars n={e.stars} />
            </div>
            <p className="blg-news" dangerouslySetInnerHTML={{ __html: e.news }} />
            <div className="blg-read"><p dangerouslySetInnerHTML={{ __html: e.read }} /></div>
            <p className="blg-deposit"><span className="ar">→</span> <span dangerouslySetInnerHTML={{ __html: e.deposit }} /></p>
          </article>

          {inlineSub && i === 1 && (
            <div className="blg-sub-inline">
              <div className="t">Get this every morning.<small>Between Film and the World — the day&apos;s news, read as cinema. Free, almost daily.</small></div>
              <SubscribeForm source="blog-inline" dark />
            </div>
          )}
        </div>
      ))}

      {post.floor?.length > 0 && (
        <div className="blg-floor">
          <div className="blg-floor__h"><b>On the cutting-room floor</b><span>Big news, weak rhyme — so we left them.</span></div>
          <ul>
            {post.floor.map((f, i) => (
              <li key={i}><span dangerouslySetInnerHTML={{ __html: f.html }} /> <span className="cut">Cut</span></li>
            ))}
          </ul>
        </div>
      )}

      <p className="blg-method"><b>How this was made:</b> each event was reduced to a figure, then matched against the live Metatake corpus — every film and reading above was confirmed in the database before it was linked. Each rhyme becomes a permanent edge in the map. <span className="stamp">Retrieved, not remembered.</span></p>
    </div>
  );
}
