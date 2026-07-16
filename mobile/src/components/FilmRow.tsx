// Standard list row: poster w92 · serif title · year/director meta · TS badge · dots.
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, View } from "react-native";
import { fs, sp, usePalette } from "../theme";
import { AvailabilityDots, PosterImg, Serif, TSBadge, Ui } from "./ui";

export function FilmRow({
  slug,
  title,
  year,
  director,
  poster_path,
  ts,
  tiers,
}: {
  slug: string;
  title: string;
  year: number | null;
  director?: string | null;
  poster_path: string | null;
  ts?: number | null;
  tiers?: string[];
}) {
  const pal = usePalette();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/film/[slug]", params: { slug } })}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: sp.s3,
        paddingHorizontal: sp.s4,
        paddingVertical: sp.s2 + 2,
        backgroundColor: pressed ? pal.surface : "transparent",
      })}
    >
      <PosterImg path={poster_path} width={34} height={51} size="w92" />
      <View style={{ flex: 1 }}>
        <Serif size={fs.base} numberOfLines={1}>
          {title}
        </Serif>
        <Ui size={fs.xs + 1} color={pal.muted} numberOfLines={1}>
          {[year, director].filter(Boolean).join(" · ")}
        </Ui>
      </View>
      {tiers ? <AvailabilityDots tiers={tiers} /> : null}
      <TSBadge ts={ts} />
    </Pressable>
  );
}
