import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Metatake",
  description: "Metatake privacy policy — data collection, third parties, and your rights.",
  alternates: { canonical: "/privacy" },
};

/* ⚠ DRAFT — NEEDS LEGAL REVIEW BEFORE LAUNCH */

export default function PrivacyPage() {
  return (
    <main className="shell">
      <h1 className="disp" style={{ fontSize: 30, margin: "28px 0 0" }}>Privacy Policy</h1>
      <p className="ui accent" style={{ fontSize: 13, margin: "10px 0 0" }}>
        ⚠ Draft — pending legal review
      </p>

      <hr className="rule" />

      <div className="seclbl">Data we collect</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 17, margin: 0 }}>
        <strong>Account data:</strong> email address, username, display name, and profile information you provide.
        <br /><br />
        <strong>Content:</strong> questions, readings, comments, and votes you create.
        <br /><br />
        <strong>Usage data:</strong> page views, interactions, and device information collected via analytics
        and server logs.
      </p>

      <hr className="rule" />

      <div className="seclbl">Third parties</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 17, margin: 0 }}>
        We use <strong>Supabase</strong> (auth, database), <strong>Vercel</strong> (hosting),
        <strong> TMDB</strong> (film metadata), and <strong>Google</strong> (OAuth login, analytics).
        We do not sell your personal data.
      </p>

      <hr className="rule" />

      <div className="seclbl">Cookies</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 17, margin: 0 }}>
        Essential cookies (authentication, session) are always active. Non-essential cookies
        (analytics, preferences) require your consent. You can manage preferences via the
        cookie consent banner.
      </p>

      <hr className="rule" />

      <div className="seclbl">AI crawlers</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 17, margin: 0 }}>
        Metatake allows AI search and retrieval bots to access public content. If you prefer to opt
        out of AI training data usage, contact us.
      </p>

      <hr className="rule" />

      <div className="seclbl">Your rights (GDPR / CCPA)</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 17, margin: 0 }}>
        You can access, correct, or delete your personal data at any time via Settings.
        Account deletion anonymizes your content to &ldquo;[deleted]&rdquo; and removes your
        personal information. To exercise additional rights, email{" "}
        <a href="mailto:wonwoo@metatake.net" className="accent" style={{ textDecoration: "none" }}>
          wonwoo@metatake.net
        </a>.
      </p>

      <hr className="rule" />
      <p className="ui muted" style={{ fontSize: 12 }}>Last updated: June 2026</p>
    </main>
  );
}
