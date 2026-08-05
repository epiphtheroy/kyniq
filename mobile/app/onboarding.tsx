// Onboarding — 3+1-step fullScreenModal (HANDOFF §4.2): account → EDITION
// (country+services, one page) → taste calibration (④ v4 — shown only when a
// session exists, fully skippable). Re-entered from settings via ?step=…, and
// the retired ?step=country / ?step=services both land on the merged page so
// older deep links keep working.
//
// Owner 2026-08-03: country and services were two consecutive pages asking one
// question — "where do you watch?" — and the second one's answer depends
// entirely on the first. They are now ONE page: change the country and the
// service grid reloads under it, with services that don't exist there dropped.
// A pairing can be SAVED and swapped with one tap (home vs. travelling).
//
// `?step=language` is the third axis and deliberately NOT part of the funnel:
// content language is independent of country (migration 0121) and English is a
// fine default, so it is reachable from settings but never asked at signup.
// Lava restyle: the whole screen reads as a SHEET (grab handle, compact header,
// gradient progress track); account step follows the benchmark login sheet order.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as AppleAuthentication from "expo-apple-authentication";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAndroidBack } from "../src/platform/back";
import { KeyboardLift, formScrollProps } from "../src/platform/keyboard";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Serif,
  Btn,
  Chip,
  GradientBtn,
  Hairline,
  PosterImg,
  Screen,
  Tactile,
  Ui,
  Wordmark,
} from "../src/components/ui";
import { ALL_EDITIONS, CONTENT_LANGS, UI_LOCALES, type ContentLang } from "../src/editions";
import { countryLabel } from "../src/i18n/tokens";
import SignInPanel from "../src/components/SignInPanel";
import { SkeletonScreen } from "../src/components/motion";
import { t } from "../src/i18n";
import { api, me } from "../src/lib/api";
import { signInWithGoogle } from "../src/lib/auth";
import { noteJudged } from "../src/lib/considering";
import { supabase } from "../src/lib/supabase";
import { useFilms } from "../src/state/films";
import { usePrefs, type EditionPreset } from "../src/state/prefs";
import { brand, font, fs, gradient, motion, radius, sp, usePalette } from "../src/theme";
import type { Service, TonightRow } from "../src/types";

// Connect hub route (HANDOFF-커넥트 §2.1). Cast: the /connect screen lands in
// this same wave from another lane, and the generated typed-routes file only
// refreshes on the next `expo start` — the cast keeps tsc green until then.
const CONNECT_HREF = "/connect" as Href;

// Email OTP length. MUST match Supabase auth `mailer_otp_length` (read 2026-07-30:
// 8). The app used to hard-cap the field at 6, so the last two digits of every
// emailed code were untypeable and email signup could not complete. One constant
// now drives the field, the copy and the auto-submit; verify still accepts a
// shorter code so a server-side change to 6 degrades instead of breaking.
const OTP_LEN = 8;
const OTP_MIN = 6;

// Account rides RIGHT AFTER the welcome pitch (owner 07-29: a new install should sign
// up — Google, naturally — the moment the app opens), then the value setup follows.
const STEPS = ["welcome", "account", "edition", "taste"] as const;
type Step = (typeof STEPS)[number];

/** Steps reachable by deep link that are NOT part of the funnel progress track. */
type SideStep = "language" | "uiLanguage";
type AnyStep = Step | SideStep;

/** One completed segment of the step track — the Lava fill sweeps across it. */
function StepFill() {
  const pal = usePalette();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withSpring(1, motion.gentle);
  }, [p]);
  const anim = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));
  return (
    <View
      style={{
        flex: 1,
        height: 4,
        borderRadius: radius.pill,
        backgroundColor: pal.hairline,
        overflow: "hidden",
      }}
    >
      <Animated.View style={[{ height: 4 }, anim]}>
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

/** Retired step names. Settings rows, older OTA builds and saved links still
 *  use them, so they resolve to the page that replaced them rather than 404. */
type LegacyStep = "country" | "services";

function isStep(s: string | undefined): s is AnyStep | LegacyStep {
  return (
    s === "edition" || s === "country" || s === "services" || s === "account" || s === "language" ||
    s === "uiLanguage"
  );
}

function normalizeStep(s: string | undefined): AnyStep | null {
  if (!isStep(s)) return null;
  return s === "country" || s === "services" ? "edition" : s;
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
  const [step, setStep] = useState<AnyStep>(
    () => normalizeStep(params.step) ?? (onboarded ? "account" : "welcome"),
  );

  // Entered from settings to edit ONE step: Continue returns to the caller
  // instead of walking the rest of the funnel.
  const entry = normalizeStep(params.step);
  const editOne = entry !== null && entry !== "account";

  // Any ?step= entry is a SHEET someone opened over what they were already
  // doing — a settings row, or the sign-in prompt a film brief raises when a
  // signed-out reader judges. Dismissing it must return them there, whichever
  // step it carries. This is deliberately NOT `editOne`: account is excluded
  // from that one because signing in should carry ON to taste calibration,
  // which is a statement about Continue and says nothing about back.
  const dismissible = entry !== null;

  // Android's hardware back walks the funnel BACKWARDS instead of destroying it.
  // The four steps live in this one route's state, so without this the system
  // back pops the whole route and drops a first-run user into the tabs halfway
  // through setup. iOS has no hardware back, which is why the flow was only ever
  // linear there and the gap went unnoticed.
  useAndroidBack(() => {
    if (dismissible) return false; // a sheet raised from elsewhere: let back close it
    const i = STEPS.indexOf(step as Step);
    if (i <= 0) return false; // welcome: nothing of ours behind it
    setStep(STEPS[i - 1]);
    return true;
  });

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  // `onboarded` is a claim about what the user was ASKED, so only the funnel
  // makes it. Closing a sign-in sheet is the same exit WITHOUT the claim: a
  // reader who dismisses it has never seen country, services or taste, and
  // marking them onboarded here means they never will be.
  const finish = () => {
    set({ onboarded: true });
    close();
  };

  // Step ④ taste calibration only makes sense with a session (me_mark_seen
  // writes). Session state may still be propagating right after verifyOtp /
  // Apple sign-in, so ask the auth client directly rather than trusting context.
  const accountDone = async () => {
    // Re-entry (already onboarded, "Sign in" buttons land here): don't re-walk the
    // funnel — offer taste calibration when a session exists, else just close.
    if (onboarded) {
      const { data } = await supabase.auth.getSession();
      if (data.session) setStep("taste");
      else finish();
      return;
    }
    // First run: signed-in OR skipped, the value setup continues either way.
    setStep("edition");
  };

  // Last setup step — taste calibration needs a session (me_mark_seen writes).
  const editionDone = async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) setStep("taste");
    else finish();
  };

  // `language` is a side entrance, not a funnel step — it must not light up the
  // progress track (indexOf returns -1, which fills nothing).
  const stepIndex = STEPS.indexOf(step as Step);
  const headerTitle =
    step === "welcome"
      ? t("welcome.title")
      : step === "edition"
        ? t("onboarding.editionTitle")
        : step === "language"
          ? t("onboarding.languageTitle")
          : step === "uiLanguage"
            ? t("onboarding.uiLanguageTitle")
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
            {onboarded || dismissible ? (
              <Tactile onPress={close} hitSlop={10}>
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
              <StepFill key={s} />
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

      {step === "welcome" ? <StepWelcome onNext={() => setStep("account")} /> : null}
      {step === "edition" ? (
        <StepEdition onNext={() => (editOne ? finish() : void editionDone())} />
      ) : null}
      {step === "language" ? <StepLanguage onNext={finish} /> : null}
      {step === "uiLanguage" ? <StepUILanguage onNext={finish} /> : null}
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
      </ScrollView>
      <BottomBar>
        <GradientBtn label={t("welcome.start")} onPress={onNext} />
      </BottomBar>
    </>
  );
}

/* ------------------------------------------- edition (country + services) */

const GROUPS = [
  { label: "subscription", key: "kind.flatrate" },
  { label: "free", key: "kind.free" },
  { label: "rent", key: "kind.rent" },
] as const;

/**
 * ONE page for "where do you watch?" — the country and the services that exist
 * in it (owner 2026-08-03). They were two consecutive screens, but the second
 * one's entire content is a function of the first: pick Korea after picking the
 * US and you were looking at a Korean service grid on a page you had already
 * passed. Now the country row sits on top, the grid reloads under it, and any
 * service you had selected that does not exist in the new country is dropped —
 * silently, because keeping an invisible selection is how a watchlist ends up
 * filtered by a service the viewer cannot see.
 *
 * Saved pairings ("저장해서 선택할 수 있게") ride above both as chips: home vs.
 * travelling, or two households sharing one account, one tap apart.
 */
function StepEdition({ onNext }: { onNext: () => void }) {
  const pal = usePalette();
  const { country, providerIds, presets, set } = usePrefs();

  const [services, setServices] = useState<Service[] | null>(null);
  const [err, setErr] = useState(false);
  const [gen, setGen] = useState(0);
  const [sel, setSel] = useState<Set<number>>(() => new Set(providerIds));
  const [naming, setNaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [picking, setPicking] = useState(false);
  const here = ALL_EDITIONS.find((e) => e.country === country);

  useEffect(() => {
    let alive = true;
    setServices(null);
    setErr(false);
    api
      .services(country)
      .then((o) => {
        if (!alive) return;
        setServices(o.services);
        // Prune selections the new country doesn't carry. A provider id is
        // global (TMDB's), so an unpruned set silently narrows every "on my
        // services" filter to nothing after a country switch.
        const live = new Set(o.services.map((x) => x.provider_id));
        setSel((prev) => {
          const next = new Set([...prev].filter((id) => live.has(id)));
          return next.size === prev.size ? prev : next;
        });
      })
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

  const applyPreset = (p: EditionPreset) => {
    setSel(new Set(p.providerIds));
    set({ country: p.country, providerIds: p.providerIds });
  };

  const savePreset = () => {
    const ed = ALL_EDITIONS.find((e) => e.country === country);
    const label = draftName.trim() || `${ed?.flag ?? ""} ${ed?.label ?? country}`.trim();
    const next: EditionPreset = {
      id: `${country}-${[...sel].sort().join(".")}`,
      label,
      country,
      providerIds: [...sel],
    };
    // Same country+services twice is the same preset — replace, don't stack.
    set({ presets: [next, ...presets.filter((p) => p.id !== next.id)].slice(0, 8) });
    setNaming(false);
    setDraftName("");
  };

  const removePreset = (id: string) =>
    set({ presets: presets.filter((p) => p.id !== id) });

  const dirty =
    !presets.some(
      (p) => p.country === country && p.providerIds.length === sel.size &&
        p.providerIds.every((id) => sel.has(id)),
    );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: sp.s5, paddingTop: sp.s5 }}>
          <Ui size={fs.x2} weight="600">
            {t("onboarding.editionTitle")}
          </Ui>
          <Ui size={fs.sm} color={pal.muted} style={{ marginTop: sp.s2 }}>
            {t("onboarding.editionBody")}
          </Ui>
        </View>

        {/* Saved pairings */}
        {presets.length ? (
          <View style={{ marginTop: sp.s5 }}>
            <Ui size={fs.xs} weight="600" color={pal.muted} style={{ paddingHorizontal: sp.s5 }}>
              {t("onboarding.savedSetups").toUpperCase()}
            </Ui>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: sp.s5, gap: sp.s2, paddingTop: sp.s2 }}
            >
              {presets.map((p) => {
                const on = p.country === country && p.providerIds.length === sel.size &&
                  p.providerIds.every((id) => sel.has(id));
                return (
                  <Tactile key={p.id} onPress={() => applyPreset(p)} feedback="select">
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        borderRadius: radius.pill,
                        paddingLeft: 12,
                        paddingRight: 6,
                        paddingVertical: 7,
                        backgroundColor: on ? pal.ink : pal.surface,
                      }}
                    >
                      <Ui size={fs.sm} weight="600" color={on ? pal.bg : pal.inkSoft}>
                        {p.label}
                      </Ui>
                      <Ui size={fs.xs} color={on ? pal.bg : pal.subtle}>
                        {p.providerIds.length}
                      </Ui>
                      <Tactile onPress={() => removePreset(p.id)} hitSlop={10}>
                        <Ionicons name="close" size={13} color={on ? pal.bg : pal.subtle} />
                      </Tactile>
                    </View>
                  </Tactile>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Country */}
        <Ui
          size={fs.xs}
          weight="600"
          color={pal.muted}
          style={{ paddingHorizontal: sp.s5, marginTop: sp.s5 }}
        >
          {t("onboarding.countryTitle").toUpperCase()}
        </Ui>
        {/* Owner 08-03: seventeen countries in a horizontal rail was ~6 screens of
            sideways scrolling to reach one you can already name. The country is
            picked once and then rarely touched, so it collapses to a single line
            and opens as a WRAPPED grid — every country visible at once, no
            scrolling in either direction. */}
        {!picking ? (
          <Tactile
            onPress={() => setPicking(true)}
            feedback="tap"
            style={{ marginHorizontal: sp.s5, marginTop: sp.s2 }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: sp.s3,
                borderRadius: radius.md,
                backgroundColor: pal.surface,
                paddingHorizontal: sp.s4,
                paddingVertical: sp.s3 + 1,
              }}
            >
              <Ui size={fs.lg}>{here?.flag ?? "🌐"}</Ui>
              <Ui size={fs.md} weight="600" style={{ flex: 1 }}>
                {here?.label ?? country}
              </Ui>
              <Ui size={fs.sm} weight="600" color={brand.accent}>
                {t("onboarding.changeCountry")}
              </Ui>
              <Ionicons name="chevron-down" size={15} color={brand.accent} />
            </View>
          </Tactile>
        ) : (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: sp.s2,
              paddingHorizontal: sp.s5,
              paddingTop: sp.s2,
            }}
          >
            {ALL_EDITIONS.map((ed) => {
              const on = country === ed.country;
              return (
                <Tactile
                  key={ed.code}
                  onPress={() => {
                    set({ country: ed.country });
                    setPicking(false);
                  }}
                  feedback="select"
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      borderRadius: radius.pill,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      backgroundColor: on ? pal.ink : pal.surface,
                    }}
                  >
                    <Ui size={fs.sm}>{ed.flag}</Ui>
                    <Ui size={fs.sm} weight="600" color={on ? pal.bg : pal.inkSoft}>
                      {countryLabel(ed.code, ed.label)}
                    </Ui>
                  </View>
                </Tactile>
              );
            })}
          </View>
        )}

        {/* Services in that country */}
        {err ? (
          <View style={{ alignItems: "center", gap: sp.s3, paddingTop: sp.s6 }}>
            <Ui color={pal.muted}>{t("error.network")}</Ui>
            <Btn label={t("action.retry")} onPress={() => setGen((n) => n + 1)} />
          </View>
        ) : !services ? (
          <View style={{ paddingTop: sp.s5 }}>
            <SkeletonScreen kind="rows" count={4} />
          </View>
        ) : (
          <>
            <Ui
              size={fs.xs}
              weight="600"
              color={pal.muted}
              style={{ paddingHorizontal: sp.s5, marginTop: sp.s6 }}
            >
              {t("onboarding.servicesTitle").toUpperCase()}
            </Ui>
            {!services.length ? (
              <Ui size={fs.sm} color={pal.muted} style={{ paddingHorizontal: sp.s5, paddingTop: sp.s2 }}>
                {t("onboarding.servicesNone")}
              </Ui>
            ) : null}
            {GROUPS.map((g) =>
              grouped[g.label].length ? (
                <View key={g.label}>
                  <Ui
                    size={fs.sm}
                    weight="600"
                    color={pal.inkSoft}
                    style={{ paddingHorizontal: sp.s5, marginTop: sp.s4, marginBottom: sp.s2 }}
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
          </>
        )}

        {/* Save this pairing */}
        {services && sel.size && dirty ? (
          <View style={{ paddingHorizontal: sp.s5, marginTop: sp.s6, gap: sp.s2 }}>
            {naming ? (
              <>
                <TextInput
                  value={draftName}
                  onChangeText={setDraftName}
                  placeholder={t("onboarding.setupNamePlaceholder")}
                  placeholderTextColor={pal.subtle}
                  autoFocus
                  maxLength={24}
                  onSubmitEditing={savePreset}
                  style={{
                    backgroundColor: pal.card,
                    borderWidth: 1,
                    borderColor: pal.hairline2,
                    borderRadius: radius.sm,
                    color: pal.ink,
                    fontFamily: font.ui,
                    fontSize: fs.base,
                    paddingHorizontal: sp.s4,
                    paddingVertical: sp.s3,
                  }}
                />
                <Btn label={t("action.save")} onPress={savePreset} />
              </>
            ) : (
              <Tactile onPress={() => setNaming(true)} hitSlop={6} feedback="tap">
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="bookmark-outline" size={14} color={brand.accent} />
                  <Ui size={fs.sm} weight="600" color={brand.accent}>
                    {t("onboarding.saveSetup")}
                  </Ui>
                </View>
              </Tactile>
            )}
          </View>
        ) : null}
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

/* --------------------------------------------------------------- language */

/**
 * App language — the app's own words. Seeded from the device language on first
 * run; this screen is the override. Separate from the content language below it:
 * reading buttons in Korean and recognising a film by its Korean title are
 * different needs, and a user may want either without the other.
 */
function StepUILanguage({ onNext }: { onNext: () => void }) {
  const pal = usePalette();
  const { locale, set } = usePrefs();
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={{ paddingHorizontal: sp.s5, paddingTop: sp.s5 }}>
          <Ui size={fs.x2} weight="600">
            {t("onboarding.uiLanguageTitle")}
          </Ui>
          <Ui size={fs.sm} color={pal.muted} style={{ marginTop: sp.s2 }}>
            {t("onboarding.uiLanguageBody")}
          </Ui>
        </View>

        <View style={{ paddingHorizontal: sp.s5, paddingTop: sp.s5, gap: sp.s2 }}>
          {UI_LOCALES.map((l) => {
            const on = locale === l.code;
            return (
              <Tactile key={l.code} onPress={() => set({ locale: l.code })} feedback="select">
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: sp.s3,
                    backgroundColor: pal.surface,
                    borderRadius: radius.md,
                    paddingHorizontal: sp.s4,
                    paddingVertical: sp.s3 + 2,
                    borderWidth: 2,
                    borderColor: on ? brand.accent : "transparent",
                  }}
                >
                  <Ui size={fs.md} weight="600" style={{ flex: 1 }}>
                    {l.label}
                  </Ui>
                  {on ? <Ionicons name="checkmark-circle" size={19} color={brand.accent} /> : null}
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

/**
 * Content language — the THIRD axis (owner 2026-08-03), and deliberately not
 * tied to the country above it: someone in the US watching on US services may
 * still want films named in Korean.
 *
 * What it changes: the film's own release title, everywhere it is shown, and
 * what search can match. What it does NOT change: the app's own words — that is
 * the screen above (StepUILanguage).
 *
 * Titles come from TMDB's official release titles (migration 0121), never a
 * machine translation. Where a film has none, English stands.
 */
function StepLanguage({ onNext }: { onNext: () => void }) {
  const pal = usePalette();
  const { contentLang, set } = usePrefs();
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={{ paddingHorizontal: sp.s5, paddingTop: sp.s5 }}>
          <Ui size={fs.x2} weight="600">
            {t("onboarding.languageTitle")}
          </Ui>
          <Ui size={fs.sm} color={pal.muted} style={{ marginTop: sp.s2 }}>
            {t("onboarding.languageBody")}
          </Ui>
        </View>

        <View style={{ paddingHorizontal: sp.s5, paddingTop: sp.s5, gap: sp.s2 }}>
          {CONTENT_LANGS.map((l) => {
            const on = contentLang === l.code;
            return (
              <Tactile
                key={l.code}
                onPress={() => set({ contentLang: l.code as ContentLang })}
                feedback="select"
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: sp.s3,
                    backgroundColor: pal.surface,
                    borderRadius: radius.md,
                    paddingHorizontal: sp.s4,
                    paddingVertical: sp.s3 + 2,
                    borderWidth: 2,
                    borderColor: on ? brand.accent : "transparent",
                  }}
                >
                  <Ui size={fs.md} weight="600" style={{ flex: 1 }}>
                    {l.label}
                  </Ui>
                  {l.label !== l.english ? (
                    <Ui size={fs.sm} color={pal.muted}>
                      {l.english}
                    </Ui>
                  ) : null}
                  {on ? <Ionicons name="checkmark-circle" size={19} color={brand.accent} /> : null}
                </View>
              </Tactile>
            );
          })}
        </View>

        <Ui size={fs.xs} color={pal.subtle} style={{ paddingHorizontal: sp.s5, paddingTop: sp.s4 }}>
          {t("onboarding.languageNote")}
        </Ui>
      </ScrollView>
      <BottomBar>
        <GradientBtn label={t("action.continue")} onPress={onNext} />
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
  return (
    /* KeyboardAvoidingView + the scroll padding below: tapping into email used
       to open the keyboard right over the field (owner 2026-07-31 — the input
       was invisible under the keys). The panel sits high enough to stay clear,
       and the view lifts if it doesn't. */
    <KeyboardLift offset={100}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: sp.s5, paddingTop: sp.s5, paddingBottom: 360 }}
        {...formScrollProps}
      >
        <Ui size={fs.x2} weight="600">
          {t("auth.welcome")}
        </Ui>
        <Ui size={fs.sm} color={pal.muted} style={{ marginTop: sp.s2, marginBottom: sp.s5 }}>
          {t("auth.welcomeBody")}
        </Ui>
        <SignInPanel onDone={onDone} />
        <Tactile feedback="tap" onPress={onDone} hitSlop={8}>
          <View style={{ alignItems: "center", paddingVertical: sp.s4 }}>
            <Ui size={fs.sm} color={pal.muted} style={{ textDecorationLine: "underline" }}>
              {t("action.skip")}
            </Ui>
          </View>
        </Tactile>
      </ScrollView>
    </KeyboardLift>
  );
}


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
        <SkeletonScreen kind="rail" count={3} />
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

          {/* Connect shortcut (HANDOFF-커넥트 §2.1). Owner 07-30: this is the
              answer to "pick the films you've seen" for anyone who already has a
              history somewhere, so it says WHICH services by name and reads as a
              real alternative, not a footnote. Only the file importers are named
              — the OAuth connectors (TMDB/Trakt/Simkl) are still coming-soon and
              must not be advertised as a way in. */}
          <Tactile
            feedback="tap"
            onPress={() => router.push(CONNECT_HREF)}
            style={{ marginHorizontal: sp.s5, marginTop: sp.s5 }}
          >
            <View
              style={{
                backgroundColor: pal.card,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: brand.accent,
                paddingHorizontal: sp.s4,
                paddingVertical: sp.s3 + 2,
                flexDirection: "row",
                alignItems: "center",
                gap: sp.s3,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: radius.pill,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: `${brand.accent}1F`,
                }}
              >
                <Ionicons name="download-outline" size={18} color={brand.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Ui size={fs.md} weight="600">
                  {t("connect.entry.onboarding")}
                </Ui>
                <Ui size={fs.xs} color={pal.muted} style={{ marginTop: 1 }}>
                  {t("connect.entry.onboardingSub")}
                </Ui>
              </View>
              <Ionicons name="chevron-forward" size={16} color={brand.accent} />
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
