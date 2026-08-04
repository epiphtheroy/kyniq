import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Metatake terms of service and contribution content license.",
  alternates: { canonical: "/terms" },
};

/* ⚠ DRAFT — NEEDS LEGAL REVIEW BEFORE LAUNCH */

export default function TermsPage() {
  return (
    <main className="shell">
      <h1 className="disp" style={{ fontSize: 30, margin: "28px 0 0" }}>Terms of Service</h1>
      <p className="ui accent" style={{ fontSize: 13, margin: "10px 0 0" }}>
        ⚠ Draft — pending legal review
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
      <p className="ui muted" style={{ fontSize: 12 }}>Last updated: July 2026</p>
    </main>
  );
}
