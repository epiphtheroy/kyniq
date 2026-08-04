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
import { glyphs } from "../src/platform/tokens";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as ExpoLinking from "expo-linking"; // createURL — RN's Linking has no createURL
import * as WebBrowser from "expo-web-browser"; // OAuth via the system browser (§6-2)
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
import { useAndroidBack } from "../src/platform/back";
import {
  connectApi,
  importApi,
  me,
  NOT_CONFIGURED,
  type ConnectionRow,
  type ConnectProvider,
  type ImportRow,
} from "../src/lib/api";
import {
  CONNECTORS,
  awaitingConnectors,
  clearConnectState,
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

/** Loose title normalizer for year-less ambiguous matches. */
const normTitle = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// Display names are brand proper nouns (same spelling in every dict — see
// connect.entry.sub); everything else on this screen goes through t().
const NAMES: Record<ConnectorId, string> = {
  letterboxd: "Letterboxd",
  imdb: "IMDb",
  netflix: "Netflix",
  watcha: "Watcha",
  trakt: "Trakt",
  tmdb: "TMDB",
  simkl: "Simkl",
};

// File stages (reading→matching→writing) run in the app; oauth stages
// (connecting→syncing→writing) narrate a server-side pull — writing is the
// count-up reveal in both.
type RunStage = "reading" | "matching" | "writing" | "connecting" | "syncing";

const STAGE_KEY: Record<RunStage, DictKey> = {
  reading: "connect.stage.reading",
  matching: "connect.stage.matching",
  writing: "connect.stage.writing",
  connecting: "connect.stage.connecting",
  syncing: "connect.stage.syncing",
};

const STATUS_KEY: Record<Exclude<ConnectorStatus, "done">, DictKey> = {
  idle: "connect.status.idle",
  awaiting_file: "connect.status.awaitingFile",
  awaiting_collect: "connect.status.awaitingCollect",
  authorizing: "connect.stage.connecting",
  importing: "connect.status.importing",
  syncing: "connect.stage.syncing",
  error: "connect.status.error",
};

type RunState = {
  id: ConnectorId;
  stage: RunStage;
  total: number; // parsed rows (file) / synced films (oauth)
  matched: number; // real matched count (cascade target)
  matchedShown: number; // animated tick-up
  posters: string[]; // up to 12 matched poster paths
  postersShown: number;
  committed: number; // real committed rows (onChunk)
  writeTotal: number;
  slow: boolean; // ~6s reassurance line
  oauth?: boolean; // server-side sync — no poster cascade / row denominator
};

type ResultState = {
  id: ConnectorId;
  films: number;
  ratings: number;
  unmatched: { title: string; year?: number }[];
  finds: number;
};

type StateMap = Partial<Record<ConnectorId, ConnectorState>>;

// An import outlives the screen that started it: leaving /connect cancels nothing
// on the server. So the two facts a new mount needs — "is one still running?" and
// "did one finish while nobody was watching?" — cannot live in component state.
// A ref would answer "no import is running" to a remount that happened mid-run,
// which is how the same file got imported twice and how the recovery effect below
// relabelled a healthy run as an error.
const runRef: { current: ConnectorId | null } = { current: null };

// The summary a finished run couldn't hand over because its screen was gone.
// Written by the run itself, not by a setState that dies with the component, so
// the unmatched list (§6-5's honest leftovers — the ledger keeps only its count)
// survives the trip back and greets the user exactly once.
let handoffResult: ResultState | null = null;

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
  if (
    status === "awaiting_file" ||
    status === "awaiting_collect" ||
    status === "authorizing" ||
    status === "importing" ||
    status === "syncing"
  )
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
        <Ionicons name={glyphs.back} size={18} color={pal.ink} />
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

/**
 * Leave confirmation over the import theater — springs up like the guide sheet,
 * but in place rather than in a Modal. A native modal window would take Android's
 * back press for itself, and this sheet is the one surface that must hand it back
 * to the screen underneath: back here means "never mind", not "leave".
 */
function LeaveSheet({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const y = useSharedValue(320);
  useEffect(() => {
    y.value = withSpring(0, motion.spring);
  }, [y]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <View style={[StyleSheet.absoluteFill, { justifyContent: "flex-end" }]}>
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: pal.scrim }]}
        onPress={onStay}
      />
      <Animated.View
        style={[
          {
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            backgroundColor: pal.bg,
            paddingHorizontal: sp.s4,
            paddingTop: sp.s3,
            paddingBottom: insets.bottom + sp.s4,
          },
          anim,
        ]}
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
        <Ui size={fs.lg} weight="600">
          {t("connect.leave.title")}
        </Ui>
        <Ui size={fs.sm} color={pal.inkSoft} style={{ marginTop: sp.s2 }}>
          {t("connect.leave.body")}
        </Ui>
        <GradientBtn label={t("connect.leave.stay")} onPress={onStay} style={{ marginTop: sp.s4 }} />
        <Tactile onPress={onLeave} style={{ alignSelf: "center", marginTop: sp.s3 }}>
          <Ui size={fs.sm} weight="600" color={pal.muted} style={{ padding: sp.s2 }}>
            {t("connect.leave.go")}
          </Ui>
        </Tactile>
      </Animated.View>
    </View>
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
  // Adopt a summary left behind by a run the user walked away from (see handoffResult).
  const [result, setResult] = useState<ResultState | null>(handoffResult);
  const [banner, setBanner] = useState<ConnectorId | null>(null);
  const [leaving, setLeaving] = useState(false); // theater exit confirmation
  // The OAuth handshake before there is a run to show: start() can stall for its
  // whole budget, and the theater only opens once the browser comes back.
  const [starting, setStarting] = useState<ConnectorId | null>(null);
  const [pasteEmpty, setPasteEmpty] = useState(false);
  // OAuth connection state (§4): server-of-truth rows from me_connections(),
  // plus a client memo of providers the owner hasn't configured yet (503).
  const [conn, setConn] = useState<Partial<Record<ConnectorId, ConnectionRow>>>({});
  const [notConfigured, setNotConfigured] = useState<Partial<Record<ConnectorId, boolean>>>({});

  const cascadeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearResult = useCallback(() => {
    handoffResult = null; // consumed — it must not greet the user a second time
    setResult(null);
  }, []);

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

  // Merge me_connections() (server truth) into the oauth tiles. Refetch when the
  // session appears so a fresh sign-in reflects existing connections.
  useEffect(() => {
    let live = true;
    void connectApi.states().then((rows) => {
      if (!live) return;
      const m: Partial<Record<ConnectorId, ConnectionRow>> = {};
      for (const r of rows) m[r.provider] = r;
      setConn(m);
    });
    return () => {
      live = false;
    };
  }, [session]);

  // Recovery: a mid-flow breadcrumb can't survive an app restart — "importing"/
  // "syncing" wrote (or may have written) to the ledger → surface as retryable
  // error; "authorizing" never wrote → clear it.
  //
  // A restart and a remount look identical from here, and runRef is the only
  // thing that tells them apart: a connector still listed there is writing rows
  // right now, and calling that an error would be a lie the user acts on — they
  // retry, and import the same file a second time.
  useEffect(() => {
    void connectStates().then((m) => {
      for (const c of CONNECTORS) {
        if (runRef.current === c.id) continue;
        const st = m[c.id]?.status;
        if (st === "importing" || st === "syncing") {
          void setConnectState(c.id, { status: "error" });
        } else if (st === "authorizing") {
          void clearConnectState(c.id);
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
      setLeaving(false);
      clearResult();
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
        const matches = await importApi.match(minimal, (done) => {
          // Truthful matching progress (QA 07-29: the bar parked at 30% for minutes
          // on big files) — feeds the 0.30→0.45 band below.
          setRun((s) => (s && s.id === c.id ? { ...s, matched: done } : s));
        });
        const byI = new Map(matches.map((m) => [m.i, m]));
        const matchedRows: ImportRow[] = [];
        const unmatched: { title: string; year?: number }[] = [];
        const posters: string[] = [];
        for (const r of rows) {
          const m = byI.get(r.i);
          // Accept an exact match; for an ambiguous hit, accept the top candidate
          // when its year is within ±1 of ours (same tolerance the server's exact
          // filter uses) — a common-title film shouldn't silently fail to import.
          let pick = m?.status === "matched" ? m.match : undefined;
          if (!pick && m?.status === "ambiguous" && m.candidates?.length) {
            const c0 = m.candidates[0];
            const cy = parseInt(c0.year ?? "", 10);
            if (r.year) {
              if (!Number.isFinite(cy) || Math.abs(cy - r.year) <= 1) pick = c0;
            } else if (normTitle(c0.title) === normTitle(r.title)) {
              // Year-less rows (Netflix export): require exact normalized-title equality —
              // otherwise a same-title remake/doc silently imports as the wrong film (QA 07-29).
              pick = c0;
            }
          }
          if (pick) {
            matchedRows.push({ ...r, tmdb_id: pick.tmdb_id });
            if (pick.poster_path && posters.length < 12) posters.push(pick.poster_path);
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
        const { committed, failed } = matchedRows.length
          ? await importApi.commit(matchedRows, c.sourceLabel, input.file?.name ?? null, (done) => {
              setRun((s) => (s && s.id === c.id ? { ...s, committed: done } : s));
            })
          : { committed: 0, failed: [] as { title: string; year?: number | null }[] };
        // Commit-level failures (unresolvable tmdb_id) join the honest leftovers —
        // silent truncation reads as success (QA 07-29).
        for (const f of failed) unmatched.push({ title: f.title, year: f.year ?? undefined });

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
        handoffResult = { id: c.id, films: committed, ratings, unmatched, finds };
        setResult(handoffResult);
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
    [clearResult, reload, startCascade],
  );

  // ----------------------------------------------------------- oauth runner

  const beginRun = useCallback(
    (c: Connector, stage: RunStage) => {
      runRef.current = c.id;
      setSheet(null);
      setBanner(null);
      setLeaving(false);
      clearResult();
      setRun({
        id: c.id,
        stage,
        oauth: true,
        total: 0,
        matched: 0,
        matchedShown: 0,
        posters: [],
        postersShown: 0,
        committed: 0,
        writeTotal: 0,
        slow: false,
      });
    },
    [clearResult],
  );

  const failSync = useCallback(
    async (c: Connector, provider: ConnectProvider, reason: string) => {
      if (cascadeTimer.current) {
        clearInterval(cascadeTimer.current);
        cascadeTimer.current = null;
      }
      runRef.current = null;
      setRun(null);
      await setConnectState(c.id, { status: "error" });
      setConn((p) => ({
        ...p,
        [c.id]: {
          provider,
          status: "error",
          last_sync_at: p[c.id]?.last_sync_at ?? null,
          synced_films: p[c.id]?.synced_films ?? null,
          error: reason,
          created_at: p[c.id]?.created_at ?? new Date().toISOString(),
        },
      }));
      setSheet(c.id); // reopen with a retry
    },
    [],
  );

  // Server-side sync → the writing count-up reveal → completion. Shared by the
  // first connect and later "Sync now". Assumes a run is already on screen for c.
  const finishSync = useCallback(
    async (c: Connector, provider: ConnectProvider) => {
      try {
        setRun((s) => (s && s.id === c.id ? { ...s, stage: "syncing" } : s));
        const out = await connectApi.sync(provider);
        const films = out.films ?? 0;

        // No per-row progress from a server pull — writeTotal 0 fills the bar,
        // the big number counts up to the synced film count, posters skipped.
        setRun((s) =>
          s && s.id === c.id
            ? { ...s, stage: "writing", total: films, matched: films, writeTotal: 0 }
            : s,
        );
        startCascade(c.id, films, 0);

        const now = new Date().toISOString();
        setConn((p) => ({
          ...p,
          [c.id]: {
            provider,
            status: "connected",
            last_sync_at: now,
            synced_films: films,
            error: null,
            created_at: p[c.id]?.created_at ?? now,
          },
        }));
        await setConnectState(c.id, { status: "done", films });

        // Retro-verdict reward + rating tally over the whole shelf (a server sync
        // returns no per-import breakdown; both are true statements about it).
        let finds = 0;
        let ratings = 0;
        try {
          const coll = await me.collection();
          for (const row of coll) {
            if (row.rating != null) ratings += 1;
            if (verdictOf(row.rating, row.prestige) === "find") finds += 1;
          }
        } catch {
          finds = 0;
          ratings = 0;
        }
        void reload();
        me.invalidateRecommend();

        await new Promise((r) => setTimeout(r, 900)); // let the count-up read
        if (cascadeTimer.current) {
          clearInterval(cascadeTimer.current);
          cascadeTimer.current = null;
        }
        runRef.current = null;
        setRun(null);
        handoffResult = { id: c.id, films, ratings, unmatched: [], finds };
        setResult(handoffResult);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        await failSync(c, provider, "sync");
      }
    },
    [failSync, reload, startCascade],
  );

  // One-tap sign-in: start → system browser → parse code/request_token → callback
  // → sync theater. Cancel is silent (§13-17 spirit); 503 → friendly "coming soon".
  const runOAuth = useCallback(
    async (c: Connector) => {
      if (runRef.current || starting) return;
      const provider = c.id as ConnectProvider;
      const redirectUri = ExpoLinking.createURL("connect-callback");

      // Claim the tap before the network: the button reads "Connecting…" and the
      // tile behind the sheet agrees, so a stalled start() looks like work rather
      // than a dead CTA (QA 08-04). This mark used to be written after the call —
      // that is, only once there was nothing left to wait for.
      setStarting(c.id);
      void setConnectState(c.id, { status: "authorizing" });

      let started: { url: string; pending: string | null };
      try {
        started = await connectApi.start(provider, redirectUri);
      } catch (e) {
        if (e instanceof Error && e.message === NOT_CONFIGURED) {
          await clearConnectState(c.id); // nothing was attempted — idle, not broken
          setNotConfigured((p) => ({ ...p, [c.id]: true })); // sheet → coming soon
        } else {
          // Stalled or refused. The sheet is still open and now reads the error.
          await setConnectState(c.id, { status: "error" });
        }
        return;
      } finally {
        setStarting(null);
      }

      let back: URL | null = null;
      try {
        const res = await WebBrowser.openAuthSessionAsync(started.url, redirectUri);
        if (res.type !== "success" || !res.url) {
          await clearConnectState(c.id); // cancel / dismiss → quiet, no state change
          return;
        }
        back = new URL(res.url);
      } catch {
        await clearConnectState(c.id);
        return;
      }
      if (!back) return;
      // Provider "Deny" comes back as a success-typed redirect carrying ?error= —
      // that's a user decision, not a failure: stay quiet (QA 07-29).
      if (back.searchParams.get("error")) {
        await clearConnectState(c.id);
        return;
      }

      const code = back.searchParams.get("code") ?? undefined;
      const request_token = back.searchParams.get("request_token") ?? undefined;

      beginRun(c, "connecting");
      void setConnectState(c.id, { status: "syncing" });
      try {
        await connectApi.callback(provider, { code, request_token, pending: started.pending });
      } catch {
        await failSync(c, provider, "auth");
        return;
      }
      await finishSync(c, provider);
    },
    [beginRun, failSync, finishSync, starting],
  );

  // "Sync now" on a connected tile — skips auth, goes straight to the pull.
  const syncOAuth = useCallback(
    async (c: Connector) => {
      if (runRef.current) return;
      beginRun(c, "syncing");
      void setConnectState(c.id, { status: "syncing" });
      await finishSync(c, c.id as ConnectProvider);
    },
    [beginRun, finishSync],
  );

  const disconnectOAuth = useCallback(async (c: Connector) => {
    setSheet(null);
    try {
      await connectApi.disconnect(c.id as ConnectProvider);
    } catch {
      // best-effort; the stored row may already be gone
    }
    setConn((p) => {
      const next = { ...p };
      delete next[c.id];
      return next;
    });
    await clearConnectState(c.id);
  }, []);

  // -------------------------------------------------------------- gestures

  const pickFile = useCallback(
    async (c: Connector) => {
      try {
        const types = c.fileTypes ?? [];
        const res = await DocumentPicker.getDocumentAsync({
          type: types.length ? types : undefined,
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
    if (!c.exportUrl) return;
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
    let p = 0.08; // reading
    if (run.stage === "connecting") p = 0.12;
    else if (run.stage === "matching") p = 0.3 + (run.total > 0 ? 0.15 * Math.min(1, run.matched / run.total) : 0);
    else if (run.stage === "syncing") p = 0.5;
    else if (run.stage === "writing")
      p =
        0.45 +
        0.55 *
          (run.oauth
            ? run.matched > 0
              ? run.matchedShown / run.matched
              : 1
            : run.writeTotal > 0
              ? run.committed / run.writeTotal
              : 1);
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

  // Android back, answered once for all four internal states of this route (the
  // guide sheet is a Modal, so its own onRequestClose still takes precedence).
  //
  // Leaving mid-import is now SAFE rather than forbidden — runRef and
  // handoffResult carry the run and its summary across the unmount, so nothing
  // is abandoned and nothing is lost. But it is not free either: the theater is
  // the only place the pouring posters and the counters exist, and a run cannot
  // be re-entered once its screen is gone. So back asks instead of acting, and
  // the answer is a real choice rather than a reflex. On the completion view the
  // step back is to the hub — the leftovers list is the point of that screen.
  const inRun = run != null;
  const inResult = result != null;
  const onAndroidBack = useCallback(() => {
    // Paired with inRun, not read alone: the run can finish under the open
    // confirmation, and a flag left true would then eat a press on a screen that
    // shows nothing to dismiss.
    if (leaving && inRun) {
      setLeaving(false); // back over the confirmation means "never mind", not "leave"
      return true;
    }
    if (inRun) {
      setLeaving(true);
      return true;
    }
    if (inResult) {
      clearResult();
      return true;
    }
    return false; // hub: nothing owed, let the route pop
  }, [leaving, inRun, inResult, clearResult]);
  useAndroidBack(onAndroidBack);

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
            onPress={() => router.push({ pathname: "/onboarding", params: { step: "account" } })}
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
        {/* A screen with no way out is where users press back in the first place. */}
        <View style={{ paddingTop: insets.top + sp.s2, paddingHorizontal: sp.s4 }}>
          <BackDisc onPress={() => setLeaving(true)} />
        </View>
        <ScrollView
          contentContainerStyle={{
            paddingTop: sp.s5,
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
              {run.stage === "writing" && !run.oauth ? (
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
          {run.stage === "writing" && run.writeTotal > 0 && !run.oauth ? (
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

        {/* We can't recall a commit that is already writing on the server, so the
            only honest offer is "it keeps going". Saying so is the whole point of
            asking: the user leaves knowing the import is not being thrown away. */}
        {leaving ? (
          <LeaveSheet
            onStay={() => setLeaving(false)}
            onLeave={() => {
              setLeaving(false);
              goBack();
            }}
          />
        ) : null}
      </Screen>
    );
  }

  // ------------------------------------------------------------- completion

  if (result) {
    return (
      <CompletionView
        result={result}
        onShelf={() => router.push("/my")}
        onDone={clearResult}
        onUnmatchedTap={(u) =>
          router.push({ pathname: "/search", params: { q: u.title } })
        }
      />
    );
  }

  // -------------------------------------------------------------------- hub

  const tileW = Math.floor((width - sp.s4 * 2 - sp.s3) / 2);
  const sheetConnector = sheet ? connector(sheet) : null;
  const sheetState = sheet ? states[sheet] : undefined;
  const sheetStatus: ConnectorStatus = sheetState?.status ?? "idle";

  // Tile subtitle for an oauth connector: in-flight local state wins, then the
  // "coming soon" memo, then the server connection row, then idle.
  const oauthSub = (c: Connector): { line: string; color: string } => {
    const local = states[c.id]?.status;
    if (local === "authorizing")
      return { line: t("connect.stage.connecting"), color: brand.accent };
    if (local === "syncing" || local === "importing")
      return { line: t("connect.stage.syncing"), color: brand.accent };
    if (notConfigured[c.id])
      return { line: t("connect.oauth.comingSoon", { service: NAMES[c.id] }), color: pal.muted };
    const srv = conn[c.id];
    if (srv?.status === "connected") {
      const when = srv.last_sync_at ?? srv.created_at;
      return {
        line: t("connect.oauth.lastSynced", {
          date: new Date(when).toLocaleDateString(getLocale()),
        }),
        color: brand.tsGreen,
      };
    }
    if (srv?.status === "error" || local === "error")
      return { line: t("connect.status.error"), color: brand.tsRisk };
    return { line: t("connect.status.idle"), color: pal.muted };
  };

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
            const sub =
              c.kind === "oauth"
                ? oauthSub(c)
                : { line: statusLine(s), color: statusColor(st, pal.muted) };
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
                      color={sub.color}
                      style={{ marginTop: 2 }}
                      numberOfLines={2}
                    >
                      {sub.line}
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
        statusBarTranslucent
        navigationBarTranslucent
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
              {sheetConnector.kind === "oauth" ? (
                <OAuthSheet
                  c={sheetConnector}
                  connected={conn[sheetConnector.id]?.status === "connected"}
                  lastSyncedAt={
                    conn[sheetConnector.id]?.last_sync_at ??
                    conn[sheetConnector.id]?.created_at ??
                    null
                  }
                  comingSoon={!!notConfigured[sheetConnector.id]}
                  busy={starting === sheetConnector.id}
                  failed={sheetStatus === "error" || conn[sheetConnector.id]?.status === "error"}
                  onConnect={() => void runOAuth(sheetConnector)}
                  onSync={() => void syncOAuth(sheetConnector)}
                  onDisconnect={() => void disconnectOAuth(sheetConnector)}
                />
              ) : (
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
              )}
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
        {(c.stepKeys ?? []).map((k, i) => (
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

// ---------------------------------------------------------- oauth guide sheet
// One-line pitch + privacy line + one full-width CTA. Three states: coming soon
// (owner hasn't set credentials — muted, no button), connected (Sync now + quiet
// Disconnect), or fresh (Connect {service}).

function OAuthSheet({
  c,
  connected,
  lastSyncedAt,
  comingSoon,
  busy,
  failed,
  onConnect,
  onSync,
  onDisconnect,
}: {
  c: Connector;
  connected: boolean;
  lastSyncedAt: string | null;
  comingSoon: boolean;
  busy: boolean;
  failed: boolean;
  onConnect: () => void;
  onSync: () => void;
  onDisconnect: () => void;
}) {
  const pal = usePalette();
  const synced =
    connected && lastSyncedAt
      ? t("connect.oauth.lastSynced", {
          date: new Date(lastSyncedAt).toLocaleDateString(getLocale()),
        })
      : null;

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: sp.s3 }}>
        <Monogram c={c} size={40} />
        <View style={{ flex: 1 }}>
          <Ui size={fs.lg} weight="600">
            {NAMES[c.id]}
          </Ui>
          {comingSoon ? (
            <Ui size={fs.xs} weight="500" color={pal.muted}>
              {t("connect.oauth.comingSoon", { service: NAMES[c.id] })}
            </Ui>
          ) : synced ? (
            <Ui size={fs.xs} weight="500" color={brand.tsGreen}>
              {synced}
            </Ui>
          ) : null}
        </View>
      </View>

      {/* A handshake that failed says so here, or the CTA looks like it does
          nothing. Hidden while retrying — the button is the live answer then. */}
      {failed && !comingSoon && !busy ? (
        <Ui size={fs.sm} weight="500" color={brand.tsRisk} style={{ marginTop: sp.s3 }}>
          {t("connect.status.error")}
        </Ui>
      ) : null}

      {/* One-line pitch — the reassurance before a one-tap sign-in */}
      <Ui size={fs.sm} color={pal.inkSoft} style={{ marginTop: sp.s4 }}>
        {t("connect.oauth.pitch")}
      </Ui>

      {/* Privacy line stays in view — the user leaves calm */}
      <Ui size={fs.xs} color={pal.subtle} style={{ marginTop: sp.s3 }}>
        {t("connect.subtitle")}
      </Ui>

      {comingSoon ? (
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
          <Ionicons name="time-outline" size={16} color={pal.muted} style={{ marginTop: 2 }} />
          <Ui size={fs.sm} color={pal.inkSoft} style={{ flex: 1 }}>
            {t("connect.oauth.comingSoon", { service: NAMES[c.id] })}
          </Ui>
        </View>
      ) : connected ? (
        <>
          <GradientBtn
            label={t("connect.oauth.syncNow")}
            onPress={onSync}
            style={{ marginTop: sp.s4 }}
          />
          <Tactile onPress={onDisconnect} style={{ alignSelf: "center", marginTop: sp.s3 }}>
            <Ui size={fs.sm} weight="600" color={pal.muted} style={{ padding: sp.s2 }}>
              {t("connect.oauth.disconnect")}
            </Ui>
          </Tactile>
        </>
      ) : (
        <GradientBtn
          label={busy ? t("connect.stage.connecting") : t("connect.oauth.connect", { service: NAMES[c.id] })}
          onPress={onConnect}
          disabled={busy}
          style={{ marginTop: sp.s4 }}
        />
      )}
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
  onUnmatchedTap: (u: { title: string; year?: number }) => void;
}) {
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const filmsV = useCountUp(result.films);
  const ratingsV = useCountUp(result.ratings);
  const c = connector(result.id);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Steps back to the hub, not out of the route — the leftovers below are
          the one copy of this list, and the hub is where another import starts. */}
      <View style={{ paddingTop: insets.top + sp.s2, paddingHorizontal: sp.s4 }}>
        <BackDisc onPress={onDone} />
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingTop: sp.s5,
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
                <Tactile key={`${u.title}-${i}`} onPress={() => onUnmatchedTap(u)}>
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
