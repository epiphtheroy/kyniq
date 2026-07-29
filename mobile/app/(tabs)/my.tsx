// SHELF tab (HANDOFF v4 §5.6) — the judgment portfolio, 3 zones:
//   ① Queue — watchlist × my-services availability (AgeBadge commitment decay)
//   ② Deciding + Verdicts — the Considering pile (§5.0-D2) + Find/Aligned/Letdown recap
//   ③ Journey — lineage conquest (me_coverage) + one blindspot (me_blindspots) → /room webview
// ALL settings (edition switcher, services, notifications, account, in-app
// deletion — Apple 5.1.1(v)) live behind the top-right gear in a full-screen
// modal. Data path: me_* RPCs via app JWT (§7) + film_availability decoration.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as AppleAuthentication from "expo-apple-authentication";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Serif,
  AgeBadge,
  AvailabilityDots,
  Btn,
  GradientBtn,
  Hairline,
  HeaderSearch,
  PosterImg,
  SectionTitle,
  Tactile,
  Ui,
  UndoPill,
} from "../../src/components/ui";
import { METATAKE_BASE } from "../../src/config";
import { ALL_EDITIONS } from "../../src/editions";
import type { UILocale } from "../../src/editions";
import { t } from "../../src/i18n";
import { api, me } from "../../src/lib/api";
import * as considering from "../../src/lib/considering";
import type { ConsideringItem } from "../../src/lib/considering";
import { registerPush } from "../../src/lib/push";
import { supabase } from "../../src/lib/supabase";
import {
  type Age,
  ageColor,
  ageKey,
  ageOf,
  verdictColor,
  verdictKey,
  verdictOf,
} from "../../src/lib/verdict";
import { useFilms, type JudgmentUndo } from "../../src/state/films";
import { usePrefs } from "../../src/state/prefs";
import { brand, font, fs, gradient, radius, sp, usePalette } from "../../src/theme";
import type {
  BlindspotRow,
  CollectionRow,
  CoverageRow,
  WatchlistScoredRow,
} from "../../src/types";

// Locale autonyms — shown in their own language on purpose. // TODO(i18n)
const LOCALE_LABEL: Record<UILocale, string> = {
  en: "English",
  ko: "한국어",
  es: "Español",
  ja: "日本語",
};
const LOCALE_CYCLE: UILocale[] = ["en", "ko", "es", "ja"];

// Connect hub route (HANDOFF-커넥트 §2.1). Cast: the /connect screen lands in
// this same wave from another lane, and the generated typed-routes file only
// refreshes on the next `expo start` — the cast keeps tsc green until then.
const CONNECT_HREF = "/connect" as Href;

// Hairline inset for grouped settings rows: 16 padding + 32 icon disc + 12 gap.
const ROW_INSET = 60;
// Hairline inset for queue rows: 16 padding + 48 poster + 12 gap.
const QUEUE_INSET = 76;

const VERDICTS = ["find", "aligned", "letdown"] as const;

export default function ShelfScreen() {
  const pal = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const prefs = usePrefs();
  const { session, ledger, entry, dismiss, undo, reload } = useFilms();

  const [showSettings, setShowSettings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Zone data — all me_* JWT reads, reset on sign-out.
  const [queue, setQueue] = useState<WatchlistScoredRow[] | null>(null);
  const [tiers, setTiers] = useState<Map<string, string[]>>(new Map());
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [availReady, setAvailReady] = useState(false);
  const [deciding, setDeciding] = useState<ConsideringItem[]>([]);
  const [collection, setCollection] = useState<CollectionRow[] | null>(null);
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);
  const [blindspot, setBlindspot] = useState<BlindspotRow | null>(null);

  const [undoTok, setUndoTok] = useState<JudgmentUndo | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

  const providersKey = prefs.providerIds.join(",");

  const fetchAll = useCallback(async () => {
    if (!session?.user) {
      setQueue(null);
      setTiers(new Map());
      setMine(new Set());
      setAvailReady(false);
      setCollection(null);
      setCoverage([]);
      setBlindspot(null);
      return;
    }
    const [rows, coll, cov, blind] = await Promise.all([
      me.watchlistScored().catch(() => [] as WatchlistScoredRow[]),
      me.collection().catch(() => [] as CollectionRow[]),
      me.coverage(5, 40),
      me.blindspots(1),
    ]);
    if (!alive.current) return;
    setQueue(rows);
    setCollection(coll);
    setCoverage(cov);
    setBlindspot(blind[0] ?? null);

    // Availability decoration: dots (all providers) + my-services match set.
    const slugs = rows.map((r) => r.slug).slice(0, 60);
    setAvailReady(false);
    if (!slugs.length) {
      setTiers(new Map());
      setMine(new Set());
      setAvailReady(true);
      return;
    }
    try {
      const tiersMap = await api.availability(slugs, prefs.country);
      let mineSet: Set<string>;
      if (prefs.providerIds.length) {
        // Same anon RPC api.availability wraps, filtered to MY provider ids.
        const { data, error } = await supabase.rpc("film_availability", {
          p_slugs: slugs,
          p_countries: [prefs.country],
          p_providers: prefs.providerIds,
          p_include_us_library: false,
        });
        if (error) throw error;
        mineSet = new Set(
          ((data ?? []) as { slug: string; tiers: unknown[] }[])
            .filter((r) => (r.tiers ?? []).length > 0)
            .map((r) => r.slug),
        );
      } else {
        // No declared services — degrade to "available anywhere" (Tonight's rule).
        mineSet = new Set(
          [...tiersMap.entries()].filter(([, v]) => v.length > 0).map(([k]) => k),
        );
      }
      if (!alive.current) return;
      setTiers(tiersMap);
      setMine(mineSet);
      setAvailReady(true);
    } catch {
      // Availability unknown → omit the headline instead of showing a fake 0 (§13-17).
      if (!alive.current) return;
      setTiers(new Map());
      setMine(new Set());
      setAvailReady(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, prefs.country, providersKey]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Deciding pile — local ring buffer minus anything the ledger has settled.
  useEffect(() => {
    let on = true;
    if (!session?.user) {
      setDeciding([]);
      return;
    }
    considering
      .pile((slug) => {
        const e = entry(slug);
        return e.seen || e.watchlist || e.dismissed;
      })
      .then((items) => on && setDeciding(items));
    return () => {
      on = false;
    };
  }, [session?.user?.id, ledger, entry]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([reload(), fetchAll()]);
    setRefreshing(false);
  };

  // ---- Zone 1 derived rows --------------------------------------------------
  const { mainRows, staleRows, qTotal, qAvail } = useMemo(() => {
    const rows = (queue ?? []).filter((r) => {
      const e = ledger.get(r.slug);
      return !e || (e.watchlist && !e.dismissed); // ledger (optimistic) wins
    });
    const main: WatchlistScoredRow[] = [];
    const stale: WatchlistScoredRow[] = [];
    for (const r of rows) (ageOf(r.added_at) === "stale" ? stale : main).push(r);
    const at = (r: WatchlistScoredRow) => Date.parse(r.added_at ?? "") || 0;
    main.sort((a, b) => {
      const am = mine.has(a.slug) ? 1 : 0;
      const bm = mine.has(b.slug) ? 1 : 0;
      if (am !== bm) return bm - am; // available on my services first
      return at(b) - at(a); // then newest commitment first
    });
    stale.sort((a, b) => at(a) - at(b)); // oldest promises first
    return {
      mainRows: main,
      staleRows: stale,
      qTotal: rows.length,
      qAvail: rows.filter((r) => mine.has(r.slug)).length,
    };
  }, [queue, ledger, mine]);

  // ---- Zone 2 derived (verdict recap) ---------------------------------------
  const rated = useMemo(() => {
    const rs = (collection ?? []).filter((r) => r.rating != null);
    rs.sort((a, b) => (Date.parse(b.added_at ?? "") || 0) - (Date.parse(a.added_at ?? "") || 0));
    return rs;
  }, [collection]);

  const verdictStats = useMemo(() => {
    const counts = { find: 0, aligned: 0, letdown: 0 };
    let findsThisMonth = 0;
    const now = new Date();
    for (const r of rated) {
      const v = verdictOf(r.rating, r.prestige);
      if (!v) continue;
      counts[v] += 1;
      if (v === "find" && r.added_at) {
        const d = new Date(r.added_at);
        if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
          findsThisMonth += 1;
        }
      }
    }
    return { counts, findsThisMonth };
  }, [rated]);

  // ---- Zone 3 derived --------------------------------------------------------
  const topCoverage = useMemo(
    () => [...coverage].sort((a, b) => (b.aw ?? 0) - (a.aw ?? 0)).slice(0, 3),
    [coverage],
  );

  // Same idiom as the film screen's "Read more" rows — the in-app reader.
  const openRoom = (title: string) =>
    router.push({ pathname: "/read", params: { path: "/room/coverage", title } });

  const showUndo = (tok: JudgmentUndo) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoTok(tok);
    undoTimer.current = setTimeout(() => setUndoTok(null), 6000);
  };

  const onPass = async (slug: string) => {
    const tok = await dismiss(slug);
    if (tok) {
      showUndo(tok);
      void considering.noteJudged(slug);
      me.invalidateRecommend();
    }
  };

  const onUndo = () => {
    const tok = undoTok;
    setUndoTok(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    if (tok) {
      void undo(tok);
      me.invalidateRecommend();
    }
  };

  const surfaceCard = {
    marginHorizontal: sp.s4,
    backgroundColor: pal.surface,
    borderRadius: radius.md,
    overflow: "hidden" as const,
  };

  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={pal.muted} />
        }
      >
        {/* Masthead — title + settings gear */}
        <View
          style={{
            paddingTop: insets.top + sp.s3,
            paddingHorizontal: sp.s4,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Ui size={fs.x2} weight="600" style={{ flex: 1 }}>
            {t("shelf.title")}
          </Ui>
          <HeaderSearch onPress={() => router.push("/search")} />
          <View style={{ width: sp.s2 }} />
          <Tactile onPress={() => setShowSettings(true)} hitSlop={8}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.pill,
                backgroundColor: pal.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="settings-outline" size={18} color={pal.ink} />
            </View>
          </Tactile>
        </View>

        {!session ? (
          /* Signed out — the portfolio needs an account. Gear stays reachable. */
          <View
            style={{
              paddingHorizontal: sp.s5,
              paddingTop: sp.s8,
              alignItems: "center",
              gap: sp.s4,
            }}
          >
            <Ui size={fs.base} color={pal.inkSoft} style={{ textAlign: "center" }}>
              {t("shelf.signedOut")}
            </Ui>
            <Btn
              label={t("my.signIn")}
              onPress={() => router.push({ pathname: "/onboarding", params: { step: "account" } })}
              style={{ alignSelf: "stretch" }}
            />
            {/* Quiet secondary path — imports need auth anyway; the hub explains */}
            <Tactile onPress={() => router.push(CONNECT_HREF)} hitSlop={6}>
              <Ui
                size={fs.sm}
                weight="500"
                color={pal.muted}
                style={{ textAlign: "center", textDecorationLine: "underline" }}
              >
                {t("connect.entry.title")}
              </Ui>
            </Tactile>
          </View>
        ) : (
          <>
            {/* Connect entry — the empty shelf is the primary discovery moment
                (HANDOFF-커넥트 §2.1: Shelf body card, not the gear sheet) */}
            {queue !== null && qTotal === 0 ? <ConnectEntryCard /> : null}

            {/* ── Zone 1 · Queue ─────────────────────────────────────────── */}
            <SectionTitle
              sub={
                availReady && qTotal > 0
                  ? t("shelf.queueLine", { avail: qAvail, total: qTotal })
                  : undefined
              }
            >
              {t("shelf.queueTitle")}
            </SectionTitle>
            {queue !== null && qTotal === 0 ? (
              <Ui
                size={fs.sm}
                color={pal.muted}
                style={{ paddingHorizontal: sp.s4, paddingVertical: sp.s2 }}
              >
                {t("shelf.emptyQueue")}
              </Ui>
            ) : null}
            {mainRows.length ? (
              <View style={surfaceCard}>
                {mainRows.map((r, i) => (
                  <React.Fragment key={r.slug}>
                    {i > 0 ? <Hairline style={{ marginLeft: QUEUE_INSET }} /> : null}
                    <QueueRow row={r} tiers={tiers.get(r.slug) ?? []} age={ageOf(r.added_at)} />
                  </React.Fragment>
                ))}
              </View>
            ) : null}
            {staleRows.length ? (
              <>
                <Ui
                  size={fs.sm}
                  weight="500"
                  color={pal.muted}
                  style={{ paddingHorizontal: sp.s4, marginTop: sp.s4, marginBottom: sp.s2 }}
                >
                  {t("shelf.staleNudge")}
                </Ui>
                <View style={surfaceCard}>
                  {staleRows.map((r, i) => (
                    <React.Fragment key={r.slug}>
                      {i > 0 ? <Hairline style={{ marginLeft: QUEUE_INSET }} /> : null}
                      <QueueRow
                        row={r}
                        tiers={tiers.get(r.slug) ?? []}
                        age="stale"
                        onPass={(slug) => void onPass(slug)}
                      />
                    </React.Fragment>
                  ))}
                </View>
              </>
            ) : null}

            {/* ── Zone 2 · Deciding + Verdicts ───────────────────────────── */}
            {deciding.length ? (
              <>
                <SectionTitle sub={t("shelf.decidingHint")}>{t("shelf.deciding")}</SectionTitle>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: sp.s4, gap: sp.s3 }}
                >
                  {deciding.map((d) => (
                    <Tactile
                      key={d.slug}
                      onPress={() =>
                        router.push({ pathname: "/film/[slug]", params: { slug: d.slug } })
                      }
                      style={{ width: 96 }}
                    >
                      <View>
                        <PosterImg
                          path={d.poster_path}
                          width={96}
                          height={144}
                          size="w185"
                          rounded={radius.sm}
                        />
                        <Ui size={fs.xs} numberOfLines={1} style={{ marginTop: 4 }}>
                          {d.title}
                        </Ui>
                      </View>
                    </Tactile>
                  ))}
                </ScrollView>
              </>
            ) : null}

            {rated.length ? (
              <>
                <SectionTitle>{t("shelf.verdicts")}</SectionTitle>
                <View style={[surfaceCard, { padding: sp.s4, gap: sp.s3 }]}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: sp.s4 }}>
                    {VERDICTS.map((v) => (
                      <View
                        key={v}
                        style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                      >
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: radius.pill,
                            backgroundColor: verdictColor(v),
                          }}
                        />
                        <Ui size={fs.sm} weight="600">
                          {String(verdictStats.counts[v])}
                        </Ui>
                        <Ui size={fs.sm} color={pal.muted}>
                          {t(verdictKey(v))}
                        </Ui>
                      </View>
                    ))}
                  </View>
                  <Ui size={fs.xs + 1} color={pal.muted}>
                    {t("shelf.findsMonth", { n: verdictStats.findsThisMonth })}
                  </Ui>
                </View>
                <View style={[surfaceCard, { marginTop: sp.s3 }]}>
                  {rated.slice(0, 6).map((r, i) => {
                    const v = verdictOf(r.rating, r.prestige);
                    return (
                      <React.Fragment key={r.slug}>
                        {i > 0 ? <Hairline style={{ marginLeft: QUEUE_INSET }} /> : null}
                        <Tactile
                          onPress={() =>
                            router.push({ pathname: "/film/[slug]", params: { slug: r.slug } })
                          }
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: sp.s3,
                              paddingHorizontal: sp.s4,
                              paddingVertical: sp.s3,
                            }}
                          >
                            <PosterImg
                              path={r.poster_path}
                              width={48}
                              height={72}
                              size="w92"
                              rounded={radius.sm}
                            />
                            <View style={{ flex: 1 }}>
                              <Ui size={fs.md} weight="500" numberOfLines={1}>
                                {r.title}
                              </Ui>
                              {r.year != null ? (
                                <Ui size={fs.sm} color={pal.muted} style={{ marginTop: 1 }}>
                                  {String(r.year)}
                                </Ui>
                              ) : null}
                            </View>
                            {v ? <AgeBadge label={t(verdictKey(v))} color={verdictColor(v)} /> : null}
                          </View>
                        </Tactile>
                      </React.Fragment>
                    );
                  })}
                </View>
              </>
            ) : null}

            {/* ── Zone 3 · Journey ───────────────────────────────────────── */}
            {topCoverage.length || blindspot ? (
              <>
                <SectionTitle>{t("shelf.journey")}</SectionTitle>
                {topCoverage.length ? (
                  <View style={surfaceCard}>
                    {topCoverage.map((c, i) => {
                      const pct = Math.min(
                        100,
                        Math.round((c.total > 0 ? c.seen / c.total : 0) * 100),
                      );
                      return (
                        <React.Fragment key={c.list_id}>
                          {i > 0 ? <Hairline style={{ marginLeft: sp.s4 }} /> : null}
                          <Tactile onPress={() => openRoom(c.label)}>
                            <View
                              style={{ paddingHorizontal: sp.s4, paddingVertical: sp.s3, gap: 6 }}
                            >
                              <View style={{ flexDirection: "row", alignItems: "center", gap: sp.s3 }}>
                                <Ui size={fs.sm} weight="500" numberOfLines={1} style={{ flex: 1 }}>
                                  {c.label}
                                </Ui>
                                <Ui size={fs.sm} color={pal.muted}>
                                  {`${c.seen}/${c.total}`}
                                </Ui>
                              </View>
                              <View
                                style={{
                                  height: 4,
                                  borderRadius: radius.pill,
                                  backgroundColor: pal.hairline,
                                  overflow: "hidden",
                                }}
                              >
                                <View
                                  style={{
                                    width: `${pct}%`,
                                    height: 4,
                                    borderRadius: radius.pill,
                                    backgroundColor: brand.teal,
                                  }}
                                />
                              </View>
                            </View>
                          </Tactile>
                        </React.Fragment>
                      );
                    })}
                  </View>
                ) : null}
                {blindspot ? (
                  <Tactile
                    onPress={() => openRoom(blindspot.label)}
                    style={{ marginHorizontal: sp.s4, marginTop: sp.s3 }}
                  >
                    <View
                      style={{
                        backgroundColor: pal.surface,
                        borderRadius: radius.md,
                        padding: sp.s4,
                        gap: 4,
                      }}
                    >
                      <Ui size={fs.xs} weight="600" color={pal.muted}>
                        {t("shelf.blindspot")}
                      </Ui>
                      <Ui size={fs.md} weight="600" numberOfLines={2}>
                        {blindspot.label}
                      </Ui>
                      {blindspot.gap_reason ? (
                        <Ui size={fs.sm} color={pal.inkSoft}>
                          {blindspot.gap_reason}
                        </Ui>
                      ) : null}
                    </View>
                  </Tactile>
                ) : null}
                <Tactile
                  onPress={() => openRoom(t("shelf.journey"))}
                  hitSlop={6}
                  style={{ alignSelf: "flex-start", paddingHorizontal: sp.s4, paddingVertical: sp.s3 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Ui size={fs.sm} weight="500" color={brand.accent}>
                      {t("shelf.openRoom")}
                    </Ui>
                    <Ionicons name="arrow-forward" size={14} color={brand.accent} />
                  </View>
                </Tactile>
              </>
            ) : null}

            {/* Connect entry, compact — discovery stays reachable on a full shelf */}
            {qTotal > 0 ? <ConnectEntryCard compact /> : null}
          </>
        )}

        {/* Attribution (invariant §13-8 — availability data shows above) */}
        <View style={{ paddingHorizontal: sp.s4, paddingTop: sp.s6, gap: 2 }}>
          <Ui size={fs.xs} color={pal.subtle}>
            {t("attribution.justwatch")}
          </Ui>
          <Ui size={fs.xs} color={pal.subtle}>
            {t("attribution.tmdb")}
          </Ui>
        </View>
      </ScrollView>

      {/* Floating undo — every judgment is reversible (§13-15) */}
      {undoTok ? (
        <View
          pointerEvents="box-none"
          style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + 96 }}
        >
          <UndoPill label={t("judge.passed")} actionLabel={t("judge.undo")} onUndo={onUndo} />
        </View>
      ) : null}

      {/* Settings — everything the old My screen held, verbatim, behind the gear */}
      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
    </View>
  );
}

// ---------------------------------------------------------------------------

/** "Bring your film life" — Shelf entry to the Connect hub (HANDOFF-커넥트 §2.1).
    Prominent card on an empty shelf; compact row under Journey otherwise. */
function ConnectEntryCard({ compact }: { compact?: boolean }) {
  const pal = usePalette();
  const router = useRouter();
  return (
    <Tactile
      onPress={() => router.push(CONNECT_HREF)}
      style={{ marginHorizontal: sp.s4, marginTop: compact ? sp.s5 : sp.s4 }}
    >
      <View
        style={{
          backgroundColor: pal.surface,
          borderRadius: radius.md,
          paddingHorizontal: sp.s4,
          paddingVertical: compact ? sp.s3 : sp.s4,
          flexDirection: "row",
          alignItems: "center",
          gap: sp.s3,
        }}
      >
        <View style={{ flex: 1 }}>
          <Ui size={fs.md} weight="600" numberOfLines={1}>
            {t("connect.entry.title")}
          </Ui>
          <Ui
            size={compact ? fs.xs + 1 : fs.sm}
            color={pal.muted}
            numberOfLines={compact ? 1 : 2}
            style={{ marginTop: 2 }}
          >
            {t("connect.entry.sub")}
          </Ui>
        </View>
        <Ionicons name="chevron-forward" size={16} color={pal.subtle} />
      </View>
    </Tactile>
  );
}

/** Queue row — poster, title/year, decay badge, availability dots, optional ✕ pass. */
function QueueRow({
  row,
  tiers,
  age,
  onPass,
}: {
  row: WatchlistScoredRow;
  tiers: string[];
  age: Age | null;
  onPass?: (slug: string) => void;
}) {
  const pal = usePalette();
  const router = useRouter();
  return (
    <Tactile onPress={() => router.push({ pathname: "/film/[slug]", params: { slug: row.slug } })}>
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
              {String(row.year)}
            </Ui>
          ) : null}
        </View>
        {/* Fresh stays quiet — only decay (aging/stale) earns a badge */}
        {age && age !== "fresh" ? <AgeBadge label={t(ageKey(age))} color={ageColor(age)} /> : null}
        {tiers.length ? <AvailabilityDots tiers={tiers} /> : null}
        {onPass ? (
          <Tactile onPress={() => onPass(row.slug)} hitSlop={8}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: radius.pill,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: pal.hairline2,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={16} color={pal.ink} />
            </View>
          </Tactile>
        ) : null}
      </View>
    </Tactile>
  );
}

// ---------------------------------------------------------------------------
// Settings modal — the entire pre-v4 My screen settings surface, unchanged
// behavior: edition switcher, services, notifications, account (sign in/out,
// in-app deletion — Apple 5.1.1(v)).

function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const pal = usePalette();
  const scheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const prefs = usePrefs();
  const { session } = useFilms();

  const scrollRef = useRef<ScrollView>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false); // signed-out auth block reveal

  // Revealing the auth block scrolls it into view (after it lays out).
  useEffect(() => {
    if (!authOpen) return;
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [authOpen]);

  const onTogglePush = async (on: boolean) => {
    if (!on) {
      prefs.set({ pushEnabled: false });
      return;
    }
    setPushBusy(true);
    prefs.set({ pushEnabled: true }); // optimistic — reverted below on failure
    const ok = await registerPush(prefs.country, prefs.locale).catch(() => false);
    if (!ok) prefs.set({ pushEnabled: false });
    setPushBusy(false);
  };

  const edition = ALL_EDITIONS.find((e) => e.country === prefs.country);
  const cycleLocale = () => {
    const i = LOCALE_CYCLE.indexOf(prefs.locale);
    prefs.set({ locale: LOCALE_CYCLE[(i + 1) % LOCALE_CYCLE.length] });
  };

  // The modal floats above the navigator — close it before pushing a route.
  const goOnboarding = (step: "country" | "services") => {
    onClose();
    router.push({ pathname: "/onboarding", params: { step } });
  };

  const email = session?.user.email ?? null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: pal.bg }}>
        {/* Header */}
        <View
          style={{
            paddingTop: insets.top + sp.s3,
            paddingHorizontal: sp.s4,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Ui size={fs.x2} weight="600" style={{ flex: 1 }}>
            {t("my.settings")}
          </Ui>
          <Tactile onPress={onClose} hitSlop={8}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.pill,
                backgroundColor: pal.surface,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={18} color={pal.ink} />
            </View>
          </Tactile>
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingBottom: 64 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Identity card */}
          {session ? (
            <View
              style={{
                marginTop: sp.s4,
                marginHorizontal: sp.s4,
                backgroundColor: pal.surface,
                borderRadius: radius.lg,
                padding: sp.s5,
                flexDirection: "row",
                alignItems: "center",
                gap: sp.s4,
              }}
            >
              <LinearGradient
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: radius.pill,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ui size={fs.xl} weight="700" color="#FFFFFF">
                  {(email?.[0] ?? "m").toUpperCase()}
                </Ui>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                {email ? (
                  <Ui size={fs.md} weight="500" numberOfLines={1}>
                    {email}
                  </Ui>
                ) : null}
                <Ui size={fs.xs} color={pal.muted} style={{ marginTop: 2 }}>
                  Metatake member
                </Ui>
                {/* TODO(i18n): my.memberBadge */}
              </View>
            </View>
          ) : (
            <View
              style={{
                marginTop: sp.s4,
                marginHorizontal: sp.s4,
                backgroundColor: pal.surface,
                borderRadius: radius.lg,
                padding: sp.s5,
                gap: sp.s4,
              }}
            >
              <Ui size={fs.base} color={pal.inkSoft}>
                {t("my.signInHint")}
              </Ui>
              <GradientBtn label={t("my.signIn")} onPress={() => setAuthOpen(true)} />
            </View>
          )}

          {/* SETTINGS — one grouped surface card */}
          <View
            style={{
              marginTop: sp.s5,
              marginHorizontal: sp.s4,
              backgroundColor: pal.surface,
              borderRadius: radius.md,
              overflow: "hidden",
            }}
          >
            <SettingRow
              icon="globe-outline"
              label={t("my.country")}
              value={edition ? `${edition.flag} ${edition.label}` : prefs.country}
              onPress={() => goOnboarding("country")}
            />
            <Hairline style={{ marginLeft: ROW_INSET }} />
            <SettingRow
              icon="language-outline"
              label={t("my.language")}
              value={LOCALE_LABEL[prefs.locale]}
              onPress={cycleLocale}
            />
            <Hairline style={{ marginLeft: ROW_INSET }} />
            <SettingRow
              icon="tv-outline"
              label={t("my.services")}
              value={String(prefs.providerIds.length)}
              onPress={() => goOnboarding("services")}
            />
            <Hairline style={{ marginLeft: ROW_INSET }} />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: sp.s3,
                paddingHorizontal: sp.s4,
                paddingVertical: sp.s3,
              }}
            >
              <IconDisc name="notifications-outline" />
              <View style={{ flex: 1 }}>
                <Ui size={fs.md} weight="500">
                  {t("my.notifications")}
                </Ui>
                <Ui size={fs.xs} color={pal.muted} style={{ marginTop: 2 }}>
                  {t("my.notifyArrivals")}
                </Ui>
              </View>
              <Switch
                value={prefs.pushEnabled}
                disabled={pushBusy}
                onValueChange={onTogglePush}
                trackColor={{ true: brand.accent, false: pal.hairline2 }}
              />
            </View>
          </View>

          {/* ACCOUNT */}
          {session ? (
            <>
              <SectionTitle>{t("my.account")}</SectionTitle>
              <SignedIn />
            </>
          ) : authOpen ? (
            <>
              <SectionTitle>{t("my.account")}</SectionTitle>
              <SignedOut
                scheme={scheme === "dark" ? "dark" : "light"}
                onSkip={() => setAuthOpen(false)}
              />
            </>
          ) : null}

          {/* Attribution (invariant §13-8) */}
          <View style={{ paddingHorizontal: sp.s4, paddingTop: sp.s6, gap: 2 }}>
            <Ui size={fs.xs} color={pal.subtle}>
              {t("attribution.justwatch")}
            </Ui>
            <Ui size={fs.xs} color={pal.subtle}>
              {t("attribution.tmdb")}
            </Ui>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

/** 32px leading icon disc for grouped settings rows. */
function IconDisc({ name }: { name: React.ComponentProps<typeof Ionicons>["name"] }) {
  const pal = usePalette();
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: radius.pill,
        backgroundColor: pal.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={name} size={16} color={pal.ink} />
    </View>
  );
}

function SettingRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  onPress: () => void;
}) {
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
        <IconDisc name={icon} />
        <Ui size={fs.md} weight="500" style={{ flex: 1 }}>
          {label}
        </Ui>
        <Ui size={fs.sm} color={pal.muted}>
          {value}
        </Ui>
        <Ionicons name="chevron-forward" size={16} color={pal.subtle} />
      </View>
    </Tactile>
  );
}

// ---- Signed-in account block ----------------------------------------------

function SignedIn() {
  const pal = usePalette();
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  const doDelete = async () => {
    if (busy) return;
    setBusy(true);
    setErr(false);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("no session");
      const res = await fetch(`${METATAKE_BASE}/api/v1/app/account-delete`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await supabase.auth.signOut();
    } catch {
      setErr(true);
    }
    setBusy(false);
  };

  const confirmDelete = () => {
    // Web preview: Alert has no browser implementation and the delete POST needs
    // the authorization header the public API's CORS deliberately blocks — so the
    // browser delegates account management to the website. Native does it in-app
    // (Apple 5.1.1(v)).
    if (Platform.OS === "web") {
      window.open(`${METATAKE_BASE}/settings`, "_blank", "noopener");
      return;
    }
    Alert.alert(t("my.deleteAccount"), t("my.deleteAccountConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("my.deleteAccount"), style: "destructive", onPress: () => void doDelete() },
    ]);
  };

  return (
    <View style={{ paddingHorizontal: sp.s4, gap: sp.s3 }}>
      <Btn kind="ghost" label={t("my.signOut")} onPress={() => void supabase.auth.signOut()} />
      <Tactile
        onPress={confirmDelete}
        disabled={busy}
        style={{ alignSelf: "flex-start", paddingVertical: sp.s2 }}
      >
        <Ui
          size={fs.sm}
          weight="500"
          color={brand.tsRisk}
          style={{ textDecorationLine: "underline", opacity: busy ? 0.5 : 1 }}
        >
          {t("my.deleteAccount")}
        </Ui>
      </Tactile>
      {err ? (
        <Ui size={fs.xs + 1} color={pal.muted}>
          {t("error.network")}
        </Ui>
      ) : null}
      {/* Dedication (owner directive 2026-07-20) */}
      <Serif
        size={fs.sm}
        italic
        color={pal.subtle}
        style={{ textAlign: "center", marginTop: sp.s4 }}
      >
        to. W.H. Heo
      </Serif>
    </View>
  );
}

// ---- Signed-out account block: email + 6-digit code, Apple ----------------

function SignedOut({
  scheme,
  onSkip,
}: {
  scheme: "light" | "dark" | null | undefined;
  onSkip: () => void;
}) {
  const pal = usePalette();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [appleErr, setAppleErr] = useState(false);

  const inputStyle = {
    backgroundColor: pal.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: pal.hairline2,
    borderRadius: radius.sm,
    color: pal.ink,
    fontFamily: font.ui,
    fontSize: fs.base,
    paddingHorizontal: sp.s4,
    paddingVertical: sp.s3,
  } as const;

  const sendCode = async () => {
    if (busy || !email.includes("@")) return;
    setBusy(true);
    setErr(false);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setStage("code");
    } catch {
      setErr(true);
    }
    setBusy(false);
  };

  const verifyCode = async () => {
    if (busy || code.trim().length < 6) return;
    setBusy(true);
    setErr(false);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (error) throw error;
      // session propagates via onAuthStateChange (FilmsProvider reloads the ledger)
    } catch {
      setErr(true);
    }
    setBusy(false);
  };

  const signInApple = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error("no identity token");
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });
      if (error) throw error;
    } catch (e) {
      // User-cancelled sheets stay silent; real failures surface the config hint.
      if ((e as { code?: string }).code !== "ERR_REQUEST_CANCELED") setAppleErr(true);
    }
  };

  return (
    <View
      style={{
        marginHorizontal: sp.s4,
        backgroundColor: pal.surface,
        borderRadius: radius.lg,
        padding: sp.s5,
        gap: sp.s3,
      }}
    >
      <Ui size={fs.lg} weight="600">
        {t("auth.title")}
      </Ui>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder={t("auth.email")}
        placeholderTextColor={pal.subtle}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        style={inputStyle}
      />
      {stage === "code" ? (
        <>
          <Ui size={fs.xs + 1} color={pal.muted}>
            Enter the 6-digit code we emailed you {/* TODO(i18n) */}
          </Ui>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="000000"
            placeholderTextColor={pal.subtle}
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
            style={inputStyle}
          />
          <GradientBtn label={t("my.signIn")} onPress={() => void verifyCode()} />
        </>
      ) : (
        <GradientBtn label={t("auth.continue")} onPress={() => void sendCode()} />
      )}
      {err ? (
        <Ui size={fs.xs + 1} color={pal.muted}>
          {t("error.network")}
        </Ui>
      ) : null}

      {/* or */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: sp.s3, marginVertical: sp.s1 }}>
        <Hairline style={{ flex: 1 }} />
        <Ui size={fs.xs} color={pal.muted}>
          {t("auth.or")}
        </Ui>
        <Hairline style={{ flex: 1 }} />
      </View>

      {Platform.OS === "ios" ? (
        <>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={
              scheme === "dark"
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={radius.xs}
            style={{ height: 48 }}
            onPress={() => void signInApple()}
          />
          {appleErr ? (
            <Ui size={fs.xs + 1} color={pal.muted}>
              Apple sign-in not configured yet {/* TODO(owner): enable Apple provider in Supabase Auth */}
            </Ui>
          ) : null}
        </>
      ) : null}
      <Ui size={fs.sm} color={pal.subtle} style={{ textAlign: "center" }}>
        {t("auth.continueGoogle")} · {t("common.soon")}
      </Ui>

      <Tactile onPress={onSkip} style={{ alignSelf: "center", paddingVertical: sp.s1 }}>
        <Ui size={fs.sm} weight="500" color={pal.muted} style={{ textDecorationLine: "underline" }}>
          {t("action.skip")}
        </Ui>
      </Tactile>
    </View>
  );
}
