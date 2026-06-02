import { createClient } from "@supabase/supabase-js";

/**
 * Admin (service-role) Supabase client — server-only.
 * Bypasses RLS entirely. NEVER import this in client components.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. This client is server-only."
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
