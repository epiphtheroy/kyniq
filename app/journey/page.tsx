import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import MetatakeDeck from "@/components/odyssey/MetatakeDeck";
import "../odyssey/odyssey.css";
import "../odyssey/deck.css";

// The journey proposal — the actual navigation. Static shell; the deck is a
// client component that reads the map artifact and the viewer's seen films.

export const metadata: Metadata = {
  title: "The Journey — your next film, not a list",
  description:
    "Not a list of good films — the next one that fits you right now. Metatake deals unseen films three ways — stable, adventure, and frontier — tuned to your taste, your services, and the years and genres you choose.",
  alternates: { canonical: "/journey" },
  robots: { index: true, follow: true },
};

export default function JourneyPage() {
  return (
    <>
      <SiteNav />
      <main>
        <header className="ody-hero" style={{ paddingBottom: 4 }}>
          <div className="seclbl">The journey</div>
          <h1 className="disp">The journey to becoming a cinephile</h1>
          <p className="standfirst">
            Not a list of good films — the <b>next one</b> that fits you right now. Press the button and
            unseen films fan out three ways: stable, adventure, and frontier. Want the whole picture?{" "}
            <Link href="/odyssey" className="accent" style={{ textDecoration: "none", fontWeight: 600 }}>
              Odyssey map →
            </Link>
          </p>
        </header>

        <MetatakeDeck />
      </main>
    </>
  );
}
