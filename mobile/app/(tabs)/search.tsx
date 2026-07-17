// Explore tab (구 Search) — search→verdict in 10 seconds + browse (HANDOFF §5.3).
// Direct anon RPC search, best-effort TS/availability decoration, TMDB fallback
// for not-in-canon queries, and an always-on "search the full site" escape hatch.
// v4 adds a Browse block on the empty query: genre + decade chips feeding the
// same tonight BFF (all providers), rendered with the existing FilmResultRow.
// Skinned to design system v2 "Lava": pill search bar with a soft shadow, rounded
// posters, whitespace-separated rows (no hairlines), ghost web-search CTA.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AvailabilityDots,
  Btn,
  Chip,
  PosterImg,
  Screen,
  SectionTitle,
  Tactile,
  TSBadge,
  Ui,
} from "../../src/components/ui";
import { t } from "../../src/i18n";
import { api } from "../../src/lib/api";
import { DECADES, GENRES, type Decade } from "../../src/lib/browse";
import { usePrefs } from "../../src/state/prefs";
import { brand, font, fs, radius, shadow, sp, usePalette } from "../../src/theme";
import type { SearchRow, TmdbFallbackRow, TonightRow } from "../../src/types";

const DEBOUNCE_MS = 250;

// One browse selection at a time — a second tap on the active chip clears it.
type BrowseSel =
  | { kind: "genre"; genre: string }
  | { kind: "decade"; label: string; yearMin: number; yearMax: number };

export default function SearchScreen() {
  const router = useRouter();
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const { country } = usePrefs();

  const [q, setQ] = useState("");
  const [rows, setRows] = useState<SearchRow[]>([]);
  const [tsMap, setTsMap] = useState<Map<string, number>>(new Map());
  const [tierMap, setTierMap] = useState<Map<string, string[]>>(new Map());
  const [fallback, setFallback] = useState<TmdbFallbackRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false); // a search round-trip completed
  const seq = useRef(0); // stale-response guard across debounce + awaits

  // Browse (empty-query) state — §5.3.
  const [sel, setSel] = useState<BrowseSel | null>(null);
  const [browseRows, setBrowseRows] = useState<TonightRow[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);

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

  // Browse fetch — same tonight BFF, all providers (empty array). Selection
  // survives a typed query; the block simply hides until the query clears.
  useEffect(() => {
    if (!sel) {
      setBrowseRows([]);
      setBrowseLoading(false);
      return;
    }
    let alive = true;
    setBrowseLoading(true);
    const opts =
      sel.kind === "genre"
        ? { genres: [sel.genre] }
        : { yearMin: sel.yearMin, yearMax: sel.yearMax };
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
  }, [sel, country]);

  const pickGenre = (g: string) =>
    setSel((prev) => (prev?.kind === "genre" && prev.genre === g ? null : { kind: "genre", genre: g }));
  const pickDecade = (d: Decade) =>
    setSel((prev) =>
      prev?.kind === "decade" && prev.label === d.label ? null : { kind: "decade", ...d },
    );

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
          <Chip
            key={g}
            label={g}
            active={sel?.kind === "genre" && sel.genre === g}
            onPress={() => pickGenre(g)}
          />
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
            active={sel?.kind === "decade" && sel.label === d.label}
            onPress={() => pickDecade(d)}
          />
        ))}
      </View>
      {browseLoading ? (
        <View style={{ paddingVertical: sp.s5 }}>
          <ActivityIndicator color={brand.accent} />
        </View>
      ) : sel ? (
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
          ) : null
        }
      />
    </Screen>
  );
}

// ---------------------------------------------------------------------------

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
