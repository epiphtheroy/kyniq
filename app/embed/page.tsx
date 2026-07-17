import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import { pageRobots } from "@/lib/seo";
import EmbedBuilder from "@/components/EmbedBuilder";

export const metadata: Metadata = {
  title: "Embed a TakeScore Badge",
  description:
    "Add a live Metatake TakeScore badge to your film blog or article in one line. Free, self-updating, links back to the full criticism. Script or iframe.",
  alternates: { canonical: "/embed" },
  robots: pageRobots(true),
};

export default function EmbedPage() {
  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap">
        <div className="mt-crumb"><Link href="/api">API</Link></div>
        <h1 className="mt-h1">Embed a TakeScore badge</h1>
        <p className="mt-laconic">Put a live Metatake score on your own film writing — free, self-updating</p>

        <p>
          Writing about a film? Drop in its <strong>TakeScore</strong> — Metatake&rsquo;s 13-dimension
          critical assessment, computed by Metatake AI against a version-locked rubric that{" "}
          <Link href="/editor">Wonwoo Yoon</Link> designed and calibrated — as a small badge that updates
          itself and links readers to the full criticism. One line of HTML, no account, free. Attribution
          is built in: the badge always credits Metatake and links back.
        </p>

        <EmbedBuilder />

        <p className="mt-laconic" style={{ marginTop: 28 }}>
          Want the raw numbers instead? The <Link href="/api">REST API</Link> returns the full
          breakdown as JSON. Licensed CC BY-NC 4.0.
        </p>
      </div>
    </div>
  );
}
