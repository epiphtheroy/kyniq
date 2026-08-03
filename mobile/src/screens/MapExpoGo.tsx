// Locations tab — Expo Go implementation (react-native-maps / Apple Maps).
// react-native-maps' native side ships inside the Expo Go binary, so this is the
// map an iPhone reviewer sees before the first dev build exists. Same UX as
// MapNative (the canon): floating title pill chrome, "Near me" chip, bottom
// card on pin tap.
// No provider prop on purpose — the iOS default is Apple Maps (no key needed).
//
// Owner 08-03 ("the map is still slow to load"): this is now the iOS renderer in
// STORE builds too, not just Expo Go. The WebView path had to boot WKWebView,
// pull ~250 KB of maplibre off a CDN, parse it, then index 17,337 points before
// anything appeared. Apple Maps is in the binary and draws in a blink, so the
// map is on screen first and the pins land on top of it — nothing here waits for
// the artifact. react-native-maps has no clustering, so markers are filtered to
// the visible region and capped.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Image, Linking, View } from "react-native";
import MapView, { Marker, type MarkerPressEvent, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Btn, Chip, GradientBtn, Screen, Tactile, Ui } from "../components/ui";
import { t } from "../i18n";
import { boundsOf, loadFilmPins, loadGlobalPins, type Pin } from "../lib/pins";
import { brand, fs, radius, shadow, sp, usePalette } from "../theme";

const WORLD_REGION: Region = { latitude: 22, longitude: 10, latitudeDelta: 120, longitudeDelta: 120 };
const MAX_MARKERS = 300; // no clustering in react-native-maps — cap per viewport

// Content floated over the map must clear the absolute blurred tab bar.
const TAB_CLEARANCE = 104;

// Session cache — the world set doesn't change under the user's feet.
let globalPinCache: Pin[] | null = null;

export default function MapExpoGoScreen() {
  const { film } = useLocalSearchParams<{ film?: string }>();
  const filmSlug = typeof film === "string" && film.length ? film : null;
  const router = useRouter();
  const pal = usePalette();
  const insets = useSafeAreaInsets();

  const mapRef = useRef<MapView>(null);

  const [pins, setPins] = useState<Pin[] | null>(null);
  const [err, setErr] = useState(false);
  const [tries, setTries] = useState(0);
  const [selected, setSelected] = useState<Pin | null>(null);
  const [locDenied, setLocDenied] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [region, setRegion] = useState<Region>(WORLD_REGION);

  useEffect(() => {
    let alive = true;
    setErr(false);
    setSelected(null);
    if (filmSlug) {
      setPins(null);
      loadFilmPins(filmSlug)
        .then((p) => alive && setPins(p))
        .catch(() => alive && setErr(true));
    } else if (globalPinCache) {
      setPins(globalPinCache);
    } else {
      setPins(null);
      loadGlobalPins()
        .then((p) => {
          globalPinCache = p;
          if (alive) setPins(p);
        })
        .catch(() => alive && setErr(true));
    }
    return () => {
      alive = false;
    };
  }, [filmSlug, tries]);

  // Film focus cleared while the map is mounted (cached global pins skip the
  // remount) — animate back out to the world view.
  const prevFilm = useRef<string | null>(filmSlug);
  useEffect(() => {
    if (prevFilm.current && !filmSlug) {
      mapRef.current?.animateToRegion(WORLD_REGION, 900);
    }
    prevFilm.current = filmSlug;
  }, [filmSlug]);

  // Film focus: fit the camera to the pin set once the map is ready. Both
  // orderings are covered — pins resolving first, or onMapReady firing first.
  useEffect(() => {
    if (!mapReady || !filmSlug || !pins || !pins.length) return;
    const b = boundsOf(pins);
    if (!b) return;
    if (b.minLat === b.maxLat && b.minLng === b.maxLng) {
      // Degenerate bounds (single pin) — fitToCoordinates would zoom to max.
      mapRef.current?.animateToRegion(
        { latitude: b.minLat, longitude: b.minLng, latitudeDelta: 1.5, longitudeDelta: 1.5 },
        0,
      );
      return;
    }
    mapRef.current?.fitToCoordinates(
      pins.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 80, right: 60, bottom: 160, left: 60 }, animated: false },
    );
  }, [mapReady, filmSlug, pins]);

  // react-native-maps has no clustering, and the world artifact holds 17,337
  // pins, so the markers that exist are the ones you can actually see: filter to
  // the visible region first, and only then let the cap fall on the best-scored
  // films. Scanning 17k coordinates is ~1 ms and happens on region change, not
  // per frame.
  const shown = useMemo(() => {
    const all = pins ?? [];
    if (!all.length) return all;
    const latPad = region.latitudeDelta / 2;
    const lngPad = region.longitudeDelta / 2;
    const wholeWorld = region.longitudeDelta >= 180;
    const visible = all.filter((p) => {
      if (Math.abs(p.lat - region.latitude) > latPad) return false;
      if (wholeWorld) return true;
      return Math.abs(p.lng - region.longitude) <= lngPad;
    });
    const pool = visible.length ? visible : all;
    if (pool.length <= MAX_MARKERS) return pool;
    return [...pool].sort((a, b) => (b.ts ?? -1) - (a.ts ?? -1)).slice(0, MAX_MARKERS);
  }, [pins, region]);

  // Walking the map (owner 08-03): every film on screen, best-scored first.
  // Derived from `shown`, so it is already region-filtered — one pin per film.
  const inView = useMemo(() => {
    const seen = new Set<string>();
    const out: Pin[] = [];
    for (const p of shown) {
      if (!p.filmSlug || seen.has(p.filmSlug)) continue;
      seen.add(p.filmSlug);
      out.push(p);
    }
    out.sort((a, b) => (b.ts ?? -1) - (a.ts ?? -1));
    return out.slice(0, 40);
  }, [shown]);

  const filmTitle = filmSlug ? (pins?.find((p) => p.filmTitle)?.filmTitle ?? filmSlug) : null;

  const nearMe = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocDenied(true); // silent — just disable the pill
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      mapRef.current?.animateToRegion(
        { latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 2, longitudeDelta: 2 },
        600,
      );
    } catch {
      // location unavailable — stay put
    }
  };

  const openSlug = selected ? (selected.filmSlug ?? filmSlug) : null;

  return (
    <Screen>
      {err ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: sp.s4 }}>
          <Ui color={pal.muted}>{t("error.network")}</Ui>
          <Btn label={t("action.retry")} onPress={() => setTries((n) => n + 1)} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={WORLD_REGION}
            pitchEnabled={false}
            onMapReady={() => setMapReady(true)}
            onRegionChangeComplete={setRegion}
            onPress={() => setSelected(null)}
          >
            {shown.map((p) => (
              <Marker
                key={p.id}
                coordinate={{ latitude: p.lat, longitude: p.lng }}
                pinColor={brand.gradB}
                tracksViewChanges={false}
                onPress={(e: MarkerPressEvent) => {
                  e.stopPropagation();
                  setSelected(p);
                }}
              />
            ))}
          </MapView>

          {/* Walk the map: tap a card and the camera flies to that film's pin
              and selects it. Selecting swaps this strip for the detail card, so
              the two never fight for the same corner. */}
          {!selected && !filmSlug && inView.length ? (
            <View style={{ position: "absolute", left: 0, right: 0, bottom: TAB_CLEARANCE }}>
              <FlatList
                horizontal
                data={inView}
                keyExtractor={(p) => p.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: sp.s4, gap: sp.s2 }}
                renderItem={({ item }) => (
                  <Tactile
                    feedback="tap"
                    onPress={() => {
                      mapRef.current?.animateToRegion(
                        {
                          latitude: item.lat,
                          longitude: item.lng,
                          latitudeDelta: 0.4,
                          longitudeDelta: 0.4,
                        },
                        600,
                      );
                      setSelected(item);
                    }}
                  >
                    <View
                      style={[
                        {
                          width: 132,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: sp.s2,
                          backgroundColor: pal.card,
                          borderRadius: radius.md,
                          padding: 6,
                        },
                        shadow.card,
                      ]}
                    >
                      {item.posterPath ? (
                        <Image
                          source={{ uri: `https://image.tmdb.org/t/p/w154${item.posterPath}` }}
                          style={{ width: 30, height: 45, borderRadius: 5, backgroundColor: pal.surface }}
                        />
                      ) : null}
                      <View style={{ flex: 1 }}>
                        <Ui size={fs.xs} weight="600" numberOfLines={2}>
                          {item.filmTitle ?? item.name}
                        </Ui>
                        {item.ts != null ? (
                          <Ui size={fs.xs - 1} weight="700" color={brand.accent} style={{ marginTop: 2 }}>
                            {t("nav.ts", { n: Math.round(item.ts) })}
                          </Ui>
                        ) : null}
                      </View>
                    </View>
                  </Tactile>
                )}
              />
            </View>
          ) : null}

          {/* Film focus with zero mapped pins */}
          {filmSlug && pins && !pins.length ? (
            <View
              style={[
                {
                  position: "absolute",
                  top: insets.top + 64,
                  alignSelf: "center",
                  backgroundColor: pal.card,
                  borderRadius: radius.pill,
                  paddingHorizontal: sp.s4,
                  paddingVertical: 8,
                },
                shadow.card,
              ]}
            >
              <Ui size={fs.xs + 1} color={pal.muted}>
                {t("map.noFilmPins")}
              </Ui>
            </View>
          ) : null}

          {/* Pin card — bottom sheet-lite, floats above the blurred tab bar */}
          {selected ? (
            <View
              style={[
                {
                  position: "absolute",
                  left: sp.s4,
                  right: sp.s4,
                  bottom: TAB_CLEARANCE,
                  backgroundColor: pal.card,
                  borderRadius: radius.lg,
                  paddingHorizontal: sp.s5,
                  paddingBottom: sp.s5,
                  paddingTop: sp.s3,
                  gap: sp.s2,
                },
                shadow.float,
              ]}
            >
              <View
                style={{
                  alignSelf: "center",
                  width: 36,
                  height: 4,
                  borderRadius: radius.pill,
                  backgroundColor: pal.hairline2,
                  marginBottom: sp.s1,
                }}
              />
              <Tactile
                onPress={() => setSelected(null)}
                hitSlop={10}
                style={{ position: "absolute", top: sp.s3, right: sp.s3, zIndex: 1 }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: radius.pill,
                    backgroundColor: pal.surface,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="close" size={16} color={pal.inkSoft} />
                </View>
              </Tactile>
              {/* Owner 08-03: the poster comes with the pin — a place means more
                  next to the film that was shot there — and the address stops
                  shouting: the film leads, the location is the caption. */}
              <View style={{ flexDirection: "row", gap: sp.s3, paddingRight: sp.s6 }}>
                {selected.posterPath ? (
                  <Image
                    source={{ uri: `https://image.tmdb.org/t/p/w154${selected.posterPath}` }}
                    style={{ width: 50, height: 75, borderRadius: 6, backgroundColor: pal.surface }}
                  />
                ) : null}
                <View style={{ flex: 1, gap: 3 }}>
                  {selected.filmTitle ?? filmTitle ? (
                    <Ui size={fs.md} weight="600" numberOfLines={2}>
                      {selected.filmTitle ?? filmTitle}
                    </Ui>
                  ) : null}
                  <Ui size={fs.xs} color={pal.inkSoft} numberOfLines={2} style={{ lineHeight: fs.xs * 1.4 }}>
                    {selected.name}
                  </Ui>
                  {selected.country ? (
                    <Ui size={fs.xs} color={pal.subtle} numberOfLines={1}>
                      {selected.country}
                    </Ui>
                  ) : null}
                  {selected.ts != null ? (
                    <Ui size={fs.xs} weight="700" color={brand.accent}>
                      {t("nav.ts", { n: Math.round(selected.ts) })}
                    </Ui>
                  ) : null}
                </View>
              </View>
              {openSlug ? (
                <GradientBtn
                  label={t("map.openFilm")}
                  onPress={() =>
                    router.push({ pathname: "/film/[slug]", params: { slug: openSlug } })
                  }
                  style={{ marginTop: sp.s2 }}
                />
              ) : null}
              {/* ── 4. the two directions, said plainly (owner 08-03) ── */}
              {!filmSlug && selected.filmSlug ? (
                <Btn
                  kind="ghost"
                  label={t("map.onlyThisFilm")}
                  onPress={() => {
                    const slug = selected.filmSlug as string;
                    setSelected(null);
                    router.setParams({ film: slug });
                  }}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      )}

      {/* Floating title pill row — the map owns the whole viewport */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: insets.top + sp.s2,
          left: sp.s4,
          right: sp.s4,
          zIndex: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: sp.s2,
        }}
      >
        {/* Owner 08-03: the "Locations" pill said nothing the screen didn't
            already say, and wrapped to two lines doing it. The world view now
            carries no title at all; film focus keeps a slim pill because WHICH
            film you are looking at is the one thing the map cannot show. */}
        {filmSlug ? (
          <View
            style={[
              {
                flexShrink: 1,
                backgroundColor: pal.chrome,
                borderRadius: radius.pill,
                paddingVertical: 8,
                paddingHorizontal: 14,
              },
              shadow.card,
            ]}
          >
            <Ui size={fs.sm} weight="600" numberOfLines={1}>
              {filmTitle}
            </Ui>
          </View>
        ) : null}
        {filmSlug ? (
          <Chip label={t("map.showAll")} icon="close" onPress={() => router.setParams({ film: "" })} />
        ) : router.canGoBack() ? (
          /* The map is a pushed screen with no header and no tab of its own —
             without this there is no way out of the world view. */
          <Chip label={t("action.back")} icon="arrow-back" onPress={() => router.back()} />
        ) : null}
        <View pointerEvents="none" style={{ flex: 1 }} />
        <View
          style={[
            { borderRadius: radius.pill, backgroundColor: pal.card, opacity: locDenied ? 0.4 : 1 },
            shadow.card,
          ]}
        >
          <Chip label={t("map.nearMe")} icon="locate" onPress={locDenied ? () => void Linking.openSettings() : nearMe} />
        </View>
      </View>
    </Screen>
  );
}
