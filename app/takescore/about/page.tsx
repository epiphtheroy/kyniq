import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/home2/SiteNav";
import { CODEX_DIMS, takescoreDimUrl } from "@/lib/cinecodex_dims";

export const revalidate = 3600;
export const metadata: Metadata = {
  alternates: { canonical: "/takescore/about" },
  title: "How the TakeScore works — value, cost & risk",
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
          What you keep — <Link href={takescoreDimUrl("cognitive")}>cognitive</Link>,{" "}
          <Link href={takescoreDimUrl("affective")}>emotional</Link>, <Link href={takescoreDimUrl("formal")}>formal</Link>,{" "}
          <Link href={takescoreDimUrl("moral")}>moral</Link> and <Link href={takescoreDimUrl("durability")}>lasting</Link>{" "}
          yield. Higher is better. Legibility is not penalised: a clear, accessible film can score very high.
        </Row>
        <Row k="Cost" tone="ab-c">
          The prerequisite to unlock it — <Link href={takescoreDimUrl("intertextual")}>film-history literacy</Link>,{" "}
          <Link href={takescoreDimUrl("formal-radicalism")}>formal difficulty</Link>,{" "}
          <Link href={takescoreDimUrl("extratextual")}>outside knowledge</Link>, a director&apos;s{" "}
          <Link href={takescoreDimUrl("auteur-oeuvre")}>back-catalogue</Link>. A cost, <em>not</em> a virtue; difficulty
          never raises value.
        </Row>
        <Row k="Risk" tone="ab-r">
          How likely it is to disappoint a serious viewer — <Link href={takescoreDimUrl("hollowness")}>hollowness</Link>,{" "}
          <Link href={takescoreDimUrl("insincerity")}>style-over-substance</Link>,{" "}
          <Link href={takescoreDimUrl("cowardice")}>commercial cowardice</Link>, and{" "}
          <Link href={takescoreDimUrl("polarization")}>how sharply informed audiences split</Link> on it.
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
          range on any of them (for example: high <Link href={takescoreDimUrl("cognitive")}>Cognitive</Link> value, low{" "}
          <Link href={takescoreDimUrl("polarization")}>Polarization</Link>) to find exactly the kind of film you want.
          Each dimension also has its own essay explaining what it measures and which films define its scale.
        </p>
        <style>{`
          .ab-dimnav{margin:12px 0 4px; padding:12px 14px 6px; border:1px solid var(--hairline-2); border-radius:10px; background:var(--paper-2,#fafafa)}
          .ab-dimnav-t{font-family:var(--font-ui); font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); margin-bottom:4px}
          .ab-dimnav-g{display:grid; grid-template-columns:64px 1fr; gap:12px; padding:8px 0; border-top:1px solid var(--hairline)}
          .ab-dimnav-g:first-of-type{border-top:0}
          .ab-dimnav-k{font-family:var(--font-ui); font-size:12px; font-weight:600; padding-top:2px}
          .ab-dimnav-l{list-style:none; margin:0; padding:0}
          .ab-dimnav-l li{margin:3px 0}
          .ab-dimnav-l a{font-size:13.5px; line-height:1.5; color:var(--ink); text-decoration:none}
          .ab-dimnav-l a strong{font-weight:600}
          .ab-dimnav-l a:hover strong{text-decoration:underline}
          .ab-dimnav-q{color:var(--muted)}
          @media(max-width:560px){.ab-dimnav-g{grid-template-columns:1fr; gap:2px}}
        `}</style>
        <nav className="ab-dimnav" aria-label="Read each dimension in depth">
          <div className="ab-dimnav-t">Read each dimension in depth</div>
          {([["value", "Value", "ab-v"], ["cost", "Cost", "ab-c"], ["risk", "Risk", "ab-r"]] as const).map(([g, label, tone]) => (
            <div className="ab-dimnav-g" key={g}>
              <span className={`ab-dimnav-k ${tone}`}>{label}</span>
              <ul className="ab-dimnav-l">
                {CODEX_DIMS.filter((d) => d.group === g).map((d) => (
                  <li key={d.key}>
                    <Link href={takescoreDimUrl(d.slug)}>
                      <strong>{d.label}</strong> <span className="ab-dimnav-q">— {d.question}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <h2 className="ab-h2">How to read a number</h2>
        <p className="ab-p">
          Each axis is 0–100, anchored to reference films so the scale means the same thing everywhere. As a rough guide:
          <strong> Value ≥ 85</strong> is a lasting, essential object; <strong>Value ≈ 60–75</strong> is strong and
          rewarding; <strong>Value ≤ 40</strong> is thin. <strong>Risk ≤ 15</strong> is a safe bet; <strong>Risk ≥ 50</strong>
          is genuinely divisive or hollow. A high-cost film (<strong>Cost ≥ 70</strong>) asks real preparation.
        </p>

        <h2 className="ab-h2">Why you can trust it</h2>
        <p className="ab-p">
          Every score is computed by Metatake AI against a version-locked rubric designed and calibrated by{" "}
          <Link href="/editor">Wonwoo Yoon</Link>, founder &amp; editor of Metatake. The rubric is fixed and anchored to
          a calibrated reference set: each film is judged independently, aggregated across samples, and checked for
          drift over time. Popularity metrics (IMDb, Rotten Tomatoes, Metascore) are shown <em>alongside</em> for
          comparison but are <strong>never</strong> inputs to the score — this avoids simply re-packaging the crowd.
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
