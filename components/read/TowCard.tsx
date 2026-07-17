import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { t, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import "./tow-card.css";

// to.W — the curator's letter, addressed "to. WY. Heo" and sent "from. Metatake
// AI Editorial", directed by W. Yoon. A single-film note on where a film stands
// in the Metatake index, assembled (LLM-0) from curation.v_film_comment via the
// tow_comment RPC. Shared across the TakeScore film page and the film page's
// TakeScore section.
//
// Why the desk signs it and not a person (D2, 2026-07-17): the verdict data is
// TakeScore, computed by Metatake AI against a version-locked rubric; the prose
// around it is a fixed template. Nobody sat down and wrote it, so no human name
// goes on it — W. Yoon is credited for directing the method, and the mark links
// to the editor. Full restatement: /methodology/why-a-film-is-in-the-index.

export type TowComment = {
  verdict: string;
  verdict_label: string | null;
  authority_label: string | null;
  rationale: string | null;
  director?: string | null;
  auteur?: boolean | null;
  rec_date?: string | null;
};

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

// Null is a real state (curation-less films render nothing), so a cached null is
// fine; only transport errors throw (and are thus never cached).
export function loadTow(slug: string): Promise<TowComment | null> {
  return unstable_cache(
    async () => {
      const { data, error } = await db().rpc("tow_comment", { p_slug: slug });
      if (error) throw new Error(`tow_comment(${slug}): ${error.message}`);
      return (data as TowComment | null) ?? null;
    },
    ["tow-comment4", slug],
    { revalidate: 3600, tags: [`takescore-film:${slug}`] },
  )().catch(() => null);
}

// First sentence of the rationale (split on the first ". "; whole string if none).
function firstSentence(s: string): string {
  const i = s.indexOf(". ");
  return i === -1 ? s : s.slice(0, i + 1);
}

// variant="short" (film main page): kicker + first sentence + a link to the full
// letter on the appraisal page — kills the byte-identical cross-page duplication
// with the /takescore/film/[slug] page, which keeps the full letter (E4).
export default function TowCard({
  tow,
  filmTitle,
  variant = "full",
  slug,
  locale = DEFAULT_LOCALE,
}: {
  tow: TowComment | null;
  filmTitle: string;
  variant?: "full" | "short";
  slug?: string;
  locale?: Locale;
}) {
  if (!tow?.rationale) return null;
  const isShort = variant === "short";
  const body = isShort ? firstSentence(tow.rationale) : tow.rationale;
  return (
    <section className="towc" aria-labelledby="towc-h">
      <div className="towc-head">
        <div>
          <div className="towc-kicker">to. WY. Heo</div>
          <h2 className="towc-h" id="towc-h">{t(locale, "Why {title} is in the index", { title: filmTitle })}</h2>
        </div>
        {tow.verdict_label ? (
          <span className={`towc-chip towc-chip--${tow.verdict}`}>{tow.verdict_label}</span>
        ) : null}
      </div>
      <p className="towc-p">{body}</p>
      {isShort && slug ? (
        <p className="towc-more">
          <Link href={`/takescore/film/${slug}#towc-h`}>{t(locale, "Read the full letter on the appraisal page →")}</Link>
        </p>
      ) : null}
      {!isShort && tow.rec_date ? (
        <p className="towc-recd">{t(locale, "Recommended into the Metatake index · {date}", { date: tow.rec_date })}</p>
      ) : null}
      <div className="towc-signrow">
        <div>
          <div className="towc-sign">from. Metatake AI Editorial</div>
          <div className="towc-recd">{t(locale, "directed by W. Yoon")}</div>
        </div>
        <Link href="/editor" className="towc-ava" title={t(locale, "Wonwoo Yoon — Metatake editor")} aria-label={t(locale, "Wonwoo Yoon, Metatake editor — view profile")}>w</Link>
      </div>
      {!isShort ? (
        <p className="towc-note">
          {t(locale, "A curator's note on {title}'s place in the Metatake index — drawn from the catalog's curation records, and kept separate from the TakeScore appraisal above.", { title: filmTitle })}
        </p>
      ) : null}
    </section>
  );
}
