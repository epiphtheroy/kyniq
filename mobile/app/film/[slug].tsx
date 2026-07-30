// Film card — the JUDGMENT BRIEF, the app's heart (HANDOFF §5.1, §5.0).
// Fully native — no links out to metatake.net web pages (owner directive
// 2026-07; Share keeps the web URL, §13-2).
// Design system v2 "Lava": full-bleed hero with floating
// glass discs, sheet-over-photo content, grouped surface sections.
// v4: VerdictStrip (rank + V/C/R + runtime + dots), For You (server-supplied
// evidence only — §13-17), What to Expect (13-dim chips), JudgeBar pinned
// bottom with instant undo on every transition (§13-15), Considering ring
// buffer input (D2). My-rating stars stay visually apart from the TakeScore
// group (never-blend, §13-18).
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image, Linking, ScrollView, Share, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FilmMiniMap from "../../src/components/FilmMiniMap";
import { TSDonut } from "../../src/components/TSDonut";
import {
  AvailabilityDots,
  Btn,
  Hairline,
  JudgeBar,
  PosterImg,
  ReasonChip,
  Screen,
  SectionTitle,
  Serif,
  StarRow,
  Tactile,
  Ui,
  UndoPill,
  VcrBars,
} from "../../src/components/ui";
import { METATAKE_BASE, TMDB_IMG } from "../../src/config";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Appear, Shimmer, SkeletonText } from "../../src/components/motion";
import { t } from "../../src/i18n";
import { api, me } from "../../src/lib/api";
import { noteJudged, noteOpened } from "../../src/lib/considering";
import { verdictColor, verdictKey, verdictOf } from "../../src/lib/verdict";
import { useFilms, type JudgmentUndo } from "../../src/state/films";
import { usePrefs } from "../../src/state/prefs";
import { brand, fs, motion, radius, shadow, sp, tierColor, usePalette } from "../../src/theme";
import type { FilmCard as FilmCardT, TowComment } from "../../src/types";

const KIND_LABEL: Record<string, string> = {
  flatrate: "kind.flatrate",
  free: "kind.free",
  ads: "kind.ads",
  rent: "kind.rent",
  buy: "kind.buy",
};

/** Hero pager dot — the current page stretches into a pill (owner 07-30 polish). */
function PagerDot({ on }: { on: boolean }) {
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    p.value = withSpring(on ? 1 : 0, motion.snappy);
  }, [on, p]);
  const anim = useAnimatedStyle(() => ({
    width: interpolate(p.value, [0, 1], [6, 18]),
    opacity: interpolate(p.value, [0, 1], [0.45, 1]),
  }));
  return (
    <Animated.View
      style={[{ height: 6, borderRadius: 3, backgroundColor: "#FFFFFF" }, anim]}
    />
  );
}

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

/** Judgment toast — UndoPill when reversible, quiet notice pill otherwise. */
type Toast = { label: string; token: JudgmentUndo | null };

export default function FilmScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const pal = usePalette();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { country, locale } = usePrefs();
  const {
    session,
    ledger,
    ready,
    entry: entryOf,
    setWatchlist,
    dismiss,
    undismiss,
    markSeen,
    rate,
    undo,
  } = useFilms();

  const [card, setCard] = useState<FilmCardT | null>(null);
  const [tow, setTow] = useState<TowComment | null>(null);
  const [err, setErr] = useState(false);
  const [heroIdx, setHeroIdx] = useState(0);
  const [reasons, setReasons] = useState<string[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [showAllLineage, setShowAllLineage] = useState(false);
  const [busy, setBusy] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    setCard(null);
    setErr(false);
    setHeroIdx(0);
    setReasons([]);
    setToast(null);
    setShowRating(false);
    setShowAllLineage(false);
    api
      .film(String(slug), country, locale)
      .then((c) => alive && setCard(c))
      .catch(() => alive && setErr(true));
    // to.W — the curator's letter (owner 07-29: every film carries it when curated).
    // Fail-soft: null renders nothing.
    setTow(null);
    api
      .towComment(String(slug))
      .then((tw) => alive && setTow(tw))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [slug, country, locale]);

  // For You (a): my wwi reason chips for this film — server-supplied only (§13-17).
  useEffect(() => {
    let alive = true;
    if (!session || !card) return;
    me.recommendCached(1.0).then((rows) => {
      if (!alive) return;
      const r = rows.find((x) => x.slug === card.slug)?.reasons;
      setReasons(r ? r.slice(0, 3) : []);
    });
    return () => {
      alive = false;
    };
  }, [session, card]);

  // Considering (D2): opened the brief with no judgment on record → ring buffer.
  useEffect(() => {
    if (!card || !ready) return;
    const e = entryOf(card.slug);
    if (!e.seen && !e.watchlist && !e.dismissed) {
      void noteOpened({ slug: card.slug, title: card.title, poster_path: card.poster_path });
    }
  }, [card, ready, entryOf]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const entry = card ? ledger.get(card.slug) : undefined;
  const webUrl = `${METATAKE_BASE}/film/${slug}`;

  // Hero pager pages: server backdrops (images[0..3]) + the poster as the
  // final page (owner directive 2026-07-20). Falls back to the single
  // backdrop_path until the server ships `images`.
  const heroPages = useMemo(() => {
    if (!card) return [] as { kind: "backdrop" | "poster"; path: string }[];
    const pages: { kind: "backdrop" | "poster"; path: string }[] = [];
    const backs = card.images?.length
      ? card.images.slice(0, 4)
      : card.backdrop_path
        ? [card.backdrop_path]
        : [];
    for (const b of backs) pages.push({ kind: "backdrop", path: b });
    if (card.poster_path) pages.push({ kind: "poster", path: card.poster_path });
    return pages;
  }, [card]);

  // For You (b): kindred films the ledger marks seen.
  const kindredSeen = useMemo(
    () => (card?.kindred ?? []).filter((k) => ledger.get(k.slug)?.seen),
    [card, ledger],
  );

  const flash = useCallback((label: string, token: JudgmentUndo | null) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ label, token });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  /** After any successful judgment (§5.0): settle Considering + drop wwi memos. */
  const afterJudgment = useCallback((s: string) => {
    void noteJudged(s);
    me.invalidateRecommend();
  }, []);

  /** Signed-out judgment attempt → notice + onboarding (UX doctrine §4.1). */
  const guard = useCallback((): boolean => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!session) {
      flash(t("judge.signInToKeep"), null);
      // Straight to the sign-in form, not the top of onboarding.
      router.push({ pathname: "/onboarding", params: { step: "account" } });
      return false;
    }
    return true;
  }, [session, flash, router]);

  const onWant = useCallback(async () => {
    if (!card || busy || !guard()) return;
    const on = !(entry?.watchlist ?? false);
    setBusy(true);
    const token = await setWatchlist(card.slug, on);
    setBusy(false);
    if (token) {
      // No dedicated "removed" key — reuse judge.undo as the removal message.
      flash(on ? t("judge.kept") : t("judge.removed"), token);
      afterJudgment(card.slug);
    }
  }, [card, busy, guard, entry?.watchlist, setWatchlist, flash, afterJudgment]);

  const onPass = useCallback(async () => {
    if (!card || busy || !guard()) return;
    const wasDismissed = entry?.dismissed ?? false;
    setBusy(true);
    const token = wasDismissed ? await undismiss(card.slug) : await dismiss(card.slug);
    setBusy(false);
    if (token) {
      flash(wasDismissed ? t("judge.restore") : t("judge.passed"), token);
      afterJudgment(card.slug);
    }
  }, [card, busy, guard, entry?.dismissed, undismiss, dismiss, flash, afterJudgment]);

  const onSeen = useCallback(async () => {
    if (!card || busy) return;
    if (entry?.seen) {
      // Already seen: toggle the rating row; undoing seen goes through the
      // UndoPill token from markSeen — never a confirm dialog (§13-15).
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setShowRating((s) => !s);
      return;
    }
    if (!guard()) return;
    setBusy(true);
    const token = await markSeen(card.slug);
    setBusy(false);
    if (token) {
      flash(t("judge.seenMarked"), token);
      setShowRating(true);
      afterJudgment(card.slug);
    }
  }, [card, busy, guard, entry?.seen, markSeen, flash, afterJudgment]);

  const onRate = useCallback(
    async (v: number) => {
      if (!card || !guard()) return;
      const token = await rate(card.slug, v);
      if (token) afterJudgment(card.slug);
    },
    [card, guard, rate, afterJudgment],
  );

  const onUndoPress = useCallback(() => {
    const tk = toast?.token;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(null);
    if (tk) {
      void undo(tk);
      me.invalidateRecommend();
    }
  }, [toast, undo]);

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
        {/* The brief's own silhouette: hero plate, then masthead + strip lines. */}
        <Shimmer width={width} height={Math.round(width * 0.72)} rounded={0} />
        <View style={{ paddingHorizontal: sp.s4, paddingTop: sp.s5, gap: sp.s3 }}>
          <SkeletonText w={0.7} size={26} />
          <SkeletonText w={0.35} size={13} />
          <SkeletonText w={0.5} size={13} />
          <View style={{ paddingTop: sp.s4, gap: sp.s2 }}>
            <SkeletonText w={1} size={15} />
            <SkeletonText w={0.96} size={15} />
            <SkeletonText w={0.6} size={15} />
          </View>
        </View>
      </Screen>
    );
  }

  const heroH = Math.round(width * 0.72);
  // Defend every core payload array/object the way the director screen does — a single
  // missing field (e.g. lead_fallback is EN-only; a ko/es/ja edition or shape-drifted
  // server can omit it) would otherwise throw during render and blank the whole screen.
  const lead = card.invitation ?? (card.lead_fallback?.length ? card.lead_fallback.join(" ") : null);
  const availability = card.availability ?? [];
  const lineage = card.lineage ?? [];
  const locCount = card.locations?.count ?? 0;
  const locPins = card.locations?.pins ?? [];
  // Open a filming location in the device's native maps app (Google Maps if installed,
  // else Apple Maps/Safari) — no CDN, no API key, no freeze. Replaces the old in-app
  // WebView map tab which hung on slow tile/CDN loads and trapped the back button.
  const openPinInMaps = (pin?: { lat: number; lng: number }) => {
    if (!pin) return;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${pin.lat},${pin.lng}`).catch(() => {});
  };
  const availKinds = [...new Set(availability.map((a) => a.kind))];
  const hasRank = card.rank != null && card.rank_total != null;
  const topDims = card.dims?.length ? [...card.dims].sort((a, b) => b.val - a.val).slice(0, 3) : [];
  const myVerdict =
    entry?.rating != null && card.standing != null ? verdictOf(entry.rating, card.standing) : null;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 240 }} showsVerticalScrollIndicator={false}>
        {/* Hero — full-bleed image, top scrim, floating glass controls.
            Backdrops are landscape by nature; when a film only has a PORTRAIT
            poster, never crop it into the landscape frame — show it contained
            over a blurred self-fill instead (owner directive 2026-07-18). */}
        <View style={{ width, height: heroH, backgroundColor: "#000", overflow: "hidden" }}>
          {heroPages.length > 1 ? (
            <ScrollView
              key={card.slug}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setHeroIdx(Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1)))
              }
            >
              {heroPages.map((pg, i) => (
                <View key={`${pg.kind}-${i}`} style={{ width, height: heroH }}>
                  {pg.kind === "poster" ? (
                    <>
                      <Image
                        source={{ uri: `${TMDB_IMG}/w342${pg.path}` }}
                        blurRadius={26}
                        resizeMode="cover"
                        style={{ position: "absolute", width, height: heroH, opacity: 0.55 }}
                      />
                      <Image
                        source={{ uri: `${TMDB_IMG}/w500${pg.path}` }}
                        resizeMode="contain"
                        style={{ width, height: heroH }}
                      />
                    </>
                  ) : (
                    <PosterImg path={pg.path} width={width} height={heroH} size="w780" rounded={0} />
                  )}
                </View>
              ))}
            </ScrollView>
          ) : card.backdrop_path ? (
            <PosterImg path={card.backdrop_path} width={width} height={heroH} size="w780" rounded={0} />
          ) : card.poster_path ? (
            <>
              <Image
                source={{ uri: `${TMDB_IMG}/w342${card.poster_path}` }}
                blurRadius={26}
                resizeMode="cover"
                style={{ position: "absolute", width, height: heroH, opacity: 0.55 }}
              />
              <Image
                source={{ uri: `${TMDB_IMG}/w500${card.poster_path}` }}
                resizeMode="contain"
                style={{ width, height: heroH }}
              />
            </>
          ) : (
            <PosterImg path={null} width={width} height={heroH} rounded={0} />
          )}
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0)"]}
            style={{ position: "absolute", top: 0, left: 0, right: 0, height: 110 }}
          />
          {heroPages.length > 1 ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                bottom: 34,
                left: 0,
                right: 0,
                flexDirection: "row",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {heroPages.map((_, i) => (
                <PagerDot key={i} on={i === heroIdx} />
              ))}
            </View>
          ) : null}
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
              onPress={() => void onWant()}
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
                {[card.year, ...(card.genres ?? []).slice(0, 2)].filter(Boolean).join(" · ")}
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

          {/* VerdictStrip — rank + V/C/R + runtime + availability dots (§5.1).
              Each fragment renders only when its data exists (§13-17). */}
          {hasRank || card.vcr || card.runtime || availKinds.length ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: sp.s3,
                paddingHorizontal: sp.s4,
                marginTop: sp.s3,
              }}
            >
              {hasRank ? (
                <Ui size={fs.xs} weight="600" color={pal.inkSoft}>
                  {t("film.rankOf", { rank: card.rank as number, total: card.rank_total as number })}
                </Ui>
              ) : null}
              {card.vcr ? <VcrBars v={card.vcr.v} c={card.vcr.c} r={card.vcr.r} width={64} /> : null}
              {card.runtime ? (
                <Ui size={fs.xs} color={pal.muted}>
                  {card.runtime} min
                </Ui>
              ) : null}
              {availKinds.length ? <AvailabilityDots tiers={availKinds} /> : null}
            </View>
          ) : null}

          {/* An Invitation */}
          {lead ? (
            <>
              <SectionTitle>{t("film.invitation")}</SectionTitle>
              <View style={{ paddingHorizontal: sp.s4 }}>
                <Serif size={fs.base} style={{ lineHeight: fs.base * 1.6 }}>
                  {lead}
                </Serif>
              </View>
            </>
          ) : null}

          {/* to.W — the curator's letter (owner 07-29: every curated film carries it).
              Addressee/signature are fixed brand strings (contract — never localized). */}
          {tow?.rationale ? (
            <Appear
              style={{
                marginHorizontal: sp.s4,
                marginTop: sp.s5,
                backgroundColor: pal.surface,
                borderRadius: radius.md,
                padding: sp.s4,
                gap: sp.s2,
              }}
            >
              <Ui size={fs.xs} weight="700" color={pal.muted} style={{ letterSpacing: 0.5 }}>
                to. WY. Heo
              </Ui>
              <Serif size={fs.sm} style={{ lineHeight: fs.sm * 1.65 }}>
                {tow.rationale}
              </Serif>
              <View style={{ flexDirection: "row", alignItems: "center", gap: sp.s2, marginTop: 2 }}>
                {tow.verdict_label ? (
                  <Ui size={fs.xs} weight="700" color={brand.accent}>
                    {tow.verdict_label}
                  </Ui>
                ) : null}
                <Ui size={fs.xs} color={pal.subtle} style={{ flex: 1, textAlign: "right" }}>
                  from. Metatake AI Editorial
                </Ui>
              </View>
            </Appear>
          ) : null}

          {/* For You — signed-in, server-supplied evidence only; whole section
              omitted when both sources are empty (§13-17). */}
          {session && (reasons.length > 0 || kindredSeen.length > 0) ? (
            <>
              <SectionTitle>{t("film.forYou")}</SectionTitle>
              {reasons.length ? (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: sp.s2,
                    paddingHorizontal: sp.s4,
                  }}
                >
                  {reasons.map((r) => (
                    <ReasonChip key={r} label={r} />
                  ))}
                </View>
              ) : null}
              {kindredSeen.length ? (
                <>
                  <Ui
                    size={fs.sm}
                    weight="500"
                    color={pal.inkSoft}
                    style={{ paddingHorizontal: sp.s4, marginTop: reasons.length ? sp.s3 : 0 }}
                  >
                    {t("film.kindredSeen", { n: kindredSeen.length })}
                  </Ui>
                  <View style={{ marginTop: sp.s2 }}>
                    <Group>
                      {kindredSeen.map((k, i) => (
                        <View key={k.slug}>
                          {i > 0 ? <Hairline style={{ marginLeft: sp.s4 }} /> : null}
                          <Tactile
                            onPress={() =>
                              router.push({ pathname: "/film/[slug]", params: { slug: k.slug } })
                            }
                            style={{
                              flexDirection: "row",
                              alignItems: "baseline",
                              gap: sp.s2,
                              paddingHorizontal: sp.s4,
                              paddingVertical: 11,
                            }}
                          >
                            <Ui size={fs.sm} weight="500" numberOfLines={1} style={{ flexShrink: 1 }}>
                              {k.title}
                            </Ui>
                            <Ui size={fs.xs} color={pal.muted}>
                              {k.year ?? ""}
                            </Ui>
                            <View style={{ flex: 1 }} />
                            <Ui size={fs.xs} color={pal.muted}>
                              {t("film.sharedThreads", { n: k.shared })}
                            </Ui>
                          </Tactile>
                        </View>
                      ))}
                    </Group>
                  </View>
                </>
              ) : null}
            </>
          ) : null}

          {/* What to Expect — 13-dim fact chips, rule-based (§5.1 P-D). */}
          {topDims.length ? (
            <>
              <SectionTitle>{t("film.whatToExpect")}</SectionTitle>
              <View
                style={{ flexDirection: "row", flexWrap: "wrap", gap: sp.s2, paddingHorizontal: sp.s4 }}
              >
                {topDims.map((d) => (
                  <ReasonChip key={d.key} label={`${d.label} · ${Math.round(d.val)}`} />
                ))}
              </View>
            </>
          ) : null}

          {/* Mid-page figure A (owner directive 2026-07-20) — a breather still
              between the fact chips and availability; only when the server
              shipped enough backdrops. */}
          {card.images?.[4] ? (
            <View style={{ marginHorizontal: sp.s4, marginTop: sp.s5 }}>
              <PosterImg
                path={card.images[4]}
                width={width - sp.s4 * 2}
                height={Math.round((width - sp.s4 * 2) * 0.56)}
                size="w780"
                rounded={radius.md}
              />
            </View>
          ) : null}

          {/* Where to watch — grouped rows, native display only (no web link). */}
          <SectionTitle sub={country}>{t("film.whereToWatch")}</SectionTitle>
          {availability.length ? (
            <>
              <Group>
                {availability.slice(0, 8).map((a, i) => (
                  <View key={`${a.pid}-${a.kind}`}>
                    {i > 0 ? <Hairline style={{ marginLeft: sp.s4 }} /> : null}
                    <View
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
                    </View>
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

          {/* Lineage — static native rows off card.lineage (no web link). */}
          {lineage.length ? (
            <>
              <SectionTitle>{t("film.lineage")}</SectionTitle>
              <Group>
                {(showAllLineage ? lineage : lineage.slice(0, 6)).map((l, i) => (
                  <View key={`${l.list_slug}-${i}`}>
                    {i > 0 ? <Hairline style={{ marginLeft: sp.s4 }} /> : null}
                    <View
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
                    </View>
                  </View>
                ))}
                {lineage.length > 6 ? (
                  <>
                    <Hairline style={{ marginLeft: sp.s4 }} />
                    <Tactile onPress={() => setShowAllLineage((v) => !v)}>
                      <Ui
                        size={fs.sm}
                        weight="500"
                        color={brand.accent}
                        style={{ paddingHorizontal: sp.s4, paddingVertical: 11 }}
                      >
                        {showAllLineage
                          ? t("common.showFewer")
                          : t("common.showAll", { n: lineage.length })}
                      </Ui>
                    </Tactile>
                  </>
                ) : null}
              </Group>
            </>
          ) : null}

          {/* Mid-page figure B */}
          {card.images?.[5] ? (
            <View style={{ marginHorizontal: sp.s4, marginTop: sp.s5 }}>
              <PosterImg
                path={card.images[5]}
                width={width - sp.s4 * 2}
                height={Math.round((width - sp.s4 * 2) * 0.56)}
                size="w780"
                rounded={radius.md}
              />
            </View>
          ) : null}

          {/* Locations — embedded map with ONLY this film's pins (owner directive
              2026-07-18), then the named rows; both open the Map tab film-focused. */}
          {locCount > 0 ? (
            <>
              <SectionTitle sub={`${locCount}`}>{t("film.locations")}</SectionTitle>
              {locPins.length ? (
                <View style={{ marginHorizontal: sp.s4, marginBottom: sp.s3 }}>
                  <FilmMiniMap
                    pins={locPins}
                    height={Math.round((width - sp.s4 * 2) * 0.56)}
                    onPress={() => openPinInMaps(locPins[0])}
                  />
                </View>
              ) : null}
              <Group>
                {locPins.slice(0, 3).map((p, i) => (
                  <View key={String(p.id)}>
                    {i > 0 ? <Hairline style={{ marginLeft: sp.s4 }} /> : null}
                    <Tactile
                      onPress={() => openPinInMaps(p)}
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
                    {(card.the_life.facts ?? []).slice(0, 2).map((f) => (
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

          <Ui size={fs.xs} color={pal.subtle} style={{ paddingHorizontal: sp.s4, paddingTop: sp.s3 }}>
            {t("attribution.tmdb")}
          </Ui>
        </View>
      </ScrollView>

      {/* Judgment stack — toast, rating row, and the JudgeBar pinned bottom.
          The rating row lives here, far from the TakeScore group (§13-18). */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: sp.s4,
          paddingBottom: Math.max(insets.bottom, sp.s3),
          gap: sp.s2,
        }}
      >
        {toast ? (
          toast.token ? (
            <UndoPill label={toast.label} actionLabel={t("judge.undo")} onUndo={onUndoPress} />
          ) : (
            <View
              style={[
                {
                  alignSelf: "center",
                  borderRadius: radius.pill,
                  paddingHorizontal: sp.s4,
                  paddingVertical: 10,
                  backgroundColor: pal.ink,
                },
                shadow.float,
              ]}
            >
              <Ui size={fs.sm} color={pal.bg} numberOfLines={1} style={{ maxWidth: 260 }}>
                {toast.label}
              </Ui>
            </View>
          )
        ) : null}

        {showRating && entry?.seen ? (
          <View
            style={[
              {
                borderRadius: radius.md,
                backgroundColor: pal.card,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: pal.hairline,
                padding: sp.s4,
                gap: sp.s3,
              },
              shadow.card,
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Ui size={fs.sm} weight="600">
                {t("judge.yourRating")}
              </Ui>
              {myVerdict ? (
                <View
                  style={{
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: verdictColor(myVerdict),
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                  }}
                >
                  <Ui size={fs.xs} weight="600" color={verdictColor(myVerdict)}>
                    {t(verdictKey(myVerdict))}
                  </Ui>
                </View>
              ) : null}
            </View>
            <StarRow value={entry?.rating ?? null} onChange={(v) => void onRate(v)} />
          </View>
        ) : null}

        <JudgeBar
          want={entry?.watchlist ?? false}
          passed={entry?.dismissed ?? false}
          seen={entry?.seen ?? false}
          busy={busy}
          onWant={() => void onWant()}
          onPass={() => void onPass()}
          onSeen={() => void onSeen()}
          labels={{ want: t("judge.want"), pass: t("judge.pass"), seen: t("judge.seenIt") }}
        />
      </View>
    </Screen>
  );
}
