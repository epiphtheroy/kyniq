import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";

export const revalidate = 3600;
export const metadata: Metadata = {
  title: "How the TakeScore works — value, cost & risk · Metatake",
  description:
    "What the TakeScore measures and how to read it: durable value, entry cost, risk of disappointment, net value and efficiency. A rubric-anchored AI estimate with measured reliability.",
};

function Row({ k, tone, children }: { k: string; tone: string; children: React.ReactNode }) {
  return (
    <div className="ab-row">
      <span className={`ab-k ${tone}`}>{k}</span>
      <span className="ab-d">{children}</span>
    </div>
  );
}

export default function TakeScoreAbout() {
  return (
    <div className="mt">
      <SiteNav />
      <div className="mt-wrap lh ab">
        <div className="lh-crumb"><Link href="/takescore">TakeScore</Link></div>
        <h1 className="lh-h1">How the TakeScore works</h1>
        <p className="lh-def">
          Most ratings measure <em>satisfaction</em> — did the crowd enjoy it. The <strong>TakeScore (TS)</strong>
          measures something different: the <strong>durable value a serious viewer gains</strong> from a film, the
          <strong> cost</strong> to unlock it, and the <strong>risk</strong> it disappoints. It is deliberately
          independent of box office, star ratings and popularity.
        </p>

        <h2 className="ab-h2">The three axes</h2>
        <Row k="Value" tone="ab-v">
          What you keep — cognitive, emotional, formal, moral and lasting yield. Higher is better. Legibility is not
          penalised: a clear, accessible film can score very high.
        </Row>
        <Row k="Cost" tone="ab-c">
          The prerequisite to unlock it — film-history literacy, formal difficulty, outside knowledge, a director&apos;s
          back-catalogue. A cost, <em>not</em> a virtue; difficulty never raises value.
        </Row>
        <Row k="Risk" tone="ab-r">
          How likely it is to disappoint a serious viewer — hollowness, style-over-substance, commercial cowardice, and
          how sharply informed audiences split on it.
        </Row>

        <h2 className="ab-h2">Two summary numbers</h2>
        <Row k="TakeScore (TS)" tone="ab-v">
          Net value = Value − λ·Risk. The default ranking. <strong>λ</strong> is your risk-aversion dial: raise it and
          risky films fall; lower it and you reward ambition. You set λ on the <Link href="/takescore">TakeScore page</Link>.
        </Row>
        <Row k="Efficiency" tone="ab-c">
          Value earned per unit of risk — rewards films that deliver a lot with little downside.
        </Row>

        <h2 className="ab-h2">Thirteen sub-dimensions</h2>
        <p className="ab-p">
          Value, Cost and Risk are each built from finer readings — thirteen in all. On the TakeScore page you can set a
          range on any of them (for example: high Cognitive value, low Polarization) to find exactly the kind of film you
          want.
        </p>

        <h2 className="ab-h2">How to read a number</h2>
        <p className="ab-p">
          Each axis is 0–100, anchored to reference films so the scale means the same thing everywhere. As a rough guide:
          <strong> Value ≥ 85</strong> is a lasting, essential object; <strong>Value ≈ 60–75</strong> is strong and
          rewarding; <strong>Value ≤ 40</strong> is thin. <strong>Risk ≤ 15</strong> is a safe bet; <strong>Risk ≥ 50</strong>
          is genuinely divisive or hollow. A high-cost film (<strong>Cost ≥ 70</strong>) asks real preparation.
        </p>

        <h2 className="ab-h2">Why you can trust it</h2>
        <p className="ab-p">
          Scores are produced by a fixed, version-locked rubric anchored to a calibrated reference set, each film judged
          independently, aggregated across samples, and checked for drift over time. Popularity metrics (IMDb, Rotten
          Tomatoes, Metascore) are shown <em>alongside</em> for comparison but are <strong>never</strong> inputs to the
          score — this avoids simply re-packaging the crowd.
        </p>
        <p className="ab-note">
          Honest limit: this is a rubric-anchored <em>AI estimate</em>, not a human-consensus verdict. We publish the
          reliability of each score and treat it as a well-calibrated opinion, not a fact.
        </p>

        <p style={{ marginTop: 22 }}><Link className="ab-back" href="/takescore">← Explore films by TakeScore</Link></p>
      </div>
    </div>
  );
}
