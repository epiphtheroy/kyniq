// The Navigator — "Where to?" picker (HANDOFF-내비게이터-시네필터바이턴.md §5.1).
// The front door of the drive: lists the destinations the viewer is mid-journey on
// — director conquests + canon/list lineages, each with progress — and taps into the
// turn-by-turn drive for that destination. Parity with web /room/navigator's picker:
// same me_auteur_conquest + me_coverage rows, same gates. Signed-out or empty → a
// Kubrick sampler so the drive is always reachable.
import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Btn, Loading, Screen, Serif, Tactile, Ui } from "../../src/components/ui";
import { t, type DictKey } from "../../src/i18n";
import { api, me } from "../../src/lib/api";
import type { NavActive, NavDestinations, NavPickDest } from "../../src/types";
import { brand, fs, radius, shadow, sp, usePalette } from "../../src/theme";

const GOLD = "#8F6A1E";
const SAMPLER_DIR = "stanley-kubrick";

const FACET_KEY: Record<string, DictKey> = {
  canon: "nav.facetCanon",
  critics: "nav.facetCritics",
  festival: "nav.facetFestival",
  award: "nav.facetAward",
  national: "nav.facetNational",
};

/** Floating chrome disc — matches the drive/director back affordance. */
function Disc({ icon, onPress }: { icon: React.ComponentProps<typeof Ionicons>["name"]; onPress: () => void }) {
  const pal = usePalette();
  return (
    <Tactile onPress={onPress} hitSlop={8}>
      <View
        style={[
          { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: pal.chrome, alignItems: "center", justifyContent: "center" },
          shadow.card,
        ]}
      >
        <Ionicons name={icon} size={20} color={pal.ink} />
      </View>
    </Tactile>
  );
}

/** One destination card — label, family/facet · progress, and a thin progress bar. */
function DestCard({ d, onPress }: { d: NavPickDest; onPress: () => void }) {
  const pal = usePalette();
  const sub =
    d.kind === "dir" ? t("nav.familyConquest") : d.facet && FACET_KEY[d.facet] ? t(FACET_KEY[d.facet]) : t("nav.facetList");
  const pct = Math.max(0, Math.min(100, d.pct));
  return (
    <Tactile onPress={onPress}>
      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            gap: sp.s3,
            backgroundColor: pal.card,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: pal.hairline,
            paddingVertical: sp.s3,
            paddingHorizontal: sp.s3,
          },
          shadow.card,
        ]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Serif size={fs.md} bold numberOfLines={1}>
            {d.label}
          </Serif>
          <Ui size={fs.xs} color={pal.muted} numberOfLines={1} style={{ marginTop: 1 }}>
            {sub} · {t("nav.filmsN", { n: d.total })} · {t("nav.leftN", { n: Math.max(0, d.total - d.seen) })}
          </Ui>
          <View style={{ height: 6, borderRadius: 99, backgroundColor: pal.surface, overflow: "hidden", marginTop: 8 }}>
            <View style={{ width: `${pct}%`, height: "100%", backgroundColor: GOLD }} />
          </View>
        </View>
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          <Ui size={fs.lg} weight="700" color={brand.accent}>
            {pct}%
          </Ui>
          <Ui size={fs.xs - 1} weight="700" color={pal.subtle}>
            {t("nav.drive")}
          </Ui>
        </View>
      </View>
    </Tactile>
  );
}

/** Resume (이어가기) — the member's active drive, deep-linking back into it. Prominent
    accent card at the very top of the list. Mirror of /room/navigator's np-resume. */
function ResumeCard({ r, onPress }: { r: NavActive; onPress: () => void }) {
  const pal = usePalette();
  return (
    <Tactile onPress={onPress}>
      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "center",
            gap: sp.s3,
            backgroundColor: pal.card,
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderColor: brand.accent,
            paddingVertical: sp.s3,
            paddingHorizontal: sp.s3,
          },
          shadow.card,
        ]}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: radius.pill,
            backgroundColor: brand.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="play" size={17} color="#fff" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Ui size={fs.xs} weight="700" color={brand.accent} style={{ letterSpacing: 0.4 }}>
            {t("nav.resumeKicker").toUpperCase()}
          </Ui>
          <Serif size={fs.md} bold numberOfLines={1} style={{ marginTop: 1 }}>
            {r.dest_label ?? r.dest_key}
          </Serif>
        </View>
        <Ui size={fs.sm} weight="700" color={brand.accent} numberOfLines={1}>
          {t("nav.resume")}
        </Ui>
      </View>
    </Tactile>
  );
}

export default function NavigatorPicker() {
  const router = useRouter();
  const pal = usePalette();
  const insets = useSafeAreaInsets();

  const [dests, setDests] = useState<NavDestinations | null>(null);
  const [resume, setResume] = useState<NavActive | null>(null);
  const [err, setErr] = useState(false);
  const [gen, setGen] = useState(0);

  useEffect(() => {
    let alive = true;
    setDests(null);
    setErr(false);
    api
      .navigatorDestinations()
      .then((d) => alive && setDests(d))
      .catch(() => alive && setErr(true));
    // The member's active drive → a Resume card at the top (only dir/lineage are
    // drivable on mobile). Best-effort: signed-out or no drive simply shows nothing.
    me.navActive()
      .then((rr) => {
        if (alive) setResume(rr && (rr.dest_kind === "dir" || rr.dest_kind === "lineage") ? rr : null);
      })
      .catch(() => alive && setResume(null));
    return () => {
      alive = false;
    };
  }, [gen]);

  const openDir = (slug: string) => router.push({ pathname: "/navigator/drive", params: { dir: slug } });
  const openDest = (d: NavPickDest) =>
    d.kind === "dir"
      ? router.push({ pathname: "/navigator/drive", params: { dir: d.key } })
      : router.push({ pathname: "/navigator/drive", params: { lineage: d.key, label: d.label } });
  const openResume = (r: NavActive) =>
    r.dest_kind === "dir"
      ? router.push({ pathname: "/navigator/drive", params: { dir: r.dest_key } })
      : router.push({ pathname: "/navigator/drive", params: { lineage: r.dest_key, label: r.dest_label ?? r.dest_key } });

  const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));

  if (err)
    return (
      <Screen style={{ alignItems: "center", justifyContent: "center", gap: sp.s4, padding: sp.s5 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ui size={fs.md} color={pal.muted} style={{ textAlign: "center" }}>
          {t("error.network")}
        </Ui>
        <Btn label={t("action.retry")} onPress={() => setGen((g) => g + 1)} style={{ alignSelf: "stretch" }} />
        <View style={{ position: "absolute", top: insets.top + sp.s2, left: sp.s4 }}>
          <Disc icon="chevron-back" onPress={back} />
        </View>
      </Screen>
    );
  if (!dests)
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <Loading />
        <View style={{ position: "absolute", top: insets.top + sp.s2, left: sp.s4 }}>
          <Disc icon="chevron-back" onPress={back} />
        </View>
      </Screen>
    );

  const empty = dests.directors.length === 0 && dests.canon.length === 0;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: sp.s4, paddingBottom: insets.bottom + sp.s6 }}
        showsVerticalScrollIndicator={false}
      >
        {/* header */}
        <View style={{ paddingTop: insets.top + 52, marginBottom: sp.s4 }}>
          <Ui size={fs.xs} weight="700" color={brand.accent} style={{ letterSpacing: 0.6, marginBottom: 4 }}>
            {t("nav.title").toUpperCase()}
          </Ui>
          <Serif size={fs.x2} bold>
            {t("nav.whereTo")}
          </Serif>
          <Ui size={fs.sm} color={pal.muted} style={{ marginTop: sp.s2 }}>
            {t("nav.whereToSub")}
          </Ui>
        </View>

        {resume ? (
          <View style={{ marginBottom: sp.s4 }}>
            <ResumeCard r={resume} onPress={() => openResume(resume)} />
          </View>
        ) : null}

        {empty ? (
          <View
            style={{
              backgroundColor: pal.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: pal.hairline,
              padding: sp.s4,
              gap: sp.s4,
            }}
          >
            <Ui size={fs.sm} color={pal.inkSoft}>
              {t("nav.pickEmpty")}
            </Ui>
            <Btn label={t("nav.tryKubrick")} onPress={() => openDir(SAMPLER_DIR)} kind="ghost" />
          </View>
        ) : null}

        {dests.directors.length ? (
          <>
            <Ui size={fs.md} weight="700" style={{ marginTop: sp.s5, marginBottom: sp.s3 }}>
              {t("nav.sectDirectors")}
            </Ui>
            <View style={{ gap: sp.s2 }}>
              {dests.directors.map((d) => (
                <DestCard key={`dir:${d.key}`} d={d} onPress={() => openDest(d)} />
              ))}
            </View>
          </>
        ) : null}

        {dests.canon.length ? (
          <>
            <Ui size={fs.md} weight="700" style={{ marginTop: sp.s5, marginBottom: sp.s3 }}>
              {t("nav.sectCanon")}
            </Ui>
            <View style={{ gap: sp.s2 }}>
              {dests.canon.map((d) => (
                <DestCard key={`lin:${d.key}`} d={d} onPress={() => openDest(d)} />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* floating back */}
      <View style={{ position: "absolute", top: insets.top + sp.s2, left: sp.s4 }} pointerEvents="box-none">
        <Disc icon="chevron-back" onPress={back} />
      </View>
    </Screen>
  );
}
