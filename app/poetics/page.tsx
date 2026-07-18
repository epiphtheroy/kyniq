import type { Metadata } from "next";
import Link from "next/link";
import { pageRobots } from "@/lib/seo";
import { POE_CATEGORIES, POE_ESSAYS, poeHref, poeCategoryEntryHref, poeEssaysInCategory } from "@/lib/poetics/registry";
import { POE_BODIES } from "@/lib/poetics/content";

export const revalidate = 3600;
const SITE = "https://metatake.net";

export const metadata: Metadata = {
  title: "Poetics — open questions from building a critical map of cinema",
  description:
    "Essays from one editor's desk — drafted by Metatake AI from Wonwoo Yoon's own viewing log and signed off by him — on the questions he could not avoid while building Metatake: what a masterpiece is, what to watch, why the figure is the unit of reading, how to file a century of theory, and where cinema actually lives.",
  alternates: { canonical: "/poetics" },
  robots: pageRobots(true),
};

export default function PoeticsHub() {
  const published = POE_ESSAYS.filter((e) => POE_BODIES[e.slug]);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Poetics",
    url: `${SITE}/poetics`,
    isPartOf: { "@type": "WebSite", "@id": "https://metatake.net" },
    author: { "@type": "Person", name: "Wonwoo Yoon", url: `${SITE}/editor` },
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="poe-h1">Poetics</h1>
      <p className="poe-standfirst">Open questions from building a critical map of cinema.</p>
      <p className="poe-byline">
        One editor&apos;s desk — drafted by Metatake AI from the editor&apos;s own viewing log, directed &amp; signed
        off by <Link href="/editor">Wonwoo Yoon</Link>
      </p>

      <p className="body reading" style={{ fontSize: 18, margin: "20px 0 0", maxWidth: "64ch" }}>
        Building this site meant answering questions I had no right to consider settled — what makes a film a
        masterpiece, which films are worth an evening, why a small object is a better unit of reading than a plot.
        These are essays about those questions, and about the specific, arguable choices I made when a real page
        needed a real answer. The rest of the site speaks as an editorial desk; these notes are drafted by Metatake AI
        from my own viewing log, and I sign off on each one — they mostly end in a question rather than a claim. Where
        the site already documents <em>how</em> a thing is built, I link to it and try not to repeat myself — the{" "}
        <Link href="/methodology" className="accent" style={{ textDecoration: "none" }}>methodology</Link> pages are the
        reference; this is the argument.
      </p>

      <hr className="rule" style={{ margin: "26px 0" }} />
      <div className="seclbl">The essays</div>
      <div className="tick" />
      <div className="poe-cards">
        {POE_CATEGORIES.map((c) => {
          const n = poeEssaysInCategory(c.key).filter((e) => POE_BODIES[e.slug]).length;
          return (
            <Link key={c.key} href={poeCategoryEntryHref(c.key)} className="poe-card">
              <div className="poe-card__label">{c.label}</div>
              <div className="poe-card__blurb">{c.blurb}</div>
              {n > 0 ? <div className="poe-card__n">{n} essay{n === 1 ? "" : "s"}</div> : null}
            </Link>
          );
        })}
      </div>

      {POE_CATEGORIES.map((c) => {
        const essays = poeEssaysInCategory(c.key).filter((e) => POE_BODIES[e.slug]);
        if (!essays.length) return null;
        return (
          <div key={c.key} style={{ margin: "28px 0 0" }}>
            <div className="seclbl">{c.label}</div>
            <div className="tick" />
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {essays.map((e) => (
                <li key={e.slug} style={{ margin: "0 0 12px" }}>
                  <Link href={poeHref(e.slug)} className="accent" style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 700, textDecoration: "none" }}>
                    {e.title}
                  </Link>
                  <div className="ui muted" style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 2, maxWidth: "64ch" }}>{e.desc}</div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      {published.length === 0 ? (
        <p className="ui muted" style={{ fontSize: 14, marginTop: 20 }}>The first essays are being written.</p>
      ) : null}
    </main>
  );
}
