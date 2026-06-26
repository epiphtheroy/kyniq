import type { Metadata } from "next";
import Link from "next/link";
import MetatakeNav from "@/components/MetatakeNav";
import SubscribeForm from "@/components/SubscribeForm";

export const metadata: Metadata = {
  title: "Subscribe — Between Film and the World",
  description: "Get Metatake's daily edition: five events and the films that already knew them, read for the figure underneath. Free, almost every morning.",
};

export default function SubscribePage() {
  return (
    <div className="mt">
      <MetatakeNav active="blog" />
      <div className="blg">
        <section className="blg-hero">
          <div className="blg-wrap" style={{ maxWidth: 720 }}>
            <p className="blg-kick"><span className="dot" /> Between Film and the World</p>
            <h1>The day&apos;s news,<br /><span className="red">read as cinema.</span></h1>
            <p className="dek">One short edition, almost every morning — five events and the films that already knew them.</p>

            <div className="blg-sub-box" style={{ textAlign: "left", marginTop: 26 }}>
              <p className="k">Subscribe — it&apos;s free</p>
              <h3>Five events, five films, in your inbox.</h3>
              <p style={{ margin: "0 0 16px" }}>Every film and reading is confirmed in the live corpus before we send it. Retrieved, not remembered. No spam, unsubscribe anytime.</p>
              <SubscribeForm source="subscribe-page" />
              <p className="fine">We&apos;ll only ever email you the edition.</p>
            </div>

            <p className="intro" style={{ marginTop: 26 }}>
              Prefer to browse first? Read <Link className="lk-in" href="/blog">today&apos;s edition</Link>, or <Link className="lk-in" href="/">wander the map</Link>.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
