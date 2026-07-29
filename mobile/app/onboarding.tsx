// Onboarding — 3+1-step fullScreenModal (HANDOFF §4.2): country → services →
// account → taste calibration (④ v4 — shown only when a session exists, fully
// skippable). Also re-entered from settings/screens via ?step=country|services|account.
// Lava restyle: the whole screen reads as a SHEET (grab handle, compact header,
// gradient progress track); account step follows the benchmark login sheet order.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as AppleAuthentication from "expo-apple-authentication";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Serif,
  Btn,
  Chip,
  GradientBtn,
  Hairline,
  Loading,
  PosterImg,
  Screen,
  Tactile,
  Ui,
  Wordmark,
} from "../src/components/ui";
import { ALL_EDITIONS } from "../src/editions";
import { t } from "../src/i18n";
import { api, me } from "../src/lib/api";
import { signInWithGoogle } from "../src/lib/auth";
import { noteJudged } from "../src/lib/considering";
import { supabase } from "../src/lib/supabase";
import { useFilms } from "../src/state/films";
import { usePrefs } from "../src/state/prefs";
import { brand, font, fs, gradient, radius, sp, usePalette } from "../src/theme";
import type { Service, TonightRow } from "../src/types";

// Connect hub route (HANDOFF-커넥트 §2.1). Cast: the /connect screen lands in
// this same wave from another lane, and the generated typed-routes file only
// refreshes on the next `expo start` — the cast keeps tsc green until then.
const CONNECT_HREF = "/connect" as Href;

const STEPS = ["welcome", "country", "services", "account", "taste"] as const;
type Step = (typeof STEPS)[number];

function isStep(s: string | undefined): s is Step {
  return s === "country" || s === "services" || s === "account";
}

export default function OnboardingScreen() {
  const pal = usePalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ step?: string }>();
  const { onboarded, set } = usePrefs();

  // First launch opens on the value pitch; deep links and re-entry skip it.
  // An already-onboarded re-entry with no explicit step is almost always a
  // sign-in intent (every "Sign in" button routes here) — land on the form.
  const [step, setStep] = useState<Step>(() =>
    isStep(params.step) ? params.step : onboarded ? "account" : "welcome",
  );

  // Entered from settings to edit ONE step (country/services): Continue
  // returns to the caller instead of walking the rest of the funnel.
  const editOne = isStep(params.step) && params.step !== "account";

  const finish = () => {
    set({ onboarded: true });
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  // Step ④ taste calibration only makes sense with a session (me_mark_seen
  // writes). Session state may still be propagating right after verifyOtp /
  // Apple sign-in, so ask the auth client directly rather than trusting context.
  const accountDone = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) setStep("taste");
    else finish();
  };

  const stepIndex = STEPS.indexOf(step);
  const headerTitle =
    step === "welcome"
      ? t("welcome.title")
      : step === "country"
        ? t("onboarding.countryTitle")
        : step === "services"
          ? t("onboarding.servicesTitle")
          : step === "taste"
            ? t("onboarding.tasteTitle")
            : t("auth.title");

  return (
    <Screen>
      {/* Sheet chrome: grab handle → compact header → hairline → progress track */}
      <View style={{ paddingTop: insets.top + sp.s2 }}>
        <View style={{ alignItems: "center", paddingBottom: sp.s3 }}>
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
            paddingHorizontal: sp.s4,
            paddingBottom: sp.s3,
          }}
        >
          <View style={{ width: 44 }}>
            {/* Deep-linked re-entry (?step=) must always be dismissible — a
                signed-out first-timer who tapped "Sign in" is otherwise
                trapped with no back/close until the account step's Skip. */}
            {onboarded || isStep(params.step) ? (
              <Tactile onPress={finish} hitSlop={10}>
                <Ionicons name="close" size={22} color={pal.ink} />
              </Tactile>
            ) : null}
          </View>
          <Ui size={fs.sm} weight="600" style={{ flex: 1, textAlign: "center" }}>
            {headerTitle}
          </Ui>
          <View style={{ width: 44 }} />
        </View>
        <Hairline />
        <View
          style={{
            flexDirection: "row",
            gap: sp.s2,
            paddingHorizontal: sp.s4,
            paddingTop: sp.s3,
          }}
        >
          {STEPS.map((s, i) =>
            i <= stepIndex ? (
              <LinearGradient
                key={s}
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ flex: 1, height: 4, borderRadius: radius.pill }}
              />
            ) : (
              <View
                key={s}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: radius.pill,
                  backgroundColor: pal.hairline,
                }}
              />
            ),
          )}
        </View>
      </View>

      {step === "welcome" ? <StepWelcome onNext={() => setStep("country")} /> : null}
      {step === "country" ? (
        <StepCountry onNext={() => (editOne ? finish() : setStep("services"))} />
      ) : null}
      {step === "services" ? (
        <StepServices onNext={() => (editOne ? finish() : setStep("account"))} />
      ) : null}
      {step === "account" ? <StepAccount onDone={() => void accountDone()} /> : null}
      {step === "taste" ? <StepTaste onDone={finish} /> : null}
    </Screen>
  );
}

/* ------------------------------------------------- bottom-pinned CTA bar */

function BottomBar({ children }: { children: React.ReactNode }) {
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: pal.bg }}>
      <Hairline />
      <View
        style={{
          paddingHorizontal: sp.s5,
          paddingTop: sp.s3,
          paddingBottom: insets.bottom + sp.s3,
        }}
      >
        {children}
      </View>
    </View>
  );
}

/* ---------------------------------------------------------------- welcome */

/** First-launch value pitch (owner directive 2026-07-18): what the app IS,
    in three lines, before any choice is asked. Value first, account last. */
function StepWelcome({ onNext }: { onNext: () => void }) {
  const pal = usePalette();

  const Row = ({
    icon,
    title,
    body,
  }: {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    title: string;
    body: string;
  }) => (
    <View style={{ flexDirection: "row", gap: sp.s4, alignItems: "flex-start" }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radius.sm,
          backgroundColor: pal.surface,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={22} color={brand.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Ui size={fs.md} weight="600">
          {title}
        </Ui>
        <Ui size={fs.sm} color={pal.muted} style={{ marginTop: 2 }}>
          {body}
        </Ui>
      </View>
    </View>
  );

  return (
    <>
      <ScrollView contentContainerStyle={{ paddingHorizontal: sp.s5, paddingTop: sp.s6 }}>
        <Wordmark size={fs.x3} />
        <Ui size={fs.lg} color={pal.inkSoft} style={{ marginTop: sp.s3 }}>
          {t("welcome.tagline")}
        </Ui>
        <View style={{ marginTop: sp.s6, gap: sp.s5 }}>
          <Row icon="checkmark-done-outline" title={t("welcome.p1t")} body={t("welcome.p1b")} />
          <Row icon="albums-outline" title={t("welcome.p2t")} body={t("welcome.p2b")} />
          <Row icon="map-outline" title={t("welcome.p3t")} body={t("welcome.p3b")} />
        </View>
        {/* Dedication (owner directive 2026-07-20) */}
        <Serif size={fs.sm} italic color={pal.subtle} style={{ marginTop: sp.s6 }}>
          to. W.H. Heo
        </Serif>
      </ScrollView>
      <BottomBar>
        <GradientBtn label={t("welcome.start")} onPress={onNext} />
      </BottomBar>
    </>
  );
}

/* ---------------------------------------------------------------- country */

function StepCountry({ onNext }: { onNext: () => void }) {
  const pal = usePalette();
  const { country, set } = usePrefs();
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ paddingHorizontal: sp.s5, paddingTop: sp.s5 }}>
          <Ui size={fs.x2} weight="600">
            {t("onboarding.countryTitle")}
          </Ui>
          <Ui size={fs.sm} color={pal.muted} style={{ marginTop: sp.s2 }}>
            {t("onboarding.countryBody")}
          </Ui>
        </View>

        <View style={{ paddingHorizontal: sp.s5, paddingTop: sp.s5, gap: sp.s3 }}>
          {ALL_EDITIONS.map((ed) => {
            const selected = country === ed.country;
            return (
              <Tactile
                key={ed.code}
                disabled={!ed.live}
                onPress={() => set({ country: ed.country, locale: ed.locale })}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: sp.s3,
                    backgroundColor: pal.surface,
                    borderRadius: radius.md,
                    padding: sp.s4,
                    borderWidth: 2,
                    borderColor: selected ? brand.accent : "transparent",
                    opacity: ed.live ? 1 : 0.4,
                  }}
                >
                  <Ui size={28}>{ed.flag}</Ui>
                  <Ui size={fs.base} weight="600" style={{ flex: 1 }}>
                    {ed.label}
                  </Ui>
                  <Ui size={fs.xs + 1} color={pal.muted}>
                    {ed.country}
                  </Ui>
                  {!ed.live ? <Chip label={t("common.soon")} /> : null}
                </View>
              </Tactile>
            );
          })}
        </View>
      </ScrollView>
      <BottomBar>
        <GradientBtn label={t("action.continue")} onPress={onNext} />
      </BottomBar>
    </View>
  );
}

/* --------------------------------------------------------------- services */

const GROUPS = [
  { label: "subscription", key: "kind.flatrate" },
  { label: "free", key: "kind.free" },
  { label: "rent", key: "kind.rent" },
] as const;

function StepServices({ onNext }: { onNext: () => void }) {
  const pal = usePalette();
  const { country, providerIds, set } = usePrefs();
  const [services, setServices] = useState<Service[] | null>(null);
  const [err, setErr] = useState(false);
  const [gen, setGen] = useState(0);
  const [sel, setSel] = useState<Set<number>>(() => new Set(providerIds));

  useEffect(() => {
    let alive = true;
    setServices(null);
    setErr(false);
    api
      .services(country)
      .then((o) => alive && setServices(o.services))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [country, gen]);

  const grouped = useMemo(() => {
    const g: Record<string, Service[]> = { subscription: [], free: [], rent: [] };
    for (const s of services ?? []) (g[s.label] ?? g.rent).push(s);
    return g;
  }, [services]);

  const toggle = (id: number) =>
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (err)
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: sp.s4 }}>
        <Ui color={pal.muted}>{t("error.network")}</Ui>
        <Btn label={t("action.retry")} onPress={() => setGen((n) => n + 1)} />
      </View>
    );
  if (!services) return <Loading />;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ paddingHorizontal: sp.s5, paddingTop: sp.s5 }}>
          <Ui size={fs.x2} weight="600">
            {t("onboarding.servicesTitle")}
          </Ui>
          <Ui size={fs.sm} color={pal.muted} style={{ marginTop: sp.s2 }}>
            {t("onboarding.servicesBody")}
          </Ui>
        </View>

        {GROUPS.map((g) =>
          grouped[g.label].length ? (
            <View key={g.label}>
              <Ui
                size={fs.md}
                weight="600"
                style={{ paddingHorizontal: sp.s5, marginTop: sp.s5, marginBottom: sp.s3 }}
              >
                {t(g.key)}
              </Ui>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: sp.s2,
                  paddingHorizontal: sp.s5,
                }}
              >
                {grouped[g.label].map((s) => (
                  <Chip
                    key={s.provider_id}
                    label={s.provider_name}
                    active={sel.has(s.provider_id)}
                    onPress={() => toggle(s.provider_id)}
                  />
                ))}
              </View>
            </View>
          ) : null,
        )}
      </ScrollView>
      <BottomBar>
        <GradientBtn
          label={t("action.continue")}
          onPress={() => {
            set({ providerIds: [...sel] });
            onNext();
          }}
        />
      </BottomBar>
    </View>
  );
}

/* ------------------------------------------------- account (login sheet) */

function SocialRow({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
}) {
  const pal = usePalette();
  return (
    <Tactile onPress={onPress}>
      <View
        style={{
          height: 48,
          borderRadius: radius.xs,
          borderWidth: 1,
          borderColor: pal.ink,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons
          name={icon}
          size={20}
          color={pal.ink}
          style={{ position: "absolute", left: sp.s4 }}
        />
        <Ui size={fs.base} weight="600">
          {label}
        </Ui>
      </View>
    </Tactile>
  );
}

function StepAccount({ onDone }: { onDone: () => void }) {
  const pal = usePalette();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailFocus, setEmailFocus] = useState(false);
  const [codeFocus, setCodeFocus] = useState(false);
  const [appleErr, setAppleErr] = useState(false);
  const [googleErr, setGoogleErr] = useState(false);

  const fieldStyle = (focused: boolean) =>
    ({
      borderWidth: 1,
      borderColor: focused ? brand.accent : pal.hairline2,
      borderRadius: radius.xs,
      paddingVertical: sp.s3,
      paddingHorizontal: sp.s4,
      fontFamily: font.ui,
      fontSize: fs.base,
      color: pal.ink,
    }) as const;

  const sendCode = async () => {
    const addr = email.trim();
    if (busy || !addr.includes("@")) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.signInWithOtp({
      email: addr,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (e) setError(t("error.network"));
    else setSent(true);
  };

  const verify = async () => {
    const token = code.trim();
    if (busy || token.length < 6) return;
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    });
    setBusy(false);
    if (e) setError(t("auth.codeError"));
    else onDone();
  };

  // Google — OAuth through the system browser (expo-web-browser), tokens
  // handed back on the deep link. In Expo Go the redirect is exp://<lan-ip>,
  // in dev/store builds metatake://auth-callback — BOTH must be whitelisted in
  // the Supabase Auth console (owner TODO, with the Google provider itself).
  // Cancel stays silent; real failures surface the friendly notice (§13-17
  // spirit: never pretend it worked).
  const signInGoogle = async () => {
    const out = await signInWithGoogle();
    if (out === "ok") onDone();
    else if (out === "error") setGoogleErr(true); // cancel stays silent
  };

  // Same Apple intent as the signed-out block in (tabs)/my.tsx.
  const signInApple = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error("no identity token");
      const { error: e } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });
      if (e) throw e;
      onDone();
    } catch (e) {
      // User-cancelled sheets stay silent; real failures surface the config hint.
      if ((e as { code?: string }).code !== "ERR_REQUEST_CANCELED") setAppleErr(true);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: sp.s5, paddingTop: sp.s5, paddingBottom: 120 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* 1. Welcome heading */}
      <Ui size={fs.x2} weight="600">
        {t("auth.welcome")}
      </Ui>
      <Ui size={fs.sm} color={pal.muted} style={{ marginTop: sp.s2 }}>
        {t("auth.welcomeBody")}
      </Ui>

      <View style={{ marginTop: sp.s5, gap: sp.s3 }}>
        {!sent ? (
          <>
            {/* 2. Email field */}
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t("auth.email")}
              placeholderTextColor={pal.subtle}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!busy}
              onFocus={() => setEmailFocus(true)}
              onBlur={() => setEmailFocus(false)}
              style={fieldStyle(emailFocus)}
            />
            {/* 3. Continue → OTP */}
            <GradientBtn label={t("auth.continue")} onPress={() => void sendCode()} />

            {/* 4. or-divider */}
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: sp.s3, marginVertical: sp.s2 }}
            >
              <Hairline style={{ flex: 1 }} />
              <Ui size={fs.xs} color={pal.muted}>
                {t("auth.or")}
              </Ui>
              <Hairline style={{ flex: 1 }} />
            </View>

            {/* 5. Social rows — Apple first (iOS only), then Google */}
            {Platform.OS === "ios" ? (
              <SocialRow
                icon="logo-apple"
                label={t("auth.continueApple")}
                onPress={() => void signInApple()}
              />
            ) : null}
            {appleErr ? (
              <Ui size={fs.xs + 1} color={pal.muted}>
                Apple sign-in not configured yet {/* TODO(owner): enable Apple provider in Supabase Auth */}
              </Ui>
            ) : null}
            <SocialRow
              icon="logo-google"
              label={t("auth.continueGoogle")}
              onPress={() => void signInGoogle()}
            />
            {googleErr ? (
              <Ui size={fs.xs + 1} color={pal.muted}>
                {t("auth.googleError")}
              </Ui>
            ) : null}
          </>
        ) : (
          <>
            {/* Code entry substep */}
            <Ui size={fs.sm} color={pal.muted}>
              {t("auth.codeSent", { email: email.trim() })}
            </Ui>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder={t("auth.codePlaceholder")}
              placeholderTextColor={pal.subtle}
              keyboardType="number-pad"
              maxLength={6}
              editable={!busy}
              onFocus={() => setCodeFocus(true)}
              onBlur={() => setCodeFocus(false)}
              style={[
                fieldStyle(codeFocus),
                { letterSpacing: 8, textAlign: "center", fontSize: fs.lg },
              ]}
            />
            <GradientBtn label={t("auth.verify")} onPress={() => void verify()} />
            <Tactile onPress={() => (busy ? undefined : void sendCode())} hitSlop={6}>
              <Ui
                size={fs.sm}
                color={pal.muted}
                style={{ textAlign: "center", textDecorationLine: "underline" }}
              >
                {t("auth.resend")}
              </Ui>
            </Tactile>
            {/* Mistyped address escape — without this a typo dead-ends the
                whole OTP flow (Resend only re-sends to the same address). */}
            <Tactile
              onPress={() => {
                setSent(false);
                setCode("");
                setError(null);
              }}
              hitSlop={6}
            >
              <Ui
                size={fs.sm}
                color={pal.muted}
                style={{ textAlign: "center", textDecorationLine: "underline" }}
              >
                {t("auth.changeEmail")}
              </Ui>
            </Tactile>
          </>
        )}
        {error ? (
          <Ui size={fs.sm} color={brand.tsRisk}>
            {error}
          </Ui>
        ) : null}

        {/* 6. Skip — quiet underlined text link */}
        <Tactile onPress={onDone} hitSlop={6} style={{ marginTop: sp.s2 }}>
          <Ui
            size={fs.sm}
            weight="500"
            color={pal.muted}
            style={{ textAlign: "center", textDecorationLine: "underline" }}
          >
            {t("action.skip")}
          </Ui>
        </Tactile>
      </View>
    </ScrollView>
  );
}

/* -------------------------------------------- taste calibration (④, v4) */

const TASTE_COLS = 3;
const TASTE_COUNT = 24;

function StepTaste({ onDone }: { onDone: () => void }) {
  const pal = usePalette();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { country } = usePrefs();
  const { ledger, entry, markSeen, toggleSeen } = useFilms();
  const [rows, setRows] = useState<TonightRow[] | null>(null);
  const [err, setErr] = useState(false);
  const [gen, setGen] = useState(0);

  // Famous-films grid: the TS-ranked canon Tonight serves with no filters.
  useEffect(() => {
    let alive = true;
    setRows(null);
    setErr(false);
    api
      .tonight(country, [], {})
      .then((p) => alive && setRows(p.rows.slice(0, TASTE_COUNT)))
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [country, gen]);

  const cellW = Math.floor((width - sp.s5 * 2 - sp.s2 * (TASTE_COLS - 1)) / TASTE_COLS);

  const toggle = async (row: TonightRow) => {
    const e = entry(row.slug);
    if (!e.seen) {
      const tok = await markSeen(row.slug);
      if (tok) {
        void noteJudged(row.slug);
        me.invalidateRecommend();
      }
    } else {
      await toggleSeen(row.slug, e.filmId ?? row.film_id ?? "");
      me.invalidateRecommend();
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {err ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: sp.s4 }}>
          <Ui color={pal.muted}>{t("error.network")}</Ui>
          <Btn label={t("action.retry")} onPress={() => setGen((n) => n + 1)} />
        </View>
      ) : !rows ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 160 }}>
          <View style={{ paddingHorizontal: sp.s5, paddingTop: sp.s5 }}>
            <Ui size={fs.x2} weight="600">
              {t("onboarding.tasteTitle")}
            </Ui>
            <Ui size={fs.sm} color={pal.muted} style={{ marginTop: sp.s2 }}>
              {t("onboarding.tasteBody")}
            </Ui>
          </View>

          {/* Connect shortcut (HANDOFF-커넥트 §2.1) — importing beats tapping 24
              posters. Pushed on top of this modal, so the step resumes on return;
              the manual grid below stays the fallback. */}
          <Tactile
            onPress={() => router.push(CONNECT_HREF)}
            style={{ marginHorizontal: sp.s5, marginTop: sp.s5 }}
          >
            <View
              style={{
                backgroundColor: pal.surface,
                borderRadius: radius.md,
                paddingHorizontal: sp.s4,
                paddingVertical: sp.s3,
                flexDirection: "row",
                alignItems: "center",
                gap: sp.s3,
              }}
            >
              <Ui size={fs.sm} weight="500" style={{ flex: 1 }}>
                {t("connect.entry.onboarding")}
              </Ui>
              <Ionicons name="chevron-forward" size={16} color={pal.subtle} />
            </View>
          </Tactile>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              columnGap: sp.s2,
              rowGap: sp.s4,
              paddingHorizontal: sp.s5,
              paddingTop: sp.s5,
            }}
          >
            {rows.map((row) => {
              const seen = !!ledger.get(row.slug)?.seen;
              return (
                <Tactile key={row.slug} onPress={() => void toggle(row)} style={{ width: cellW }}>
                  <View>
                    <View>
                      <PosterImg
                        path={row.poster_path}
                        width={cellW}
                        height={Math.round(cellW * 1.5)}
                        size="w185"
                        rounded={radius.sm}
                      />
                      {seen ? (
                        <View
                          style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius: radius.sm,
                            backgroundColor: pal.scrim,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Ionicons name="checkmark-circle" size={32} color="#FFFFFF" />
                        </View>
                      ) : null}
                    </View>
                    <Ui size={fs.xs} numberOfLines={1} style={{ marginTop: 4 }}>
                      {row.title}
                    </Ui>
                  </View>
                </Tactile>
              );
            })}
          </View>
        </ScrollView>
      )}
      <BottomBar>
        <GradientBtn label={t("action.continue")} onPress={onDone} />
        <Tactile onPress={onDone} hitSlop={6} style={{ marginTop: sp.s3 }}>
          <Ui
            size={fs.sm}
            weight="500"
            color={pal.muted}
            style={{ textAlign: "center", textDecorationLine: "underline" }}
          >
            {t("action.skip")}
          </Ui>
        </Tactile>
      </BottomBar>
    </View>
  );
}
