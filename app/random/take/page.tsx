import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RandomTake() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { count } = await supabase.from("meta_takes").select("id", { count: "exact", head: true }).eq("status", "published");
  if (!count || count === 0) redirect("/meta-takes");
  const offset = Math.floor(Math.random() * count);
  const { data } = await supabase.from("meta_takes").select("slug").eq("status", "published").range(offset, offset);
  const slug = data?.[0]?.slug;
  redirect(slug ? `/take/${slug}` : "/meta-takes");
}
