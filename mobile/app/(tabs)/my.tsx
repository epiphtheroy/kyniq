// YOU tab — the film ledger (owner 2026-08-03 rebuild).
//
// What this screen is now: MY films, and nothing else. Tonight, Explore and the
// Navigator all recommend; You used to recommend too (a queue headline, a
// "Deciding" rail, a blindspot nudge), which made it the fourth copy of the same
// idea. It is now the only surface that answers "what have I actually watched,
// what did I promise to watch, and what did I think of it?"
//
// Shape: four faces of the SAME ledger row (public.user_movies) as tabs —
//   Watched (seen) · Watchlist (watchlist) · Rated (seen ∧ rating) · Passed (dismissed)
// then a strip of very small sort switches (tap the active one to flip
// direction), then a three-up poster grid where every cell carries the two
// numbers that matter side by side: the TakeScore and MY stars.
//
// Data: me_collection / me_watchlist_scored are existing RPCs; Passed has no RPC
// so api.passed() reads the own rows. TakeScore = round(V − R): me_collection
// already returns it as `u`, the other two get it from takescore_for_slugs.
// Rating/seen/watchlist are read through the ledger (optimistic) so a judgment
// made anywhere in the app is visible here before any refetch.
//
// ALL settings (edition, services, notifications, account, in-app deletion —
// Apple 5.1.1(v)) still live behind the top-right gear.
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { type Href, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AvailabilityDots,
  Btn,
  GradientBtn,
  Hairline,
  HeaderSearch,
  PosterImg,
  SectionTitle,
  Serif,
  Tactile,
  Ui,
  UndoPill,
} from "../../src/components/ui";
import { MiniStars, useRate } from "../../src/components/RateSheet";
import { METATAKE_BASE } from "../../src/config";
import { ALL_EDITIONS, langLabel } from "../../src/editions";
import { Appear } from "../../src/components/motion";
import SignInPanel from "../../src/components/SignInPanel";
import { t } from "../../src/i18n";
import type { DictKey } from "../../src/i18n";
import { api, me } from "../../src/lib/api";
import { registerPush } from "../../src/lib/push";
import { useLocalTitles } from "../../src/lib/titles";
import { supabase } from "../../src/lib/supabase";
import {
  type Age,
  ageColor,
  ageOf,
  verdictColor,
  verdictOf,
} from "../../src/lib/verdict";
import { useFilms, type JudgmentUndo } from "../../src/state/films";
import { usePrefs } from "../../src/state/prefs";
import { brand, fs, gradient, radius, sp, usePalette } from "../../src/theme";
import type { CollectionRow, PassedRow, WatchlistScoredRow } from "../../src/types";

// Connect hub route (HANDOFF-커넥트 §2.1).
const CONNECT_HREF = "/connect" as Href;

// Hairline inset for grouped settings rows: 16 padding + 32 icon disc + 12 gap.
const ROW_INSET = 60;

// ---------------------------------------------------------------------------
// The four faces of the ledger, and how each one sorts.

type Face = "watched" | "queue" | "rated" | "passed";
type SortKey = "recent" | "rating" | "ts" | "gap" | "year" | "title" | "services";

const FACES: { key: Face; label: DictKey }[] = [
  { key: "watched", label: "you.tab.watched" },
  { key: "queue", label: "you.tab.queue" },
  { key: "rated", label: "you.tab.rated" },
  { key: "passed", label: "you.tab.passed" },
];

/** Sort switches per face — first entry is that face's default. */
const SORTS: Record<Face, SortKey[]> = {
  watched: ["recent", "rating", "ts", "gap", "year", "title"],
  queue: ["recent", "services", "ts", "year", "title"],
  rated: ["rating", "recent", "ts", "gap", "year", "title"],
  passed: ["recent", "ts", "year", "title"],
};

function sortLabel(key: SortKey, face: Face): DictKey {
  // On the watchlist "recent" means when you promised, not when you watched —
  // and flipping it is the "how long has this been waiting?" question.
  if (key === "recent") return face === "queue" ? "you.sort.added" : "you.sort.recent";
  return (`you.sort.${key}` as DictKey);
}

/** One grid tile — the shape every face is normalized into. */
type Cell = {
  slug: string;
  title: string;
  year: number | null;
  posterPath: string | null;
  /** TakeScore (V − R), the shared axis. */
  ts: number | null;
  /** MY rating, ledger-corrected. */
  rating: number | null;
  /** Canon Standing — turns a rating into a Find/Aligned/Letdown verdict. */
  standing: number | null;
  /** Sort timestamp: watched_at for seen rows, added_at for the rest. */
  at: number;
  /** Watchlist only: availability. */
  tiers: string[];
  onMine: boolean;
  age: Age | null;
};

function sortValue(c: Cell, k: SortKey): number | string {
  switch (k) {
    case "recent":
      return c.at;
    case "rating":
      return c.rating ?? -1;
    case "ts":
      return c.ts ?? -1;
    case "gap":
      // The /room gap: how far MY verdict sits from the canon's. High = a find.
      return c.rating != null && c.standing != null ? c.rating * 20 - c.standing : -9999;
    case "year":
      return c.year ?? -1;
    case "services":
      return c.onMine ? 1 : 0;
    case "title":
      return c.title.toLocaleLowerCase();
  }
}

function sortCells(cells: Cell[], key: SortKey, flipped: boolean): Cell[] {
  const out = [...cells];
  out.sort((a, b) => {
    const av = sortValue(a, key);
    const bv = sortValue(b, key);
    // Text sorts A→Z by default; every number sorts high-first. Either way the
    // default direction is the one you'd have asked for.
    let r =
      typeof av === "string" || typeof bv === "string"
        ? String(av).localeCompare(String(bv))
        : (bv as number) - (av as number);
    if (flipped) r = -r;
    // Deterministic tail, so equal values never shuffle between renders.
    if (r === 0) r = b.at - a.at || a.slug.localeCompare(b.slug);
    return r;
  });
  return out;
}

/** Which way the caret points for the current key + flip. */
function caret(key: SortKey, flipped: boolean): string {
  const down = key === "title" ? flipped : !flipped;
  return down ? "↓" : "↑";
}

// ---------------------------------------------------------------------------

export default function YouScreen() {
  const pal = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const prefs = usePrefs();
  const { width } = useWindowDimensions();
  const { session, ledger, undismiss, undo, reload } = useFilms();
  const { promptRate } = useRate();

  const [showSettings, setShowSettings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [face, setFace] = useState<Face>("watched");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [flipped, setFlipped] = useState(false);

  const [collection, setCollection] = useState<CollectionRow[] | null>(null);
  const [queue, setQueue] = useState<WatchlistScoredRow[] | null>(null);
  const [passed, setPassed] = useState<PassedRow[] | null>(null);
  const [tsMap, setTsMap] = useState<Map<string, number>>(new Map());
  const [tiers, setTiers] = useState<Map<string, string[]>>(new Map());
  const [mine, setMine] = useState<Set<string>>(new Set());

  const [undoTok, setUndoTok] = useState<JudgmentUndo | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<FlatList<Cell>>(null);

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
    const uid = session?.user?.id;
    if (!uid) {
      setCollection(null);
      setQueue(null);
      setPassed(null);
      setTsMap(new Map());
      setTiers(new Map());
      setMine(new Set());
      return;
    }
    const [coll, q, ps] = await Promise.all([
      me.collection().catch(() => [] as CollectionRow[]),
      me.watchlistScored().catch(() => [] as WatchlistScoredRow[]),
      me.passed(uid).catch(() => [] as PassedRow[]),
    ]);
    if (!alive.current) return;
    setCollection(coll);
    setQueue(q);
    setPassed(ps);

    // me_collection already carries the TakeScore as `u`; only the other two
    // faces need the bulk score RPC (the standard bulk door, HANDOFF §13).
    const needTs = [...new Set([...q.map((r) => r.slug), ...ps.map((r) => r.slug)])];
    if (needTs.length) {
      const merged = new Map<string, number>();
      for (let i = 0; i < needTs.length; i += 400) {
        const part = await api.takescores(needTs.slice(i, i + 400)).catch(() => new Map());
        for (const [k, v] of part) merged.set(k, v);
      }
      if (alive.current) setTsMap(merged);
    } else if (alive.current) {
      setTsMap(new Map());
    }

    // Availability decorates the watchlist face only.
    const qSlugs = q.map((r) => r.slug).slice(0, 120);
    if (!qSlugs.length) {
      if (alive.current) {
        setTiers(new Map());
        setMine(new Set());
      }
      return;
    }
    try {
      const tiersMap = await api.availability(qSlugs, prefs.country);
      let mineSet: Set<string>;
      if (prefs.providerIds.length) {
        const { data, error } = await supabase.rpc("film_availability", {
          p_slugs: qSlugs,
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
        mineSet = new Set([...tiersMap.entries()].filter(([, v]) => v.length > 0).map(([k]) => k));
      }
      if (!alive.current) return;
      setTiers(tiersMap);
      setMine(mineSet);
    } catch {
      // Availability unknown → show nothing rather than a fake "not available".
      if (!alive.current) return;
      setTiers(new Map());
      setMine(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, prefs.country, providersKey]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([reload(), fetchAll()]);
    setRefreshing(false);
  };

  // ---- Ledger-corrected faces ----------------------------------------------
  // The ledger holds every user_movies row, so it — not the fetched snapshot —
  // decides membership and rating. A judgment made on any screen shows up here
  // immediately, and a stale snapshot can never resurrect a film you just passed.
  const faces = useMemo(() => {
    const watched: Cell[] = [];
    for (const r of collection ?? []) {
      const e = ledger.get(r.slug);
      if (e && !e.seen) continue;
      watched.push({
        slug: r.slug,
        title: r.title,
        year: r.year,
        posterPath: r.poster_path,
        ts: r.u,
        rating: e ? e.rating : r.rating,
        standing: r.prestige,
        at: Date.parse(r.added_at ?? "") || 0,
        tiers: [],
        onMine: false,
        age: null,
      });
    }
    const q: Cell[] = [];
    for (const r of queue ?? []) {
      const e = ledger.get(r.slug);
      if (e && (!e.watchlist || e.dismissed)) continue;
      const derived = r.v != null && r.r != null ? Math.round(r.v - r.r) : null;
      q.push({
        slug: r.slug,
        title: r.title,
        year: r.year,
        posterPath: r.poster_path,
        ts: tsMap.get(r.slug) ?? derived,
        rating: e ? e.rating : r.rating,
        standing: null,
        at: Date.parse(r.added_at ?? "") || 0,
        tiers: tiers.get(r.slug) ?? [],
        onMine: mine.has(r.slug),
        age: ageOf(r.added_at),
      });
    }
    const ps: Cell[] = [];
    for (const r of passed ?? []) {
      const e = ledger.get(r.slug);
      if (e && !e.dismissed) continue;
      ps.push({
        slug: r.slug,
        title: r.title,
        year: r.year,
        posterPath: r.poster_path,
        ts: tsMap.get(r.slug) ?? null,
        rating: e ? e.rating : r.rating,
        standing: null,
        at: Date.parse(r.added_at ?? "") || 0,
        tiers: [],
        onMine: false,
        age: null,
      });
    }
    return {
      watched,
      queue: q,
      rated: watched.filter((c) => c.rating != null),
      passed: ps,
    };
  }, [collection, queue, passed, ledger, tsMap, tiers, mine]);

  const rows = useMemo(
    () => sortCells(faces[face], sortKey, flipped),
    [faces, face, sortKey, flipped],
  );

  // Localized titles for exactly what this face is about to paint (migration
  // 0121). English short-circuits to a no-op.
  const titleOf = useLocalTitles(useMemo(() => rows.map((r) => r.slug), [rows]));

  // Verdict recap — the /room vocabulary, kept as one line on the Rated face
  // instead of the zone it used to own.
  const verdictCounts = useMemo(() => {
    const n = { find: 0, aligned: 0, letdown: 0 };
    for (const c of faces.rated) {
      const v = verdictOf(c.rating, c.standing);
      if (v) n[v] += 1;
    }
    return n;
  }, [faces.rated]);

  const pickFace = (next: Face) => {
    if (next === face) return;
    setFace(next);
    setSortKey(SORTS[next][0]);
    setFlipped(false);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const pickSort = (key: SortKey) => {
    // Tapping the live switch flips it — that is the whole direction control,
    // and it keeps the strip to one row of very small labels.
    if (key === sortKey) setFlipped((f) => !f);
    else {
      setSortKey(key);
      setFlipped(false);
    }
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  const showUndo = (tok: JudgmentUndo) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoTok(tok);
    undoTimer.current = setTimeout(() => setUndoTok(null), 6000);
  };

  const onRestore = async (slug: string) => {
    const tok = await undismiss(slug);
    if (tok) {
      showUndo(tok);
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

  const onRateCell = (c: Cell) => {
    promptRate({
      slug: c.slug,
      title: c.title,
      year: c.year,
      posterPath: c.posterPath,
      standing: c.standing,
      // A film rated from the watchlist becomes seen — refetch so it moves faces.
      onDone: (v) => {
        if (v != null) void fetchAll();
      },
    });
  };

  // ---- Grid geometry --------------------------------------------------------
  const GAP = 10;
  const cellW = Math.floor((width - sp.s4 * 2 - GAP * 2) / 3);

  const emptyKey: DictKey =
    face === "watched"
      ? "you.empty.watched"
      : face === "queue"
        ? "you.empty.queue"
        : face === "rated"
          ? "you.empty.rated"
          : "you.empty.passed";

  const loaded = collection !== null;

  const header = (
    <View>
      {/* Masthead */}
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

      {/* One quiet line of counts, then the edition/import row the owner asked to
          keep in the open (07-29) — compressed to chips so the grid starts high. */}
      <Ui size={fs.sm} color={pal.muted} style={{ paddingHorizontal: sp.s4, marginTop: 2 }}>
        {t("you.stats", {
          seen: faces.watched.length,
          queue: faces.queue.length,
          rated: faces.rated.length,
        })}
      </Ui>
      <View
        style={{
          flexDirection: "row",
          gap: sp.s2,
          paddingHorizontal: sp.s4,
          marginTop: sp.s3,
        }}
      >
        {/* Country and services are one question and now one chip (owner 08-03). */}
        <MetaChip
          icon="globe-outline"
          label={`${prefs.country} · ${prefs.providerIds.length}`}
          onPress={() => router.push({ pathname: "/onboarding", params: { step: "edition" } })}
        />
        <MetaChip
          icon="language-outline"
          label={langLabel(prefs.contentLang)}
          onPress={() => router.push({ pathname: "/onboarding", params: { step: "language" } })}
        />
        <MetaChip
          icon="download-outline"
          label={t("you.import")}
          onPress={() => router.push(CONNECT_HREF)}
        />
      </View>

      {/* Faces */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: sp.s4, gap: sp.s2, paddingVertical: sp.s3 }}
      >
        {FACES.map((f) => {
          const on = f.key === face;
          return (
            <Tactile key={f.key} onPress={() => pickFace(f.key)} feedback="select">
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  borderRadius: radius.pill,
                  paddingHorizontal: 13,
                  paddingVertical: 7,
                  backgroundColor: on ? pal.ink : pal.surface,
                }}
              >
                <Ui size={fs.sm} weight="600" color={on ? pal.bg : pal.inkSoft}>
                  {t(f.label)}
                </Ui>
                <Ui
                  size={fs.xs}
                  weight="600"
                  color={on ? pal.bg : pal.subtle}
                  style={{ opacity: on ? 0.7 : 1 }}
                >
                  {String(faces[f.key].length)}
                </Ui>
              </View>
            </Tactile>
          );
        })}
      </ScrollView>

      {/* Sort switches — deliberately tiny; tap the live one to flip direction */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: sp.s4,
          gap: sp.s4,
          alignItems: "center",
          paddingBottom: sp.s3,
        }}
      >
        {SORTS[face].map((k) => {
          const on = k === sortKey;
          return (
            <Tactile key={k} onPress={() => pickSort(k)} hitSlop={8} feedback="select">
              <Ui
                size={fs.xs}
                weight={on ? "700" : "500"}
                color={on ? brand.accent : pal.subtle}
              >
                {t(sortLabel(k, face))}
                {on ? ` ${caret(k, flipped)}` : ""}
              </Ui>
            </Tactile>
          );
        })}
      </ScrollView>

      {face === "rated" && faces.rated.length ? (
        <Ui size={fs.xs} color={pal.muted} style={{ paddingHorizontal: sp.s4, paddingBottom: sp.s3 }}>
          {t("you.verdictLine", verdictCounts)}
        </Ui>
      ) : null}

      <Hairline style={{ marginHorizontal: sp.s4, marginBottom: sp.s3 }} />

      {loaded && rows.length === 0 ? (
        <Ui size={fs.sm} color={pal.muted} style={{ paddingHorizontal: sp.s4, paddingVertical: sp.s5 }}>
          {t(emptyKey)}
        </Ui>
      ) : null}
    </View>
  );

  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: pal.bg }}>
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
        <View style={{ paddingHorizontal: sp.s5, paddingTop: sp.s8, alignItems: "center", gap: sp.s4 }}>
          <Ui size={fs.base} color={pal.inkSoft} style={{ textAlign: "center" }}>
            {t("shelf.signedOut")}
          </Ui>
          <Btn
            label={t("my.signIn")}
            onPress={() => router.push({ pathname: "/onboarding", params: { step: "account" } })}
            style={{ alignSelf: "stretch" }}
          />
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
        <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(c) => c.slug}
        numColumns={3}
        ListHeaderComponent={header}
        columnWrapperStyle={{ paddingHorizontal: sp.s4, gap: GAP }}
        contentContainerStyle={{ paddingBottom: 120 }}
        initialNumToRender={18}
        windowSize={9}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={pal.muted} />
        }
        renderItem={({ item, index }) => (
          <GridCell
            cell={item}
            shownTitle={titleOf(item.slug, item.title)}
            face={face}
            width={cellW}
            index={index}
            onOpen={() => router.push({ pathname: "/film/[slug]", params: { slug: item.slug } })}
            onRate={() => onRateCell(item)}
            onRestore={() => void onRestore(item.slug)}
          />
        )}
      />

      {undoTok ? (
        <View
          pointerEvents="box-none"
          style={{ position: "absolute", left: 0, right: 0, bottom: insets.bottom + 96 }}
        >
          <UndoPill label={t("judge.restore")} actionLabel={t("judge.undo")} onUndo={onUndo} />
        </View>
      ) : null}

      <SettingsModal visible={showSettings} onClose={() => setShowSettings(false)} />
    </View>
  );
}

// ---------------------------------------------------------------------------

/** Tiny status/shortcut chip for the edition row. */
function MetaChip({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  const pal = usePalette();
  return (
    <Tactile onPress={onPress} feedback="tap">
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          borderRadius: radius.pill,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: pal.hairline2,
        }}
      >
        <Ionicons name={icon} size={12} color={pal.muted} />
        <Ui size={fs.xs} weight="600" color={pal.inkSoft}>
          {label}
        </Ui>
      </View>
    </Tactile>
  );
}

/**
 * One poster in the grid: the film, then the two numbers side by side —
 * TakeScore (the canon's) and my stars (mine). Tapping the stars rates it
 * without leaving the grid; the poster opens the brief.
 */
function GridCell({
  cell,
  shownTitle,
  face,
  width,
  index,
  onOpen,
  onRate,
  onRestore,
}: {
  cell: Cell;
  /** Title in the viewer's content language; falls back to cell.title. */
  shownTitle: string;
  face: Face;
  width: number;
  index: number;
  onOpen: () => void;
  onRate: () => void;
  onRestore: () => void;
}) {
  const pal = usePalette();
  const verdict = face === "rated" ? verdictOf(cell.rating, cell.standing) : null;
  // One corner slot, whatever this face has to say about the film: on the
  // watchlist it's commitment decay, on Rated it's how far my call sat from
  // the canon's.
  const corner = verdict
    ? verdictColor(verdict)
    : face === "queue" && cell.age && cell.age !== "fresh"
      ? ageColor(cell.age)
      : null;

  return (
    <Appear index={index} distance={10}>
      <Tactile onPress={onOpen} style={{ width, marginBottom: sp.s3 }}>
        <View>
          <View>
            <PosterImg
              path={cell.posterPath}
              width={width}
              height={Math.round(width * 1.5)}
              size="w342"
              rounded={radius.sm}
            />
            {corner ? (
              <View
                style={{
                  position: "absolute",
                  top: 6,
                  left: 6,
                  width: 8,
                  height: 8,
                  borderRadius: radius.pill,
                  backgroundColor: corner,
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.25)",
                }}
              />
            ) : null}
            {/* Availability rides ON the poster so the line underneath is always
                the same two things: the canon's number and mine. */}
            {face === "queue" && cell.tiers.length ? (
              <View
                style={{
                  position: "absolute",
                  left: 5,
                  bottom: 5,
                  borderRadius: radius.pill,
                  paddingHorizontal: 5,
                  paddingVertical: 3,
                  backgroundColor: pal.chrome,
                }}
              >
                <AvailabilityDots tiers={cell.tiers} />
              </View>
            ) : null}
          </View>

          {/* The two numbers, side by side (owner 08-03) */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 5,
              minHeight: 18,
            }}
          >
            {cell.ts != null ? (
              <Ui size={fs.sm} weight="700" color={brand.tsGreen}>
                {String(cell.ts)}
              </Ui>
            ) : (
              <Ui size={fs.sm} weight="700" color={pal.hairline2}>
                –
              </Ui>
            )}
            {face === "passed" ? (
              <Tactile
                onPress={onRestore}
                hitSlop={12}
                feedback="tap"
                style={{ paddingLeft: 10, paddingVertical: 2 }}
              >
                <Ionicons name="arrow-undo-outline" size={15} color={pal.muted} />
              </Tactile>
            ) : (
              <Tactile
                onPress={onRate}
                hitSlop={12}
                feedback="tap"
                style={{ paddingLeft: 10, paddingVertical: 2 }}
              >
                <MiniStars value={cell.rating} size={10} />
              </Tactile>
            )}
          </View>

          <Ui size={fs.xs} numberOfLines={2} color={pal.inkSoft} style={{ marginTop: 1, height: 32 }}>
            {shownTitle}
          </Ui>
        </View>
      </Tactile>
    </Appear>
  );
}

// ---------------------------------------------------------------------------
// Settings modal — the entire pre-v4 My screen settings surface, unchanged
// behavior: edition switcher, services, notifications, account (sign in/out,
// in-app deletion — Apple 5.1.1(v)).

function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const pal = usePalette();
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
  // The modal floats above the navigator — close it before pushing a route.
  const goOnboarding = (step: "edition" | "language") => {
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
            {/* One row, one question: where you watch. The page behind it holds
                the country AND the services that exist in it. */}
            <SettingRow
              icon="globe-outline"
              label={t("onboarding.editionTitle")}
              value={`${edition ? `${edition.flag} ${edition.label}` : prefs.country} · ${prefs.providerIds.length}`}
              onPress={() => goOnboarding("edition")}
            />
            <Hairline style={{ marginLeft: ROW_INSET }} />
            {/* The third axis — unrelated to the row above it, by design. */}
            <SettingRow
              icon="language-outline"
              label={t("you.language")}
              value={langLabel(prefs.contentLang)}
              onPress={() => goOnboarding("language")}
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
              <SignedOut onSkip={() => setAuthOpen(false)} />
            </>
          ) : null}

          {/* Owner 07-31: the raw source lines are gone from the settings foot —
              they read as clutter there. They are NOT optional, though: TMDB and
              JustWatch both require attribution, so they now live in one stated
              place (Credits & data sources) plus the Where-to-watch surface,
              which is the one JustWatch's terms actually attach to. */}
          <Tactile
            feedback="tap"
            onPress={() =>
              router.push({ pathname: "/read", params: { path: "/about", title: t("my.credits") } })
            }
            style={{ paddingHorizontal: sp.s4, paddingTop: sp.s6 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ui size={fs.xs} color={pal.subtle}>
                {t("my.credits")}
              </Ui>
              <Ionicons name="chevron-forward" size={12} color={pal.subtle} />
            </View>
          </Tactile>
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

// ---- Signed-out account block: email + code, Apple ------------------------

/** Sign-in inside the settings sheet. Renders the ONE shared panel — this was a
 *  second hand-maintained copy and had drifted: it still asked for a 6-digit
 *  code when the server sends 8, showed an untranslated developer string, and
 *  reported every auth failure as "couldn't reach Metatake", which is what the
 *  owner hit on 2026-07-31. */
function SignedOut({ onSkip }: { onSkip: () => void }) {
  const pal = usePalette();
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
      <SignInPanel onDone={onSkip} />
    </View>
  );
}
