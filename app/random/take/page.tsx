import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// A random individual take → land on its figure page, scrolled to the take.
export default async function RandomTake() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data } = await supabase.rpc("random_take_loc");
  const row = Array.isArray(data) ? data[0] : null;
  if (row?.film_slug && row?.figure_slug) {
    redirect(`/film/${row.film_slug}/figure/${row.figure_slug}#t-${row.take_id}`);
  }
  redirect("/meta-takes");
}
