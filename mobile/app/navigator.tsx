// The Navigator — cinephile turn-by-turn (HANDOFF-내비게이터-시네필터바이턴.md §5.3).
// The flagship "여정 안내" mode: one destination, one next turn, the road ahead.
// Renders the familiar Google-Maps driving shape natively with RN Views only —
// NO native map: a green maneuver card (next film), a receding road with poster
// signposts (near large → far small for depth), the "me" chevron, and a bottom
// sheet led by 남은 소요시간 with a traveled/remaining meter and a 최단/최속/무료도로
// switch. Position is ledger-derived server-side (invariant §10-1); marking the
// next film seen advances the chevron ("경로를 재탐색합니다"). Works on web too
// (pure RN primitives), so mobile and web stay in step.
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, Share, View, useColorScheme, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Btn, Loading, PosterImg, Screen, Serif, Tactile, Ui } from "../src/components/ui";
import { METATAKE_BASE } from "../src/config";
import { getLocale, t } from "../src/i18n";
import { api, me } from "../src/lib/api";
import { useFilms } from "../src/state/films";
import { usePrefs } from "../src/state/prefs";
import { brand, fs, radius, shadow, sp, usePalette } from "../src/theme";
import type { NavAvailability, NavPref, NavStop, NavigatorPayload } from "../src/types";

const DEFAULT_DIR = "stanley-kubrick";
const GOLD = "#8F6A1E";
const PREFS: NavPref[] = ["fewest", "fastest", "no_tolls"];

/** Duration — locale-aware long form ("11시간 53분" / "11h 53m"). */
function fmtDur(min: number | null): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  const loc = getLocale();
  if (loc === "ko") return h ? `${h}시간 ${m}분` : `${m}분`;
  if (loc === "ja") return h ? `${h}時間${m}分` : `${m}分`;
  return h ? `${h}h ${m}m` : `${m}m`;
}
/** Compact meter form ("9:52"). */
function fmtHM(min: number | null): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function availLabel(a: NavAvailability, leavingSoon: boolean): string {
  if (leavingSoon) return t("nav.leavingSoon");
  if (a === "sub") return t("nav.playNow");
  if (a === "rent") return t("nav.rent");
  return t("nav.notOnServices");
}
function availDot(a: NavAvailability): string {
  if (a === "sub") return "#84F3BC";
  if (a === "rent") return "#F0C674";
  return "rgba(255,255,255,0.5)";
}

/** Floating chrome disc (matches the director screen's back/share affordance). */
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

export default function NavigatorScreen() {
  const params = useLocalSearchParams<{ dir?: string }>();
  const router = useRouter();
  const pal = usePalette();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const { country } = usePrefs();
  const { session, markSeen } = useFilms();

  const [dir, setDir] = useState<string | null>(params.dir ?? null);
  const [data, setData] = useState<NavigatorPayload | null>(null);
  const [err, setErr] = useState(false);
  const [gen, setGen] = useState(0); // refetch bump (reroute after a judgment)
  const [pref, setPref] = useState<NavPref>("fewest");
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [mapBox, setMapBox] = useState({ w: 0, h: 0 });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve the destination: an explicit ?dir, else the director the user is
  // mid-conquest on, else the canon default (§3 v1).
  useEffect(() => {
    if (dir) return;
    let alive = true;
    (async () => {
      const d = session ? await me.midConquestDirector().catch(() => null) : null;
      if (alive) setDir(d ?? DEFAULT_DIR);
    })();
    return () => {
      alive = false;
    };
  }, [dir, session]);

  // Fetch the drive.
  useEffect(() => {
    if (!dir) return;
    let alive = true;
    setData(null);
    setErr(false);
    api
      .navigator(dir, country)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setPref(d.defaultPref);
        setSkipped(new Set());
      })
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [dir, country, gen]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  // The active route for the selected pref, with locally-skipped turns pushed to
  // the rear (§4.4 — skip is a re-order, never a deletion or a penalty).
  const view = useMemo(() => {
    if (!data) return null;
    const base = data.routes[pref];
    const active = base.stops.filter((s) => !skipped.has(s.slug));
    const rear = base.stops.filter((s) => skipped.has(s.slug));
    const stops = [...active, ...rear];
    const reasonFor = (slug: string): string =>
      base.next?.slug === slug ? base.next.reason : base.then?.slug === slug ? base.then.reason : "";
    return { base, stops, reasonFor };
  }, [data, pref, skipped]);

  const onMapLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setMapBox({ w: width, h: height });
  };

  const onMarkSeen = useCallback(
    async (slug: string) => {
      if (!session) {
        router.push({ pathname: "/onboarding", params: { step: "account" } });
        return;
      }
      const token = await markSeen(slug);
      if (token) {
        showToast(t("nav.rerouting"));
        setGen((g) => g + 1); // reroute: refetch → chevron advances
      }
    },
    [session, markSeen, router, showToast],
  );

  const onSkip = useCallback((slug: string) => {
    setSkipped((prev) => new Set(prev).add(slug));
  }, []);

  // ── loading / error ─────────────────────────────────────────────────────
  if (err)
    return (
      <Screen style={{ alignItems: "center", justifyContent: "center", gap: sp.s4, padding: sp.s5 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ui size={fs.md} color={pal.muted} style={{ textAlign: "center" }}>
          {t("error.network")}
        </Ui>
        <Btn label={t("action.retry")} onPress={() => setGen((g) => g + 1)} style={{ alignSelf: "stretch" }} />
        <View style={{ position: "absolute", top: insets.top + sp.s2, left: sp.s4 }}>
          <Disc icon="chevron-back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} />
        </View>
      </Screen>
    );
  if (!data || !view)
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <Loading />
        <View style={{ position: "absolute", top: insets.top + sp.s2, left: sp.s4 }}>
          <Disc icon="chevron-back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} />
        </View>
      </Screen>
    );

  const arrived = data.remaining === 0 || view.stops.length === 0;
  const head = view.stops[0] ?? null; // the next turn (a NavStop)
  const then = view.stops[1] ?? null;
  const webUrl = `${METATAKE_BASE}/navigator-preview.html`;

  // traveled fraction for the meter
  const trav = data.runtimeTraveled ?? 0;
  const rem = data.runtimeRemaining ?? 0;
  const doneFrac = trav + rem > 0 ? trav / (trav + rem) : arrived ? 1 : 0;

  // ── receding-road signposts: nearest few + the flagged destination ────────
  const near = view.stops.slice(0, 4);
  const destStop = view.stops[view.stops.length - 1] ?? null;
  const signList: { stop: NavStop; isDest: boolean }[] = near.map((s) => ({ stop: s, isDest: false }));
  if (destStop && !near.some((s) => s.slug === destStop.slug)) {
    signList.push({ stop: destStop, isDest: true });
  } else if (destStop && near.length && near[near.length - 1].slug === destStop.slug) {
    signList[signList.length - 1].isDest = true;
  }
  // depth layout: index 0 = nearest (large, low); higher = farther (small, high)
  const layout = [
    { leftPct: 0.71, bottomPct: 0.2, w: 66 },
    { leftPct: 0.29, bottomPct: 0.37, w: 54 },
    { leftPct: 0.69, bottomPct: 0.52, w: 43 },
    { leftPct: 0.31, bottomPct: 0.64, w: 34 },
    { leftPct: 0.5, bottomPct: 0.76, w: 29 },
  ];

  const field: readonly [string, string] =
    scheme === "dark" ? ["#2A2620", "#211E19"] : ["#EFE9D8", "#E7E0CE"];
  const roadColor = scheme === "dark" ? "#3A352C" : "#D8D0BC";

  // road trapezoid geometry (border trick — wide at bottom, narrow at top)
  const roadBottomW = mapBox.w * 0.52;
  const roadTopW = mapBox.w * 0.14;
  const roadSide = Math.max(0, (roadBottomW - roadTopW) / 2);
  const roadH = mapBox.h * 0.92;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ═══════════ GREEN MANEUVER CARD (the next turn) ═══════════ */}
      <View style={{ paddingTop: insets.top + 48, paddingHorizontal: sp.s2 }}>
        {arrived || !head ? (
          <LinearGradient
            colors={[brand.success, "#0B6B3A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: radius.lg, padding: sp.s4, ...shadow.card }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: sp.s3 }}>
              <Ionicons name="flag" size={28} color="#fff" />
              <View style={{ flex: 1 }}>
                <Serif size={fs.lg} bold color="#fff">
                  {t("nav.arrived")}
                </Serif>
                <Ui size={fs.sm} color="rgba(255,255,255,0.9)" style={{ marginTop: 2 }}>
                  {t("nav.arrivedSub", { label: data.label, n: data.seenCount })}
                </Ui>
              </View>
            </View>
          </LinearGradient>
        ) : (
          <LinearGradient
            colors={[brand.success, "#0B6B3A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: radius.lg, overflow: "hidden", ...shadow.card }}
          >
            <Tactile onPress={() => router.push({ pathname: "/film/[slug]", params: { slug: head.slug } })}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: sp.s3, padding: sp.s3 }}>
                <View style={{ width: 40, alignItems: "center" }}>
                  <Ionicons name="return-up-forward" size={30} color="#fff" />
                  <Ui size={fs.xs - 1} weight="700" color="rgba(255,255,255,0.9)" style={{ marginTop: 1 }}>
                    {t("nav.next")}
                  </Ui>
                </View>
                <View style={{ borderRadius: radius.xs, overflow: "hidden", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.35)" }}>
                  <PosterImg path={head.poster_path} width={46} height={68} size="w185" rounded={radius.xs - 2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Serif size={fs.lg} bold color="#fff" numberOfLines={1}>
                    {head.title}
                  </Serif>
                  <Ui size={fs.sm} color="rgba(255,255,255,0.9)" numberOfLines={1} style={{ marginTop: 1 }}>
                    {[head.year, head.runtime ? fmtDur(head.runtime) : null].filter(Boolean).join(" · ")}
                  </Ui>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      alignSelf: "flex-start",
                      gap: 6,
                      marginTop: 6,
                      backgroundColor: "rgba(255,255,255,0.16)",
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.28)",
                      borderRadius: radius.pill,
                      paddingHorizontal: 9,
                      paddingVertical: 3,
                    }}
                  >
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: availDot(head.availability) }} />
                    <Ui size={fs.xs} weight="600" color="#fff">
                      {availLabel(head.availability, false)}
                    </Ui>
                  </View>
                </View>
              </View>
            </Tactile>
            {view.reasonFor(head.slug) ? (
              <View style={{ paddingHorizontal: sp.s4, paddingBottom: 8, marginTop: -2 }}>
                <Ui size={fs.xs} color="rgba(255,255,255,0.82)" numberOfLines={1}>
                  {view.reasonFor(head.slug)}
                </Ui>
              </View>
            ) : null}
            {then ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: sp.s4,
                  paddingVertical: 8,
                  backgroundColor: "rgba(0,0,0,0.14)",
                }}
              >
                <Ionicons name="arrow-up" size={13} color="rgba(255,255,255,0.7)" />
                <Ui size={fs.xs} color="rgba(255,255,255,0.7)">
                  {t("nav.then")}
                </Ui>
                <Ui size={fs.xs} weight="700" color="#fff" numberOfLines={1} style={{ flex: 1 }}>
                  {then.title}
                  {then.runtime ? ` · ${fmtDur(then.runtime)}` : ""}
                </Ui>
              </View>
            ) : null}
          </LinearGradient>
        )}
      </View>

      {/* ═══════════ ROAD — receding, with poster signposts ═══════════ */}
      <View style={{ flex: 1, overflow: "hidden" }} onLayout={onMapLayout}>
        <LinearGradient
          colors={field}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />

        {mapBox.w > 0 && mapBox.h > 0 ? (
          <>
            {/* road bed (trapezoid, wide at bottom) */}
            <View
              style={{
                position: "absolute",
                bottom: 0,
                left: (mapBox.w - roadBottomW) / 2,
                width: roadTopW,
                height: 0,
                borderBottomWidth: roadH,
                borderBottomColor: roadColor,
                borderLeftWidth: roadSide,
                borderRightWidth: roadSide,
                borderLeftColor: "transparent",
                borderRightColor: "transparent",
              }}
            />
            {/* lane marks + blue route dashes down the center (near big → far small) */}
            {Array.from({ length: 7 }).map((_, i) => {
              const f = i / 7; // 0 near → ~1 far
              const y = mapBox.h * (0.12 + f * 0.72);
              const w = 7 * (1 - f * 0.7);
              const h = 16 * (1 - f * 0.7);
              return (
                <View
                  key={i}
                  style={{
                    position: "absolute",
                    left: mapBox.w / 2 - w / 2,
                    top: y,
                    width: w,
                    height: h,
                    borderRadius: 2,
                    backgroundColor: i < 3 ? brand.accent : "rgba(255,255,255,0.65)",
                    opacity: 1 - f * 0.5,
                  }}
                />
              );
            })}

            {/* poster signposts standing along the road */}
            {signList.map(({ stop, isDest }, i) => {
              const L = layout[Math.min(i, layout.length - 1)];
              const w = L.w;
              const h = Math.round(w * 1.5);
              const left = mapBox.w * L.leftPct - w / 2;
              const bottom = mapBox.h * L.bottomPct;
              const isNow = i === 0;
              return (
                <View key={stop.slug} style={{ position: "absolute", left, bottom, alignItems: "center" }}>
                  {isDest ? <Ionicons name="flag" size={16} color={GOLD} style={{ marginBottom: 1 }} /> : null}
                  <Tactile onPress={() => router.push({ pathname: "/film/[slug]", params: { slug: stop.slug } })}>
                    <View
                      style={{
                        borderRadius: 6,
                        overflow: "hidden",
                        borderWidth: 2,
                        borderColor: isNow ? brand.accent : isDest ? GOLD : "#fff",
                        ...shadow.card,
                      }}
                    >
                      <PosterImg path={stop.poster_path} width={w} height={h} size="w185" rounded={4} />
                    </View>
                  </Tactile>
                  {/* pole */}
                  <View style={{ width: 2.5, height: 12, backgroundColor: "#b7ad96" }} />
                  {isNow || isDest ? (
                    <View
                      style={{
                        marginTop: 2,
                        backgroundColor: isNow ? brand.accent : GOLD,
                        borderRadius: radius.pill,
                        paddingHorizontal: 7,
                        paddingVertical: 1,
                      }}
                    >
                      <Ui size={fs.xs - 2} weight="700" color="#fff" numberOfLines={1}>
                        {isNow ? t("nav.next") : t("nav.destination")}
                      </Ui>
                    </View>
                  ) : null}
                </View>
              );
            })}

            {/* "me" position chevron on the road */}
            <View style={{ position: "absolute", left: mapBox.w / 2 - 16, bottom: mapBox.h * 0.06, alignItems: "center" }}>
              <View
                style={{
                  width: 0,
                  height: 0,
                  borderLeftWidth: 15,
                  borderRightWidth: 15,
                  borderBottomWidth: 26,
                  borderLeftColor: "transparent",
                  borderRightColor: "transparent",
                  borderBottomColor: brand.accent,
                }}
              />
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: brand.accent,
                  borderWidth: 2.5,
                  borderColor: "#fff",
                  marginTop: -3,
                }}
              />
              {data.seenCount > 0 ? (
                <View
                  style={{
                    marginTop: 5,
                    backgroundColor: scheme === "dark" ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.75)",
                    borderRadius: radius.pill,
                    paddingHorizontal: 7,
                    paddingVertical: 1,
                  }}
                >
                  <Ui size={fs.xs - 2} weight="700" color={pal.muted}>
                    ↓ {t("nav.behindN", { n: data.seenCount })}
                  </Ui>
                </View>
              ) : null}
            </View>
          </>
        ) : null}
      </View>

      {/* ═══════════ BOTTOM SHEET — trip meter + pref switch ═══════════ */}
      <View
        style={{
          backgroundColor: pal.card,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          paddingTop: sp.s3,
          paddingHorizontal: sp.s4,
          paddingBottom: insets.bottom + sp.s4,
          marginTop: -14,
          ...shadow.float,
        }}
      >
        <View style={{ width: 38, height: 5, borderRadius: 99, backgroundColor: pal.hairline2, alignSelf: "center", marginBottom: sp.s3 }} />

        {/* headline: 남은 소요시간 + N편 + pace */}
        <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: sp.s2 }}>
          <Ui size={fs.x2} weight="700">
            {arrived ? "0:00" : fmtDur(data.runtimeRemaining)}
          </Ui>
          <Ui size={fs.md} weight="700" color={brand.accent}>
            {t("nav.filmsN", { n: data.remaining })}
          </Ui>
          <Ui size={fs.xs} weight="600" color={pal.muted} style={{ marginLeft: "auto" }}>
            {t("nav.remainingTime")}
            {data.etaWeeks ? ` · ${t("nav.pace", { n: data.etaWeeks })}` : ""}
          </Ui>
        </View>

        {/* traveled / remaining meter */}
        <View style={{ marginTop: sp.s3 }}>
          <View style={{ height: 9, borderRadius: 99, backgroundColor: pal.surface, overflow: "hidden", flexDirection: "row" }}>
            <View style={{ width: `${Math.round(doneFrac * 100)}%`, height: "100%", backgroundColor: GOLD }} />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: sp.s2 }}>
            <View>
              <Ui size={fs.xs - 2} weight="700" color={pal.subtle}>
                {t("nav.traveled").toUpperCase()}
              </Ui>
              <Ui size={fs.xs} weight="700" color={GOLD}>
                {t("nav.filmsN", { n: data.seenCount })} · {fmtHM(data.runtimeTraveled)}
              </Ui>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Ui size={fs.xs - 2} weight="700" color={pal.subtle}>
                {t("nav.remainingLane").toUpperCase()}
              </Ui>
              <Ui size={fs.xs} weight="700" color={brand.accent}>
                {t("nav.filmsN", { n: data.remaining })} · {fmtHM(data.runtimeRemaining)}
              </Ui>
            </View>
          </View>
        </View>

        {/* route-pref switch (최단 / 최속 / 무료도로) */}
        <View style={{ flexDirection: "row", gap: sp.s2, marginTop: sp.s4 }}>
          {PREFS.map((p) => {
            const on = pref === p;
            const label = p === "fewest" ? t("nav.prefFewest") : p === "fastest" ? t("nav.prefFastest") : t("nav.prefNoTolls");
            const tolls = data.routes[p].tollCount;
            return (
              <Tactile key={p} onPress={() => setPref(p)} style={{ flex: 1 }}>
                <View
                  style={{
                    borderRadius: radius.sm,
                    paddingVertical: 9,
                    alignItems: "center",
                    backgroundColor: on ? pal.ink : pal.surface,
                    borderWidth: on ? 0 : 1,
                    borderColor: pal.hairline,
                  }}
                >
                  <Ui size={fs.sm} weight="700" color={on ? pal.bg : pal.ink}>
                    {label}
                  </Ui>
                  {p === "no_tolls" && tolls > 0 ? (
                    <Ui size={fs.xs - 2} weight="600" color={on ? "rgba(255,255,255,0.75)" : GOLD}>
                      {t("nav.tollN", { n: tolls })}
                    </Ui>
                  ) : null}
                </View>
              </Tactile>
            );
          })}
        </View>

        {/* actions: 본 걸로 (advance) · 이 턴 건너뛰기 */}
        {!arrived && head ? (
          <View style={{ flexDirection: "row", gap: sp.s2, marginTop: sp.s2 }}>
            <Tactile onPress={() => onMarkSeen(head.slug)} style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 6,
                  borderRadius: radius.sm,
                  paddingVertical: 11,
                  backgroundColor: pal.surface,
                  borderWidth: 1,
                  borderColor: pal.hairline,
                }}
              >
                <Ionicons name="checkmark" size={16} color={brand.teal} />
                <Ui size={fs.sm} weight="700">
                  {t("nav.markSeen")}
                </Ui>
              </View>
            </Tactile>
            <Tactile onPress={() => onSkip(head.slug)} style={{ flex: 1 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 6,
                  borderRadius: radius.sm,
                  paddingVertical: 11,
                  backgroundColor: pal.surface,
                  borderWidth: 1,
                  borderColor: pal.hairline,
                }}
              >
                <Ionicons name="play-skip-forward-outline" size={15} color={pal.ink} />
                <Ui size={fs.sm} weight="700">
                  {t("nav.skip")}
                </Ui>
              </View>
            </Tactile>
          </View>
        ) : null}
      </View>

      {/* floating chrome — back + share; destination title chip */}
      <View
        style={{
          position: "absolute",
          top: insets.top + sp.s2,
          left: sp.s4,
          right: sp.s4,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
        pointerEvents="box-none"
      >
        <Disc icon="chevron-back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))} />
        <View
          style={[
            { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: pal.chrome, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
            shadow.card,
          ]}
        >
          <Ionicons name="navigate" size={13} color={brand.accent} />
          <Ui size={fs.sm} weight="700" numberOfLines={1} style={{ maxWidth: winW * 0.42 }}>
            {data.label}
          </Ui>
        </View>
        <Disc icon="share-outline" onPress={() => Share.share({ message: webUrl })} />
      </View>

      {/* reroute toast */}
      {toast ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: insets.top + 96,
            alignItems: "center",
          }}
        >
          <View style={[{ backgroundColor: pal.ink, borderRadius: radius.pill, paddingHorizontal: sp.s4, paddingVertical: 9 }, shadow.float]}>
            <Ui size={fs.sm} weight="600" color={pal.bg}>
              {toast}
            </Ui>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
