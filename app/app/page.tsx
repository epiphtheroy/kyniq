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
//  - honest store status (owner 08-18): iOS 1.0 RELEASED on the App Store —
//    175 countries/regions, iOS 15.1+, apps.apple.com/app/metatake/id6792487455.
//    Android in Play closed testing (14-day gate running since 08-17; production
//    access application ~08-31, public listing after Google's final review) —
//    no Play link until it's real.
//
// Screenshots in public/app/ are 560px JPEG derivatives of the ASC set
// (mobile/store/shots-65, real app + real data) — regenerate them together.

export const metadata: Metadata = {
  title: { absolute: "Metatake — the app" },
  description:
    "The cinephile judgment navigator for iOS and Android — now on the App Store in 175 countries and regions. Judge films before you watch: TakeScore and spoiler-free Invitations, a living watchlist crossed with your streaming services, and 17,000 filming locations on a map.",
  alternates: { canonical: "/app" },
  robots: { index: true, follow: true },
};

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="accent" style={{ textDecoration: "none" }}>
    {children}
  </Link>
);

const APPSTORE = "https://apps.apple.com/app/metatake/id6792487455";

// 560px derivatives of the store screenshot sets — the real app, real data.
// iOS frames are 560×1211 (dark); the Android frame is 560×995 (light, 9:16),
// so its figure is wider to keep the strip's height even.
const SHOTS = [
  {
    src: "/app/beta-tonight.jpg",
    alt: "Tonight tab — a deck of films on your services, each with a TakeScore and want / pass / seen buttons",
    cap: "Tonight — the deck, cut to your services",
    iw: 560,
    ih: 1211,
    fw: 208,
  },
  {
    src: "/app/beta-brief.jpg",
    alt: "A film's judgment brief — In the Mood for Love with its TakeScore ring and spoiler-free Invitation",
    cap: "The brief — TakeScore and a spoiler-free Invitation",
    iw: 560,
    ih: 1211,
    fw: 208,
  },
  {
    src: "/app/beta-services.jpg",
    alt: "Where to watch — the film's streaming offers, with the services you pay for marked YOURS",
    cap: "Where to watch — your services, marked",
    iw: 560,
    ih: 1211,
    fw: 208,
  },
  {
    src: "/app/beta-locations.jpg",
    alt: "Locations — the film's real filming locations pinned on a map",
    cap: "Locations — real places, on the map",
    iw: 560,
    ih: 1211,
    fw: 208,
  },
  {
    src: "/app/beta-explore.jpg",
    alt: "Explore tab — browse by genre and decade, and 114 curated lists",
    cap: "Explore — 114 lists to browse",
    iw: 560,
    ih: 1211,
    fw: 208,
  },
  {
    src: "/app/beta-android-tonight.jpg",
    alt: "The same Tonight deck on Android, in the light theme — the closed test is running",
    cap: "And on Android — same app, light theme, in closed test",
    iw: 560,
    ih: 995,
    fw: 253,
  },
];

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

        <section
          style={{
            margin: "26px 0 0",
            border: "1px solid var(--ink)",
            background: "#FBFAF7",
            padding: "22px 24px 24px",
          }}
        >
          <div className="seclbl">iOS — on the App Store</div>
          <div className="tick" />
          <h2 className="disp" style={{ fontSize: 22, margin: 0 }}>
            On the App Store, worldwide.
          </h2>
          <p className="body reading" style={{ fontSize: 17, margin: "10px 0 0", maxWidth: "58ch" }}>
            Metatake 1.0 is live on the App Store in 175 countries and regions — free, no ads,
            no in-app purchases. Installing is the whole setup: search &ldquo;Metatake&rdquo; or
            take the link below, sign in, and the first deck of films is already waiting on the
            Tonight tab.
          </p>
          <p className="body reading" style={{ fontSize: 17, margin: "10px 0 0", maxWidth: "58ch" }}>
            If you read metatake.net, the app is this site in your pocket — same account, one
            ledger, everything syncing both ways: judgments, watchlist, saved reading. Judge a
            film on the sofa and your desk already knows.
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 22,
              flexWrap: "wrap",
              margin: "20px 0 0",
            }}
          >
            <a
              className="btn-cta"
              style={{ fontSize: 15, padding: "12px 20px" }}
              href={APPSTORE}
              target="_blank"
              rel="noreferrer"
            >
              Download on the App Store&nbsp;→
            </a>
            <figure style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
              <img
                src="/app/appstore-qr.svg"
                alt="QR code that opens Metatake on the App Store"
                width={104}
                height={104}
                loading="lazy"
                style={{
                  display: "block",
                  border: "1px solid var(--hairline)",
                  borderRadius: 6,
                }}
              />
              <figcaption
                className="ui muted"
                style={{ fontSize: 12, maxWidth: "16ch", lineHeight: 1.45 }}
              >
                Reading at a desk? Point your iPhone camera here.
              </figcaption>
            </figure>
          </div>
          <p className="ui muted" style={{ fontSize: 12.5, margin: "12px 0 0", lineHeight: 1.55 }}>
            On Android? The closed test is running — write{" "}
            <a
              href="mailto:wonwoo@metatake.net?subject=Android%20closed%20test"
              className="accent"
              style={{ textDecoration: "none" }}
            >
              wonwoo@metatake.net
            </a>{" "}
            and we&apos;ll add you.
          </p>
        </section>

        <div
          style={{
            display: "flex",
            gap: 14,
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            margin: "22px 0 0",
            paddingBottom: 6,
          }}
        >
          {SHOTS.map((s) => (
            <figure key={s.src} style={{ flex: `0 0 ${s.fw}px`, width: s.fw, margin: 0 }}>
              <img
                src={s.src}
                alt={s.alt}
                width={s.iw}
                height={s.ih}
                loading="lazy"
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  borderRadius: 18,
                  border: "1px solid var(--hairline)",
                }}
              />
              <figcaption className="ui muted" style={{ fontSize: 12, margin: "8px 0 0", lineHeight: 1.45 }}>
                {s.cap}
              </figcaption>
            </figure>
          ))}
        </div>

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
          <strong>iOS</strong> — on the{" "}
          <a href={APPSTORE} className="accent" style={{ textDecoration: "none" }} target="_blank" rel="noreferrer">
            App Store
          </a>{" "}
          in 175 countries and regions, for iPhone on iOS 15.1 or later. Free, no ads, no
          in-app purchases.
        </p>
        <p className="body reading" style={{ fontSize: 18, margin: "12px 0 0" }}>
          <strong>Android</strong> — in Google Play&apos;s closed-testing gate: the build is
          live, testers are in, and Play&apos;s fourteen-day clock is running. We apply for
          production access at the end of August; the public listing follows Google&apos;s
          final review. Want in now? Write{" "}
          <a
            href="mailto:wonwoo@metatake.net?subject=Android%20closed%20test"
            className="accent"
            style={{ textDecoration: "none" }}
          >
            wonwoo@metatake.net
          </a>{" "}
          and we&apos;ll add you to the test list. The Play badge appears here the day it links
          somewhere real.
        </p>
        <p style={{ margin: "18px 0 0" }}>
          <img
            src="/app/play-feature.png"
            alt="Metatake on Google Play — Judge films before you watch: TakeScore, a living queue, 17,000 locations"
            width={1024}
            height={500}
            loading="lazy"
            style={{
              width: "100%",
              maxWidth: 520,
              height: "auto",
              display: "block",
              border: "1px solid var(--hairline)",
              borderRadius: 8,
            }}
          />
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
