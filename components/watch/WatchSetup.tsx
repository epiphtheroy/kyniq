"use client";

/**
 * WatchSetup — "where do you watch?" as ONE surface: the country, the services
 * that exist in it, and the saved pairings that swap both in a click.
 * (Port of the app's onboarding StepEdition — mobile/app/onboarding.tsx.)
 *
 * The app learned this the hard way: country and services were two consecutive
 * screens, but the second one's entire content is a function of the first — pick
 * Korea after picking the US and you were looking at a Korean grid on a page you
 * had already passed. So the country sits on top, the grid reloads under it, and
 * any service that does not exist in the new country is dropped. Silently,
 * because keeping an invisible selection is how a viewer ends up filtered by a
 * service they cannot see.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useWatchPrefs } from "@/components/WatchPrefsProvider";
import { flagOf, sameSetup, setupId, type WatchSetup as Setup } from "@/lib/watch-prefs";
import type { Service } from "@/components/marquee/ServicesPicker";
import "./watch-setup.css";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const LOGO = "https://image.tmdb.org/t/p/w45";
const MAX_SETUPS = 8;

const GROUPS: { key: Service["label"]; title: string }[] = [
  { key: "subscription", title: "Subscription" },
  { key: "free", title: "Free" },
  { key: "rent", title: "Rent & Buy" },
];

type CountryRow = { code: string; n_films: number; n_prov: number };

export default function WatchSetup() {
  const { country, providers, setups, ready, set } = useWatchPrefs();
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [services, setServices] = useState<Service[] | null>(null);
  const [err, setErr] = useState(false);
  const [gen, setGen] = useState(0);
  const [naming, setNaming] = useState(false);
  const [draft, setDraft] = useState("");
  // Intl.DisplayNames is browser-vs-Node divergent, so country names are resolved
  // after mount only — never during the render the server also performs.
  const [names, setNames] = useState<Intl.DisplayNames | null>(null);
  const nameInput = useRef<HTMLInputElement | null>(null);
  // The prune below runs inside an async response; read the CURRENT selection
  // through a ref so a toggle made while the country's services were in flight
  // isn't silently reverted by a stale closure.
  const providersRef = useRef(providers);
  providersRef.current = providers;

  useEffect(() => {
    try { setNames(new Intl.DisplayNames(["en"], { type: "region" })); } catch { /* code only */ }
    sb.rpc("wtw_countries").then(({ data }) => setCountries((data as CountryRow[] | null) ?? []));
  }, []);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    setServices(null);
    setErr(false);
    sb.rpc("wtw_services", { p_country: country }).then(({ data, error }) => {
      if (!alive) return;
      if (error) { setErr(true); return; }
      const list = (data as Service[] | null) ?? [];
      setServices(list);
      // Prune selections the new country doesn't carry — a provider id is TMDB's
      // and therefore global, so an unpruned set silently narrows every "on my
      // services" query to nothing after a country switch. An EMPTY list is not
      // evidence of that: a country with no provider data would otherwise wipe a
      // selection the viewer will want back the moment they switch home.
      if (!list.length) return;
      const live = new Set(list.map((s) => s.provider_id));
      const mine = providersRef.current;
      const kept = mine.filter((id) => live.has(id));
      if (kept.length !== mine.length) set({ providers: kept });
    });
    return () => { alive = false; };
    // `providers` is deliberately absent: this effect reacts to the COUNTRY, and
    // re-running it on every service toggle would refetch the whole grid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, ready, gen]);

  useEffect(() => { if (naming) nameInput.current?.focus(); }, [naming]);

  const cname = (cc: string) => {
    try { return names?.of(cc.toUpperCase()) ?? cc.toUpperCase(); } catch { return cc.toUpperCase(); }
  };

  const grouped = useMemo(() => {
    const g: Record<string, Service[]> = { subscription: [], free: [], rent: [] };
    for (const s of services ?? []) (g[s.label] ?? g.rent).push(s);
    return g;
  }, [services]);

  const toggle = (id: number) =>
    set({ providers: providers.includes(id) ? providers.filter((x) => x !== id) : [...providers, id] });

  const applySetup = (s: Setup) => set({ country: s.country, providers: s.providers });

  const saveSetup = () => {
    const label = draft.trim() || `${flagOf(country)} ${cname(country)}`.trim();
    const next: Setup = { id: setupId(country, providers), label, country, providers: [...providers] };
    set({ setups: [next, ...setups.filter((s) => s.id !== next.id)].slice(0, MAX_SETUPS) });
    setNaming(false);
    setDraft("");
  };

  const removeSetup = (id: string) => set({ setups: setups.filter((s) => s.id !== id) });

  const saved = setups.some((s) => sameSetup(s, country, providers));
  const current = countries.find((c) => c.code === country);

  return (
    <div className="wset">
      {/* Saved pairings — home vs. travelling, one click apart. */}
      {setups.length ? (
        <div className="wset-setups">
          {setups.map((s) => {
            const on = sameSetup(s, country, providers);
            return (
              <span key={s.id} className={`wset-chip wset-chip--setup${on ? " on" : ""}`}>
                <button type="button" onClick={() => applySetup(s)}>
                  {s.label} <i>{s.providers.length}</i>
                </button>
                <button type="button" className="wset-chip-x" aria-label={`Delete ${s.label}`} onClick={() => removeSetup(s.id)}>×</button>
              </span>
            );
          })}
        </div>
      ) : null}

      <div className="wset-country">
        <label className="wset-lab" htmlFor="wset-cc">Country</label>
        <select
          id="wset-cc"
          className="wset-select"
          value={country}
          onChange={(e) => set({ country: e.target.value })}
        >
          {countries.length ? (
            countries.map((c) => (
              <option key={c.code} value={c.code}>
                {flagOf(c.code)} {cname(c.code)} ({c.n_films.toLocaleString("en-US")} films)
              </option>
            ))
          ) : (
            <option value={country}>{flagOf(country)} {country}</option>
          )}
        </select>
        <span className="wset-note">
          Availability only — this never changes the language you read in.
        </span>
      </div>

      <div className="wset-svc">
        <div className="wset-lab wset-lab--row">
          <span>My services{providers.length ? ` · ${providers.length}` : ""}</span>
          {providers.length ? (
            <button type="button" className="wset-clear" onClick={() => set({ providers: [] })}>Clear</button>
          ) : null}
        </div>

        {err ? (
          <p className="wset-empty">
            Couldn&apos;t load services. <button type="button" className="wset-clear" onClick={() => setGen((n) => n + 1)}>Retry</button>
          </p>
        ) : !services ? (
          <p className="wset-empty">Loading services…</p>
        ) : !services.length ? (
          <p className="wset-empty">No provider data for {cname(country)} yet — pick another country, or leave this empty to rank the whole catalogue.</p>
        ) : (
          GROUPS.map((g) => {
            const items = grouped[g.key];
            if (!items.length) return null;
            return (
              <div className="wset-group" key={g.key}>
                <div className={`wset-gtitle wset-gtitle--${g.key}`}>{g.title}</div>
                <div className="wset-grid">
                  {items.map((s) => {
                    const on = providers.includes(s.provider_id);
                    return (
                      <button
                        key={s.provider_id}
                        type="button"
                        className={`wset-chip${on ? " on" : ""}`}
                        aria-pressed={on}
                        onClick={() => toggle(s.provider_id)}
                        title={`${s.provider_name}${s.library ? " · library card" : ""} · ${s.n} films`}
                      >
                        {s.logo_path ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`${LOGO}${s.logo_path}`} alt="" width={18} height={18} loading="lazy" />
                        ) : <span className="wset-dot" aria-hidden />}
                        <span>{s.provider_name}</span>
                        {s.library ? <i className="wset-lib">lib</i> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Save this pairing — only when there is something to save that isn't saved. */}
      {providers.length && !saved ? (
        <div className="wset-save">
          {naming ? (
            <>
              <input
                ref={nameInput}
                className="wset-input"
                value={draft}
                maxLength={24}
                placeholder={`e.g. ${cname(country)} at home`}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveSetup(); if (e.key === "Escape") setNaming(false); }}
              />
              <button type="button" className="wset-savebtn" onClick={saveSetup}>Save</button>
              <button type="button" className="wset-clear" onClick={() => setNaming(false)}>Cancel</button>
            </>
          ) : (
            <button type="button" className="wset-clear" onClick={() => setNaming(true)}>
              ＋ Save this setup ({flagOf(country)} {cname(country)} · {providers.length})
            </button>
          )}
        </div>
      ) : null}

      <p className="wset-sum">
        {providers.length
          ? <>What to Watch and the Screener now rank <b>what you can actually watch</b> in {flagOf(country)} {cname(country)}{current ? ` (${current.n_films.toLocaleString("en-US")} films with availability data)` : ""}.</>
          : <>No services picked — ranked surfaces show the whole catalogue. Pick the ones you pay for and they narrow to what you can watch tonight.</>}
      </p>
    </div>
  );
}
