import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { connectConfigured, decryptToken, encryptToken } from "@/lib/connect/crypto";
import { getProvider, type ProviderTokens } from "@/lib/connect/providers";
import { commitNormalizedRows } from "@/lib/import/commit-core";

/**
 * Connect daily-diff sync worker (HANDOFF-커넥트-기록이관.md §4 / §6) — Vercel cron.
 * For every connected Trakt / TMDB / Simkl account, pull the member's library
 * (whole library in one fetch — no paging loop) and write it through the SAME
 * ledger as file imports (commitNormalizedRows → user_watch_log → user_movies,
 * invariant §6-4). Tokens are decrypted server-side only (§6-3) and never leave
 * this route; the app never sees them.
 *
 * Env-gated (§6): with no CONNECT_TOKEN_KEY the whole feature is not-configured,
 * so the cron no-ops. Fail-open per connection — one user's bad token or a
 * provider outage sets status='error' on that row and the sweep continues.
 *
 * Simkl covenant (§6-6): fetchLibrary checks /sync/activities + date_from
 * internally from the stored sync_cursor, returning rows:[] when nothing
 * changed — so we just hand it the cursor and never over-poll.
 *
 * Runs at 08:00 UTC, an hour before the availability push cron (09:00), to
 * spread daily load.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const POOL = 4;
const PAGE = 1000;

type ConnRow = {
  user_id: string;
  provider: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  account_ref: string | null;
  scope: string | null;
  sync_cursor: string | null;
  synced_films: number | null;
};

export async function GET(req: Request) {
  // Fail CLOSED: this route sweeps every connected user and hits external
  // provider APIs, so an unauthenticated trigger is abuse. Require CRON_SECRET
  // to be set AND matched — never run when it is absent (Vercel injects it on
  // scheduled invocations once the env var exists). Env-gate check comes first
  // so an unconfigured deployment leaks nothing about the secret.
  if (!connectConfigured()) {
    return NextResponse.json({ skipped: "not_configured" });
  }
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "auth" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Load every connected account, paginating past the PostgREST 1000-row cap.
  const conns: ConnRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("user_connections")
      .select(
        "user_id, provider, access_token, refresh_token, token_expires_at, account_ref, scope, sync_cursor, synced_films",
      )
      .eq("status", "connected")
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const batch = (data ?? []) as ConnRow[];
    conns.push(...batch);
    if (batch.length < PAGE) break;
  }

  const swept = conns.length;
  let updatedUsers = 0;
  let errors = 0;

  async function syncOne(row: ConnRow): Promise<void> {
    try {
      const provider = getProvider(row.provider);
      if (!provider || !provider.configured()) return; // env-gated off → skip, not an error

      const accessToken = decryptToken(row.access_token);
      if (!accessToken) throw new Error("token decrypt failed");

      // scope column carries {s:scope, r:redirect_uri} JSON (see /callback).
      // Trakt's refresh grant validates redirect_uri against the one used at
      // authorization — the app's deep link, NOT a synthesized site callback —
      // so read it back here exactly like the manual /sync path does.
      let scopeStr: string | null = row.scope;
      let redirectUri = "";
      if (row.scope) {
        try {
          const j = JSON.parse(row.scope) as { s?: string | null; r?: string | null };
          if (j && (j.s !== undefined || j.r !== undefined)) {
            scopeStr = j.s ?? null;
            redirectUri = j.r ?? "";
          }
        } catch {
          /* legacy plain scope string */
        }
      }

      let tokens: ProviderTokens = {
        accessToken,
        refreshToken: decryptToken(row.refresh_token),
        expiresAt: row.token_expires_at,
        accountRef: row.account_ref,
        scope: scopeStr,
      };

      // Refresh when the access token is at/near expiry (Trakt ~24h). TMDB/Simkl
      // don't expire and their refresh() returns null, so this is a no-op there.
      const nearExpiry =
        !!tokens.expiresAt && new Date(tokens.expiresAt).getTime() <= Date.now() + 5 * 60_000;
      if (nearExpiry) {
        const fresh = await provider.refresh(tokens, redirectUri);
        if (fresh) {
          tokens = { ...tokens, ...fresh };
          await admin
            .from("user_connections")
            .update({
              access_token: encryptToken(fresh.accessToken),
              refresh_token: fresh.refreshToken
                ? encryptToken(fresh.refreshToken)
                : row.refresh_token,
              token_expires_at: fresh.expiresAt ?? null,
              scope: fresh.scope ?? row.scope,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", row.user_id)
            .eq("provider", row.provider);
        }
      }

      // Whole library in one fetch (providers page internally); Simkl gates on
      // its cursor and returns rows:[] when nothing changed.
      const { rows, cursor } = await provider.fetchLibrary(tokens, row.sync_cursor);
      const { stats } = await commitNormalizedRows(admin, row.user_id, rows, row.provider, {});

      await admin
        .from("user_connections")
        .update({
          status: "connected",
          last_sync_at: new Date().toISOString(),
          sync_cursor: cursor ?? row.sync_cursor,
          synced_films: (row.synced_films ?? 0) + stats.added,
          error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", row.user_id)
        .eq("provider", row.provider);

      updatedUsers++;
    } catch (e) {
      errors++;
      try {
        await admin
          .from("user_connections")
          .update({
            status: "error",
            error: (e instanceof Error ? e.message : String(e)).slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", row.user_id)
          .eq("provider", row.provider);
      } catch {
        /* even the error write is fail-open — never let one row kill the sweep */
      }
    }
  }

  // Bounded-concurrency sweep: POOL workers draining a shared index. JS is
  // single-threaded, so the counter increments above interleave safely.
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(POOL, conns.length) }, async () => {
      while (next < conns.length) {
        const idx = next++;
        await syncOne(conns[idx]);
      }
    }),
  );

  return NextResponse.json({ swept, updated_users: updatedUsers, errors });
}
