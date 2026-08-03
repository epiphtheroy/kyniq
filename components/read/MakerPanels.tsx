import Link from "next/link";
import { CRAFT_VERBED, ordinal, type FilmCreditsPayload } from "@/lib/film-credits-data";
import { hasCrewPage } from "@/lib/crewRoster";
import { personSlug } from "@/app/credits/credits-logic";
import { t, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

/**
 * MakerPanels — blog-preview cards for the people behind one film (2026-07-08),
 * shared by /film/[slug]/credits and the film page's Credits tab. One panel
 * per craft: face, question-form headline mirroring the destination page's
 * title, and ONE sentence carrying what the person does in general AND what
 * they did on this film (career count/since-year + the Nth-meeting fact).
 * Styles: .crd-* in app/film/[slug]/read.css.
 */
export default function MakerPanels({ payload, locale = DEFAULT_LOCALE }: { payload: FilmCreditsPayload; locale?: Locale }) {
  const { film, director, directorFilmog, relations } = payload;

  return (
    <div className="crd-grid">
      {director && directorFilmog.length > 0 ? (() => {
        const dIdx = directorFilmog.findIndex((f) => f.id === film.tmdb_id);
        const href = film.director_slug && film.director === director.name
          ? `/director/${film.director_slug}`
          : `/credits?p=${director.id}&c=dir`;
        const dOrd = locale === DEFAULT_LOCALE ? ordinal(dIdx + 1) : String(dIdx + 1);
        return (
          <a className="crd-panel" href={href} key="director">
            {director.profile
              ? /* eslint-disable-next-line @next/next/no-img-element */
                <img src={`https://image.tmdb.org/t/p/w185${director.profile}`} alt={director.name} width={92} height={120} loading="lazy" />
              : <span className="crd-ph" aria-hidden>{director.name[0]}</span>}
            <span>
              <span className="crd-k">{t(locale, "Director")} · {film.title}</span>
              <h3>{t(locale, "What has {name} directed — and with whom?", { name: director.name })}</h3>
              <p>
                {t(locale, "The director of {title}: {count} directing credits since {year}", { title: film.title, count: directorFilmog.length, year: directorFilmog[0].year })}
                {dIdx >= 0 ? <>{t(locale, " — {title} was the {ord} of them", { title: film.title, ord: dOrd })}</> : null}.
              </p>
              <span className="crd-go">{t(locale, "Open the file →")}</span>
            </span>
          </a>
        );
      })() : null}
      {/* Every panel is a link whose whole promise is "Open the file →", so a maker
          without a page gets no panel rather than a dead one. They are still named
          in the credits prose on /film/[slug]/credits — see lib/crewRoster.ts. */}
      {relations.filter((r) => r.roleKey !== "actor" && hasCrewPage(r.personId)).map((r) => {
        const verbed = CRAFT_VERBED[r.roleKey] ?? "made";
        const verbedL = t(locale, verbed);
        const roleL = t(locale, r.role);
        const filmsPhrase = locale === DEFAULT_LOCALE
          ? `${r.careerCount} film${r.careerCount === 1 ? "" : "s"}`
          : t(locale, "{count} films", { count: r.careerCount });
        const sharedPos = r.idx >= 0
          ? t(locale, "the {ord}", { ord: locale === DEFAULT_LOCALE ? ordinal(r.idx + 1) : String(r.idx + 1) })
          : t(locale, "one");
        return (
          <a className="crd-panel" href={`/credits/${personSlug(r.name, r.personId)}`} key={`${r.personId}-${r.roleKey}`}>
            {r.profile
              ? /* eslint-disable-next-line @next/next/no-img-element */
                <img src={`https://image.tmdb.org/t/p/w185${r.profile}`} alt={r.name} width={92} height={120} loading="lazy" />
              : <span className="crd-ph" aria-hidden>{r.name[0]}</span>}
            <span>
              <span className="crd-k">{roleL} · {film.title}</span>
              <h3>{t(locale, "What has {name} {verbed} — and with whom?", { name: r.name, verbed: verbedL })}</h3>
              <p>
                {t(locale, "The {role} of {title} — {films} {verbed}", { role: roleL, title: film.title, films: filmsPhrase, verbed: verbedL })}
                {r.careerFirst ? t(locale, " since {year}", { year: r.careerFirst }) : ""}
                {r.shared.length > 0 && director ? (
                  r.shared.length === 1
                    ? <>{t(locale, "; the only one with {name}", { name: director.name })}</>
                    : <>{t(locale, "; {pos} of {count} with {name}", { pos: sharedPos, count: r.shared.length, name: director.name })}</>
                ) : null}.
              </p>
              <span className="crd-go">{t(locale, "Open the file →")}</span>
            </span>
          </a>
        );
      })}
    </div>
  );
}

/** The film page's compact call-to-action under the panels. */
export function MakerPanelsCta({ slug, title, locale = DEFAULT_LOCALE }: { slug: string; title: string; locale?: Locale }) {
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
        {t(locale, "Who made {title}? — every meeting, counted →", { title })}
      </Link>
    </p>
  );
}
