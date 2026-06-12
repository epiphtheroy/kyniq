/**
 * Spoiler-guard backfill — re-audit loop for legacy published rows.
 *
 * Grades the spoiler exposure of already-published questions (which predate
 * migration 0010) using the same Spoiler-gate rules as the generator, then
 * fills: questions.spoiler_level / title_spoiler / display_title / safe_hook
 * and canonical_answers.spoiler_level. Never touches status or content.
 *
 * Usage:
 *   node spoiler-backfill.mjs                 # newest 10 published (home feed order)
 *   node spoiler-backfill.mjs --limit 25
 *   node spoiler-backfill.mjs --dry           # call the model, print, write nothing
 *   node spoiler-backfill.mjs --force         # re-grade rows that already have a level
 */

import { createClient } from "@supabase/supabase-js";
import { config as dotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv({ path: path.join(__dirname, "..", ".env.local") });
dotenv({ path: path.join(__dirname, ".env") });

const args = process.argv.slice(2);
const LIMIT = Number(args[args.indexOf("--limit") + 1]) || 10;
const DRY = args.includes("--dry");
const FORCE = args.includes("--force");
const MODELS = ["gemini-3.5-flash", "gemini-2.5-flash"]; // first that responds wins

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!SUPABASE_URL || !SERVICE_KEY || !GEMINI_KEY) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / GEMINI_API_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Same deterministic backstops as worker/src/generator.ts ──────
const SPOILER_LEVELS = ["none", "mild", "major"];
const SPOILER_TITLE_RE =
  /\b(dies?|death|kills?|killed|murder(er|s)?|the killer|is actually|turns? out|twist|betray(s|ed|al)?|ending reveals?|was dead|isn'?t real|imagin(ed|ary))\b/i;
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/u;
const MAX_HOOK_LENGTH = 200;

const SYSTEM = `You are FilmCurio Editorial's spoiler auditor. You grade ONE published film-interpretation Q&A for spoiler exposure. Readers who have NOT seen the film browse the site's lists; the answer page itself is allowed to spoil.

Return ONLY a JSON object:
{
  "spoiler_level": "none|mild|major",   // what the ANSWER reveals. none = premise-level (themes, craft, context). mild = mid-film developments, no ending/twist/death/fate. major = ending, twist, a character's death or fate, a killer's/impostor's identity.
  "title_spoiler": false,                // would the question TITLE ALONE spoil an unwatched viewer? Judge the title in isolation. "What actually happens at the end?" = false (promises a spoiler, doesn't deliver one). "Why does X shoot Y at the end?" = true.
  "question_display": "",               // ONLY when title_spoiler is true: the title with ONLY the spoiling words (names whose fate is revealed, verbs like kill/die/betray/shoot, twist nouns) replaced by 1-3 fitting trendy emojis. Keep every other word and the sentence shape intact; never mask the film title; the result must stay an enticing riddle. e.g. "Why did the detective shoot his partner?" -> "Why did the detective 🔫 his 🤝?". Else "".
  "hook": "",                           // ONLY when spoiler_level is "major": one spoiler-free teaser sentence (<=30 words) selling the answer without revealing it, for list previews. Else "".
  "reason": ""                          // one short sentence: why this grade.
}
Emojis are allowed ONLY inside question_display. No prose outside the JSON.`;

async function callGemini(model, user) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: SYSTEM }] },
          { role: "model", parts: [{ text: "Understood." }] },
          { role: "user", parts: [{ text: user }] },
        ],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024, responseMimeType: "application/json" },
      }),
    },
  );
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    const err = new Error(`Gemini ${res.status}: ${body}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function grade(user) {
  let lastErr;
  for (const model of MODELS) {
    try {
      const text = await callGemini(model, user);
      return { text, model };
    } catch (e) {
      lastErr = e;
      if (e.status === 404 || e.status === 400) continue; // unknown model → try next
      throw e;
    }
  }
  throw lastErr;
}

/** Deterministic validation + backstop. Returns { ok, fixed, flags[] }. */
function validate(parsed, title) {
  const flags = [];
  if (!parsed || !SPOILER_LEVELS.includes(parsed.spoiler_level) || typeof parsed.title_spoiler !== "boolean") {
    return { ok: false, flags: ["invalid shape"] };
  }
  const item = {
    spoiler_level: parsed.spoiler_level,
    title_spoiler: parsed.title_spoiler,
    question_display: typeof parsed.question_display === "string" ? parsed.question_display.trim() : "",
    hook: typeof parsed.hook === "string" ? parsed.hook.trim() : "",
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
  };
  if (item.title_spoiler) {
    if (!item.question_display || !EMOJI_RE.test(item.question_display) || item.question_display === title.trim()) {
      // Can't mask deterministically → keep real title but make sure the grade protects the body
      flags.push("masked title invalid → dropped mask, kept title_spoiler audit flag");
      item.title_spoiler = false;
      item.question_display = "";
      if (item.spoiler_level === "none") item.spoiler_level = "mild";
    }
  } else {
    item.question_display = "";
  }
  if (item.spoiler_level === "major") {
    if (!item.hook || item.hook.length > MAX_HOOK_LENGTH) {
      flags.push("hook missing/too long → list previews will fall back to nothing");
      item.hook = "";
    }
  } else {
    item.hook = "";
  }
  // Regex backstop: spoilery-looking title the model judged safe
  if (!item.title_spoiler && SPOILER_TITLE_RE.test(title)) {
    if (item.spoiler_level === "none") item.spoiler_level = "mild";
    flags.push("regex backstop: title matches spoiler pattern (escalated)");
  }
  return { ok: true, fixed: item, flags };
}

// ── Main ──────────────────────────────────────────────────────────
const { data: rows, error } = await supabase
  .from("questions")
  .select(`id, title, slug, spoiler_level, published_at,
    film:films!inner(title, year, director),
    canonical_answers!inner(body, status)`)
  .eq("status", "published")
  .eq("canonical_answers.status", "published")
  .order("published_at", { ascending: false })
  .limit(LIMIT);

if (error) { console.error("Supabase:", error.message); process.exit(1); }

const targets = (rows ?? []).filter((r) => FORCE || r.spoiler_level == null);
console.log(`[spoiler-backfill] ${rows?.length ?? 0} fetched (home-feed order), ${targets.length} to grade${DRY ? " [DRY RUN]" : ""}\n`);

const results = [];
for (const q of targets) {
  const film = q.film;
  const ca = Array.isArray(q.canonical_answers) ? q.canonical_answers[0] : q.canonical_answers;
  const user = `FILM: "${film.title}" (${film.year ?? "?"}), dir. ${film.director ?? "?"}
QUESTION TITLE: ${q.title}
ANSWER: ${(ca?.body ?? "").slice(0, 2500)}

Grade this item now. JSON only.`;

  try {
    const { text, model } = await grade(user);
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { /* fallthrough */ }
    const v = validate(parsed, q.title);
    if (!v.ok) {
      results.push({ q, error: `validation: ${v.flags.join("; ")}` });
      continue;
    }
    const item = v.fixed;

    if (!DRY) {
      const { error: uErr } = await supabase
        .from("questions")
        .update({
          spoiler_level: item.spoiler_level,
          title_spoiler: item.title_spoiler,
          display_title: item.question_display || null,
          safe_hook: item.hook || null,
        })
        .eq("id", q.id);
      if (uErr) { results.push({ q, error: `update: ${uErr.message}` }); continue; }

      await supabase.from("canonical_answers")
        .update({ spoiler_level: item.spoiler_level })
        .eq("question_id", q.id);

      await supabase.from("content_events").insert({
        entity_type: "question",
        entity_id: q.id,
        event: "spoiler_backfilled",
        actor_kind: "ai",
        meta: { model, ...item, flags: v.flags },
      });
    }
    results.push({ q, item, model, flags: v.flags });
    await new Promise((r) => setTimeout(r, 400)); // rate limit
  } catch (e) {
    results.push({ q, error: e.message });
  }
}

// ── Report ────────────────────────────────────────────────────────
const ICON = { none: "🟢", mild: "🟡", major: "🔴" };
for (const r of results) {
  console.log(`— ${r.q.film.title} · "${r.q.title}"`);
  if (r.error) { console.log(`   ❌ ${r.error}\n`); continue; }
  const i = r.item;
  console.log(`   ${ICON[i.spoiler_level]} spoiler_level=${i.spoiler_level} · title_spoiler=${i.title_spoiler}`);
  if (i.question_display) console.log(`   masked: ${i.question_display}`);
  if (i.hook) console.log(`   hook:   ${i.hook}`);
  if (i.reason) console.log(`   why:    ${i.reason}`);
  if (r.flags?.length) console.log(`   flags:  ${r.flags.join("; ")}`);
  console.log("");
}
const ok = results.filter((r) => !r.error);
console.log(`[spoiler-backfill] done: ${ok.length} graded${DRY ? " (dry)" : " + written"}, ${results.length - ok.length} errors`);
console.log(`  none: ${ok.filter((r) => r.item.spoiler_level === "none").length} · mild: ${ok.filter((r) => r.item.spoiler_level === "mild").length} · major: ${ok.filter((r) => r.item.spoiler_level === "major").length} · masked titles: ${ok.filter((r) => r.item.question_display).length}`);
