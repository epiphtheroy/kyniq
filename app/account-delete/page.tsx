import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";

// Google Play's Data safety form wants a dedicated account-deletion URL — a page
// a person can reach WITHOUT the app installed and without being signed in
// (until 2026-08-31 the form pointed at /privacy, which describes deletion but
// does not lead with it). Everything stated here is the behaviour of the two
// deletion routes as of today:
//  - app/api/v1/app/account-delete — in-app: removes push registrations, prefs,
//    the film ledger (user_movies), saved views, then the auth user itself.
//  - app/api/account/delete        — website: anonymizes authored contributions
//    to "[deleted]" and deletes the auth user.
// If either route changes, this page and /privacy change in the same commit.

export const metadata: Metadata = {
  title: "Delete Your Account",
  description:
    "How to delete your Metatake account and its data — from the app, from the website, or by email if you no longer have either.",
  alternates: { canonical: "/account-delete" },
  // A compliance surface, not a search surface.
  robots: { index: false, follow: true },
};

const Mail = () => (
  <a href="mailto:wonwoo@metatake.net" className="accent" style={{ textDecoration: "none" }}>
    wonwoo@metatake.net
  </a>
);

const Sec = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <section style={{ margin: "26px 0 0", maxWidth: "62ch" }}>
    <div className="seclbl">{label}</div>
    {children}
  </section>
);

export default function AccountDeletePage() {
  return (
    <>
      <SiteNav />
      <main className="shell">
        <h1 className="disp" style={{ fontSize: 30, margin: "28px 0 0" }}>
          Delete your Metatake account
        </h1>
        <p className="standfirst" style={{ margin: "14px 0 0", maxWidth: "62ch" }}>
          Deletion is immediate, complete, and yours to do — no email to support, no waiting
          period, no retention window. This page covers the Metatake mobile app and the
          metatake.net website; one account serves both, so deleting it anywhere deletes it
          everywhere.
        </p>

        <hr className="rule" />

        <Sec label="In the app">
          <p className="ui" style={{ margin: "8px 0 0" }}>
            Open the <strong>You</strong> tab → account section → <strong>Delete account</strong>.
            The app removes your push registrations, your preferences, your film ledger and saved
            views, and then the account itself, in that order, immediately.
          </p>
        </Sec>

        <Sec label="On the website">
          <p className="ui" style={{ margin: "8px 0 0" }}>
            Sign in and open <Link href="/settings" className="accent" style={{ textDecoration: "none" }}>Settings</Link> →{" "}
            <strong>Delete my account</strong>. Anything you authored publicly — questions,
            readings — stays readable but is anonymized to &ldquo;[deleted]&rdquo;, because other
            people&rsquo;s work may be built on it; nothing on it points back to you. The account
            itself is deleted immediately.
          </p>
        </Sec>

        <Sec label="Without the app or a password">
          <p className="ui" style={{ margin: "8px 0 0" }}>
            Uninstalled the app, or can&rsquo;t sign in? Email <Mail /> from the address the
            account is registered under and ask for deletion. That address is the only identity
            check we can run, and the deletion is performed the same way, normally within a few
            days.
          </p>
        </Sec>

        <Sec label="What is deleted, and what is not">
          <p className="ui" style={{ margin: "8px 0 0" }}>
            Deleted with the account: your sign-in identity, email address, film ledger (watched,
            saved, ratings), preferences (country, services, language), push notification
            registrations, and any import connections. Not tied to your account in the first
            place: our site analytics, which are cookieless and aggregate — there is nothing there
            to delete because nothing there identifies you. The full picture is in the{" "}
            <Link href="/privacy" className="accent" style={{ textDecoration: "none" }}>Privacy Policy</Link>.
          </p>
        </Sec>
      </main>
    </>
  );
}
