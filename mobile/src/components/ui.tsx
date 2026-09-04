// Shared primitives — design system v2 "Lava" (see src/theme.ts header).
// Gradient CTAs, soft-shadow cards, springy press feedback, pill chrome.
// Motion (shimmer, sparkle, sheen, entrances, haptics) lives in ./motion so
// this file stays about grammar; the two share the tokens in ../theme.
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
  type ImageStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { TMDB_IMG } from "../config";
import { brand, font, fs, gradient, motion, radius, shadow, sp, tierColor, usePalette } from "../theme";
import { Appear, Dots, Pop, Sheen, Sparkle, haptic } from "./motion";
import { glyphs, pressFeedback } from "../platform/tokens";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Ripple tint. Neutral rather than Lava: the ripple appears under content of
 *  every colour, and a branded ripple under a red CTA reads as a smear. */
const rippleTint = "rgba(0,0,0,0.10)";

/** Which haptic a tappable fires. "none" for pure navigation. */
export type Feedback = "none" | "tap" | "select" | "press";

function fireFeedback(kind: Feedback) {
  if (kind === "tap") haptic.tap();
  else if (kind === "select") haptic.select();
  else if (kind === "press") haptic.press();
}

/** Spring press-scale wrapper — every tappable surface feels tactile. */
export function Tactile({
  onPress,
  disabled,
  style,
  children,
  hitSlop,
  feedback = "none",
}: {
  onPress?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  hitSlop?: number;
  /** Haptic to fire on press. Default silent — buzzing every tap is noise. */
  feedback?: Feedback;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      onPress={
        onPress
          ? (e: GestureResponderEvent) => {
              fireFeedback(feedback);
              onPress(e);
            }
          : undefined
      }
      // A 0.96 spring is legible on a chip and nearly invisible on a full-width
      // row, which is most of this app. iOS accepts that — it has no other press
      // affordance and users are used to it. Android does not: a tappable with
      // no ripple reads as inert, so a dense list feels like it is ignoring you.
      // Both platforms keep the spring; Android adds the ripple its users expect.
      // The system click is suppressed because this app has its own haptic
      // vocabulary and the two together read as a double response.
      android_ripple={pressFeedback.ripple ? { color: rippleTint, foreground: true } : undefined}
      android_disableSound={pressFeedback.suppressSystemSound}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() => {
        scale.value = withSpring(motion.pressScale, motion.spring);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.spring);
      }}
      style={[anim, style]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Display serif — reserved for film/director titles (the editorial thread). */
export function Serif({
  children,
  size = fs.lg,
  bold = false,
  italic = false,
  color,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const pal = usePalette();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: italic ? font.serifItalic : bold ? font.serifBold : font.serif,
          fontSize: size,
          lineHeight: size * 1.28,
          color: color ?? pal.ink,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** UI sans (Inter — the Cereal analog). Default voice of the app. */
export function Ui({
  children,
  size = fs.sm,
  weight = "400",
  color,
  style,
  numberOfLines,
  onTextLayout,
}: {
  children: React.ReactNode;
  size?: number;
  weight?: "400" | "500" | "600" | "700";
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /** Fires with the laid-out lines. A caller that clamps with `numberOfLines`
   *  uses it to learn whether the clamp actually hid anything — the only answer
   *  that survives a change of language, font scale or screen width. */
  onTextLayout?: TextProps["onTextLayout"];
}) {
  const pal = usePalette();
  const fam =
    weight === "700" ? font.uiBold : weight === "600" ? font.uiSemi : weight === "500" ? font.uiMed : font.ui;
  return (
    <Text
      numberOfLines={numberOfLines}
      onTextLayout={onTextLayout}
      style={[{ fontFamily: fam, fontSize: size, color: color ?? pal.ink, lineHeight: size * 1.45 }, style]}
    >
      {children}
    </Text>
  );
}

export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  const pal = usePalette();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: pal.hairline }, style]} />;
}

/** Section header — big friendly sans semibold (benchmark listing sections).
 *  Owner 07-30 density pass: the leading gap came down a step (32→24). Five
 *  sections a screen, so this is ~40pt of content handed back per scroll, and
 *  the sections still breathe. */
export function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  const pal = usePalette();
  return (
    <View style={{ marginTop: sp.s5, marginBottom: sp.s3, paddingHorizontal: sp.s4 }}>
      <Ui size={fs.xl} weight="600">
        {children}
      </Ui>
      {sub ? (
        <Ui size={fs.sm} color={pal.muted} style={{ marginTop: 2 }}>
          {sub}
        </Ui>
      ) : null}
    </View>
  );
}

/**
 * Poster. Dissolves in when the bits land instead of snapping — with hundreds of
 * posters in the app this single fade is the biggest perceived-quality lever.
 * onLoadEnd (not onLoad) drives it so a failed fetch still reveals the plate.
 */
export function PosterImg({
  path,
  width,
  height,
  size = "w342",
  rounded = radius.sm,
  style,
}: {
  path: string | null | undefined;
  width: number;
  height: number;
  size?: "w92" | "w185" | "w342" | "w500" | "w780";
  rounded?: number;
  style?: StyleProp<ImageStyle>;
}) {
  const pal = usePalette();
  const o = useSharedValue(0);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  const reveal = React.useCallback(() => {
    o.value = withTiming(1, { duration: motion.base, easing: Easing.out(Easing.quad) });
  }, [o]);
  // Belt and braces: onLoadEnd covers success AND failure, but a poster that
  // somehow never reports (a platform quirk, a stalled decode) must not stay
  // invisible forever — with posters on every surface that would read as an
  // empty app, so a timer reveals it regardless.
  useEffect(() => {
    const id = setTimeout(reveal, 2500);
    return () => clearTimeout(id);
  }, [reveal]);
  if (!path) {
    return <View style={[{ width, height, borderRadius: rounded, backgroundColor: pal.surface }, style]} />;
  }
  return (
    <Animated.Image
      source={{ uri: `${TMDB_IMG}/${size}${path}` }}
      onLoadEnd={reveal}
      style={[{ width, height, borderRadius: rounded, backgroundColor: pal.surface }, style, anim]}
      resizeMode="cover"
    />
  );
}

/**
 * TakeScore chip — floating white pill with a soft shadow (the benchmark's
 * over-image badge grammar). Display clamps 0–100; ranking/API keep raw.
 */
export function TSBadge({
  ts,
  size = fs.sm,
  onImage = false,
  pop = false,
}: {
  ts: number | null | undefined;
  size?: number;
  onImage?: boolean;
  /** Land it with a spring — for the one hero score on a screen, not list badges. */
  pop?: boolean;
}) {
  const pal = usePalette();
  if (ts == null) return null;
  const shown = Math.max(0, Math.min(100, Math.round(ts)));
  const badge = (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 3,
          borderRadius: radius.pill,
          paddingHorizontal: 9,
          paddingVertical: 4,
          backgroundColor: onImage ? "rgba(255,255,255,0.96)" : pal.card,
        },
        onImage ? shadow.card : { borderWidth: StyleSheet.hairlineWidth, borderColor: pal.hairline2 },
      ]}
    >
      <Text
        style={{
          fontFamily: font.uiSemi,
          fontVariant: ["tabular-nums"],
          fontSize: size,
          color: onImage ? "#222222" : pal.ink,
        }}
      >
        {shown}
      </Text>
      <Text style={{ fontFamily: font.uiMed, fontSize: size - 3, color: onImage ? "#6A6A6A" : pal.muted }}>
        TS
      </Text>
    </View>
  );
  return pop ? <Pop>{badge}</Pop> : badge;
}

/** Wishlist heart over an image — the benchmark's signature card affordance. */
export function HeartButton({
  active,
  onPress,
  size = 26,
}: {
  active: boolean;
  onPress: () => void;
  size?: number;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  // Bumped on every *add* so the burst fires then and not on un-hearting.
  const [burst, setBurst] = useState(0);
  return (
    <View>
      <Sparkle trigger={burst} color={brand.accent} radius={size * 0.95} />
      <AnimatedPressable
        hitSlop={10}
        onPress={() => {
          // One overshoot, one settle — no timers to leak.
          scale.value = withSequence(
            withSpring(1.3, { damping: 7, stiffness: 340 }),
            withSpring(1, motion.spring),
          );
          if (!active) {
            setBurst((b) => b + 1);
            haptic.press();
          } else {
            haptic.tap();
          }
          onPress();
        }}
        style={anim}
      >
        <Ionicons
          name={active ? "heart" : "heart-outline"}
          size={size}
          color={active ? brand.accent : "#FFFFFF"}
          style={{
            textShadowColor: "rgba(0,0,0,0.45)",
            textShadowRadius: 6,
            textShadowOffset: { width: 0, height: 1 },
          }}
        />
      </AnimatedPressable>
    </View>
  );
}

/** Availability dots: ● sub ● free ● rent/buy. */
export function AvailabilityDots({ tiers }: { tiers: string[] }) {
  if (!Array.isArray(tiers)) return null; // a drifted BFF row with tiers null must skip, not crash the card
  const groups = [...new Set(tiers.map(tierColor))];
  if (!groups.length) return null;
  return (
    <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
      {groups.map((c) => (
        <View key={c} style={{ width: 7, height: 7, borderRadius: radius.pill, backgroundColor: c }} />
      ))}
    </View>
  );
}

/**
 * Primary CTA — the Lava gradient (benchmark "Reserve" grammar), with a slow
 * specular sweep so the one affirmative action on a screen catches the eye
 * without shouting. Disabled CTAs stay still.
 */
export function GradientBtn({
  label,
  onPress,
  disabled,
  style,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  return (
    <Tactile onPress={onPress} disabled={disabled} style={style} feedback="tap">
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setBox((b) => (b.w === width && b.h === height ? b : { w: width, h: height }));
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          borderRadius: radius.xs,
          paddingVertical: 15, // ≥52pt total — comfortable thumb target for the primary CTA
          overflow: "hidden", // clips the sweep to the button
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {!disabled && box.w > 0 ? <Sheen width={box.w} height={box.h} /> : null}
        {icon ? <Ionicons name={icon} size={17} color={brand.accentInk} /> : null}
        <Ui size={fs.md} weight="600" color={brand.accentInk}>
          {label}
        </Ui>
      </LinearGradient>
    </Tactile>
  );
}

/** Buttons: primary = gradient CTA, ghost = quiet outlined. */
export function Btn({
  label,
  onPress,
  kind = "primary",
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "ghost";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const pal = usePalette();
  if (kind === "primary") {
    return <GradientBtn label={label} onPress={onPress} disabled={disabled} style={style} />;
  }
  return (
    <Tactile onPress={onPress} disabled={disabled} style={style}>
      <View
        style={{
          borderRadius: radius.xs,
          borderWidth: 1,
          borderColor: pal.ink,
          paddingVertical: 13,
          alignItems: "center",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Ui size={fs.md} weight="600">
          {label}
        </Ui>
      </View>
    </Tactile>
  );
}

/**
 * Filter chip — the benchmark's category-strip pill.
 * Selecting crossfades a fully-painted active copy over the resting one (so the
 * fill AND the label change together, with no half-beat of dark-on-dark) and
 * springs the pill a hair proud of the row. The gradient stays out of here: with
 * multi-select, four gradient pills would fight each other and the CTA.
 */
export function Chip({
  label,
  active = false,
  onPress,
  icon,
  accessibilityLabel,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  /** Spell the chip out when the label alone can't (e.g. a bare country flag). */
  accessibilityLabel?: string;
}) {
  const pal = usePalette();
  const a = useSharedValue(active ? 1 : 0);
  const lift = useSharedValue(1);
  const firstRun = React.useRef(true);

  useEffect(() => {
    a.value = withTiming(active ? 1 : 0, { duration: motion.fast, easing: Easing.out(Easing.quad) });
    // Don't bounce chips on first paint — only when the user actually toggles.
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    lift.value = withSequence(withSpring(1.07, motion.bouncy), withSpring(1, motion.snappy));
  }, [active, a, lift]);

  const activeLayer = useAnimatedStyle(() => ({ opacity: a.value }));
  const liftStyle = useAnimatedStyle(() => ({ transform: [{ scale: lift.value }] }));

  const inner = (on: boolean) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        borderRadius: radius.pill,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: on ? pal.ink : pal.card,
        borderWidth: on ? 0 : StyleSheet.hairlineWidth,
        borderColor: pal.hairline2,
      }}
    >
      {icon ? <Ionicons name={icon} size={14} color={on ? pal.bg : pal.ink} /> : null}
      <Ui size={fs.sm} weight={on ? "600" : "500"} color={on ? pal.bg : pal.ink}>
        {label}
      </Ui>
    </View>
  );

  return (
    <Tactile onPress={onPress} feedback={onPress ? "select" : "none"}>
      <Animated.View
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ selected: active }}
        style={liftStyle}
      >
        {inner(false)}
        <Animated.View style={[{ position: "absolute", inset: 0 }, activeLayer]}>{inner(true)}</Animated.View>
      </Animated.View>
    </Tactile>
  );
}

/**
 * A chip that names its current choice and opens a sheet of options — one pill
 * where a row of mutually-exclusive chips used to be. Sort and era together now
 * cost two chips instead of eight, and the current setting is always readable
 * instead of being inferred from which pill happens to be filled.
 */
export function PickerChip({
  label,
  value,
  icon,
  onPress,
  active = false,
}: {
  /** What it controls ("Sort"), shown only when nothing is chosen. */
  label: string;
  /** The current choice ("TakeScore") — this is what people read. */
  value: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  /** True when the choice is off the default, so it reads as an applied filter. */
  active?: boolean;
}) {
  const pal = usePalette();
  return (
    <Tactile onPress={onPress} feedback="select">
      <View
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          borderRadius: radius.pill,
          paddingLeft: 12,
          paddingRight: 9,
          paddingVertical: 8,
          backgroundColor: active ? pal.ink : pal.card,
          borderWidth: active ? 0 : StyleSheet.hairlineWidth,
          borderColor: pal.hairline2,
        }}
      >
        {icon ? <Ionicons name={icon} size={14} color={active ? pal.bg : pal.muted} /> : null}
        <Ui size={fs.sm} weight="600" color={active ? pal.bg : pal.ink}>
          {value}
        </Ui>
        <Ionicons name="chevron-down" size={13} color={active ? pal.bg : pal.muted} />
      </View>
    </Tactile>
  );
}

/** One option inside a PickerSheet. */
export type PickerOption = { key: string; label: string; hint?: string };

/** The sheet a PickerChip opens — options, a tick on the live one, tap to pick. */
export function PickerSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  multiple = false,
}: {
  visible: boolean;
  title: string;
  options: PickerOption[];
  /** A key for single-select, the chosen keys for multi. */
  selected: string | string[];
  onSelect: (key: string) => void;
  onClose: () => void;
  /** Keep the sheet open and toggle keys, instead of picking one and closing. */
  multiple?: boolean;
}) {
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      // Android: a Modal is its OWN window and does not inherit the activity's
      // edge-to-edge flags. Without these two the window is inset below the
      // status bar and above the nav bar, so a full-screen scrim stops short of
      // both and the sheet looks like it is floating in a letterbox. RateSheet
      // already set statusBarTranslucent; this one did not, which is exactly the
      // asymmetry a shared contract exists to prevent.
      statusBarTranslucent
      navigationBarTranslucent
    >
      <Pressable style={{ flex: 1, backgroundColor: pal.scrim }} onPress={onClose} />
      <View
        style={{
          backgroundColor: pal.bg,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          paddingBottom: insets.bottom + sp.s4,
          paddingTop: sp.s3,
        }}
      >
        <View style={{ alignItems: "center", paddingBottom: sp.s3 }}>
          <View style={{ width: 36, height: 4, borderRadius: radius.pill, backgroundColor: pal.hairline2 }} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: sp.s4 }}>
          <Ui size={fs.xs} weight="700" color={pal.muted} style={{ flex: 1, letterSpacing: 0.6 }}>
            {title.toUpperCase()}
          </Ui>
          {multiple ? (
            <Tactile onPress={onClose} hitSlop={10} feedback="tap">
              <Ionicons name="close" size={20} color={pal.ink} />
            </Tactile>
          ) : null}
        </View>
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingTop: sp.s2 }}>
          {options.map((o, i) => {
            const on = Array.isArray(selected) ? selected.includes(o.key) : o.key === selected;
            return (
              <Appear key={o.key} index={i}>
                <Tactile
                  feedback="select"
                  onPress={() => {
                    onSelect(o.key);
                    if (!multiple) onClose();
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: sp.s3,
                      paddingHorizontal: sp.s4,
                      paddingVertical: sp.s3 + 2,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Ui size={fs.md} weight={on ? "600" : "400"}>
                        {o.label}
                      </Ui>
                      {o.hint ? (
                        <Ui size={fs.xs} color={pal.muted} style={{ marginTop: 1 }}>
                          {o.hint}
                        </Ui>
                      ) : null}
                    </View>
                    {on ? <Ionicons name="checkmark" size={19} color={brand.accent} /> : null}
                  </View>
                </Tactile>
              </Appear>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** The pill search bar with a soft shadow — the benchmark's front door. */
export function SearchPill({
  placeholder,
  onPress,
  children,
}: {
  placeholder?: string;
  onPress?: () => void;
  children?: React.ReactNode;
}) {
  const pal = usePalette();
  return (
    <Tactile onPress={onPress} feedback={onPress ? "tap" : "none"}>
      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            gap: sp.s3,
            borderRadius: radius.pill,
            backgroundColor: pal.card,
            paddingHorizontal: sp.s4,
            paddingVertical: 13,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: pal.hairline,
          },
          shadow.card,
        ]}
      >
        <Ionicons name="search" size={18} color={pal.ink} />
        {children ?? (
          <Ui size={fs.sm} weight="500" color={pal.muted}>
            {placeholder ?? ""}
          </Ui>
        )}
      </View>
    </Tactile>
  );
}

/** Compact search-icon disc for tab headers — the always-reachable global search
 * affordance (owner 07-29: a search icon in every tab header). Caller wires onPress
 * to the Explore search route so search is one tap from anywhere. */
export function HeaderSearch({ onPress }: { onPress: () => void }) {
  const pal = usePalette();
  return (
    <Tactile onPress={onPress} hitSlop={8} feedback="tap">
      <View
        accessibilityRole="button"
        accessibilityLabel="Search"
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.pill,
          backgroundColor: pal.surface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="search" size={18} color={pal.ink} />
      </View>
    </Tactile>
  );
}

/**
 * Waiting, in the brand's voice — three Lava dots breathing in sequence instead
 * of the platform spinner. Surfaces whose shape is predictable should prefer a
 * skeleton (see SkeletonScreen in ./motion); this is the fallback for the rest.
 */
export function Loading() {
  const pal = usePalette();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: pal.bg }}>
      <Dots />
    </View>
  );
}

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const pal = usePalette();
  return <View style={[{ flex: 1, backgroundColor: pal.bg }, style]}>{children}</View>;
}

// ---------------------------------------------------------------------------
// v4 judgment components (§3) — all inside the Lava grammar: the gradient only
// ever paints the affirmative CTA; pass/seen stay neutral; Stale uses the risk
// token, never brand red; my-rating stars never sit inside the TakeScore group
// (never-blend, §13-18).

// Rating input moved out of this file: it is now the drag-to-rate track inside
// the one shared sheet (components/RateSheet.tsx — StarRate / MiniStars), so a
// rating is never two different widgets depending on which screen you're on.

/** V/C/R micro-bars — TakeScore-semantic colors, grouped apart from user signals. */
export function VcrBars({
  v,
  c,
  r,
  width = 74,
}: {
  v: number | null | undefined;
  c: number | null | undefined;
  r: number | null | undefined;
  width?: number;
}) {
  const pal = usePalette();
  const rows: { val: number; color: string }[] = [
    { val: Math.max(0, v ?? 0), color: brand.tsGreen },
    { val: Math.max(0, c ?? 0), color: brand.tsCost },
    { val: Math.max(0, r ?? 0), color: brand.tsRisk },
  ];
  const max = Math.max(1, ...rows.map((x) => x.val));
  if (v == null && c == null && r == null) return null;
  return (
    <View style={{ gap: 3, width }}>
      {rows.map((row, i) => (
        <View
          key={i}
          style={{ height: 3, borderRadius: 2, backgroundColor: pal.hairline, overflow: "hidden" }}
        >
          <View
            style={{
              width: `${Math.round((row.val / max) * 100)}%`,
              height: 3,
              borderRadius: 2,
              backgroundColor: row.color,
            }}
          />
        </View>
      ))}
    </View>
  );
}

/** Reason chip — server-supplied evidence only (§13-17). Quiet, never gradient. */
export function ReasonChip({ label }: { label: string }) {
  const pal = usePalette();
  return (
    <View
      style={{
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: pal.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: pal.hairline2,
      }}
    >
      <Ui size={fs.xs} weight="500" color={pal.inkSoft}>
        {label}
      </Ui>
    </View>
  );
}

/** Watchlist commitment-decay badge (Fresh/Aging/Stale). Pass label + tone in. */
export function AgeBadge({ label, color }: { label: string; color: string }) {
  return (
    <View
      style={{
        borderRadius: radius.pill,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderWidth: 1,
        borderColor: color,
      }}
    >
      <Text style={{ fontFamily: font.uiMed, fontSize: fs.xs - 1, color }}>{label}</Text>
    </View>
  );
}

/**
 * The judgment bar — ♥ want / ✕ pass / ✓ seen. Fixed at the screen bottom by the
 * parent. Gradient paints ONLY the affirmative "want" when inactive (the CTA);
 * active states collapse to quiet ink fills so a judged film reads as settled.
 */
export function JudgeBar({
  want,
  passed,
  seen,
  busy,
  onWant,
  onPass,
  onSeen,
  labels,
}: {
  want: boolean;
  passed: boolean;
  seen: boolean;
  busy?: boolean;
  onWant: () => void;
  onPass: () => void;
  onSeen: () => void;
  labels: { want: string; pass: string; seen: string };
}) {
  const pal = usePalette();

  const Seg = ({
    active,
    icon,
    label,
    onPress,
    activeColor,
  }: {
    active: boolean;
    icon: React.ComponentProps<typeof Ionicons>["name"];
    label: string;
    onPress: () => void;
    activeColor?: string;
  }) => (
    <Tactile onPress={onPress} disabled={busy} style={{ flex: 1 }} feedback="press">
      {/* Re-keyed on state so the verb pops the moment the judgment lands. */}
      <Pop key={active ? "on" : "off"}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            borderRadius: radius.pill,
            paddingVertical: 11,
            backgroundColor: active ? (activeColor ?? pal.ink) : "transparent",
          }}
        >
          <Ionicons name={icon} size={16} color={active ? pal.bg : pal.ink} />
          <Ui size={fs.sm} weight="600" color={active ? pal.bg : pal.ink} numberOfLines={1}>
            {label}
          </Ui>
        </View>
      </Pop>
    </Tactile>
  );

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          borderRadius: radius.pill,
          padding: 4,
          backgroundColor: pal.card,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: pal.hairline,
        },
        shadow.float,
      ]}
    >
      {want ? (
        <Seg active icon="heart" label={labels.want} onPress={onWant} activeColor={brand.accent} />
      ) : (
        <Tactile onPress={onWant} disabled={busy} style={{ flex: 1 }} feedback="press">
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              borderRadius: radius.pill,
              paddingVertical: 11,
            }}
          >
            <Ionicons name="heart-outline" size={16} color={brand.accentInk} />
            <Ui size={fs.sm} weight="600" color={brand.accentInk} numberOfLines={1}>
              {labels.want}
            </Ui>
          </LinearGradient>
        </Tactile>
      )}
      <Seg active={passed} icon={passed ? "close-circle" : "close"} label={labels.pass} onPress={onPass} />
      <Seg
        active={seen}
        icon={seen ? "checkmark-circle" : "checkmark"}
        label={labels.seen}
        onPress={onSeen}
        activeColor={brand.teal}
      />
    </View>
  );
}

/** Brand wordmark — the serif M lineage in text form, with the Lava tick.
    The ONE place the editorial serif carries chrome (brand thread, §3). */
/* The brand symbol — the boxed M with its t and red dot — traced from the designer's
   vector set (brand/metatake-logo-set.ai, 2026-09-04). Ink follows the palette; the
   dot is the fixed brand red, which is not the app's accent. */
const LOGO_RED = "#E3120B";
const SYMBOL_VIEWBOX = "0 0 1000.0 932.8";
const SYMBOL_RATIO = 1.07204;
const SYMBOL_INK = [
  "M 653.62 673.76 L 57.65 673.76 L 57.65 57.65 L 653.62 57.65Z M 883.94 860.33 C 854.30 860.33 839.48 843.93 839.48 814.92 L 839.48 669.89 L 920.03 669.89 L 920.03 600.52 L 839.48 600.52 L 839.48 514.13 L 751.19 514.13 L 751.19 600.52 L 711.26 600.52 L 711.26 0.00 L 0.00 0.00 L 0.00 731.41 L 711.26 731.41 L 711.26 669.89 L 751.19 669.89 L 751.19 817.44 C 751.19 893.75 787.92 932.85 858.81 932.85 C 883.30 932.85 907.14 929.69 920.67 924.65 L 920.67 854.65 C 912.30 857.81 899.41 860.33 883.94 860.33",
  "M 192.07 238.40 L 319.02 565.05 L 386.68 565.05 L 512.99 238.40 L 512.99 565.05 L 596.76 565.05 L 596.76 123.63 L 481.42 123.63 L 352.53 453.44 L 223.65 123.63 L 108.30 123.63 L 108.30 565.05 L 192.07 565.05Z"
];
const SYMBOL_DOT =
  "M 1000.00 489.61 C 1000.00 520.63 974.85 545.78 943.82 545.78 C 912.80 545.78 887.65 520.63 887.65 489.61 C 887.65 458.58 912.80 433.43 943.82 433.43 C 974.85 433.43 1000.00 458.58 1000.00 489.61";

export function BrandSymbol({ height = 24, color }: { height?: number; color?: string }) {
  const pal = usePalette();
  const ink = color ?? pal.ink;
  return (
    <Svg width={Math.round(height * SYMBOL_RATIO)} height={height} viewBox={SYMBOL_VIEWBOX}>
      {SYMBOL_INK.map((d, i) => (
        <Path key={i} d={d} fill={ink} />
      ))}
      <Path d={SYMBOL_DOT} fill={LOGO_RED} />
    </Svg>
  );
}

/* The two-line "Meta / take" wordmark, same source. Owner 09-04: the header carries
   this, not symbol + name — the one-line form read like another menu item. */
const STACK_VIEWBOX = "0 0 1000.0 689.8";
const STACK_RATIO = 1.44970;
const STACK_INK = [
  "M 65.52 74.79 L 135.31 74.79 L 213.28 274.33 L 291.25 74.79 L 361.04 74.79 L 361.04 341.86 L 310.36 341.86 L 310.36 144.23 L 233.94 341.86 L 193.01 341.86 L 116.20 144.23 L 116.20 341.86 L 65.52 341.86Z",
  "M 593.39 268.64 C 589.88 243.84 573.12 226.67 546.61 226.67 C 520.49 226.67 503.33 244.60 498.65 268.64Z M 546.61 189.67 C 610.94 189.67 644.46 234.69 644.46 292.29 L 644.46 304.88 L 497.10 304.88 C 499.04 334.64 517.37 357.15 548.56 357.15 C 573.51 357.15 586.76 345.71 593.39 330.82 L 641.74 330.82 C 632.38 370.12 596.12 397.21 548.95 397.21 C 483.84 397.21 446.02 351.81 446.02 293.44 C 446.02 235.45 487.35 189.67 546.61 189.67",
  "M 676.82 200.94 L 676.82 111.67 L 644.46 111.67 L 644.46 69.70 L 676.82 69.70 L 676.82 17.44 L 730.24 17.44 L 730.24 69.70 L 778.97 69.70 L 778.97 111.67 L 730.24 111.67 L 730.24 199.42 C 730.24 216.97 739.20 226.89 757.14 226.89 C 766.49 226.89 774.29 225.36 779.36 223.45 L 779.36 265.80 C 771.17 268.85 756.75 270.76 741.93 270.76 C 699.05 270.76 676.82 247.11 676.82 200.94",
  "M 902.53 310.95 C 929.82 310.95 946.98 294.17 946.98 265.55 L 946.98 252.20 L 908.38 255.25 C 884.21 257.16 869.00 264.03 869.00 282.72 C 869.00 299.51 881.09 310.95 902.53 310.95 M 897.85 221.30 L 946.98 217.48 L 946.98 210.23 C 946.98 190.40 935.67 177.80 912.28 177.80 C 890.84 177.80 877.58 189.63 875.24 204.89 L 824.56 204.89 C 830.79 165.60 864.32 138.89 912.28 138.89 C 969.59 138.89 1000.00 168.65 1000.00 213.67 L 1000.00 341.86 L 948.54 341.86 L 948.54 314.77 C 940.74 331.94 918.52 346.43 888.11 346.43 C 845.22 346.43 817.54 322.02 817.54 284.25 C 817.54 245.33 845.22 225.11 897.85 221.30",
  "M 76.05 619.99 L 76.05 530.71 L 43.69 530.71 L 43.69 488.75 L 76.05 488.75 L 76.05 436.48 L 129.46 436.48 L 129.46 488.75 L 178.19 488.75 L 178.19 530.71 L 129.46 530.71 L 129.46 618.46 C 129.46 636.01 138.43 645.93 156.36 645.93 C 165.72 645.93 173.52 644.40 178.58 642.50 L 178.58 684.85 C 170.40 687.90 155.97 689.80 141.16 689.80 C 98.27 689.80 76.05 666.15 76.05 619.99",
  "M 431.59 654.32 C 458.88 654.32 476.04 637.54 476.04 608.92 L 476.04 595.57 L 437.44 598.62 C 413.27 600.53 398.07 607.40 398.07 626.09 C 398.07 642.88 410.15 654.32 431.59 654.32 M 426.92 564.67 L 476.04 560.85 L 476.04 553.60 C 476.04 533.76 464.73 521.17 441.34 521.17 C 419.90 521.17 406.64 533.00 404.30 548.26 L 353.62 548.26 C 359.86 508.97 393.39 482.26 441.34 482.26 C 498.65 482.26 529.06 512.02 529.06 557.04 L 529.06 685.23 L 477.60 685.23 L 477.60 658.14 C 469.80 675.31 447.58 689.80 417.17 689.80 C 374.28 689.80 346.60 665.39 346.60 627.62 C 346.60 588.70 374.28 568.48 426.92 564.67",
  "M 587.92 406.72 L 641.33 406.72 L 641.33 567.72 L 716.97 486.84 L 779.34 486.84 L 706.44 566.57 L 781.30 685.23 L 721.64 685.23 L 670.57 603.96 L 641.33 633.34 L 641.33 685.23 L 587.92 685.23Z",
  "M 948.93 561.23 C 945.42 536.44 928.65 519.27 902.14 519.27 C 876.02 519.27 858.87 537.20 854.19 561.23Z M 902.14 482.26 C 966.47 482.26 1000.00 527.28 1000.00 584.89 L 1000.00 597.48 L 852.63 597.48 C 854.58 627.24 872.90 649.75 904.09 649.75 C 929.04 649.75 942.30 638.30 948.93 623.42 L 997.27 623.42 C 987.91 662.72 951.66 689.80 904.48 689.80 C 839.37 689.80 801.55 644.40 801.55 586.03 C 801.55 528.04 842.88 482.26 902.14 482.26",
  "M 34.88 407.62 L 395.44 407.62 L 395.44 34.88 L 34.88 34.88Z M 430.31 442.50 L 0.00 442.50 L 0.00 0.00 L 430.31 0.00Z"
];
const STACK_DOT =
  "M 234.90 589.48 C 234.90 608.25 219.68 623.47 200.91 623.47 C 182.14 623.47 166.93 608.25 166.93 589.48 C 166.93 570.71 182.14 555.49 200.91 555.49 C 219.68 555.49 234.90 570.71 234.90 589.48";

export function BrandStack({ height = 36, color }: { height?: number; color?: string }) {
  const pal = usePalette();
  const ink = color ?? pal.ink;
  return (
    <Svg width={Math.round(height * STACK_RATIO)} height={height} viewBox={STACK_VIEWBOX}>
      {STACK_INK.map((d, i) => (
        <Path key={i} d={d} fill={ink} />
      ))}
      <Path d={STACK_DOT} fill={LOGO_RED} />
    </Svg>
  );
}

/** The masthead mark. `size` is the old text size the callers still pass; the stack is
    scaled from it so the one-line masthead keeps its height (fs.lg → 36px, fs.base → 30px). */
export function Wordmark({ size = fs.xl }: { size?: number }) {
  return <BrandStack height={Math.round(size * 2)} />;
}

/** Floating undo pill — every judgment is reversible (§13-15). */
export function UndoPill({
  label,
  actionLabel,
  onUndo,
}: {
  label: string;
  actionLabel: string;
  onUndo: () => void;
}) {
  const pal = usePalette();
  return (
    <Appear from="bottom" distance={22} style={{ alignSelf: "center" }}>
      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            gap: sp.s3,
            borderRadius: radius.pill,
            paddingHorizontal: sp.s4,
            paddingVertical: 10,
            backgroundColor: pal.ink,
          },
          shadow.float,
        ]}
      >
        <Ui size={fs.sm} color={pal.bg} numberOfLines={1} style={{ maxWidth: 220 }}>
          {label}
        </Ui>
        <Pressable
          hitSlop={8}
          onPress={() => {
            haptic.tap();
            onUndo();
          }}
        >
          <Ui size={fs.sm} weight="700" color={pal.bg}>
            {actionLabel}
          </Ui>
        </Pressable>
      </View>
    </Appear>
  );
}
