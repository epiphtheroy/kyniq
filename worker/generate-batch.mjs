#!/usr/bin/env node
/**
 * Batch generator: generate featured Q&A for multiple films and insert directly as published.
 * Uses gemini-3.5-flash with the full system prompt.
 */
import { readFileSync, writeFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// Load env
const envFile = readFileSync("../.env.local", "utf8");
const vars = {};
for (const line of envFile.split("\n")) {
  const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const KEY = vars.GEMINI_API_KEY;
const sb = createClient(vars.NEXT_PUBLIC_SUPABASE_URL, vars.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const MODEL = "gemini-3.5-flash";
const EDITORIAL_PROFILE_ID = "00000000-0000-0000-0000-000000000001";

// Films to generate
const FILM_IDS = [
  "8092e77c-ce4d-4eca-b2ff-6625a714d29e", // Parasite
  "4a682be8-40ad-46f1-8d8a-5dcaef9d9e13", // The Dark Knight
  "b479e837-6e30-47e4-a6a1-59b01fcf06a4", // Pulp Fiction
  "896a589f-7202-451f-aa56-a8b27b9609e4", // Burning
  "ae478ca5-fe70-4b61-971a-5fc780e252d8", // Whiplash
  "da6346d6-a639-4bc5-9d4f-4886f0c99fe5", // The Godfather
  "dd71da01-0eff-4647-b08d-0a1e7886390f", // Mulholland Drive
];

const SYS = `You are **FilmCurio Editorial**, the in-house critical voice of FilmCurio, a film-interpretation
site. For one film, produce the questions viewers are *most genuinely curious about after watching
it*, and answer each at the highest level of accuracy and insight you are capable of.

This is the site's seed layer. It must be good enough to (a) earn Google's **highest E-E-A-T**
rating and (b) be the answer an AI engine chooses to cite. **There is no human editor after you.**
If an answer is not accurate and genuinely illuminating, it does not ship — so hold the bar
yourself.

### Non-negotiables — trust (this is the E-E-A-T floor)
- **Accuracy over fluency.** Every factual claim about the film (plot, character, a line, a craft
  choice, production, release) must be true and checkable against the film itself or the
  well-established record. If you are not sure a detail is right, do not assert it.
- **Never fabricate quotes.** Do not invent verbatim dialogue. Refer to scenes and moments
  precisely; quote a line only if you are certain of it, and keep it short.
- **Separate fact from reading.** State what the film *shows* as fact; mark interpretation as
  interpretation. Where the film is deliberately ambiguous, **say so** — give the strongest reading
  *and* name the open question. Honest ambiguity is a trust signal, not a weakness; fake certainty
  is the fastest way to fail E-E-A-T.
- Spoilers are expected here (these are interpretation pages). Answer **fully**, endings included.
- English. No markdown inside field values. No emojis.

### What makes a FilmCurio answer — the bar (apply to every answer)
1. **Mirror the question's crux, and answer it first.** The opening sentence is a committed,
   direct answer to *exactly* what was asked, echoing the question's own key terms — a counterpart
   to the question, not a preamble. No "great question", no general intro to the film. If the item
   carries a body (the asker's elaboration), still lead on the title's crux; you may then briefly
   meet the specific angle the body raises, but never let the body pull the answer off course.
2. **Earn it with specific evidence from the film** — name the scene, the image, the cut, the line,
   the behaviour, the structural choice. Specificity is the *Experience + Expertise* signal; vague
   praise is the opposite.
3. **Deliver exactly one clear "aha".** A precise, non-obvious insight that reframes the
   question or resolves it in a way the viewer had not put together — a real turn of understanding,
   so the reader ends on "oh, *that's* what was going on." Not a platitude ("it's about the human
   condition"), not a plot summary.
4. **Stay on the crux.** Every sentence serves the answer to *that* question. No drift into general
   appreciation or unrelated trivia.
5. **Precise and economical: ~180–340 words.** Authoritative, not padded. Reasoned, situated in the
   director's work or film history only when it sharpens the answer (*Authoritativeness*).

### The 10 ASKER lenses
1. **The First-Timer** — just watched, casual words
2. **The Feeler** — emotion/character focus
3. **The Logic-Checker** — does it add up?
4. **The Symbol-Spotter** — fixed on one image/object/colour
5. **The Bingewatcher** — time-pressed, practical
6. **The Student** — themes/context for an essay
7. **The Rewatcher** — caught a detail on second viewing
8. **The Skeptic** — suspicious of hype/ambiguity
9. **The Genre Fan** — tropes/comparisons
10. **The Budding Cinephile** — some film vocabulary

### The 10 ANSWERER lenses
1. **The Warm Explainer** — lucid, generous, demystifying
2. **The Wit** — urbane, literary, lightly ironic, quotable
3. **The Formalist** — reads craft precisely
4. **The Theorist** — one framework worn lightly
5. **The Historian** — situates the film in its moment
6. **The Close-Reader** — disciplined attention to what's on screen
7. **The Auteurist** — connects to the director's whole body of work
8. **The Structuralist** — narrative architecture / screenwriting logic
9. **The Contrarian** — argues the unfashionable reading rigorously
10. **The Comparatist** — world-cinema / cross-cultural lens

### Self-gate
- **self_confidence** (0.00–1.00): honest probability that the answer is accurate and insightful.
- **claims_sourced** (boolean): true only if every claim is grounded.
Aim for **10** items; minimum **8**. Every item: **self_confidence >= 0.75**.

### Output — single JSON object
{
  "film_id": "<echo the input film_id>",
  "film_title": "<title>",
  "items": [
    {
      "question": "<question title>",
      "question_body": "<optional 1-2 sentence elaboration or \\"\\" if none>",
      "asker_lens": "<one of the 10>",
      "answer": "<180-340 words>",
      "answerer_lens": "<one of the 10>",
      "aha": "<one sentence>",
      "self_confidence": 0.00,
      "claims_sourced": true
    }
  ]
}
Output JSON only.`;

function makeSlug(question) {
  const base = question.toLowerCase().replace(/['']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  const suffix = Date.now().toString(36);
  return `${base}-${suffix}`;
}

async function generateForFilm(filmId) {
  // Get film info
  const { data: film } = await sb.from("films").select("id, title, tmdb_id, director, year, overview, genres, keywords, original_title").eq("id", filmId).single();
  if (!film) { console.error(`Film ${filmId} not found`); return null; }

  const userPrompt = `film_id: ${film.id}
Title: ${film.title} (${film.year})
Director: ${film.director}
Overview: ${film.overview || "N/A"}

Produce the featured Q&A JSON for this film now.`;

  console.log(`\n[gen] Calling ${MODEL} for "${film.title}"...`);
  const t0 = Date.now();

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: SYS }] },
          { role: "model", parts: [{ text: "Understood." }] },
          { role: "user", parts: [{ text: userPrompt }] },
        ],
        generationConfig: { temperature: 0.7, maxOutputTokens: 16384, responseMimeType: "application/json" },
      }),
    },
  );

  const sec = ((Date.now() - t0) / 1000).toFixed(1);

  if (!res.ok) {
    console.error(`[gen] API error ${res.status} for ${film.title}:`, await res.text());
    return null;
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const u = data.usageMetadata ?? {};

  let parsed;
  try { parsed = JSON.parse(text); } catch { console.error(`[gen] JSON parse failed for ${film.title}`); return null; }

  console.log(`[gen] ${film.title}: ${parsed.items?.length ?? 0} items in ${sec}s (thinking: ${u.thoughtsTokenCount ?? 0})`);

  // Insert into Supabase as published
  const now = new Date().toISOString();
  let inserted = 0;

  for (const item of (parsed.items ?? [])) {
    if (item.self_confidence < 0.75) continue;

    const slug = makeSlug(item.question);

    // Insert question
    const { data: q, error: qErr } = await sb.from("questions").insert({
      film_id: filmId,
      author_id: EDITORIAL_PROFILE_ID,
      title: item.question,
      body: item.question_body || null,
      slug,
      status: "published",
      published_at: now,
      source: "ai",
      generated_by: MODEL,
      asker_lens: item.asker_lens,
      self_confidence: item.self_confidence,
      claims_sourced: item.claims_sourced,
    }).select("id").single();

    if (qErr) { console.error(`  Q insert err: ${qErr.message}`); continue; }

    // Insert canonical answer
    const { error: aErr } = await sb.from("canonical_answers").insert({
      question_id: q.id,
      body: item.answer,
      updated_by: EDITORIAL_PROFILE_ID,
      status: "published",
      published_at: now,
      source: "ai",
      generated_by: MODEL,
      answerer_lens: item.answerer_lens,
      aha: item.aha,
      self_confidence: item.self_confidence,
      claims_sourced: item.claims_sourced,
    });

    if (aErr) { console.error(`  A insert err: ${aErr.message}`); continue; }

    inserted++;
  }

  // Update film counter
  await sb.from("films").update({
    questions_published: inserted,
    pipeline_status: "done",
    last_processed_at: now,
  }).eq("id", filmId);

  console.log(`[gen] ${film.title}: ${inserted} Q&A pairs inserted as published`);
  return { film: film.title, items: inserted };
}

// Main
console.log(`=== Batch Generation: ${FILM_IDS.length} films with ${MODEL} ===\n`);

const results = [];
for (const filmId of FILM_IDS) {
  const result = await generateForFilm(filmId);
  if (result) results.push(result);
  // Small delay between films
  await new Promise(r => setTimeout(r, 2000));
}

console.log("\n=== SUMMARY ===");
let total = 0;
for (const r of results) {
  console.log(`  ${r.film}: ${r.items} Q&A`);
  total += r.items;
}
console.log(`  TOTAL: ${total} Q&A pairs across ${results.length} films`);

// Final DB check
const { count: qc } = await sb.from("questions").select("id",{count:"exact",head:true}).eq("status","published");
const { count: ac } = await sb.from("canonical_answers").select("id",{count:"exact",head:true}).eq("status","published");
console.log(`  DB: ${qc} published questions, ${ac} published answers`);

process.exit(0);
