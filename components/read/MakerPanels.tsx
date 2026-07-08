import Link from "next/link";
import { CRAFT_VERBED, ordinal, type FilmCreditsPayload } from "@/lib/film-credits-data";
import { personSlug } from "@/app/credits/credits-logic";

/**
 * MakerPanels — blog-preview cards for the people behind one film (2026-07-08),
 * shared by /film/[slug]/credits and the film page's Credits tab. One panel
 * per craft: face, question-form headline mirroring the destination page's
 * title, and ONE sentence carrying what the person does in general AND what
 * they did on this film (career count/since-year + the Nth-meeting fact).
 * Styles: .crd-* in app/film/[slug]/read.css.
 */
export default function MakerPanels({ payload }: { payload: FilmCreditsPayload }) {
  const { film, director, directorFilmog, relations } = payload;

  return (
    <div className="crd-grid">
      {director && directorFilmog.length > 0 ? (() => {
        const dIdx = directorFilmog.findIndex((f) => f.id === film.tmdb_id);
        const href = film.director_slug && film.director === director.name
          ? `/director/${film.director_slug}`
          : `/credits?p=${director.id}&c=dir`;
        return (
          <a className="crd-panel" href={href} key="director">
            {director.profile
              ? /* eslint-disable-next-line @next/next/no-img-element */
                <img src={`https://image.tmdb.org/t/p/w185${director.profile}`} alt={director.name} width={92} height={120} loading="lazy" />
              : <span className="crd-ph" aria-hidden>{director.name[0]}</span>}
            <span>
              <span className="crd-k">Director · {film.title}</span>
              <h3>What has {director.name} directed — and with whom?</h3>
              <p>
                The director of {film.title}: {directorFilmog.length} directing credits since {directorFilmog[0].year}
                {dIdx >= 0 ? <> — {film.title} was the {ordinal(dIdx + 1)} of them</> : null}.
              </p>
              <span className="crd-go">Open the file →</span>
            </span>
          </a>
        );
      })() : null}
      {relations.filter((r) => r.roleKey !== "actor").map((r) => {
        const verbed = CRAFT_VERBED[r.roleKey] ?? "made";
        return (
          <a className="crd-panel" href={`/credits/${personSlug(r.name, r.personId)}`} key={`${r.personId}-${r.roleKey}`}>
            {r.profile
              ? /* eslint-disable-next-line @next/next/no-img-element */
                <img src={`https://image.tmdb.org/t/p/w185${r.profile}`} alt={r.name} width={92} height={120} loading="lazy" />
              : <span className="crd-ph" aria-hidden>{r.name[0]}</span>}
            <span>
              <span className="crd-k">{r.role} · {film.title}</span>
              <h3>What has {r.name} {verbed} — and with whom?</h3>
              <p>
                The {r.role} of {film.title} — {r.careerCount} film{r.careerCount === 1 ? "" : "s"} {verbed}
                {r.careerFirst ? ` since ${r.careerFirst}` : ""}
                {r.shared.length > 0 && director ? (
                  r.shared.length === 1
                    ? <>; the only one with {director.name}</>
                    : <>; {r.idx >= 0 ? `the ${ordinal(r.idx + 1)}` : "one"} of {r.shared.length} with {director.name}</>
                ) : null}.
              </p>
              <span className="crd-go">Open the file →</span>
            </span>
          </a>
        );
      })}
    </div>
  );
}

/** The film page's compact call-to-action under the panels. */
export function MakerPanelsCta({ slug, title }: { slug: string; title: string }) {
  return (
    <p style={{ margin: "14px 0 0" }}>
      <Link
        href={`/film/${slug}/credits`}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "#16233F", color: "#FBF8F1", padding: "9px 18px", borderRadius: 999,
          fontSize: 14, fontWeight: 600, textDecoration: "none",
        }}
      >
        <span aria-hidden style={{ color: "#E0922A" }}>◉</span>
        Who made {title}? — every meeting, counted →
      </Link>
    </p>
  );
}
