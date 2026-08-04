"use client";

/**
 * TitleLanguage — the third axis (the app's onboarding StepLanguage), and
 * deliberately not tied to the country above it: someone in the US watching on
 * US services may still want films named in Korean.
 *
 * What it changes: the film's own release title on the surfaces that list films.
 * What it does NOT change: the site's own words. Titles come from TMDB's official
 * release titles (migration 0121), never a machine translation — where a film has
 * none, English stands.
 */
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useWatchPrefs } from "@/components/WatchPrefsProvider";
import { CONTENT_LANGS, type ContentLang } from "@/lib/watch-prefs";
import "./watch-setup.css";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

type Sample = { title: string; loc: string };

export default function TitleLanguage() {
  const { contentLang, ready, set } = useWatchPrefs();
  const [samples, setSamples] = useState<Sample[]>([]);

  // Three real films in the chosen language — the setting proves itself rather
  // than promising. English needs no proof and costs no request.
  useEffect(() => {
    if (!ready || contentLang === "en") { setSamples([]); return; }
    let alive = true;
    const col = `title_${contentLang}`; // a fixed enum, never user input
    sb.from("films")
      .select(`title, ${col}`)
      .not(col, "is", null)
      .limit(3)
      .then(({ data, error }) => {
        if (!alive || error || !data) return;
        const rows = data as unknown as Record<string, string | null>[];
        setSamples(
          rows
            .map((r) => ({ title: String(r.title ?? ""), loc: String(r[col] ?? "") }))
            .filter((s) => s.title && s.loc),
        );
      });
    return () => { alive = false; };
  }, [contentLang, ready]);

  return (
    <div className="wset">
      <div className="wset-langs">
        {CONTENT_LANGS.map((l) => {
          const on = contentLang === l.code;
          return (
            <button
              key={l.code}
              type="button"
              className={`wset-lang${on ? " on" : ""}`}
              aria-pressed={on}
              onClick={() => set({ contentLang: l.code as ContentLang })}
            >
              <span className="wset-lang-n">{l.label}</span>
              {l.label !== l.english ? <span className="wset-lang-e">{l.english}</span> : null}
              {on ? <span className="wset-lang-tick" aria-hidden>✓</span> : null}
            </button>
          );
        })}
      </div>

      {samples.length ? (
        <ul className="wset-samples">
          {samples.map((s) => (
            <li key={s.title}><b>{s.loc}</b> <span>{s.title}</span></li>
          ))}
        </ul>
      ) : null}

      <p className="wset-sum">
        Official release titles from TMDB — never a machine translation. A film with no title in
        this language keeps its English one, and the site&apos;s own words stay English.
      </p>
    </div>
  );
}
