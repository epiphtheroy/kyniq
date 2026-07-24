import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";

// Fully static marketing page for the mobile app (전환마스터 §6). Honest beta
// framing (D5): the iOS build exists on TestFlight, there is no public store
// link yet, and we say so — the notify path is the newsletter, and everything
// the app does also lives in the browser (My Room).

export const metadata: Metadata = {
  title: "The Metatake App",
  description:
    "Metatake in your pocket — decide what to watch tonight, understand what you just saw, and carry your cinema portfolio anywhere. iOS beta; Android next.",
  alternates: { canonical: "/app" },
  robots: { index: true, follow: true },
};

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="accent" style={{ textDecoration: "none" }}>
    {children}
  </Link>
);

export default function AppPage() {
  return (
    <>
      <SiteNav />
      <main className="shell">
        <h1 className="disp" style={{ fontSize: 30, margin: "28px 0 0" }}>
          Metatake in your pocket
        </h1>
        <p className="standfirst" style={{ margin: "14px 0 0", maxWidth: "62ch" }}>
          The companion, wherever you decide — what to watch tonight, why it&apos;s worth
          your two hours, and where it streams. From the couch, the train, the video store.
        </p>

        <hr className="rule" />

        <div className="seclbl">What it does</div>
        <div className="tick" />
        <p className="body reading" style={{ fontSize: 17, margin: 0, maxWidth: "62ch" }}>
          <b>Decide</b> — tonight&apos;s strongest films by TakeScore, filtered to your country
          and streaming services. <b>Understand</b> — the film you just watched: its meaning,
          its shooting locations, what it echoes. <b>Remember</b> — your watch history as one
          map: coverage, blind spots, taste.
        </p>

        <hr className="rule" />

        <div className="seclbl">Where it is now</div>
        <div className="tick" />
        <p className="body reading" style={{ fontSize: 17, margin: 0, maxWidth: "62ch" }}>
          The iOS app is in <b>closed beta on TestFlight</b>. Android follows. There is no
          public download link yet — deliberately: it ships when it&apos;s ready. Until then,
          everything the app does also lives in your browser — start in <A href="/room">My Room</A>{" "}
          and <A href="/me/import">import your films</A> today.
        </p>

        <hr className="rule" />

        <div className="seclbl">Be first to know</div>
        <div className="tick" />
        <p className="body reading" style={{ fontSize: 17, margin: "0 0 18px", maxWidth: "62ch" }}>
          The public release will be announced in the newsletter and on{" "}
          <A href="/updates">Updates</A>.
        </p>
        <p style={{ margin: 0 }}>
          <Link href="/blog/subscribe" className="btn" style={{ display: "inline-block" }}>
            Get notified →
          </Link>
        </p>
      </main>
    </>
  );
}
