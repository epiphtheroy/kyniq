import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import BoardGrid from "@/components/odyssey/BoardGrid";
import "../odyssey/odyssey.css";
import "./board.css";

export const metadata: Metadata = {
  title: "Board — the whole cinephile corpus at a glance",
  description:
    "The ~2,000 cinephile films Metatake covers, tiled on one board ranked by TakeScore. Pick a scale — the top 100, 500, 1,000, or all — highlight what you've seen, your watchlist, or what's on your services, and see how many you've watched.",
  alternates: { canonical: "/board" },
  robots: { index: true, follow: true },
};

export default function BoardPage() {
  return (
    <>
      <SiteNav />
      <main>
        <header className="ody-hero" style={{ paddingBottom: 6 }}>
          <div className="seclbl">The board</div>
          <h1 className="disp">Every cinephile film at a glance</h1>
          <p className="standfirst">
            A board of the ~2,000 cinephile films Metatake covers, tiled densely and ranked by <b>TakeScore</b>.{" "}
            Choose a scale — the top <b>100 · 500 · 1,000</b> or <b>all</b> — and it shows how many you've seen.{" "}
            Turn on <b>Seen · Watchlist · On my services</b> to light those films up, filter by year or genre,
            or switch the Show filter to survey only what you've seen. Hover for a summary, or click for details.{" "}
            <Link href="/journey" className="accent" style={{ textDecoration: "none", fontWeight: 600 }}>The Journey →</Link>{" "}
            <Link href="/odyssey" className="accent" style={{ textDecoration: "none", fontWeight: 600 }}>Odyssey map →</Link>
          </p>
        </header>

        <BoardGrid />
        {/* Coverage (canon bars + auteur conquest) lives in My Room — linking
            instead of duplicating keeps this page's server HTML non-personalized
            (the embedded BoardCoverage was force-dynamic + auth, a breach of
            the invariant) and keeps one instrument in one place. */}
        <section className="ody-hero" style={{ paddingTop: 10, paddingBottom: 28 }}>
          <p className="standfirst">
            Your canon coverage and auteur conquest live in{" "}
            <Link href="/room" className="accent" style={{ textDecoration: "none", fontWeight: 600 }}>
              My Room →
            </Link>
          </p>
        </section>
      </main>
    </>
  );
}
