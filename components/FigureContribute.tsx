"use client";

/**
 * FigureContribute — the "add your take" layer under a figure (design §7.1).
 * Login-gated. A take requires a meta-take (the hub it converges on), a critical
 * register (the route in), and a rationale. Submitted takes enter the DB as
 * status='in_review' source='human' (the takes INSERT policy enforces this), so
 * they're queued for review, not public immediately. The contributor sees their
 * own takes (pending + published) here via their authenticated session.
 */

import { useState, useEffect, useCallback } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { getUserSafe } from "@/lib/supabase/safeAuth";

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const REGISTERS: [string, string][] = [
  ["formal", "Formal — framing, editing, sound, colour, rhythm"],
  ["semiotic", "Semiotic — motif, metaphor, what it stands for"],
  ["psychoanalytic", "Psychoanalytic — desire, the unconscious, the gaze"],
  ["ideological", "Ideological — power, representation, whose view"],
  ["politico_economic", "Politico-economic — class, labour, capital, institutions"],
  ["philosophical", "Philosophical — being, perception, ethics"],
  ["existential", "Existential — death, freedom, mood, the felt situation"],
  ["mythic", "Mythic — myth, ritual, archetype"],
  ["genealogical", "Film-historical — lineage, influence, genre history"],
  ["reception", "Reception — what critics/scholars actually argued"],
];

type MetaTake = { id: string; title: string; laconic: string | null; family: string | null };
type MyTake = { id: string; rationale: string | null; register: string | null; status: string; meta_take_id: string | null };

export default function FigureContribute({
  figureId,
  metaTakes,
}: {
  figureId: string;
  metaTakes: MetaTake[];
}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [mine, setMine] = useState<MyTake[]>([]);

  const [metaTakeId, setMetaTakeId] = useState("");
  const [register, setRegister] = useState("");
  const [rationale, setRationale] = useState("");
  const [posting, setPosting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mtTitle = useCallback(
    (id: string | null) => metaTakes.find((m) => m.id === id)?.title ?? "—",
    [metaTakes]
  );

  const fetchMine = useCallback(async (uid: string) => {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("takes")
      .select("id, rationale, register, status, meta_take_id")
      .eq("figure_id", figureId)
      .eq("author_id", uid)
      .order("created_at", { ascending: false });
    setMine((data as MyTake[]) ?? []);
  }, [figureId]);

  useEffect(() => {
    (async () => {
      const supabase = getSupabase();
      const user = await getUserSafe(supabase);
      if (user) { setUserId(user.id); await fetchMine(user.id); }
      setAuthChecked(true);
    })();
  }, [fetchMine]);

  // group meta-takes by theory family for the picker
  const groups = (() => {
    const m = new Map<string, MetaTake[]>();
    for (const mt of metaTakes) { const k = mt.family ?? "Other"; const a = m.get(k) ?? []; a.push(mt); m.set(k, a); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  })();

  const selected = metaTakes.find((m) => m.id === metaTakeId) ?? null;
  const ready = metaTakeId && register && rationale.trim().length >= 20;

  async function submit() {
    if (!userId || !ready || posting) return;
    setPosting(true); setError(null);
    const supabase = getSupabase();
    const { error: e } = await supabase.from("takes").insert({
      figure_id: figureId,
      author_id: userId,
      meta_take_id: metaTakeId,
      register,
      rationale: rationale.trim(),
      source: "human",
      status: "published",
    });
    setPosting(false);
    if (e) { setError(e.message); return; }
    setDone(true);
    setMetaTakeId(""); setRegister(""); setRationale("");
    fetchMine(userId);
  }

  if (!authChecked) return null;

  if (!userId) {
    return (
      <div className="fig-cta">
        <strong>Have a take on this figure?</strong> A take is one critical reading,
        linked to the meta take it converges on.{" "}
        <a className="fig-cta__link" href="/login">Log in</a> to add yours.
      </div>
    );
  }

  return (
    <div className="fig-contrib">
      {mine.length > 0 && (
        <div className="fig-mine">
          <div className="mt-label">Your takes on this figure</div>
          {mine.map((t) => (
            <div key={t.id} className="fig-mine__row">
              <span className={`fig-status fig-status--${t.status === "published" ? "live" : "pending"}`}>
                {t.status === "published" ? "Published" : "In review"}
              </span>
              <span className="fig-mine__mt">→ {mtTitle(t.meta_take_id)}</span>
              {t.rationale ? <div className="fig-mine__rat">{t.rationale}</div> : null}
            </div>
          ))}
        </div>
      )}

      <div className="fig-form">
        <div className="mt-label">Add your take</div>

        {done && (
          <p className="fig-form__ok">
            Thanks — your take is now live on this figure and its meta take.
          </p>
        )}

        <label className="fig-form__lbl">Meta take <span className="req">(required)</span></label>
        <select className="fig-form__sel" value={metaTakeId} onChange={(e) => { setMetaTakeId(e.target.value); setDone(false); }}>
          <option value="">Which recurring reading does this converge on?</option>
          {groups.map(([fam, list]) => (
            <optgroup key={fam} label={fam}>
              {list.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}{m.laconic ? ` — ${m.laconic.slice(0, 60)}` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {selected?.laconic ? <p className="fig-form__hint">{selected.laconic}</p> : null}

        <label className="fig-form__lbl">Register <span className="req">(required)</span></label>
        <select className="fig-form__sel" value={register} onChange={(e) => { setRegister(e.target.value); setDone(false); }}>
          <option value="">The critical route in — the lens, not the conclusion</option>
          {REGISTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>

        <label className="fig-form__lbl">Your reading <span className="req">(required)</span></label>
        <textarea
          className="fig-form__ta"
          rows={5}
          placeholder="Start from what is actually on screen, then read it. ~60 words."
          value={rationale}
          onChange={(e) => { setRationale(e.target.value); setDone(false); }}
        />
        <div className="fig-form__foot">
          <span className="fig-form__count">{rationale.trim().length} chars{rationale.trim().length < 20 ? " (min 20)" : ""}</span>
          <button type="button" className="fig-form__btn" disabled={!ready || posting} onClick={submit}>
            {posting ? "Publishing…" : "Publish take"}
          </button>
        </div>
        {error ? <p className="fig-form__err">Could not submit: {error}</p> : null}
      </div>
    </div>
  );
}
