// Film card — the app's heart (HANDOFF §5.1). Native decision layer only;
// deep reading is delegated to the in-app reader (invariant §13-9).
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { TSDonut } from "../../src/components/TSDonut";
import {
  Btn,
  Hairline,
  Loading,
  PosterImg,
  Screen,
  SectionTitle,
  Serif,
  Ui,
} from "../../src/components/ui";
import { METATAKE_BASE, TMDB_IMG } from "../../src/config";
import { t } from "../../src/i18n";
import { api } from "../../src/lib/api";
import { useFilms } from "../../src/state/films";
import { usePrefs } from "../../src/state/prefs";
import { brand, fs, sp, tierColor, usePalette } from "../../src/theme";
import type { FilmCard as FilmCardT } from "../../src/types";

const KIND_LABEL: Record<string, string> = {
  flatrate: "kind.flatrate",
  free: "kind.free",
  ads: "kind.ads",
  rent: "kind.rent",
  buy: "kind.buy",
};

export default function FilmScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const pal = usePalette();
  const { width } = useWindowDimensions();
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

  if (err)
    return (
      <Screen style={{ alignItems: "center", justifyContent: "center", gap: sp.s4 }}>
        <Ui color={pal.muted}>{t("error.network")}</Ui>
        <Btn label={t("action.retry")} onPress={() => router.replace({ pathname: "/film/[slug]", params: { slug: String(slug) } })} />
      </Screen>
    );
  if (!card) return <Loading />;

  const heroH = Math.round((width * 9) / 16);
  const lead = card.invitation ?? (card.lead_fallback.length ? card.lead_fallback.join(" ") : null);

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: card.title,
          headerRight: () => (
            <Pressable onPress={() => Share.share({ message: webUrl })} hitSlop={10}>
              <Ionicons name="share-outline" size={20} color={pal.ink} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        {/* Hero — StillHero grammar: image only, scrim, no video (web rule) */}
        <View style={{ width, height: heroH, backgroundColor: "#000" }}>
          <PosterImg
            path={card.backdrop_path ?? card.poster_path}
            width={width}
            height={heroH}
            size="w780"
          />
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: heroH * 0.5,
              backgroundColor: "transparent",
            }}
          />
        </View>

        {/* Masthead */}
        <View style={{ paddingHorizontal: sp.s4, paddingTop: sp.s4, flexDirection: "row", gap: sp.s4 }}>
          <View style={{ flex: 1 }}>
            <Serif size={fs.x2} bold>
              {card.title}
            </Serif>
            <Ui size={fs.sm} color={pal.muted} style={{ marginTop: 2 }}>
              {[card.year, card.runtime ? `${card.runtime} min` : null].filter(Boolean).join(" · ")}
            </Ui>
            {card.director ? (
              <Pressable
                disabled={!card.director_slug}
                onPress={() =>
                  card.director_slug &&
                  router.push({ pathname: "/director/[slug]", params: { slug: card.director_slug } })
                }
              >
                <Ui size={fs.sm} color={card.director_slug ? brand.accent : pal.muted} style={{ marginTop: 2 }}>
                  {t("film.directedBy")} {card.director}
                </Ui>
              </Pressable>
            ) : null}
          </View>
          {card.ts != null ? <TSDonut val={card.ts} size={72} label="TakeScore" /> : null}
        </View>

        {/* An Invitation — the spoiler-free critical lead */}
        {lead ? (
          <>
            <SectionTitle>{t("film.invitation")}</SectionTitle>
            <View style={{ paddingHorizontal: sp.s4 }}>
              <Serif size={fs.md} style={{ lineHeight: fs.md * 1.55 }}>
                {lead}
              </Serif>
            </View>
          </>
        ) : null}

        {/* Where to watch */}
        <SectionTitle>{t("film.whereToWatch")} · {country}</SectionTitle>
        <View style={{ paddingHorizontal: sp.s4, gap: sp.s2 }}>
          {card.availability.length ? (
            <>
              {card.availability.slice(0, 8).map((a) => (
                <Pressable
                  key={`${a.pid}-${a.kind}`}
                  onPress={() => openReader(`/whereto/${card.slug}`, card.title)}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: sp.s3,
                    paddingVertical: 6,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: tierColor(a.kind) }} />
                  {a.logo ? <PosterImg path={a.logo} width={22} height={22} size="w92" /> : null}
                  <Ui size={fs.sm} weight="500" style={{ flex: 1 }}>
                    {a.name}
                  </Ui>
                  <Ui size={fs.xs + 1} color={pal.muted}>
                    {KIND_LABEL[a.kind] ? t(KIND_LABEL[a.kind] as Parameters<typeof t>[0]) : a.kind}
                  </Ui>
                  <Ionicons name="chevron-forward" size={14} color={pal.subtle} />
                </Pressable>
              ))}
              <Ui size={fs.xs} color={pal.subtle} style={{ marginTop: 2 }}>
                {t("attribution.justwatch")}
              </Ui>
            </>
          ) : (
            <View>
              <Ui size={fs.sm} color={pal.muted}>
                {t("film.notStreaming", { country })}
              </Ui>
              <Ui size={fs.xs + 1} color={pal.subtle} style={{ marginTop: 2 }}>
                {t("film.notStreamingHint")}
              </Ui>
            </View>
          )}
        </View>

        {/* Lineage — where this film stands (native, v2) */}
        {card.lineage.length ? (
          <>
            <SectionTitle>{t("film.lineage")}</SectionTitle>
            <View style={{ paddingHorizontal: sp.s4 }}>
              {card.lineage.slice(0, 6).map((l, i) => (
                <Pressable
                  key={`${l.list_slug}-${i}`}
                  onPress={() => openReader(`/film/lineage/${card.slug}`, card.title)}
                  style={{ paddingVertical: 6 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "baseline", gap: sp.s2 }}>
                    <Serif size={fs.base} style={{ flexShrink: 1 }} numberOfLines={1}>
                      {l.list_label}
                    </Serif>
                    <Ui size={fs.xs + 1} color={pal.muted}>
                      {l.edition_year ?? ""}
                    </Ui>
                    <View style={{ flex: 1 }} />
                    <Ui size={fs.sm} weight="600" color={brand.tsGreen}>
                      {l.rank ? `#${l.rank}${l.rank_max ? `/${l.rank_max}` : ""}` : (l.result ?? "")}
                    </Ui>
                  </View>
                </Pressable>
              ))}
              {card.lineage.length > 6 ? (
                <Pressable onPress={() => openReader(`/film/lineage/${card.slug}`, card.title)}>
                  <Ui size={fs.sm} color={brand.accent} style={{ paddingVertical: 6 }}>
                    +{card.lineage.length - 6} more
                  </Ui>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}

        {/* Locations — mini list, full pins live on the Map tab */}
        {card.locations.count > 0 ? (
          <>
            <SectionTitle>
              {t("film.locations")} · {card.locations.count}
            </SectionTitle>
            <View style={{ paddingHorizontal: sp.s4 }}>
              {card.locations.pins.slice(0, 3).map((p) => (
                <Pressable
                  key={String(p.id)}
                  onPress={() =>
                    router.push({ pathname: "/(tabs)/map", params: { film: card.slug } })
                  }
                  style={{ flexDirection: "row", alignItems: "center", gap: sp.s2, paddingVertical: 5 }}
                >
                  <Ionicons name="location-outline" size={14} color={brand.accent} />
                  <Ui size={fs.sm} numberOfLines={1} style={{ flex: 1 }}>
                    {p.name}
                  </Ui>
                  <Ui size={fs.xs + 1} color={pal.muted}>
                    {p.country ?? ""}
                  </Ui>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {/* The Life — director preview (native, v2) */}
        {card.the_life ? (
          <>
            <SectionTitle>
              {t("film.theLife")} — {card.the_life.name}
            </SectionTitle>
            <Pressable
              onPress={() =>
                router.push({ pathname: "/director/[slug]", params: { slug: card.the_life!.slug } })
              }
              style={{ paddingHorizontal: sp.s4, flexDirection: "row", gap: sp.s3 }}
            >
              {card.the_life.profile_path ? (
                <PosterImg path={card.the_life.profile_path} width={44} height={58} size="w92" />
              ) : null}
              <View style={{ flex: 1 }}>
                {card.the_life.intro ? (
                  <Serif size={fs.base} numberOfLines={3} style={{ lineHeight: fs.base * 1.45 }}>
                    {card.the_life.intro}
                  </Serif>
                ) : null}
                {card.the_life.facts.slice(0, 2).map((f) => (
                  <Ui key={f.n} size={fs.xs + 1} color={pal.muted} numberOfLines={2} style={{ marginTop: 4 }}>
                    {f.n}. {f.text}
                  </Ui>
                ))}
              </View>
            </Pressable>
          </>
        ) : null}

        {/* Read more on Metatake — the webview reading layer */}
        <SectionTitle>{t("action.readMore")}</SectionTitle>
        <View>
          {readMore.map((r) => (
            <View key={r.path}>
              <Pressable
                onPress={() => openReader(r.path, card.title)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: sp.s4,
                  paddingVertical: sp.s3,
                  backgroundColor: pressed ? pal.surface : "transparent",
                })}
              >
                <Ui size={fs.sm} weight="500" style={{ flex: 1 }}>
                  {r.label}
                </Ui>
                <Ionicons name="chevron-forward" size={14} color={pal.subtle} />
              </Pressable>
              <Hairline style={{ marginLeft: sp.s4 }} />
            </View>
          ))}
          <Ui size={fs.xs} color={pal.subtle} style={{ paddingHorizontal: sp.s4, paddingTop: sp.s3 }}>
            {t("attribution.tmdb")}
          </Ui>
        </View>

        <View style={{ height: sp.s6 }} />
      </ScrollView>

      {/* Action bar — fixed, decision moments only get haptics */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: "row",
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: pal.hairline,
          backgroundColor: pal.bg,
          paddingBottom: sp.s5,
          paddingTop: sp.s3,
          paddingHorizontal: sp.s4,
          gap: sp.s2,
        }}
      >
        <ActionButton
          icon={entry?.watchlist ? "heart" : "heart-outline"}
          label={entry?.watchlist ? t("action.watchlisted") : t("action.watchlist")}
          active={!!entry?.watchlist}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (!session) {
              router.push("/onboarding?step=account");
              return;
            }
            toggleWatchlist(card.slug, card.film_id);
          }}
        />
        <ActionButton
          icon={entry?.seen ? "checkmark-circle" : "checkmark-circle-outline"}
          label={t("action.seen")}
          active={!!entry?.seen}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (!session) {
              router.push("/onboarding?step=account");
              return;
            }
            toggleSeen(card.slug, card.film_id);
          }}
        />
        <ActionButton
          icon="share-outline"
          label={t("action.share")}
          active={false}
          onPress={() => Share.share({ message: webUrl })}
        />
      </View>
    </Screen>
  );
}

function ActionButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const pal = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        gap: 2,
        paddingVertical: 4,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={22} color={active ? brand.accent : pal.ink} />
      <Ui size={fs.xs} weight="500" color={active ? brand.accent : pal.muted}>
        {label}
      </Ui>
    </Pressable>
  );
}
