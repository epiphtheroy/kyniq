import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";

// Fully static marketing page for the mobile app ("the web and the app"
// surface). No server data; prerendered at build like /about.
//
// Copy contract (HANDOFF-모바일앱-프리워치 §1, §13):
//  - positioning: the judgment BEFORE you watch — complement Letterboxd/JustWatch,
//    never claim to replace them.
//  - attributions §13-8: JustWatch (streaming data) + TMDB (metadata/images,
//    not endorsed or certified).
//  - no "human-curated" / "not AI" claims anywhere (credit overhaul pending);
//    TakeScore/Invitations are "by Metatake Editorial", nothing more.
//  - honest store status: coming, not live — no dead badge links.

export const metadata: Metadata = {
  title: { absolute: "Metatake — the app" },
  description:
    "The cinephile judgment navigator for iOS and Android. Judge films before you watch: TakeScore and spoiler-free Invitations, a living watchlist crossed with your streaming services, and 17,000 filming locations on a map.",
  alternates: { canonical: "/app" },
  robots: { index: true, follow: true },
};

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="accent" style={{ textDecoration: "none" }}>
    {children}
  </Link>
);

export default function AppLandingPage() {
  return (
    <>
      <SiteNav />
      <main className="shell">
        <h1 className="disp" style={{ fontSize: 34, margin: "28px 0 0", maxWidth: "18ch" }}>
          Judge films before you watch.
        </h1>
        <p className="standfirst" style={{ margin: "14px 0 0", maxWidth: "62ch" }}>
          Metatake for iOS and Android is a judgment navigator for cinephiles. Explore what to
          watch, judge whether it deserves your evening, plan when and where, watch, then look
          back on whether you chose well. Every film in the catalog carries your judgment state
          — want, pass, seen — and the app&apos;s one job is to move it forward.
        </p>

        <hr className="rule" />

        <div className="seclbl">Why another film app</div>
        <div className="tick" />
        <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
          Letterboxd is the diary you write <em>after</em> you watch. JustWatch is the index of{" "}
          <em>where</em> to stream. Between them sits the decision itself — whether a film is
          worth your two hours — and no app treats that judgment as its subject. Metatake does.
          It is built as a second app, not a replacement: keep your diary and your index, and
          bring your judgment here.
        </p>

        <hr className="rule" />

        <div className="seclbl">Judge — a score, a lead, one bar</div>
        <div className="tick" />
        <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
          Every film opens on a judgment brief. <A href="/takescore">TakeScore</A> is an original
          critical score by Metatake Editorial — thirteen dimensions, appraised across 6,900+
          films, never blended with popularity ratings; the divergence is the information. Below
          it sits <em>An Invitation</em>: a spoiler-free critical lead written to be read{" "}
          <em>before</em> watching, a category the film web has left empty.
        </p>
        <p className="body reading" style={{ fontSize: 18, margin: "12px 0 0" }}>
          Then one judgment bar: <strong>want</strong>, <strong>pass</strong>,{" "}
          <strong>seen</strong>. Mark a film seen and rate it, and the app answers with a verdict
          on the choice itself — <em>Find</em>, <em>Aligned</em>, or <em>Letdown</em> — so your
          ledger learns what kind of chooser you are. Every judgment is reversible; nothing is
          nagged, nothing is locked.
        </p>

        <hr className="rule" />

        <div className="seclbl">A living queue</div>
        <div className="tick" />
        <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
          Your watchlist is crossed with the streaming services you actually pay for, in your
          country, so the first thing you see is what you can watch tonight. And the queue is
          honest about time: entries age from <em>Fresh</em> to <em>Aging</em> to <em>Stale</em>,
          because a watchlist that only grows is a graveyard. When you can&apos;t decide,
          situation chips cut the deck — <em>Safe bet</em>, <em>Hidden gems</em>,{" "}
          <em>90 in 90 min</em>, <em>Bold pick</em>.
        </p>
        <p className="body reading" style={{ fontSize: 18, margin: "12px 0 0" }}>
          Around the queue: director cards with availability-dotted filmographies, and
          multi-country editions — the app launches in the US, and switching country switches
          what counts as watchable.
        </p>

        <hr className="rule" />

        <div className="seclbl">17,000 filming locations</div>
        <div className="tick" />
        <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
          The <A href="/locations">Metatake locations record</A> — 17,000 verified filming
          locations — lives in the app as a map. Tap a pin and the film&apos;s judgment brief
          opens; tap <em>Near me</em> and see what was shot around you. Your position is used on
          the device only, to move the map — it is never uploaded or stored.
        </p>

        <hr className="rule" />

        <div className="seclbl">The web and the app</div>
        <div className="tick" />
        <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
          metatake.net is the critical archive — for reading and exploring, at a desk, in long
          sessions. The app is the decision tool — for the sofa, in the thirty seconds before
          you press play. One account, one ledger: a film you judge on the phone is judged on the
          web, and the reading you save at the desk is waiting on the sofa. Judgments sync both
          ways.
        </p>

        <hr className="rule" />

        <div className="seclbl">Availability</div>
        <div className="tick" />
        <p className="body reading" style={{ fontSize: 18, margin: 0 }}>
          Coming to the App Store and Google Play. The app is built and in pre-release testing;
          store listings go live after the test gate. We won&apos;t show badges until they link
          somewhere real.
        </p>
        <p className="body reading" style={{ fontSize: 18, margin: "12px 0 0" }}>
          Want in early? Write{" "}
          <a
            href="mailto:wonwoo@metatake.net?subject=TestFlight%20%2F%20early%20access"
            className="accent"
            style={{ textDecoration: "none" }}
          >
            wonwoo@metatake.net
          </a>{" "}
          and we&apos;ll add you to the TestFlight and Play internal-test lists.
        </p>

        <hr className="rule" />

        <p className="ui muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
          Free, no ads, no in-app purchases. Read how the app handles your data in the{" "}
          <A href="/privacy">privacy policy</A>.
        </p>
        <p className="ui muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
          Streaming availability data powered by JustWatch. Film metadata and images supplied by
          TMDB — this product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
      </main>
    </>
  );
}
