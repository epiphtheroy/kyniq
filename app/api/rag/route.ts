/**
 * ASK v2 route — ADDITIVE. The live v1 route (`app/api/ask/route.ts`) is the
 * production default and is untouched. This route returns the SAME JSON shape
 * (`{answer, citations, readings, meta}`) so the frontend can switch by URL.
 *
 * Pipeline: analyzeQuery (W2) → embed → ask_retrieve (wider p_k) → rerank (W3)
 *           → diversify v2 (intent-driven) → numbered context → generate (W4).
 *
 * Reuses v1's in-memory cache + rate-limit pattern, and strips the `USED:` line
 * exactly like v1. The embedding model/dimension and `ask_retrieve` are
 * unchanged (1536, text-embedding-3-small).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { openaiAdapter } from "@/lib/providers/openai";
import { analyzeQuery } from "@/app/rag/_lib/queryUnderstanding";
import { rerank, type RerankRow } from "@/app/rag/_lib/rerank";
import { diversify } from "@/app/rag/_lib/diversify";
import { SYS_V2 } from "@/app/rag/_lib/prompt";
import { findFurtherReading, type AcademicRef } from "@/app/rag/_lib/academic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI = "https://api.openai.com/v1";
const EMBED_MODEL = "text-embedding-3-small";
const ANSWER_MODEL = process.env.ASK_MODEL || "gpt-4o-mini";

const CANDIDATES = 60; // retrieve wider than v1 (40) — the reranker sorts.
const KEEP = 14; // …then diversify down to this many.

type Row = {
  rank: number; take_id: string; rationale: string; register: string | null; theorist: string | null;
  film_title: string; film_slug: string; figure_label: string; figure_slug: string;
  meta_title: string | null; meta_slug: string | null; rrf: number;
};

const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 12;
}

async function embed(q: string): Promise<number[]> {
  const r = await fetch(`${OPENAI}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: EMBED_MODEL, input: q }),
  });
  if (!r.ok) throw new Error(`embedding ${r.status}`);
  const d = await r.json();
  return d.data[0].embedding as number[];
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Ask is not configured (missing API key)." }, { status: 503 });
    }
    const body = await req.json().catch(() => ({}));
    const query = (body?.q ?? "").toString().trim();
    if (query.length < 3) return NextResponse.json({ error: "Ask a fuller question." }, { status: 400 });
    if (query.length > 300) return NextResponse.json({ error: "That question is too long." }, { status: 400 });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
    if (rateLimited(ip)) return NextResponse.json({ error: "A moment — too many questions at once." }, { status: 429 });

    const key = "v2:" + query.toLowerCase().replace(/\s+/g, " ");
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return NextResponse.json(cached.data);

    // W2 — query understanding. The vector axis uses the ORIGINAL query; the
    // keyword/FTS axis uses the English-normalized ftsQuery. ask_retrieve takes
    // a single p_q for its FTS leg, so we feed it ftsQuery (English-normalized).
    const analysis = await analyzeQuery(query);

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const vec = await embed(query); // vector axis: original query (multilingual-safe)
    const { data, error } = await supabase.rpc("ask_retrieve", {
      p_qvec: `[${vec.join(",")}]`,
      p_q: analysis.ftsQuery || query, // keyword axis: English-normalized
      p_k: CANDIDATES,
    });
    if (error) throw new Error(error.message);

    const candidates = (data ?? []) as Row[];

    // W3 — rerank (vendor if keyed, else transparent fallback), then diversify
    // by intent (broad → cap 2; specific-film → relax to depth).
    const reranked = await rerank(query, candidates as RerankRow[], {
      expansions: analysis.expansions,
      topN: 40, // hand the diversifier a focused, sorted pool
    });

    const cites = diversify(reranked, { intent: analysis.intent, keep: KEEP });

    if (cites.length === 0) {
      return NextResponse.json({
        answer: "Nothing in the corpus speaks to that yet — try rephrasing, or pull a thread from the homepage.",
        citations: [], readings: [],
        meta: { model: ANSWER_MODEL, intent: analysis.intent, lang: analysis.lang },
      });
    }

    // Numbered context: each take carries the cross-film reading it belongs to.
    const ctx = cites
      .map((r) => {
        const head = `[${r.rank}] (${r.film_title}${r.register ? ` · ${r.register}` : ""}${r.theorist ? ` · after ${r.theorist}` : ""})`;
        const tail = r.meta_title ? `  [reading: ${r.meta_title}]` : "";
        return `${head} ${(r.rationale ?? "").replace(/\s+/g, " ").trim()}${tail}`;
      })
      .join("\n");

    const resp = await openaiAdapter.call(ANSWER_MODEL, `Question: ${query}\n\nReadings:\n${ctx}`, {
      systemPrompt: SYS_V2, temperature: 0.2, maxTokens: 750,
    });

    const answer = (resp.text ?? "").replace(/\n?USED:\s*[\d,\s]*$/i, "").trim();

    const seen = new Set<string>();
    const readings: { slug: string; title: string }[] = [];
    for (const r of cites) {
      if (r.meta_slug && r.meta_title && !seen.has(r.meta_slug)) {
        seen.add(r.meta_slug);
        readings.push({ slug: r.meta_slug, title: r.meta_title });
      }
    }

    // W7 — academic "further reading" (ADDITIVE, behind ACADEMIC_FURTHER_READING).
    // GROUNDING INVARIANT: this runs AFTER generation, so it CANNOT enter the
    // prompt. It is attached to a SEPARATE top-level `further_reading` field and
    // is NEVER merged into `citations` or cited with [n]. On flag-off or any
    // failure, the field is simply omitted — the response is otherwise identical.
    let further_reading: AcademicRef[] | undefined;
    if (process.env.ACADEMIC_FURTHER_READING) {
      try {
        const items = await findFurtherReading(analysis.ftsQuery || query);
        if (items.length > 0) further_reading = items;
      } catch {
        // Scaffolding only — never let it affect the grounded response.
        further_reading = undefined;
      }
    }

    const out = {
      answer,
      citations: cites,
      readings,
      ...(further_reading ? { further_reading } : {}),
      meta: {
        model: ANSWER_MODEL,
        intent: analysis.intent,
        lang: analysis.lang,
        reranker: (process.env.RERANK_PROVIDER || "fallback").toLowerCase(),
        inTokens: resp.tokensUsed?.prompt ?? null,
        outTokens: resp.tokensUsed?.completion ?? null,
        costUsd: resp.cost ?? null,
      },
    };
    cache.set(key, { data: out, ts: Date.now() });
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Ask failed." }, { status: 500 });
  }
}
