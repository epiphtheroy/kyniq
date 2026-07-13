import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import { pageRobots } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Privacy Policy — Metatake TakeScore Browser Extension",
  description:
    "Privacy policy for the Metatake TakeScore browser extension: it stores nothing, tracks nothing, and sends only the film title on the page you're viewing to look up a public score.",
  alternates: { canonical: "/privacy/extension" },
  robots: pageRobots(true),
};

export default function ExtensionPrivacyPage() {
  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap">
        <div className="mt-crumb"><Link href="/privacy">Privacy</Link></div>
        <h1 className="mt-h1">Browser Extension Privacy Policy</h1>
        <p className="mt-laconic">Metatake TakeScore — film criticism overlay · Last updated: July 2026</p>

        <p>
          This policy covers the <strong>Metatake TakeScore</strong> browser extension published by
          Metatake (metatake.net). The extension is deliberately minimal: it has no account, sets no
          cookies, shows no ads, and runs no analytics or tracking. In plain terms — it stores
          nothing about you and builds no profile of you.
        </p>

        <h2 className="mt-h2">What the extension does</h2>
        <p>
          On a film page at one of the sites it supports — Letterboxd, IMDb, TMDB, Rotten Tomatoes,
          or Wikipedia — the extension reads the <strong>film&rsquo;s title</strong> already present
          on that page (from the page&rsquo;s structured data or heading). It sends that title to the
          Metatake API (<code>https://metatake.net/api/v1</code>) to look up the film&rsquo;s public
          TakeScore, then displays a small badge linking to the criticism on metatake.net. That is
          the extension&rsquo;s entire function.
        </p>

        <h2 className="mt-h2">What data is handled, and what is not</h2>
        <ul>
          <li><strong>Sent to Metatake:</strong> only the film title on the page you are actively viewing, used solely to fetch that film&rsquo;s score. Nothing else about the page or about you is read or transmitted.</li>
          <li><strong>Not collected:</strong> no names, emails, or personal identifiers; no location; no financial or health data; no passwords or authentication tokens; no personal communications; no browsing history; no clickstream or behavioural tracking.</li>
          <li><strong>Not stored:</strong> the extension keeps no database and writes nothing to disk beyond the ordinary in-page display. It does not remember the films you look at.</li>
          <li><strong>Not shared or sold:</strong> no data is sold, rented, or transferred to any third party, and none is used for advertising, credit, or lending purposes.</li>
        </ul>

        <h2 className="mt-h2">Permissions, and why</h2>
        <ul>
          <li><strong>The film sites</strong> (Letterboxd, IMDb, TMDB, Rotten Tomatoes, Wikipedia): so a content script can read the film title on the page to identify which film you are viewing.</li>
          <li><strong>metatake.net:</strong> so the extension can fetch the read-only TakeScore data it displays.</li>
        </ul>
        <p>The extension requests no other host access and no other permissions.</p>

        <h2 className="mt-h2">When you click the badge</h2>
        <p>
          Clicking the badge opens the film&rsquo;s page on metatake.net in a new tab (the link carries
          a <code>utm_source=extension</code> tag so we can see, in aggregate, that visits came from
          the extension). Like any website, Metatake&rsquo;s servers receive normal request information
          when the API is queried or a page is opened; consistent with our{" "}
          <Link href="/privacy">site privacy practices</Link>, we retain only coarse, network-level
          signals for abuse prevention and do not use them to identify or profile individuals.
        </p>

        <h2 className="mt-h2">Changes and contact</h2>
        <p>
          If this policy changes, the updated version will be posted at this URL with a new date.
          Questions about the extension or your privacy: <a href="mailto:wonwoo@metatake.net">wonwoo@metatake.net</a>.
        </p>
      </div>
    </div>
  );
}
