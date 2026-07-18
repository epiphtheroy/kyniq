import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import { DIGESTS, CATEGORY_LABEL, type Digest } from "@/lib/discoveries/digests";
import "./discoveries.css";

// Fully static: the digest list is a compile-time import, so this page is
// prerendered at build and regenerated on every deploy (a new digest = an edit
// to lib/discoveries/digests.ts = a deploy). No revalidate, no DB, no cache to
// poison. Single URL, #id permalinks per digest.
//
// Link policy (HANDOFF-발견피드.md §5): featured links are dofollow (a genuine
// editorial gift); the observation log is rel="nofollow" — a record that we saw
// the site, not an endorsement. Newborn domains, so also noopener/noreferrer.

export const metadata: Metadata = {
  title: "Discoveries — new film sites, as they appear",
  description:
    "A running record of newly launched film websites — festivals, cinemas, review blogs, journals, and databases — surfaced from the day's new domains and read by hand-tuned filters. An observation log, not an endorsement.",
  alternates: {
    canonical: "/discoveries",
    types: { "application/rss+xml": "/discoveries/feed.xml" },
  },
  robots: { index: true, follow: true },
};

const siteUrl = "https://metatake.net";

const totalObserved = DIGESTS.reduce(
  (n, d) => n + d.featured.length + d.observed.length,
  0
);

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: "Metatake Discoveries",
  url: `${siteUrl}/discoveries`,
  description:
    "New film websites as they appear — an observation log surfaced from newly registered domains.",
  publisher: {
    "@type": "Organization",
    name: "Metatake",
    url: siteUrl,
    "@id": `${siteUrl}/#org`,
  },
  blogPost: DIGESTS.slice(0, 30).map((d) => ({
    "@type": "BlogPosting",
    headline: `Discoveries — ${d.rangeLabel}`,
    datePublished: d.date,
    url: `${siteUrl}/discoveries#${d.id}`,
    author: { "@type": "Organization", name: "Metatake", url: siteUrl },
  })),
};

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="accent" style={{ textDecoration: "none" }}>
    {children}
  </Link>
);

function DigestBlock({ d }: { d: Digest }) {
  const listCount = d.observed.length;
  return (
    <article className="disc-digest" id={d.id}>
      <header className="disc-dhead">
        <a href={`#${d.id}`} className="disc-anchor">
          {d.rangeLabel}
        </a>
        <span className="disc-scanned">
          {d.scanned.toLocaleString()} new domains read
        </span>
      </header>

      <p className="disc-intro">{d.intro}</p>

      {d.featured.length > 0 && (
        <div className="disc-featured">
          {d.featured.map((f) => (
            <div className="disc-card" key={f.domain}>
              <div className="disc-card-top">
                <a
                  href={`https://${f.domain}`}
                  className="disc-card-name"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {f.title}
                </a>
                <span className="disc-tag">{CATEGORY_LABEL[f.category]}</span>
              </div>
              <p className="disc-card-note">{f.note}</p>
              <a
                href={`https://${f.domain}`}
                className="disc-card-url"
                target="_blank"
                rel="noopener noreferrer"
              >
                {f.domain}
              </a>
            </div>
          ))}
        </div>
      )}

      <details className="disc-log" open={d.featured.length === 0}>
        <summary className="disc-summary">
          Observation log — {listCount} {listCount === 1 ? "site" : "sites"}
        </summary>
        <ul className="disc-list">
          {d.observed.map((o) => (
            <li className="disc-row" key={o.domain}>
              <a
                href={`https://${o.domain}`}
                className="disc-row-domain"
                target="_blank"
                rel="nofollow noopener noreferrer"
              >
                {o.domain}
              </a>
              <span className="disc-row-meta">
                {CATEGORY_LABEL[o.category]}
                {o.lang && o.lang !== "?" ? ` · ${o.lang}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}

export default function DiscoveriesPage() {
  return (
    <>
      <SiteNav />
      <main className="shell">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <div className="upd-masthead">
          <div className="seclbl">The radar</div>
          <h1 className="disp upd-h1">Discoveries</h1>
          <p className="standfirst upd-standfirst">
            New film websites, roughly as they appear — festivals, cinemas, review blogs,
            journals, and databases, surfaced from the day&apos;s newly registered domains.
          </p>
          <div className="upd-metrics">
            <span className="upd-tick" aria-hidden="true" />
            <span>{totalObserved} sites logged</span>
            <span className="upd-dot" aria-hidden="true">·</span>
            <span>Seoul</span>
            <span className="upd-dot" aria-hidden="true">·</span>
            <a href="/discoveries/feed.xml" className="accent upd-rss">RSS</a>
          </div>
        </div>

        <div className="disc-thread">
          {DIGESTS.map((d) => (
            <DigestBlock key={d.id} d={d} />
          ))}
        </div>

        <hr className="rule" style={{ marginTop: 34 }} />

        <p className="ui muted disc-foot">
          How this works: each day a scanner reads the list of newly registered domains, keeps the
          ones whose names point at film, and reads each home page once to sort out the piracy
          mirrors, parked names, and unrelated businesses. What is left — real festivals, cinemas,
          writers, and archives just getting started — is logged here. Inclusion is an observation,
          not a recommendation, and observation-log links carry no ranking weight. If this is your
          site and you would rather not appear, or a detail is wrong, write to{" "}
          <a
            href="mailto:wonwoo@metatake.net"
            className="accent"
            style={{ textDecoration: "none" }}
          >
            wonwoo@metatake.net
          </a>{" "}
          and it comes down. See also <A href="/about">About</A> ·{" "}
          <A href="/updates">Updates</A>
        </p>
      </main>
    </>
  );
}
