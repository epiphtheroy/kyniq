import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Run EXACT query from question page
  const { data: question, error } = await supabase
    .from("questions")
    .select(`
      id, title, body, slug, question_type, view_count, created_at, published_at,
      author:profiles!questions_author_id_fkey(username, display_name),
      film:films!inner(id, title, year, director, director_slug, slug, poster_path, imdb_id, wikidata_id),
      canonical_answers(id, body, updated_at, revision_count, status, source, generated_by,
        updated_by_profile:profiles!canonical_answers_updated_by_fkey(username, display_name)
      )
    `)
    .eq("slug", "why-does-the-ending-feel-so-tragic-if-ki-woo-has-a-plan-to-buy-the-house-mq4c2loa")
    .eq("status", "published")
    .single();

  if (error) {
    return NextResponse.json({
      queryError: error.message,
      errorCode: error.code,
      errorDetails: error.details,
      errorHint: error.hint,
    });
  }

  const canonicalArr = question.canonical_answers as unknown as Array<{
    id: string; body: string; status: string;
  }>;

  return NextResponse.json({
    questionTitle: question.title,
    questionType: question.question_type,
    canonicalCount: canonicalArr?.length ?? 0,
    canonicalStatus: canonicalArr?.[0]?.status,
    canonicalBody: canonicalArr?.[0]?.body?.slice(0, 100),
    filmTitle: (question.film as any)?.title,
  });
}
