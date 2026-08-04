// Motion layer — "Lava, in motion" (owner 2026-07-30: 디자인 완성도를 극단적으로).
//
// Everything here is presentation-only: no data, no navigation, no copy (so it
// needs no i18n keys). Screens compose these instead of hand-rolling Animated
// values, which is what keeps the whole app moving to one rhythm — see the
// motion tokens in ../theme.
//
// Rules this layer follows:
//   - The gradient is still reserved for CTAs / active states / selection rings.
//   - Loading shows the SHAPE of what's coming (skeletons), never a bare spinner.
//   - Entrance staggers are capped, so a 400-row list is as snappy as a 7-row one.
//   - Haptics are advisory: web has no API and a failed buzz must never throw.
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  View,
  useColorScheme,
  type StyleProp,
  type View as RNView,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  makeMutable,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { brand, motion, radius, shimmerTint, sp, usePalette } from "../theme";

/** The three Lava stops, for dot rows and sequenced accents. */
const lava = { a: brand.gradA, b: brand.gradB, c: brand.gradC } as const;

// ---------------------------------------------------------------------------
// Haptics.
//
// The vocabulary moved to ../platform/haptics on 2026-08-03: WHEN a buzz may
// fire is a platform question (Android's motor cannot articulate a fast drag),
// and that does not belong in a presentation module. Re-exported here so the
// ~12 existing call sites keep their import path.
export { haptic } from "../platform/haptics";

// ---------------------------------------------------------------------------
// The page sweep.
//
// Owner 07-30: while a list of films is loading, one gradient should travel
// ACROSS THE WHOLE PAGE rather than each tile twinkling on its own clock. So
// every skeleton shares ONE driver and positions its band by where it actually
// sits on screen — the highlight passes over the page like a light, crossing
// each poster in turn. It is also cheaper: one animation for the whole screen
// instead of one per tile.
const sweep = makeMutable(0);
let sweepRunning = false;

function startSweep() {
  if (sweepRunning) return;
  sweepRunning = true;
  sweep.value = withRepeat(
    withTiming(1, { duration: motion.shimmer * 1.6, easing: Easing.inOut(Easing.ease) }),
    -1,
    false,
  );
}

// ---------------------------------------------------------------------------
// Shimmer + skeletons — the "반짝이기" that replaces spinners.

/**
 * A single shimmering block. Give it the size of the thing that's loading and
 * the wait reads as the content arriving rather than as an empty screen.
 */
export function Shimmer({
  width,
  height,
  rounded = radius.sm,
  style,
}: {
  /** Omit for flex-width (measured on layout). */
  width?: number;
  height: number;
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const scheme = useColorScheme();
  const tint = scheme === "dark" ? shimmerTint.dark : shimmerTint.light;
  const ref = useRef<RNView | null>(null);
  const [box, setBox] = useState({ w: width ?? 0, x: 0 });
  const screenW = Dimensions.get("window").width;
  // The band is wide enough to feel like one light crossing the page, not a
  // stripe inside each tile.
  const bandW = Math.round(screenW * 0.55);

  useEffect(() => {
    startSweep();
  }, []);

  const band = useAnimatedStyle(() => ({
    // Absolute screen position of the highlight, converted to this tile's
    // local space — that is what makes the sweep continuous across tiles.
    transform: [
      { translateX: interpolate(sweep.value, [0, 1], [-bandW, screenW + bandW]) - box.x },
    ],
  }));

  return (
    <View
      ref={ref}
      onLayout={() => {
        ref.current?.measureInWindow((x, _y, w) => {
          setBox((b) => (b.x === x && b.w === (width ?? w) ? b : { x, w: width ?? w }));
        });
      }}
      style={[
        {
          width: width ?? "100%",
          height,
          borderRadius: rounded,
          backgroundColor: tint.base,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, width: bandW }, band]}>
        <LinearGradient
          colors={["transparent", tint.sheen, tint.lava, "transparent"]}
          locations={[0, 0.42, 0.6, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

/** A shimmering text line. `w` is a fraction of the available width. */
export function SkeletonText({ w = 1, size = 13 }: { w?: number; size?: number }) {
  return (
    <View style={{ width: `${Math.round(w * 100)}%` }}>
      <Shimmer height={size} rounded={radius.xs / 2} />
    </View>
  );
}

/** Matches FilmRow: 48×72 poster, title line, meta line. */
export function SkeletonRow() {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: sp.s3,
        paddingHorizontal: sp.s4,
        paddingVertical: sp.s2 + 2,
      }}
    >
      <Shimmer width={48} height={72} rounded={radius.sm} />
      <View style={{ flex: 1, gap: sp.s2 }}>
        <SkeletonText w={0.66} size={14} />
        <SkeletonText w={0.4} size={11} />
      </View>
      <Shimmer width={40} height={20} rounded={radius.pill} />
    </View>
  );
}

/** Matches Tonight's deck card: wide image block, title, meta row. */
export function SkeletonCard({ imageHeight = 190 }: { imageHeight?: number }) {
  return (
    <View style={{ gap: sp.s3, paddingHorizontal: sp.s4, paddingVertical: sp.s3 }}>
      <Shimmer height={imageHeight} rounded={radius.md} />
      <SkeletonText w={0.55} size={16} />
      <SkeletonText w={0.35} size={12} />
    </View>
  );
}

/**
 * Matches the app's signature card (Tonight's deck, Navigator destinations):
 * portrait poster left at its natural 2:3, judgment column right.
 */
export function SkeletonSplitCard({ posterW = 116 }: { posterW?: number }) {
  const pal = usePalette();
  const posterH = Math.round(posterW * 1.5);
  return (
    <View
      style={{
        flexDirection: "row",
        borderRadius: radius.md,
        overflow: "hidden",
        backgroundColor: pal.card,
        borderWidth: 1,
        borderColor: pal.hairline,
      }}
    >
      <Shimmer width={posterW} height={posterH} rounded={0} />
      <View style={{ flex: 1, padding: sp.s3, justifyContent: "space-between" }}>
        <View style={{ gap: sp.s2 }}>
          <SkeletonText w={0.8} size={15} />
          <SkeletonText w={0.5} size={12} />
          <SkeletonText w={0.95} size={11} />
        </View>
        <View style={{ flexDirection: "row", gap: sp.s3 }}>
          {[0, 1, 2].map((i) => (
            <Shimmer key={i} width={40} height={40} rounded={radius.pill} />
          ))}
        </View>
      </View>
    </View>
  );
}

/** Three Lava dots breathing in sequence — inline "still working" for footers. */
export function Dots({ size = 8 }: { size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: size - 1, alignItems: "center" }}>
      {[lava.a, lava.b, lava.c].map((c, i) => (
        <Pulse key={i} delay={i * 160}>
          <View style={{ width: size, height: size, borderRadius: radius.pill, backgroundColor: c }} />
        </Pulse>
      ))}
    </View>
  );
}

/** Matches a poster rail: a row of portrait posters. */
export function SkeletonRail({
  count = 4,
  width = 104,
  height = 156,
}: {
  count?: number;
  width?: number;
  height?: number;
}) {
  return (
    <View style={{ flexDirection: "row", gap: sp.s3, paddingHorizontal: sp.s4 }}>
      {Array.from({ length: count }, (_, i) => (
        <Shimmer key={i} width={width} height={height} rounded={radius.md} />
      ))}
    </View>
  );
}

/** A block of list-row skeletons — for inline waits inside an existing scroller. */
export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

/** Full-surface waits. `kind` picks the shape of what's coming. */
export function SkeletonScreen({
  kind = "rows",
  count,
  style,
}: {
  kind?: "rows" | "cards" | "rail" | "split";
  count?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const pal = usePalette();
  const n = count ?? (kind === "cards" ? 3 : kind === "split" ? 4 : kind === "rail" ? 2 : 7);
  return (
    <View style={[{ flex: 1, backgroundColor: pal.bg, paddingTop: sp.s4 }, style]}>
      {Array.from({ length: n }, (_, i) =>
        kind === "cards" ? (
          <SkeletonCard key={i} />
        ) : kind === "split" ? (
          <View key={i} style={{ paddingHorizontal: sp.s4, paddingBottom: sp.s5 }}>
            <SkeletonSplitCard />
          </View>
        ) : kind === "rail" ? (
          <View key={i} style={{ gap: sp.s3, marginBottom: sp.s6 }}>
            <View style={{ paddingHorizontal: sp.s4 }}>
              <SkeletonText w={0.4} size={18} />
            </View>
            <SkeletonRail />
          </View>
        ) : (
          <SkeletonRow key={i} />
        ),
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Entrances.

/**
 * Rise + fade on mount, staggered by list position. Wrap list items and section
 * blocks; `index` is what turns a wall of content into a cascade.
 */
export function Appear({
  children,
  index = 0,
  from = "bottom",
  distance = motion.rise,
  style,
}: {
  children: React.ReactNode;
  index?: number;
  from?: "bottom" | "top" | "left" | "right" | "none";
  distance?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useSharedValue(0);
  // Only the first screenful cascades — rows reached by scrolling appear at once.
  const delay = index < motion.staggerCap ? index * motion.stagger : 0;

  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: motion.base, easing: Easing.out(Easing.cubic) }));
  }, [p, delay]);

  const anim = useAnimatedStyle(() => {
    const travel = interpolate(p.value, [0, 1], [distance, 0]);
    const t =
      from === "none"
        ? []
        : from === "bottom"
          ? [{ translateY: travel }]
          : from === "top"
            ? [{ translateY: -travel }]
            : from === "left"
              ? [{ translateX: -travel }]
              : [{ translateX: travel }];
    return { opacity: p.value, transform: t };
  });

  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** Scale-in with overshoot — for things that should feel like they landed. */
export function Pop({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useSharedValue(0.86);
  const o = useSharedValue(0);

  useEffect(() => {
    s.value = withDelay(delay, withSpring(1, motion.bouncy));
    o.value = withDelay(delay, withTiming(1, { duration: motion.fast }));
  }, [s, o, delay]);

  const anim = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: s.value }] }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** Slow breathing — for "this is live / still working" affordances. */
export function Pulse({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  /** Offset the cycle so a row of dots breathes in sequence. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true),
    );
  }, [p, delay]);
  const anim = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 1], [0.45, 1]),
    transform: [{ scale: interpolate(p.value, [0, 1], [0.94, 1]) }],
  }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

// ---------------------------------------------------------------------------
// Accents.

/**
 * A burst of dots radiating outward once, on every change of `trigger`.
 * Sits behind the thing it celebrates (hearts, "seen" ticks).
 */
export function Sparkle({
  trigger,
  color,
  count = 7,
  radius: r = 22,
  size = 4,
}: {
  /** Any changing value: a boolean flip or a counter. */
  trigger: number | boolean;
  color: string;
  count?: number;
  radius?: number;
  size?: number;
}) {
  const p = useSharedValue(0);
  const first = useRef(true);

  useEffect(() => {
    // Don't fire on mount — a card scrolling into view shouldn't celebrate.
    if (first.current) {
      first.current = false;
      return;
    }
    if (trigger === false) return;
    p.value = 0;
    p.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) });
  }, [trigger, p]);

  return (
    <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
      {Array.from({ length: count }, (_, i) => (
        <SparkleDot key={i} p={p} angle={(i / count) * Math.PI * 2} color={color} radius={r} size={size} />
      ))}
    </View>
  );
}

function SparkleDot({
  p,
  angle,
  color,
  radius: r,
  size,
}: {
  p: SharedValue<number>;
  angle: number;
  color: string;
  radius: number;
  size: number;
}) {
  const anim = useAnimatedStyle(() => {
    const d = interpolate(p.value, [0, 1], [size, r]);
    return {
      opacity: interpolate(p.value, [0, 0.25, 1], [0, 1, 0]),
      transform: [
        { translateX: Math.cos(angle) * d },
        { translateY: Math.sin(angle) * d },
        { scale: interpolate(p.value, [0, 0.4, 1], [0.4, 1, 0.3]) },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        { position: "absolute", width: size, height: size, borderRadius: radius.pill, backgroundColor: color },
        anim,
      ]}
    />
  );
}

/**
 * A specular highlight that sweeps across a surface every few seconds — the
 * quiet "this is the button" cue on primary CTAs. Absolutely positioned; the
 * parent must clip (overflow: hidden) and pass its own width.
 */
export function Sheen({ width, height, tint = "rgba(255,255,255,0.55)" }: { width: number; height: number; tint?: string }) {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withRepeat(
      withSequence(
        withTiming(1, { duration: motion.sheen, easing: Easing.inOut(Easing.cubic) }),
        withDelay(motion.sheenRest, withTiming(1, { duration: 0 })),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );
  }, [p]);

  const band = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(p.value, [0, 1], [-width * 0.6, width]) },
      { rotateZ: "18deg" },
    ],
    opacity: interpolate(p.value, [0, 0.15, 0.85, 1], [0, 1, 1, 0]),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", top: -height, width: width * 0.42, height: height * 3 }, band]}
    >
      <LinearGradient
        colors={["transparent", tint, "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}

/** A bar that springs to its value instead of snapping — coverage, import, routes. */
export function ProgressBar({
  value,
  tint,
  height = 6,
  track,
  rounded = radius.pill,
}: {
  /** 0–1. */
  value: number;
  tint: string;
  height?: number;
  track?: string;
  rounded?: number;
}) {
  const pal = usePalette();
  const p = useSharedValue(0);
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

  useEffect(() => {
    p.value = withDelay(120, withSpring(clamped, motion.gentle));
  }, [p, clamped]);

  const anim = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));

  return (
    <View style={{ height, borderRadius: rounded, backgroundColor: track ?? pal.hairline, overflow: "hidden" }}>
      <Animated.View style={[{ height, borderRadius: rounded, backgroundColor: tint }, anim]} />
    </View>
  );
}

/** Counts a number up on mount — for the one hero figure on a screen. */
export function useCountUp(target: number | null | undefined, ms = 700): number {
  const [shown, setShown] = useState(0);
  const to = typeof target === "number" && Number.isFinite(target) ? Math.round(target) : null;

  useEffect(() => {
    if (to == null) return;
    if (to === 0) {
      setShown(0);
      return;
    }
    const started = Date.now();
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - started) / ms);
      // ease-out so it decelerates into the real figure
      setShown(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k >= 1) clearInterval(id);
    }, 32);
    return () => clearInterval(id);
  }, [to, ms]);

  return to == null ? 0 : shown;
}
