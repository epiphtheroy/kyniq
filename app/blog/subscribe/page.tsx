import type { Metadata } from "next";
import Link from "next/link";
import SubscribeForm from "@/components/SubscribeForm";

export const metadata: Metadata = {
  title: "Subscribe — Between Film and the World",
  description: "Get Metatake's daily edition: five events and the films that already knew them, read for the figure underneath. Free, almost every morning.",
};

export default function SubscribePage() {
  return (
    <div className="cur-wrap" style={{ maxWidth: 720 }}>
      <header className="cur-head" style={{ paddingTop: 34 }}>
        <div className="cur-datekick">
          <span>Between Film and the World</span>
          <span className="d" />
          <span className="sub">Metatake&apos;s daily</span>
        </div>
        <h1 style={{ marginTop: 10 }}>The day&apos;s news,<br />read as cinema<span className="q">.</span></h1>
        <p className="dek">One short edition, almost every morning — five events and the films that already knew them.</p>
      </header>

      <div className="cur-subpanel" style={{ margin: "22px 0 0" }}>
        <p className="k">Subscribe — it&apos;s free</p>
        <h3>Five events, five films, in your inbox.</h3>
        <p>Every film and reading is confirmed in the live corpus before we send it. Retrieved, not remembered. No spam, unsubscribe anytime.</p>
        <SubscribeForm source="subscribe-page" />
        <p className="fine">We&apos;ll only ever email you the edition.</p>
      </div>

      <div className="cur-foot">
        Prefer to browse first? Read <Link href="/blog">today&apos;s edition</Link>, or <Link href="/curious">visit the question desk</Link>.
      </div>
    </div>
  );
}
