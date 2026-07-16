// TakeScore ring gauge — geometry ported from web components/ScoreDonut.tsx
// (r = size*34/86, stroke = size*7/86, starts at 12 o'clock, mono center).
import React from "react";
import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { brand, font, usePalette } from "../theme";

export function TSDonut({
  val,
  size = 86,
  color = brand.tsGreen,
  label,
}: {
  val: number;
  size?: number;
  color?: string;
  label?: string;
}) {
  const pal = usePalette();
  const v = Math.max(0, Math.min(100, val));
  const r = size * (34 / 86);
  const stroke = size * (7 / 86);
  const C = 2 * Math.PI * r;
  const cx = size / 2;
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={cx} cy={cx} r={r} stroke={pal.hairline} strokeWidth={stroke} fill="none" />
          <Circle
            cx={cx}
            cy={cx}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${C}`}
            strokeDashoffset={C * (1 - v / 100)}
            transform={`rotate(-90 ${cx} ${cx})`}
          />
        </Svg>
        <View
          style={{
            position: "absolute",
            inset: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontFamily: font.uiSemi,
              fontVariant: ["tabular-nums"],
              fontSize: size * (20 / 86),
              color: pal.ink,
            }}
          >
            {Math.round(v)}
          </Text>
          <Text
            style={{
              fontFamily: font.ui,
              fontSize: size * (8 / 86),
              letterSpacing: 1,
              color: pal.muted,
            }}
          >
            /100
          </Text>
        </View>
      </View>
      {label ? (
        <Text style={{ fontFamily: font.uiSemi, fontSize: 11.5, color: pal.muted, marginTop: 4 }}>{label}</Text>
      ) : null}
    </View>
  );
}
