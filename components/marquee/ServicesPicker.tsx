"use client";

/**
 * ServicesPicker — the sidebar "My services" multi-select for The Marquee.
 * Loads the country's providers via wtw_services() and groups them by how you
 * access them: Subscription / Free / Rent & Buy (YouTube, Apple, Amazon…). Each
 * provider is a toggle; the parent owns the selected id list and persistence.
 */
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const LOGO = "https://image.tmdb.org/t/p/w45";

export type Service = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  kinds: string[];
  label: "subscription" | "free" | "rent";
  library: boolean;
  n: number;
};

const GROUPS: { key: Service["label"]; title: string; hint: string }[] = [
  { key: "subscription", title: "Subscription", hint: "Services you pay a monthly fee for" },
  { key: "free", title: "Free", hint: "Free / ad-supported / library" },
  { key: "rent", title: "Rent & Buy", hint: "Pay per title — YouTube, Apple, Amazon…" },
];

export default function ServicesPicker({
  country, selected, onChange, onServices,
}: {
  country: string;
  selected: number[];
  onChange: (ids: number[]) => void;
  onServices?: (svcs: Service[]) => void;
}) {
  const [svcs, setSvcs] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    sb.rpc("wtw_services", { p_country: country }).then(({ data }) => {
      if (!alive) return;
      const list = (data as Service[]) ?? [];
      setSvcs(list); setLoading(false);
      onServices?.(list);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="mq-svc">
      <div className="mq-svc-head">
        <span>My services{selected.length ? ` · ${selected.length}` : ""}</span>
        {selected.length ? <button type="button" className="mq-svc-clear" onClick={() => onChange([])}>Clear</button> : null}
      </div>
      {loading ? (
        <p className="mq-svc-empty">Loading…</p>
      ) : svcs.length === 0 ? (
        <p className="mq-svc-empty">No provider data for this country.</p>
      ) : (
        GROUPS.map((g) => {
          const items = svcs.filter((s) => s.label === g.key);
          if (items.length === 0) return null;
          return (
            <div className="mq-svc-group" key={g.key}>
              <div className={`mq-svc-gtitle mq-svc-gtitle--${g.key}`} title={g.hint}>{g.title}</div>
              <div className="mq-svc-grid">
                {items.map((s) => {
                  const on = selected.includes(s.provider_id);
                  return (
                    <button
                      key={s.provider_id}
                      type="button"
                      className={`mq-svc-chip${on ? " on" : ""}`}
                      onClick={() => toggle(s.provider_id)}
                      title={`${s.provider_name}${s.library ? " · library card" : ""} · ${s.n} films`}
                    >
                      {s.logo_path ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`${LOGO}${s.logo_path}`} alt="" width={22} height={22} loading="lazy" />
                      ) : <span className="mq-svc-dot" aria-hidden />}
                      <span className="mq-svc-name">{s.provider_name}</span>
                      {s.library ? <span className="mq-svc-lib">lib</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
