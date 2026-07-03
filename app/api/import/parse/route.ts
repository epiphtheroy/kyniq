import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { parseFile, parseText } from "@/lib/import/parsers";
import { parseWithLlm } from "@/lib/import/llm";
import type { ParseResult } from "@/lib/import/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILE = 8 * 1024 * 1024; // 8MB

/** Accepts multipart form-data { file } or JSON { text }.
 * Detects the format and returns normalized rows for the review step. */
export async function POST(req: NextRequest) {
  const ssr = await createServerClient();
  const { data: auth } = await ssr.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "auth" }, { status: 401 });

  try {
    let result: ParseResult;
    const ct = req.headers.get("content-type") || "";

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
      if (file.size > MAX_FILE) return NextResponse.json({ error: "file too large (max 8MB)" }, { status: 413 });
      const buf = Buffer.from(await file.arrayBuffer());
      result = await parseFile(file.name, buf);
    } else {
      const body = await req.json().catch(() => null) as { text?: string } | null;
      const text = (body?.text || "").trim();
      if (!text) return NextResponse.json({ error: "no text" }, { status: 400 });
      result = await parseText(text);
      // rule-based parse got little out of a non-trivial paste → LLM fallback
      const lineCount = text.split(/\r?\n/).filter((l) => l.trim()).length;
      if (result.source === "watcha_text" && result.rows.length < Math.max(2, lineCount * 0.15)) {
        const llm = await parseWithLlm(text);
        if (llm.rows.length > result.rows.length) result = llm;
      }
    }

    if (!result.rows.length)
      return NextResponse.json({ ...result, error: "no rows" }, { status: 422 });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[import/parse]", e);
    return NextResponse.json({ error: "parse failed" }, { status: 500 });
  }
}
