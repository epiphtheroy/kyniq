// Tonight tab — the lobby-card feed (HANDOFF §5.2). The best films on the
// user's services, judged by TakeScore; each card is a decision moment.
// Design system v2 "Lava": SearchPill front door, chip row, soft-shadow-free
// rounded image cards with TSBadge + HeartButton overlays.
import { Redirect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AvailabilityDots,
  Btn,
  Chip,
  GradientBtn,
  HeartButton,
  Loading,
  PosterImg,
  Screen,
  SearchPill,
  Serif,
  Tactile,
  TSBadge,
  Ui,
} from "../../src/components/ui";
import { DEFAULT_EDITION, EDITIONS } from "../../src/editions";
import { t } from "../../src/i18n";
import { api } from "../../src/lib/api";
import { useFilms } from "../../src/state/films";
import { usePrefs } from "../../src/state/prefs";
import { brand, fs, radius, sp, usePalette } from "../../src/theme";
import type { TonightRow } from "../../src/types";

const PAGE = 40;

export default function TonightScreen() {
  const pal = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { country, providerIds, onboarded, hideSeen, ready, set } = usePrefs();
  const { session, ledger } = useFilms();

  const [rows, setRows] = useState<TonightRow[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<"loading" | "idle" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [gen, setGen] = useState(0); // retry bump
  const loadingMore = useRef(false);

  const hasProviders = providerIds.length > 0;

  // Initial load (and reload on country/services change or retry).
  useEffect(() => {
    if (!ready || !onboarded || !hasProviders) return;
    let alive = true;
    setStatus("loading");
    api
      .tonight(country, providerIds)
      .then((p) => {
        if (!alive) return;
        setRows(p.rows);
        setTotal(p.total);
        setStatus("idle");
      })
      .catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
    };
  }, [ready, onboarded, hasProviders, country, providerIds, gen]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    api
      .tonight(country, providerIds)
      .then((p) => {
        setRows(p.rows);
        setTotal(p.total);
        setStatus("idle");
      })
      .catch(() => setStatus("error"))
      .finally(() => setRefreshing(false));
  }, [country, providerIds]);

  const loadMore = useCallback(() => {
    if (loadingMore.current || status !== "idle" || refreshing) return;
    if (rows.length >= total) return;
    loadingMore.current = true;
    api
      .tonight(country, providerIds, { offset: rows.length })
      .then((p) => {
        setTotal(p.total);
        setRows((prev) => {
          const seen = new Set(prev.map((r) => r.slug));
          return [...prev, ...p.rows.filter((r) => !seen.has(r.slug))];
        });
      })
      .catch(() => {})
      .finally(() => {
        loadingMore.current = false;
      });
  }, [status, refreshing, rows.length, total, country, providerIds]);

  if (ready && !onboarded) return <Redirect href="/onboarding" />;
  if (!ready) return <Loading />;

  const edition = EDITIONS[country] ?? DEFAULT_EDITION;
  const visible =
    hideSeen && session ? rows.filter((r) => !ledger.get(r.slug)?.seen) : rows;
  const canLoadMore = rows.length < total;

  // Header — the benchmark front door: pill search, then a compact chip row.
  const header = (
    <View
      style={{
        paddingTop: insets.top + sp.s3,
        paddingBottom: sp.s3,
        backgroundColor: pal.bg,
      }}
    >
      <View style={{ paddingHorizontal: sp.s4 }}>
        <SearchPill
          placeholder={t("search.placeholder")}
          onPress={() => router.push("/search")}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: sp.s4,
          paddingTop: sp.s4,
          gap: sp.s2,
        }}
      >
        <Ui size={fs.lg} weight="600" style={{ flex: 1 }} numberOfLines={1}>
          {t("tonight.title")}
        </Ui>
        <Chip
          label={`${edition.flag} ${country}`}
          onPress={() =>
            router.push({ pathname: "/onboarding", params: { step: "country" } })
          }
        />
        {session ? (
          <Chip
            label={t("tonight.hideSeen")}
            icon="eye-off-outline"
            active={hideSeen}
            onPress={() => set({ hideSeen: !hideSeen })}
          />
        ) : null}
      </View>
    </View>
  );

  // No services picked yet → point at the services step.
  if (!hasProviders)
    return (
      <Screen>
        {header}
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: sp.s6,
            gap: sp.s4,
          }}
        >
          <Ui size={fs.base} color={pal.muted} style={{ textAlign: "center" }}>
            {t("tonight.empty")}
          </Ui>
          <GradientBtn
            label={t("tonight.pickServices")}
            onPress={() =>
              router.push({ pathname: "/onboarding", params: { step: "services" } })
            }
            style={{ alignSelf: "stretch" }}
          />
        </View>
      </Screen>
    );

  if (status === "error" && rows.length === 0)
    return (
      <Screen>
        {header}
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: sp.s4 }}
        >
          <Ui color={pal.muted}>{t("error.network")}</Ui>
          <Btn label={t("action.retry")} onPress={() => setGen((g) => g + 1)} />
        </View>
      </Screen>
    );

  if (status === "loading" && rows.length === 0)
    return (
      <Screen>
        {header}
        <Loading />
      </Screen>
    );

  return (
    <Screen>
      {header}
      <FlatList
        data={visible}
        keyExtractor={(item) => item.slug}
        renderItem={({ item }) => <LobbyCard row={item} screenW={width} />}
        contentContainerStyle={{
          paddingHorizontal: sp.s4,
          paddingTop: sp.s3,
          paddingBottom: 120, // clears the absolute blurred tab bar
        }}
        ItemSeparatorComponent={() => <View style={{ height: sp.s5 }} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={brand.accent}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListFooterComponent={
          canLoadMore ? (
            <View style={{ paddingVertical: sp.s5 }}>
              <ActivityIndicator color={brand.accent} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={{ paddingVertical: sp.s7, alignItems: "center" }}>
            <Ui size={fs.sm} color={pal.muted}>
              {t("tonight.emptyFiltered")}
            </Ui>
          </View>
        }
      />
    </Screen>
  );
}

/** The signature lobby card — Lava grammar: rounded image, TSBadge bottom-left,
 * wishlist heart top-right, sans title, serif italic lead as the editorial thread. */
function LobbyCard({ row, screenW }: { row: TonightRow; screenW: number }) {
  const pal = usePalette();
  const router = useRouter();
  const { session, ledger, toggleWatchlist } = useFilms();
  const cardW = screenW - sp.s4 * 2;
  const imgH = Math.round(cardW * 0.62);
  const inWatchlist = !!ledger.get(row.slug)?.watchlist;

  const onHeart = () => {
    if (!session) {
      router.push({ pathname: "/onboarding", params: { step: "account" } });
      return;
    }
    if (!row.film_id) return; // ledger writes need a film id
    toggleWatchlist(row.slug, row.film_id ?? "");
  };

  return (
    <Tactile
      onPress={() => router.push({ pathname: "/film/[slug]", params: { slug: row.slug } })}
    >
      <View style={{ width: cardW }}>
        <View style={{ width: cardW, height: imgH }}>
          <PosterImg
            path={row.poster_path}
            width={cardW}
            height={imgH}
            size="w780"
            rounded={radius.md}
          />
          <View style={{ position: "absolute", top: sp.s3, right: sp.s3 }}>
            <HeartButton active={inWatchlist} onPress={onHeart} />
          </View>
          {row.ts != null ? (
            <View style={{ position: "absolute", bottom: sp.s3, left: sp.s3 }}>
              <TSBadge ts={row.ts} onImage />
            </View>
          ) : null}
        </View>
        <View style={{ paddingTop: sp.s3 }}>
          <Ui size={fs.md} weight="600" numberOfLines={1}>
            {row.title}
          </Ui>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: sp.s2,
              marginTop: 2,
            }}
          >
            <Ui
              size={fs.sm}
              color={pal.muted}
              numberOfLines={1}
              style={{ flexShrink: 1 }}
            >
              {[row.year, row.director].filter(Boolean).join(" · ")}
            </Ui>
            <AvailabilityDots tiers={row.tiers} />
          </View>
          {row.lead ? (
            <Serif
              size={fs.base}
              italic
              color={pal.inkSoft}
              numberOfLines={2}
              style={{ marginTop: sp.s1 }}
            >
              {row.lead}
            </Serif>
          ) : null}
        </View>
      </View>
    </Tactile>
  );
}
