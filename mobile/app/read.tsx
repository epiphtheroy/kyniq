// In-app reader — the webview reading layer (HANDOFF §2). Native sheet chrome
// (grab handle + circle-disc buttons), metatake.net prose below. Hub pages
// (film/director) bounce back to native cards (§2-③); reading surfaces
// (/film/meaning/*, /film/lineage/*, /reception, …) stay inside the reader.
// Session is carried via SSO handoff (§13-12).
import Ionicons from "@expo/vector-icons/Ionicons";
import { glyphs } from "../src/platform/tokens";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { useAndroidBack } from "../src/platform/back";
import { Btn, Hairline, Screen, Tactile, Ui } from "../src/components/ui";
import { usePrefs } from "../src/state/prefs";
import { readerUrl } from "../src/lib/webUrl";
import { SkeletonText } from "../src/components/motion";
import { t } from "../src/i18n";
import { api } from "../src/lib/api";
import { trackTap } from "../src/lib/beacon";
import { fs, radius, sp, usePalette } from "../src/theme";

/** Exact hub patterns that must open natively (webview contract §2-③). */
const FILM_HUB_RE = /^\/film\/([^/?#]+)\/?$/;
const DIRECTOR_HUB_RE = /^\/director\/([^/?#]+)\/?$/;

const stripTrailingSlash = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
// A malformed %-sequence in an intercepted URL must not throw inside the nav
// callback (URIError) and derail link handling — fall back to the raw slug.
const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** 32px circle-disc chrome button (sheet header grammar). */
function HeaderDisc({
  icon,
  onPress,
  iconSize = 17,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  iconSize?: number;
}) {
  const pal = usePalette();
  return (
    <Tactile onPress={onPress} hitSlop={8}>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: radius.pill,
          backgroundColor: pal.surface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={iconSize} color={pal.ink} />
      </View>
    </Tactile>
  );
}

export default function ReadScreen() {
  const params = useLocalSearchParams<{ path?: string; title?: string }>();
  const router = useRouter();
  const pal = usePalette();

  const rawPath = typeof params.path === "string" && params.path ? params.path : "/";
  const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  // Brand name fallback, not a UI string — content titles come in via params.
  const title = typeof params.title === "string" && params.title ? params.title : "Metatake";
  // A Korean app that opens an English web page has changed language halfway
  // through a tap. Only where the web actually has that language (see above).
  const { locale } = usePrefs();
  const webUrl = readerUrl(path, locale);

  // The pathname this reader was opened for — never bounce it back to native,
  // even when it is a hub page (the film card deliberately opens "/film/x" as
  // "the full page" reading surface).
  const ownPathname = useMemo(() => stripTrailingSlash(path.split(/[?#]/)[0] || "/"), [path]);

  const [uri, setUri] = useState<string | null>(null);
  const [webLoading, setWebLoading] = useState(true);
  const [webKey, setWebKey] = useState(0);

  // The reader is a browser, so Android's back must mean "back a page" before it
  // means "leave the reader" — otherwise following two links inside an essay and
  // pressing back throws the whole screen away. iOS gets the same behaviour from
  // allowsBackForwardNavigationGestures, which is an edge swipe and iOS-only.
  const webRef = useRef<WebView>(null);
  const canGoBackRef = useRef(false);
  useAndroidBack(() => {
    if (!canGoBackRef.current) return false; // no history left: let the screen close
    webRef.current?.goBack();
    return true;
  });

  useEffect(() => {
    let alive = true;
    setUri(null);
    setWebLoading(true);
    // The webview screens are web pages and land in the web numbers; this marks
    // where the app handed off, which the web side cannot tell apart.
    trackTap("reader:open", path);
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
        router.replace({ pathname: "/film/[slug]", params: { slug: safeDecode(film[1]) } });
        return false;
      }
      const director = pathname.match(DIRECTOR_HUB_RE);
      if (director) {
        router.replace({
          pathname: "/director/[slug]",
          params: { slug: safeDecode(director[1]) },
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

      {/* Sheet chrome — grab handle + circle-disc buttons */}
      <SafeAreaView edges={["top"]} style={{ backgroundColor: pal.bg }}>
        <View style={{ alignItems: "center", paddingTop: sp.s2 }}>
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: pal.hairline2,
            }}
          />
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            height: 48,
            paddingHorizontal: sp.s3,
          }}
        >
          <View style={{ width: 84, alignItems: "flex-start" }}>
            <HeaderDisc
              icon="close"
              iconSize={18}
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
            />
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
              gap: sp.s2,
            }}
          >
            <HeaderDisc icon={glyphs.share} onPress={() => Share.share({ message: webUrl })} />
            <HeaderDisc icon="open-outline" onPress={() => WebBrowser.openBrowserAsync(webUrl)} />
          </View>
        </View>
        <Hairline />
      </SafeAreaView>

      {/* Body */}
      <View style={{ flex: 1, backgroundColor: pal.bg }}>
        {uri ? (
          <WebView
            ref={webRef}
            key={webKey}
            source={{ uri }}
            onNavigationStateChange={(nav) => {
              canGoBackRef.current = nav.canGoBack;
            }}
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
            // 0.998 IS "normal" — RN's own alias for UIScrollViewDecelerationRateNormal.
            // The string form killed the reader outright on Android: react-native-webview
            // declares `decelerationRate?: Double` in its codegen spec, so the generated
            // Fabric delegate casts whatever arrives to Double and a String throws
            // ClassCastException while the view is still being created — a red box, not a
            // degraded scroll. The prop only does anything on iOS, but it is passed on both
            // platforms, so the value has to be one both can hold. Never hand this a string.
            decelerationRate={0.998}
          />
        ) : null}
        {!uri || webLoading ? (
          /* An article's shape while the page arrives — a spinner over a white
             void reads as broken; this reads as loading. */
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: pal.bg, paddingHorizontal: sp.s4, paddingTop: sp.s6, gap: sp.s3 },
            ]}
          >
            <SkeletonText w={0.45} size={12} />
            <SkeletonText w={0.85} size={26} />
            <View style={{ paddingTop: sp.s3, gap: sp.s2 }}>
              {[1, 0.96, 0.99, 0.6, 0.92, 0.97, 0.5].map((w, i) => (
                <SkeletonText key={i} w={w} size={14} />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
