import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import LensCta from "@/components/LensCta";

// Static shell — all personalisation happens client-side in LensCta, so the
// page is prerendered and served from the edge like the rest of the site.

export const metadata: Metadata = {
  title: "My Films — see Metatake through what you've watched",
  description:
    "One switch, three views of the whole site. Highlight every film you've seen with a red border, or re-centre the galaxy, the locations and every list on your own watch history.",
  alternates: { canonical: "/my-films" },
};

const MODES = [
  {
    t: "All films",
    s: "The public site, exactly as everyone sees it — three thousand films read closely, nothing hidden.",
  },
  {
    t: "Highlight mine",
    s: "Everything stays, but the films you've seen light up: a red border on every poster and thumbnail, a ring around your dots in the galaxy, a check beside every title. Your history, visible against the whole web.",
  },
  {
    t: "Only mine",
    s: "The site re-centres on you. Unseen films ghost out of every grid, the galaxy and the locations filter down to what you've watched, and the connection pages show how your films talk to each other.",
  },
];

const SURFACES = [
  { t: "The Galaxy", s: "Your films ringed in red across the starfield — or a galaxy made only of them.", h: "/network?m=galaxy" },
  { t: "Locations", s: "The world map of settings and shooting locations, filtered to the places your films know.", h: "/locations" },
  { t: "Connections", s: "Kinships and counterpoints between films — including just among yours.", h: "/network" },
  { t: "Every list & page", s: "Catalog, genres, directors, watch-next rails: your films are marked wherever they appear.", h: "/film" },
];

export default function MyFilmsPage() {
  return (
    <div className="mt">
      <SiteNav />
      <main className="mfl-page">
        <header className="mfl-hero">
          <p className="mfl-kicker">The My Films lens</p>
          <h1>One switch, three views of the whole site.</h1>
          <p className="mfl-lede">
            Metatake maps cinema — films linked by the readings they share, placed in a galaxy,
            pinned on a world map. The <b>My Films</b> lens turns that whole map into <i>your</i> map:
            flip the <b>◎&nbsp;My&nbsp;films</b>{" toggle in the top bar and every page answers to what you’ve watched."}
          </p>
        </header>

        <LensCta />

        <section className="mfl-sec">
          <h2>Three modes</h2>
          <div className="mfl-grid">
            {MODES.map((m) => (
              <div className="mfl-card" key={m.t}>
                <h3>{m.t}</h3>
                <p>{m.s}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mfl-sec">
          <h2>Where it works</h2>
          <div className="mfl-grid">
            {SURFACES.map((m) => (
              <Link className="mfl-card mfl-card--link" key={m.t} href={m.h}>
                <h3>{m.t} →</h3>
                <p>{m.s}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mfl-sec">
          <h2>How to start</h2>
          <ol className="mfl-steps">
            <li><b>Sign in</b>{" — or "}<Link href="/signup?next=%2Fmy-films">create a free account</Link>.</li>
            <li><b>Tell the site what you&rsquo;ve seen</b>{" — mark films "}<b>Seen&nbsp;✓</b>{" as you browse, or "}<Link href="/me/import">import your Letterboxd / IMDb history</Link>{" in one file."}</li>
            <li><b>Flip the toggle</b>{" — the "}<b>◎&nbsp;My&nbsp;films</b>{" control in the top bar, on every page."}</li>
          </ol>
        </section>

        <section className="mfl-sec">
          <h2>Private by design</h2>
          <p className="mfl-body">
            Your watch history belongs to your account and never changes the public site. The lens
            runs entirely in your browser, on pages served from the same fast cache everyone gets —
            switch it off and Metatake is exactly as it was.
          </p>
        </section>
      </main>
    </div>
  );
}
