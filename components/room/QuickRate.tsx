"use client";
/** Quick log bar — search → one star-tap logs the film (rating implies seen).
 *  Shared by Desk and Ledger (same mutation contract: caller wires onRate to
 *  useRoomActions.doRate). Debounced public film_search RPC. */
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IMG } from "@/lib/room/format";
import { STR } from "./strings";
import Stars from "./Stars";

export type QuickHit = { slug: string; title: string; year: number | null; poster_path: string | null; director: string | null };

export default function QuickRate({ onRate, placeholder }: {
  onRate: (f: QuickHit, v: number) => void;
  placeholder?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<QuickHit[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (!term) { setHits([]); setBusy(false); return; }
    let alive = true;
    setBusy(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("film_search", { p_q: term, p_limit: 6 });
      if (!alive) return;
      // room = Tier-1 only: catalog films have no cinecodex scores and their
      // /room/film pages 404 (film_search v2 returns them, flagged)
      setHits(((data as (QuickHit & { is_catalog?: boolean })[] | null) ?? []).filter((h) => h.is_catalog !== true));
      setBusy(false);
    }, 220);
    return () => { alive = false; clearTimeout(t); };
  }, [q, supabase]);

  return (
    <div className="qrate">
      <div className="qin">
        <i className="ti ti-search" style={{ color: "var(--sub)" }} />
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder ?? STR.quickRate.placeholder} />
      </div>
      {q.trim() ? (
        <div className="qdrop">
          {busy ? <div className="qhit"><span className="qt" style={{ color: "var(--sub)" }}>{STR.quickRate.searching}</span></div>
            : hits.length ? hits.map((h) => (
              <div className="qhit" key={h.slug}>
                <span className="qpo" style={h.poster_path ? { backgroundImage: `url(${IMG}${h.poster_path})` } : {}} />
                <span className="qt">{h.title}<small>{h.director ?? ""}{h.year ? ` · ${h.year}` : ""}</small></span>
                <Stars value={0} onPick={(v) => { onRate(h, v); setQ(""); }} />
              </div>
            )) : <div className="qhit"><span className="qt" style={{ color: "var(--sub)" }}>{STR.quickRate.empty}</span></div>}
        </div>
      ) : null}
    </div>
  );
}
