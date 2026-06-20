import Link from "next/link";

/**
 * AskHero — the prompt-first hero at the top of the home page. Server-rendered
 * (no client JS): a GET <form action="/ask"> and example-question links, so it's
 * crawlable for SEO and the /ask page (which already reads ?q=) runs the query.
 * The full editorial home renders unchanged below this.
 */
const EXAMPLES = [
  "Films about surveillance that isn't a camera",
  "What connects Bacurau and There Will Be Blood?",
  "The body that performs past its hour",
  "Directors obsessed with enclosure",
  "Why do we give storms friendly names?",
];

export default function AskHero({ readings, films }: { readings: number; films: number }) {
  return (
    <section className="ah">
      <div className="ah__in">
        <p className="ah-kick"><span className="dot" /> Ask the map · grounded in real criticism</p>
        <h1 className="ah-h1">A critical map of cinema — <em>ask it anything.</em></h1>
        <p className="ah-lead">
          Type a question about any film, theme, or feeling. Every answer is{" "}
          <b>retrieved from Metatake&apos;s readings — not generated</b> — with the films,
          figures and tropes it&apos;s built on.
        </p>

        <form className="ah-bar" action="/ask" method="get" role="search">
          <input
            className="ah-input" name="q" type="search" maxLength={300}
            placeholder="Ask about a film, a theme, a feeling…"
            aria-label="Ask a question about cinema"
          />
          <button className="ah-go" type="submit">Ask&nbsp;→</button>
        </form>

        <div className="ah-eg">
          {EXAMPLES.map((x) => (
            <Link key={x} className="ah-chip" href={`/ask?q=${encodeURIComponent(x)}`}>{x}</Link>
          ))}
        </div>

        {readings > 0 && films > 0 ? (
          <p className="ah-trust">
            Grounded in <b>{readings.toLocaleString()} readings</b> across{" "}
            <b>{films.toLocaleString()} films</b> · <span className="st">retrieved, not remembered</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
