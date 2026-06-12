"use client";

/**
 * Header — client-side auth resolution.
 * Previously this was a server component calling cookies() +
 * supabase.auth.getUser() on EVERY request, which forced the whole
 * site into dynamic rendering (no ISR/edge cache) and added two
 * blocking network calls per page view. The user is now resolved in
 * the browser: pages render statically; the user menu hydrates in.
 */

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Masthead from "./Masthead";

type User = {
  id: string;
  username: string;
  display_name: string;
  role: string;
} | null;

export default function Header() {
  const [user, setUser] = useState<User>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser || cancelled) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, display_name, role")
          .eq("id", authUser.id)
          .single();
        if (profile && !cancelled) setUser({ ...profile, id: authUser.id } as User);
      } catch {
        /* logged-out view is fine */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return <Masthead user={user} />;
}
