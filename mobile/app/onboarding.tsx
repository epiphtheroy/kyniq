// Onboarding — 3-step fullScreenModal (HANDOFF §4.2): country → services → account.
// Also re-entered from settings/screens via ?step=country|services|account.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Btn,
  Loading,
  PosterImg,
  Screen,
  SectionTitle,
  Serif,
  Ui,
} from "../src/components/ui";
import { ALL_EDITIONS } from "../src/editions";
import { t } from "../src/i18n";
import { api } from "../src/lib/api";
import { supabase } from "../src/lib/supabase";
import { usePrefs } from "../src/state/prefs";
import { brand, font, fs, sp, usePalette } from "../src/theme";
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

  return (
    <Screen>
      {/* Chrome: close (re-entry only) + step dots */}
      <View
        style={{
          paddingTop: insets.top + sp.s3,
          paddingHorizontal: sp.s4,
          paddingBottom: sp.s3,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <View style={{ width: 44 }}>
          {onboarded ? (
            <Pressable onPress={finish} hitSlop={10}>
              <Ionicons name="close" size={24} color={pal.ink} />
            </Pressable>
          ) : null}
        </View>
        <View style={{ flex: 1, flexDirection: "row", justifyContent: "center", gap: sp.s2 }}>
          {STEPS.map((s) => (
            <View
              key={s}
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                backgroundColor: s === step ? brand.accent : pal.hairline2,
              }}
            />
          ))}
        </View>
        <View style={{ width: 44 }} />
      </View>

      {step === "country" ? <StepCountry onNext={() => setStep("services")} /> : null}
      {step === "services" ? <StepServices onNext={() => setStep("account")} /> : null}
      {step === "account" ? <StepAccount onDone={finish} /> : null}
    </Screen>
  );
}

/* ---------------------------------------------------------------- country */

function StepCountry({ onNext }: { onNext: () => void }) {
  const pal = usePalette();
  const { country, set } = usePrefs();
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: sp.s7 }}>
      <View style={{ paddingHorizontal: sp.s6, paddingTop: sp.s6 }}>
        <Serif size={fs.x2} bold>
          {t("onboarding.countryTitle")}
        </Serif>
        <Ui size={fs.sm} color={pal.muted} style={{ marginTop: sp.s2 }}>
          {t("onboarding.countryBody")}
        </Ui>
      </View>

      <View style={{ paddingHorizontal: sp.s6, paddingTop: sp.s6 }}>
        {ALL_EDITIONS.map((ed) => {
          const selected = country === ed.country;
          return (
            <Pressable
              key={ed.code}
              disabled={!ed.live}
              onPress={() => set({ country: ed.country, locale: ed.locale })}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: sp.s3,
                paddingVertical: sp.s3,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: pal.hairline,
                opacity: ed.live ? (pressed ? 0.6 : 1) : 0.4,
              })}
            >
              <Ionicons
                name={selected ? "radio-button-on" : "radio-button-off"}
                size={20}
                color={selected ? brand.accent : pal.subtle}
              />
              <Ui size={fs.md}>{ed.flag}</Ui>
              <Ui size={fs.base} weight={selected ? "600" : "400"} style={{ flex: 1 }}>
                {ed.label}
              </Ui>
              <Ui size={fs.xs + 1} color={pal.muted}>
                {ed.country}
              </Ui>
              {!ed.live ? (
                <View
                  style={{
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: pal.hairline2,
                    borderRadius: 999,
                    paddingHorizontal: sp.s2,
                    paddingVertical: 1,
                  }}
                >
                  <Ui size={fs.xs} weight="600" color={pal.muted}>
                    {t("common.soon")}
                  </Ui>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={{ paddingHorizontal: sp.s6, paddingTop: sp.s6 }}>
        <Btn label={t("action.continue")} onPress={onNext} />
      </View>
    </ScrollView>
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
    <ScrollView contentContainerStyle={{ paddingBottom: sp.s7 }}>
      <View style={{ paddingHorizontal: sp.s6, paddingTop: sp.s6 }}>
        <Serif size={fs.x2} bold>
          {t("onboarding.servicesTitle")}
        </Serif>
        <Ui size={fs.sm} color={pal.muted} style={{ marginTop: sp.s2 }}>
          {t("onboarding.servicesBody")}
        </Ui>
      </View>

      {GROUPS.map((g) =>
        grouped[g.label].length ? (
          <View key={g.label}>
            <SectionTitle>{t(g.key)}</SectionTitle>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: sp.s2,
                paddingHorizontal: sp.s4,
              }}
            >
              {grouped[g.label].map((s) => {
                const on = sel.has(s.provider_id);
                return (
                  <Pressable
                    key={s.provider_id}
                    onPress={() => toggle(s.provider_id)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: sp.s2,
                      paddingVertical: sp.s2,
                      paddingHorizontal: sp.s3,
                      borderWidth: on ? 1 : StyleSheet.hairlineWidth,
                      borderColor: on ? brand.accent : pal.hairline2,
                      backgroundColor: on ? pal.surface : "transparent",
                      opacity: pressed ? 0.6 : 1,
                    })}
                  >
                    {s.logo_path ? (
                      <PosterImg path={s.logo_path} width={24} height={24} size="w92" />
                    ) : null}
                    <Ui size={fs.sm} weight={on ? "600" : "400"}>
                      {s.provider_name}
                    </Ui>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null,
      )}

      <View style={{ paddingHorizontal: sp.s6, paddingTop: sp.s6 }}>
        <Btn
          label={t("action.continue")}
          onPress={() => {
            set({ providerIds: [...sel] });
            onNext();
          }}
        />
      </View>
    </ScrollView>
  );
}

/* ---------------------------------------------------------------- account */

function StepAccount({ onDone }: { onDone: () => void }) {
  const pal = usePalette();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputStyle = {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: pal.hairline2,
    paddingVertical: sp.s3,
    paddingHorizontal: sp.s4,
    fontFamily: font.ui,
    fontSize: fs.base,
    color: pal.ink,
  } as const;

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

  return (
    <ScrollView
      contentContainerStyle={{ padding: sp.s6, paddingBottom: sp.s7 }}
      keyboardShouldPersistTaps="handled"
    >
      <Serif size={fs.x2} bold>
        {t("onboarding.accountTitle")}
      </Serif>
      <Ui size={fs.sm} color={pal.muted} style={{ marginTop: sp.s2 }}>
        {t("onboarding.accountBody")}
      </Ui>

      <View style={{ marginTop: sp.s6, gap: sp.s3 }}>
        {!sent ? (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t("auth.email")}
              placeholderTextColor={pal.subtle}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!busy}
              style={inputStyle}
            />
            <Btn label={t("auth.sendLink")} onPress={sendCode} />
          </>
        ) : (
          <>
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
              style={[inputStyle, { letterSpacing: 6, textAlign: "center" }]}
            />
            <Btn label={t("auth.verify")} onPress={verify} />
            <Pressable onPress={() => (busy ? undefined : sendCode())} hitSlop={6}>
              <Ui size={fs.sm} color={brand.accent} style={{ textAlign: "center" }}>
                {t("auth.resend")}
              </Ui>
            </Pressable>
          </>
        )}
        {error ? (
          <Ui size={fs.sm} color={brand.accent}>
            {error}
          </Ui>
        ) : null}
        <Btn kind="ghost" label={t("action.skip")} onPress={onDone} />
      </View>
    </ScrollView>
  );
}
