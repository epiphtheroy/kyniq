// Explore tab (구 Search) — search→verdict in 10 seconds + browse (HANDOFF §5.3).
// Direct anon RPC search, best-effort TS/availability decoration, TMDB fallback
// for not-in-canon queries, and an always-on "search the full site" escape hatch.
// v4 adds a Browse block on the empty query: genre + decade chips feeding the
// same tonight BFF (all providers), rendered with the existing FilmResultRow.
// Skinned to design system v2 "Lava": pill search bar with a soft shadow, rounded
// posters, whitespace-separated rows (no hairlines), ghost web-search CTA.
import Ionicons from "@expo/vector-icons/Ionicons";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  ScrollView,
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
import { Appear, Dots, SkeletonRail, SkeletonRows } from "../../src/components/motion";
import SaveListBtn from "../../src/components/SaveListBtn";
import { t, type DictKey } from "../../src/i18n";
import { decadeLabel, genreLabel } from "../../src/i18n/tokens";
import { api } from "../../src/lib/api";
import { useLocalTitles } from "../../src/lib/titles";
import { DECADES, GENRES, type Decade } from "../../src/lib/browse";
import { useDbLabels } from "../../src/lib/dbLabels";
import { listSizeLabel } from "../../src/lib/lineage";
import { AXES, dealNine, type Axis } from "../../src/lib/deal";
import { useFilms } from "../../src/state/films";
import { usePrefs } from "../../src/state/prefs";
import { brand, font, fs, radius, shadow, sp, usePalette } from "../../src/theme";
import type { NavCatalogEntry, OdyMapLite, OdyStationLite, SearchRow, TmdbFallbackRow, TonightRow } from "../../src/types";

const DEBOUNCE_MS = 250;

// Connect hub route (same Href cast as the You tab).
const CONNECT_HREF = "/connect" as Href;
// The filming-locations map: a pushed screen, deliberately not a tab (owner 08-03).
const MAP_HREF = "/map" as Href;

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
  // Localized titles at RENDER, not just from the search RPC: a row the canon
  // engine (search_all) found first wins the dedup, and search_all only knows
  // English — so matching in Korean would still print the English name. The
  // overlay covers every row whichever engine produced it.
  const titleOf = useLocalTitles(
    useMemo(
      () => [...rows.filter((r) => r.kind === "film").map((r) => r.slug), ...browseRows.map((r) => r.slug)],
      [rows, browseRows],
    ),
  );
  // /journey parity (owner 07-29): same avail artifact the web deck filters with —
  // when the viewer picked services, the hand is dealt from what they can watch.
  const { providerIds, contentLang } = usePrefs();
  const [availCountry, setAvailCountry] = useState<Record<string, unknown[]> | null>(null);
  useEffect(() => {
    if (!showBrowseNow || availCountry) return;
    let alive = true;
    api
      .odysseyAvail()
      .then((a) => alive && setAvailCountry((a?.[country] ?? {}) as Record<string, unknown[]>))
      .catch(() => alive && setAvailCountry({}));
    return () => {
      alive = false;
    };
  }, [showBrowseNow, availCountry, country]);
  const availSet = useMemo(() => {
    if (!availCountry || !providerIds.length) return null;
    const s = new Set<string>();
    for (const [slug, arr] of Object.entries(availCountry)) if ((arr?.length ?? 0) > 0) s.add(slug);
    return s.size ? s : null;
  }, [availCountry, providerIds.length]);
  const dealt = useMemo(
    () => (ody ? dealNine(ody, seenSet, dealSeed, availSet) : null),
    [ody, seenSet, dealSeed, availSet],
  );
  // TakeScore for the nine dealt cards (owner 07-29: every film shows year + TS).
  const [dealTs, setDealTs] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (!dealt) return;
    const slugs = [...dealt.stable, ...dealt.adventure, ...dealt.frontier].map((f) => f.s);
    if (!slugs.length) return;
    let alive = true;
    api
      .takescores(slugs)
      .then((m) => alive && setDealTs(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [dealt]);

  // Collections rail (owner 07-29): the lineage lists, curated + facet-tinted, each
  // driving straight into the native Navigator. Lazy on first browse; fail-soft to [].
  const [lists, setLists] = useState<NavCatalogEntry[] | null>(null);
  // How many lists exist in total (owner 07-30: say that there are hundreds).
  // Free — lineageCatalog already returns them all; the rail just curates 14.
  const [allLists, setAllLists] = useState<NavCatalogEntry[]>([]);
  const [exampleIdx, setExampleIdx] = useState(0);
  const listTotal = allLists.length;
  useEffect(() => {
    // Browse shows the rail; typing needs the catalog too, since the search
    // below reaches lists and the examples advertise exactly that.
    if ((!showBrowseNow && q.trim().length === 0) || lists) return;
    let alive = true;
    api
      .lineageCatalog()
      .then((all) => {
        if (!alive) return;
        setAllLists(all);
        setLists(curateRail(all));
      })
      .catch(() => alive && setLists([]));
    return () => {
      alive = false;
    };
  }, [showBrowseNow, lists, q]);

  const openReader = (path: string, title: string) =>
    router.push({ pathname: "/read", params: { path, title } });

  useEffect(() => {
    seq.current += 1;
    const id = seq.current;
    const query = q.trim();

    // Hangul composes jamo-by-jamo, so an in-flight syllable reaches onChangeText
    // as a bare compatibility jamo ("ㅎ" on the way to "한"). Those never match a
    // title, and /search is the heaviest function in the fleet — so let the
    // composition finish rather than pay a round trip for a keystroke.
    if (!query || /^[\u3130-\u318F]+$/.test(query)) {
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
      // 1) Canon search (film + director only; other kinds are web-only),
      //    supplemented with very-fuzzy / multilingual film matches (1-char,
      //    Korean/accented titles) that search_all's length>=2, no-unaccent,
      //    no-title_ko path misses (0116).
      //
      //    These two ran in SERIES until 2026-08-04, so every settled keystroke
      //    paid the SUM of two slow round-trips — measured in production,
      //    search_all averages 2,152 ms and film_search_i18n 1,815 ms, i.e. ~4 s
      //    before a single row appeared. Neither reads the other's output (the
      //    dedup below is pure post-processing), so the cost should be the
      //    slower of the two, not the total. Both fail soft to [] — a dead leg
      //    must not take the other one down with it.
      const [canon, fuzzy] = await Promise.all([
        api.search(query).catch(() => [] as SearchRow[]),
        api.searchFuzzy(query, 30, contentLang).catch(() => [] as SearchRow[]),
      ]);
      if (seq.current !== id) return;
      let kept: SearchRow[] = canon.filter((r) => r.kind === "film" || r.kind === "director");
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
    // contentLang re-runs the search: the RPC both matches and RENDERS by
    // language, so switching it must redraw the results, not just future ones.
  }, [q, country, contentLang]);

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

  /** Lists matching the query — every token must appear somewhere in the entry's
   *  searchable blob, the same rule the Navigator's list search uses. */
  const listHits = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (query.length < 2 || !allLists.length) return [];
    const tokens = query.split(/\s+/).filter(Boolean);
    return allLists.filter((l) => tokens.every((tk) => l.search.includes(tk))).slice(0, 6);
  }, [q, allLists]);

  // Collection names live in content_i18n (lineage_list/label), keyed on the
  // English label rather than the slug (see LABEL_KEYED in dbLabels.ts). One
  // batched read covers the rail, the search hits and the peeking examples.
  const listLabelKeys = useMemo(
    () => [...(lists ?? []).map((l) => l.label), ...listHits.map((l) => l.label)],
    [lists, listHits],
  );
  const listLabelOf = useDbLabels("lineage_list", "label", listLabelKeys);
  const nameOf = (l: NavCatalogEntry) => listLabelOf(l.label, l.label) ?? l.label;

  // Peeking examples (owner 07-30): real list names cycled through the empty
  // field, so people learn the search reaches LISTS, not just films. Real labels
  // rather than invented ones — nothing here can advertise a dead query.
  const examples = useMemo(
    () => (lists ?? []).map(nameOf).filter((l) => l.length <= 34).slice(0, 6),
    [lists, listLabelOf],
  );

  useEffect(() => {
    if (q.trim().length > 0 || examples.length < 2) return;
    const id = setInterval(() => setExampleIdx((i) => (i + 1) % examples.length), 2800);
    return () => clearInterval(id);
  }, [q, examples.length]);

  const showEmpty = searched && !loading && rows.length === 0;
  const showBrowse = q.trim().length === 0;

  const browseHeader = showBrowse ? (
    <View>
      <SectionTitle>{t("explore.browse")}</SectionTitle>
      <Ui size={fs.xs} weight="600" color={pal.muted} style={{ paddingHorizontal: sp.s4 }}>
        {t("explore.genres")}
      </Ui>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: sp.s2, paddingHorizontal: sp.s4, paddingTop: sp.s2 }}
      >
        {GENRES.map((g) => (
          <Chip key={g} label={genreLabel(g)} active={sel.genres.has(g)} onPress={() => pickGenre(g)} />
        ))}
      </ScrollView>
      <Ui
        size={fs.xs}
        weight="600"
        color={pal.muted}
        style={{ paddingHorizontal: sp.s4, paddingTop: sp.s4 }}
      >
        {t("explore.decades")}
      </Ui>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: sp.s2, paddingHorizontal: sp.s4, paddingTop: sp.s2 }}
      >
        {DECADES.map((d) => (
          <Chip
            key={d.label}
            label={decadeLabel(d.label)}
            active={sel.decades.has(d.label)}
            onPress={() => pickDecade(d)}
          />
        ))}
      </ScrollView>
      {!selActive ? (
        /* ── Collections — curated lineage lists, straight into the native drive ── */
        <View style={{ paddingTop: sp.s5 }}>
          <SectionTitle sub={listTotal > 0 ? t("explore.listsCount", { n: listTotal }) : t("explore.collectionsSub")}>
            {t("explore.collections")}
          </SectionTitle>
          {lists === null ? (
            <View style={{ paddingVertical: sp.s2 }}>
              <SkeletonRail count={3} width={150} height={96} />
            </View>
          ) : lists.length ? (
            <FlatList
              horizontal
              data={lists}
              keyExtractor={(l) => l.key}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: sp.s4, gap: sp.s3 }}
              renderItem={({ item, index }) => (
                <Appear index={index} from="right">
                  <CollectionCard l={item} label={nameOf(item)} />
                </Appear>
              )}
            />
          ) : null}
        </View>
      ) : null}
      {!selActive ? (
        /* The one thing a phone can do that a desktop cannot: you can be
           standing next to the place (owner 08-03). */
        <Tactile
          feedback="tap"
          onPress={() => router.push(MAP_HREF)}
          style={{ marginHorizontal: sp.s4, marginTop: sp.s5 }}
        >
          <View
            style={[
              {
                flexDirection: "row",
                alignItems: "center",
                gap: sp.s3,
                backgroundColor: pal.card,
                borderRadius: radius.md,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: pal.hairline,
                paddingHorizontal: sp.s4,
                paddingVertical: sp.s3 + 2,
              },
              shadow.card,
            ]}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: radius.pill,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: `${brand.accent}1F`,
              }}
            >
              <Ionicons name="location" size={17} color={brand.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Ui size={fs.md} weight="600">
                {t("explore.locations")}
              </Ui>
              <Ui size={fs.xs} color={pal.muted} style={{ marginTop: 1 }}>
                {t("explore.locationsSub")}
              </Ui>
            </View>
            <Ionicons name="chevron-forward" size={16} color={pal.subtle} />
          </View>
        </Tactile>
      ) : null}
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
        <View style={{ paddingTop: sp.s3 }}>
          <SkeletonRows count={5} />
        </View>
      ) : selActive ? (
        browseRows.length ? (
          <View style={{ paddingTop: sp.s3 }}>
            {browseRows.map((r, i) => (
              <Appear key={r.slug} index={i}>
                <FilmResultRow
                  slug={r.slug}
                  title={titleOf(r.slug, r.title)}
                  sub={[r.year, r.director].filter(Boolean).join(" · ")}
                  poster={r.poster_path}
                  ts={r.ts}
                  tiers={r.tiers}
                />
              </Appear>
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
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Ui size={fs.x2} weight="600" style={{ flex: 1 }}>
            {t("tab.explore")}
          </Ui>
          {/* Browsing geographically is still browsing (owner 08-03). The map is
              a pushed screen, not a fifth tab — this is its permanent address. */}
          <Tactile onPress={() => router.push(MAP_HREF)} hitSlop={8} feedback="tap">
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.pill,
                backgroundColor: pal.card,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: pal.hairline,
              }}
            >
              <Ionicons name="map-outline" size={18} color={pal.ink} />
            </View>
          </Tactile>
        </View>
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
          <View style={{ flex: 1 }}>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={examples.length ? "" : t("search.placeholder")}
              placeholderTextColor={pal.subtle}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              selectionColor={brand.accent}
              style={{
                fontFamily: font.uiMed,
                fontSize: fs.md,
                color: pal.ink,
                paddingVertical: 13,
              }}
            />
            {/* The peeking hint rides OVER the empty field — a real placeholder
                can't animate, and tapping through keeps the field focusable. */}
            {q.length === 0 && examples.length ? (
              <View pointerEvents="none" style={{ position: "absolute", inset: 0, justifyContent: "center" }}>
                <Appear key={exampleIdx} from="bottom" distance={9}>
                  <Ui size={fs.md} weight="500" color={pal.subtle} numberOfLines={1}>
                    {t("search.tryExample", { q: examples[exampleIdx] ?? "" })}
                  </Ui>
                </Appear>
              </View>
            ) : null}
          </View>
          {loading ? <Dots size={5} /> : null}
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => `${r.kind}:${r.slug}`}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: sp.s3, paddingBottom: 120 }}
        ListHeaderComponent={
          browseHeader ?? (listHits.length ? (
            /* Search reaches LISTS too (owner 07-30) — the peeking examples name
               real collections, so the query for one has to land somewhere. */
            <View style={{ paddingBottom: sp.s3 }}>
              <Ui
                size={fs.xs}
                weight="700"
                color={pal.muted}
                style={{ paddingHorizontal: sp.s4, paddingBottom: sp.s2, letterSpacing: 0.6 }}
              >
                {t("explore.collections").toUpperCase()}
              </Ui>
              <FlatList
                horizontal
                data={listHits}
                keyExtractor={(l) => l.key}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: sp.s4, gap: sp.s3 }}
                renderItem={({ item, index }) => (
                  <Appear index={index} from="right">
                    <CollectionCard l={item} label={nameOf(item)} />
                  </Appear>
                )}
              />
            </View>
          ) : null)
        }
        renderItem={({ item, index }) =>
          item.kind === "film" ? (
            // sub is null-year-safe on purpose: search_all's `sub` is already the
            // full subtitle ("1994 · Wong Kar-wai"); the RPC's subtitle stays the
            // single source for search rows (year alone is the fallback).
            <Appear index={index}>
              <FilmResultRow
                slug={item.slug}
                title={titleOf(item.slug, item.title)}
                sub={item.sub || String(item.year ?? "")}
                poster={item.poster}
                ts={tsMap.get(item.slug) ?? null}
                tiers={tierMap.get(item.slug)}
              />
            </Appear>
          ) : (
            <Appear index={index}>
              <DirectorRow row={item} />
            </Appear>
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
                          {films.map((f, i) => (
                            <Appear key={f.s} index={i}>
                              <DealCard f={f} w={(width - sp.s4 * 2 - sp.s3 * 2) / 3} ts={dealTs.get(f.s) ?? null} />
                            </Appear>
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
                  {dealt.basis === "starter" ? (
                    /* Empty-ledger nudge (owner 07-29): this service tunes to logged
                       films — say so and point at Bring-your-film. */
                    <Tactile
                      onPress={() => router.push(CONNECT_HREF)}
                      style={{ paddingHorizontal: sp.s4, paddingTop: sp.s3 }}
                    >
                      <Ui size={fs.xs} color={pal.muted}>
                        {t("explore.dealStarterNudge")}
                      </Ui>
                    </Tactile>
                  ) : null}
                  {/* Provenance — this hand IS the web's For You deal (owner 07-29). */}
                  <Tactile
                    onPress={() => openReader("/journey", "For You")}
                    style={{ alignSelf: "center", paddingTop: sp.s2 }}
                  >
                    <Ui size={fs.xs} weight="500" color={pal.subtle} style={{ textDecorationLine: "underline" }}>
                      metatake.net/journey
                    </Ui>
                  </Tactile>
                </>
              ) : (
                <View style={{ paddingVertical: sp.s4, gap: sp.s4 }}>
                  <SkeletonRail count={3} width={(width - sp.s4 * 2 - sp.s3 * 2) / 3} height={160} />
                  <SkeletonRail count={3} width={(width - sp.s4 * 2 - sp.s3 * 2) / 3} height={160} />
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

/** Curate the Collections rail: journeys already in progress lead, then the biggest
 * list per facet round-robin (canon → critics → festival → award → national → rest)
 * so the rail reads varied and inviting, capped at 14 cards. */
function curateRail(all: NavCatalogEntry[]): NavCatalogEntry[] {
  const inProgress = all
    .filter((l) => l.pct > 0 && l.pct < 100)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4);
  const taken = new Set(inProgress.map((l) => l.key));
  const byFacet = new Map<string, NavCatalogEntry[]>();
  for (const l of all) {
    if (taken.has(l.key)) continue;
    const f = l.facet ?? "list";
    const arr = byFacet.get(f) ?? [];
    arr.push(l);
    byFacet.set(f, arr);
  }
  for (const arr of byFacet.values()) arr.sort((a, b) => b.total - a.total);
  const order = ["canon", "critics", "festival", "award", "national"].filter((f) => byFacet.has(f));
  for (const f of byFacet.keys()) if (!order.includes(f)) order.push(f);
  const out = [...inProgress];
  let added = true;
  while (out.length < 14 && added) {
    added = false;
    for (const f of order) {
      const next = byFacet.get(f)?.shift();
      if (next) {
        out.push(next);
        added = true;
        if (out.length >= 14) break;
      }
    }
  }
  return out;
}

/** Facet → tint + label for the Collections rail (mirrors the Navigator's facet map). */
const FACET_TINT: Record<string, string> = {
  canon: "#8F6A1E",
  critics: "#0d9488",
  festival: "#7c3aed",
  award: "#E3120B",
  national: "#2563eb",
};
const FACET_LABEL: Record<string, DictKey> = {
  canon: "nav.facetCanon",
  critics: "nav.facetCritics",
  festival: "nav.facetFestival",
  award: "nav.facetAward",
  national: "nav.facetNational",
};

/** One collection — facet-tinted card that drives that list in the native Navigator. */
function CollectionCard({ l, label }: { l: NavCatalogEntry; label: string }) {
  const router = useRouter();
  const pal = usePalette();
  const tint = FACET_TINT[l.facet ?? ""] ?? brand.accent;
  const facetLabel = FACET_LABEL[l.facet ?? ""] ? t(FACET_LABEL[l.facet ?? ""]) : t("nav.facetList");
  return (
    <Tactile
      onPress={() => router.push({ pathname: "/navigator/drive", params: { lineage: l.key, label: l.label } })}
    >
      <View
        style={[
          {
            width: 208,
            backgroundColor: pal.card,
            borderRadius: radius.md,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: pal.hairline,
            padding: sp.s3,
            paddingLeft: sp.s3 + 6,
            overflow: "hidden",
          },
          shadow.card,
        ]}
      >
        <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: tint }} />
        <Ui size={fs.xs - 1} weight="700" color={tint} style={{ letterSpacing: 0.6 }}>
          {facetLabel.toUpperCase()}
        </Ui>
        <Serif size={fs.md} bold numberOfLines={2} style={{ marginTop: 3, minHeight: 42 }}>
          {label}
        </Serif>
        <View style={{ flexDirection: "row", alignItems: "center", gap: sp.s2, marginTop: 6 }}>
          {/* Never the bare membership count where the published size is known —
              "1001 Movies · 159 films" reads as a broken list (owner 08-03). */}
          <Ui size={fs.xs} color={pal.muted} style={{ flex: 1 }}>
            {t("nav.filmsN", { n: listSizeLabel(l.key, l.total).text })}
          </Ui>
          {l.pct > 0 ? (
            <Ui size={fs.xs} weight="700" color={tint}>
              {l.pct}%
            </Ui>
          ) : null}
          {/* Keep the list itself (owner 08-03) — the star never touches the
              film ledger; that is the list screen's "Add all" button. */}
          <SaveListBtn slug={l.key} />
        </View>
        {l.pct > 0 ? (
          <View style={{ height: 4, borderRadius: radius.pill, backgroundColor: pal.surface, overflow: "hidden", marginTop: 6 }}>
            <View style={{ width: `${Math.min(100, l.pct)}%`, height: "100%", backgroundColor: tint }} />
          </View>
        ) : null}
      </View>
    </Tactile>
  );
}

/** Axis → i18n copy for the deal section (explicit map keeps DictKey typing). */
const AXIS_COPY: Record<Axis, { title: DictKey; sub: DictKey }> = {
  stable: { title: "axis.stable", sub: "axis.stableSub" },
  adventure: { title: "axis.adventure", sub: "axis.adventureSub" },
  frontier: { title: "axis.frontier", sub: "axis.frontierSub" },
};

/** One dealt pick — poster card, title, then year · TS (owner 07-29: both always show). */
function DealCard({ f, w, ts }: { f: OdyStationLite; w: number; ts: number | null }) {
  const router = useRouter();
  const pal = usePalette();
  return (
    <Tactile onPress={() => router.push({ pathname: "/film/[slug]", params: { slug: f.s } })} style={{ width: w }}>
      <PosterImg path={f.p ?? null} width={w} height={Math.round(w * 1.5)} rounded={radius.sm} />
      <Ui size={fs.xs} weight="600" numberOfLines={1} style={{ marginTop: 6 }}>
        {f.t ?? f.s}
      </Ui>
      <View style={{ flexDirection: "row", alignItems: "center", gap: sp.s2 }}>
        {f.y ? (
          <Ui size={fs.xs} color={pal.muted}>
            {f.y}
          </Ui>
        ) : null}
        <TSBadge ts={ts} size={fs.xs} />
      </View>
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
