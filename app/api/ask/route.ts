import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { openaiAdapter } from "@/lib/providers/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI = "https://api.openai.com/v1";
const EMBED_MODEL = "text-embedding-3-small";
const ANSWER_MODEL = process.env.ASK_MODEL || "gpt-4o-mini";

type Row = {
  rank: number; take_id: string; rationale: string; register: string | null; theorist: string | null;
  film_title: string; film_slug: string; figure_label: string; figure_slug: string;
  meta_title: string | null; meta_slug: string | null; rrf: number;
};

// Best-effort, per-instance dampening (serverless = not global, but enough for v1).
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

const SYS = `You are Metatake's reading assistant. You answer questions about cinema using ONLY the numbered close-readings provided below.
Rules:
- Ground every claim in those readings; put a citation like [3] immediately after each claim.
- Never introduce a film, fact, director, or quotation that is not in the list. If the readings do not cover the question, say so plainly rather than inventing.
- Where it helps, group observations by critical register or by idea.
- Write concise, literary prose — no hype, no preamble, no headings, no bullet lists unless truly natural.
- Finish with a short line beginning "Unexpected kin:" naming one or two surprising film pairings drawn only from the list.
- On the very last line output exactly: USED: <comma-separated citation numbers you actually used>.`;

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

    const key = query.toLowerCase().replace(/\s+/g, " ");
    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return NextResponse.json(cached.data);

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const vec = await embed(query);
    const { data, error } = await supabase.rpc("ask_retrieve", { p_qvec: `[${vec.join(",")}]`, p_q: query, p_k: 12 });
    if (error) throw new Error(error.message);
    const cites = (data ?? []) as Row[];

    if (cites.length === 0) {
      const out = { answer: "Nothing in the corpus speaks to that yet — try rephrasing, or pull a thread from the homepage.", citations: [], readings: [] };
      return NextResponse.json(out);
    }

    const ctx = cites
      .map((r) => `[${r.rank}] (${r.film_title}${r.register ? ` · ${r.register}` : ""}${r.theorist ? ` · after ${r.theorist}` : ""}) ${(r.rationale ?? "").replace(/\s+/g, " ").trim()}`)
      .join("\n");

    const resp = await openaiAdapter.call(ANSWER_MODEL, `Question: ${query}\n\nReadings:\n${ctx}`, {
      systemPrompt: SYS, temperature: 0.2, maxTokens: 700,
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

    const out = { answer, citations: cites, readings };
    cache.set(key, { data: out, ts: Date.now() });
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Ask failed." }, { status: 500 });
  }
}
