// Onboarding — 3-step fullScreenModal (HANDOFF §4.2): country → services → account.
// Also re-entered from settings/screens via ?step=country|services|account.
// Lava restyle: the whole screen reads as a SHEET (grab handle, compact header,
// gradient progress track); account step follows the benchmark login sheet order.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as AppleAuthentication from "expo-apple-authentication";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Btn,
  Chip,
  GradientBtn,
  Hairline,
  Loading,
  Screen,
  Tactile,
  Ui,
} from "../src/components/ui";
import { ALL_EDITIONS } from "../src/editions";
import { t } from "../src/i18n";
import { api } from "../src/lib/api";
import { supabase } from "../src/lib/supabase";
import { usePrefs } from "../src/state/prefs";
import { brand, font, fs, gradient, radius, sp, usePalette } from "../src/theme";
import type { Service } from "../src/types";

const STEPS = ["country", "services", "account"] as const;
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

  const [step, setStep] = useState<Step>(() => (isStep(params.step) ? params.step : "country"));

  const finish = () => {
    set({ onboarded: true });
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  const stepIndex = STEPS.indexOf(step);
  const headerTitle =
    step === "country"
      ? t("onboarding.countryTitle")
      : step === "services"
        ? t("onboarding.servicesTitle")
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
            {onboarded ? (
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

      {step === "country" ? <StepCountry onNext={() => setStep("services")} /> : null}
      {step === "services" ? <StepServices onNext={() => setStep("account")} /> : null}
      {step === "account" ? <StepAccount onDone={finish} /> : null}
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
              onPress={() => {
                /* TODO(owner): wire Google OAuth (provider not configured yet) */
              }}
            />
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
