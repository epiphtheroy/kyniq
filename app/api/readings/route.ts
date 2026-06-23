import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fwBySlug } from "@/lib/frameworks";

// Strong Misreadings feed. When a query is present we embed it and run pgvector
// semantic search (so synonyms / related concepts surface); otherwise we browse
// (sort + decade facet + pagination). fw = framework slug or "all".
export const revalidate = 0;
const OPENAI = "https://api.openai.com/v1";
const EMBED_MODEL = "text-embedding-3-small";

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fwParam = searchParams.get("fw");
  let fwKey: string | null = null;
  if (fwParam && fwParam !== "all") {
    const f = fwBySlug(fwParam);
    if (!f) return NextResponse.json({ error: "unknown framework" }, { status: 400 });
    fwKey = f.key;
  }
  const q = searchParams.get("q")?.trim() || null;
  const sort = searchParams.get("sort") || "film";
  const decadeRaw = parseInt(searchParams.get("decade") || "", 10);
  const decade = Number.isFinite(decadeRaw) ? decadeRaw : null;
  const trope = searchParams.get("trope") || null;
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "24", 10) || 24, 1), 48);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

  const supabase = db();

  if (q) {
    try {
      const vec = await embed(q);
      const { data, error } = await supabase.rpc("readings_semantic", {
        p_fw: fwKey, p_vec: `[${vec.join(",")}]`, p_trope: trope, p_decade: decade, p_limit: limit, p_offset: offset,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json(data ?? { total: -1, rows: [] });
    } catch {
      // semantic unavailable → fall back to text search
      const { data } = await supabase.rpc("readings_by_framework", {
        p_fw: fwKey, p_q: q, p_sort: "film", p_trope: trope, p_decade: decade, p_limit: limit, p_offset: offset,
      });
      return NextResponse.json(data ?? { total: 0, rows: [] });
    }
  }

  const { data, error } = await supabase.rpc("readings_by_framework", {
    p_fw: fwKey, p_sort: sort, p_trope: trope, p_decade: decade, p_limit: limit, p_offset: offset,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { total: 0, rows: [] });
}
