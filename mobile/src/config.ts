import Constants from "expo-constants";

// Public endpoints only. The Supabase anon key is public by design (RLS enforces
// access); it is the same key the website ships to every browser.
export const METATAKE_BASE =
  process.env.EXPO_PUBLIC_METATAKE_BASE ?? "https://metatake.net";

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://jvgarcqrtsmgfimdcwgo.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2Z2FyY3FydHNtZ2ZpbWRjd2dvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MDA5NjEsImV4cCI6MjA5NTk3Njk2MX0.LXuvN93cs0WeEWo8yuuwPcEV_baVZ3-6qcr6KBoGwiY";

/**
 * What the beacon reports as `app_v`.
 *
 * This was a hand-written literal and it drifted: app.json went to 1.0.1 on
 * 2026-09-04 and this line did not, so every app event since has claimed to come
 * from 1.0.0. That is not cosmetic — telling a build that carries a change from
 * one that does not is the whole point of the field, and a frozen literal makes
 * every before/after comparison a lie. Read it from the manifest instead, where
 * one number governs the version, the runtimeVersion policy and this.
 */
export const APP_VERSION: string = Constants.expoConfig?.version ?? "0.0.0";
export const PAYLOAD_V = 2; // BFF payload contract version this client understands (v2 adds judgment signals; all additive, v1 servers degrade gracefully)

export const TMDB_IMG = "https://image.tmdb.org/t/p";
