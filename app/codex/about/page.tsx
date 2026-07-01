import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "How the Metatake Score works — value, cost & risk · Metatake",
  description:
    "What the Metatake Score measures and how to read it: durable value (V), entry cost (C), risk of disappointment (R), net value and efficiency. A rubric-anchored AI estimate with measured reliability.",
};

function Row({ k, tone, children }: { k: string; tone: string; children: React.ReactNode }) {
  return (
    <div className="ab-row">
      <span className={`ab-k ${tone}`}>{k}</span>
      <span className="ab-d">{children}</span>
    </div>
  );
}

export default function CodexAbout() {
  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap lh ab">
        <div className="lh-crumb"><Link href="/codex">The Metatake Score</Link></div>
        <h1 className="lh-h1">How the Metatake Score works</h1>
        <p className="lh-def">
          Most ratings measure <em>satisfaction</em> — did the crowd enjoy it. The <strong>Metatake Score (MTS)</strong>
          measures something different: the <strong>durable value a serious viewer gains</strong> from a film, the
          <strong> cost</strong> to unlock it, and the <strong>risk</strong> it disappoints. It is deliberately
          independent of box office, star ratings and popularity.
        </p>

        <h2 className="ab-h2">The three axes</h2>
        <Row k="Value (V)" tone="ab-v">
          What you keep — cognitive, emotional, formal, moral and lasting yield. Higher is better. Legibility is not
          penalised: a clear, accessible film can score very high.
        </Row>
        <Row k="Cost (C)" tone="ab-c">
          The prerequisite to unlock it — film-history literacy, formal difficulty, outside knowledge, a director&apos;s
          back-catalogue. A cost, <em>not</em> a virtue; difficulty never raises value.
        </Row>
        <Row k="Risk (R)" tone="ab-r">
          How likely it is to disappoint a serious viewer — hollowness, style-over-substance, commercial cowardice, and
          how sharply informed audiences split on it.
        </Row>

        <h2 className="ab-h2">Two summary numbers</h2>
        <Row k="MTS · Net" tone="ab-v">
          Net value = V − λ·R. The default ranking. <strong>λ</strong> is your risk-aversion dial: raise it and risky
          films fall; lower it and you reward ambition. You set λ on the <Link href="/codex">Score page</Link>.
        </Row>
        <Row k="Efficiency" tone="ab-c">
          Value earned per unit of risk — rewards films that deliver a lot with little downside.
        </Row>

        <h2 className="ab-h2">How to read a number</h2>
        <p className="ab-p">
          Each axis is 0–100, anchored to reference films so the scale means the same thing everywhere. As a rough guide:
          <strong> V ≥ 85</strong> is a lasting, essential object; <strong>V ≈ 60–75</strong> is strong and rewarding;
          <strong> V ≤ 40</strong> is thin. <strong>R ≤ 15</strong> is a safe bet; <strong>R ≥ 50</strong> is genuinely
          divisive or hollow. A high-cost film (<strong>C ≥ 70</strong>) asks real preparation.
        </p>

        <h2 className="ab-h2">Why you can trust it</h2>
        <p className="ab-p">
          Scores are produced by a fixed, version-locked rubric anchored to a calibrated reference set, each film judged
          independently, aggregated across samples, and checked for drift over time. Popularity metrics (IMDb, RT,
          Metascore) are shown <em>alongside</em> for comparison but are <strong>never</strong> inputs to the score —
          this avoids simply re-packaging the crowd.
        </p>
        <p className="ab-note">
          Honest limit: this is a rubric-anchored <em>AI estimate</em>, not a human-consensus verdict. We publish the
          reliability of each score and treat it as a well-calibrated opinion, not a fact.
        </p>

        <p style={{ marginTop: 22 }}><Link className="ab-back" href="/codex">← Explore films by Metatake Score</Link></p>
      </div>
    </div>
  );
}
