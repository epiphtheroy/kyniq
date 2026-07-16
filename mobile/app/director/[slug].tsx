// Director card (HANDOFF §2.2) — the decision subset natively (where to start,
// the selection, filmography-on-your-services, who's next, the life); deep
// reading is delegated to the in-app reader (invariant §13-9).
import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { FilmRow } from "../../src/components/FilmRow";
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
import { METATAKE_BASE } from "../../src/config";
import { t } from "../../src/i18n";
import { api } from "../../src/lib/api";
import { usePrefs } from "../../src/state/prefs";
import { brand, fs, sp, usePalette } from "../../src/theme";
import type { DirectorCard as DirectorCardT } from "../../src/types";

type Pick = DirectorCardT["picks"][number];

/** Hostname for the fact-source ↗ suffix (regex, not URL(): Hermes-safe). */
function hostOf(url: string): string | null {
  const m = /^https?:\/\/(?:www\.)?([^/:?#]+)/i.exec(url);
  return m ? m[1] : null;
}

export default function DirectorScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const pal = usePalette();
  const { country } = usePrefs();

  const [card, setCard] = useState<DirectorCardT | null>(null);
  const [err, setErr] = useState(false);
  const [showAllFacts, setShowAllFacts] = useState(false);

  useEffect(() => {
    let alive = true;
    setCard(null);
    setErr(false);
    setShowAllFacts(false);
    api
      .director(String(slug), country)
      .then((c) => alive && setCard(c))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [slug, country]);

  const webUrl = `${METATAKE_BASE}/director/${slug}`;

  const openReader = (path: string, title: string) =>
    router.push({ pathname: "/read", params: { path, title } });

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

  const readMore = useMemo(
    () =>
      card
        ? [
            {
              label: t("director.records"),
              path: `/director/${card.slug}/honors`,
              chip: card.honors_count > 0 ? card.honors_count : null,
            },
            { label: t("director.reception"), path: `/director/${card.slug}/reception`, chip: null },
            { label: t("director.theory"), path: `/director/${card.slug}/theory`, chip: null },
            { label: "TakeScore", path: `/director/${card.slug}/takescore`, chip: null },
            { label: t("film.locations"), path: `/director/${card.slug}/locations`, chip: null },
            { label: t("director.misreadings"), path: `/director/${card.slug}/misreadings`, chip: null },
            { label: t("director.fullPage"), path: `/director/${card.slug}`, chip: null },
          ]
        : [],
    [card],
  );

  if (err)
    return (
      <Screen style={{ alignItems: "center", justifyContent: "center", gap: sp.s4 }}>
        <Ui color={pal.muted}>{t("error.network")}</Ui>
        <Btn
          label={t("action.retry")}
          onPress={() =>
            router.replace({ pathname: "/director/[slug]", params: { slug: String(slug) } })
          }
        />
      </Screen>
    );
  if (!card) return <Loading />;

  const portraitLead = card.portrait ? (card.portrait.split(/\n{2,}/)[0]?.trim() ?? null) : null;
  const meta = [card.birthday, card.place_of_birth].filter(Boolean).join(" · ");
  const visibleFacts = showAllFacts ? facts : facts.slice(0, 8);

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: card.name,
          headerRight: () => (
            <Pressable onPress={() => Share.share({ message: webUrl })} hitSlop={10}>
              <Ionicons name="share-outline" size={20} color={pal.ink} />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: sp.s7 }}>
        {/* Portrait masthead */}
        <View style={{ paddingHorizontal: sp.s4, paddingTop: sp.s4, flexDirection: "row", gap: sp.s4 }}>
          <PosterImg path={card.profile_path} width={96} height={128} size="w185" />
          <View style={{ flex: 1 }}>
            <Serif size={fs.x2} bold>
              {card.name}
            </Serif>
            {meta ? (
              <Ui size={fs.sm} color={pal.muted} style={{ marginTop: 2 }}>
                {meta}
              </Ui>
            ) : null}
          </View>
        </View>
        {portraitLead ? (
          <View style={{ paddingHorizontal: sp.s4, paddingTop: sp.s3 }}>
            <Serif size={fs.base} numberOfLines={6} style={{ lineHeight: fs.base * 1.5 }}>
              {portraitLead}
            </Serif>
            <Pressable onPress={() => openReader(`/director/${card.slug}`, card.name)} hitSlop={8}>
              <Ui size={fs.sm} color={brand.accent} style={{ paddingVertical: 6 }}>
                {t("common.more")}
              </Ui>
            </Pressable>
          </View>
        ) : null}

        {/* Where to Start — the entry film, hero-sized */}
        {startPick ? (
          <>
            <SectionTitle>{t("director.whereToStart")}</SectionTitle>
            <Pressable
              disabled={!startPick.film_slug}
              onPress={() => startPick.film_slug && goFilm(startPick.film_slug)}
              style={({ pressed }) => ({
                paddingHorizontal: sp.s4,
                flexDirection: "row",
                gap: sp.s3,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <PosterImg
                path={
                  startPick.film_slug ? (filmBySlug.get(startPick.film_slug)?.poster_path ?? null) : null
                }
                width={60}
                height={90}
                size="w185"
              />
              <View style={{ flex: 1 }}>
                <Serif size={fs.lg} numberOfLines={2}>
                  {startPick.film_title ?? ""}
                </Serif>
                {startPick.film_year != null ? (
                  <Ui size={fs.xs + 1} color={pal.muted} style={{ marginTop: 2 }}>
                    {startPick.film_year}
                  </Ui>
                ) : null}
                {startPick.reason ? (
                  <Serif
                    italic
                    size={fs.base}
                    numberOfLines={3}
                    style={{ marginTop: 4, lineHeight: fs.base * 1.45 }}
                  >
                    {startPick.reason}
                  </Serif>
                ) : null}
              </View>
            </Pressable>
          </>
        ) : null}

        {/* The Selection — the remaining ranked picks */}
        {restPicks.length ? (
          <>
            <SectionTitle>{t("director.theSelection")}</SectionTitle>
            <View style={{ paddingHorizontal: sp.s4 }}>
              {restPicks.map((p) => (
                <Pressable
                  key={p.pos}
                  disabled={!p.film_slug}
                  onPress={() => p.film_slug && goFilm(p.film_slug)}
                  style={({ pressed }) => ({
                    paddingVertical: sp.s2,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: sp.s2 }}>
                    <Serif size={fs.base} numberOfLines={1} style={{ flexShrink: 1 }}>
                      {p.pos}. {p.film_title ?? ""}
                      {p.film_year != null ? ` (${p.film_year})` : ""}
                    </Serif>
                    {p.label ? (
                      <View
                        style={{
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: pal.hairline2,
                          paddingHorizontal: 5,
                          paddingVertical: 1,
                        }}
                      >
                        <Ui
                          size={fs.xs}
                          weight="600"
                          color={pal.muted}
                          style={{ letterSpacing: 0.5, textTransform: "uppercase" }}
                        >
                          {p.label}
                        </Ui>
                      </View>
                    ) : null}
                  </View>
                  {p.reason ? (
                    <Ui size={fs.xs + 1} color={pal.muted} numberOfLines={2} style={{ marginTop: 2 }}>
                      {p.reason}
                    </Ui>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {/* Filmography — THE killer surface: availability dots on every row */}
        {films.length ? (
          <>
            <SectionTitle>
              {t("director.filmography")} · {t("director.onYourServices")}
            </SectionTitle>
            <View>
              {films.map((f) => (
                <FilmRow
                  key={f.slug}
                  slug={f.slug}
                  title={f.title}
                  year={f.year}
                  poster_path={f.poster_path}
                  ts={f.ts}
                  tiers={f.tiers}
                />
              ))}
              <Ui size={fs.xs} color={pal.subtle} style={{ paddingHorizontal: sp.s4, paddingTop: sp.s2 }}>
                {t("attribution.justwatch")}
              </Ui>
            </View>
          </>
        ) : null}

        {/* Who's Next — the succession recs */}
        {card.next.length ? (
          <>
            <SectionTitle>{t("director.whosNext")}</SectionTitle>
            <View>
              {[...card.next]
                .sort((a, b) => a.pos - b.pos)
                .map((n) => (
                  <Pressable
                    key={n.pos}
                    onPress={() =>
                      n.target_slug
                        ? router.push({ pathname: "/director/[slug]", params: { slug: n.target_slug } })
                        : openReader(`/director/${card.slug}/next`, card.name)
                    }
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: sp.s3,
                      paddingHorizontal: sp.s4,
                      paddingVertical: sp.s2 + 2,
                      backgroundColor: pressed ? pal.surface : "transparent",
                    })}
                  >
                    <PosterImg path={n.profile_path} width={40} height={40} size="w92" />
                    <View style={{ flex: 1 }}>
                      <Serif size={fs.base} numberOfLines={1}>
                        {n.rec_name}
                      </Serif>
                      {n.reason ? (
                        <Ui size={fs.xs + 1} color={pal.muted} numberOfLines={2}>
                          {n.reason}
                        </Ui>
                      ) : null}
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={pal.subtle} />
                  </Pressable>
                ))}
            </View>
          </>
        ) : null}

        {/* The Life — name meaning, intro, numbered facts */}
        {card.name_meaning || card.intro || facts.length ? (
          <>
            <SectionTitle>{t("director.theLife")}</SectionTitle>
            <View style={{ paddingHorizontal: sp.s4, gap: sp.s3 }}>
              {card.name_meaning ? (
                <Serif italic size={fs.base} style={{ lineHeight: fs.base * 1.5 }}>
                  {card.name_meaning}
                </Serif>
              ) : null}
              {card.intro ? (
                <Serif size={fs.base} style={{ lineHeight: fs.base * 1.5 }}>
                  {card.intro}
                </Serif>
              ) : null}
              {visibleFacts.map((f) => {
                const host = f.source ? hostOf(f.source) : null;
                return (
                  <View key={f.n} style={{ flexDirection: "row", gap: sp.s2 }}>
                    <Ui size={fs.sm} weight="600" color={pal.muted} style={{ marginTop: 1 }}>
                      {f.n}.
                    </Ui>
                    <Serif size={fs.base} style={{ flex: 1, lineHeight: fs.base * 1.45 }}>
                      {f.text}
                      {host ? (
                        <Ui size={fs.xs} color={pal.subtle}>
                          {"  ↗ " + host}
                        </Ui>
                      ) : null}
                    </Serif>
                  </View>
                );
              })}
              {facts.length > 8 ? (
                <Pressable onPress={() => setShowAllFacts((v) => !v)} hitSlop={8}>
                  <Ui size={fs.sm} color={brand.accent}>
                    {showAllFacts ? t("common.showFewer") : t("common.showAll", { n: facts.length })}
                  </Ui>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}

        {/* Read more on Metatake — the webview reading layer */}
        <SectionTitle>{t("action.readMore")}</SectionTitle>
        <View>
          {readMore.map((r) => (
            <View key={r.path}>
              <Pressable
                onPress={() => openReader(r.path, card.name)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: sp.s2,
                  paddingHorizontal: sp.s4,
                  paddingVertical: sp.s3,
                  backgroundColor: pressed ? pal.surface : "transparent",
                })}
              >
                <Ui size={fs.sm} weight="500" style={{ flex: 1 }}>
                  {r.label}
                </Ui>
                {r.chip != null ? (
                  <View
                    style={{
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: pal.hairline2,
                      paddingHorizontal: 5,
                      paddingVertical: 1,
                    }}
                  >
                    <Ui size={fs.xs} weight="600" color={pal.muted}>
                      {r.chip}
                    </Ui>
                  </View>
                ) : null}
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
    </Screen>
  );
}
