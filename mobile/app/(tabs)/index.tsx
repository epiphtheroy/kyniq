// Tonight tab — v4: the TRIAGE DECK (HANDOFF §5.2, §4.1). The lobby-card feed
// becomes a judgment surface: situation preset chips re-rank the same engine,
// every card carries the same three verbs (♥ want / ✕ pass / ✓ seen) by quiet
// button or swipe, and every judgment shows an immediate undo pill (§13-15).
// Design system v2 "Lava" grammar kept: SearchPill front door, chip rows,
// rounded image cards with TSBadge + HeartButton overlays.
import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  PanResponder,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type PanResponderInstance,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AvailabilityDots,
  Btn,
  Chip,
  GradientBtn,
  HeaderSearch,
  HeartButton,
  Loading,
  PickerChip,
  PickerSheet,
  PosterImg,
  ReasonChip,
  Screen,
  Serif,
  Tactile,
  TSBadge,
  Ui,
  UndoPill,
  Wordmark,
} from "../../src/components/ui";
import { DEFAULT_EDITION, EDITIONS } from "../../src/editions";
import { Appear, Dots, Pop, SkeletonScreen, Sparkle, haptic } from "../../src/components/motion";
import { t, type DictKey } from "../../src/i18n";
import { api, me } from "../../src/lib/api";
import { noteJudged } from "../../src/lib/considering";
import { useFilms, type JudgmentUndo } from "../../src/state/films";
import { usePrefs } from "../../src/state/prefs";
import { brand, fs, radius, shadow, sp, usePalette } from "../../src/theme";
import type { PresetKey, TonightRow, WwiRow } from "../../src/types";

type JudgeKind = "want" | "pass" | "seen";
type DeckRow = TonightRow & { reason?: string | null };
type DeckPreset = Exclude<PresetKey, "services">;
type UndoItem = { token: JudgmentUndo; row: DeckRow; index: number; kind: JudgeKind };

type SortKey = "ts" | "ts100" | "ts500" | "ts1000" | "new" | "old" | "alpha";
type EraKey = "all" | "1980" | "2000" | "2010" | "2020";

/** v11 tokens bake direction in — never send sort=year (an unknown token falls
 *  back to "u" with the sign flipped, which surfaces the WORST films first). */
const SORT_TOKEN: Record<SortKey, string> = {
  ts: "u",
  ts100: "u",
  ts500: "u",
  ts1000: "u",
  new: "newest",
  old: "oldest",
  alpha: "alpha",
};
/** Top-N is the TakeScore order stopped after N films (owner 07-30). It bounds
 *  the deck rather than reordering it, so it reads against whatever filters are
 *  live: "the top 100 on my services since 2000". */
const RANK_CAP: Partial<Record<SortKey, number>> = { ts100: 100, ts500: 500, ts1000: 1000 };
const SORT_COPY: Record<SortKey, DictKey> = {
  ts: "sort.takescore",
  ts100: "sort.top100",
  ts500: "sort.top500",
  ts1000: "sort.top1000",
  new: "sort.newest",
  old: "sort.oldest",
  alpha: "sort.alpha",
};
/** Era floor → server year_min. "all" means no floor. */
const ERA_YEAR: Record<EraKey, number | null> = {
  all: null,
  "1980": 1980,
  "2000": 2000,
  "2010": 2010,
  "2020": 2020,
};

const UNDO_MS = 4000;
const NOTICE_MS = 3500;

function insertAt<T>(arr: T[], i: number, x: T): T[] {
  const idx = Math.max(0, Math.min(i, arr.length));
  return [...arr.slice(0, idx), x, ...arr.slice(idx)];
}

/** Best-effort tiers from me_recommend_wwi's opaque avail blob — else []. */
function tiersFromAvail(avail: unknown): string[] {
  if (!Array.isArray(avail)) return [];
  const kinds: string[] = [];
  for (const item of avail) {
    if (typeof item === "string") kinds.push(item);
    else if (item && typeof item === "object") {
      const k = (item as { kind?: unknown }).kind;
      if (typeof k === "string") kinds.push(k);
    }
  }
  return [...new Set(kinds)];
}

/** Bold pick source swap — WwiRow into the deck's card shape (§5.2). */
function deckRowFromWwi(w: WwiRow): DeckRow {
  return {
    film_id: null,
    slug: w.slug,
    title: w.title,
    year: w.year,
    poster_path: w.poster_path,
    director: w.director,
    director_slug: null,
    ts: w.ts,
    tiers: tiersFromAvail(w.avail),
    lead: null,
    reason: w.reasons && w.reasons.length ? w.reasons[0] : null,
  };
}

export default function TonightScreen() {
  const pal = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { country, providerIds, onboarded, hideSeen, taste, ready, set } = usePrefs();
  const { session, ledger, setWatchlist, dismiss, markSeen, undo } = useFilms();

  const [rows, setRows] = useState<DeckRow[]>([]);
  const [total, setTotal] = useState(0);
  const [fetched, setFetched] = useState(0); // server rows pulled (offset cursor)
  const [status, setStatus] = useState<"loading" | "idle" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [gen, setGen] = useState(0); // retry bump
  const loadingMore = useRef(false);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // Deck state — presets, sort, judgments, undo.
  const [servicesOn, setServicesOn] = useState(true); // "On my services" composes
  // Chips are MULTI-SELECT and compose (owner directive 2026-07-18b); only
  // "bold" is exclusive — it swaps the source (me_recommend_wwi) instead of
  // filtering the shared engine, so it can't intersect with server presets.
  const [presets, setPresets] = useState<ReadonlySet<DeckPreset>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("ts");
  const [eraKey, setEraKey] = useState<EraKey>("all");
  const [picker, setPicker] = useState<null | "sort" | "era">(null);
  // Taste is the source swap (me_recommend_wwi), now an explicit opt-in the app
  // remembers (owner 07-30) rather than a chip that resets every launch.
  const bold = taste;
  const presetParam = [...presets].filter((p) => p !== "bold").sort().join(",");
  // v11 tokens bake direction into "newest"/"oldest" — never send sort=year.
  const sortArgs = { sort: SORT_TOKEN[sortKey] };
  const rankCap = RANK_CAP[sortKey] ?? null;
  // Era floor (owner 07-30: pre-2000 films were permanently squatting the top).
  const yearMin = ERA_YEAR[eraKey];
  const [judged, setJudged] = useState(0);
  const [undoItem, setUndoItem] = useState<UndoItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reasonBySlug, setReasonBySlug] = useState<Map<string, string>>(new Map());
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hide-seen defaults ON when a session exists (§5.2); toggling still mirrors
  // the stored pref so other surfaces stay in step.
  const [seenOverride, setSeenOverride] = useState<boolean | null>(null);
  const hideSeenEff = seenOverride ?? (session ? true : hideSeen);

  const hasProviders = providerIds.length > 0;
  const needsServices = servicesOn && !hasProviders && !bold;
  const uid = session?.user?.id ?? null;

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  // "Bold pick" swaps the source to the auth-scoped me_recommend_wwi; on sign-out its
  // chip hides but the preset would linger and fetch an empty anonymous deck — drop it.
  useEffect(() => {
    if (!session) setPresets((p) => (p.has("bold") ? new Set([...p].filter((x) => x !== "bold")) : p));
  }, [session]);

  const fetchDeck = useCallback(async (): Promise<{ rows: DeckRow[]; total: number }> => {
    if (bold) {
      const wwi = await me.recommendCached(0.6, 60);
      const mapped = wwi.map(deckRowFromWwi);
      return { rows: mapped, total: mapped.length };
    }
    const p = await api.tonight(country, servicesOn ? providerIds : [], {
      ...(yearMin ? { yearMin } : {}),
      ...(presetParam ? { preset: presetParam } : {}),
      ...sortArgs,
    });
    return { rows: p.rows, total: p.total };
  }, [bold, presetParam, sortArgs.sort, yearMin, country, servicesOn, providerIds]);

  // Initial load (and reload on country/services/preset change or retry).
  useEffect(() => {
    if (!ready || !onboarded || needsServices) return;
    let alive = true;
    setStatus("loading");
    fetchDeck()
      .then((p) => {
        if (!alive) return;
        setRows(p.rows);
        setTotal(p.total);
        setFetched(p.rows.length);
        setStatus("idle");
      })
      .catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
    };
  }, [ready, onboarded, needsServices, fetchDeck, gen]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (bold) me.invalidateRecommend(); // fresh λ=0.6 pull
    fetchDeck()
      .then((p) => {
        setRows(p.rows);
        setTotal(p.total);
        setFetched(p.rows.length);
        setStatus("idle");
      })
      .catch(() => setStatus("error"))
      .finally(() => setRefreshing(false));
  }, [fetchDeck, bold]);

  const loadMore = useCallback(() => {
    if (bold) return; // fixed 60-row source, no pagination
    if (loadingMore.current || status !== "idle" || refreshing) return;
    if (fetched >= total) return;
    loadingMore.current = true;
    api
      .tonight(country, servicesOn ? providerIds : [], {
        ...(yearMin ? { yearMin } : {}),
        offset: fetched,
        ...(presetParam ? { preset: presetParam } : {}),
        ...sortArgs,
      })
      .then((p) => {
        setTotal(p.total);
        setFetched((n) => n + p.rows.length);
        setRows((prev) => {
          const have = new Set(prev.map((r) => r.slug));
          return [...prev, ...p.rows.filter((r) => !have.has(r.slug))];
        });
      })
      .catch(() => {})
      .finally(() => {
        loadingMore.current = false;
      });
  }, [bold, presetParam, sortArgs.sort, rankCap, yearMin, status, refreshing, fetched, total, country, servicesOn, providerIds]);

  // Reason chips (session only) — one server-supplied reason per matching card.
  // Bold rows carry their own reason from the λ=0.6 pull (§13-17: no fabrication).
  useEffect(() => {
    if (!uid) {
      setReasonBySlug(new Map());
      return;
    }
    let alive = true;
    me.recommendCached(1.0).then((wwi) => {
      if (!alive) return;
      const m = new Map<string, string>();
      for (const w of wwi) if (w.reasons && w.reasons[0]) m.set(w.slug, w.reasons[0]);
      setReasonBySlug(m);
    });
    return () => {
      alive = false;
    };
  }, [uid, gen]);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);

  const showUndo = useCallback((item: UndoItem) => {
    setUndoItem(item);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndoItem(null), UNDO_MS);
  }, []);

  /** The one judgment door for the whole deck — buttons and swipes both land here. */
  const judge = useCallback(
    async (row: DeckRow, kind: JudgeKind) => {
      if (!session) {
        showNotice(t("judge.signInToKeep"));
        // Straight to the sign-in form — the notice promises sign-in, so never
        // land the user on the country/services steps (they'd bounce).
        router.push({ pathname: "/onboarding", params: { step: "account" } });
        return;
      }
      const at = rowsRef.current.findIndex((r) => r.slug === row.slug);
      const index = at >= 0 ? at : 0;
      setRows((prev) => prev.filter((r) => r.slug !== row.slug));
      setJudged((n) => n + 1);
      const token =
        kind === "want"
          ? await setWatchlist(row.slug, true)
          : kind === "pass"
            ? await dismiss(row.slug)
            : await markSeen(row.slug);
      if (!token) {
        // RPC failed (ledger already rolled back) — put the card back.
        setRows((prev) => (prev.some((r) => r.slug === row.slug) ? prev : insertAt(prev, index, row)));
        return;
      }
      void noteJudged(row.slug);
      me.invalidateRecommend();
      showUndo({ token, row, index, kind });
    },
    [session, router, setWatchlist, dismiss, markSeen, showNotice, showUndo],
  );

  const onUndo = useCallback(async () => {
    const item = undoItem;
    if (!item) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoItem(null);
    await undo(item.token);
    setRows((prev) =>
      prev.some((r) => r.slug === item.row.slug) ? prev : insertAt(prev, item.index, item.row),
    );
    me.invalidateRecommend();
  }, [undoItem, undo]);

  const togglePreset = useCallback((k: DeckPreset) => {
    setPresets((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }, []);

  /** Taste opt-in: swaps the deck to the personal ranking, and remembers it. */
  const toggleTaste = useCallback(() => {
    const next = !taste;
    if (next) setPresets(new Set()); // the personal source can't intersect server presets
    set({ taste: next });
  }, [taste, set]);

  // visible + the hide-seen pagination effect MUST run before the early returns below —
  // React hooks can never be called conditionally. visible depends only on rows/ledger/prefs.
  const visible = (rankCap ? rows.slice(0, rankCap) : rows).filter((r) => {
    const e = ledger.get(r.slug);
    if (e?.dismissed) return false; // always hide passed films
    if (hideSeenEff && session && e?.seen) return false;
    return true;
  });
  // Hide-seen can filter the whole fetched page to empty while the deeper catalog is
  // still unpulled; RN never fires onEndReached on an empty list, so pull the next page
  // here to avoid a premature "Deck cleared". loadMore self-guards against over-fetching.
  useEffect(() => {
    if (status === "idle" && !bold && visible.length === 0 && fetched < total) loadMore();
  }, [status, bold, visible.length, fetched, total, loadMore]);

  if (ready && !onboarded) return <Redirect href="/onboarding" />;
  if (!ready) return <Loading />;

  const edition = EDITIONS[country] ?? DEFAULT_EDITION;

  // Header — pill search, title row, then the situation preset chips (§5.2).
  const header = (
    <View
      style={{
        paddingTop: insets.top + sp.s3,
        paddingBottom: sp.s3,
        backgroundColor: pal.bg,
        // Rides inside the padded FlatList as its ListHeader — restore full-bleed so
        // the chip rows still run edge to edge.
        marginHorizontal: -sp.s4,
      }}
    >
      {/* ONE-line masthead (owner 07-29: the controls were burying the deck — compact
          hard so 2–3 more film rows show). Wordmark + search disc + the two halves of
          "what can I watch": country and services (owner 07-30 — 국적과 서비스 모두).
          Every mood/sort filter lives in the single combined row below. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: sp.s4 }}>
        <View style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          {/* Two chips + the search disc now share this row, so the wordmark steps down
              on SE-class widths rather than letting anything clip. */}
          <Wordmark size={width < 390 ? fs.base : fs.lg} />
        </View>
        <HeaderSearch onPress={() => router.push("/search")} />
        {/* Country = a quiet flag pill: auto-detected, rarely changed, and the flag reads
            in every locale (a code + label would push the services chip off narrow
            phones). flexShrink 0 so the wordmark, not the controls, absorbs tight rows. */}
        <View style={{ flexShrink: 0 }}>
          <Chip
            label={edition.flag}
            accessibilityLabel={`${t("my.country")}: ${edition.label}`}
            onPress={() =>
              router.push({ pathname: "/onboarding", params: { step: "country" } })
            }
          />
        </View>
        <View style={{ flexShrink: 0 }}>
          <Chip
            label={
              providerIds.length
                ? t("tonight.myServices", { n: providerIds.length })
                : t("tonight.pickServices")
            }
            icon="tv-outline"
            active={providerIds.length > 0}
            onPress={() =>
              router.push({ pathname: "/onboarding", params: { step: "services" } })
            }
          />
        </View>
      </View>
      {/* ONE control row — the app's navigational heart (owner 07-29/07-30).
          Read left to right it states the query: how it's RANKED, over WHICH
          YEARS, then the moods that narrow it. Sort and era are pickers rather
          than eight competing pills: two chips instead of eight, and the live
          setting is legible instead of inferred from which pill is filled. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: sp.s2 }}
        contentContainerStyle={{ paddingHorizontal: sp.s4, gap: sp.s2, alignItems: "center" }}
      >
        <PickerChip
          label={t("sort.label")}
          value={t(SORT_COPY[sortKey])}
          icon="swap-vertical"
          active={sortKey !== "ts"}
          onPress={() => setPicker("sort")}
        />
        <PickerChip
          label={t("era.label")}
          value={eraKey === "all" ? t("era.all") : t("era.sinceShort", { y: eraKey })}
          icon="calendar-outline"
          active={eraKey !== "all"}
          onPress={() => setPicker("era")}
        />
        <View style={{ width: StyleSheet.hairlineWidth, height: 18, backgroundColor: pal.hairline2 }} />
        <Chip
          label={t("preset.onMyServices")}
          active={servicesOn}
          onPress={() => setServicesOn((v) => !v)}
        />
        {session ? (
          <Chip
            label={t("taste.chip")}
            icon="sparkles-outline"
            active={taste}
            onPress={toggleTaste}
          />
        ) : null}
        {session ? (
          <Chip
            label={t("tonight.hideSeen")}
            icon="eye-off-outline"
            active={hideSeenEff}
            onPress={() => {
              const next = !hideSeenEff;
              setSeenOverride(next);
              set({ hideSeen: next });
            }}
          />
        ) : null}
        {/* Mood presets filter the shared engine, so they're meaningless while the
            personal source is driving — hidden rather than shown-but-dead. */}
        {!bold ? (
          <>
            <Chip label={t("preset.safeBet")} active={presets.has("safe")} onPress={() => togglePreset("safe")} />
            <Chip label={t("preset.hiddenGems")} active={presets.has("gems")} onPress={() => togglePreset("gems")} />
            <Chip
              label={t("preset.freshCentury")}
              active={presets.has("century")}
              onPress={() => togglePreset("century")}
            />
            <Chip label={t("preset.ninety")} active={presets.has("ninety")} onPress={() => togglePreset("ninety")} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );

  const pickers = (
    <>
      <PickerSheet
        visible={picker === "sort"}
        title={t("sort.label")}
        selected={sortKey}
        onClose={() => setPicker(null)}
        onSelect={(k) => setSortKey(k as SortKey)}
        options={(["ts", "ts100", "ts500", "ts1000", "new", "old", "alpha"] as SortKey[]).map((k) => ({
          key: k,
          label: t(SORT_COPY[k]),
        }))}
      />
      <PickerSheet
        visible={picker === "era"}
        title={t("era.label")}
        selected={eraKey}
        onClose={() => setPicker(null)}
        onSelect={(k) => setEraKey(k as EraKey)}
        options={(["all", "1980", "2000", "2010", "2020"] as EraKey[]).map((k) => ({
          key: k,
          label: k === "all" ? t("era.all") : t("era.since", { y: k }),
        }))}
      />
    </>
  );

  // Floating layer — one undo pill (most recent judgment) + transient notices.
  const floaters = (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: insets.bottom + 76, // clears the absolute blurred tab bar
        alignItems: "center",
        gap: sp.s2,
      }}
    >
      {undoItem ? (
        <UndoPill
          label={t(
            undoItem.kind === "want"
              ? "judge.kept"
              : undoItem.kind === "pass"
                ? "judge.passed"
                : "judge.seenMarked",
          )}
          actionLabel={t("judge.undo")}
          onUndo={() => void onUndo()}
        />
      ) : null}
      {notice ? (
        <View
          style={[
            {
              borderRadius: radius.pill,
              paddingHorizontal: sp.s4,
              paddingVertical: 10,
              backgroundColor: pal.ink,
            },
            shadow.float,
          ]}
        >
          <Ui size={fs.sm} color={pal.bg} numberOfLines={1} style={{ maxWidth: 280 }}>
            {notice}
          </Ui>
        </View>
      ) : null}
    </View>
  );

  // No services picked yet (services chip on) → point at the services step.
  if (needsServices)
    return (
      <Screen>
        <View style={{ paddingHorizontal: sp.s4 }}>{header}</View>
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
        {floaters}
        {pickers}
      </Screen>
    );

  if (status === "error" && rows.length === 0)
    return (
      <Screen>
        <View style={{ paddingHorizontal: sp.s4 }}>{header}</View>
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: sp.s4 }}
        >
          <Ui color={pal.muted}>{t("error.network")}</Ui>
          <Btn label={t("action.retry")} onPress={() => setGen((g) => g + 1)} />
        </View>
        {floaters}
        {pickers}
      </Screen>
    );

  if (status === "loading" && rows.length === 0)
    return (
      <Screen>
        <View style={{ paddingHorizontal: sp.s4 }}>{header}</View>
        <SkeletonScreen kind="split" />
        {floaters}
        {pickers}
      </Screen>
    );

  const canLoadMore = !bold && fetched < total && (rankCap == null || fetched < rankCap);

  return (
    <Screen>
      {/* Masthead + filters ride INSIDE the list (owner 07-29: chrome must scroll away
          dynamically — films own the screen once you start browsing). */}
      <FlatList
        data={visible}
        keyExtractor={(item) => item.slug}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => (
          <Appear index={index}>
            <LobbyCard
              row={item}
              screenW={width}
              reason={item.reason ?? reasonBySlug.get(item.slug) ?? null}
              onJudge={judge}
              featured={index === 0}
            />
          </Appear>
        )}
        contentContainerStyle={{
          paddingHorizontal: sp.s4,
          paddingTop: sp.s3,
          paddingBottom: 120, // clears the absolute blurred tab bar
        }}
        ItemSeparatorComponent={() => <View style={{ height: sp.s3 }} />}
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
            <View style={{ paddingVertical: sp.s5, alignItems: "center" }}>
              <Dots />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={{ paddingVertical: sp.s7, alignItems: "center" }}>
            <Ui size={fs.sm} color={pal.muted}>
              {judged > 0 ? t("tonight.deckCleared") : t("tonight.emptyFiltered")}
            </Ui>
          </View>
        }
      />
      {floaters}
      {pickers}
    </Screen>
  );
}

// ---------------------------------------------------------------------------

/** Quiet circular judgment button — never gradient (the deck's low-key verbs). */
function JudgeDot({
  icon,
  label,
  onPress,
  tint,
  celebrate = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  tint?: string;
  /** Burst on the transition into the "on" state (the heart, the tick). */
  celebrate?: boolean;
}) {
  const pal = usePalette();
  return (
    <View>
      {celebrate ? <Sparkle trigger={!!tint} color={tint ?? pal.ink} radius={26} /> : null}
      <Tactile onPress={onPress} hitSlop={6} feedback="press">
        {/* Re-keyed on the glyph so the verb lands with a spring, not a swap. */}
        <Pop key={`${icon}-${tint ?? ""}`}>
          <View
            accessibilityRole="button"
            accessibilityLabel={label}
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pal.card,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: tint ?? pal.hairline2,
            }}
          >
            <Ionicons name={icon} size={18} color={tint ?? pal.ink} />
          </View>
        </Pop>
      </Tactile>
    </View>
  );
}

/** The signature lobby card, now a triage card — Lava grammar kept: rounded
 * image, TSBadge bottom-left, heart top-right, sans title, serif italic lead.
 * v4 adds the three quiet verbs + horizontal swipe (right = want, left = pass). */
function LobbyCard({
  row,
  screenW,
  reason,
  onJudge,
  featured = false,
}: {
  row: DeckRow;
  screenW: number;
  reason: string | null;
  onJudge: (row: DeckRow, kind: JudgeKind) => void;
  /** The card being pitched right now — it wears a live accent ring. */
  featured?: boolean;
}) {
  const pal = usePalette();
  const router = useRouter();
  const { session, ledger } = useFilms();
  const cardW = screenW - sp.s4 * 2;
  // Split row card (owner directive 2026-07-18b): portrait poster LEFT at its
  // natural 2:3 — never cropped — info RIGHT. A full-width 2:3 card made the
  // triage scroll too expensive; ~3-4 of these rows fit a screen instead.
  const posterW = 116;
  const posterH = Math.round(posterW * 1.5);
  const entry = ledger.get(row.slug);
  const inWatchlist = !!entry?.watchlist;
  const seen = !!entry?.seen;

  // Swipe machinery — PanResponder + core Animated (no extra deps). All dynamic
  // values live in refs so the once-created responder never goes stale.
  const pan = useRef(new Animated.Value(0)).current;
  const leaving = useRef(false);
  const judgeRef = useRef(onJudge);
  judgeRef.current = onJudge;
  const rowRef = useRef(row);
  rowRef.current = row;
  const sessionRef = useRef(!!session);
  sessionRef.current = !!session;
  const screenWRef = useRef(screenW);
  screenWRef.current = screenW;

  const back = useCallback(() => {
    Animated.spring(pan, { toValue: 0, friction: 7, useNativeDriver: false }).start();
  }, [pan]);

  const fly = useCallback(
    (dir: 1 | -1, kind: JudgeKind) => {
      if (leaving.current) return;
      leaving.current = true;
      // A swiped judgment gets the same buzz a tapped one does.
      haptic.press();
      Animated.timing(pan, {
        toValue: dir * screenWRef.current * 1.2,
        duration: 200,
        useNativeDriver: false,
      }).start(() => judgeRef.current(rowRef.current, kind));
    },
    [pan],
  );

  /** Button/heart door: signed-out attempts skip the fly-out (screen routes to sign-in). */
  const act = useCallback(
    (kind: JudgeKind) => {
      if (!sessionRef.current) {
        judgeRef.current(rowRef.current, kind);
        return;
      }
      fly(kind === "pass" ? -1 : 1, kind);
    },
    [fly],
  );

  const responderRef = useRef<PanResponderInstance | null>(null);
  if (!responderRef.current) {
    const isHorizontal = (_e: unknown, g: { dx: number; dy: number }) =>
      Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4;
    responderRef.current = PanResponder.create({
      onMoveShouldSetPanResponder: isHorizontal,
      onMoveShouldSetPanResponderCapture: isHorizontal,
      onPanResponderMove: (_e, g) => pan.setValue(g.dx),
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_e, g) => {
        const th = screenWRef.current * 0.3;
        if (g.dx > th) {
          if (sessionRef.current) fly(1, "want");
          else {
            back();
            judgeRef.current(rowRef.current, "want");
          }
        } else if (g.dx < -th) {
          if (sessionRef.current) fly(-1, "pass");
          else {
            back();
            judgeRef.current(rowRef.current, "pass");
          }
        } else back();
      },
      onPanResponderTerminate: () => back(),
    });
  }
  const responder = responderRef.current;

  const rotate = pan.interpolate({
    inputRange: [-screenW, 0, screenW],
    outputRange: ["-6deg", "0deg", "6deg"],
  });
  // Emphasis motion (owner 07-30): the border answers the gesture — it warms to
  // the Lava accent as you pull right to keep, greys as you pull left to pass,
  // and the pitched card rests inside a soft accent ring so the eye knows which
  // film it is being asked about.
  const swipeSpan = Math.max(1, screenW * 0.3);
  const borderColor = pan.interpolate({
    inputRange: [-swipeSpan, 0, swipeSpan],
    outputRange: ["rgba(138,143,152,0.95)", featured ? `${brand.accent}66` : pal.hairline, brand.accent],
    extrapolate: "clamp",
  });
  const keepOpacity = pan.interpolate({
    inputRange: [12, swipeSpan],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const passOpacity = pan.interpolate({
    inputRange: [-swipeSpan, -12],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      {...responder.panHandlers}
      style={{ transform: [{ translateX: pan }, { rotate }] }}
    >
      <Tactile
        onPress={() => router.push({ pathname: "/film/[slug]", params: { slug: row.slug } })}
      >
        <Animated.View
          style={[
            {
              width: cardW,
              flexDirection: "row",
              backgroundColor: pal.card,
              borderRadius: radius.md,
              overflow: "hidden",
              borderWidth: featured ? 1.5 : StyleSheet.hairlineWidth,
              borderColor,
            },
            shadow.card,
          ]}
        >
          {/* Left — portrait poster at its natural 2:3, never cropped */}
          <View style={{ width: posterW, minHeight: posterH }}>
            <PosterImg path={row.poster_path} width={posterW} height={posterH} size="w342" rounded={0} />
            {row.ts != null ? (
              <View style={{ position: "absolute", bottom: sp.s2, left: sp.s2 }}>
                <TSBadge ts={row.ts} onImage size={fs.xs + 1} />
              </View>
            ) : null}
          </View>
          {/* Right — the judgment column */}
          <View style={{ flex: 1, padding: sp.s3, justifyContent: "space-between", gap: sp.s1 }}>
            <View>
              <Ui size={fs.md} weight="600" numberOfLines={2}>
                {row.title}
              </Ui>
              <View style={{ flexDirection: "row", alignItems: "center", gap: sp.s2, marginTop: 2 }}>
                <Ui size={fs.sm} color={pal.muted} numberOfLines={1} style={{ flexShrink: 1 }}>
                  {[row.year, row.director].filter(Boolean).join(" · ")}
                </Ui>
                <AvailabilityDots tiers={row.tiers} />
              </View>
              {row.lead ? (
                <Serif
                  size={fs.sm + 1}
                  italic
                  color={pal.inkSoft}
                  numberOfLines={2}
                  style={{ marginTop: sp.s1 }}
                >
                  {row.lead}
                </Serif>
              ) : null}
              {reason ? (
                <View style={{ flexDirection: "row", marginTop: sp.s2 }}>
                  <ReasonChip label={reason} />
                </View>
              ) : null}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: sp.s3, marginTop: sp.s2 }}>
              <JudgeDot
                icon={inWatchlist ? "heart" : "heart-outline"}
                tint={inWatchlist ? brand.accent : undefined}
                label={t("judge.want")}
                onPress={() => act("want")}
                celebrate
              />
              <JudgeDot icon="close" label={t("judge.pass")} onPress={() => act("pass")} />
              <JudgeDot
                icon={seen ? "checkmark-circle" : "checkmark"}
                tint={seen ? brand.teal : undefined}
                label={t("judge.seenIt")}
                onPress={() => act("seen")}
                celebrate
              />
            </View>
          </View>
          {/* Verdict watermarks — they arrive with the pull, not after it. */}
          <Animated.View
            pointerEvents="none"
            style={{ position: "absolute", top: sp.s2, right: sp.s2, opacity: keepOpacity }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                borderRadius: radius.pill,
                paddingHorizontal: 10,
                paddingVertical: 5,
                backgroundColor: brand.accent,
              }}
            >
              <Ionicons name="heart" size={13} color={brand.accentInk} />
              <Ui size={fs.xs} weight="700" color={brand.accentInk}>
                {t("judge.want")}
              </Ui>
            </View>
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={{ position: "absolute", top: sp.s2, right: sp.s2, opacity: passOpacity }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                borderRadius: radius.pill,
                paddingHorizontal: 10,
                paddingVertical: 5,
                backgroundColor: pal.ink,
              }}
            >
              <Ionicons name="close" size={13} color={pal.bg} />
              <Ui size={fs.xs} weight="700" color={pal.bg}>
                {t("judge.pass")}
              </Ui>
            </View>
          </Animated.View>
        </Animated.View>
      </Tactile>
    </Animated.View>
  );
}
