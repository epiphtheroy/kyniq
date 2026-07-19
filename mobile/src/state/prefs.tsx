// Edition + device preferences. Local-first (AsyncStorage), mirrored to user_prefs
// when signed in (push worker join key). Locale changes re-render via context.
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_EDITION, editionForCountry, type UILocale } from "../editions";
import { deviceRegion, setLocale } from "../i18n";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";

const KEY = "mt.prefs.v1";

export type Prefs = {
  country: string;
  locale: UILocale;
  providerIds: number[];
  onboarded: boolean;
  hideSeen: boolean;
  pushEnabled: boolean;
};

type PrefsCtx = Prefs & {
  ready: boolean;
  set: (patch: Partial<Prefs>) => void;
};

const defaults: Prefs = {
  country: DEFAULT_EDITION.country,
  locale: DEFAULT_EDITION.locale,
  providerIds: [],
  onboarded: false,
  hideSeen: false,
  pushEnabled: false,
};

const Ctx = createContext<PrefsCtx>({ ...defaults, ready: false, set: () => {} });

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(defaults);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const saved = { ...defaults, ...(JSON.parse(raw) as Partial<Prefs>) };
          setLocale(saved.locale);
          setPrefs(saved);
        } else {
          // First run: detect the storefront country, map to a live edition.
          const ed = editionForCountry(deviceRegion());
          setLocale(ed.locale);
          setPrefs({ ...defaults, country: ed.country, locale: ed.locale });
        }
      } catch {
        // fall through with defaults
      }
      setReady(true);
    })();
  }, []);

  const set = (patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      if (patch.locale) setLocale(patch.locale);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      // Mirror to server when a session exists (no-op otherwise).
      api
        .syncPrefs({
          country: next.country,
          locale: next.locale,
          providerIds: next.providerIds,
          pushEnabled: next.pushEnabled,
        })
        .catch(() => {});
      return next;
    });
  };

  // On sign-in, push current prefs up once so the worker has a row.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        setPrefs((p) => {
          api
            .syncPrefs({
              country: p.country,
              locale: p.locale,
              providerIds: p.providerIds,
              pushEnabled: p.pushEnabled,
            })
            .catch(() => {});
          return p;
        });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo(() => ({ ...prefs, ready, set }), [prefs, ready]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): PrefsCtx {
  return useContext(Ctx);
}
