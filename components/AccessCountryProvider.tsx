"use client";

/**
 * AccessCountryProvider — lifts the "my country" state out of WatchProviders (DOC_0 §4.2 step 0)
 * so the JustWatch band and the AccessEnrichment section stay in sync.
 * Persists to localStorage("mt_country") — same key WatchProviders has always used.
 * Consumers that render OUTSIDE a provider keep working: useAccessCountry() returns null
 * and they fall back to their own internal state.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type AccessCountryCtx = { country: string; setCountry: (cc: string) => void };

const Ctx = createContext<AccessCountryCtx | null>(null);

export function useAccessCountry(): AccessCountryCtx | null {
  return useContext(Ctx);
}

export default function AccessCountryProvider({ children, initial = "US" }: { children: ReactNode; initial?: string }) {
  const [country, setCountryState] = useState<string>(initial);

  useEffect(() => {
    let cc = "";
    try { cc = localStorage.getItem("mt_country") || ""; } catch {}
    if (!cc) {
      try { cc = (new Intl.DateTimeFormat().resolvedOptions().locale.split("-")[1] || "").toUpperCase(); } catch {}
    }
    if (cc && /^[A-Z]{2}$/.test(cc)) setCountryState(cc);
  }, []);

  const setCountry = useCallback((cc: string) => {
    setCountryState(cc);
    try { localStorage.setItem("mt_country", cc); } catch {}
  }, []);

  return <Ctx.Provider value={{ country, setCountry }}>{children}</Ctx.Provider>;
}
