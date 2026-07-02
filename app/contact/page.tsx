import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact — Metatake",
  description: "Get in touch with the Metatake team.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <main className="shell">
      <h1 className="disp" style={{ fontSize: 30, margin: "28px 0 0" }}>Contact</h1>
      <p className="standfirst" style={{ margin: "14px 0 0", maxWidth: "60ch" }}>
        We&apos;d love to hear from you.
      </p>

      <hr className="rule" />

      <div className="seclbl">General inquiries</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Questions, press, partnerships, or just a thought about a film:{" "}
        <a href="mailto:wonwoo@metatake.net" className="accent" style={{ textDecoration: "none" }}>
          wonwoo@metatake.net
        </a>
      </p>

      <hr className="rule" />

      <div className="seclbl">Location</div>
      <div className="tick" />
      <p className="ui" style={{ fontSize: 15 }}>
        Metatake<br />
        Seoul, Republic of Korea
      </p>
    </main>
  );
}
