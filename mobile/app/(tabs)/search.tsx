// Search tab — search→verdict in 10 seconds (HANDOFF §5.3).
// Direct anon RPC search, best-effort TS/availability decoration, TMDB fallback
// for not-in-canon queries, and an always-on "search the full site" escape hatch.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FilmRow } from "../../src/components/FilmRow";
import { PosterImg, Screen, Serif, Ui } from "../../src/components/ui";
import { t } from "../../src/i18n";
import { api } from "../../src/lib/api";
import { usePrefs } from "../../src/state/prefs";
import { brand, font, fs, sp, usePalette } from "../../src/theme";
import type { SearchRow, TmdbFallbackRow } from "../../src/types";

const DEBOUNCE_MS = 250;

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

  const showEmpty = searched && !loading && rows.length === 0;

  return (
    <Screen style={{ paddingTop: Math.max(insets.top, sp.s6) }}>
      {/* Title block + editorial input — fixed above the result list */}
      <View style={{ paddingHorizontal: sp.s4 }}>
        <Serif size={fs.x3} bold>
          {t("tab.search")}
        </Serif>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: sp.s2,
            marginTop: sp.s3,
            paddingBottom: sp.s2,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: pal.hairline2,
          }}
        >
          <Ionicons name="search-outline" size={18} color={pal.muted} />
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
              fontFamily: font.ui,
              fontSize: fs.md,
              color: pal.ink,
              paddingVertical: 4,
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
        contentContainerStyle={{ paddingTop: sp.s3, paddingBottom: sp.s7 }}
        renderItem={({ item }) =>
          item.kind === "film" ? (
            // year is null on purpose: search_all's `sub` is already the full
            // subtitle ("1994 · Wong Kar-wai"), so also passing year printed it
            // twice. The RPC's subtitle stays the single source for search rows.
            <FilmRow
              slug={item.slug}
              title={item.title}
              year={null}
              director={item.sub || String(item.year ?? "")}
              poster_path={item.poster}
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
                <Serif size={fs.lg}>{t("search.empty")}</Serif>
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
            <Pressable
              onPress={() => openReader(`/omni?q=${encodeURIComponent(q)}`, q)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: sp.s3,
                paddingHorizontal: sp.s4,
                paddingVertical: sp.s4,
                backgroundColor: pressed ? pal.surface : "transparent",
              })}
            >
              <Ionicons name="globe-outline" size={16} color={brand.accent} />
              <Ui size={fs.sm} weight="600" color={brand.accent} style={{ flex: 1 }}>
                {t("search.searchWeb")}
              </Ui>
              <Ionicons name="chevron-forward" size={14} color={pal.subtle} />
            </Pressable>
          ) : null
        }
      />
    </Screen>
  );
}

/** Director result — face (or person glyph) + serif name + Ui sub. */
function DirectorRow({ row }: { row: SearchRow }) {
  const pal = usePalette();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/director/[slug]", params: { slug: row.slug } })}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: sp.s3,
        paddingHorizontal: sp.s4,
        paddingVertical: sp.s2 + 2,
        backgroundColor: pressed ? pal.surface : "transparent",
      })}
    >
      {row.poster ? (
        <PosterImg path={row.poster} width={34} height={51} size="w92" />
      ) : (
        <View
          style={{
            width: 34,
            height: 51,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pal.surface,
          }}
        >
          <Ionicons name="person-circle-outline" size={24} color={pal.muted} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Serif size={fs.base} numberOfLines={1}>
          {row.title}
        </Serif>
        {row.sub ? (
          <Ui size={fs.xs + 1} color={pal.muted} numberOfLines={1}>
            {row.sub}
          </Ui>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={14} color={pal.subtle} />
    </Pressable>
  );
}

/** TMDB not-in-canon fallback row — opens the omni reader for the title. */
function FallbackRow({ row, onPress }: { row: TmdbFallbackRow; onPress: () => void }) {
  const pal = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: sp.s3,
        paddingHorizontal: sp.s4,
        paddingVertical: sp.s2 + 2,
        backgroundColor: pressed ? pal.surface : "transparent",
      })}
    >
      <PosterImg path={row.poster_path} width={34} height={51} size="w92" />
      <View style={{ flex: 1 }}>
        <Serif size={fs.base} numberOfLines={1}>
          {row.title}
        </Serif>
        {row.year != null ? (
          <Ui size={fs.xs + 1} color={pal.muted}>
            {row.year}
          </Ui>
        ) : null}
      </View>
      <View
        style={{
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: pal.hairline2,
          borderRadius: 999, // pill — the one sanctioned radius
          paddingHorizontal: sp.s2,
          paddingVertical: 2,
        }}
      >
        <Ui size={fs.xs} color={pal.muted}>
          {t("search.notInCanon")}
        </Ui>
      </View>
    </Pressable>
  );
}
