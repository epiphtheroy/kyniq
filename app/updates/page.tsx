import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import UpdatesThread from "@/components/UpdatesThread";
import { UPDATES, CATEGORY_LABEL } from "@/lib/updates/posts";
import "./updates.css";

// Fully static: the feed is a compile-time import, so this page is prerendered
// at build and regenerated on every deploy (a new post = an edit here = a
// deploy). No revalidate, no DB, no cache to poison. Pagination and filtering
// are client-side (UpdatesThread) on this one URL, so #id permalinks stay
// stable even as new posts push older ones onto later pages.

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

export default function UpdatesPage() {
  return (
    <>
      <SiteNav />
      <main className="shell">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <div className="upd-masthead">
          <div className="seclbl">The record</div>
          <h1 className="disp upd-h1">Updates</h1>
          <p className="standfirst upd-standfirst">
            What is new at Metatake — features, data releases, policy, and the state of the index,
            dated and in order.
          </p>
          <div className="upd-metrics">
            <span className="upd-tick" aria-hidden="true" />
            <span>{UPDATES.length} entries</span>
            <span className="upd-dot" aria-hidden="true">·</span>
            <span>Seoul</span>
            <span className="upd-dot" aria-hidden="true">·</span>
            <a href="/updates/feed.xml" className="accent upd-rss">RSS</a>
          </div>
        </div>

        <UpdatesThread posts={UPDATES} />

        <hr className="rule" style={{ marginTop: 34 }} />

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
