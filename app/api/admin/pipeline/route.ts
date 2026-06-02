import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { runPipeline, type QuestionType, type PipelineResult } from "@/lib/pipeline";

const MAX_ITEMS_PER_RUN = 5;

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let filmId: string;
  let questionType: QuestionType;
  let threshold: number;
  let count: number;

  // Support both JSON and FormData
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json();
    filmId = body.film_id;
    questionType = body.question_type;
    threshold = body.threshold ?? 0.85;
    count = Math.min(body.count ?? 1, MAX_ITEMS_PER_RUN);
  } else {
    const body = await request.formData();
    filmId = body.get("film_id") as string;
    questionType = body.get("question_type") as QuestionType;
    threshold = parseFloat((body.get("threshold") as string) ?? "0.85");
    count = Math.min(parseInt((body.get("count") as string) ?? "1"), MAX_ITEMS_PER_RUN);
  }

  if (!filmId || !questionType) {
    return NextResponse.json(
      { error: "Missing film_id or question_type" },
      { status: 400 }
    );
  }

  // Check Gemini API key
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured. Add it to environment variables." },
      { status: 500 }
    );
  }

  const results: PipelineResult[] = [];
  const errors: string[] = [];

  for (let i = 0; i < count; i++) {
    try {
      const result = await runPipeline(filmId, questionType, { threshold });
      results.push(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
      console.error(`Pipeline run ${i + 1} failed:`, msg);
    }
  }

  // Redirect for form submissions
  const referer = request.headers.get("referer");
  if (referer && contentType.includes("form")) {
    return NextResponse.redirect(referer, 303);
  }

  return NextResponse.json({
    ok: true,
    results_count: results.length,
    errors_count: errors.length,
    results: results.map((r) => ({
      questionId: r.questionId,
      confidence: r.verification.confidence,
      status: r.gate.status,
      published: r.gate.published,
    })),
    errors,
  });
}
