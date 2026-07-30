// The Navigator tab — "Where to?" (HANDOFF-내비게이터-시네필터바이턴.md §5.1), promoted
// from a card inside Tonight to a first-class bottom tab (owner 2026-07-29). Front door of
// the drive: lists the destinations the viewer is mid-journey on — director conquests +
// canon/list lineages, each with progress — and taps into the turn-by-turn drive. As a tab
// root it has no back affordance (unlike the old pushed picker). Parity with web
// /room/navigator's picker: same me_auteur_conquest + me_coverage rows, same gates.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Btn, Screen, Serif, Tactile, Ui } from "../../src/components/ui";
import { Appear, ProgressBar, Pulse, SkeletonRows, SkeletonScreen, useCountUp } from "../../src/components/motion";
import { t, type DictKey } from "../../src/i18n";
import { api, me } from "../../src/lib/api";
import type { NavActive, NavCatalog, NavDestinations, NavPickDest } from "../../src/types";
import { brand, font, fs, radius, shadow, sp, usePalette } from "../../src/theme";

const GOLD = "#8F6A1E";
const SAMPLER_DIR = "stanley-kubrick";

const FACET_KEY: Record<string, DictKey> = {
  canon: "nav.facetCanon",
  critics: "nav.facetCritics",
  festival: "nav.facetFestival",
  award: "nav.facetAward",
  national: "nav.facetNational",
};

/** Facet → tint (same palette as Explore's Collections rail — one visual language). */
const FACET_TINT: Record<string, string> = {
  canon: GOLD,
  critics: "#0d9488",
  festival: "#7c3aed",
  award: "#E3120B",
  national: "#2563eb",
};

/** One destination card — facet-tinted rail + kicker, serif label, tinted progress.
 * Redesigned 07-29 (owner: the lists must look inviting — "선택하고 싶게"). */
function DestCard({ d, onPress }: { d: NavPickDest; onPress: () => void }) {
  const pal = usePalette();
  const tint = d.kind === "dir" ? brand.accent : FACET_TINT[d.facet ?? ""] ?? GOLD;
  const kicker =
    d.kind === "dir" ? t("nav.familyConquest") : d.facet && FACET_KEY[d.facet] ? t(FACET_KEY[d.facet]) : t("nav.facetList");
  const pct = Math.max(0, Math.min(100, d.pct));
  const shownPct = useCountUp(pct, 800);
  return (
    <Tactile onPress={onPress} feedback="tap">
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
            paddingLeft: sp.s3 + 6,
            overflow: "hidden",
          },
          shadow.card,
        ]}
      >
        <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: tint }} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Ui size={fs.xs - 1} weight="700" color={tint} numberOfLines={1} style={{ letterSpacing: 0.6 }}>
            {kicker.toUpperCase()}
          </Ui>
          <Serif size={fs.md} bold numberOfLines={1} style={{ marginTop: 2 }}>
            {d.label}
          </Serif>
          <Ui size={fs.xs} color={pal.muted} numberOfLines={1} style={{ marginTop: 2 }}>
            {t("nav.filmsN", { n: d.total })} · {t("nav.leftN", { n: Math.max(0, d.total - d.seen) })}
          </Ui>
          <View style={{ marginTop: 8 }}>
            <ProgressBar value={pct / 100} tint={tint} height={5} track={pal.surface} />
          </View>
        </View>
        <View style={{ alignItems: "flex-end", gap: 2 }}>
          <Ui size={fs.lg} weight="700" color={tint}>
            {shownPct}%
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
    <Tactile onPress={onPress} feedback="press">
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
        <Pulse>
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
        </Pulse>
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

export default function NavigatorTab() {
  const router = useRouter();
  const pal = usePalette();
  const insets = useSafeAreaInsets();

  const [dests, setDests] = useState<NavDestinations | null>(null);
  const [resume, setResume] = useState<NavActive | null>(null);
  const [err, setErr] = useState(false);
  const [gen, setGen] = useState(0);
  // List search (owner 07-29) — the full catalog is lazy-loaded the first time the
  // user types, then filtered client-side by tokens (so "cannes" finds the Palme d'Or).
  const [q, setQ] = useState("");
  const [catalog, setCatalog] = useState<NavCatalog | null>(null);
  const [catBusy, setCatBusy] = useState(false);
  const [catErr, setCatErr] = useState(false);

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

  // Lazy-load the browse catalog the first time the user searches (never on tab open —
  // it's a large payload). Failure falls back to an empty catalog (search shows nothing).
  useEffect(() => {
    // catErr blocks auto-retry (no per-keystroke network spam on a persistent failure);
    // the inline Retry button clears it to re-attempt. Leaving `catalog` null on failure
    // (not a truthy empty object) is what makes retry possible at all.
    if (!q.trim() || catalog || catBusy || catErr) return;
    setCatBusy(true);
    api
      .navigatorCatalog()
      .then(setCatalog)
      .catch(() => setCatErr(true))
      .finally(() => setCatBusy(false));
  }, [q, catalog, catBusy, catErr]);

  const query = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (!query || !catalog) return null;
    const toks = query.split(/\s+/).filter(Boolean);
    const match = (e: { search: string }) => toks.every((tk) => e.search.includes(tk));
    return {
      directors: catalog.directors.filter(match).slice(0, 30),
      lineages: catalog.lineages.filter(match).slice(0, 40),
    };
  }, [query, catalog]);

  if (err)
    return (
      <Screen style={{ alignItems: "center", justifyContent: "center", gap: sp.s4, padding: sp.s5 }}>
        <Ui size={fs.md} color={pal.muted} style={{ textAlign: "center" }}>
          {t("error.network")}
        </Ui>
        <Btn label={t("action.retry")} onPress={() => setGen((g) => g + 1)} style={{ alignSelf: "stretch" }} />
      </Screen>
    );
  if (!dests)
    return (
      <Screen>
        <View style={{ paddingTop: insets.top + sp.s6 }}>
          <SkeletonScreen kind="rows" count={6} />
        </View>
      </Screen>
    );

  const empty = dests.directors.length === 0 && dests.canon.length === 0;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: sp.s4, paddingBottom: insets.bottom + sp.s6 }}
        showsVerticalScrollIndicator={false}
      >
        {/* header (tab root — no back affordance) */}
        <View style={{ paddingTop: insets.top + sp.s3, marginBottom: sp.s4 }}>
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

        {/* List search (owner 07-29) — directors & lists; token filter so "cannes"
            finds the Palme d'Or. Full catalog lazy-loads on first keystroke. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: sp.s3,
            borderRadius: radius.pill,
            backgroundColor: pal.card,
            paddingHorizontal: sp.s4,
            paddingVertical: 11,
            borderWidth: 1,
            borderColor: pal.hairline,
          }}
        >
          <Ionicons name="search" size={17} color={pal.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t("nav.searchLists")}
            placeholderTextColor={pal.muted}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={{ flex: 1, fontFamily: font.ui, fontSize: fs.sm, color: pal.ink, padding: 0 }}
          />
          {q.length ? (
            <Tactile onPress={() => setQ("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={pal.subtle} />
            </Tactile>
          ) : null}
        </View>

        {query ? (
          /* ── search results ── */
          <View style={{ marginTop: sp.s4 }}>
            {!catalog ? (
              catErr ? (
                <View style={{ gap: sp.s3 }}>
                  <Ui size={fs.sm} color={pal.muted}>
                    {t("error.network")}
                  </Ui>
                  <Btn label={t("action.retry")} onPress={() => setCatErr(false)} kind="ghost" />
                </View>
              ) : (
                <SkeletonRows count={4} />
              )
            ) : results && (results.directors.length > 0 || results.lineages.length > 0) ? (
              <>
                {results.directors.length ? (
                  <>
                    <Ui size={fs.md} weight="700" style={{ marginBottom: sp.s3 }}>
                      {t("nav.sectDirectors")}
                    </Ui>
                    <View style={{ gap: sp.s2 }}>
                      {results.directors.map((d, i) => (
                        <Appear key={`dir:${d.key}`} index={i}>
                          <DestCard d={d} onPress={() => openDest(d)} />
                        </Appear>
                      ))}
                    </View>
                  </>
                ) : null}
                {results.lineages.length ? (
                  <>
                    <Ui size={fs.md} weight="700" style={{ marginTop: sp.s5, marginBottom: sp.s3 }}>
                      {t("nav.sectCanon")}
                    </Ui>
                    <View style={{ gap: sp.s2 }}>
                      {results.lineages.map((d, i) => (
                        <Appear key={`lin:${d.key}`} index={i}>
                          <DestCard d={d} onPress={() => openDest(d)} />
                        </Appear>
                      ))}
                    </View>
                  </>
                ) : null}
              </>
            ) : (
              <Ui size={fs.sm} color={pal.muted} style={{ marginTop: sp.s3 }}>
                {t("nav.searchEmpty")}
              </Ui>
            )}
          </View>
        ) : (
          /* ── personal picker ── */
          <>
            {resume ? (
              <View style={{ marginTop: sp.s4 }}>
                <ResumeCard r={resume} onPress={() => openResume(resume)} />
              </View>
            ) : null}

            {empty ? (
              <View
                style={{
                  marginTop: sp.s4,
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
                  {dests.directors.map((d, i) => (
                    <Appear key={`dir:${d.key}`} index={i}>
                      <DestCard d={d} onPress={() => openDest(d)} />
                    </Appear>
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
                  {dests.canon.map((d, i) => (
                    <Appear key={`lin:${d.key}`} index={i}>
                      <DestCard d={d} onPress={() => openDest(d)} />
                    </Appear>
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
