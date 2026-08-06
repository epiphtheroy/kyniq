// UI strings, editable in the database (owner directive 2026-08-06).
//
// The bundled dictionaries stay: they are the instant, offline layer, and a
// button that waits on a network round-trip is worse than a button in the wrong
// language. This adds an OVERRIDE on top — content_i18n rows with
// entity_type='ui' win over the bundle once they arrive.
//
// What that buys: a corner name or a typo can be corrected for every language at
// once, live, without an app release — which is exactly the problem four
// TypeScript dictionaries create. The same table the web reads, so a fix lands
// on both surfaces.
//
// Failure is silent by construction: no network, no rows, a bad response — the
// bundle keeps rendering. This can never blank the UI.
import { supabase } from "../lib/supabase";
import { applyOverrides } from "./index";

let started = false;

/** Fetch once per app start. Cheap: ~413 short rows for one language. */
export async function loadUIOverrides(locale: string): Promise<void> {
  if (started) return;
  started = true;
  try {
    const { data, error } = await supabase
      .from("content_i18n")
      .select("entity_key, text")
      .eq("entity_type", "ui")
      .eq("field", "text")
      .eq("lang", locale);
    if (error || !data?.length) return;
    const map: Record<string, string> = {};
    for (const r of data as { entity_key: string; text: string }[]) {
      if (r.text) map[r.entity_key] = r.text;
    }
    applyOverrides(locale, map);
  } catch {
    // the bundle is already correct enough to ship; overrides are a refinement
  }
}

/** Language changed mid-session — allow one more fetch. */
export function resetUIOverrides(): void {
  started = false;
}
