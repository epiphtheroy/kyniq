import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Metatake terms of service: contribution license, and the rules for automated access and reuse of our criticism.",
  alternates: { canonical: "/terms" },
};

/*
 * The "⚠ Draft — pending legal review" banner that stood here was removed
 * 2026-08-09, on the owner's instruction, and its removal is the point rather
 * than tidying.
 *
 * These terms have to do real work now. The "Automated access and reuse" clause
 * below is what makes bulk collection a breach of contract instead of merely
 * something we would have preferred not to happen — and a page that calls itself
 * an unreviewed draft argues the other side's case for it. A crawler operator,
 * or anyone reading over their shoulder, can point at that line and say the site
 * had published no settled terms at all.
 *
 * So the banner is gone and the clauses stand as stated. Edit them like binding
 * text, not like notes: if something here stops being true, change the clause,
 * do not re-hedge the page.
 */

export default function TermsPage() {
  return (
    <main className="shell">
      <h1 className="disp" style={{ fontSize: 30, margin: "28px 0 0" }}>Terms of Service</h1>
      <p className="ui muted" style={{ fontSize: 13, margin: "10px 0 0" }}>
        Effective 9 August 2026. These terms apply to everyone who uses Metatake, including
        automated clients.
      </p>

      <hr className="rule" />

      <div className="seclbl">Eligibility</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 17, margin: 0 }}>
        You must be at least 16 years old to create an account. By using Metatake you agree to these terms
        and our Privacy Policy.
      </p>

      <hr className="rule" />

      <div className="seclbl">Contribution content license</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 17, margin: 0 }}>
        When you submit a reading, question, or edit suggestion, you grant Metatake a non-exclusive,
        worldwide, royalty-free license to use, display, reproduce, and modify your contribution
        under a Creative Commons Attribution-ShareAlike 4.0 (CC BY-SA 4.0) license. This ensures
        that canonical answers — which merge multiple contributors&apos; work — can be shared and
        built upon by the community.
      </p>

      <hr className="rule" />

      <div className="seclbl">Acceptable use</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 17, margin: 0 }}>
        Do not post spam, harassment, illegal content, or content that violates others&apos; intellectual
        property rights. Metatake reserves the right to remove content and suspend accounts that violate
        these terms or our Community Guidelines.
      </p>

      <hr className="rule" />

      {/*
        Automated access and reuse — added 2026-08-09.

        Why this section exists: on 2026-08-08 a commercial AI crawler
        (ShapBot/0.1.0, Parallel.ai) fetched 29,511 distinct pages in four hours
        from four Google Cloud VMs — effectively the whole catalogue — to feed a
        paid "web context" API. Nothing was breached: every page is public, and
        robots.txt still said "allow". That is exactly the gap this clause
        closes. robots.txt is a request; terms are a contract, and a stated
        prohibition is what makes later bulk collection a breach rather than a
        surprise. Keep the licence split here consistent with /partners and
        /data: criticism CC BY-NC 4.0, geodata CC BY 4.0, commercial by licence.
      */}
      <div className="seclbl">Automated access and reuse</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 17, margin: 0 }}>
        Our criticism — readings, TakeScores, essays, and editorial text — is published under{" "}
        <a href="https://creativecommons.org/licenses/by-nc/4.0/" rel="license noopener noreferrer" target="_blank">
          CC BY-NC 4.0
        </a>
        : reuse it with attribution, non-commercially. The filming-location geodata is CC BY 4.0.
        Commercial use requires a separate license — see <Link href="/partners">Partners</Link>.
      </p>
      <p className="body reading" style={{ fontSize: 17, margin: "14px 0 0" }}>
        Machines are welcome within those terms, and we publish routes built for them: a read-only
        REST API at <Link href="/api">/api</Link>, an MCP server at <Link href="/mcp">/mcp</Link>, and
        dataset downloads at <Link href="/data">/data</Link>. What is not permitted is bulk or
        systematic collection of this site — crawling the catalogue in sequence, or copying a
        substantial part of it — in order to redistribute, resell, or supply a commercial product,
        including AI training corpora and paid retrieval, search, or &ldquo;web context&rdquo;
        services. Automated clients must honor our{" "}
        <a href="/robots.txt" rel="noopener noreferrer" target="_blank">robots.txt</a>, identify
        themselves in a stable User-Agent, and stay within our published rate limits. We may block
        any client that does not, and blocking waives no claim.
      </p>

      <hr className="rule" />

      <div className="seclbl">Moderation</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 17, margin: 0 }}>
        Content may be reviewed, edited, merged, or hidden by editors and administrators. Content written
        by our AI system is labeled as such on the page and attributed to Metatake AI, and is screened
        before publication by automated checks rather than by human reading. The method it follows is
        designed by a named human editor, who is accountable for what publishes and who
        corrects or removes it on request.
      </p>

      <hr className="rule" />

      <div className="seclbl">Limitation of liability</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 17, margin: 0 }}>
        Metatake is provided &ldquo;as is&rdquo; without warranty. We are not liable for user-generated
        content or any damages arising from your use of the platform.
      </p>

      <hr className="rule" />

      <div className="seclbl">Governing law</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 17, margin: 0 }}>
        These terms are governed by the laws of the Republic of Korea.
      </p>

      <hr className="rule" />
      <p className="ui muted" style={{ fontSize: 12 }}>Last updated: 9 August 2026</p>
    </main>
  );
}
