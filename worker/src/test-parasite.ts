/**
 * Quick test: generate featured Q&A for Parasite using gemini-3.1-pro-preview
 * Usage: DOTENV_CONFIG_PATH=../.env.local npx tsx src/test-parasite.ts
 */
import "dotenv/config";

const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) { console.error("No GEMINI_API_KEY"); process.exit(1); }

const MODEL = "gemini-3.1-pro-preview";

const SYSTEM_PROMPT = `You are **FilmCurio Editorial**, the in-house critical voice of FilmCurio. For one film, produce the questions viewers are most genuinely curious about after watching it, and answer each at the highest level of accuracy and insight you are capable of. There is no human editor after you. Return a JSON object with film_id, film_title, and items array. Each item has: question, question_body (optional, "" if none), asker_lens, answer (180-340 words), answerer_lens, aha, self_confidence (0-1), claims_sourced (boolean). Output JSON only, no prose.`;

const USER_PROMPT = `film_id: test-parasite
Title: Parasite (2019)
Director: Bong Joon-ho
Overview: All unemployed, Ki-taek and his family take peculiar interest in the wealthy and glamorous Parks, ingratiate themselves into their lives, and get entangled in an unexpected incident.

Produce the featured Q&A JSON for this film now.`;

async function main() {
  console.log(`[test] Calling ${MODEL} for Parasite...`);
  const start = Date.now();

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
          { role: "model", parts: [{ text: "Understood." }] },
          { role: "user", parts: [{ text: USER_PROMPT }] },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 16384,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (!res.ok) {
    const err = await res.text();
    console.error(`[test] API error ${res.status}: ${err}`);
    process.exit(1);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const usage = data.usageMetadata ?? {};

  console.log(`[test] Done in ${elapsed}s`);
  console.log(`[test] Tokens — prompt: ${usage.promptTokenCount}, completion: ${usage.candidatesTokenCount}, total: ${usage.totalTokenCount}`);

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("[test] JSON parse failed:", text.slice(0, 500));
    process.exit(1);
  }

  console.log(`[test] Items: ${parsed.items?.length ?? 0}`);
  console.log("---");

  for (const item of (parsed.items ?? [])) {
    const words = item.answer?.split(/\s+/).length ?? 0;
    console.log(`Q: ${item.question}`);
    console.log(`  asker: ${item.asker_lens} → answerer: ${item.answerer_lens}`);
    console.log(`  conf: ${item.self_confidence}, sourced: ${item.claims_sourced}, words: ${words}`);
    console.log(`  aha: ${item.aha}`);
    console.log(`  body: ${item.question_body || "(none)"}`);
    console.log("");
  }

  // Also write full JSON
  const fs = await import("fs");
  fs.writeFileSync("parasite-output.json", JSON.stringify(parsed, null, 2));
  console.log("[test] Full output → parasite-output.json");
}

main().catch(e => { console.error(e); process.exit(1); });
