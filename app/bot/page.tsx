import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import { pageRobots } from "@/lib/seo";

export const metadata: Metadata = {
  title: { absolute: "MetatakeBot — Our Crawler" },
  description:
    "MetatakeBot is the identified web crawler operated by Metatake (metatake.net). It respects robots.txt, fetches only the pages it needs, and identifies itself with a stable User-Agent that links back here.",
  alternates: { canonical: "/bot" },
  robots: pageRobots(true),
};

const UA = "Mozilla/5.0 (compatible; MetatakeBot/1.0; +https://metatake.net/bot)";

export default function BotPage() {
  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap">
        <div className="mt-crumb"><Link href="/about">About</Link></div>
        <h1 className="mt-h1">MetatakeBot</h1>
        <p className="mt-laconic">The identified crawler operated by Metatake · metatake.net</p>

        <p>
          If you found this page in your server logs, a request came from{" "}
          <strong>MetatakeBot</strong> — the web crawler run by{" "}
          <a href="https://metatake.net">Metatake</a>, an independent platform for reading films
          closely. We publish this page so our crawler is never anonymous: every request it makes
          carries a User-Agent that links straight back here, so you always know who visited and why.
        </p>

        <h2 className="mt-h2">How to identify it</h2>
        <p>MetatakeBot sends this User-Agent on every request:</p>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "var(--mt-code-bg, rgba(0,0,0,0.05))",
            padding: "0.75rem 1rem",
            borderRadius: 6,
            fontSize: "0.85rem",
            overflowX: "auto",
          }}
        >
          {UA}
        </pre>

        <h2 className="mt-h2">What it does</h2>
        <p>
          Metatake maintains research data about films — credits, release history, honors, critical
          reception, and geographic references. To keep that data accurate we occasionally fetch
          public reference sources (for example Wikidata, Wikipedia, OpenAlex, Crossref, and
          publicly listed review pages) and, when another site references or links to us, we may
          fetch that page once to confirm the reference. We&rsquo;re a small, human-run project, not
          a data broker.
        </p>

        <h2 className="mt-h2">How it behaves</h2>
        <ul>
          <li>It obeys <code>robots.txt</code>. If you disallow it, it will not crawl.</li>
          <li>It fetches the specific page it needs — it does not mass-mirror sites.</li>
          <li>It requests slowly and does not hammer servers.</li>
          <li>It does not attempt logins, submit forms, or access anything behind authentication.</li>
          <li>It collects no personal data.</li>
        </ul>

        <h2 className="mt-h2">If you&rsquo;d rather it didn&rsquo;t visit</h2>
        <p>Add this to your <code>robots.txt</code> and MetatakeBot will stay away:</p>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "var(--mt-code-bg, rgba(0,0,0,0.05))",
            padding: "0.75rem 1rem",
            borderRadius: 6,
            fontSize: "0.85rem",
            overflowX: "auto",
          }}
        >
          {"User-agent: MetatakeBot\nDisallow: /"}
        </pre>
        <p>
          You can also block it at the server or firewall level by its User-Agent string. Either
          way it will comply immediately on its next visit.
        </p>

        <h2 className="mt-h2">Contact</h2>
        <p>
          Questions, complaints, or a request to slow down or stop — email{" "}
          <a href="mailto:wonwoo@metatake.net">wonwoo@metatake.net</a> and a human will answer.
        </p>

        <p className="mt-see">
          <Link href="/about">About Metatake</Link> · <Link href="/editor">Editor</Link> ·{" "}
          <Link href="/methodology">Methodology</Link>
        </p>
      </div>
    </div>
  );
}
