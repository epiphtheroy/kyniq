import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import BoardGrid from "@/components/odyssey/BoardGrid";
import "../odyssey/odyssey.css";
import "./board.css";

export const metadata: Metadata = {
  title: "Board — the whole cinephile corpus at a glance",
  description:
    "The ~2,000 cinephile films Metatake covers, laid out on one board — columns by era, rows by taste. Highlight what you've seen, your watchlist, or what's on your services, then filter to survey it all at a glance.",
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
            A board of the ~2,000 cinephile films Metatake covers. Columns are eras, rows are taste.{" "}
            Turn on <b>Seen · Watchlist · On my services</b> to light those films up, and narrow by year
            or genre to thin the board. Hover a film for a summary, or click to open the details alongside.{" "}
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
