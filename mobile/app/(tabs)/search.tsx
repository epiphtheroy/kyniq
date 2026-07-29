// Explore tab (구 Search) — search→verdict in 10 seconds + browse (HANDOFF §5.3).
// Direct anon RPC search, best-effort TS/availability decoration, TMDB fallback
// for not-in-canon queries, and an always-on "search the full site" escape hatch.
// v4 adds a Browse block on the empty query: genre + decade chips feeding the
// same tonight BFF (all providers), rendered with the existing FilmResultRow.
// Skinned to design system v2 "Lava": pill search bar with a soft shadow, rounded
// posters, whitespace-separated rows (no hairlines), ghost web-search CTA.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AvailabilityDots,
  Btn,
  Chip,
  PosterImg,
  Screen,
  SectionTitle,
  Serif,
  Tactile,
  TSBadge,
  Ui,
} from "../../src/components/ui";
import { t, type DictKey } from "../../src/i18n";
import { api } from "../../src/lib/api";
import { DECADES, GENRES, type Decade } from "../../src/lib/browse";
import { AXES, dealNine, type Axis } from "../../src/lib/deal";
import { useFilms } from "../../src/state/films";
import { usePrefs } from "../../src/state/prefs";
import { brand, font, fs, radius, shadow, sp, usePalette } from "../../src/theme";
import type { OdyMapLite, OdyStationLite, SearchRow, TmdbFallbackRow, TonightRow } from "../../src/types";

const DEBOUNCE_MS = 250;

// Browse chips are MULTI-SELECT (owner directive 2026-07-18): genres AND
// (p_genres is an array) with a decade span; a second tap clears that chip.
// Selected decades merge into one min..max span (a practical union).
type BrowseSel = {
  genres: ReadonlySet<string>;
  decades: ReadonlySet<string>; // Decade.label keys
};
type SortKey = "ts" | "new" | "old";

export default function SearchScreen() {
  const router = useRouter();
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const { country } = usePrefs();

  const [q, setQ] = useState("");
  // ?q= seeds the query (connect's unmatched rows, director successor lookups).
  const { q: seedQ } = useLocalSearchParams<{ q?: string }>();
  useEffect(() => {
    if (typeof seedQ === "string" && seedQ.length) setQ(seedQ);
  }, [seedQ]);
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [tsMap, setTsMap] = useState<Map<string, number>>(new Map());
  const [tierMap, setTierMap] = useState<Map<string, string[]>>(new Map());
  const [fallback, setFallback] = useState<TmdbFallbackRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false); // a search round-trip completed
  const seq = useRef(0); // stale-response guard across debounce + awaits

  // Browse (empty-query) state — §5.3.
  const [sel, setSel] = useState<BrowseSel>({ genres: new Set(), decades: new Set() });
  const [browseSort, setBrowseSort] = useState<SortKey>("ts");
  const [browseRows, setBrowseRows] = useState<TonightRow[]>([]);
  const [minTs, setMinTs] = useState<number | null>(null); // score floor — compound criteria
  const [browseLoading, setBrowseLoading] = useState(false);
  const selActive = sel.genres.size > 0 || sel.decades.size > 0;

  // "For you — nine films" (owner 07-29): the Metatake deal at the bottom of browse.
  // Reuses the Navigator's /odyssey/map.v1.json artifact + the ledger's seen set;
  // seeded so "Deal again" re-draws (적절히 랜덤) without Math.random in the algorithm.
  const { ledger } = useFilms();
  const { width } = useWindowDimensions();
  const [ody, setOdy] = useState<OdyMapLite | null>(null);
  const [dealSeed, setDealSeed] = useState(() => (Date.now() % 0x7fffffff) | 1);
  const showBrowseNow = q.trim().length === 0;
  useEffect(() => {
    if (!showBrowseNow || ody) return;
    let alive = true;
    api
      .odysseyMap()
      .then((m) => alive && setOdy(m))
      .catch(() => {}); // silent — the section simply doesn't render
    return () => {
      alive = false;
    };
  }, [showBrowseNow, ody]);
  const seenSet = useMemo(() => {
    const s = new Set<string>();
    for (const [slug, e] of ledger) if (e.seen) s.add(slug);
    return s;
  }, [ledger]);
  const dealt = useMemo(() => (ody ? dealNine(ody, seenSet, dealSeed) : null), [ody, seenSet, dealSeed]);

  const openReader = (path: string, title: string) =>
    router.push({ pathname: "/read", params: { path, title } });

  useEffect(() => {
    seq.current += 1;
    const id = seq.current;
    const query = q.trim();

    if (!query) {
      setRows([]);
      setTsMap(new Map());
      setTierMap(new Map());
      setFallback([]);
      setSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    const run = async () => {
      // 1) Canon search (film + director only; other kinds are web-only).
      let kept: SearchRow[] = [];
      try {
        const all = await api.search(query);
        if (seq.current !== id) return;
        kept = all.filter((r) => r.kind === "film" || r.kind === "director");
      } catch {
        if (seq.current !== id) return;
        // Treat a failed search as zero canon rows — the web footer still works.
      }
      // Supplement with very-fuzzy / multilingual film matches (1-char, Korean/accented
      // titles) that search_all's length>=2, no-unaccent, no-title_ko path misses (0116).
      // Fail-soft (searchFuzzy returns [] on error); dedup by slug, appended after canon.
      const fuzzy = await api.searchFuzzy(query, 30);
      if (seq.current !== id) return;
      if (fuzzy.length) {
        const have = new Set(kept.map((r) => r.slug));
        kept = [...kept, ...fuzzy.filter((r) => !have.has(r.slug))];
      }
      setRows(kept);
      setSearched(true);

      // 2) Best-effort decoration for film rows (each leg fails soft).
      const filmSlugs = kept.filter((r) => r.kind === "film").map((r) => r.slug);
      if (filmSlugs.length) {
        const [ts, tiers] = await Promise.all([
          api.takescores(filmSlugs).catch(() => new Map<string, number>()),
          api.availability(filmSlugs, country).catch(() => new Map<string, string[]>()),
        ]);
        if (seq.current !== id) return;
        setTsMap(ts);
        setTierMap(tiers);
      } else {
        setTsMap(new Map());
        setTierMap(new Map());
      }

      // 3) TMDB fallback when the canon comes up empty (route may 404 until
      //    the web deploy — fail soft to the searchWeb footer only).
      if (!kept.length) {
        try {
          const fb = await api.tmdbFallback(query);
          if (seq.current !== id) return;
          setFallback(fb.results ?? []);
        } catch {
          if (seq.current !== id) return;
          setFallback([]);
        }
      } else {
        setFallback([]);
      }

      if (seq.current === id) setLoading(false);
    };

    const timer = setTimeout(() => {
      void run();
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q, country]);

  // Browse fetch — same tonight BFF, all providers (empty array). Selections
  // compose; they survive a typed query (the block hides until it clears).
  const genresKey = [...sel.genres].sort().join(",");
  const decadesKey = [...sel.decades].sort().join(",");
  useEffect(() => {
    if (!selActive) {
      setBrowseRows([]);
      setBrowseLoading(false);
      return;
    }
    let alive = true;
    setBrowseLoading(true);
    const picked = DECADES.filter((d) => sel.decades.has(d.label));
    const opts: {
      genres?: string[];
      yearMin?: number;
      yearMax?: number;
      tsMin?: number;
      sort?: string;
      dir?: "asc" | "desc";
    } = {};
    if (sel.genres.size) opts.genres = [...sel.genres];
    if (picked.length) {
      opts.yearMin = Math.min(...picked.map((d) => d.yearMin));
      opts.yearMax = Math.max(...picked.map((d) => d.yearMax));
    }
    // v11 tokens bake direction into "newest"/"oldest" — never send sort=year.
    if (browseSort === "new") opts.sort = "newest";
    else if (browseSort === "old") opts.sort = "oldest";
    if (minTs != null) opts.tsMin = minTs;
    api
      .tonight(country, [], opts)
      .then((p) => {
        if (alive) setBrowseRows(p.rows);
      })
      .catch(() => {
        if (alive) setBrowseRows([]);
      })
      .finally(() => {
        if (alive) setBrowseLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selActive, genresKey, decadesKey, browseSort, minTs, country]);

  const pickGenre = (g: string) =>
    setSel((prev) => {
      const genres = new Set(prev.genres);
      if (genres.has(g)) genres.delete(g);
      else genres.add(g);
      return { ...prev, genres };
    });
  const pickDecade = (d: Decade) =>
    setSel((prev) => {
      const decades = new Set(prev.decades);
      if (decades.has(d.label)) decades.delete(d.label);
      else decades.add(d.label);
      return { ...prev, decades };
    });

  const showEmpty = searched && !loading && rows.length === 0;
  const showBrowse = q.trim().length === 0;

  const browseHeader = showBrowse ? (
    <View>
      <SectionTitle>{t("explore.browse")}</SectionTitle>
      <Ui size={fs.xs} weight="600" color={pal.muted} style={{ paddingHorizontal: sp.s4 }}>
        {t("explore.genres")}
      </Ui>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: sp.s2,
          paddingHorizontal: sp.s4,
          paddingTop: sp.s2,
        }}
      >
        {GENRES.map((g) => (
          <Chip key={g} label={g} active={sel.genres.has(g)} onPress={() => pickGenre(g)} />
        ))}
      </View>
      <Ui
        size={fs.xs}
        weight="600"
        color={pal.muted}
        style={{ paddingHorizontal: sp.s4, paddingTop: sp.s4 }}
      >
        {t("explore.decades")}
      </Ui>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: sp.s2,
          paddingHorizontal: sp.s4,
          paddingTop: sp.s2,
        }}
      >
        {DECADES.map((d) => (
          <Chip
            key={d.label}
            label={d.label}
            active={sel.decades.has(d.label)}
            onPress={() => pickDecade(d)}
          />
        ))}
      </View>
      {selActive ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: sp.s2,
            paddingHorizontal: sp.s4,
            paddingTop: sp.s4,
          }}
        >
          <Ionicons name="swap-vertical" size={14} color={pal.muted} />
          <Chip label={t("sort.takescore")} active={browseSort === "ts"} onPress={() => setBrowseSort("ts")} />
          <Chip label={t("sort.newest")} active={browseSort === "new"} onPress={() => setBrowseSort("new")} />
          <Chip label={t("sort.oldest")} active={browseSort === "old"} onPress={() => setBrowseSort("old")} />
          {/* Score floor — composes with genre/decade/sort (owner 2026-07-20:
              "TS ≥ n among the newest", "post-2000 by score"). Single-select. */}
          {[60, 70, 80].map((n) => (
            <Chip
              key={n}
              label={`TS ${n}+`}
              active={minTs === n}
              onPress={() => setMinTs(minTs === n ? null : n)}
            />
          ))}
        </View>
      ) : null}
      {browseLoading ? (
        <View style={{ paddingVertical: sp.s5 }}>
          <ActivityIndicator color={brand.accent} />
        </View>
      ) : selActive ? (
        browseRows.length ? (
          <View style={{ paddingTop: sp.s3 }}>
            {browseRows.map((r) => (
              <FilmResultRow
                key={r.slug}
                slug={r.slug}
                title={r.title}
                sub={[r.year, r.director].filter(Boolean).join(" · ")}
                poster={r.poster_path}
                ts={r.ts}
                tiers={r.tiers}
              />
            ))}
          </View>
        ) : (
          // Empty (or failed) filter result must say so — a silent blank reads
          // as a dead screen.
          <View style={{ paddingHorizontal: sp.s4, paddingVertical: sp.s5 }}>
            <Ui size={fs.base} color={pal.muted}>
              {t("browse.empty")}
            </Ui>
          </View>
        )
      ) : null}
    </View>
  ) : null;

  return (
    <Screen style={{ paddingTop: Math.max(insets.top, sp.s6) }}>
      {/* Title + the pill search bar as the real input — fixed above the list */}
      <View style={{ paddingHorizontal: sp.s4, paddingBottom: sp.s2 }}>
        <Ui size={fs.x2} weight="600">
          {t("tab.explore")}
        </Ui>
        <View
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              gap: sp.s3,
              marginTop: sp.s3,
              borderRadius: radius.pill,
              backgroundColor: pal.card,
              paddingHorizontal: sp.s4,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: pal.hairline,
            },
            shadow.card,
          ]}
        >
          <Ionicons name="search" size={18} color={pal.ink} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t("search.placeholder")}
            placeholderTextColor={pal.subtle}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            selectionColor={brand.accent}
            style={{
              flex: 1,
              fontFamily: font.uiMed,
              fontSize: fs.md,
              color: pal.ink,
              paddingVertical: 13,
            }}
          />
          {loading ? <ActivityIndicator size="small" color={brand.accent} /> : null}
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => `${r.kind}:${r.slug}`}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: sp.s3, paddingBottom: 120 }}
        ListHeaderComponent={browseHeader}
        renderItem={({ item }) =>
          item.kind === "film" ? (
            // sub is null-year-safe on purpose: search_all's `sub` is already the
            // full subtitle ("1994 · Wong Kar-wai"); the RPC's subtitle stays the
            // single source for search rows (year alone is the fallback).
            <FilmResultRow
              slug={item.slug}
              title={item.title}
              sub={item.sub || String(item.year ?? "")}
              poster={item.poster}
              ts={tsMap.get(item.slug) ?? null}
              tiers={tierMap.get(item.slug)}
            />
          ) : (
            <DirectorRow row={item} />
          )
        }
        ListEmptyComponent={
          showEmpty ? (
            <View>
              <View style={{ paddingHorizontal: sp.s4, paddingVertical: sp.s3 }}>
                <Ui size={fs.base} color={pal.muted}>
                  {t("search.empty")}
                </Ui>
              </View>
              {fallback.map((f) => (
                <FallbackRow
                  key={f.tmdb_id}
                  row={f}
                  onPress={() => openReader(`/omni?q=${encodeURIComponent(f.title)}`, f.title)}
                />
              ))}
            </View>
          ) : null
        }
        ListFooterComponent={
          q.length > 0 ? (
            <View style={{ paddingHorizontal: sp.s4, paddingTop: sp.s4 }}>
              <Btn
                kind="ghost"
                label={t("search.searchWeb")}
                onPress={() => openReader(`/omni?q=${encodeURIComponent(q)}`, q)}
              />
            </View>
          ) : showBrowse && !selActive ? (
            /* ── Bottom of browse: the deal + a quiet door to the web archive ── */
            <View style={{ paddingTop: sp.s5 }}>
              <SectionTitle sub={t("explore.forYouSub")}>{t("explore.forYou")}</SectionTitle>
              {dealt ? (
                <>
                  {AXES.map((ax) => {
                    const films = dealt[ax.key];
                    if (!films.length) return null;
                    return (
                      <View key={ax.key} style={{ paddingTop: sp.s3 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "baseline",
                            gap: sp.s2,
                            paddingHorizontal: sp.s4,
                          }}
                        >
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: radius.pill,
                              backgroundColor: ax.color,
                              alignSelf: "center",
                            }}
                          />
                          <Ui size={fs.sm} weight="700">
                            {t(AXIS_COPY[ax.key].title)}
                          </Ui>
                          <Ui size={fs.xs} color={pal.muted} numberOfLines={1} style={{ flex: 1 }}>
                            {t(AXIS_COPY[ax.key].sub)}
                          </Ui>
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            gap: sp.s3,
                            paddingHorizontal: sp.s4,
                            paddingTop: sp.s2,
                          }}
                        >
                          {films.map((f) => (
                            <DealCard key={f.s} f={f} w={(width - sp.s4 * 2 - sp.s3 * 2) / 3} />
                          ))}
                        </View>
                      </View>
                    );
                  })}
                  <View style={{ paddingHorizontal: sp.s4, paddingTop: sp.s4 }}>
                    <Btn
                      kind="ghost"
                      label={t("explore.dealAgain")}
                      onPress={() => setDealSeed((s) => ((s * 48271) % 0x7fffffff) | 1)}
                    />
                  </View>
                </>
              ) : (
                <View style={{ paddingVertical: sp.s5 }}>
                  <ActivityIndicator color={brand.accent} />
                </View>
              )}

              {/* Metatake on the web — the archive door (owner 07-29: promote the site) */}
              <Tactile onPress={() => openReader("/", "Metatake")}>
                <View
                  style={[
                    {
                      marginHorizontal: sp.s4,
                      marginTop: sp.s6,
                      backgroundColor: pal.card,
                      borderRadius: radius.lg,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: pal.hairline,
                      padding: sp.s4,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: sp.s3,
                    },
                    shadow.card,
                  ]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Serif size={fs.lg} bold>
                      Metatake
                    </Serif>
                    <Ui size={fs.sm} color={pal.muted} style={{ marginTop: 2 }}>
                      {t("explore.webCardSub")}
                    </Ui>
                  </View>
                  <Ionicons name="arrow-forward" size={18} color={brand.accent} />
                </View>
              </Tactile>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

// ---------------------------------------------------------------------------

/** Axis → i18n copy for the deal section (explicit map keeps DictKey typing). */
const AXIS_COPY: Record<Axis, { title: DictKey; sub: DictKey }> = {
  stable: { title: "axis.stable", sub: "axis.stableSub" },
  adventure: { title: "axis.adventure", sub: "axis.adventureSub" },
  frontier: { title: "axis.frontier", sub: "axis.frontierSub" },
};

/** One dealt pick — poster card, title + year, into the native film brief. */
function DealCard({ f, w }: { f: OdyStationLite; w: number }) {
  const router = useRouter();
  const pal = usePalette();
  return (
    <Tactile onPress={() => router.push({ pathname: "/film/[slug]", params: { slug: f.s } })} style={{ width: w }}>
      <PosterImg path={f.p ?? null} width={w} height={Math.round(w * 1.5)} rounded={radius.sm} />
      <Ui size={fs.xs} weight="600" numberOfLines={1} style={{ marginTop: 6 }}>
        {f.t ?? f.s}
      </Ui>
      {f.y ? (
        <Ui size={fs.xs} color={pal.muted}>
          {f.y}
        </Ui>
      ) : null}
    </Tactile>
  );
}

/** Film result — rounded poster, sans title, dots + TS on the right. */
function FilmResultRow({
  slug,
  title,
  sub,
  poster,
  ts,
  tiers,
}: {
  slug: string;
  title: string;
  sub: string;
  poster: string | null;
  ts: number | null;
  tiers?: string[];
}) {
  const pal = usePalette();
  const router = useRouter();
  return (
    <Tactile onPress={() => router.push({ pathname: "/film/[slug]", params: { slug } })}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: sp.s3,
          paddingHorizontal: sp.s4,
          paddingVertical: sp.s3,
        }}
      >
        <PosterImg path={poster} width={48} height={72} size="w92" rounded={radius.sm} />
        <View style={{ flex: 1 }}>
          <Ui size={fs.md} weight="500" numberOfLines={1}>
            {title}
          </Ui>
          {sub ? (
            <Ui size={fs.sm} color={pal.muted} numberOfLines={1} style={{ marginTop: 1 }}>
              {sub}
            </Ui>
          ) : null}
        </View>
        {tiers?.length ? <AvailabilityDots tiers={tiers} /> : null}
        <TSBadge ts={ts} />
      </View>
    </Tactile>
  );
}

/** Director result — round face (or person glyph disc) + name + chevron. */
function DirectorRow({ row }: { row: SearchRow }) {
  const pal = usePalette();
  const router = useRouter();
  return (
    <Tactile onPress={() => router.push({ pathname: "/director/[slug]", params: { slug: row.slug } })}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: sp.s3,
          paddingHorizontal: sp.s4,
          paddingVertical: sp.s3,
        }}
      >
        {row.poster ? (
          <PosterImg path={row.poster} width={40} height={40} size="w92" rounded={radius.pill} />
        ) : (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pal.surface,
            }}
          >
            <Ionicons name="person" size={18} color={pal.muted} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Ui size={fs.md} weight="500" numberOfLines={1}>
            {row.title}
          </Ui>
          {row.sub ? (
            <Ui size={fs.sm} color={pal.muted} numberOfLines={1} style={{ marginTop: 1 }}>
              {row.sub}
            </Ui>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={16} color={pal.subtle} />
      </View>
    </Tactile>
  );
}

/** TMDB not-in-canon fallback row — opens the omni reader for the title. */
function FallbackRow({ row, onPress }: { row: TmdbFallbackRow; onPress: () => void }) {
  const pal = usePalette();
  return (
    <Tactile onPress={onPress}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: sp.s3,
          paddingHorizontal: sp.s4,
          paddingVertical: sp.s3,
        }}
      >
        <PosterImg path={row.poster_path} width={48} height={72} size="w92" rounded={radius.sm} />
        <View style={{ flex: 1 }}>
          <Ui size={fs.md} weight="500" numberOfLines={1}>
            {row.title}
          </Ui>
          {row.year != null ? (
            <Ui size={fs.sm} color={pal.muted} style={{ marginTop: 1 }}>
              {row.year}
            </Ui>
          ) : null}
        </View>
        <View
          style={{
            borderRadius: radius.pill,
            backgroundColor: pal.surface,
            paddingHorizontal: sp.s3,
            paddingVertical: 5,
          }}
        >
          <Ui size={fs.xs} weight="500" color={pal.muted}>
            {t("search.notInCanon")}
          </Ui>
        </View>
      </View>
    </Tactile>
  );
}
