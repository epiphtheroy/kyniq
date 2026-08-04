// The rating moment — ONE sheet for the whole app (owner 2026-08-03).
//
// The rule this file exists to keep: marking a film seen must ASK for the star
// rating immediately, the rating must be a single gesture, skipping must cost
// nothing, and giving a rating must need no confirm button — it saves itself,
// celebrates, and gets out of the way.
//
// So every "Seen it" surface (film detail, Tonight's deck, the Navigator drive,
// the You grid) calls promptRate() and gets the same interaction and the same
// motion. There is no second rating widget anywhere.
//
// Interaction:
//   drag or tap anywhere across the star track → half-star resolution, a haptic
//   tick per step, each star springing as it lights
//   release → rate_film fires (ledger is optimistic, §13-15), the stars burst,
//   the verdict lands, and the sheet closes itself ~1.3s later
//   change your mind before it closes → the timer restarts, no penalty
//   skip → tap the scrim, swipe down, or press Skip; the film stays seen
import Ionicons from "@expo/vector-icons/Ionicons";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Modal,
  PanResponder,
  Pressable,
  View,
  type View as RNView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { t } from "../i18n";
import { me } from "../lib/api";
import { verdictColor, verdictKey, verdictOf } from "../lib/verdict";
import { useFilms } from "../state/films";
import { brand, fs, motion, radius, shadow, sp, usePalette } from "../theme";
import { Sparkle, haptic } from "./motion";
import { PosterImg, Serif, Tactile, Ui } from "./ui";

/** How long the sheet lingers after a rating lands, so the flourish reads. */
const LINGER_MS = 1300;
const EXIT_MS = 180;

export type RateTarget = {
  slug: string;
  title: string;
  year?: number | null;
  posterPath?: string | null;
  /** Canon Standing — turns the rating into a Find/Aligned/Letdown verdict. */
  standing?: number | null;
  /** Called once the sheet closes: the rating that was saved, or null if skipped. */
  onDone?: (rating: number | null) => void;
};

const Ctx = createContext<{ promptRate: (target: RateTarget) => void }>({
  promptRate: () => {},
});

export function useRate() {
  return useContext(Ctx);
}

/** Mount once at the root — the sheet renders above every screen. */
export function RateProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<RateTarget | null>(null);
  // The callback is held outside state: firing it from inside a state updater
  // would run it twice under React's double-invoked updaters in dev.
  const doneRef = useRef<RateTarget["onDone"]>(undefined);
  const promptRate = useCallback((tg: RateTarget) => {
    doneRef.current = tg.onDone;
    setTarget(tg);
  }, []);
  const value = useMemo(() => ({ promptRate }), [promptRate]);

  const close = useCallback((rating: number | null) => {
    const done = doneRef.current;
    doneRef.current = undefined;
    setTarget(null);
    done?.(rating);
  }, []);

  return (
    <Ctx.Provider value={value}>
      {children}
      <RateSheet target={target} onClose={close} />
    </Ctx.Provider>
  );
}

// ---------------------------------------------------------------------------
// The star input.

type StarState = "full" | "half" | "empty";

function starStateAt(v: number, i: number): StarState {
  if (v >= i) return "full";
  if (v >= i - 0.5) return "half";
  return "empty";
}

/** One star that springs whenever its fill changes — the per-step reward. */
function StarGlyph({ state, size }: { state: StarState; size: number }) {
  const pal = usePalette();
  const s = useSharedValue(1);
  const first = useRef(true);

  useEffect(() => {
    // Don't animate the initial paint — a pre-filled rating shouldn't dance.
    if (first.current) {
      first.current = false;
      return;
    }
    s.value = withSequence(withSpring(1.3, motion.bouncy), withSpring(1, motion.snappy));
  }, [state, s]);

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const name = state === "full" ? "star" : state === "half" ? "star-half" : "star-outline";

  return (
    <Animated.View style={[{ flex: 1, alignItems: "center" }, anim]}>
      <Ionicons name={name} size={size} color={state === "empty" ? pal.hairline2 : brand.accent} />
    </Animated.View>
  );
}

/**
 * Drag-or-tap star track, 0.5–5. The whole row is one touch target divided into
 * five equal cells, so there is no small half-star hit box to hunt for: the value
 * is simply where your finger is. `onChange` fires live (preview + haptic);
 * `onCommit` fires once on release, which is what writes to the ledger.
 */
export function StarRate({
  value,
  onChange,
  onCommit,
  size = 42,
}: {
  value: number | null;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  size?: number;
}) {
  const boxRef = useRef<RNView | null>(null);
  const geom = useRef({ x: 0, w: 0 });
  const last = useRef<number | null>(value);
  last.current = value;

  // PanResponder is created once; the live handlers hang off a ref so the
  // gesture never runs against a stale closure.
  const fns = useRef({ move: (_x: number) => {}, release: () => {} });
  fns.current = {
    move: (x: number) => {
      const { w } = geom.current;
      if (w <= 0) return;
      const raw = (x / w) * 5;
      const next = Math.min(5, Math.max(0.5, Math.ceil(raw * 2) / 2));
      if (next !== last.current) {
        last.current = next;
        // step(), not select(): this fires from a moving finger and can cross ten
        // half-star notches in under 300ms. iOS renders ten crisp ticks; an
        // Android LRA motor turns the same sequence into one continuous rattle,
        // so the seam throttles it there and leaves iOS untouched.
        haptic.step();
        onChange(next);
      }
    },
    release: () => {
      if (last.current != null) onCommit?.(last.current);
    },
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Once the finger is on the stars it stays ours — a parent swipe-to-dismiss
        // must not steal a drag that is setting the rating.
        onPanResponderTerminationRequest: () => false,
        // Both use window coords minus the measured track origin, so the value
        // under your finger is identical whether you tapped or dragged there.
        onPanResponderGrant: (_e, g) => fns.current.move(g.x0 - geom.current.x),
        onPanResponderMove: (_e, g) => fns.current.move(g.moveX - geom.current.x),
        onPanResponderRelease: () => fns.current.release(),
      }),
    [],
  );

  const v = value ?? 0;

  return (
    <View
      ref={boxRef}
      onLayout={() =>
        boxRef.current?.measureInWindow((x, _y, w) => {
          geom.current = { x, w };
        })
      }
      {...pan.panHandlers}
      style={{ flexDirection: "row", alignItems: "center", paddingVertical: sp.s2 }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <StarGlyph key={i} state={starStateAt(v, i)} size={size} />
      ))}
    </View>
  );
}

/** Read-only compact stars — grids and rows. Renders nothing without a rating. */
export function MiniStars({
  value,
  size = 10,
  color = brand.accent,
}: {
  value: number | null | undefined;
  size?: number;
  color?: string;
}) {
  const pal = usePalette();
  if (value == null) {
    return (
      <View style={{ flexDirection: "row", gap: 1 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Ionicons key={i} name="star-outline" size={size} color={pal.hairline2} />
        ))}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: "row", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const st = starStateAt(value, i);
        return (
          <Ionicons
            key={i}
            name={st === "full" ? "star" : st === "half" ? "star-half" : "star-outline"}
            size={size}
            color={st === "empty" ? pal.hairline2 : color}
          />
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// The sheet.

function RateSheet({
  target,
  onClose,
}: {
  target: RateTarget | null;
  onClose: (rating: number | null) => void;
}) {
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const { entry, rate, toggleSeen } = useFilms();

  const [draft, setDraft] = useState<number | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [burst, setBurst] = useState(0);

  const p = useSharedValue(0); // 0 closed → 1 open
  const pulse = useSharedValue(1); // card kick on save
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exiting = useRef(false);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  // Open: seed the draft from the ledger so re-rating starts where you left off.
  useEffect(() => {
    if (!target) return;
    exiting.current = false;
    setDraft(entry(target.slug).rating);
    setSaved(null);
    setBurst(0);
    p.value = withSpring(1, motion.gentle);
    return clearTimer;
    // entry() is a stable callback over a ref — re-seeding on every ledger write
    // would fight the user mid-drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.slug]);

  useEffect(() => clearTimer, []);

  const dismiss = useCallback(
    (rating: number | null) => {
      if (exiting.current) return;
      exiting.current = true;
      clearTimer();
      p.value = withTiming(0, { duration: EXIT_MS, easing: Easing.in(Easing.cubic) });
      setTimeout(() => onClose(rating), EXIT_MS);
    },
    [onClose, p],
  );

  const commit = useCallback(
    (v: number) => {
      if (!target) return;
      setSaved(v);
      setBurst((b) => b + 1);
      haptic.success();
      pulse.value = withSequence(withSpring(1.02, motion.bouncy), withSpring(1, motion.snappy));
      void rate(target.slug, v);
      // A rating changes what should be recommended — drop the wwi memo here, in
      // the one place every rating in the app goes through.
      me.invalidateRecommend();
      // No confirm button: the sheet leaves on its own, and re-rating before it
      // does simply restarts the clock.
      clearTimer();
      timer.current = setTimeout(() => dismiss(v), LINGER_MS);
    },
    [target, rate, dismiss, pulse],
  );

  const onDrag = useCallback((v: number) => {
    clearTimer(); // still choosing — don't close under them
    setDraft(v);
  }, []);

  const onNotSeen = useCallback(() => {
    if (!target) return;
    const e = entry(target.slug);
    if (e.seen) void toggleSeen(target.slug, e.filmId ?? "");
    haptic.tap();
    dismiss(null);
  }, [target, entry, toggleSeen, dismiss]);

  // Swipe the card down to skip. Lives on the header block only, so it can never
  // race the star track's own gesture.
  const dismissRef = useRef<() => void>(() => {});
  dismissRef.current = () => dismiss(saved);
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 8 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderRelease: (_e, g) => {
          if (g.dy > 48 || g.vy > 0.6) dismissRef.current();
        },
      }),
    [],
  );

  const scrim = useAnimatedStyle(() => ({ opacity: p.value }));
  const card = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.35, 1], [0, 1, 1]),
    transform: [
      { translateY: interpolate(p.value, [0, 1], [56, 0]) },
      { scale: pulse.value },
    ],
  }));

  if (!target) return null;

  const shown = draft;
  const verdict = saved != null ? verdictOf(saved, target.standing ?? null) : null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={() => dismiss(saved)}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Animated.View style={[{ position: "absolute", inset: 0, backgroundColor: pal.scrim }, scrim]}>
          <Pressable style={{ flex: 1 }} onPress={() => dismiss(saved)} />
        </Animated.View>

        <Animated.View
          style={[
            {
              backgroundColor: pal.card,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              paddingHorizontal: sp.s5,
              paddingTop: sp.s3,
              paddingBottom: Math.max(insets.bottom, sp.s4) + sp.s2,
            },
            shadow.float,
            card,
          ]}
        >
          {/* Grabber + film + Skip — also the swipe-down handle */}
          <View {...swipe.panHandlers}>
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: sp.s3 }}>
              <PosterImg
                path={target.posterPath}
                width={44}
                height={66}
                size="w92"
                rounded={radius.xs}
              />
              <View style={{ flex: 1 }}>
                <Ui size={fs.xs} weight="600" color={pal.muted}>
                  {t("rate.title")}
                </Ui>
                <Serif size={fs.lg} bold numberOfLines={1} style={{ marginTop: 1 }}>
                  {target.title}
                </Serif>
                {target.year != null ? (
                  <Ui size={fs.xs} color={pal.muted}>
                    {String(target.year)}
                  </Ui>
                ) : null}
              </View>
              <Tactile onPress={() => dismiss(saved)} hitSlop={10} feedback="tap">
                <Ui size={fs.sm} weight="600" color={pal.muted}>
                  {t("rate.skip")}
                </Ui>
              </Tactile>
            </View>
          </View>

          {/* The one gesture */}
          <View style={{ marginTop: sp.s4 }}>
            <Sparkle
              trigger={burst}
              color={brand.accent}
              count={6 + Math.round((saved ?? 0) * 2)}
              radius={96}
              size={5}
            />
            <StarRate value={shown} onChange={onDrag} onCommit={commit} />
          </View>

          {/* Readout — the number, then the verdict once it has landed */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: sp.s3,
              minHeight: 30,
              marginTop: sp.s1,
            }}
          >
            {shown != null ? (
              <ScoreReadout value={shown} />
            ) : (
              <Ui size={fs.sm} color={pal.subtle}>
                {t("rate.hint")}
              </Ui>
            )}
            {verdict ? (
              <VerdictChip label={t(verdictKey(verdict))} color={verdictColor(verdict)} />
            ) : null}
            <View style={{ flex: 1 }} />
            {saved != null ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="checkmark-circle" size={15} color={brand.teal} />
                <Ui size={fs.xs} weight="600" color={brand.teal}>
                  {t("rate.saved")}
                </Ui>
              </View>
            ) : null}
          </View>

          <Tactile
            onPress={onNotSeen}
            hitSlop={6}
            style={{ alignSelf: "flex-start", marginTop: sp.s2 }}
          >
            <Ui size={fs.xs} color={pal.subtle} style={{ textDecorationLine: "underline" }}>
              {t("rate.notSeen")}
            </Ui>
          </Tactile>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** The live number — springs on every half-step so the drag has weight. */
function ScoreReadout({ value }: { value: number }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = withSequence(withSpring(1.22, motion.bouncy), withSpring(1, motion.snappy));
  }, [value, s]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={anim}>
      <Ui size={fs.lg} weight="700" color={brand.accent}>
        {value % 1 === 0 ? `${value}.0` : String(value)}
      </Ui>
    </Animated.View>
  );
}

function VerdictChip({ label, color }: { label: string; color: string }) {
  const s = useSharedValue(0);
  useEffect(() => {
    s.value = withSpring(1, motion.bouncy);
  }, [label, s]);
  const anim = useAnimatedStyle(() => ({
    opacity: s.value,
    transform: [{ scale: interpolate(s.value, [0, 1], [0.7, 1]) }],
  }));
  return (
    <Animated.View
      style={[
        {
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: color,
          paddingHorizontal: 10,
          paddingVertical: 3,
        },
        anim,
      ]}
    >
      <Ui size={fs.xs} weight="600" color={color}>
        {label}
      </Ui>
    </Animated.View>
  );
}
