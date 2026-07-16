// In-app reader — the webview reading layer (HANDOFF §2). Native chrome header,
// metatake.net prose below. Hub pages (film/director) bounce back to native
// cards (§2-③); reading surfaces (/film/meaning/*, /film/lineage/*, /reception,
// …) stay inside the reader. Session is carried via SSO handoff (§13-12).
import Ionicons from "@expo/vector-icons/Ionicons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Share, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Btn, Hairline, Screen, Ui } from "../src/components/ui";
import { METATAKE_BASE } from "../src/config";
import { t } from "../src/i18n";
import { api } from "../src/lib/api";
import { brand, fs, sp, usePalette } from "../src/theme";

/** Exact hub patterns that must open natively (webview contract §2-③). */
const FILM_HUB_RE = /^\/film\/([^/?#]+)\/?$/;
const DIRECTOR_HUB_RE = /^\/director\/([^/?#]+)\/?$/;

const stripTrailingSlash = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

export default function ReadScreen() {
  const params = useLocalSearchParams<{ path?: string; title?: string }>();
  const router = useRouter();
  const pal = usePalette();

  const rawPath = typeof params.path === "string" && params.path ? params.path : "/";
  const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  // Brand name fallback, not a UI string — content titles come in via params.
  const title = typeof params.title === "string" && params.title ? params.title : "Metatake";
  const webUrl = `${METATAKE_BASE}${path}`;

  // The pathname this reader was opened for — never bounce it back to native,
  // even when it is a hub page (the film card deliberately opens "/film/x" as
  // "the full page" reading surface).
  const ownPathname = useMemo(() => stripTrailingSlash(path.split(/[?#]/)[0] || "/"), [path]);

  const [uri, setUri] = useState<string | null>(null);
  const [webLoading, setWebLoading] = useState(true);
  const [webKey, setWebKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setUri(null);
    setWebLoading(true);
    // SSO handoff (§13-12) — handoffUrl already falls back to the plain URL
    // when signed out or when the mint fails; the catch is pure defense.
    api
      .handoffUrl(path)
      .then((u) => alive && setUri(u))
      .catch(() => alive && setUri(webUrl));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const onShouldStartLoadWithRequest = useCallback(
    (req: { url: string; isTopFrame?: boolean }): boolean => {
      // Never hijack sub-frames (embeds, players).
      if (req.isTopFrame === false) return true;
      const url = req.url;
      // about:blank, data:, mailto:, … — let the webview decide.
      if (!/^https?:\/\//i.test(url)) return true;

      const m = url.match(/^https?:\/\/([^/?#]+)([^?#]*)/i);
      const host = (m?.[1] ?? "").toLowerCase().replace(/:\d+$/, "");
      const isMetatake = host === "metatake.net" || host === "www.metatake.net";

      // External link → system browser sheet, stay put.
      if (!isMetatake) {
        WebBrowser.openBrowserAsync(url);
        return false;
      }

      const pathname = stripTrailingSlash(m?.[2] || "/");
      // The destination this reader exists to show (also the handoff redirect
      // target) always loads in place.
      if (pathname === ownPathname) return true;

      // Hub pages go native (§2-③). Reading surfaces (/film/meaning/*,
      // /film/lineage/*, /film/x/reception, …) intentionally do NOT match.
      const film = pathname.match(FILM_HUB_RE);
      if (film) {
        router.replace({ pathname: "/film/[slug]", params: { slug: decodeURIComponent(film[1]) } });
        return false;
      }
      const director = pathname.match(DIRECTOR_HUB_RE);
      if (director) {
        router.replace({
          pathname: "/director/[slug]",
          params: { slug: decodeURIComponent(director[1]) },
        });
        return false;
      }

      // Any other metatake.net page → keep reading in place.
      return true;
    },
    [router, ownPathname],
  );

  const retry = useCallback(() => {
    setWebLoading(true);
    setWebKey((k) => k + 1);
  }, []);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Native chrome header */}
      <SafeAreaView edges={["top"]} style={{ backgroundColor: pal.bg }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            height: 48,
            paddingHorizontal: sp.s3,
          }}
        >
          <View style={{ width: 84, alignItems: "flex-start" }}>
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Ionicons name="close" size={24} color={pal.ink} />
            </Pressable>
          </View>
          <Ui size={fs.base} weight="600" numberOfLines={1} style={{ flex: 1, textAlign: "center" }}>
            {title}
          </Ui>
          <View
            style={{
              width: 84,
              flexDirection: "row",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: sp.s4,
            }}
          >
            <Pressable onPress={() => Share.share({ message: webUrl })} hitSlop={10}>
              <Ionicons name="share-outline" size={22} color={pal.ink} />
            </Pressable>
            <Pressable onPress={() => WebBrowser.openBrowserAsync(webUrl)} hitSlop={10}>
              <Ionicons name="open-outline" size={22} color={pal.ink} />
            </Pressable>
          </View>
        </View>
        <Hairline />
      </SafeAreaView>

      {/* Body */}
      <View style={{ flex: 1, backgroundColor: pal.bg }}>
        {uri ? (
          <WebView
            key={webKey}
            source={{ uri }}
            style={{ flex: 1, backgroundColor: pal.bg }}
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            onLoadEnd={() => setWebLoading(false)}
            onError={() => setWebLoading(false)}
            renderError={() => (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: pal.bg,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: sp.s4,
                    paddingHorizontal: sp.s5,
                  },
                ]}
              >
                <Ui color={pal.muted}>{t("error.network")}</Ui>
                <Btn label={t("action.retry")} onPress={retry} />
              </View>
            )}
            allowsBackForwardNavigationGestures
            // target=_blank links navigate in place (Android) so §2-③ still sees them.
            setSupportMultipleWindows={false}
            decelerationRate="normal"
          />
        ) : null}
        {(!uri || webLoading) ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { alignItems: "center", justifyContent: "center" },
            ]}
          >
            <ActivityIndicator color={brand.accent} />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
