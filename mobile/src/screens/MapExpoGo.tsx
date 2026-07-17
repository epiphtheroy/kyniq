// Locations tab — Expo Go implementation (react-native-maps / Apple Maps).
// react-native-maps' native side ships inside the Expo Go binary, so this is the
// map an iPhone reviewer sees before the first dev build exists. Same UX as
// MapNative (the canon): floating title pill chrome, "Near me" chip, bottom
// card on pin tap.
// No provider prop on purpose — the iOS default is Apple Maps (no key needed).
// react-native-maps has no clustering, so markers are capped at 500.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import MapView, { Marker, type MarkerPressEvent, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Btn, Chip, GradientBtn, Loading, Screen, Tactile, Ui } from "../components/ui";
import { t } from "../i18n";
import { boundsOf, loadFilmPins, loadGlobalPins, type Pin } from "../lib/pins";
import { brand, fs, radius, shadow, sp, usePalette } from "../theme";

const WORLD_REGION: Region = { latitude: 22, longitude: 10, latitudeDelta: 120, longitudeDelta: 120 };
const MAX_MARKERS = 500; // no clustering in react-native-maps — cap for render perf

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

  useEffect(() => {
    let alive = true;
    setErr(false);
    setSelected(null);
    if (filmSlug) {
      setPins(null);
      setMapReady(false); // map unmounts under <Loading/> — a fresh one fires onMapReady again
      loadFilmPins(filmSlug)
        .then((p) => alive && setPins(p))
        .catch(() => alive && setErr(true));
    } else if (globalPinCache) {
      setPins(globalPinCache);
    } else {
      setPins(null);
      setMapReady(false);
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

  const shown = useMemo(() => (pins ?? []).slice(0, MAX_MARKERS), [pins]);

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
      ) : !pins ? (
        <Loading />
      ) : (
        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={WORLD_REGION}
            pitchEnabled={false}
            onMapReady={() => setMapReady(true)}
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

          {/* Film focus with zero mapped pins */}
          {filmSlug && !pins.length ? (
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
              <Ui size={fs.md} weight="600" numberOfLines={2} style={{ paddingRight: sp.s6 }}>
                {selected.name}
              </Ui>
              <Ui size={fs.sm} color={pal.muted} numberOfLines={1}>
                {[selected.country, selected.filmTitle ?? filmTitle].filter(Boolean).join(" · ")}
              </Ui>
              {openSlug ? (
                <GradientBtn
                  label={t("map.openFilm")}
                  onPress={() =>
                    router.push({ pathname: "/film/[slug]", params: { slug: openSlug } })
                  }
                  style={{ marginTop: sp.s2 }}
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
        <View
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              gap: sp.s2,
              flexShrink: 1,
              backgroundColor: pal.chrome,
              borderRadius: radius.pill,
              paddingVertical: 10,
              paddingHorizontal: 16,
            },
            shadow.card,
          ]}
        >
          <Ui size={fs.md} weight="600">
            {t("map.title")}
          </Ui>
          {filmSlug ? (
            <Ui size={fs.xs} color={pal.muted} numberOfLines={1} style={{ flexShrink: 1, maxWidth: 140 }}>
              {filmTitle}
            </Ui>
          ) : pins ? (
            <Ui size={fs.xs} color={pal.muted}>
              {t("map.pins", { n: pins.length })}
            </Ui>
          ) : null}
        </View>
        {filmSlug ? (
          <Chip label={t("map.showAll")} icon="close" onPress={() => router.setParams({ film: "" })} />
        ) : null}
        <View pointerEvents="none" style={{ flex: 1 }} />
        <View
          style={[
            { borderRadius: radius.pill, backgroundColor: pal.card, opacity: locDenied ? 0.4 : 1 },
            shadow.card,
          ]}
        >
          <Chip label={t("map.nearMe")} icon="locate" onPress={locDenied ? undefined : nearMe} />
        </View>
      </View>
    </Screen>
  );
}
