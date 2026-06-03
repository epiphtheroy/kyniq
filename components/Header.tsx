import Link from "next/link";
import Image from "next/image";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import UserMenu from "./UserMenu";
import SearchTypeahead from "./SearchTypeahead";

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

  return (
    <header className="site-header">
      <Link href="/" className="logo" aria-label="Kyniq home">
        <picture>
          <source
            srcSet="/kyniq-wordmark-dark.svg"
            media="(prefers-color-scheme: dark)"
          />
          <Image
            src="/kyniq-wordmark.svg"
            alt="Kyniq"
            width={80}
            height={26}
            priority
            style={{ height: 26, width: "auto" }}
          />
        </picture>
      </Link>

      <nav className="header-nav">
        <Link href="/film">Films</Link>
        <Link href="/director">Directors</Link>
      </nav>

      <SearchTypeahead />

      {user ? (
        <UserMenu username={user.username} displayName={user.display_name} role={user.role} />
      ) : (
        <Link href="/login" className="action-secondary">
          Sign in
        </Link>
      )}
    </header>
  );
}
