import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import { pageRobots } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Wonwoo Yoon — Editor · Metatake",
  description: "Wonwoo Yoon, founder and editor of Metatake — writer on cinema, management scholar, and author of six books on Peter Drucker.",
  robots: pageRobots(true),
};

const BIO =
  "Wonwoo Yoon writes on cinema from Seoul, where he founded and runs a platform for critical thinking through film. Trained as a management scholar, with a Ph.D. on social capital, he is the author of six books on Peter Drucker and serves as global strategy officer of a healthcare-technology company. The intersection of those two lives—how an art survives its economics—is the subject of his current writing.";

export default function EditorPage() {
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Wonwoo Yoon",
    jobTitle: "Founder & Editor",
    worksFor: { "@type": "Organization", name: "Metatake", url: "https://metatake.net" },
    homeLocation: { "@type": "Place", name: "Seoul, Republic of Korea" },
    description: BIO,
    knowsAbout: ["Film criticism", "Peter Drucker", "Management", "Social capital", "Cinema"],
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

        <h2 className="mt-h2">Editorial role</h2>
        <p>
          Metatake&rsquo;s readings are drafted by an AI editorial method and published under Wonwoo&rsquo;s
          editorial direction. There are no individual per-page bylines; instead every page states how it was
          generated and when, and points here — to the person accountable for the method, the register model,
          and the standard each reading is held to. How an art survives its economics is the question that runs
          underneath the whole project.
        </p>
        <p className="mt-see">
          <Link href="/about">About Metatake</Link>
        </p>
      </div>
    </div>
  );
}
