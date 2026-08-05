// Director card (HANDOFF §2.2) — the decision subset natively (where to start,
// the selection, filmography-on-your-services, who's next, the life).
// Fully native — no links out to metatake.net web pages (owner directive
// 2026-07; Share keeps the web URL, §13-2).
// Design system v2 "Lava": floating chrome discs over a centered identity
// header, elevated where-to-start hero card, poster carousel for the
// selection, grouped surface containers for the life.
import Ionicons from "@expo/vector-icons/Ionicons";
import { glyphs } from "../../src/platform/tokens";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Image, ScrollView, Share, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FilmRow } from "../../src/components/FilmRow";
import {
  Btn,
  PosterImg,
  Screen,
  SectionTitle,
  Serif,
  Tactile,
  Ui,
} from "../../src/components/ui";
import { METATAKE_BASE, TMDB_IMG } from "../../src/config";
import { Appear, Shimmer, SkeletonRows, SkeletonText } from "../../src/components/motion";
import { t } from "../../src/i18n";
import { api } from "../../src/lib/api";
import { usePrefs } from "../../src/state/prefs";
import { fs, radius, shadow, sp, usePalette } from "../../src/theme";
import type { DirectorCard as DirectorCardT } from "../../src/types";

type Pick = DirectorCardT["picks"][number];

/** Hostname for the fact-source ↗ suffix (regex, not URL(): Hermes-safe). */
function hostOf(url: string): string | null {
  const m = /^https?:\/\/(?:www\.)?([^/:?#]+)/i.exec(url);
  return m ? m[1] : null;
}

/** Floating chrome disc — hero-page back/share affordance over content. */
function Disc({
  icon,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
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
        <Ionicons name={icon} size={20} color={pal.ink} />
      </View>
    </Tactile>
  );
}

export default function DirectorScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const { country, locale } = usePrefs();

  const [card, setCard] = useState<DirectorCardT | null>(null);
  const [err, setErr] = useState(false);
  const [showAllFacts, setShowAllFacts] = useState(false);

  useEffect(() => {
    let alive = true;
    setCard(null);
    setErr(false);
    setShowAllFacts(false);
    api
      .director(String(slug), country, locale)
      .then((c) => alive && setCard(c))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [slug, country]);

  const webUrl = `${METATAKE_BASE}/director/${slug}`;

  const goFilm = (filmSlug: string) =>
    router.push({ pathname: "/film/[slug]", params: { slug: filmSlug } });

  // slug → film (poster lookup for picks)
  const filmBySlug = useMemo(() => {
    const m = new Map<string, DirectorCardT["films"][number]>();
    for (const f of card?.films ?? []) m.set(f.slug, f);
    return m;
  }, [card]);

  // Server already sorts by year; re-sort ascending client-side to be safe.
  const films = useMemo(
    () => [...(card?.films ?? [])].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999)),
    [card],
  );

  const picks = useMemo(() => [...(card?.picks ?? [])].sort((a, b) => a.pos - b.pos), [card]);
  const startPick: Pick | null = useMemo(() => {
    if (!picks.length) return null;
    return picks.find((p) => p.label?.trim().toLowerCase() === "start here") ?? picks[0];
  }, [picks]);
  const restPicks = useMemo(() => picks.filter((p) => p !== startPick), [picks, startPick]);

  const facts = useMemo(() => [...(card?.facts ?? [])].sort((a, b) => a.n - b.n), [card]);

  const nextRecs = useMemo(() => [...(card?.next ?? [])].sort((a, b) => a.pos - b.pos), [card]);

  if (err)
    return (
      <Screen style={{ alignItems: "center", justifyContent: "center", gap: sp.s4, padding: sp.s5 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ui size={fs.md} color={pal.muted}>
          {t("error.network")}
        </Ui>
        <Btn
          label={t("action.retry")}
          onPress={() =>
            router.replace({ pathname: "/director/[slug]", params: { slug: String(slug) } })
          }
          style={{ alignSelf: "stretch" }}
        />
        <View style={{ position: "absolute", top: insets.top + sp.s2, left: sp.s4 }}>
          <Disc icon={glyphs.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} />
        </View>
      </Screen>
    );
  if (!card)
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ paddingTop: insets.top + sp.s7, paddingHorizontal: sp.s4, gap: sp.s3 }}>
          <Shimmer width={86} height={86} rounded={999} />
          <SkeletonText w={0.55} size={26} />
          <SkeletonText w={0.4} size={13} />
          <View style={{ paddingTop: sp.s4, gap: sp.s2 }}>
            <SkeletonText w={1} size={15} />
            <SkeletonText w={0.9} size={15} />
          </View>
        </View>
        <View style={{ paddingTop: sp.s5, marginHorizontal: -sp.s4 }}>
          <SkeletonRows count={3} />
        </View>
        <View style={{ position: "absolute", top: insets.top + sp.s2, left: sp.s4 }}>
          <Disc icon={glyphs.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} />
        </View>
      </Screen>
    );

  const portraitLead = card.portrait ? (card.portrait.split(/\n{2,}/)[0]?.trim() ?? null) : null;
  const meta = [card.birthday, card.place_of_birth].filter(Boolean).join(" · ");
  const visibleFacts = showAllFacts ? facts : facts.slice(0, 8);
  const heroW = winW - sp.s4 * 2;
  const startFilm = startPick?.film_slug ? (filmBySlug.get(startPick.film_slug) ?? null) : null;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Identity header — centered portrait, serif name, quiet meta */}
        <View
          style={{
            paddingTop: insets.top + 56,
            paddingHorizontal: sp.s4,
            alignItems: "center",
            gap: sp.s3,
          }}
        >
          <View style={[{ borderRadius: radius.pill }, shadow.card]}>
            <PosterImg path={card.profile_path} width={96} height={96} size="w185" rounded={radius.pill} />
          </View>
          <View style={{ alignItems: "center", gap: 2 }}>
            <Serif size={fs.x2} bold style={{ textAlign: "center" }}>
              {card.name}
            </Serif>
            {meta ? (
              <Ui size={fs.sm} color={pal.muted} style={{ textAlign: "center" }}>
                {meta}
              </Ui>
            ) : null}
          </View>
        </View>
        {portraitLead ? (
          <View style={{ paddingHorizontal: sp.s4, paddingTop: sp.s4 }}>
            <Ui size={fs.base} color={pal.inkSoft} numberOfLines={6}>
              {portraitLead}
            </Ui>
          </View>
        ) : null}

        {/* Where to start — ONE elevated hero card for the entry film */}
        {startPick ? (
          <>
            <SectionTitle>{t("director.whereToStart")}</SectionTitle>
            <Tactile
              disabled={!startPick.film_slug}
              onPress={() => startPick.film_slug && goFilm(startPick.film_slug)}
              style={[
                {
                  marginHorizontal: sp.s4,
                  borderRadius: radius.md,
                  backgroundColor: pal.card,
                },
                shadow.card,
              ]}
            >
              <View style={{ borderRadius: radius.md, overflow: "hidden" }}>
                {/* Portrait poster in a landscape banner: blurred self-fill +
                    contained art — never a hard crop (owner directive 2026-07-18). */}
                {startFilm?.poster_path ? (
                  <View style={{ width: heroW, height: 180, backgroundColor: "#000" }}>
                    <Image
                      source={{ uri: `${TMDB_IMG}/w342${startFilm.poster_path}` }}
                      blurRadius={24}
                      resizeMode="cover"
                      style={{ position: "absolute", width: heroW, height: 180, opacity: 0.5 }}
                    />
                    <Image
                      source={{ uri: `${TMDB_IMG}/w342${startFilm.poster_path}` }}
                      resizeMode="contain"
                      style={{ width: heroW, height: 180 }}
                    />
                  </View>
                ) : (
                  <PosterImg path={null} width={heroW} height={180} rounded={0} />
                )}
                <View style={{ padding: sp.s4, gap: sp.s1 }}>
                  <Ui size={fs.md} weight="600" numberOfLines={2}>
                    {startPick.film_title ?? ""}
                  </Ui>
                  {startPick.film_year != null ? (
                    <Ui size={fs.sm} color={pal.muted}>
                      {startPick.film_year}
                    </Ui>
                  ) : null}
                  {startPick.reason ? (
                    <Serif italic size={fs.base} numberOfLines={3} style={{ marginTop: 2 }}>
                      {startPick.reason}
                    </Serif>
                  ) : null}
                </View>
              </View>
            </Tactile>
          </>
        ) : null}

        {/* The Selection — the remaining ranked picks as a poster carousel */}
        {restPicks.length ? (
          <>
            <SectionTitle>{t("director.theSelection")}</SectionTitle>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={restPicks}
              keyExtractor={(p) => String(p.pos)}
              contentContainerStyle={{ paddingHorizontal: sp.s4, gap: sp.s3 }}
              renderItem={({ item: p }) => (
                <Tactile
                  disabled={!p.film_slug}
                  onPress={() => p.film_slug && goFilm(p.film_slug)}
                  style={{ width: 132 }}
                >
                  <PosterImg
                    path={p.film_slug ? (filmBySlug.get(p.film_slug)?.poster_path ?? null) : null}
                    width={132}
                    height={198}
                    size="w342"
                    rounded={radius.md}
                  />
                  <Ui size={fs.sm} weight="500" numberOfLines={2} style={{ marginTop: sp.s2 }}>
                    {p.film_title ?? ""}
                  </Ui>
                  {p.film_year != null ? (
                    <Ui size={fs.xs} color={pal.muted}>
                      {p.film_year}
                    </Ui>
                  ) : null}
                </Tactile>
              )}
            />
          </>
        ) : null}

        {/* Filmography — THE killer surface: availability dots on every row */}
        {films.length ? (
          <>
            <SectionTitle sub={t("director.onYourServices")}>
              {t("director.filmography")}
            </SectionTitle>
            <View>
              {films.map((f, i) => (
                <Appear key={f.slug} index={i}>
                  <FilmRow
                    slug={f.slug}
                    title={f.title}
                    year={f.year}
                    poster_path={f.poster_path}
                    ts={f.ts}
                    tiers={f.tiers}
                  />
                </Appear>
              ))}
              <Ui size={fs.xs} color={pal.subtle} style={{ paddingHorizontal: sp.s4, paddingTop: sp.s2 }}>
                {t("attribution.justwatch")}
              </Ui>
            </View>
          </>
        ) : null}

        {/* Who's next — succession recs as a circular-portrait strip */}
        {nextRecs.length ? (
          <>
            <SectionTitle>{t("director.whosNext")}</SectionTitle>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={nextRecs}
              keyExtractor={(n) => String(n.pos)}
              contentContainerStyle={{ paddingHorizontal: sp.s4, gap: sp.s4 }}
              renderItem={({ item: n }) => (
                <Tactile
                  onPress={() =>
                    n.target_slug
                      ? router.push({ pathname: "/director/[slug]", params: { slug: n.target_slug } })
                      : // No card for this person yet — search their name, never
                        // the CURRENT director's /next page (reads as a misfire).
                        router.push({ pathname: "/search", params: { q: n.rec_name } })
                  }
                  style={{ width: 84, alignItems: "center" }}
                >
                  <PosterImg path={n.profile_path} width={72} height={72} size="w185" rounded={radius.pill} />
                  <Ui
                    size={fs.sm}
                    weight="500"
                    numberOfLines={2}
                    style={{ marginTop: sp.s2, textAlign: "center" }}
                  >
                    {n.rec_name}
                  </Ui>
                </Tactile>
              )}
            />
          </>
        ) : null}

        {/* The Life — grouped surface: name meaning, intro, numbered facts */}
        {card.name_meaning || card.intro || facts.length ? (
          <>
            <SectionTitle>{t("director.theLife")}</SectionTitle>
            <View
              style={{
                marginHorizontal: sp.s4,
                backgroundColor: pal.surface,
                borderRadius: radius.md,
                padding: sp.s4,
                gap: sp.s3,
              }}
            >
              {card.name_meaning ? (
                <Serif italic size={fs.base} style={{ lineHeight: fs.base * 1.5 }}>
                  {card.name_meaning}
                </Serif>
              ) : null}
              {card.intro ? (
                <Ui size={fs.base} color={pal.inkSoft}>
                  {card.intro}
                </Ui>
              ) : null}
              {visibleFacts.map((f, fi) => {
                const host = f.source ? hostOf(f.source) : null;
                return (
                  <Appear key={f.n} index={fi} style={{ flexDirection: "row", gap: sp.s2 }}>
                    <Ui size={fs.sm} weight="600" color={pal.muted}>
                      {f.n}.
                    </Ui>
                    <Ui size={fs.sm} style={{ flex: 1 }}>
                      {f.text}
                      {host ? (
                        <Ui size={fs.xs} color={pal.subtle}>
                          {"  ↗ " + host}
                        </Ui>
                      ) : null}
                    </Ui>
                  </Appear>
                );
              })}
              {facts.length > 8 ? (
                <Tactile onPress={() => setShowAllFacts((v) => !v)} hitSlop={8}>
                  <Ui size={fs.sm} weight="500" style={{ textDecorationLine: "underline" }}>
                    {showAllFacts ? t("common.showFewer") : t("common.showAll", { n: facts.length })}
                  </Ui>
                </Tactile>
              ) : null}
            </View>
          </>
        ) : null}

        <Ui size={fs.xs} color={pal.subtle} style={{ paddingHorizontal: sp.s4, paddingTop: sp.s3 }}>
          {t("attribution.tmdb")}
        </Ui>
      </ScrollView>

      {/* Floating chrome — back + share discs over the identity header */}
      <View
        style={{
          position: "absolute",
          top: insets.top + sp.s2,
          left: sp.s4,
          right: sp.s4,
          flexDirection: "row",
          justifyContent: "space-between",
        }}
        pointerEvents="box-none"
      >
        <Disc icon={glyphs.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} />
        <Disc icon={glyphs.share} onPress={() => Share.share({ message: webUrl })} />
      </View>
    </Screen>
  );
}
