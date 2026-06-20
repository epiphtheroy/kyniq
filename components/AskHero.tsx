import Link from "next/link";
import SearchBox from "@/components/SearchBox";
import HeroExamples from "@/components/HeroExamples";

/**
 * AskHero — the prompt-first hero at the top of the home page.
 * PRIMARY: the in-site search (SearchBox, hero variant) — instant typeahead that
 * jumps straight to any film / figure / trope / concept page.
 * SECONDARY: "or ask Metatake AI" — a GET <form action="/chat"> + rotating example
 * chips. The lead says what Metatake *is*: close readings of films through their
 * figures, mapped across all of cinema — not reviews, not a "connect two films" tool.
 */
export default function AskHero({ readings, films }: { readings: number; films: number }) {
  return (
    <section className="ah">
      <div className="ah__in">
        <p className="ah-kick"><span className="dot" /> A critical map of cinema <span className="ah-kick-cont">— read film by film, figure by figure</span></p>
        <h1 className="ah-h1">Search the map — <em>or ask it anything.</em></h1>

        {/* PRIMARY — in-site search */}
        <div className="ah-search">
          <SearchBox variant="hero" />
          <p className="ah-shint">
            <Link href="/film">Films</Link>
            {" · "}<Link href="/director">Directors</Link>
            {" · "}<Link href="/tropes">Figures</Link>
            {" · "}<Link href="/concept">Concepts</Link>
            {" · "}<Link href="/meta-takes">Meta takes</Link>
            {" — type to jump straight there"}
          </p>
        </div>

        {/* SECONDARY — ask the AI */}
        <div className="ah-ask">
          <span className="ah-or">or ask Metatake&nbsp;AI</span>
          <form className="ah-bar" action="/chat" method="get" role="search">
            <input
              className="ah-input" name="q" type="search" maxLength={300}
              placeholder="Ask about a film, a figure, a feeling…"
              aria-label="Ask Metatake AI a question"
            />
            <button className="ah-go" type="submit">Ask&nbsp;→</button>
          </form>
          <HeroExamples />
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
