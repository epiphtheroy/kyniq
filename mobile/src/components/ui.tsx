// Shared editorial primitives — hairlines, square corners, PT Serif headlines.
import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { TMDB_IMG } from "../config";
import { brand, font, fs, sp, tierColor, usePalette } from "../theme";

/** Serif display text (headlines, titles). */
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
          lineHeight: size * 1.32,
          color: color ?? pal.ink,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Inter chrome text (labels, meta). */
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
      style={[{ fontFamily: fam, fontSize: size, color: color ?? pal.ink, lineHeight: size * 1.4 }, style]}
    >
      {children}
    </Text>
  );
}

export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  const pal = usePalette();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: pal.hairline }, style]} />;
}

/** Section header — red kicker rule + uppercase Inter eyebrow (web section grammar). */
export function SectionTitle({ children }: { children: React.ReactNode }) {
  const pal = usePalette();
  return (
    <View style={{ marginTop: sp.s6, marginBottom: sp.s3, paddingHorizontal: sp.s4 }}>
      <View style={{ width: 28, height: 2, backgroundColor: brand.accent, marginBottom: sp.s2 }} />
      <Ui size={fs.xs + 1} weight="700" color={pal.muted} style={{ letterSpacing: 1.6, textTransform: "uppercase" }}>
        {children}
      </Ui>
    </View>
  );
}

export function PosterImg({
  path,
  width,
  height,
  size = "w342",
  style,
}: {
  path: string | null | undefined;
  width: number;
  height: number;
  size?: "w92" | "w185" | "w342" | "w500" | "w780";
  style?: StyleProp<ImageStyle>;
}) {
  const pal = usePalette();
  if (!path) {
    return <View style={[{ width, height, backgroundColor: pal.surface }, style]} />;
  }
  return (
    <Image
      source={{ uri: `${TMDB_IMG}/${size}${path}` }}
      style={[{ width, height, backgroundColor: pal.surface }, style]}
      resizeMode="cover"
    />
  );
}

/** Small mono TakeScore chip. */
export function TSBadge({ ts, size = fs.sm }: { ts: number | null | undefined; size?: number }) {
  const pal = usePalette();
  if (ts == null) return null;
  return (
    <View
      style={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: brand.tsGreen,
        paddingHorizontal: 5,
        paddingVertical: 1,
      }}
    >
      <Text
        style={{
          fontFamily: font.uiSemi,
          fontVariant: ["tabular-nums"],
          fontSize: size,
          color: brand.tsGreen,
        }}
      >
        {Math.round(ts)}
      </Text>
    </View>
  );
  void pal;
}

/** Availability dots: ● sub (green) ● free (teal) ● rent/buy (grey). */
export function AvailabilityDots({ tiers }: { tiers: string[] }) {
  const groups = [...new Set(tiers.map(tierColor))];
  if (!groups.length) return null;
  return (
    <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
      {groups.map((c) => (
        <View key={c} style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: c }} />
      ))}
    </View>
  );
}

export function Btn({
  label,
  onPress,
  kind = "primary",
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "ghost";
  style?: StyleProp<ViewStyle>;
}) {
  const pal = usePalette();
  const primary = kind === "primary";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: primary ? (pressed ? brand.accentHover : brand.accent) : "transparent",
          borderWidth: primary ? 0 : StyleSheet.hairlineWidth,
          borderColor: pal.hairline2,
          paddingVertical: sp.s3,
          paddingHorizontal: sp.s5,
          alignItems: "center",
          opacity: pressed && !primary ? 0.6 : 1,
        },
        style,
      ]}
    >
      <Ui size={fs.sm} weight="600" color={primary ? brand.accentInk : pal.ink}>
        {label}
      </Ui>
    </Pressable>
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
