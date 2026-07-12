import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import { pageRobots } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Wonwoo Yoon — Founder & Editor · Metatake",
  description:
    "Wonwoo Yoon (pen name of Wonwoo Je, 제원우) is the founder and editor of Metatake. Ph.D. in business administration (Kyung Hee University); lead author of the six-volume series The Doctors Peter Drucker Saved. Every reading on Metatake publishes under the review of the editorial desk he leads.",
  alternates: { canonical: "/editor" },
  robots: pageRobots(true),
};

const KYOBO_AUTHOR_URL =
  "https://search.kyobobook.co.kr/search?keyword=%EC%A0%9C%EC%9B%90%EC%9A%B0&chrcCode=1115945501";
const RISS_THESIS_URL =
  "https://www.riss.kr/search/detail/DetailView.do?p_mat_type=be54d9b8bc7cdb09&control_no=a449fa46c284353fffe0bdc3ef48d419";

const BIO =
  "Wonwoo Yoon is the pen name under which Wonwoo Je (제원우) writes on film. He is the founder and editor of Metatake, an independent platform for critical thinking through film, based in Seoul, and works with a small editorial desk that reviews everything the site publishes. A management scholar with a Ph.D. in business administration from Kyung Hee University, he is the lead author of the six-volume hospital-management series The Doctors Peter Drucker Saved. Before any of that, though, he is a devotee of cinema — and especially of the Korean director Hong Sang-soo, on whom he has written a complete cycle of essays, one on each of Hong's thirty-four films, a manuscript now in submission and due to appear here on Metatake before long.";

export default function EditorPage() {
  // ProfilePage + Person is Google's documented markup for author/profile
  // pages. sameAs points at external records that verify the credentials
  // (publisher author page, doctoral thesis record).
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      "@id": "https://metatake.net/editor#person",
      name: "Wonwoo Yoon",
      alternateName: ["Wonwoo Je", "제원우"],
      url: "https://metatake.net/editor",
      email: "mailto:wonwoo@metatake.net",
      jobTitle: "Founder & Editor",
      worksFor: {
        "@type": "Organization",
        "@id": "https://metatake.net/#org",
        name: "Metatake",
        url: "https://metatake.net",
      },
      alumniOf: {
        "@type": "CollegeOrUniversity",
        name: "Kyung Hee University",
      },
      homeLocation: { "@type": "Place", name: "Seoul, Republic of Korea" },
      description: BIO,
      sameAs: [KYOBO_AUTHOR_URL, RISS_THESIS_URL],
      knowsAbout: [
        "Film criticism",
        "Film interpretation",
        "Hong Sang-soo",
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
          analysis, and every one of them passes through the editorial desk&rsquo;s review — led by Wonwoo —
          before it publishes. In practice a human reads each draft, checks its factual claims — dates,
          credits, plot details, scholarly attributions — and either edits it, cuts it, or signs off on it.
          That final read sits on top of automated checks that surface the risky drafts first, so attention
          lands where it is most needed rather than being spread thin across everything at once. Nothing goes
          live without that pass, and if a reading is on the site, the desk answers for it. There are no
          individual per-page bylines; instead every page states how it was generated and when, and points
          here — to the people accountable for the method and the standard each reading is held to.
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
          school, and Metatake&rsquo;s method comes directly out of that training. His{" "}
          <a href={RISS_THESIS_URL} target="_blank" rel="noopener">doctoral research</a> — a
          Ph.D. in business administration from Kyung Hee University (2022) — examined shared leadership
          and linking social capital: how people grow through the relations that connect them across
          organizational lines. Social capital is the study of how value lives in relations rather than in
          any single node, and Metatake asks the same question of cinema: not &ldquo;what is this film
          worth?&rdquo; but &ldquo;what does it connect to?&rdquo; The site&rsquo;s core design decision —
          reading 1,900+ films as one connected map of meanings instead of a shelf of separate reviews — is
          that research instinct applied to a different corpus.
        </p>
        <p>
          Alongside the scholarship there is the plainer fact that he simply loves films — and loves arguing
          with them. He is a particular devotee of the Korean director Hong Sang-soo, on whom he has written a
          complete cycle of essays, one on each of Hong&rsquo;s thirty-four films; the manuscript is in
          submission and will appear here on Metatake before long. The question that runs underneath both the
          criticism and this whole project is the same: how an art survives its economics.
        </p>

        <h2 className="mt-h2">Selected work</h2>
        <p>
          As <span lang="ko">제원우</span>, he is the lead author of{" "}
          <a href={KYOBO_AUTHOR_URL} target="_blank" rel="noopener">
            <em>The Doctors Peter Drucker Saved</em>
          </a>{" "}
          (<span lang="ko">피터 드러커가 살린 의사들</span>), a six-volume series on hospital management
          through Peter Drucker&rsquo;s thought, published between 2013 and 2022, and a co-author of{" "}
          <em>Happy Management Stories for Hospital People</em> (<span lang="ko">병원 사람들을 위한 행복한
          경영이야기</span>, Gimm-Young, 2019). His doctoral thesis,{" "}
          <a href={RISS_THESIS_URL} target="_blank" rel="noopener">
            <em>A Study on the Effect of Shared Leadership on the Organizational Career Growth: Linking
            Social Capital as a Moderating Variable</em>
          </a>
          , is held in the Korean national research archive, RISS.
        </p>

        <h2 className="mt-h2">Contact</h2>
        <p>
          Questions, corrections, press, and disagreements are all welcome:{" "}
          <a href="mailto:wonwoo@metatake.net">wonwoo@metatake.net</a>
        </p>

        <p className="mt-see">
          <Link href="/about">About Metatake</Link> · <Link href="/methodology">Methodology</Link> · <Link href="/poetics">Poetics (essays)</Link>
        </p>
      </div>
    </div>
  );
}
