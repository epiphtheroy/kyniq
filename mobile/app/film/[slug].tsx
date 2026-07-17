// Film card — the app's heart (HANDOFF §5.1). Native decision layer only;
// deep reading is delegated to the in-app reader (invariant §13-9).
// Skinned to design system v2 "Lava": full-bleed hero with floating glass discs,
// sheet-over-photo content, grouped surface sections, sticky gradient CTA bar.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Share, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TSDonut } from "../../src/components/TSDonut";
import {
  Btn,
  GradientBtn,
  Hairline,
  Loading,
  PosterImg,
  Screen,
  SectionTitle,
  Serif,
  Tactile,
  Ui,
} from "../../src/components/ui";
import { METATAKE_BASE } from "../../src/config";
import { t } from "../../src/i18n";
import { api } from "../../src/lib/api";
import { useFilms } from "../../src/state/films";
import { usePrefs } from "../../src/state/prefs";
import { brand, fs, radius, shadow, sp, tierColor, usePalette } from "../../src/theme";
import type { FilmCard as FilmCardT } from "../../src/types";

const KIND_LABEL: Record<string, string> = {
  flatrate: "kind.flatrate",
  free: "kind.free",
  ads: "kind.ads",
  rent: "kind.rent",
  buy: "kind.buy",
};

/** Floating glass disc over the hero (benchmark listing-header buttons). */
function IconDisc({
  icon,
  onPress,
  color,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  color?: string;
}) {
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
        <Ionicons name={icon} size={18} color={color ?? pal.ink} />
      </View>
    </Tactile>
  );
}

/** Grouped surface container — the benchmark's section card. */
function Group({ children }: { children: React.ReactNode }) {
  const pal = usePalette();
  return (
    <View
      style={{
        marginHorizontal: sp.s4,
        borderRadius: radius.md,
        backgroundColor: pal.surface,
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
}

export default function FilmScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const pal = usePalette();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { country, locale } = usePrefs();
  const { session, ledger, toggleSeen, toggleWatchlist } = useFilms();

  const [card, setCard] = useState<FilmCardT | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    setCard(null);
    setErr(false);
    api
      .film(String(slug), country, locale)
      .then((c) => alive && setCard(c))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [slug, country, locale]);

  const entry = card ? ledger.get(card.slug) : undefined;
  const webUrl = `${METATAKE_BASE}/film/${slug}`;

  const openReader = (path: string, title: string) =>
    router.push({ pathname: "/read", params: { path, title } });

  const readMore = useMemo(
    () =>
      card
        ? [
            { label: "Why watch — the full page", path: `/film/${card.slug}` },
            { label: "Reception — the afterlife", path: `/film/${card.slug}/reception` },
            { label: "Honors", path: `/film/lineage/${card.slug}` },
            { label: "Credits", path: `/film/${card.slug}/credits` },
            { label: "Gallery", path: `/film/${card.slug}/gallery` },
            { label: "Meaning — strong misreadings", path: `/film/meaning/${card.slug}` },
          ]
        : [],
    [card],
  );

  const requireSession = (fn: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!session) {
      router.push({ pathname: "/onboarding", params: { step: "account" } });
      return;
    }
    fn();
  };

  if (err)
    return (
      <Screen style={{ alignItems: "center", justifyContent: "center", gap: sp.s4, padding: sp.s5 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ui color={pal.muted}>{t("error.network")}</Ui>
        <Btn
          label={t("action.retry")}
          style={{ alignSelf: "stretch" }}
          onPress={() => router.replace({ pathname: "/film/[slug]", params: { slug: String(slug) } })}
        />
      </Screen>
    );
  if (!card) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <Loading />
      </Screen>
    );
  }

  const heroH = Math.round(width * 0.72);
  const lead = card.invitation ?? (card.lead_fallback.length ? card.lead_fallback.join(" ") : null);
  const firstAvail = card.availability[0] ?? null;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
        {/* Hero — full-bleed image, top scrim, floating glass controls */}
        <View style={{ width, height: heroH, backgroundColor: "#000" }}>
          <PosterImg
            path={card.backdrop_path ?? card.poster_path}
            width={width}
            height={heroH}
            size="w780"
            rounded={0}
          />
          <LinearGradient
            colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0)"]}
            style={{ position: "absolute", top: 0, left: 0, right: 0, height: 110 }}
          />
        </View>
        <View
          style={{
            position: "absolute",
            top: insets.top + sp.s2,
            left: sp.s4,
            right: sp.s4,
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <IconDisc icon="chevron-back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} />
          <View style={{ flexDirection: "row", gap: sp.s2 }}>
            <IconDisc icon="share-outline" onPress={() => Share.share({ message: webUrl })} />
            <IconDisc
              icon={entry?.watchlist ? "heart" : "heart-outline"}
              color={entry?.watchlist ? brand.accent : pal.ink}
              onPress={() => requireSession(() => toggleWatchlist(card.slug, card.film_id))}
            />
          </View>
        </View>

        {/* Content sheet over the photo */}
        <View
          style={{
            marginTop: -24,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            backgroundColor: pal.bg,
            paddingTop: sp.s5,
          }}
        >
          {/* Masthead — the serif editorial thread lives here */}
          <View style={{ paddingHorizontal: sp.s4, flexDirection: "row", gap: sp.s4 }}>
            <View style={{ flex: 1 }}>
              <Serif size={fs.x2} bold>
                {card.title}
              </Serif>
              <Ui size={fs.sm} color={pal.muted} style={{ marginTop: 4 }}>
                {[
                  card.year,
                  card.runtime ? `${card.runtime} min` : null,
                  ...(card.genres ?? []).slice(0, 2),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Ui>
              {card.director ? (
                <Tactile
                  disabled={!card.director_slug}
                  onPress={() =>
                    card.director_slug &&
                    router.push({ pathname: "/director/[slug]", params: { slug: card.director_slug } })
                  }
                >
                  <Ui
                    size={fs.sm}
                    weight="500"
                    color={card.director_slug ? brand.accent : pal.muted}
                    style={{ marginTop: 4 }}
                  >
                    {t("film.directedBy")} {card.director}
                  </Ui>
                </Tactile>
              ) : null}
            </View>
            {card.ts != null ? <TSDonut val={card.ts} size={64} label="TakeScore" /> : null}
          </View>

          {/* An Invitation */}
          {lead ? (
            <>
              <SectionTitle>{t("film.invitation")}</SectionTitle>
              <View style={{ paddingHorizontal: sp.s4 }}>
                <Serif size={fs.md} style={{ lineHeight: fs.md * 1.6 }}>
                  {lead}
                </Serif>
              </View>
            </>
          ) : null}

          {/* Where to watch — grouped rows */}
          <SectionTitle sub={country}>{t("film.whereToWatch")}</SectionTitle>
          {card.availability.length ? (
            <>
              <Group>
                {card.availability.slice(0, 8).map((a, i) => (
                  <View key={`${a.pid}-${a.kind}`}>
                    {i > 0 ? <Hairline style={{ marginLeft: sp.s4 }} /> : null}
                    <Tactile
                      onPress={() => openReader(`/whereto/${card.slug}`, card.title)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: sp.s3,
                        paddingHorizontal: sp.s4,
                        paddingVertical: 12,
                      }}
                    >
                      <View
                        style={{ width: 8, height: 8, borderRadius: radius.pill, backgroundColor: tierColor(a.kind) }}
                      />
                      {a.logo ? <PosterImg path={a.logo} width={24} height={24} size="w92" rounded={6} /> : null}
                      <Ui size={fs.sm} weight="600" style={{ flex: 1 }}>
                        {a.name}
                      </Ui>
                      <Ui size={fs.xs} color={pal.muted}>
                        {KIND_LABEL[a.kind] ? t(KIND_LABEL[a.kind] as Parameters<typeof t>[0]) : a.kind}
                      </Ui>
                      <Ionicons name="chevron-forward" size={14} color={pal.subtle} />
                    </Tactile>
                  </View>
                ))}
              </Group>
              <Ui size={fs.xs} color={pal.subtle} style={{ paddingHorizontal: sp.s4, paddingTop: sp.s2 }}>
                {t("attribution.justwatch")}
              </Ui>
            </>
          ) : (
            <View style={{ paddingHorizontal: sp.s4 }}>
              <Ui size={fs.sm} color={pal.muted}>
                {t("film.notStreaming", { country })}
              </Ui>
              <Ui size={fs.xs} color={pal.subtle} style={{ marginTop: 2 }}>
                {t("film.notStreamingHint")}
              </Ui>
            </View>
          )}

          {/* Lineage */}
          {card.lineage.length ? (
            <>
              <SectionTitle>{t("film.lineage")}</SectionTitle>
              <Group>
                {card.lineage.slice(0, 6).map((l, i) => (
                  <View key={`${l.list_slug}-${i}`}>
                    {i > 0 ? <Hairline style={{ marginLeft: sp.s4 }} /> : null}
                    <Tactile
                      onPress={() => openReader(`/film/lineage/${card.slug}`, card.title)}
                      style={{
                        flexDirection: "row",
                        alignItems: "baseline",
                        gap: sp.s2,
                        paddingHorizontal: sp.s4,
                        paddingVertical: 11,
                      }}
                    >
                      <Ui size={fs.sm} weight="500" style={{ flexShrink: 1 }} numberOfLines={1}>
                        {l.list_label}
                      </Ui>
                      <Ui size={fs.xs} color={pal.muted}>
                        {l.edition_year ?? ""}
                      </Ui>
                      <View style={{ flex: 1 }} />
                      <Ui size={fs.sm} weight="600" color={brand.tsGreen}>
                        {l.rank ? `#${l.rank}${l.rank_max ? `/${l.rank_max}` : ""}` : (l.result ?? "")}
                      </Ui>
                    </Tactile>
                  </View>
                ))}
                {card.lineage.length > 6 ? (
                  <>
                    <Hairline style={{ marginLeft: sp.s4 }} />
                    <Tactile onPress={() => openReader(`/film/lineage/${card.slug}`, card.title)}>
                      <Ui
                        size={fs.sm}
                        weight="500"
                        color={brand.accent}
                        style={{ paddingHorizontal: sp.s4, paddingVertical: 11 }}
                      >
                        +{card.lineage.length - 6} more
                      </Ui>
                    </Tactile>
                  </>
                ) : null}
              </Group>
            </>
          ) : null}

          {/* Locations */}
          {card.locations.count > 0 ? (
            <>
              <SectionTitle sub={`${card.locations.count}`}>{t("film.locations")}</SectionTitle>
              <Group>
                {card.locations.pins.slice(0, 3).map((p, i) => (
                  <View key={String(p.id)}>
                    {i > 0 ? <Hairline style={{ marginLeft: sp.s4 }} /> : null}
                    <Tactile
                      onPress={() => router.push({ pathname: "/(tabs)/map", params: { film: card.slug } })}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: sp.s2,
                        paddingHorizontal: sp.s4,
                        paddingVertical: 11,
                      }}
                    >
                      <Ionicons name="location-outline" size={15} color={brand.accent} />
                      <Ui size={fs.sm} weight="500" numberOfLines={1} style={{ flex: 1 }}>
                        {p.name}
                      </Ui>
                      <Ui size={fs.xs} color={pal.muted}>
                        {p.country ?? ""}
                      </Ui>
                    </Tactile>
                  </View>
                ))}
              </Group>
            </>
          ) : null}

          {/* The Life — director preview */}
          {card.the_life ? (
            <>
              <SectionTitle>
                {t("film.theLife")} — {card.the_life.name}
              </SectionTitle>
              <Group>
                <Tactile
                  onPress={() =>
                    router.push({ pathname: "/director/[slug]", params: { slug: card.the_life!.slug } })
                  }
                  style={{ flexDirection: "row", gap: sp.s3, padding: sp.s4 }}
                >
                  {card.the_life.profile_path ? (
                    <PosterImg
                      path={card.the_life.profile_path}
                      width={48}
                      height={64}
                      size="w92"
                      rounded={radius.sm}
                    />
                  ) : null}
                  <View style={{ flex: 1 }}>
                    {card.the_life.intro ? (
                      <Ui size={fs.sm} color={pal.inkSoft} numberOfLines={3}>
                        {card.the_life.intro}
                      </Ui>
                    ) : null}
                    {card.the_life.facts.slice(0, 2).map((f) => (
                      <Ui key={f.n} size={fs.xs} color={pal.muted} numberOfLines={2} style={{ marginTop: 4 }}>
                        {f.n}. {f.text}
                      </Ui>
                    ))}
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={pal.subtle} style={{ alignSelf: "center" }} />
                </Tactile>
              </Group>
            </>
          ) : null}

          {/* Read more on Metatake */}
          <SectionTitle>{t("action.readMore")}</SectionTitle>
          <Group>
            {readMore.map((r, i) => (
              <View key={r.path}>
                {i > 0 ? <Hairline style={{ marginLeft: sp.s4 }} /> : null}
                <Tactile
                  onPress={() => openReader(r.path, card.title)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: sp.s4,
                    paddingVertical: 13,
                  }}
                >
                  <Ui size={fs.md} weight="500" style={{ flex: 1 }}>
                    {r.label}
                  </Ui>
                  <Ionicons name="chevron-forward" size={15} color={pal.subtle} />
                </Tactile>
              </View>
            ))}
          </Group>
          <Ui size={fs.xs} color={pal.subtle} style={{ paddingHorizontal: sp.s4, paddingTop: sp.s3 }}>
            {t("attribution.tmdb")}
          </Ui>
        </View>
      </ScrollView>

      {/* Sticky decision bar — the benchmark reserve-bar grammar */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: "row",
          alignItems: "center",
          gap: sp.s3,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: pal.hairline,
          backgroundColor: pal.bg,
          paddingTop: sp.s3,
          paddingHorizontal: sp.s4,
          paddingBottom: Math.max(insets.bottom, sp.s3),
        }}
      >
        <View style={{ flex: 1 }}>
          {firstAvail ? (
            <>
              <Ui size={fs.sm} weight="600" numberOfLines={1}>
                {firstAvail.name}
              </Ui>
              <Ui size={fs.xs} color={pal.muted}>
                {KIND_LABEL[firstAvail.kind]
                  ? t(KIND_LABEL[firstAvail.kind] as Parameters<typeof t>[0])
                  : firstAvail.kind}
              </Ui>
            </>
          ) : (
            <Ui size={fs.xs} color={pal.muted} numberOfLines={2}>
              {t("film.notStreaming", { country })}
            </Ui>
          )}
        </View>
        <Tactile onPress={() => requireSession(() => toggleSeen(card.slug, card.film_id))} hitSlop={6}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: entry?.seen ? brand.tsGreen : pal.hairline2,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name={entry?.seen ? "checkmark-circle" : "checkmark-circle-outline"}
              size={22}
              color={entry?.seen ? brand.tsGreen : pal.muted}
            />
          </View>
        </Tactile>
        <GradientBtn
          label={t("action.watchNow")}
          onPress={() => openReader(`/whereto/${card.slug}`, card.title)}
          style={{ width: "44%" }}
        />
      </View>
    </Screen>
  );
}
