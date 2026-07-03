import { createClient } from "@supabase/supabase-js";

/**
 * URL permanence ledger (public.slug_aliases): every renamed or merged public
 * path gets one row (old_path -> new_path). Dynamic routes consult this on a
 * miss BEFORE notFound(), so old links survive any restructuring as 308s.
 * Sitemaps must never list an old_path.
 *
 * Fail-soft by design: a ledger outage must never take pages down, so any
 * error resolves to null (plain 404) rather than throwing.
 */
export async function resolveAlias(path: string): Promise<string | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from("slug_aliases")
      .select("new_path")
      .eq("old_path", path)
      .maybeSingle();
    return data?.new_path ?? null;
  } catch {
    return null;
  }
}
