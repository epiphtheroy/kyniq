import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import MetatakeDeck from "@/components/odyssey/MetatakeDeck";
import "../odyssey/odyssey.css";
import "../odyssey/deck.css";

// For You — a personalized draw of films, not a list. Static shell; the deck is
// a client component that reads the map artifact and the viewer's seen films and
// auto-deals nine picks on load.

export const metadata: Metadata = {
  title: "For You — films picked from your taste",
  description:
    "A personalized draw of nine unseen films, pulled from what you've watched and what's on your services. Three ways to go: a safe bet, a step past the familiar, and a different world entirely.",
  alternates: { canonical: "/journey" },
  robots: { index: true, follow: true },
};

export default function JourneyPage() {
  return (
    <>
      <SiteNav />
      <main>
        <header className="ody-hero ody-hero--fy" style={{ paddingBottom: 4 }}>
          <div className="seclbl">For You</div>
          <h1 className="disp">Films picked for you</h1>
          <p className="standfirst">
            A little box of picks, drawn just for you — from what you've watched and what's on your
            services, <b>unseen ones only</b>, so there's always something new to open. Three ways to
            go: a safe bet, a step further, and a different world entirely. Want the whole picture?{" "}
            <Link href="/odyssey" className="accent" style={{ textDecoration: "none", fontWeight: 600 }}>
              Odyssey map →
            </Link>{" "}
            <span aria-hidden="true" style={{ color: "#cbc4b6" }}>·</span>{" "}
            <Link href="/board" className="accent" style={{ textDecoration: "none", fontWeight: 600 }}>
              Board →
            </Link>
          </p>
        </header>

        <MetatakeDeck />
      </main>
    </>
  );
}
