import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Test 1: Simple join (no nested profile join)
  const { data: t1, error: e1 } = await supabase
    .from("questions")
    .select("id, title, canonical_answers(id, body, status)")
    .eq("slug", "why-does-the-ending-feel-so-tragic-if-ki-woo-has-a-plan-to-buy-the-house-mq4c2loa")
    .eq("status", "published")
    .single();

  // Test 2: With updated_by_profile nested join
  const { data: t2, error: e2 } = await supabase
    .from("questions")
    .select(`id, title, canonical_answers(id, body, status, 
      updated_by_profile:profiles!canonical_answers_updated_by_fkey(username, display_name)
    )`)
    .eq("slug", "why-does-the-ending-feel-so-tragic-if-ki-woo-has-a-plan-to-buy-the-house-mq4c2loa")
    .eq("status", "published")
    .single();

  // Test 3: With question_type column
  const { data: t3, error: e3 } = await supabase
    .from("questions")
    .select("id, title, question_type")
    .eq("slug", "why-does-the-ending-feel-so-tragic-if-ki-woo-has-a-plan-to-buy-the-house-mq4c2loa")
    .eq("status", "published")
    .single();

  // Test 4: Full query from page
  const { data: t4, error: e4 } = await supabase
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

  const getCA = (d: any) => {
    if (!d?.canonical_answers) return { count: 0, body: null };
    const ca = d.canonical_answers;
    if (Array.isArray(ca)) return { count: ca.length, body: ca[0]?.body?.slice(0, 60) };
    return { count: 1, body: (ca as any).body?.slice(0, 60) };
  };

  return NextResponse.json({
    test1_simple: { ...getCA(t1), error: e1?.message ?? null },
    test2_with_profile: { ...getCA(t2), error: e2?.message ?? null },
    test3_question_type: { exists: t3 ? true : false, value: t3?.question_type, error: e3?.message ?? null },
    test4_full_query: { ...getCA(t4), error: e4?.message ?? null },
  });
}
