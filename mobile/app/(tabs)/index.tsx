// Tonight tab — the lobby-card feed (HANDOFF §5.2). The best films on the
// user's services, judged by TakeScore; each card is a decision moment.
import { Redirect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TSDonut } from "../../src/components/TSDonut";
import {
  AvailabilityDots,
  Btn,
  Hairline,
  Loading,
  PosterImg,
  Screen,
  Serif,
  Ui,
} from "../../src/components/ui";
import { DEFAULT_EDITION, EDITIONS } from "../../src/editions";
import { t } from "../../src/i18n";
import { api } from "../../src/lib/api";
import { useFilms } from "../../src/state/films";
import { usePrefs } from "../../src/state/prefs";
import { brand, fs, sp, usePalette } from "../../src/theme";
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

  const header = (
    <View style={{ paddingTop: insets.top + sp.s4, backgroundColor: pal.bg }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          paddingHorizontal: sp.s4,
          gap: sp.s3,
        }}
      >
        <View style={{ flex: 1 }}>
          <Serif size={fs.x3} bold>
            {t("tonight.title")}
          </Serif>
          <Ui size={fs.sm} color={pal.muted} style={{ marginTop: 2 }}>
            {t("tonight.subtitle")}
          </Ui>
        </View>
        {/* Country chip → country step of onboarding */}
        <Pressable
          onPress={() =>
            router.push({ pathname: "/onboarding", params: { step: "country" } })
          }
          hitSlop={8}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: sp.s1,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: pal.hairline2,
            borderRadius: 999,
            paddingHorizontal: sp.s3,
            paddingVertical: sp.s1 + 1,
            marginTop: sp.s1,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Ui size={fs.sm}>{edition.flag}</Ui>
          <Ui size={fs.xs + 1} weight="600" color={pal.muted}>
            {country}
          </Ui>
        </Pressable>
      </View>
      {session ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: sp.s4,
            paddingTop: sp.s3,
            paddingBottom: sp.s2,
            gap: sp.s3,
          }}
        >
          <Ui size={fs.sm} weight="500" style={{ flex: 1 }}>
            {t("tonight.hideSeen")}
          </Ui>
          <Switch
            value={hideSeen}
            onValueChange={(v) => set({ hideSeen: v })}
            trackColor={{ true: brand.accent }}
          />
        </View>
      ) : (
        <View style={{ height: sp.s3 }} />
      )}
      <Hairline />
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
          <Btn
            label={t("tonight.pickServices")}
            onPress={() =>
              router.push({ pathname: "/onboarding", params: { step: "services" } })
            }
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
          paddingTop: sp.s4,
          paddingBottom: sp.s6,
        }}
        ItemSeparatorComponent={() => <View style={{ height: sp.s4 }} />}
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

/** The signature lobby card: backdrop-ish poster, TS overlay, serif title, lead. */
function LobbyCard({ row, screenW }: { row: TonightRow; screenW: number }) {
  const pal = usePalette();
  const router = useRouter();
  const cardW = screenW - sp.s4 * 2;
  const imgH = Math.round(cardW * 0.56);
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/film/[slug]", params: { slug: row.slug } })}
      style={({ pressed }) => ({
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: pal.hairline,
        backgroundColor: pressed ? pal.surface : pal.bg,
      })}
    >
      <View style={{ width: cardW, height: imgH }}>
        <PosterImg path={row.poster_path} width={cardW} height={imgH} size="w780" />
        {row.ts != null ? (
          <View
            style={{
              position: "absolute",
              top: sp.s2,
              right: sp.s2,
              backgroundColor: pal.bg,
              padding: 3,
            }}
          >
            <TSDonut val={row.ts} size={44} />
          </View>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: sp.s3, paddingVertical: sp.s3 }}>
        <Serif size={fs.lg} bold numberOfLines={2}>
          {row.title}
        </Serif>
        <Ui size={fs.xs + 1} color={pal.muted} numberOfLines={1} style={{ marginTop: 2 }}>
          {[row.year, row.director].filter(Boolean).join(" · ")}
        </Ui>
        {row.lead ? (
          <Serif
            size={fs.base}
            italic
            color={pal.inkSoft}
            numberOfLines={2}
            style={{ marginTop: sp.s2, lineHeight: fs.base * 1.45 }}
          >
            {row.lead}
          </Serif>
        ) : null}
        <View style={{ marginTop: sp.s2 }}>
          <AvailabilityDots tiers={row.tiers} />
        </View>
      </View>
    </Pressable>
  );
}
