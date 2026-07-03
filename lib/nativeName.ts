import { unstable_cache } from "next/cache";

/**
 * Native-script names for people (directors, crew) — the name they are
 * actually searched by in their own language. Source order: TMDB
 * also_known_as, then Wikidata label (P4985 = TMDB person ID) when TMDB
 * lacks the expected script. Shown once in titles/leads; never forced when
 * the person's expected script has no alias (a Korean director with only a
 * Cyrillic alias shows none).
 */
export const HANGUL = /[가-힣]/;
const CJK = /[㐀-䶿一-鿿]/;
const KANA_CJK = /[぀-ヿ㐀-䶿一-鿿]/;
const CYRILLIC = /[Ѐ-ӿ]/;
export const NON_LATIN = /[Ѐ-ӿ֐-׿؀-ۿऀ-ॿ฀-๿぀-ヿ㐀-䶿一-鿿가-힯]/;

export function expectedScript(place: string | null | undefined): RegExp | null {
  if (!place) return null;
  const p = place.toLowerCase();
  if (p.includes("korea")) return HANGUL;
  if (p.includes("japan")) return KANA_CJK;
  if (/china|taiwan|hong kong/.test(p)) return CJK;
  if (/russia|ukraine|belarus|kazakh|soviet|ussr/.test(p)) return CYRILLIC;
  return null;
}

export function expectedLang(place: string | null | undefined): string | null {
  if (!place) return null;
  const p = place.toLowerCase();
  if (p.includes("korea")) return "ko";
  if (p.includes("japan")) return "ja";
  if (/china|taiwan|hong kong/.test(p)) return "zh";
  if (/russia|ukraine|belarus|kazakh|soviet|ussr/.test(p)) return "ru";
  return null;
}

export function pickNativeAlias(name: string, aliases: string[] | null | undefined, place: string | null | undefined): string | null {
  const list = (aliases ?? []).map((a) => a.trim()).filter((a) => a && a !== name);
  const expected = expectedScript(place);
  if (expected) return list.find((a) => expected.test(a)) ?? null;
  return list.find((a) => HANGUL.test(a)) ?? list.find((a) => NON_LATIN.test(a)) ?? null;
}

export async function wikidataNativeByTmdb(tmdbId: number, lang: string): Promise<string | null> {
  try {
    const q = `SELECT ?l WHERE { ?item wdt:P4985 "${tmdbId}" . ?item rdfs:label ?l . FILTER(LANG(?l)="${lang}") } LIMIT 1`;
    const r = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "Metatake/1.0 (wonwoo@metatake.net)", accept: "application/json" },
      next: { revalidate: 604800 },
    });
    if (!r.ok) return null;
    const d = (await r.json()) as { results?: { bindings?: { l?: { value?: string } }[] } };
    const v = d.results?.bindings?.[0]?.l?.value?.trim() ?? null;
    return v && NON_LATIN.test(v) ? v : null;
  } catch {
    return null;
  }
}

/** TMDB alias first, Wikidata second — the one native name worth showing. */
export async function resolveNative(args: {
  tmdbId: number;
  name: string;
  aliases: string[] | null | undefined;
  place: string | null | undefined;
}): Promise<string | null> {
  const fromTmdb = pickNativeAlias(args.name, args.aliases, args.place);
  if (fromTmdb) return fromTmdb;
  const lang = expectedLang(args.place);
  return lang ? wikidataNativeByTmdb(args.tmdbId, lang) : null;
}

function tmdbHeaders(token: string) {
  const v4 = token.length > 40;
  return { v4, headers: v4 ? { Authorization: `Bearer ${token}`, accept: "application/json" } : { accept: "application/json" } };
}

/**
 * Native name for a director we only know by name (directors table carries no
 * TMDB id): search TMDB for the person, prefer the Directing match, then run
 * the same alias/Wikidata resolution. Cached a week per name.
 */
export function directorNative(name: string): Promise<string | null> {
  return unstable_cache(
    async () => {
      const token = process.env.TMDB_READ_TOKEN;
      if (!token) return null;
      const { v4, headers } = tmdbHeaders(token);
      const qs = (extra: string) => (v4 ? extra : `${extra}&api_key=${token}`);
      try {
        const s = await fetch(
          `https://api.themoviedb.org/3/search/person?${qs(`query=${encodeURIComponent(name)}&include_adult=false`)}`,
          { headers, next: { revalidate: 604800 } },
        );
        if (!s.ok) return null;
        const sj = (await s.json()) as { results?: { id: number; name: string; known_for_department?: string | null }[] };
        const rs = sj.results ?? [];
        const hit = rs.find((r) => r.known_for_department === "Directing") ?? rs[0];
        if (!hit) return null;
        const pr = await fetch(`https://api.themoviedb.org/3/person/${hit.id}${v4 ? "" : `?api_key=${token}`}`, {
          headers, next: { revalidate: 604800 },
        });
        if (!pr.ok) return null;
        const p = (await pr.json()) as { name: string; also_known_as?: string[]; place_of_birth?: string | null };
        return await resolveNative({ tmdbId: hit.id, name: p.name, aliases: p.also_known_as, place: p.place_of_birth });
      } catch {
        return null;
      }
    },
    ["director-native", name],
    { revalidate: 604800 },
  )();
}
