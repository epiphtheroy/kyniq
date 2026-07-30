// TakeScore ring gauge — geometry ported from web components/ScoreDonut.tsx
// (r = size*34/86, stroke = size*7/86, starts at 12 o'clock, mono center).
// The ring draws itself and the figure counts up on mount (owner 07-30 polish):
// the hero score is the one number on the screen worth animating.
import React, { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { motion, brand, font, usePalette } from "../theme";
import { useCountUp } from "./motion";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function TSDonut({
  val,
  size = 86,
  color = brand.tsGreen,
  label,
  /** Draw + count on mount. Off for dense lists where stillness reads better. */
  animate = true,
}: {
  val: number;
  size?: number;
  color?: string;
  label?: string;
  animate?: boolean;
}) {
  const pal = usePalette();
  const v = Math.max(0, Math.min(100, val));
  const r = size * (34 / 86);
  const stroke = size * (7 / 86);
  const C = 2 * Math.PI * r;
  const cx = size / 2;

  const draw = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    draw.value = animate
      ? withTiming(1, { duration: motion.slow + 260, easing: Easing.out(Easing.cubic) })
      : 1;
  }, [draw, animate, v]);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - (v / 100) * draw.value) }));

  const counted = useCountUp(v, motion.slow + 260);
  const shown = animate ? counted : Math.round(v);

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={cx} cy={cx} r={r} stroke={pal.hairline} strokeWidth={stroke} fill="none" />
          <AnimatedCircle
            cx={cx}
            cy={cx}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${C}`}
            animatedProps={arc}
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
            {shown}
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
