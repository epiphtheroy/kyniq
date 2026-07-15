import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import { UPDATES, CATEGORY_LABEL, type UpdatePost } from "@/lib/updates/posts";

// Fully static: the feed is a compile-time import, so this page is prerendered
// at build and regenerated on every deploy (a new post = an edit here = a
// deploy). No revalidate, no DB, no cache to poison.

export const metadata: Metadata = {
  title: "Updates",
  description:
    "What is new at Metatake — features, data releases, API and MCP work, policy, search-index status, and films added. Dated, in order, newest first.",
  alternates: {
    canonical: "/updates",
    types: { "application/rss+xml": "/updates/feed.xml" },
  },
  robots: { index: true, follow: true },
};

const siteUrl = "https://metatake.net";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: "Metatake Updates",
  url: `${siteUrl}/updates`,
  description: "The running record of what changes on Metatake.",
  publisher: { "@type": "Organization", name: "Metatake", url: siteUrl, "@id": `${siteUrl}/#org` },
  blogPost: UPDATES.slice(0, 30).map((p) => ({
    "@type": "BlogPosting",
    headline: p.title,
    datePublished: p.date,
    url: `${siteUrl}/updates#${p.id}`,
    articleSection: CATEGORY_LABEL[p.cat],
    author: { "@type": "Organization", name: "Metatake", url: siteUrl },
  })),
};

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="accent" style={{ textDecoration: "none" }}>
    {children}
  </Link>
);

// Body mini-grammar: [text](href) links only. Internal → Link, external → <a>.
function renderBody(body: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(body))) {
    if (m.index > last) out.push(body.slice(last, m.index));
    const [, text, href] = m;
    out.push(
      href.startsWith("/") ? (
        <Link key={k++} href={href} className="accent" style={{ textDecoration: "none" }}>
          {text}
        </Link>
      ) : (
        <a
          key={k++}
          href={href}
          className="accent"
          style={{ textDecoration: "none" }}
          target="_blank"
          rel="noopener"
        >
          {text}
        </a>
      )
    );
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push(body.slice(last));
  return out;
}

// Local-parse (append T00:00:00) so YYYY-MM-DD never rolls back a day.
const asDate = (d: string) => new Date(d + "T00:00:00");
const shortDate = (d: string) =>
  asDate(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const longDate = (d: string) =>
  asDate(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const monthLabel = (d: string) =>
  asDate(d).toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase();

export default function UpdatesPage() {
  let lastMonth = "";

  return (
    <>
      <SiteNav />
      <main className="shell">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <h1 className="disp" style={{ fontSize: 30, margin: "28px 0 0" }}>
          Updates
        </h1>
        <p className="standfirst" style={{ margin: "14px 0 0", maxWidth: "62ch" }}>
          What is new at Metatake — features, data releases, policy, and the state of the index,
          dated and in order.
        </p>
        <p className="ui muted" style={{ fontSize: 13.5, margin: "10px 0 0" }}>
          {UPDATES.length} entries ·{" "}
          <a href="/updates/feed.xml" className="accent" style={{ textDecoration: "none" }}>
            RSS
          </a>
        </p>

        <hr className="rule" />

        <section aria-label="Updates timeline" style={{ display: "grid", gap: 0 }}>
          {UPDATES.map((p: UpdatePost, i: number) => {
            const month = p.date.slice(0, 7);
            const newMonth = month !== lastMonth;
            lastMonth = month;
            return (
              <div key={p.id}>
                {newMonth && (
                  <>
                    {i > 0 && <hr className="rule" />}
                    <div className="seclbl">{monthLabel(p.date)}</div>
                    <div className="tick" />
                  </>
                )}
                {!newMonth && <hr className="rule" />}
                <article id={p.id} style={{ scrollMarginTop: 70 }}>
                  <div
                    className="ui muted"
                    style={{ fontSize: 12.5, display: "flex", gap: 8, alignItems: "baseline" }}
                  >
                    <time dateTime={p.date} title={longDate(p.date)}>
                      {shortDate(p.date)}
                    </time>
                    <span aria-hidden="true">·</span>
                    <span
                      style={{
                        textTransform: "uppercase",
                        letterSpacing: ".1em",
                        fontSize: 10.5,
                        fontWeight: 600,
                      }}
                    >
                      {CATEGORY_LABEL[p.cat]}
                    </span>
                    <a
                      href={`#${p.id}`}
                      className="muted"
                      aria-label="Link to this update"
                      style={{ marginLeft: "auto", textDecoration: "none" }}
                    >
                      §
                    </a>
                  </div>
                  <h2 className="disp" style={{ fontSize: 18, margin: "5px 0 0", lineHeight: 1.25 }}>
                    {p.title}
                  </h2>
                  <p className="body reading" style={{ fontSize: 16, margin: "8px 0 0" }}>
                    {renderBody(p.body)}
                  </p>
                </article>
              </div>
            );
          })}
        </section>

        <hr className="rule" />

        <p className="ui muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
          Entries before July 15, 2026 were reconstructed from the project log when this page
          launched. From here, each change is posted on the day it ships. Corrections, questions,
          press:{" "}
          <a href="mailto:wonwoo@metatake.net" className="accent" style={{ textDecoration: "none" }}>
            wonwoo@metatake.net
          </a>
          {" "}· See also <A href="/about">About</A> · <A href="/methodology">Methodology</A>
        </p>
      </main>
    </>
  );
}
