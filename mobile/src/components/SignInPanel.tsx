// The ONE sign-in surface. Onboarding's account step and the You tab's settings
// sheet both render this — they used to be two hand-maintained copies and they
// drifted badly (owner report 2026-07-31): the settings copy still asked for a
// 6-digit code when the server sends 8, printed an untranslated developer
// string, put email above the social buttons, and reported every failure as
// "couldn't reach Metatake" so a real auth error looked like a dead network.
//
// Order (owner 07-30): one tap first — Apple on iOS, then Google. Email is the
// fallback, and it now offers a PASSWORD as well as an emailed code, because
// App Store review asks for an account and password they can type.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as AppleAuthentication from "expo-apple-authentication";
import React, { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { t } from "../i18n";
import { signInWithGoogle } from "../lib/auth";
import { hasAuthProvider } from "../platform/auth-providers";
import { supabase } from "../lib/supabase";
import { brand, font, fs, radius, sp, usePalette } from "../theme";
import { Btn, GradientBtn, Hairline, Tactile, Ui } from "./ui";

/** MUST match Supabase auth `mailer_otp_length` (8 as of 2026-07-30). */
export const OTP_LEN = 8;
const OTP_MIN = 6; // stay tolerant if the server is ever set back to 6
/** Supabase's own floor. Saying it up front beats a server error after typing. */
const PW_MIN = 6;

type Mode = "choose" | "password" | "code";

export default function SignInPanel({ onDone }: { onDone: () => void }) {
  const pal = usePalette();
  const [mode, setMode] = useState<Mode>("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const field = (focused = false) =>
    ({
      backgroundColor: pal.card,
      borderWidth: focused ? 1.5 : StyleSheet.hairlineWidth,
      borderColor: focused ? brand.accent : pal.hairline2,
      borderRadius: radius.sm,
      color: pal.ink,
      fontFamily: font.ui,
      fontSize: fs.base,
      paddingHorizontal: sp.s4,
      paddingVertical: sp.s3,
    }) as const;

  const emailOk = /\S+@\S+\.\S+/.test(email.trim());

  /** Report what actually happened. A blanket "check your connection" hid real
   *  auth failures (wrong password, unconfirmed address) behind a network lie. */
  const explain = (e: unknown): string => {
    const msg = (e instanceof Error ? e.message : String(e ?? "")).toLowerCase();
    if (msg.includes("invalid login")) return t("auth.errWrongPassword");
    if (msg.includes("already registered") || msg.includes("already been registered"))
      return t("auth.errAlreadyRegistered");
    if (msg.includes("confirm")) return t("auth.errUnconfirmed");
    if (msg.includes("token") || msg.includes("otp") || msg.includes("expired"))
      return t("auth.codeError");
    if (msg.includes("network") || msg.includes("fetch") || msg.includes("abort"))
      return t("error.network");
    return t("auth.errGeneric");
  };

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(explain(e));
    }
    setBusy(false);
  };

  const signInApple = () =>
    run(async () => {
      try {
        const cred = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
        if (!cred.identityToken) throw new Error("no identity token");
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: cred.identityToken,
        });
        if (error) throw error;
        onDone();
      } catch (e) {
        // A cancelled sheet is not a failure — stay silent.
        if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") return;
        throw e;
      }
    });

  const signInGoogle = () =>
    run(async () => {
      const out = await signInWithGoogle();
      if (out === "ok") onDone();
      else if (out === "error") throw new Error("google");
    });

  /** Password sign-in, falling forward to sign-up when the account is new. */
  const withPassword = () =>
    run(async () => {
      if (!emailOk || password.length < PW_MIN) return;
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (!error) {
        onDone();
        return;
      }
      const msg = error.message.toLowerCase();
      if (!msg.includes("invalid login")) throw error;
      // No such account (or wrong password) — try creating one. Supabase answers
      // "already registered" if the address exists, which is how we tell the two
      // apart without leaking account existence before the attempt.
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (signUpErr) {
        throw signUpErr.message.toLowerCase().includes("already")
          ? new Error("invalid login credentials")
          : signUpErr;
      }
      if (data.session) onDone();
      else setNotice(t("auth.confirmSent", { email: email.trim() }));
    });

  const sendCode = () =>
    run(async () => {
      if (!emailOk) return;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setMode("code");
      setNotice(null);
    });

  const verify = (raw: string) =>
    run(async () => {
      const token = raw.trim();
      if (token.length < OTP_MIN) return;
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token,
        type: "email",
      });
      if (error) throw error;
      onDone();
    });

  const Social = ({
    icon,
    label,
    onPress,
  }: {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    label: string;
    onPress: () => void;
  }) => (
    <Tactile onPress={onPress} feedback="tap">
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
        <Ionicons name={icon} size={20} color={pal.ink} style={{ position: "absolute", left: sp.s4 }} />
        <Ui size={fs.base} weight="600">
          {label}
        </Ui>
      </View>
    </Tactile>
  );

  return (
    <View style={{ gap: sp.s3 }}>
      {mode === "choose" ? (
        <>
          {hasAuthProvider("apple") ? (
            <Social icon="logo-apple" label={t("auth.continueApple")} onPress={signInApple} />
          ) : null}
          <Social icon="logo-google" label={t("auth.continueGoogle")} onPress={signInGoogle} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: sp.s3, marginVertical: sp.s1 }}>
            <Hairline style={{ flex: 1 }} />
            <Ui size={fs.xs} color={pal.muted}>
              {t("auth.or")}
            </Ui>
            <Hairline style={{ flex: 1 }} />
          </View>

          <Tactile feedback="tap" onPress={() => setMode("password")} hitSlop={8}>
            <View style={{ alignItems: "center", paddingVertical: sp.s3 }}>
              <Ui size={fs.sm} weight="600" color={pal.inkSoft}>
                {t("auth.continueEmail")}
              </Ui>
            </View>
          </Tactile>
        </>
      ) : null}

      {mode === "password" ? (
        <>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={t("auth.email")}
            placeholderTextColor={pal.subtle}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            editable={!busy}
            autoFocus
            style={field()}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={t("auth.password", { n: PW_MIN })}
            placeholderTextColor={pal.subtle}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            editable={!busy}
            onSubmitEditing={() => void withPassword()}
            style={field()}
          />
          <GradientBtn label={t("auth.continue")} onPress={() => void withPassword()} disabled={busy} />
          <Tactile feedback="tap" onPress={() => void sendCode()} hitSlop={8}>
            <View style={{ alignItems: "center", paddingVertical: sp.s2 }}>
              <Ui size={fs.sm} color={pal.muted} style={{ textDecorationLine: "underline" }}>
                {t("auth.emailCodeInstead")}
              </Ui>
            </View>
          </Tactile>
        </>
      ) : null}

      {mode === "code" ? (
        <>
          <Ui size={fs.sm} color={pal.muted}>
            {t("auth.codeSent", { email: email.trim(), n: OTP_LEN })}
          </Ui>
          <TextInput
            value={code}
            onChangeText={(v) => {
              const digits = v.replace(/[^0-9]/g, "").slice(0, OTP_LEN);
              setCode(digits);
              if (digits.length === OTP_LEN) void verify(digits);
            }}
            placeholder={t("auth.codePlaceholder", { n: OTP_LEN })}
            placeholderTextColor={pal.subtle}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={OTP_LEN}
            editable={!busy}
            autoFocus
            style={[field(), { letterSpacing: 6, textAlign: "center", fontSize: fs.lg }]}
          />
          <GradientBtn label={t("auth.verify")} onPress={() => void verify(code)} disabled={busy} />
          <Tactile feedback="tap" onPress={() => void sendCode()} hitSlop={8}>
            <View style={{ alignItems: "center", paddingVertical: sp.s2 }}>
              <Ui size={fs.sm} color={pal.muted} style={{ textDecorationLine: "underline" }}>
                {t("auth.resend")}
              </Ui>
            </View>
          </Tactile>
        </>
      ) : null}

      {mode !== "choose" ? (
        <Tactile
          feedback="tap"
          hitSlop={8}
          onPress={() => {
            setMode("choose");
            setError(null);
            setNotice(null);
          }}
        >
          <View style={{ alignItems: "center", paddingVertical: sp.s2 }}>
            <Ui size={fs.xs + 1} color={pal.subtle}>
              {t("auth.backToOptions")}
            </Ui>
          </View>
        </Tactile>
      ) : null}

      {notice ? (
        <Ui size={fs.xs + 1} color={brand.success}>
          {notice}
        </Ui>
      ) : null}
      {error ? (
        <Ui size={fs.xs + 1} color={brand.tsRisk}>
          {error}
        </Ui>
      ) : null}
    </View>
  );
}
