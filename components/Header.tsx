import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Masthead from "./Masthead";

async function getUser() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name, role")
      .eq("id", user.id)
      .single();

    return profile ? { ...profile, id: user.id } : null;
  } catch {
    return null;
  }
}

export default async function Header() {
  const user = await getUser();
  return <Masthead user={user} />;
}
