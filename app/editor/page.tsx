import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import { pageRobots } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Wonwoo Yoon — Founder & Editor · Metatake",
  description:
    "Wonwoo Yoon is the founder and editor of Metatake. Writer on cinema in Seoul; management scholar with a Ph.D. on social capital; author of six books on Peter Drucker. Every reading on Metatake publishes under his review.",
  alternates: { canonical: "/editor" },
  robots: pageRobots(true),
};

const BIO =
  "Wonwoo Yoon is the founder and editor of Metatake, an independent platform for critical thinking through film, based in Seoul. Trained as a management scholar, with a Ph.D. on social capital, he is the author of six books on Peter Drucker and serves as global strategy officer of a healthcare-technology company. His writing sits at the intersection of those two lives: how an art survives its economics.";

export default function EditorPage() {
  // ProfilePage + Person is Google's documented markup for author/profile
  // pages. When external profiles exist (publisher pages for the books,
  // LinkedIn, Substack), add them to `sameAs` below — it's the strongest
  // entity-verification signal we can send.
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      "@id": "https://metatake.net/editor#person",
      name: "Wonwoo Yoon",
      url: "https://metatake.net/editor",
      email: "mailto:wonwoo@metatake.net",
      jobTitle: "Founder & Editor",
      worksFor: {
        "@type": "Organization",
        "@id": "https://metatake.net/#org",
        name: "Metatake",
        url: "https://metatake.net",
      },
      homeLocation: { "@type": "Place", name: "Seoul, Republic of Korea" },
      description: BIO,
      knowsAbout: [
        "Film criticism",
        "Film interpretation",
        "Peter Drucker",
        "Management",
        "Social capital",
        "Cinema",
      ],
    },
  };

  return (
    <div className="mt">
      <SiteNav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonld) }} />
      <div className="mt-wrap">
        <div className="mt-crumb"><Link href="/about">About</Link></div>
        <h1 className="mt-h1">Wonwoo Yoon</h1>
        <p className="mt-laconic">Founder &amp; editor, Metatake · Seoul</p>

        <p>{BIO}</p>

        <h2 className="mt-h2">Editorial responsibility</h2>
        <p>
          Metatake&rsquo;s readings are drafted by Metatake Editorial, an AI system built for close film
          analysis, and every one of them passes through Wonwoo&rsquo;s review before it publishes. In
          practice that means he reads each draft, checks its factual claims — dates, credits, plot details,
          scholarly attributions — and either edits it, cuts it, or signs off on it. Nothing goes live
          without that pass, and if a reading is on the site, he answers for it. There are no individual
          per-page bylines; instead every page states how it was generated and when, and points here — to
          the person accountable for the method and the standard each reading is held to.
        </p>
        <p>
          Corrections land on his desk directly: if a page states a fact wrongly, email{" "}
          <a href="mailto:wonwoo@metatake.net">wonwoo@metatake.net</a> and it will be fixed as verified. The
          full pipeline — what the AI does, what the editor does, and in what order — is documented in{" "}
          <Link href="/methodology">Methodology</Link>.
        </p>

        <h2 className="mt-h2">Background</h2>
        <p>
          Wonwoo&rsquo;s path to film criticism runs through management scholarship rather than a film
          school, and Metatake&rsquo;s method comes directly out of that training. His doctoral work was on
          social capital — the study of how value lives in relations between people and institutions rather
          than in any single node — and Metatake asks the same question of cinema: not &ldquo;what is this
          film worth?&rdquo; but &ldquo;what does it connect to?&rdquo; The site&rsquo;s core design
          decision — reading 1,900+ films as one connected map of meanings instead of a shelf of separate
          reviews — is that research instinct applied to a different corpus.
        </p>
        <p>
          Alongside Metatake he has written six books on Peter Drucker and works as global strategy officer
          of a healthcare-technology company. The question that runs underneath his current writing — and
          underneath this whole project — is how an art survives its economics.
        </p>

        <h2 className="mt-h2">Contact</h2>
        <p>
          Questions, corrections, press, and disagreements are all welcome:{" "}
          <a href="mailto:wonwoo@metatake.net">wonwoo@metatake.net</a>
        </p>

        <p className="mt-see">
          <Link href="/about">About Metatake</Link> · <Link href="/methodology">Methodology</Link>
        </p>
      </div>
    </div>
  );
}
