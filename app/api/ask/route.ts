import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { openaiAdapter } from "@/lib/providers/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI = "https://api.openai.com/v1";
const EMBED_MODEL = "text-embedding-3-small";
const ANSWER_MODEL = process.env.ASK_MODEL || "gpt-4o-mini";

const CANDIDATES = 40;     // retrieve wide…
const KEEP = 14;           // …then diversify down to this many
const MAX_PER_FILM = 2;    // diversity: no film dominates the evidence

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

// rerank-lite: candidates arrive ranked by RRF; keep the best while forcing
// variety — one take per figure, at most MAX_PER_FILM per film — so the model
// sees a broad spread of evidence, not three angles on one scene.
function diversify(cand: Row[]): Row[] {
  const picked: Row[] = [];
  const figSeen = new Set<string>();
  const filmCount = new Map<string, number>();
  for (const r of cand) {
    const figKey = r.figure_slug || r.take_id;
    if (figSeen.has(figKey)) continue;
    if ((filmCount.get(r.film_slug) ?? 0) >= MAX_PER_FILM) continue;
    figSeen.add(figKey);
    filmCount.set(r.film_slug, (filmCount.get(r.film_slug) ?? 0) + 1);
    picked.push(r);
    if (picked.length >= KEEP) break;
  }
  // sparse area: backfill ignoring the per-film cap so we never starve the model
  if (picked.length < 8) {
    for (const r of cand) {
      if (picked.includes(r)) continue;
      picked.push(r);
      if (picked.length >= 12) break;
    }
  }
  return picked.map((r, i) => ({ ...r, rank: i + 1 }));
}

const SYS = `You are Metatake's reading assistant. You answer questions about cinema using ONLY the numbered close-readings provided.

How to answer:
- Open with the through-line your evidence reveals — the shared idea, not a restatement of the question.
- Then develop it, grouping observations by critical register or by motif. Compare and set readings in tension; don't just list them.
- Ground EVERY claim in the readings with a citation like [3] right after it. Quote a vivid phrase when it earns its place.
- Never introduce a film, fact, director, or quotation not in the list. If the readings don't cover the question, say so plainly instead of inventing.
- Keep it concise and literary — Metatake's voice (think New Yorker close reading): no hype, no headings, no bullet lists.
- Finish with a line beginning "Unexpected kin:" naming one or two surprising pairings drawn only from the list.
- On the very last line output exactly: USED: <comma-separated citation numbers you used>.

Example of the voice and shape (illustrative only — never reuse its content):
"Surveillance in these films is rarely a camera; it is a posture the body learns. The prison teaches it as routine [2], the apartment as dread [4], until being watched becomes a way of watching oneself [1] — discipline relocated from the guard to the gut. Where one film makes the watcher visible and absurd [5], another dissolves him into architecture [3], as if power were most total when it has no face. Unexpected kin: a children's adventure [6] and a political thriller [4], both about who gets to look back.
USED: 1,2,3,4,5,6"`;

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
    const { data, error } = await supabase.rpc("ask_retrieve", { p_qvec: `[${vec.join(",")}]`, p_q: query, p_k: CANDIDATES });
    if (error) throw new Error(error.message);
    const cites = diversify((data ?? []) as Row[]);

    if (cites.length === 0) {
      return NextResponse.json({ answer: "Nothing in the corpus speaks to that yet — try rephrasing, or pull a thread from the homepage.", citations: [], readings: [] });
    }

    // Richer context: each take carries the cross-film reading it belongs to.
    const ctx = cites
      .map((r) => {
        const head = `[${r.rank}] (${r.film_title}${r.register ? ` · ${r.register}` : ""}${r.theorist ? ` · after ${r.theorist}` : ""})`;
        const tail = r.meta_title ? `  [reading: ${r.meta_title}]` : "";
        return `${head} ${(r.rationale ?? "").replace(/\s+/g, " ").trim()}${tail}`;
      })
      .join("\n");

    const resp = await openaiAdapter.call(ANSWER_MODEL, `Question: ${query}\n\nReadings:\n${ctx}`, {
      systemPrompt: SYS, temperature: 0.2, maxTokens: 750,
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

    const out = {
      answer,
      citations: cites,
      readings,
      meta: {
        model: ANSWER_MODEL,
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
