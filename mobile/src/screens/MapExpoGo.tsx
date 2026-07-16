// Locations tab — Expo Go implementation (react-native-maps / Apple Maps).
// react-native-maps' native side ships inside the Expo Go binary, so this is the
// map an iPhone reviewer sees before the first dev build exists. Same UX as
// MapNative (the canon): header block, "Near me" pill, bottom card on pin tap.
// No provider prop on purpose — the iOS default is Apple Maps (no key needed).
// react-native-maps has no clustering, so markers are capped at 500.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import MapView, { Marker, type MarkerPressEvent, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Btn, Loading, Screen, Serif, Ui } from "../components/ui";
import { t } from "../i18n";
import { boundsOf, loadFilmPins, loadGlobalPins, type Pin } from "../lib/pins";
import { brand, fs, sp, usePalette } from "../theme";

const WORLD_REGION: Region = { latitude: 22, longitude: 10, latitudeDelta: 120, longitudeDelta: 120 };
const MAX_MARKERS = 500; // no clustering in react-native-maps — cap for render perf

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
      {/* Compact editorial top bar — tabs render headerless (see (tabs)/_layout) */}
      <View
        style={{
          paddingTop: insets.top + sp.s2,
          paddingHorizontal: sp.s4,
          paddingBottom: sp.s3,
          backgroundColor: pal.bg,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: pal.hairline,
        }}
      >
        <View style={{ width: 28, height: 2, backgroundColor: brand.accent, marginBottom: sp.s2 }} />
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: sp.s3 }}>
          <Serif size={fs.x3} bold>
            {t("map.title")}
          </Serif>
          {!filmSlug && pins ? (
            <Ui size={fs.xs + 1} color={pal.muted}>
              {t("map.pins", { n: pins.length })}
            </Ui>
          ) : null}
        </View>
        {filmSlug ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: sp.s2, marginTop: sp.s1 }}>
            <Ui size={fs.sm} color={pal.muted} numberOfLines={1} style={{ flexShrink: 1 }}>
              {filmTitle}
            </Ui>
            <Pressable
              onPress={() => router.setParams({ film: "" })}
              hitSlop={8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: pal.hairline2,
                borderRadius: 999,
                paddingHorizontal: sp.s2,
                paddingVertical: 2,
              }}
            >
              <Ionicons name="close" size={12} color={pal.muted} />
              <Ui size={fs.xs} color={pal.muted}>
                {t("map.showAll")}
              </Ui>
            </Pressable>
          </View>
        ) : null}
      </View>

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
                pinColor={brand.accent}
                tracksViewChanges={false}
                onPress={(e: MarkerPressEvent) => {
                  e.stopPropagation();
                  setSelected(p);
                }}
              />
            ))}
          </MapView>

          {/* Near me — floating pill, disabled after a denial */}
          <Pressable
            onPress={nearMe}
            disabled={locDenied}
            style={({ pressed }) => ({
              position: "absolute",
              top: sp.s3,
              right: sp.s4,
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              backgroundColor: pal.bg,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: pal.hairline2,
              borderRadius: 999,
              paddingHorizontal: sp.s3,
              paddingVertical: 6,
              opacity: locDenied ? 0.4 : pressed ? 0.6 : 1,
            })}
          >
            <Ionicons name="locate-outline" size={14} color={locDenied ? pal.subtle : brand.accent} />
            <Ui size={fs.xs + 1} weight="600" color={locDenied ? pal.subtle : pal.ink}>
              {t("map.nearMe")}
            </Ui>
          </Pressable>

          {/* Film focus with zero mapped pins */}
          {filmSlug && !pins.length ? (
            <View
              style={{
                position: "absolute",
                top: sp.s3,
                left: sp.s4,
                backgroundColor: pal.bg,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: pal.hairline,
                paddingHorizontal: sp.s3,
                paddingVertical: 6,
              }}
            >
              <Ui size={fs.xs + 1} color={pal.muted}>
                {t("map.noFilmPins")}
              </Ui>
            </View>
          ) : null}

          {/* Pin card — bottom sheet-lite */}
          {selected ? (
            <View
              style={{
                position: "absolute",
                left: sp.s4,
                right: sp.s4,
                bottom: sp.s4,
                backgroundColor: pal.bg,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: pal.hairline2,
                padding: sp.s4,
                gap: sp.s2,
              }}
            >
              <Pressable
                onPress={() => setSelected(null)}
                hitSlop={10}
                style={{ position: "absolute", top: sp.s2, right: sp.s2, zIndex: 1 }}
              >
                <Ionicons name="close" size={18} color={pal.muted} />
              </Pressable>
              <Serif size={fs.lg} bold numberOfLines={2} style={{ paddingRight: sp.s5 }}>
                {selected.name}
              </Serif>
              <Ui size={fs.sm} color={pal.muted} numberOfLines={1}>
                {[selected.country, selected.filmTitle ?? filmTitle].filter(Boolean).join(" · ")}
              </Ui>
              {openSlug ? (
                <Btn
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
    </Screen>
  );
}
