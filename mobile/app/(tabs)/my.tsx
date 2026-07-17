// MY tab (HANDOFF §5.6) — watchlist (the holding queue), Seen ledger,
// edition switcher, notifications, account (in-app deletion — Apple 5.1.1(v)).
// Skinned to design system v2 "Lava": gradient-avatar identity card, chip
// segmented control, whitespace list rows, grouped settings on a surface card.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as AppleAuthentication from "expo-apple-authentication";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AvailabilityDots,
  Btn,
  Chip,
  GradientBtn,
  Hairline,
  PosterImg,
  SectionTitle,
  Tactile,
  TSBadge,
  Ui,
} from "../../src/components/ui";
import { METATAKE_BASE } from "../../src/config";
import { ALL_EDITIONS } from "../../src/editions";
import type { UILocale } from "../../src/editions";
import { t } from "../../src/i18n";
import { api } from "../../src/lib/api";
import { registerPush } from "../../src/lib/push";
import { supabase } from "../../src/lib/supabase";
import { useFilms } from "../../src/state/films";
import { usePrefs } from "../../src/state/prefs";
import { brand, font, fs, gradient, radius, sp, usePalette } from "../../src/theme";

type ListMode = "watchlist" | "seen";

type FilmMetaRow = {
  slug: string;
  title: string;
  year: number | null;
  poster_path: string | null;
  director: string | null;
};

// Locale autonyms — shown in their own language on purpose. // TODO(i18n)
const LOCALE_LABEL: Record<UILocale, string> = {
  en: "English",
  ko: "한국어",
  es: "Español",
  ja: "日本語",
};
const LOCALE_CYCLE: UILocale[] = ["en", "ko", "es", "ja"];

// Hairline inset for grouped settings rows: 16 padding + 32 icon disc + 12 gap.
const ROW_INSET = 60;

export default function MyScreen() {
  const pal = usePalette();
  const scheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const prefs = usePrefs();
  const { session, ledger, reload } = useFilms();

  const scrollRef = useRef<ScrollView>(null);
  const [mode, setMode] = useState<ListMode>("watchlist");
  const [meta, setMeta] = useState<Map<string, FilmMetaRow>>(new Map());
  const [tiers, setTiers] = useState<Map<string, string[]>>(new Map());
  const [tsMap, setTsMap] = useState<Map<string, number>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [authOpen, setAuthOpen] = useState(false); // signed-out auth block reveal

  // ---- ledger-derived slug lists ------------------------------------------
  const { watchSlugs, seenSlugs } = useMemo(() => {
    const w: string[] = [];
    const s: string[] = [];
    for (const [slug, e] of ledger) {
      if (e.watchlist) w.push(slug);
      if (e.seen) s.push(slug);
    }
    return { watchSlugs: w, seenSlugs: s };
  }, [ledger]);

  const allSlugs = useMemo(
    () => [...new Set([...watchSlugs, ...seenSlugs])],
    [watchSlugs, seenSlugs],
  );
  const allKey = allSlugs.join("|");
  const watchKey = watchSlugs.join("|");

  // Film meta for every ledger row — ONE query.
  useEffect(() => {
    let alive = true;
    if (!allSlugs.length) {
      setMeta(new Map());
      return;
    }
    supabase
      .from("films")
      .select("slug,title,year,poster_path,director")
      .in("slug", allSlugs.slice(0, 300))
      .then(({ data }) => {
        if (!alive || !data) return;
        setMeta(new Map((data as FilmMetaRow[]).map((r) => [r.slug, r])));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allKey]);

  // Availability dots on watchlist rows — the push's visual twin.
  useEffect(() => {
    let alive = true;
    if (!watchSlugs.length) {
      setTiers(new Map());
      return;
    }
    api
      .availability(watchSlugs.slice(0, 300), prefs.country)
      .then((m) => alive && setTiers(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchKey, prefs.country]);

  // TakeScore badges on ledger rows — best-effort, fails soft (Lava list grammar).
  useEffect(() => {
    let alive = true;
    if (!allSlugs.length) {
      setTsMap(new Map());
      return;
    }
    api
      .takescores(allSlugs.slice(0, 300))
      .then((m) => alive && setTsMap(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allKey]);

  // Revealing the auth block scrolls it into view (after it lays out).
  useEffect(() => {
    if (!authOpen) return;
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [authOpen]);

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const onTogglePush = async (on: boolean) => {
    if (!on) {
      prefs.set({ pushEnabled: false });
      return;
    }
    setPushBusy(true);
    prefs.set({ pushEnabled: true }); // optimistic — reverted below on failure
    const ok = await registerPush(prefs.country, prefs.locale).catch(() => false);
    if (!ok) prefs.set({ pushEnabled: false });
    setPushBusy(false);
  };

  const edition = ALL_EDITIONS.find((e) => e.country === prefs.country);
  const cycleLocale = () => {
    const i = LOCALE_CYCLE.indexOf(prefs.locale);
    prefs.set({ locale: LOCALE_CYCLE[(i + 1) % LOCALE_CYCLE.length] });
  };

  const slugs = mode === "watchlist" ? watchSlugs : seenSlugs;
  const email = session?.user.email ?? null;

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: pal.bg }}
      contentContainerStyle={{ paddingBottom: 120 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={pal.muted} />
      }
    >
      {/* Masthead */}
      <View style={{ paddingTop: insets.top + sp.s3, paddingHorizontal: sp.s4 }}>
        <Ui size={fs.x2} weight="600">
          {t("tab.my")}
        </Ui>
      </View>

      {/* Identity card */}
      {session ? (
        <View
          style={{
            marginTop: sp.s4,
            marginHorizontal: sp.s4,
            backgroundColor: pal.surface,
            borderRadius: radius.lg,
            padding: sp.s5,
            flexDirection: "row",
            alignItems: "center",
            gap: sp.s4,
          }}
        >
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: 56,
              height: 56,
              borderRadius: radius.pill,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ui size={fs.xl} weight="700" color="#FFFFFF">
              {(email?.[0] ?? "m").toUpperCase()}
            </Ui>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            {email ? (
              <Ui size={fs.md} weight="500" numberOfLines={1}>
                {email}
              </Ui>
            ) : null}
            <Ui size={fs.xs} color={pal.muted} style={{ marginTop: 2 }}>
              Metatake member
            </Ui>
            {/* TODO(i18n): my.memberBadge */}
          </View>
        </View>
      ) : (
        <View
          style={{
            marginTop: sp.s4,
            marginHorizontal: sp.s4,
            backgroundColor: pal.surface,
            borderRadius: radius.lg,
            padding: sp.s5,
            gap: sp.s4,
          }}
        >
          <Ui size={fs.base} color={pal.inkSoft}>
            {t("my.signInHint")}
          </Ui>
          <GradientBtn label={t("my.signIn")} onPress={() => setAuthOpen(true)} />
        </View>
      )}

      {/* Segmented control — watchlist / seen */}
      <View style={{ flexDirection: "row", gap: sp.s2, marginTop: sp.s5, paddingHorizontal: sp.s4 }}>
        <Chip
          label={t("my.watchlist")}
          active={mode === "watchlist"}
          onPress={() => setMode("watchlist")}
        />
        <Chip label={t("my.seen")} active={mode === "seen"} onPress={() => setMode("seen")} />
      </View>

      {/* Ledger list */}
      <View style={{ marginTop: sp.s3 }}>
        {slugs.length === 0 ? (
          <Ui size={fs.sm} color={pal.muted} style={{ paddingHorizontal: sp.s4, paddingVertical: sp.s4 }}>
            {mode === "watchlist" ? t("my.emptyWatchlist") : t("my.emptySeen")}
          </Ui>
        ) : (
          slugs.map((slug) => {
            const m = meta.get(slug);
            if (!m) return null;
            return (
              <LedgerRow
                key={slug}
                slug={slug}
                title={m.title}
                year={m.year}
                director={m.director}
                poster_path={m.poster_path}
                ts={tsMap.get(slug) ?? null}
                tiers={mode === "watchlist" ? (tiers.get(slug) ?? []) : undefined}
              />
            );
          })
        )}
      </View>

      {/* SETTINGS — one grouped surface card */}
      <SectionTitle>{t("my.settings")}</SectionTitle>
      <View
        style={{
          marginHorizontal: sp.s4,
          backgroundColor: pal.surface,
          borderRadius: radius.md,
          overflow: "hidden",
        }}
      >
        <SettingRow
          icon="globe-outline"
          label={t("my.country")}
          value={edition ? `${edition.flag} ${edition.label}` : prefs.country}
          onPress={() => router.push({ pathname: "/onboarding", params: { step: "country" } })}
        />
        <Hairline style={{ marginLeft: ROW_INSET }} />
        <SettingRow
          icon="language-outline"
          label={t("my.language")}
          value={LOCALE_LABEL[prefs.locale]}
          onPress={cycleLocale}
        />
        <Hairline style={{ marginLeft: ROW_INSET }} />
        <SettingRow
          icon="tv-outline"
          label={t("my.services")}
          value={String(prefs.providerIds.length)}
          onPress={() => router.push({ pathname: "/onboarding", params: { step: "services" } })}
        />
        <Hairline style={{ marginLeft: ROW_INSET }} />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: sp.s3,
            paddingHorizontal: sp.s4,
            paddingVertical: sp.s3,
          }}
        >
          <IconDisc name="notifications-outline" />
          <View style={{ flex: 1 }}>
            <Ui size={fs.md} weight="500">
              {t("my.notifications")}
            </Ui>
            <Ui size={fs.xs} color={pal.muted} style={{ marginTop: 2 }}>
              {t("my.notifyArrivals")}
            </Ui>
          </View>
          <Switch
            value={prefs.pushEnabled}
            disabled={pushBusy}
            onValueChange={onTogglePush}
            trackColor={{ true: brand.accent, false: pal.hairline2 }}
          />
        </View>
      </View>

      {/* ACCOUNT */}
      {session ? (
        <>
          <SectionTitle>{t("my.account")}</SectionTitle>
          <SignedIn />
        </>
      ) : authOpen ? (
        <>
          <SectionTitle>{t("my.account")}</SectionTitle>
          <SignedOut
            scheme={scheme === "dark" ? "dark" : "light"}
            onSkip={() => setAuthOpen(false)}
          />
        </>
      ) : null}

      {/* Attribution (invariant §13-8) */}
      <View style={{ paddingHorizontal: sp.s4, paddingTop: sp.s6, gap: 2 }}>
        <Ui size={fs.xs} color={pal.subtle}>
          {t("attribution.justwatch")}
        </Ui>
        <Ui size={fs.xs} color={pal.subtle}>
          {t("attribution.tmdb")}
        </Ui>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------

/** Ledger row — same grammar as search results: rounded poster, sans title. */
function LedgerRow({
  slug,
  title,
  year,
  director,
  poster_path,
  ts,
  tiers,
}: {
  slug: string;
  title: string;
  year: number | null;
  director: string | null;
  poster_path: string | null;
  ts: number | null;
  tiers?: string[];
}) {
  const pal = usePalette();
  const router = useRouter();
  const sub = [year, director].filter(Boolean).join(" · ");
  return (
    <Tactile onPress={() => router.push({ pathname: "/film/[slug]", params: { slug } })}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: sp.s3,
          paddingHorizontal: sp.s4,
          paddingVertical: sp.s3,
        }}
      >
        <PosterImg path={poster_path} width={48} height={72} size="w92" rounded={radius.sm} />
        <View style={{ flex: 1 }}>
          <Ui size={fs.md} weight="500" numberOfLines={1}>
            {title}
          </Ui>
          {sub ? (
            <Ui size={fs.sm} color={pal.muted} numberOfLines={1} style={{ marginTop: 1 }}>
              {sub}
            </Ui>
          ) : null}
        </View>
        {tiers?.length ? <AvailabilityDots tiers={tiers} /> : null}
        <TSBadge ts={ts} />
      </View>
    </Tactile>
  );
}

/** 32px leading icon disc for grouped settings rows. */
function IconDisc({ name }: { name: React.ComponentProps<typeof Ionicons>["name"] }) {
  const pal = usePalette();
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: radius.pill,
        backgroundColor: pal.bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons name={name} size={16} color={pal.ink} />
    </View>
  );
}

function SettingRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  onPress: () => void;
}) {
  const pal = usePalette();
  return (
    <Tactile onPress={onPress}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: sp.s3,
          paddingHorizontal: sp.s4,
          paddingVertical: sp.s3,
        }}
      >
        <IconDisc name={icon} />
        <Ui size={fs.md} weight="500" style={{ flex: 1 }}>
          {label}
        </Ui>
        <Ui size={fs.sm} color={pal.muted}>
          {value}
        </Ui>
        <Ionicons name="chevron-forward" size={16} color={pal.subtle} />
      </View>
    </Tactile>
  );
}

// ---- Signed-in account block ----------------------------------------------

function SignedIn() {
  const pal = usePalette();
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  const doDelete = async () => {
    if (busy) return;
    setBusy(true);
    setErr(false);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("no session");
      const res = await fetch(`${METATAKE_BASE}/api/v1/app/account-delete`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await supabase.auth.signOut();
    } catch {
      setErr(true);
    }
    setBusy(false);
  };

  const confirmDelete = () => {
    // Web preview: Alert has no browser implementation and the delete POST needs
    // the authorization header the public API's CORS deliberately blocks — so the
    // browser delegates account management to the website. Native does it in-app
    // (Apple 5.1.1(v)).
    if (Platform.OS === "web") {
      window.open(`${METATAKE_BASE}/settings`, "_blank", "noopener");
      return;
    }
    Alert.alert(t("my.deleteAccount"), t("my.deleteAccountConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("my.deleteAccount"), style: "destructive", onPress: () => void doDelete() },
    ]);
  };

  return (
    <View style={{ paddingHorizontal: sp.s4, gap: sp.s3 }}>
      <Btn kind="ghost" label={t("my.signOut")} onPress={() => void supabase.auth.signOut()} />
      <Tactile
        onPress={confirmDelete}
        disabled={busy}
        style={{ alignSelf: "flex-start", paddingVertical: sp.s2 }}
      >
        <Ui
          size={fs.sm}
          weight="500"
          color={brand.tsRisk}
          style={{ textDecorationLine: "underline", opacity: busy ? 0.5 : 1 }}
        >
          {t("my.deleteAccount")}
        </Ui>
      </Tactile>
      {err ? (
        <Ui size={fs.xs + 1} color={pal.muted}>
          {t("error.network")}
        </Ui>
      ) : null}
    </View>
  );
}

// ---- Signed-out account block: email + 6-digit code, Apple ----------------

function SignedOut({
  scheme,
  onSkip,
}: {
  scheme: "light" | "dark" | null | undefined;
  onSkip: () => void;
}) {
  const pal = usePalette();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [appleErr, setAppleErr] = useState(false);

  const inputStyle = {
    backgroundColor: pal.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: pal.hairline2,
    borderRadius: radius.sm,
    color: pal.ink,
    fontFamily: font.ui,
    fontSize: fs.base,
    paddingHorizontal: sp.s4,
    paddingVertical: sp.s3,
  } as const;

  const sendCode = async () => {
    if (busy || !email.includes("@")) return;
    setBusy(true);
    setErr(false);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setStage("code");
    } catch {
      setErr(true);
    }
    setBusy(false);
  };

  const verifyCode = async () => {
    if (busy || code.trim().length < 6) return;
    setBusy(true);
    setErr(false);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (error) throw error;
      // session propagates via onAuthStateChange (FilmsProvider reloads the ledger)
    } catch {
      setErr(true);
    }
    setBusy(false);
  };

  const signInApple = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error("no identity token");
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });
      if (error) throw error;
    } catch (e) {
      // User-cancelled sheets stay silent; real failures surface the config hint.
      if ((e as { code?: string }).code !== "ERR_REQUEST_CANCELED") setAppleErr(true);
    }
  };

  return (
    <View
      style={{
        marginHorizontal: sp.s4,
        backgroundColor: pal.surface,
        borderRadius: radius.lg,
        padding: sp.s5,
        gap: sp.s3,
      }}
    >
      <Ui size={fs.lg} weight="600">
        {t("auth.title")}
      </Ui>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder={t("auth.email")}
        placeholderTextColor={pal.subtle}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
        style={inputStyle}
      />
      {stage === "code" ? (
        <>
          <Ui size={fs.xs + 1} color={pal.muted}>
            Enter the 6-digit code we emailed you {/* TODO(i18n) */}
          </Ui>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="000000"
            placeholderTextColor={pal.subtle}
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
            style={inputStyle}
          />
          <GradientBtn label={t("my.signIn")} onPress={() => void verifyCode()} />
        </>
      ) : (
        <GradientBtn label={t("auth.continue")} onPress={() => void sendCode()} />
      )}
      {err ? (
        <Ui size={fs.xs + 1} color={pal.muted}>
          {t("error.network")}
        </Ui>
      ) : null}

      {/* or */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: sp.s3, marginVertical: sp.s1 }}>
        <Hairline style={{ flex: 1 }} />
        <Ui size={fs.xs} color={pal.muted}>
          {t("auth.or")}
        </Ui>
        <Hairline style={{ flex: 1 }} />
      </View>

      {Platform.OS === "ios" ? (
        <>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={
              scheme === "dark"
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={radius.xs}
            style={{ height: 48 }}
            onPress={() => void signInApple()}
          />
          {appleErr ? (
            <Ui size={fs.xs + 1} color={pal.muted}>
              Apple sign-in not configured yet {/* TODO(owner): enable Apple provider in Supabase Auth */}
            </Ui>
          ) : null}
        </>
      ) : null}
      <Ui size={fs.sm} color={pal.subtle} style={{ textAlign: "center" }}>
        {t("auth.continueGoogle")} · {t("common.soon")}
      </Ui>

      <Tactile onPress={onSkip} style={{ alignSelf: "center", paddingVertical: sp.s1 }}>
        <Ui size={fs.sm} weight="500" color={pal.muted} style={{ textDecorationLine: "underline" }}>
          {t("action.skip")}
        </Ui>
      </Tactile>
    </View>
  );
}
