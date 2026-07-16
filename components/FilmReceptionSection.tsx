import RecordToc from "@/components/read/RecordToc";
import type { AfterlifeStats, LinQuote } from "@/components/FilmLineageSection";
import { t, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import EnglishOriginalLabel from "@/components/i18n/EnglishOriginalLabel";

/**
 * Reception section — the film page's critics-&-scholarship record, reworked
 * 2026-07-08 with the record-layer grammar: a numeric chip summary + the
 * quotes worth reading in place, the full headline lists behind counted
 * curtains (scale visible before opening), and one large backdrop slate that
 * shows how much sits behind "see more" (the reviews-&-afterlife timeline).
 * Copyright rule unchanged: headlines + publishers' own link-preview text,
 * every item links out to its source.
 */
export type RcpItem = {
  kind: string; outlet: string; critic: string | null; year: number | null; tier: string;
  headline: string; verdict: string | null; url: string; dek_lead: string | null; review_year: number | null;
};

export default function FilmReceptionSection({ title, slug, reviews, papers, quotes = [], afterlife = null, locale = DEFAULT_LOCALE }: {
  title: string; slug: string; reviews: RcpItem[]; papers: RcpItem[];
  quotes?: LinQuote[]; afterlife?: AfterlifeStats | null; locale?: Locale;
}) {
  // Critic quotes/headlines are verbatim English DB prose (§1.1); on a projected
  // page the container carries lang="en" and the header a "영어 원문" chip.
  const enOrig: "en" | undefined = locale === DEFAULT_LOCALE ? undefined : "en";
  if (reviews.length + papers.length === 0) return null;

  const outlets = new Set(reviews.map((r) => r.outlet)).size;
  const venues = new Set(papers.map((r) => r.outlet)).size;
  const dated = [...reviews, ...papers].map((r) => r.review_year).filter((y): y is number => !!y && y > 1880);
  const y0 = dated.length ? Math.min(...dated) : null;
  const y1 = dated.length ? Math.max(...dated) : null;

  const Rows = ({ items }: { items: RcpItem[] }) => (
    <div className="rcp-list" style={{ padding: "2px 18px 14px 20px" }} lang={enOrig}>
      {items.map((r, i) => (
        <div key={i} className="rcp-row">
          <a className="rcp-h" href={r.url} target="_blank" rel="noopener nofollow">{r.headline}</a>
          <div className="rcp-m">{r.outlet}{r.critic ? ` · ${r.critic}` : ""}{r.review_year ?? r.year ? ` · ${r.review_year ?? r.year}` : ""}</div>
          {r.verdict ? <p className="rcp-v">“{r.verdict}”</p> : null}
        </div>
      ))}
    </div>
  );

  const Curtain = ({ label, items, open }: { label: string; items: RcpItem[]; open?: boolean }) => {
    if (!items.length) return null;
    const preview = [...new Set(items.map((r) => r.outlet))].slice(0, 4).join(" · ");
    return (
      <details className="vl-d" open={open}>
        <summary>
          <span className="vl-sum-d">{label}</span>
          <span className="vl-n">{items.length}</span>
          <span className="vl-sum-kw">{preview}{items.length > 4 ? " …" : ""}</span>
        </summary>
        <Rows items={items} />
      </details>
    );
  };

  return (
    <section className="df-sec" id="df-reception">
      <h2 className="df-h2">{t(locale, "Reception — what was written")} <EnglishOriginalLabel locale={locale} /></h2>
      <p className="df-sub">{t(locale, "What critics and scholars have written about {title} — each headline links to the source; quotes are verbatim from publishers' own link previews and paper abstracts.", { title })}</p>

      {/* ── The count, at a glance ── */}
      <div className="lin-stats">
        {reviews.length > 0 ? <span className="lin-stat" style={{ "--sc": "#D64534" } as React.CSSProperties}>🗞 {locale === DEFAULT_LOCALE ? `${reviews.length} review${reviews.length === 1 ? "" : "s"}` : t(locale, "{n} reviews", { n: reviews.length })}</span> : null}
        {outlets > 1 ? <span className="lin-stat" style={{ "--sc": "#C87A2C" } as React.CSSProperties}>{t(locale, "{n} outlets", { n: outlets })}</span> : null}
        {papers.length > 0 ? <span className="lin-stat" style={{ "--sc": "#12897A" } as React.CSSProperties}>🎓 {locale === DEFAULT_LOCALE ? `${papers.length} paper${papers.length === 1 ? "" : "s"}` : t(locale, "{n} papers", { n: papers.length })}{venues > 1 ? (locale === DEFAULT_LOCALE ? ` · ${venues} venues` : ` · ${t(locale, "{n} venues", { n: venues })}`) : ""}</span> : null}
        {y0 && y1 && y1 > y0 ? <span className="lin-stat" style={{ "--sc": "#2F6DB0" } as React.CSSProperties}>{y0}–{y1}</span> : null}
      </div>

      {/* ── The quotes worth reading in place ── */}
      {quotes.length > 0 ? (
        <div className="lin-quotes" lang={enOrig}>
          {quotes.map((q, i) => (
            <figure key={i} style={{ margin: "10px 0 0" }}>
              <blockquote className="afl-q" style={{ margin: 0 }}>“{q.text}”</blockquote>
              <figcaption className="lin-qsrc">
                — <a href={q.url} target="_blank" rel="noopener nofollow">{q.outlet}</a>
                {q.critic ? ` · ${q.critic}` : ""}{q.year ? ` · ${q.year}` : ""}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      {/* ── Every headline, behind counted curtains ── */}
      <div style={{ margin: "14px 0 0" }}>
        <Curtain label={t(locale, "Reviews")} items={reviews} open={reviews.length <= 5} />
        <Curtain label={t(locale, "Scholarship")} items={papers} />
      </div>

      {/* ── The door: a print-style index of the year-by-year timeline ── */}
      {afterlife ? (
        <div className="rec-tocs">
          <RecordToc
            href={`/film/${slug}/reception`}
            kicker={t(locale, "The full timeline")}
            title={reviews.length > 0
              ? t(locale, "What critics said about {title} — and everything since, year by year", { title })
              : t(locale, "The scholarship on {title} — and everything since, year by year", { title })}
            rows={[
              { label: t(locale, "Reviews"), value: afterlife.reviews },
              ...(afterlife.papers > 0 ? [{ label: t(locale, "Scholarship"), value: afterlife.papers }] : []),
              ...(afterlife.releases > 0 ? [{ label: t(locale, "Releases & revivals"), value: afterlife.releases }] : []),
              ...(afterlife.honors > 0 ? [{ label: t(locale, "Honors"), value: afterlife.honors }] : []),
              ...(afterlife.y0 && afterlife.y1 && afterlife.y1 > afterlife.y0 ? [{ label: t(locale, "Years covered"), value: `${afterlife.y0}–${afterlife.y1}` }] : []),
            ]}
            cta="Open the timeline"
          />
        </div>
      ) : null}

      <div className="df-src">{t(locale, "Headlines & quotes from publishers' link previews (og:description) and paper abstracts (OpenAlex/Crossref). No article text is stored.")}</div>
    </section>
  );
}
