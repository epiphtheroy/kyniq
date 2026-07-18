// Connect hub — bring your film life (HANDOFF-커넥트 §2, I1 file connectors).
// One screen, four internal states: HUB (tile grid) → GUIDE (bottom sheet with
// the 3 real-button steps) → IMPORT THEATER (staged progress, poster cascade,
// live counters — never a bare spinner) → COMPLETION (count-up + Finds chip +
// honest unmatched list, §6-5).
//
// Psychological staging is the point (owner directive 2026-07-18): the user
// leaves calm (privacy line + exact steps), waits with company (stage labels,
// tick-up numbers, posters pouring in), and returns to a banner that hands
// them the file picker. Export pages open in REAL Safari (canon §2.4 —
// SFSafariViewController can't drive the download manager).
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Btn, GradientBtn, PosterImg, Screen, Serif, Tactile, Ui } from "../src/components/ui";
import { getLocale, t, type DictKey } from "../src/i18n";
import { importApi, me, type ImportRow } from "../src/lib/api";
import {
  CONNECTORS,
  awaitingConnectors,
  connector,
  connectStates,
  onConnectChange,
  setConnectState,
  type Connector,
  type ConnectorId,
  type ConnectorState,
  type ConnectorStatus,
} from "../src/lib/connect";
import { verdictOf } from "../src/lib/verdict";
import { useFilms } from "../src/state/films";
import { brand, font, fs, gradient, motion, radius, shadow, sp, usePalette } from "../src/theme";

// Display names are brand proper nouns (same spelling in every dict — see
// connect.entry.sub); everything else on this screen goes through t().
const NAMES: Record<ConnectorId, string> = {
  letterboxd: "Letterboxd",
  imdb: "IMDb",
  netflix: "Netflix",
  watcha: "Watcha",
};

type RunStage = "reading" | "matching" | "writing";

const STAGE_KEY: Record<RunStage, DictKey> = {
  reading: "connect.stage.reading",
  matching: "connect.stage.matching",
  writing: "connect.stage.writing",
};

const STATUS_KEY: Record<Exclude<ConnectorStatus, "done">, DictKey> = {
  idle: "connect.status.idle",
  awaiting_file: "connect.status.awaitingFile",
  awaiting_collect: "connect.status.awaitingCollect",
  importing: "connect.status.importing",
  error: "connect.status.error",
};

type RunState = {
  id: ConnectorId;
  stage: RunStage;
  total: number; // parsed rows
  matched: number; // real matched count (cascade target)
  matchedShown: number; // animated tick-up
  posters: string[]; // up to 12 matched poster paths
  postersShown: number;
  committed: number; // real committed rows (onChunk)
  writeTotal: number;
  slow: boolean; // ~6s reassurance line
};

type ResultState = {
  id: ConnectorId;
  films: number;
  ratings: number;
  unmatched: { title: string; year?: number }[];
  finds: number;
};

type StateMap = Partial<Record<ConnectorId, ConnectorState>>;

// ---------------------------------------------------------------- tiny pieces

function statusLine(s: ConnectorState | undefined): string {
  const status = s?.status ?? "idle";
  if (status === "done") {
    const base = t("connect.status.done", { n: s?.films ?? 0 });
    return s?.at ? `${base} · ${new Date(s.at).toLocaleDateString(getLocale())}` : base;
  }
  return t(STATUS_KEY[status]);
}

function statusColor(status: ConnectorStatus, muted: string): string {
  if (status === "error") return brand.tsRisk;
  if (status === "awaiting_file" || status === "awaiting_collect" || status === "importing")
    return brand.accent;
  if (status === "done") return brand.tsGreen;
  return muted;
}

/** Monogram square — tint at low alpha, big letter. We ship no logo art. */
function Monogram({ c, size = 44 }: { c: Connector; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.sm,
        backgroundColor: `${c.tint}1F`,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: font.uiBold,
          fontSize: Math.round(size * 0.42),
          color: c.tint,
        }}
      >
        {c.monogram}
      </Text>
    </View>
  );
}

/** Floating glass back disc (film/[slug].tsx header idiom). */
function BackDisc({ onPress }: { onPress: () => void }) {
  const pal = usePalette();
  return (
    <Tactile onPress={onPress} hitSlop={8}>
      <View
        style={[
          {
            width: 36,
            height: 36,
            borderRadius: radius.pill,
            backgroundColor: pal.chrome,
            alignItems: "center",
            justifyContent: "center",
          },
          shadow.card,
        ]}
      >
        <Ionicons name="chevron-back" size={18} color={pal.ink} />
      </View>
    </Tactile>
  );
}

/** Matched poster popping into the cascade — spring scale on mount. */
function PopPoster({ path }: { path: string }) {
  const s = useSharedValue(0.6);
  const o = useSharedValue(0);
  useEffect(() => {
    s.value = withSpring(1, motion.spring);
    o.value = withTiming(1, { duration: 160 });
  }, [s, o]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: o.value }));
  return (
    <Animated.View style={anim}>
      <PosterImg path={path} width={56} height={84} size="w92" rounded={radius.xs} />
    </Animated.View>
  );
}

/** Reassurance line, faded in after ~6s in a stage. */
function SlowLine({ text }: { text: string }) {
  const pal = usePalette();
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withTiming(1, { duration: 420 });
  }, [o]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={anim}>
      <Ui size={fs.sm} color={pal.muted} style={{ textAlign: "center" }}>
        {text}
      </Ui>
    </Animated.View>
  );
}

/** Finds chip — pops (spring) after the count-up settles. Verdict teal, never brand red. */
function FindsChip({ n }: { n: number }) {
  const s = useSharedValue(0);
  useEffect(() => {
    s.value = withDelay(700, withSpring(1, { damping: 10, stiffness: 220 }));
  }, [s]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: s.value }));
  return (
    <Animated.View style={anim}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          alignSelf: "center",
          borderRadius: radius.pill,
          paddingHorizontal: sp.s4,
          paddingVertical: 8,
          backgroundColor: `${brand.teal}1A`,
          borderWidth: 1,
          borderColor: brand.teal,
        }}
      >
        <Ionicons name="sparkles" size={14} color={brand.teal} />
        <Ui size={fs.sm} weight="600" color={brand.teal}>
          {t("connect.done.finds", { n })}
        </Ui>
      </View>
    </Animated.View>
  );
}

/** Foreground return banner — springs in from the top, big pick target. */
function ReturnBanner({
  c,
  onPick,
  onClose,
}: {
  c: Connector;
  onPick: () => void;
  onClose: () => void;
}) {
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(-160);
  useEffect(() => {
    y.value = withSpring(0, motion.spring);
  }, [y]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View
      style={[
        { position: "absolute", top: insets.top + sp.s2, left: sp.s3, right: sp.s3 },
        anim,
      ]}
    >
      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            gap: sp.s3,
            borderRadius: radius.md,
            padding: sp.s3,
            backgroundColor: pal.card,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: pal.hairline,
          },
          shadow.float,
        ]}
      >
        <Monogram c={c} size={36} />
        <Ui size={fs.sm} weight="500" style={{ flex: 1 }} numberOfLines={2}>
          {t("connect.banner", { service: NAMES[c.id] })}
        </Ui>
        <Tactile onPress={onPick} hitSlop={6}>
          <View
            style={{
              borderRadius: radius.pill,
              paddingHorizontal: sp.s4,
              paddingVertical: 9,
              backgroundColor: pal.ink,
            }}
          >
            <Ui size={fs.sm} weight="700" color={pal.bg}>
              {t("connect.bannerCta")}
            </Ui>
          </View>
        </Tactile>
        <Pressable hitSlop={8} onPress={onClose}>
          <Ionicons name="close" size={18} color={pal.muted} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

/** Eased 0→n count-up for the completion numbers. */
function useCountUp(target: number, duration = 900): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target <= 0) {
      setV(0);
      return;
    }
    const t0 = Date.now();
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / duration);
      setV(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k >= 1) clearInterval(id);
    }, 33);
    return () => clearInterval(id);
  }, [target, duration]);
  return v;
}

// ------------------------------------------------------------------- screen

export default function ConnectScreen() {
  const pal = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { session, reload } = useFilms();

  const [states, setStates] = useState<StateMap>({});
  const [sheet, setSheet] = useState<ConnectorId | null>(null);
  const [run, setRun] = useState<RunState | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const [banner, setBanner] = useState<ConnectorId | null>(null);
  const [pasteEmpty, setPasteEmpty] = useState(false);

  const runRef = useRef<ConnectorId | null>(null);
  const cascadeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Hub state: load once + subscribe (onConnectChange fires on every transition).
  useEffect(() => {
    let live = true;
    const pull = () => {
      void connectStates().then((m) => {
        if (live) setStates(m);
      });
    };
    pull();
    const off = onConnectChange(pull);
    return () => {
      live = false;
      off();
    };
  }, []);

  // Recovery: an "importing" breadcrumb can't survive an app restart — no run
  // is alive at mount, so surface it as a retryable error instead of a lie.
  useEffect(() => {
    void connectStates().then((m) => {
      for (const c of CONNECTORS) {
        if (m[c.id]?.status === "importing" && runRef.current == null) {
          void setConnectState(c.id, { status: "error" });
        }
      }
    });
  }, []);

  useEffect(
    () => () => {
      if (cascadeTimer.current) clearInterval(cascadeTimer.current);
    },
    [],
  );

  // ---------------------------------------------------------- import runner

  const startCascade = useCallback((id: ConnectorId, count: number, posterCount: number) => {
    if (cascadeTimer.current) clearInterval(cascadeTimer.current);
    if (count <= 0) return;
    const t0 = Date.now();
    const dur = Math.min(2200, Math.max(900, count * 8));
    cascadeTimer.current = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setRun((s) =>
        s && s.id === id
          ? {
              ...s,
              matchedShown: Math.round(count * eased),
              postersShown: Math.min(posterCount, Math.ceil(posterCount * k)),
            }
          : s,
      );
      if (k >= 1 && cascadeTimer.current) {
        clearInterval(cascadeTimer.current);
        cascadeTimer.current = null;
      }
    }, 50);
  }, []);

  const runImport = useCallback(
    async (c: Connector, input: { file?: { uri: string; name: string; mimeType?: string }; text?: string }) => {
      if (runRef.current) return; // one import at a time — IMDb waits merge later
      runRef.current = c.id;
      setSheet(null);
      setBanner(null);
      setResult(null);
      setRun({
        id: c.id,
        stage: "reading",
        total: 0,
        matched: 0,
        matchedShown: 0,
        posters: [],
        postersShown: 0,
        committed: 0,
        writeTotal: 0,
        slow: false,
      });
      void setConnectState(c.id, { status: "importing" });
      try {
        // Stage 1 — reading
        const parsed =
          input.text != null
            ? await importApi.parseText(input.text)
            : await importApi.parseFile(input.file!);
        const rows = parsed.rows;
        if (!rows.length) throw new Error("empty");

        // Stage 2 — matching (minimal fields; Netflix rows may lack year — the
        // matcher handles it)
        setRun((s) => (s && s.id === c.id ? { ...s, stage: "matching", total: rows.length, slow: false } : s));
        const minimal = rows.map((r) => ({
          i: r.i,
          title: r.title,
          year: r.year,
          tmdb_id: r.tmdb_id,
          imdb_id: r.imdb_id,
        })) as ImportRow[];
        const matches = await importApi.match(minimal);
        const byI = new Map(matches.map((m) => [m.i, m]));
        const matchedRows: ImportRow[] = [];
        const unmatched: { title: string; year?: number }[] = [];
        const posters: string[] = [];
        for (const r of rows) {
          const m = byI.get(r.i);
          if (m?.status === "matched" && m.match) {
            matchedRows.push({ ...r, tmdb_id: m.match.tmdb_id });
            if (m.match.poster_path && posters.length < 12) posters.push(m.match.poster_path);
          } else {
            unmatched.push({ title: r.title, year: r.year });
          }
        }

        // Stage 3 — writing, while the cascade pours the matches in
        setRun((s) =>
          s && s.id === c.id
            ? {
                ...s,
                stage: "writing",
                matched: matchedRows.length,
                posters,
                writeTotal: matchedRows.length,
                slow: false,
              }
            : s,
        );
        startCascade(c.id, matchedRows.length, posters.length);
        const { committed } = matchedRows.length
          ? await importApi.commit(matchedRows, c.sourceLabel, input.file?.name ?? null, (done) => {
              setRun((s) => (s && s.id === c.id ? { ...s, committed: done } : s));
            })
          : { committed: 0 };

        const ratings = matchedRows.filter((r) => r.rating != null).length;
        await setConnectState(c.id, {
          status: "done",
          films: committed,
          ratings,
          unmatched: unmatched.length,
        });

        // Retro-verdict reward: Finds across the whole history (rating × Standing).
        let finds = 0;
        try {
          const coll = await me.collection();
          for (const row of coll) if (verdictOf(row.rating, row.prestige) === "find") finds += 1;
        } catch {
          finds = 0;
        }
        void reload(); // shelf reflects the imported ledger
        me.invalidateRecommend();

        if (cascadeTimer.current) {
          clearInterval(cascadeTimer.current);
          cascadeTimer.current = null;
        }
        runRef.current = null;
        setRun(null);
        setResult({ id: c.id, films: committed, ratings, unmatched, finds });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        if (cascadeTimer.current) {
          clearInterval(cascadeTimer.current);
          cascadeTimer.current = null;
        }
        runRef.current = null;
        setRun(null);
        await setConnectState(c.id, { status: "error" });
        setSheet(c.id); // guide reopens with the friendly retry line
      }
    },
    [reload, startCascade],
  );

  // -------------------------------------------------------------- gestures

  const pickFile = useCallback(
    async (c: Connector) => {
      try {
        const res = await DocumentPicker.getDocumentAsync({
          type: c.fileTypes.length ? c.fileTypes : undefined,
          copyToCacheDirectory: true,
          multiple: false,
        });
        if (res.canceled || !res.assets.length) return;
        const a = res.assets[0];
        void runImport(c, { file: { uri: a.uri, name: a.name, mimeType: a.mimeType } });
      } catch {
        // picker dismissed/unavailable — stay where we are
      }
    },
    [runImport],
  );

  const openExport = useCallback((c: Connector) => {
    Linking.openURL(c.exportUrl).catch(() => undefined);
    if (c.kind === "file") {
      void setConnectState(c.id, {
        status: c.id === "imdb" ? "awaiting_collect" : "awaiting_file",
      });
    }
  }, []);

  const openCollect = useCallback((c: Connector) => {
    if (!c.collectUrl) return;
    Linking.openURL(c.collectUrl).catch(() => undefined);
    void setConnectState(c.id, { status: "awaiting_file" });
  }, []);

  const pasteWatcha = useCallback(
    async (c: Connector) => {
      let text = "";
      try {
        text = (await Clipboard.getStringAsync()).trim();
      } catch {
        text = "";
      }
      if (!text) {
        setPasteEmpty(true);
        return;
      }
      setPasteEmpty(false);
      void runImport(c, { text });
    },
    [runImport],
  );

  // Return banner: on foreground, if a connector is waiting and nothing runs,
  // slide in the pick-it banner (§2.4-3).
  useEffect(() => {
    const check = async () => {
      if (runRef.current) return;
      const waits = await awaitingConnectors();
      if (waits.length) setBanner(waits[0].id);
    };
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active") void check();
    });
    return () => sub.remove();
  }, []);

  // Stage progress bar — spring toward the stage's share of the journey.
  const prog = useSharedValue(0);
  useEffect(() => {
    if (!run) {
      prog.value = 0;
      return;
    }
    let p = 0.08;
    if (run.stage === "matching") p = 0.3;
    else if (run.stage === "writing")
      p = 0.45 + 0.55 * (run.writeTotal > 0 ? run.committed / run.writeTotal : 1);
    prog.value = withSpring(Math.min(1, p), { damping: 18, stiffness: 120 });
  }, [run, prog]);
  const progStyle = useAnimatedStyle(() => ({
    width: `${Math.min(100, Math.max(2, prog.value * 100))}%`,
  }));

  // ~6s in one stage → fade in the reassurance line.
  useEffect(() => {
    if (!run) return;
    const id = setTimeout(() => {
      setRun((s) => (s ? { ...s, slow: true } : s));
    }, 6000);
    return () => clearTimeout(id);
  }, [run?.id, run?.stage]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }, [router]);

  // ------------------------------------------------------------ signed out

  if (!session) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ paddingTop: insets.top + sp.s2, paddingHorizontal: sp.s4 }}>
          <BackDisc onPress={goBack} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: sp.s5, gap: sp.s4 }}>
          <Serif size={fs.xl} bold>
            {t("connect.title")}
          </Serif>
          <Ui size={fs.sm} color={pal.muted} style={{ textAlign: "center" }}>
            {t("connect.empty.signedOut")}
          </Ui>
          <Btn
            label={t("my.signIn")}
            style={{ alignSelf: "stretch" }}
            onPress={() => router.push("/onboarding")}
          />
        </View>
      </Screen>
    );
  }

  // ---------------------------------------------------------------- theater

  if (run) {
    const c = connector(run.id);
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <ScrollView
          contentContainerStyle={{
            paddingTop: insets.top + sp.s7,
            paddingHorizontal: sp.s5,
            paddingBottom: insets.bottom + sp.s6,
            alignItems: "center",
          }}
          showsVerticalScrollIndicator={false}
        >
          <Monogram c={c} size={56} />
          <Ui size={fs.md} weight="600" style={{ marginTop: sp.s3 }}>
            {NAMES[c.id]}
          </Ui>
          <Ui size={fs.lg} weight="600" style={{ marginTop: sp.s5 }}>
            {t(STAGE_KEY[run.stage])}
          </Ui>

          {/* Progress bar — Lava gradient fill, spring width */}
          <View
            style={{
              alignSelf: "stretch",
              height: 6,
              borderRadius: radius.pill,
              backgroundColor: pal.hairline,
              overflow: "hidden",
              marginTop: sp.s4,
            }}
          >
            <Animated.View style={[{ height: 6, borderRadius: radius.pill, overflow: "hidden" }, progStyle]}>
              <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
            </Animated.View>
          </View>

          {/* Live counters — matches pouring in, then real write progress */}
          {run.total > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: sp.s5 }}>
              <Text
                style={{
                  fontFamily: font.uiBold,
                  fontSize: 44,
                  color: pal.ink,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {run.stage === "matching" ? run.total : run.matchedShown}
              </Text>
              {run.stage === "writing" ? (
                <Text
                  style={{
                    fontFamily: font.uiMed,
                    fontSize: fs.lg,
                    color: pal.muted,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  / {run.total}
                </Text>
              ) : null}
            </View>
          ) : null}
          {run.stage === "writing" && run.writeTotal > 0 ? (
            <Text
              style={{
                fontFamily: font.uiMed,
                fontSize: fs.sm,
                color: pal.muted,
                fontVariant: ["tabular-nums"],
                marginTop: 2,
              }}
            >
              {run.committed} / {run.writeTotal}
            </Text>
          ) : null}

          {/* Poster cascade — the reward moment */}
          {run.postersShown > 0 ? (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: sp.s2,
                justifyContent: "center",
                marginTop: sp.s5,
              }}
            >
              {run.posters.slice(0, run.postersShown).map((p, i) => (
                <PopPoster key={`${p}-${i}`} path={p} />
              ))}
            </View>
          ) : null}

          {run.slow ? (
            <View style={{ marginTop: sp.s5, paddingHorizontal: sp.s4 }}>
              <SlowLine text={t("connect.stage.slow")} />
            </View>
          ) : null}
        </ScrollView>
      </Screen>
    );
  }

  // ------------------------------------------------------------- completion

  if (result) {
    return (
      <CompletionView
        result={result}
        onShelf={() => router.push("/my")}
        onDone={() => setResult(null)}
        onUnmatchedTap={() => router.push("/search")}
      />
    );
  }

  // -------------------------------------------------------------------- hub

  const tileW = Math.floor((width - sp.s4 * 2 - sp.s3) / 2);
  const sheetConnector = sheet ? connector(sheet) : null;
  const sheetState = sheet ? states[sheet] : undefined;
  const sheetStatus: ConnectorStatus = sheetState?.status ?? "idle";

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + sp.s2,
          paddingHorizontal: sp.s4,
          paddingBottom: insets.bottom + sp.s7,
        }}
        showsVerticalScrollIndicator={false}
      >
        <BackDisc onPress={goBack} />
        <Serif size={fs.x2} bold style={{ marginTop: sp.s5 }}>
          {t("connect.title")}
        </Serif>
        {/* Privacy line — the user leaves calm */}
        <Ui size={fs.sm} color={pal.muted} style={{ marginTop: sp.s2 }}>
          {t("connect.subtitle")}
        </Ui>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: sp.s3, marginTop: sp.s5 }}>
          {CONNECTORS.map((c) => {
            const s = states[c.id];
            const st = s?.status ?? "idle";
            return (
              <Tactile
                key={c.id}
                onPress={() => {
                  setPasteEmpty(false);
                  setSheet(c.id);
                }}
              >
                <View
                  style={[
                    {
                      width: tileW,
                      borderRadius: radius.md,
                      padding: sp.s4,
                      gap: sp.s3,
                      backgroundColor: pal.card,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: pal.hairline,
                    },
                    shadow.card,
                  ]}
                >
                  <Monogram c={c} />
                  <View>
                    <Ui size={fs.md} weight="600">
                      {NAMES[c.id]}
                    </Ui>
                    <Ui
                      size={fs.xs}
                      weight="500"
                      color={statusColor(st, pal.muted)}
                      style={{ marginTop: 2 }}
                      numberOfLines={2}
                    >
                      {statusLine(s)}
                    </Ui>
                  </View>
                </View>
              </Tactile>
            );
          })}
        </View>
      </ScrollView>

      {/* GUIDE — bottom sheet with the exact 3 steps + one primary CTA */}
      <Modal
        visible={sheetConnector != null}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setSheet(null);
          setPasteEmpty(false);
        }}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: pal.scrim }]}
            onPress={() => {
              setSheet(null);
              setPasteEmpty(false);
            }}
          />
          {sheetConnector ? (
            <View
              style={{
                borderTopLeftRadius: radius.lg,
                borderTopRightRadius: radius.lg,
                backgroundColor: pal.bg,
                paddingHorizontal: sp.s4,
                paddingTop: sp.s3,
                paddingBottom: insets.bottom + sp.s4,
              }}
            >
              <View
                style={{
                  alignSelf: "center",
                  width: 36,
                  height: 4,
                  borderRadius: radius.pill,
                  backgroundColor: pal.hairline2,
                  marginBottom: sp.s4,
                }}
              />
              <GuideSheet
                c={sheetConnector}
                status={sheetStatus}
                state={sheetState}
                pasteEmpty={pasteEmpty}
                onOpenExport={() => openExport(sheetConnector)}
                onOpenCollect={() => openCollect(sheetConnector)}
                onPickFile={() => void pickFile(sheetConnector)}
                onPaste={() => void pasteWatcha(sheetConnector)}
              />
            </View>
          ) : null}
        </View>
      </Modal>

      {banner ? (
        <ReturnBanner
          c={connector(banner)}
          onPick={() => {
            const c = connector(banner);
            setBanner(null);
            void pickFile(c);
          }}
          onClose={() => setBanner(null)}
        />
      ) : null}
    </Screen>
  );
}

// ------------------------------------------------------------------- guide

function GuideSheet({
  c,
  status,
  state,
  pasteEmpty,
  onOpenExport,
  onOpenCollect,
  onPickFile,
  onPaste,
}: {
  c: Connector;
  status: ConnectorStatus;
  state: ConnectorState | undefined;
  pasteEmpty: boolean;
  onOpenExport: () => void;
  onOpenCollect: () => void;
  onPickFile: () => void;
  onPaste: () => void;
}) {
  const pal = usePalette();

  // One primary CTA per (kind, status); the rest are quiet text links.
  let primaryLabel: string;
  let primaryAction: () => void;
  let quiet: { label: string; action: () => void } | null = null;
  if (c.kind === "clipboard") {
    primaryLabel = t("connect.paste");
    primaryAction = onPaste;
    quiet = { label: t("connect.openExport"), action: onOpenExport };
  } else if (status === "awaiting_collect") {
    primaryLabel = t("connect.openCollect");
    primaryAction = onOpenCollect;
    quiet = { label: t("connect.pickFile"), action: onPickFile };
  } else if (status === "awaiting_file") {
    primaryLabel = t("connect.pickFile");
    primaryAction = onPickFile;
    quiet = { label: t("connect.openExport"), action: onOpenExport };
  } else {
    // idle / done / error — start (or restart) the two-round-trip journey
    primaryLabel = t("connect.openExport");
    primaryAction = onOpenExport;
    quiet = { label: t("connect.pickFile"), action: onPickFile };
  }

  // The IMDb queue note is the headline while the export cooks (§2.4-4);
  // Watcha's revert note belongs after the import, not before (§7-D1).
  const noteProminent = c.id === "imdb" && status === "awaiting_collect";
  const showNote =
    c.noteKey != null && (c.id === "watcha" ? status === "done" : true);

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: sp.s3 }}>
        <Monogram c={c} size={40} />
        <View style={{ flex: 1 }}>
          <Ui size={fs.lg} weight="600">
            {NAMES[c.id]}
          </Ui>
          <Ui size={fs.xs} weight="500" color={statusColor(status, pal.muted)}>
            {statusLine(state)}
          </Ui>
        </View>
      </View>

      {status === "error" ? (
        <Ui size={fs.sm} weight="500" color={brand.tsRisk} style={{ marginTop: sp.s3 }}>
          {t("connect.status.error")}
        </Ui>
      ) : null}

      {/* The 3 real steps — numbered, with the service's actual button labels */}
      <View style={{ gap: sp.s3, marginTop: sp.s4 }}>
        {c.stepKeys.map((k, i) => (
          <View key={k} style={{ flexDirection: "row", gap: sp.s3, alignItems: "flex-start" }}>
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: radius.pill,
                backgroundColor: `${c.tint}1F`,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 1,
              }}
            >
              <Text style={{ fontFamily: font.uiBold, fontSize: fs.sm, color: c.tint }}>{i + 1}</Text>
            </View>
            <Ui size={fs.sm} style={{ flex: 1 }} color={pal.inkSoft}>
              {t(k)}
            </Ui>
          </View>
        ))}
      </View>

      {showNote && c.noteKey ? (
        <View
          style={{
            flexDirection: "row",
            gap: sp.s2,
            alignItems: "flex-start",
            marginTop: sp.s4,
            padding: sp.s3,
            borderRadius: radius.md,
            backgroundColor: pal.surface,
            borderWidth: noteProminent ? 1 : StyleSheet.hairlineWidth,
            borderColor: noteProminent ? brand.accent : pal.hairline,
          }}
        >
          <Ionicons
            name={c.id === "imdb" ? "time-outline" : "information-circle-outline"}
            size={16}
            color={noteProminent ? brand.accent : pal.muted}
            style={{ marginTop: 2 }}
          />
          <Ui size={fs.sm} weight={noteProminent ? "600" : "400"} color={pal.inkSoft} style={{ flex: 1 }}>
            {t(c.noteKey)}
          </Ui>
        </View>
      ) : null}

      {pasteEmpty && c.kind === "clipboard" ? (
        <View
          style={{
            flexDirection: "row",
            gap: sp.s2,
            alignItems: "flex-start",
            marginTop: sp.s4,
            padding: sp.s3,
            borderRadius: radius.md,
            backgroundColor: pal.surface,
          }}
        >
          <Ionicons name="clipboard-outline" size={16} color={pal.muted} style={{ marginTop: 2 }} />
          <Ui size={fs.sm} color={pal.inkSoft} style={{ flex: 1 }}>
            {t("connect.watcha.s2")}
          </Ui>
        </View>
      ) : null}

      {/* Privacy line stays in view — the user leaves calm */}
      <Ui size={fs.xs} color={pal.subtle} style={{ marginTop: sp.s4 }}>
        {t("connect.subtitle")}
      </Ui>

      <GradientBtn label={primaryLabel} onPress={primaryAction} style={{ marginTop: sp.s4 }} />
      {quiet ? (
        <Tactile onPress={quiet.action} style={{ alignSelf: "center", marginTop: sp.s3 }}>
          <Ui size={fs.sm} weight="600" color={pal.muted} style={{ padding: sp.s2 }}>
            {quiet.label}
          </Ui>
        </Tactile>
      ) : null}
    </View>
  );
}

// -------------------------------------------------------------- completion

function CompletionView({
  result,
  onShelf,
  onDone,
  onUnmatchedTap,
}: {
  result: ResultState;
  onShelf: () => void;
  onDone: () => void;
  onUnmatchedTap: () => void;
}) {
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const filmsV = useCountUp(result.films);
  const ratingsV = useCountUp(result.ratings);
  const c = connector(result.id);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + sp.s7,
          paddingHorizontal: sp.s4,
          paddingBottom: insets.bottom + 140,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: "center", gap: sp.s3 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: radius.pill,
              backgroundColor: `${brand.tsGreen}1A`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="checkmark" size={30} color={brand.tsGreen} />
          </View>
          <Serif size={fs.x2} bold>
            {t("connect.done.title")}
          </Serif>
          <Text
            style={{
              fontFamily: font.uiSemi,
              fontSize: fs.lg,
              color: pal.ink,
              fontVariant: ["tabular-nums"],
            }}
          >
            {t("connect.done.line", { films: filmsV, ratings: ratingsV })}
          </Text>
          {result.finds > 0 ? <FindsChip n={result.finds} /> : null}
        </View>

        {result.id === "watcha" && c.noteKey ? (
          <View
            style={{
              flexDirection: "row",
              gap: sp.s2,
              alignItems: "flex-start",
              marginTop: sp.s5,
              padding: sp.s3,
              borderRadius: radius.md,
              backgroundColor: pal.surface,
            }}
          >
            <Ionicons name="information-circle-outline" size={16} color={pal.muted} style={{ marginTop: 2 }} />
            <Ui size={fs.sm} color={pal.inkSoft} style={{ flex: 1 }}>
              {t(c.noteKey)}
            </Ui>
          </View>
        ) : null}

        {/* Unmatched — framed positively, never hidden (§6-5) */}
        {result.unmatched.length > 0 ? (
          <View style={{ marginTop: sp.s6 }}>
            <Ui size={fs.md} weight="600">
              {t("connect.unmatched", { n: result.unmatched.length })}
            </Ui>
            <Ui size={fs.sm} color={pal.muted} style={{ marginTop: 2 }}>
              {t("connect.unmatchedHint")}
            </Ui>
            <View
              style={{
                marginTop: sp.s3,
                borderRadius: radius.md,
                backgroundColor: pal.card,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: pal.hairline,
              }}
            >
              {result.unmatched.slice(0, 40).map((u, i) => (
                <Tactile key={`${u.title}-${i}`} onPress={onUnmatchedTap}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: sp.s3,
                      paddingHorizontal: sp.s4,
                      paddingVertical: 12,
                      borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                      borderTopColor: pal.hairline,
                    }}
                  >
                    <Ui size={fs.sm} weight="500" style={{ flex: 1 }} numberOfLines={1}>
                      {u.year != null ? `${u.title} · ${u.year}` : u.title}
                    </Ui>
                    <Ionicons name="search" size={14} color={pal.subtle} />
                  </View>
                </Tactile>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Bottom-fixed CTA — thumb zone */}
      <View
        style={{
          position: "absolute",
          left: sp.s4,
          right: sp.s4,
          bottom: insets.bottom + sp.s3,
          gap: sp.s2,
        }}
      >
        <GradientBtn label={t("shelf.title")} onPress={onShelf} />
        <Tactile onPress={onDone} style={{ alignSelf: "center" }}>
          <Ui size={fs.sm} weight="600" color={pal.muted} style={{ padding: sp.s2 }}>
            {t("action.done")}
          </Ui>
        </Tactile>
      </View>
    </Screen>
  );
}
