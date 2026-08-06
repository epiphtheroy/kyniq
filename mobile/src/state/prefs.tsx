// Edition + device preferences. Local-first (AsyncStorage), mirrored to user_prefs
// when signed in (push worker join key). Locale changes re-render via context.
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_CONTENT_LANG,
  DEFAULT_EDITION,
  UI_LOCALE,
  editionForCountry,
  isContentLang,
  isUILocale,
  type ContentLang,
  type UILocale,
} from "../editions";
import { deviceLocale, deviceRegion, setLocale } from "../i18n";
import { loadUIOverrides, resetUIOverrides } from "../i18n/overrides";
import { api } from "../lib/api";
import { supabase } from "../lib/supabase";

const KEY = "mt.prefs.v1";

/** A saved country + services pairing (owner 08-03: "저장해서 선택할 수 있게").
 *  One tap swaps both — home vs. travelling, or two households on one account. */
export type EditionPreset = {
  id: string;
  label: string;
  country: string;
  providerIds: number[];
};

export type Prefs = {
  country: string;
  locale: UILocale;
  /** What language films are NAMED in. Seeded from the UI language on first run
   *  but independent after that — a user can read English chrome and still want
   *  Korean titles. Drives the TMDB title projection and the multilingual search
   *  RPC (migration 0121). */
  contentLang: ContentLang;
  /** Saved country+services pairings, most recently used first. */
  presets: EditionPreset[];
  providerIds: number[];
  onboarded: boolean;
  hideSeen: boolean;
  pushEnabled: boolean;
  /** Opt-in taste weighting on Tonight (owner 07-30). Local only — the server
   *  ranking is unchanged; this swaps the deck source to the personal one. */
  taste: boolean;
};

type PrefsCtx = Prefs & {
  ready: boolean;
  set: (patch: Partial<Prefs>) => void;
};

const defaults: Prefs = {
  country: DEFAULT_EDITION.country,
  locale: UI_LOCALE,
  contentLang: DEFAULT_CONTENT_LANG,
  presets: [],
  providerIds: [],
  onboarded: false,
  hideSeen: false,
  pushEnabled: false,
  taste: false,
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
          const parsed = JSON.parse(raw) as Partial<Prefs>;
          const saved = {
            ...defaults,
            ...parsed,
            // Stored value wins (an explicit Settings choice), otherwise follow
            // the device. Unknown codes fall back rather than reach a dictionary
            // we do not ship.
            locale: isUILocale(parsed.locale) ? parsed.locale : deviceLocale(),
            // An unknown code would be handed to the RPC as a column suffix that
            // does not exist — fall back rather than trust storage.
            contentLang: isContentLang(parsed.contentLang) ? parsed.contentLang : DEFAULT_CONTENT_LANG,
            presets: Array.isArray(parsed.presets) ? parsed.presets : [],
          };
          setLocale(saved.locale);
          void loadUIOverrides(saved.locale);
          setPrefs(saved);
        } else {
          // First run: storefront country for availability, device language for
          // chrome. Content language follows the UI unless the user splits them.
          const ed = editionForCountry(deviceRegion());
          const loc = deviceLocale();
          setLocale(loc);
          void loadUIOverrides(loc);
          setPrefs({
            ...defaults,
            country: ed.country,
            locale: loc,
            contentLang: isContentLang(loc) ? loc : DEFAULT_CONTENT_LANG,
          });
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
      if (patch.locale) {
        setLocale(patch.locale);
        // A language change needs its own override fetch.
        resetUIOverrides();
        void loadUIOverrides(patch.locale);
      }
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
