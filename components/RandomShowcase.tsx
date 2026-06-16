"use client";

/** Homepage "a reading, at random" — shows real take content inline with a shuffle.
 *  TVTropes-style: lead with content, not a link. Reads random_reading() (anon). */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";

const REG: Record<string, [string, string]> = {
  formal: ["Formal", "#5B8FB9"], semiotic: ["Semiotic", "#B8860B"],
  psychoanalytic: ["Psychoanalytic", "#A8434F"], ideological: ["Ideological", "#C0392B"],
  politico_economic: ["Politico-economic", "#2E7D5B"], philosophical: ["Philosophical", "#7E57C2"],
  existential: ["Existential", "#546E7A"], mythic: ["Mythic", "#A9743B"],
  genealogical: ["Film-historical", "#2E86C1"], reception: ["Reception", "#159A8A"],
};

type Reading = {
  take_id: string; rationale: string; register: string | null;
  figure_label: string; figure_slug: string; film_title: string; film_slug: string;
  mt_title: string | null; mt_slug: string | null;
};

function sb() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

export default function RandomShowcase() {
  const [r, setR] = useState<Reading | null>(null);
  const [loading, setLoading] = useState(true);

  const shuffle = useCallback(async () => {
    setLoading(true);
    const { data } = await sb().rpc("random_reading");
    const row = Array.isArray(data) ? (data[0] as Reading | undefined) : null;
    setR(row ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { shuffle(); }, [shuffle]);

  const reg = r?.register ? REG[r.register] : undefined;

  return (
    <div className="rs">
      <div className="rs-head">
        <span className="rs-label">A reading, at random</span>
        <button type="button" className="rs-shuffle" onClick={shuffle} disabled={loading} aria-label="Shuffle">
          🎲 {loading ? "…" : "Shuffle"}
        </button>
      </div>
      {r ? (
        <div className="rs-card">
          <div className="rs-meta">
            {reg ? <span className="rs-reg" style={{ background: reg[1] }}>{reg[0]}</span> : null}
            <Link href={`/film/${r.film_slug}/figure/${r.figure_slug}`} className="rs-fig">{r.figure_label}</Link>
            <span className="rs-film"> · {r.film_title}</span>
          </div>
          <Link href={`/film/${r.film_slug}/figure/${r.figure_slug}#t-${r.take_id}`} className="rs-body">
            {r.rationale.length > 300 ? r.rationale.slice(0, 300).trim() + "…" : r.rationale}
          </Link>
          {r.mt_title && r.mt_slug ? (
            <div className="rs-hub">→ <Link href={`/take/${r.mt_slug}`}>{r.mt_title}</Link></div>
          ) : null}
        </div>
      ) : (
        <div className="rs-card rs-empty">{loading ? "Pulling a reading…" : "No readings yet."}</div>
      )}
    </div>
  );
}
