"use client";

/**
 * ViewBeacon — fire-and-forget popularity counter for a meta take.
 * ISR caches the server render, so the server component can't reliably count
 * views; this client beacon increments a DB-native counter once per browser
 * session (sessionStorage dedupe) via the SECURITY DEFINER RPC. Independent of
 * Vercel Web Analytics.
 */

import { useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

export default function ViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    if (!slug) return;
    try {
      const k = `mtv:${slug}`;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
    } catch {
      /* private mode / storage disabled — still count */
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const sb = createClient(url, key);
    sb.rpc("increment_meta_take_views", { p_slug: slug }).then(
      () => {},
      () => {}
    );
  }, [slug]);
  return null;
}
