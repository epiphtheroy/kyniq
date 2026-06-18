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

/** The reading body of one edition — shared by /blog (today's edition, in full) and /blog/[slug]. */
export default function EditionBody({ post, inlineSub = true }: { post: EditionPost; inlineSub?: boolean }) {
  const entries = post.entries ?? [];
  return (
    <div className="blg-entries">
      {post.intro && <p className="intro" dangerouslySetInnerHTML={{ __html: post.intro }} />}
      {entries.map((e, i) => (
        <div key={e.rank}>
          <div className="blg-entry">
            <div className="erank">{e.rank}</div>
            <div className="ebody">
              <h2 className="ehead">{e.ehead}</h2>
              <div className="blg-emap">
                <span className="ev">{e.event}</span><span className="ar">→</span>
                <Link className="film" href={`/film/${e.film_slug}`}>{e.film_title}</Link>
                <Stars n={e.stars} /><span className="rl">rhyme</span>
              </div>
              <p className="blg-news" dangerouslySetInnerHTML={{ __html: e.news }} />
              <p className="blg-read" dangerouslySetInnerHTML={{ __html: e.read }} />
              <p className="blg-deposit"><span style={{ color: "var(--accent)", fontWeight: 700, marginRight: 4 }}>→</span><span dangerouslySetInnerHTML={{ __html: e.deposit }} /></p>
            </div>
            <div className="blg-ethumb">
              <Link className="pic" href={`/film/${e.film_slug}`}>{e.bd && <img src={`${W500}${e.bd}`} alt={e.film_title} loading="lazy" />}</Link>
              <div className="cap"><b>{e.film_title}</b>{e.film_year ? ` · ${e.film_year}` : ""}</div>
            </div>
          </div>
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
