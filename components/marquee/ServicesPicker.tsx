"use client";

/**
 * ServicesPicker — the "My services" popover for The Marquee top bar. A toggle
 * button opens a floating panel of the country's providers, grouped by how you
 * access them: Subscription / Free / Rent & Buy (YouTube, Apple, Amazon…). The
 * parent owns the selected id list + persistence; onServices lifts the loaded
 * list so the parent can tell which selections are rent stores.
 */
import { useEffect, useRef, useState } from "react";
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

const GROUPS: { key: Service["label"]; title: string }[] = [
  { key: "subscription", title: "Subscription" },
  { key: "free", title: "Free" },
  { key: "rent", title: "Rent & Buy" },
];

export default function ServicesPicker({
  country, selected, onChange, onServices,
}: {
  country: string;
  selected: number[];
  onChange: (ids: number[]) => void;
  onServices?: (svcs: Service[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [svcs, setSvcs] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="mq-pop" ref={box}>
      <button type="button" className={`mq-popbtn${selected.length ? " on" : ""}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {selected.length ? `My services · ${selected.length}` : "My services"} <span aria-hidden>▾</span>
      </button>
      {open ? (
        <div className="mq-pop-panel mq-pop-panel--wide" role="dialog" aria-label="Choose your services">
          <div className="mq-pop-head">
            <span>My services{selected.length ? ` · ${selected.length}` : ""}</span>
            {selected.length ? <button type="button" className="mq-pop-clear" onClick={() => onChange([])}>Clear</button> : null}
          </div>
          {loading ? (
            <p className="mq-pop-empty">Loading…</p>
          ) : svcs.length === 0 ? (
            <p className="mq-pop-empty">No provider data for this country.</p>
          ) : (
            GROUPS.map((g) => {
              const items = svcs.filter((s) => s.label === g.key);
              if (items.length === 0) return null;
              return (
                <div className="mq-svc-group" key={g.key}>
                  <div className={`mq-svc-gtitle mq-svc-gtitle--${g.key}`}>{g.title}</div>
                  <div className="mq-svc-grid">
                    {items.map((s) => {
                      const on = selected.includes(s.provider_id);
                      return (
                        <button key={s.provider_id} type="button" className={`mq-svc-chip${on ? " on" : ""}`}
                          onClick={() => toggle(s.provider_id)} title={`${s.provider_name}${s.library ? " · library card" : ""} · ${s.n} films`}>
                          {s.logo_path ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`${LOGO}${s.logo_path}`} alt="" width={20} height={20} loading="lazy" />
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
      ) : null}
    </div>
  );
}
