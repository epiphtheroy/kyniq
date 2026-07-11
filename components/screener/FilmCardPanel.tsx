"use client";

/**
 * FilmCardPanel — the appraisal card for one pinned film in the Screener tray.
 * Loads cinecodex_card (TS + V/C/R + 13 subs + rank + IMDb/RT/Metascore) and the
 * film's streaming availability in the chosen country. Rendered one-up under the
 * active tab, or as aligned columns in Compare mode. Unscored films (Tier-2)
 * degrade to a "Not yet appraised" card with a link to the film page.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import ScoreDonut from "@/components/ScoreDonut";
import PosterActions from "@/components/PosterActions";
import { CODEX_DIMS } from "@/lib/cinecodex_dims";
import { verdictSentence, bandWord, dimSentence } from "@/lib/takescore_prose";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const POSTER = "https://image.tmdb.org/t/p/w185";
const LOGO = "https://image.tmdb.org/t/p/w45";
const AX = { v: "#0F6E56", c: "#6b7280", r: "#C8102E" };

type Card = {
  slug: string; title: string; year: number | null; director: string | null; poster_path: string | null;
  v: number; c: number; r: number; u: number; rank: number | null; rank_total: number | null;
  subs: Record<string, number>;
  ext: { imdb: number | null; rt: number | null; meta: number | null } | null;
};
type Prov = { provider_id: number; provider_name: string; provider_logo: string | null };

const GROUP: Record<string, string> = { value: AX.v, cost: AX.c, risk: AX.r };

export default function FilmCardPanel({
  slug, watchCountry, fallbackTitle, fallbackPoster, compare = false, onClose,
}: {
  slug: string;
  watchCountry: string;
  fallbackTitle?: string;
  fallbackPoster?: string | null;
  compare?: boolean;
  onClose?: () => void;
}) {
  const [card, setCard] = useState<Card | null>(null);
  const [state, setState] = useState<"load" | "ok" | "unscored">("load");
  const [provs, setProvs] = useState<Prov[]>([]);

  useEffect(() => {
    let alive = true;
    setState("load"); setCard(null); setProvs([]);
    (async () => {
      const { data } = await sb.rpc("cinecodex_card", { p_slug: slug });
      if (!alive) return;
      if (data && (data as Card).v != null) { setCard(data as Card); setState("ok"); }
      else setState("unscored");
      // providers: resolve film id, then its streaming rows in the chosen country
      const { data: f } = await sb.from("films").select("id").eq("slug", slug).maybeSingle();
      const id = (f as { id: string } | null)?.id;
      if (id && alive) {
        const { data: pr } = await sb.from("film_provider_index")
          .select("provider_id, provider_name, provider_logo")
          .eq("film_id", id).eq("country_code", watchCountry).in("kind", ["flatrate", "ads", "free"]);
        if (alive) {
          const seen = new Set<number>();
          const uniq = ((pr as Prov[]) ?? []).filter((p) => !seen.has(p.provider_id) && seen.add(p.provider_id));
          setProvs(uniq);
        }
      }
    })();
    return () => { alive = false; };
  }, [slug, watchCountry]);

  const title = card?.title ?? fallbackTitle ?? slug;
  const poster = card?.poster_path ?? fallbackPoster ?? null;

  return (
    <div className={`scr-card${compare ? " scr-card--cmp" : ""}`}>
      <div className="scr-card-head">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <Link href={`/film/${slug}`}><img className="scr-card-poster" src={`${POSTER}${poster}`} alt="" width={64} height={96} /></Link>
        ) : <div className="scr-card-poster scr-card-poster--e" />}
        <div className="scr-card-id">
          <Link href={`/film/${slug}`} className="scr-card-title">{title}{card?.year ? ` (${card.year})` : ""}</Link>
          {card?.director ? <div className="scr-card-dir">{card.director}</div> : null}
          <div className="scr-card-act">
            <PosterActions slug={slug} rating={false} compact />
            <Link className="scr-card-appr" href={`/takescore/film/${slug}`}>Full appraisal →</Link>
          </div>
        </div>
        {onClose && !compare ? <button className="scr-card-x" onClick={onClose} aria-label="Close">×</button> : null}
      </div>

      {state === "load" ? (
        <div className="scr-card-load">Loading appraisal…</div>
      ) : state === "unscored" ? (
        <div className="scr-card-unscored">
          <b>Not yet appraised.</b> This film is in the catalog but hasn&apos;t been scored on the thirteen dimensions yet.{" "}
          <Link href={`/film/${slug}`}>Open the film page →</Link>
        </div>
      ) : card ? (
        <>
          {/* verdict fills the middle; TakeScore + the three rings sit together on the right */}
          <div className="scr-card-scores">
            <div className="scr-card-ts">
              <b className="scr-card-tsn">{Math.round(card.u)}</b>
              <span className="scr-card-tsk">TakeScore</span>
              {card.rank ? <span className="scr-card-rank">#{card.rank}{card.rank_total ? ` of ${card.rank_total.toLocaleString("en-US")}` : ""}</span> : null}
            </div>
            <p className="scr-card-verdict">{verdictSentence(card.v, card.c, card.r, card.u, card.title)}</p>
            <div className="scr-card-dons">
              <ScoreDonut val={card.v} color={AX.v} label="Value" size={58} />
              <ScoreDonut val={card.c} color={AX.c} label="Cost" size={58} />
              <ScoreDonut val={card.r} color={AX.r} label="Risk" size={58} />
            </div>
          </div>

          <div className="scr-card-ext">
            {card.ext?.imdb != null ? <span>IMDb <b>{Number(card.ext.imdb).toFixed(1)}</b></span> : null}
            {card.ext?.rt != null ? <span>RT <b>{card.ext.rt}%</b></span> : null}
            {card.ext?.meta != null ? <span>Metascore <b>{card.ext.meta}</b></span> : null}
            {card.ext == null || (card.ext.imdb == null && card.ext.rt == null && card.ext.meta == null)
              ? <span className="scr-card-noext">No external ratings on file</span> : null}
          </div>

          {/* each of the 13 dimensions gets its plain-word reading, not just a bar */}
          <div className="scr-card-subs">
            {CODEX_DIMS.map((d) => {
              const val = card.subs?.[d.key] ?? 0;
              return (
                <div className="scr-card-sub" key={d.key} title={dimSentence(d.key, val) || `${d.label}: ${val}`}>
                  <span className="scr-card-sub-l">{d.label}</span>
                  <span className="scr-card-sub-word" style={{ color: GROUP[d.group] }}>{bandWord(d.group, val)}</span>
                  <span className="scr-card-sub-bar"><i style={{ width: `${val}%`, background: GROUP[d.group] }} /></span>
                  <span className="scr-card-sub-v">{val}</span>
                </div>
              );
            })}
          </div>

          <div className="scr-card-watch">
            <span className="scr-card-watch-k">Watch in {watchCountry}</span>
            {provs.length ? (
              <div className="scr-card-watch-logos">
                {provs.slice(0, 6).map((p) => (
                  <span className="scr-card-prov" key={p.provider_id} title={p.provider_name}>
                    {p.provider_logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`${LOGO}${p.provider_logo}`} alt={p.provider_name} width={26} height={26} loading="lazy" />
                    ) : <span className="scr-card-prov__txt">{p.provider_name}</span>}
                  </span>
                ))}
              </div>
            ) : <Link className="scr-card-watch-none" href={`/whereto/${slug}`}>Not streaming here — see all options →</Link>}
          </div>
        </>
      ) : null}
    </div>
  );
}
