import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact — Metatake",
  description:
    "Contact Metatake: corrections, press, partnerships, and general inquiries. Every correction is reviewed by the editor.",
  alternates: { canonical: "/contact" },
  robots: { index: false, follow: true },
};

export default function ContactPage() {
  return (
    <main className="shell">
      <h1 className="disp" style={{ fontSize: 30, margin: "28px 0 0" }}>Contact</h1>
      <p className="standfirst" style={{ margin: "14px 0 0", maxWidth: "60ch" }}>
        One address reaches the editor directly — every message below lands with{" "}
        <Link href="/editor" className="accent" style={{ textDecoration: "none" }}>Wonwoo Yoon</Link>.
      </p>

      <hr className="rule" />

      <div className="seclbl">Corrections</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        If a page states a fact wrongly — a date, a credit, a plot detail, a mischaracterized scholarly
        source — tell us the page and the issue and it will be fixed as verified. Interpretations stay open;
        facts get corrected. How readings are made and checked is documented in{" "}
        <Link href="/methodology" className="accent" style={{ textDecoration: "none" }}>Methodology</Link>.{" "}
        <a href="mailto:wonwoo@metatake.net?subject=Correction" className="accent" style={{ textDecoration: "none" }}>
          wonwoo@metatake.net
        </a>
      </p>

      <hr className="rule" />

      <div className="seclbl">Press &amp; partnerships</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Interviews, citations of our readings or data, academic collaborations, and partnership inquiries:{" "}
        <a href="mailto:wonwoo@metatake.net?subject=Press" className="accent" style={{ textDecoration: "none" }}>
          wonwoo@metatake.net
        </a>
        . Readings may be quoted with attribution and a link.
      </p>

      <hr className="rule" />

      <div className="seclbl">Everything else</div>
      <div className="tick" />
      <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
        Questions, disagreements, or just a thought about a film — all welcome at the same address:{" "}
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
