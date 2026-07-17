// Shared primitives — design system v2 "Lava" (see src/theme.ts header).
// Gradient CTAs, soft-shadow cards, springy press feedback, pill chrome.
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  type ImageStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { TMDB_IMG } from "../config";
import { brand, font, fs, gradient, motion, radius, shadow, sp, tierColor, usePalette } from "../theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Spring press-scale wrapper — every tappable surface feels tactile. */
export function Tactile({
  onPress,
  disabled,
  style,
  children,
  hitSlop,
}: {
  onPress?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  hitSlop?: number;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      onPress={onPress}
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
}: {
  children: React.ReactNode;
  size?: number;
  weight?: "400" | "500" | "600" | "700";
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const pal = usePalette();
  const fam =
    weight === "700" ? font.uiBold : weight === "600" ? font.uiSemi : weight === "500" ? font.uiMed : font.ui;
  return (
    <Text
      numberOfLines={numberOfLines}
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

/** Section header — big friendly sans semibold (benchmark listing sections). */
export function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  const pal = usePalette();
  return (
    <View style={{ marginTop: sp.s6, marginBottom: sp.s3, paddingHorizontal: sp.s4 }}>
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
  if (!path) {
    return <View style={[{ width, height, borderRadius: rounded, backgroundColor: pal.surface }, style]} />;
  }
  return (
    <Image
      source={{ uri: `${TMDB_IMG}/${size}${path}` }}
      style={[{ width, height, borderRadius: rounded, backgroundColor: pal.surface }, style]}
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
}: {
  ts: number | null | undefined;
  size?: number;
  onImage?: boolean;
}) {
  const pal = usePalette();
  if (ts == null) return null;
  const shown = Math.max(0, Math.min(100, Math.round(ts)));
  return (
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
  return (
    <AnimatedPressable
      hitSlop={10}
      onPress={() => {
        scale.value = withSpring(1.25, { damping: 8, stiffness: 300 });
        setTimeout(() => {
          scale.value = withSpring(1, motion.spring);
        }, 120);
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
  );
}

/** Availability dots: ● sub ● free ● rent/buy. */
export function AvailabilityDots({ tiers }: { tiers: string[] }) {
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

/** Primary CTA — the Lava gradient (benchmark "Reserve" grammar). */
export function GradientBtn({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Tactile onPress={onPress} disabled={disabled} style={style}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: radius.xs,
          paddingVertical: 14,
          alignItems: "center",
          opacity: disabled ? 0.5 : 1,
        }}
      >
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

/** Filter chip — the benchmark's category-strip pill. */
export function Chip({
  label,
  active = false,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  const pal = usePalette();
  return (
    <Tactile onPress={onPress}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          borderRadius: radius.pill,
          paddingHorizontal: 14,
          paddingVertical: 8,
          backgroundColor: active ? pal.ink : pal.card,
          borderWidth: active ? 0 : StyleSheet.hairlineWidth,
          borderColor: pal.hairline2,
        }}
      >
        {icon ? <Ionicons name={icon} size={14} color={active ? pal.bg : pal.ink} /> : null}
        <Ui size={fs.sm} weight={active ? "600" : "500"} color={active ? pal.bg : pal.ink}>
          {label}
        </Ui>
      </View>
    </Tactile>
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
    <Tactile onPress={onPress}>
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

export function Loading() {
  const pal = usePalette();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: pal.bg }}>
      <ActivityIndicator color={brand.accent} />
    </View>
  );
}

export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const pal = usePalette();
  return <View style={[{ flex: 1, backgroundColor: pal.bg }, style]}>{children}</View>;
}
