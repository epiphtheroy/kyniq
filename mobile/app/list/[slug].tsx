// One curated list, in full (owner 08-03).
//
// The Navigator turns a list into a route you drive one film at a time. This is
// the other thing a list is: the whole thing at once — every film in it, what
// you have already seen, and the one button that takes the lot onto your
// watchlist. Saving the list (★) and adding its films are deliberately two
// different actions: tapping a list to look at it must never fill your
// watchlist behind your back.
//
// Data: lineage_list_films(p_slug) is the same anon RPC /lineage/[slug] uses on
// the web; lineage_add_watchlist(p_slug) is the same SECURITY DEFINER write its
// "Add all to watchlist" button calls, so a list added here and a list added
// there land identically in public.user_movies.
import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, View } from "react-native";
import { Appear, SkeletonRows } from "../../src/components/motion";
import SaveListBtn from "../../src/components/SaveListBtn";
import {
  Btn,
  GradientBtn,
  Hairline,
  PosterImg,
  Serif,
  TSBadge,
  Tactile,
  Ui,
} from "../../src/components/ui";
import { t } from "../../src/i18n";
import { api } from "../../src/lib/api";
import { supabase } from "../../src/lib/supabase";
import { trueSizeOf } from "../../src/lib/lineage";
import { useDbLabels } from "../../src/lib/dbLabels";
import { useLocalTitles } from "../../src/lib/titles";
import { useFilms } from "../../src/state/films";
import { brand, fs, radius, sp, usePalette } from "../../src/theme";

type ListFilm = {
  film_slug: string;
  film_title: string;
  film_year: number | null;
  poster_path: string | null;
  visible: boolean | null;
  rank: number | null;
};

/** TakeScores cost one bulk RPC per 400; long canons stop paying after this. */
const TS_CAP = 400;

export default function ListScreen() {
  const { slug, label } = useLocalSearchParams<{ slug: string; label?: string }>();
  const pal = usePalette();
  const router = useRouter();
  const { session, ledger, reload } = useFilms();

  const [rows, setRows] = useState<ListFilm[] | null>(null);
  // How long the published list is, before Metatake's own coverage of it — the
  // web says "40 of 159 on Metatake" and this screen must not claim more.
  const [allCount, setAllCount] = useState(0);
  const [err, setErr] = useState(false);
  const [tsMap, setTsMap] = useState<Map<string, number>>(new Map());
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<number | null>(null);
  // A failed add needs its own flag: `err` only drives the whole-screen fallback
  // below, which cannot render once rows exist — and the button is not even
  // tappable until they do. Without this the write fails in total silence and
  // the user reads it as a mis-tap.
  const [addErr, setAddErr] = useState(false);
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);

  const load = useCallback(async () => {
    setErr(false);
    const { data, error } = await supabase.rpc("lineage_list_films", { p_slug: slug });
    if (!alive.current) return;
    if (error) {
      setErr(true);
      return;
    }
    const all = (data ?? []) as ListFilm[];
    // Only films Metatake actually holds can be shown, opened or watchlisted —
    // and lineage_add_watchlist adds exactly these, so the count above the
    // button is the count the button acts on.
    const list = all.filter((r) => r.visible !== false && !!r.film_slug);
    setAllCount(all.length);
    setRows(list);
    const slugs = list.slice(0, TS_CAP).map((r) => r.film_slug);
    if (slugs.length) {
      const merged = new Map<string, number>();
      for (let i = 0; i < slugs.length; i += 400) {
        const part = await api.takescores(slugs.slice(i, i + 400)).catch(() => new Map());
        for (const [k, v] of part) merged.set(k, v);
      }
      if (alive.current) setTsMap(merged);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const seenCount = useMemo(
    () => (rows ?? []).reduce((n, r) => n + (ledger.get(r.film_slug)?.seen ? 1 : 0), 0),
    [rows, ledger],
  );

  const titleOf = useLocalTitles(useMemo(() => (rows ?? []).map((r) => r.film_slug), [rows]));

  const addAll = async () => {
    if (adding) return;
    if (!session) {
      router.push({ pathname: "/onboarding", params: { step: "account" } });
      return;
    }
    setAdding(true);
    setAddErr(false);
    // Bound the write, for the same reason getJSON bounds every read: a socket
    // that dies mid-request does not reject, it just stops. Verified on Android
    // 08-04 — drop the network while this is in flight and the button sits at
    // "Adding…" past 80 seconds, still spinning after the network is back. The
    // error copy below can only speak if something rejects, so without this the
    // failure the user actually hits is the one they are never told about.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    let data: unknown = null;
    let error: unknown = null;
    try {
      ({ data, error } = await supabase
        .rpc("lineage_add_watchlist", { p_slug: slug })
        .abortSignal(ctrl.signal));
    } catch (e) {
      error = e;
    } finally {
      clearTimeout(timer);
    }
    if (!alive.current) return;
    setAdding(false);
    if (error) {
      setAddErr(true);
      return;
    }
    setAdded(typeof data === "number" ? data : 0);
    // The ledger is what every screen reads; pull the new watchlist rows in so
    // the ticks below (and You) are right without a manual refresh.
    void reload();
  };

  // The list's own name lives in content_i18n (lineage_list/label) — the route
  // param carries whatever the previous screen had, which is English.
  const listLabel = useDbLabels("lineage_list", "label", useMemo(() => [String(slug)], [slug]));
  const shownLabel =
    listLabel(String(slug), (typeof label === "string" && label.length ? label : slug) ?? "") ?? "";
  const trueSize = trueSizeOf(slug);

  const header = (
    <View style={{ paddingHorizontal: sp.s4, paddingTop: sp.s3, paddingBottom: sp.s4, gap: sp.s3 }}>
      <Serif size={fs.x2} bold style={{ lineHeight: fs.x2 * 1.2 }}>
        {shownLabel}
      </Serif>
      <Ui size={fs.sm} color={pal.muted}>
        {rows
          ? [
              allCount > rows.length
                ? t("list.onMetatake", { shown: rows.length, all: allCount })
                : t("nav.filmsN", { n: rows.length }),
              seenCount > 0 ? t("list.seenN", { n: seenCount }) : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : ""}
      </Ui>
      {/* Where the published list is longer than what we hold, say so — the same
          disclosure /lineage/[slug] publishes. A canon named for its length must
          never look broken because our ingest is behind (owner 08-03). */}
      {rows && trueSize && allCount < trueSize ? (
        <Ui size={fs.xs} color={pal.subtle} style={{ lineHeight: fs.xs * 1.5 }}>
          {t("list.matchedOf", { matched: allCount, all: trueSize.toLocaleString() })}
        </Ui>
      ) : null}
      <View style={{ gap: sp.s2 }}>
        <GradientBtn
          icon={addErr && !adding ? "refresh" : "add"}
          label={
            adding
              ? t("list.addingAll")
              : addErr
                ? t("action.retry")
                : added != null
                  ? t("list.addedN", { n: added })
                  : t("list.addAll")
          }
          onPress={() => void addAll()}
          disabled={adding || !rows?.length}
        />
        {/* Say it where it happened. The button reverting to its old label is
            indistinguishable from a mis-tap, and the next tap is another silent
            no-op — so the failure is stated here and the button asks to be
            pressed again on purpose. */}
        {addErr ? (
          <Ui size={fs.xs + 1} color={brand.tsRisk} style={{ lineHeight: fs.xs * 1.6 }}>
            {t("list.addFailed")}
          </Ui>
        ) : null}
        <View style={{ flexDirection: "row", gap: sp.s2 }}>
          <View style={{ flex: 1 }}>
            <SaveListBtn slug={slug} variant="label" />
          </View>
          <View style={{ flex: 1 }}>
            <Btn
              kind="ghost"
              label={t("list.drive")}
              onPress={() =>
                router.push({
                  pathname: "/navigator/drive",
                  params: { lineage: slug, label: shownLabel },
                })
              }
            />
          </View>
        </View>
      </View>
      <Hairline style={{ marginTop: sp.s2 }} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: pal.bg }}>
      <Stack.Screen options={{ title: "" }} />
      {rows === null && !err ? (
        <View style={{ paddingTop: sp.s4 }}>
          <SkeletonRows count={6} />
        </View>
      ) : err && !rows ? (
        <View style={{ paddingHorizontal: sp.s4, paddingTop: sp.s6, gap: sp.s3 }}>
          <Ui size={fs.base} color={pal.muted}>
            {t("error.network")}
          </Ui>
          <Btn kind="ghost" label={t("action.retry")} onPress={() => void load()} />
        </View>
      ) : (
        <FlatList
          data={rows ?? []}
          keyExtractor={(r) => r.film_slug}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 120 }}
          initialNumToRender={12}
          windowSize={9}
          renderItem={({ item, index }) => (
            <Appear index={index}>
              <ListRow
                slug={item.film_slug}
                title={titleOf(item.film_slug, item.film_title)}
                year={item.film_year}
                poster={item.poster_path}
                ts={tsMap.get(item.film_slug) ?? null}
                seen={!!ledger.get(item.film_slug)?.seen}
                queued={!!ledger.get(item.film_slug)?.watchlist}
                onPress={() =>
                  router.push({ pathname: "/film/[slug]", params: { slug: item.film_slug } })
                }
              />
            </Appear>
          )}
        />
      )}
    </View>
  );
}

/** One film in the list — the standard row plus where it stands with you. */
function ListRow({
  title,
  year,
  poster,
  ts,
  seen,
  queued,
  onPress,
}: {
  slug: string;
  title: string;
  year: number | null;
  poster: string | null;
  ts: number | null;
  seen: boolean;
  queued: boolean;
  onPress: () => void;
}) {
  const pal = usePalette();
  return (
    <Tactile
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: sp.s3,
        paddingHorizontal: sp.s4,
        paddingVertical: sp.s2 + 2,
      }}
    >
      <PosterImg path={poster} width={48} height={72} size="w92" rounded={radius.sm} />
      <View style={{ flex: 1 }}>
        <Ui size={fs.md} weight="500" numberOfLines={1}>
          {title}
        </Ui>
        <Ui size={fs.sm} color={pal.muted} numberOfLines={1}>
          {year ?? ""}
        </Ui>
      </View>
      {seen ? (
        <Ionicons name="checkmark-circle" size={17} color={brand.success} />
      ) : queued ? (
        <Ionicons name="bookmark" size={15} color={brand.accent} />
      ) : null}
      <TSBadge ts={ts} />
    </Tactile>
  );
}
