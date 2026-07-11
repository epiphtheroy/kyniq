"use client";

/**
 * ProviderPicker — the "My services" popover for the Screener. Loads the given
 * country's streaming providers (provider_directory RPC) and lets the user pick
 * which they subscribe to; the parent persists {country, providers} to
 * localStorage(mt-watch-prefs) and feeds them to cinecodex_ranked. Logos via
 * TMDB (availability data licensed through JustWatch — attribution in the page).
 */
import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const LOGO = "https://image.tmdb.org/t/p/w45";

export type Prov = { provider_id: number; provider_name: string; logo_path: string | null; n: number };

export default function ProviderPicker({
  country, countries, selected, onChange, onCountry,
}: {
  country: string;
  countries: { code: string; label: string }[];
  selected: number[];
  onChange: (ids: number[]) => void;
  onCountry: (cc: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [provs, setProvs] = useState<Prov[]>([]);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    sb.rpc("provider_directory", { p_country: country }).then(({ data }) => {
      if (alive) { setProvs((data as Prov[]) ?? []); setLoading(false); }
    });
    return () => { alive = false; };
  }, [country]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const toggle = (id: number) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const selNames = provs.filter((p) => selected.includes(p.provider_id)).map((p) => p.provider_name);

  return (
    <div className="scr-pp" ref={box}>
      <button type="button" className={`scr-ctlbtn${selected.length ? " on" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {selected.length ? `My services · ${selected.length}` : "My services"} <span aria-hidden>▾</span>
      </button>
      {open ? (
        <div className="scr-pp-pop" role="dialog" aria-label="Choose your streaming services">
          <div className="scr-pp-head">
            <label className="scr-pp-cc">
              Country
              <select value={country} onChange={(e) => onCountry(e.target.value)}>
                {countries.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </label>
            {selected.length ? <button type="button" className="scr-pp-clear" onClick={() => onChange([])}>Clear</button> : null}
          </div>
          {selNames.length ? <p className="scr-pp-sel">{selNames.join(" · ")}</p> : <p className="scr-pp-hint">Pick the services you pay for — the ranking narrows to what you can stream now.</p>}
          {loading ? <p className="scr-pp-empty">Loading…</p> : provs.length === 0 ? (
            <p className="scr-pp-empty">No provider data for this country.</p>
          ) : (
            <div className="scr-pp-grid">
              {provs.map((p) => (
                <button key={p.provider_id} type="button"
                  className={`scr-pp-prov${selected.includes(p.provider_id) ? " on" : ""}`}
                  onClick={() => toggle(p.provider_id)} title={`${p.provider_name} · ${p.n} films`}>
                  {p.logo_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`${LOGO}${p.logo_path}`} alt={p.provider_name} width={34} height={34} loading="lazy" />
                  ) : <span className="scr-pp-prov__txt">{p.provider_name}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
