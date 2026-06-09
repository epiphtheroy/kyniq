import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/debug-qa — temporary debug endpoint to check if canonical_answers are visible
 */
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Count published questions
  const { count: qCount } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");

  // Count published answers
  const { count: aCount } = await supabase
    .from("canonical_answers")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");

  // Try the exact join query
  const { data: sample, error } = await supabase
    .from("questions")
    .select(`
      id, title,
      canonical_answers(id, body, status)
    `)
    .eq("status", "published")
    .limit(1)
    .single();

  return NextResponse.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30) + "...",
    publishedQuestions: qCount,
    publishedAnswers: aCount,
    sampleQuestion: sample?.title?.slice(0, 50),
    sampleAnswerCount: Array.isArray(sample?.canonical_answers)
      ? sample.canonical_answers.length
      : sample?.canonical_answers ? 1 : 0,
    sampleAnswer: (() => {
      const ca = sample?.canonical_answers;
      if (Array.isArray(ca) && ca.length > 0) return ca[0].body?.slice(0, 80);
      if (ca && typeof ca === 'object' && 'body' in ca) return (ca as any).body?.slice(0, 80);
      return null;
    })(),
    error: error?.message ?? null,
  });
}
