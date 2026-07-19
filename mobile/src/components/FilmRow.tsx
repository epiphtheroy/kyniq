// Standard list row — Lava grammar: rounded poster, sans title, whitespace
// separation (no hairlines), springy press.
import { useRouter } from "expo-router";
import React from "react";
import { View } from "react-native";
import { fs, radius, sp, usePalette } from "../theme";
import { AvailabilityDots, PosterImg, Tactile, TSBadge, Ui } from "./ui";

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
    <Tactile
      onPress={() => router.push({ pathname: "/film/[slug]", params: { slug } })}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: sp.s3,
        paddingHorizontal: sp.s4,
        paddingVertical: sp.s2 + 2,
      }}
    >
      <PosterImg path={poster_path} width={48} height={72} size="w92" rounded={radius.sm} />
      <View style={{ flex: 1 }}>
        <Ui size={fs.md} weight="500" numberOfLines={1}>
          {title}
        </Ui>
        <Ui size={fs.sm} color={pal.muted} numberOfLines={1}>
          {[year, director].filter(Boolean).join(" · ")}
        </Ui>
      </View>
      {tiers ? <AvailabilityDots tiers={tiers} /> : null}
      <TSBadge ts={ts} />
    </Tactile>
  );
}
