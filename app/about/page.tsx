import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";

// Fully static: this page has no server data. It's prerendered at build and
// served from the edge (regenerated on every deploy).

export const metadata: Metadata = {
  title: "About",
  description:
    "An independent film-interpretation project: close readings connected in one map of meaning — machine-drafted, answered for by a named editor in Seoul.",
  alternates: { canonical: "/about" },
  robots: { index: true, follow: true },
};

const aboutJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "About Metatake",
  url: "https://metatake.net/about",
  mainEntity: {
    "@type": "Organization",
    "@id": "https://metatake.net/#org",
    name: "Metatake",
    url: "https://metatake.net",
    founder: {
      "@type": "Person",
      "@id": "https://metatake.net/editor#person",
      name: "Wonwoo Yoon",
      url: "https://metatake.net/editor",
    },
  },
};

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="accent" style={{ textDecoration: "none" }}>
    {children}
  </Link>
);

export default function AboutPage() {
  return (
    <>
      <SiteNav />
      <main className="shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }} />
      <h1 className="disp" style={{ fontSize: 30, margin: "28px 0 0" }}>About Metatake</h1>
      <p className="standfirst" style={{ margin: "14px 0 0", maxWidth: "62ch" }}>
        Metatake reads films closely and connects what it finds. Every page is drafted by a machine and
        answered for by a person.
      </p>

      <hr className="rule" />

      <div className="seclbl">Why it exists</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        You see as much as you know. Metatake exists to enlarge what a viewer can see in a film, not to
        tell anyone whether to clap. Most of the film web settles whether a movie is good; we work on the
        question that survives the verdict: <em>what was that, and what does it connect to?</em> It is for
        the viewer who leaves the theater still turning the film over.
      </p>

      <hr className="rule" />

      <div className="seclbl">What we hold</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Seven articles, held until further notice.
      </p>
      <ol className="body reading" style={{ fontSize: 18, margin: "12px 0 0", paddingLeft: 24, display: "grid", gap: 10 }}>
        <li>
          The unit of the work is the reading, not the verdict. A verdict closes a film; a reading opens it.
        </li>
        <li>
          The record is relations, not rankings. Films connect across genre, era, and language, and we keep
          the map of those connections.
        </li>
        <li>
          Value is not popularity. <A href="/takescore">TakeScore</A> measures a film on its own axis and is
          never blended with ratings or box office; the divergence is the information.
        </li>
        <li>
          Difficulty is a price, not a virtue and not a sin. Entry cost is reported beside value, never
          subtracted from it, never rewarded.
        </li>
        <li>
          The canon validates; it does not gate. A film no list carries can measure as essential.
        </li>
        <li>
          A film sustains many readings. Readers add their own, and disagreement is not flattened.
        </li>
        <li>
          A person answers. Nothing publishes without the desk&apos;s pass, corrections are public, and no
          one can pay to place, change, or remove a reading.
        </li>
      </ol>

      <hr className="rule" />

      <div className="seclbl">How it works</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        The unit of attention is the <em>figure</em>: an object, a gesture, a color, a kind of silence a
        film keeps returning to. A reading follows one figure through one of fourteen frameworks; when the
        same reading recurs across films, it becomes a <em>trope</em>. Every reading is placed in a single
        embedding space, where distance means kinship of meaning. Every page is drafted by Metatake
        Editorial, a purpose-built system, and publishes only after the desk&apos;s pass, where a
        misattributed theorist is a hard fail, not a style note. The pipeline, stage by stage, is in{" "}
        <A href="/methodology">Methodology</A>.
      </p>

      <hr className="rule" />

      <div className="seclbl" id="strong-misreadings" style={{ scrollMarginTop: 70 }}>Strong Misreadings</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        A reading pushed to full strength is published as a <em>Strong Misreading</em>, after Harold
        Bloom&apos;s claim that reading is always misreading. The name is the disclaimer. A reading taken
        this far gives up any claim to be the correct one; what it keeps is what it lets you see. Read them
        as provocations, not verdicts. If one changes how a film looks to you, it has done its work.
      </p>

      <hr className="rule" />

      <div className="seclbl">Who answers</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Metatake is edited by <A href="/editor">Wonwoo Yoon</A> in Seoul, with a small editorial desk. He
        trained as a management scholar — Ph.D. in business administration, lead author of a six-volume
        series on Peter Drucker — and has written one essay on each of Hong Sang-soo&apos;s thirty-four
        films. Both fields taught the same lesson: value lives in relations. His signed essays run in{" "}
        <A href="/poetics">Poetics</A>; he can be wrong in public.
      </p>

      <hr className="rule" />

      <div className="seclbl">In closing</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        None of this exists without the films or the people who made them; we only rearrange light that
        others made first. Start with <A href="/search">a film you love</A>, follow a figure, and see where
        it leads.
      </p>
      <p className="body reading" style={{ fontSize: 18, margin: "12px 0 0" }}>
        — <A href="/editor">Wonwoo Yoon</A>, Seoul
      </p>

      <hr className="rule" />

      <p className="ui muted" style={{ fontSize: 14.5, lineHeight: 1.6 }}>
        As of July 2026: nearly 7,000 films in the index, 6,704 of them scored; close to 2,000 close-read;
        more than 70,000 readings; hundreds of theorists cited by name.
      </p>
      <p className="ui muted" style={{ fontSize: 13 }}>
        Corrections, questions, press:{" "}
        <a href="mailto:wonwoo@metatake.net" className="accent" style={{ textDecoration: "none" }}>
          wonwoo@metatake.net
        </a>
        {" "}· See also <A href="/methodology">Methodology</A> · <A href="/editor">The editor</A>
      </p>
    </main>
    </>
  );
}
