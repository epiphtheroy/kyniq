import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";

// Privacy policy for BOTH surfaces: the metatake.net website and the Metatake
// mobile app (App Store / Google Play both require a live, indexable policy URL).
//
// Every claim below was verified against the code on 2026-07-18:
//  - components/Metrics.tsx           — first-party analytics: no cookies, no
//    persistent id, daily-rotating salted visitor hash, sessionStorage-only sid.
//  - app/api/metrics/route.ts         — hash of (day, ip, ua, salt); coarse geo
//    from Vercel headers; device/browser class derived from the user-agent.
//  - lib/apiGuard.ts                  — API metering ledgers the user-agent.
//  - mobile/src/lib/push.ts + api.ts  — push = Expo push token + country/locale/
//    platform, own-row upsert; prefs = country/locale/providers/push flag.
//  - mobile Map screens               — device position only moves the map
//    camera locally; it is never sent to any server.
//  - app/api/v1/app/account-delete    — in-app deletion removes push
//    registrations, prefs, the film ledger (user_movies), saved views, then the
//    auth user.
//  - app/api/account/delete/route.ts  — website deletion anonymizes the profile
//    to "[deleted]" and deletes the auth user.
// Owner/legal sign-off before store submission is tracked in the launch TODOs.

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Metatake — the website and the mobile app — handles your data: what we collect, what we never do, who processes it, and how to delete everything.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="accent" style={{ textDecoration: "none" }}>
    {children}
  </Link>
);

const Mail = () => (
  <a href="mailto:wonwoo@metatake.net" className="accent" style={{ textDecoration: "none" }}>
    wonwoo@metatake.net
  </a>
);

export default function PrivacyPage() {
  return (
    <>
      <SiteNav />
      <main className="shell">
        <h1 className="disp" style={{ fontSize: 30, margin: "28px 0 0" }}>Privacy Policy</h1>
        <p className="ui muted" style={{ fontSize: 13, margin: "10px 0 0" }}>
          Last updated: 2026-07-18 · Covers the metatake.net website and the Metatake mobile app.
        </p>
        <p className="standfirst" style={{ margin: "14px 0 0", maxWidth: "62ch" }}>
          The short version: we keep an account so your film ledger can follow you between the
          website and the app. We run no ads, embed no third-party trackers, sell nothing about
          you, and your location never leaves your device. You can delete everything yourself.
        </p>

        <hr className="rule" />

        <div className="seclbl">Who we are</div>
        <div className="tick" />
        <p className="body reading" style={{ fontSize: 17, margin: 0 }}>
          Metatake (metatake.net) is a film-criticism publication and its companion mobile app,
          edited by <A href="/editor">Wonwoo Yoon</A> in Seoul. For anything in this policy,
          write <Mail />. More about the publication is on the <A href="/about">About page</A>.
        </p>

        <hr className="rule" />

        <div className="seclbl">What we collect</div>
        <div className="tick" />
        <p className="body reading" style={{ fontSize: 17, margin: 0 }}>
          <strong>Account.</strong> An email address, via Sign in with Apple, Google, or an
          emailed one-time code. Accounts are handled by Supabase Auth. On the website you may
          optionally add a username, display name, bio, and avatar; none are required.
        </p>
        <p className="body reading" style={{ fontSize: 17, margin: "12px 0 0" }}>
          <strong>Your film ledger.</strong> The point of the account: your watchlist, films
          marked seen or passed, your ratings and notes, and saved views. Tied to your account so
          it syncs between the website and the app.
        </p>
        <p className="body reading" style={{ fontSize: 17, margin: "12px 0 0" }}>
          <strong>Preferences.</strong> Your country, language, and selected streaming services,
          and whether notifications are on — stored with your account so availability and
          notifications match your edition.
        </p>
        <p className="body reading" style={{ fontSize: 17, margin: "12px 0 0" }}>
          <strong>Push notifications (only if you turn them on).</strong> A device push token
          plus your country, language, and platform (iOS/Android), so we can tell you when a
          watchlisted film arrives on your services. Turn notifications off and the token stops
          being used; delete your account and it is removed.
        </p>
        <p className="body reading" style={{ fontSize: 17, margin: "12px 0 0" }}>
          <strong>Content you contribute on the website.</strong> Questions, comments, and other
          contributions you author under your profile.
        </p>
        <p className="body reading" style={{ fontSize: 17, margin: "12px 0 0" }}>
          <strong>Server logs and request metering.</strong> Like every website, our hosting
          keeps standard, short-lived server logs (IP address, user-agent, requested URL) for
          security and debugging. Our own API metering records the request&apos;s user-agent
          string — not who you are.
        </p>
        <p className="body reading" style={{ fontSize: 17, margin: "12px 0 0" }}>
          <strong>Website analytics — first-party only.</strong> We measure the site ourselves:
          page views, time on page, scroll depth, and performance vitals. This uses no cookies
          and no persistent identifier. Visitors are counted by a salted hash that rotates every
          day, so yesterday&apos;s visitor cannot be linked to today&apos;s; the analytics store
          keeps coarse region and device class, not your IP address. A session id lives only in
          your browser&apos;s sessionStorage and dies with the tab.
        </p>

        <hr className="rule" />

        <div className="seclbl">What we do not do</div>
        <div className="tick" />
        <ul className="body reading" style={{ fontSize: 17, margin: 0, paddingLeft: 22, display: "grid", gap: 8 }}>
          <li>No ads, and no advertising identifiers.</li>
          <li>No third-party analytics or tracking SDKs — on the website or in the app.</li>
          <li>No selling, renting, or sharing of personal data for advertising.</li>
          <li>
            <strong>Your location never leaves your device.</strong> The map&apos;s &ldquo;Near
            me&rdquo; feature uses your position on-device, only to move the map. It is never
            uploaded, stored, or logged.
          </li>
          <li>No profiling of your reading or viewing for anyone but you — the ledger exists to serve you, not a data buyer.</li>
        </ul>

        <hr className="rule" />

        <div className="seclbl">Cookies and local storage</div>
        <div className="tick" />
        <p className="body reading" style={{ fontSize: 17, margin: 0 }}>
          The website sets essential cookies only, for signing you in and keeping your session
          (Supabase Auth). Analytics sets no cookies at all. A few interface preferences live in
          your browser&apos;s local storage and never leave it. Because we use no non-essential
          cookies, there is no cookie banner to click.
        </p>

        <hr className="rule" />

        <div className="seclbl">Processors and data sources</div>
        <div className="tick" />
        <p className="body reading" style={{ fontSize: 17, margin: 0 }}>
          <strong>Processors</strong> — services that handle data on our behalf:{" "}
          <strong>Supabase</strong> (authentication and database, hosted in Tokyo, Japan),{" "}
          <strong>Vercel</strong> (website and API hosting, including standard server logs), and
          — only if you enable notifications — <strong>Expo</strong> (push notification
          delivery).
        </p>
        <p className="body reading" style={{ fontSize: 17, margin: "12px 0 0" }}>
          <strong>Data sources, not processors</strong> — <strong>TMDB</strong> (film metadata
          and images) and <strong>JustWatch</strong> (streaming availability) supply catalog data{" "}
          <em>to</em> us; we do not send them your personal data. One narrow exception: if an app
          search finds nothing in our catalog, the search text alone — never your account — is
          forwarded to TMDB to look the title up.
        </p>

        <hr className="rule" />

        <div className="seclbl">Retention and deletion</div>
        <div className="tick" />
        <p className="body reading" style={{ fontSize: 17, margin: 0 }}>
          We keep your data for as long as your account exists, and you can end that yourself:
        </p>
        <ul className="body reading" style={{ fontSize: 17, margin: "12px 0 0", paddingLeft: 22, display: "grid", gap: 8 }}>
          <li>
            <strong>In the app</strong> (Settings → account): deletion removes your account, your
            film ledger (watchlist, seen, ratings, notes), your preferences, saved views, and any
            push registrations.
          </li>
          <li>
            <strong>On the website</strong> (<A href="/settings">Settings</A>): deletion removes
            your sign-in and anonymizes your profile to &ldquo;[deleted]&rdquo;. Contributions
            you authored in community surfaces remain, attributed to &ldquo;[deleted]&rdquo;.
          </li>
        </ul>
        <p className="body reading" style={{ fontSize: 17, margin: "12px 0 0" }}>
          If anything tied to you remains after either path and you want it gone, email <Mail />{" "}
          and we will erase it.
        </p>

        <hr className="rule" />

        <div className="seclbl">Your rights</div>
        <div className="tick" />
        <p className="body reading" style={{ fontSize: 17, margin: 0 }}>
          You can access and correct your data in Settings on either surface, and delete it as
          above. Depending on where you live, laws such as the GDPR or CCPA may give you further
          rights — access, portability, restriction, objection. To exercise any of them, email{" "}
          <Mail />; we answer every request.
        </p>

        <hr className="rule" />

        <div className="seclbl">Children</div>
        <div className="tick" />
        <p className="body reading" style={{ fontSize: 17, margin: 0 }}>
          Metatake is not directed at children under 13, and the catalog includes criticism of
          mature films. We do not knowingly collect data from children under 13; if you believe a
          child has created an account, write <Mail /> and we will delete it.
        </p>

        <hr className="rule" />

        <div className="seclbl">Changes</div>
        <div className="tick" />
        <p className="body reading" style={{ fontSize: 17, margin: 0 }}>
          When this policy changes, the change is published here with a new date, and material
          changes are noted on <A href="/updates">Updates</A>. Questions, corrections, requests:{" "}
          <Mail />.
        </p>
      </main>
    </>
  );
}
