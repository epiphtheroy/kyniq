import Link from "next/link";
import SearchBox from "@/components/SearchBox";

/**
 * AskHero — the prompt-first hero at the top of the home page.
 * PRIMARY: the in-site search (SearchBox, hero variant) — instant typeahead that
 * jumps straight to any film / figure / trope / concept page.
 * SECONDARY: "or ask Metatake AI" — a GET <form action="/chat"> + example chips
 * (server-rendered + crawlable). The full editorial home renders unchanged below.
 */
const EXAMPLES = [
  "Films about surveillance that isn't a camera",
  "What connects Bacurau and There Will Be Blood?",
  "The body that performs past its hour",
  "Why do we give storms friendly names?",
];

export default function AskHero({ readings, films }: { readings: number; films: number }) {
  return (
    <section className="ah">
      <div className="ah__in">
        <p className="ah-kick"><span className="dot" /> A critical map of cinema</p>
        <h1 className="ah-h1">Search the map — <em>or ask it anything.</em></h1>
        <p className="ah-lead">
          Find any film, figure, trope, or concept and jump straight to it — or ask a question and get an
          answer <b>retrieved from real criticism, not generated</b>.
        </p>

        {/* PRIMARY — in-site search */}
        <div className="ah-search">
          <SearchBox variant="hero" />
          <p className="ah-shint">Films · directors · figures · tropes · concepts — type to jump straight there</p>
        </div>

        {/* SECONDARY — ask the AI */}
        <div className="ah-ask">
          <span className="ah-or">or ask Metatake&nbsp;AI</span>
          <form className="ah-bar" action="/chat" method="get" role="search">
            <input
              className="ah-input" name="q" type="search" maxLength={300}
              placeholder="Ask about a film, a theme, a feeling…"
              aria-label="Ask Metatake AI a question"
            />
            <button className="ah-go" type="submit">Ask&nbsp;→</button>
          </form>
          <div className="ah-eg">
            {EXAMPLES.map((x) => (
              <Link key={x} className="ah-chip" href={`/chat?q=${encodeURIComponent(x)}`}>{x}</Link>
            ))}
          </div>
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
