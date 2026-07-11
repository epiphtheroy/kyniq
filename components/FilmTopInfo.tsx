import WatchProviders from "@/components/WatchProviders";

/** Ratings badges (OMDb) + country watch channels (TMDB), as the band under a film hero.
 *  Shared by the full film page and the catalog (non-curated) film page. Renders nothing if empty. */

type Ratings = { imdb_rating: number | null; imdb_votes: number | null; metascore: number | null; rt_tomatometer: number | null };
type Prov = { provider_id: number; provider_name: string; logo_path: string | null };
type Country = { link?: string; flatrate?: Prov[]; rent?: Prov[]; buy?: Prov[]; free?: Prov[]; ads?: Prov[] };
type Watch = { results: Record<string, Country>; countries: string[] };

function fmtVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

export default function FilmTopInfo({ ratings, watch, imdbId }: { ratings: Ratings | null; watch: Watch | null; imdbId: string | null }) {
  const hasRatings = !!(ratings && (ratings.imdb_rating || ratings.metascore || ratings.rt_tomatometer));
  const hasWatch = !!(watch && watch.countries.length > 0);
  if (!hasRatings && !hasWatch) return null;
  return (
    <div className="df-topinfo">
      {hasRatings ? (
        <div className="df-ratings">
          {ratings!.imdb_rating ? (
            imdbId
              ? <a className="df-rt df-rt--imdb" href={`https://www.imdb.com/title/${imdbId}/`} target="_blank" rel="noopener"><b>IMDb</b> {ratings!.imdb_rating}{ratings!.imdb_votes ? <span className="df-rt-v">{fmtVotes(ratings!.imdb_votes)}</span> : null}</a>
              : <span className="df-rt df-rt--imdb"><b>IMDb</b> {ratings!.imdb_rating}</span>
          ) : null}
          {ratings!.rt_tomatometer != null ? <span className="df-rt df-rt--rt"><b>RT</b> {ratings!.rt_tomatometer}%</span> : null}
          {ratings!.metascore != null ? <span className="df-rt df-rt--meta"><b>Metascore</b> {ratings!.metascore}</span> : null}
        </div>
      ) : null}
      {hasWatch ? <WatchProviders results={watch!.results} countries={watch!.countries} /> : null}
    </div>
  );
}
