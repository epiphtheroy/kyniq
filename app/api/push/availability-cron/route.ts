import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Availability-diff push worker (HANDOFF-모바일앱-프리워치.md §6.5) — Vercel cron.
 * "Your watchlisted film arrived on YOUR country's services" — the app's one push.
 *
 * Per opted-in user (user_prefs.push_enabled):
 *   watchlist(user_movies) × film_provider_index(country, sub/free tiers,
 *   optional provider filter) − push_sent ledger → notify once per
 *   (user, film, provider, country), then record in push_sent.
 * Runs daily; no-op while there are no opted-in users. Send path uses Expo's
 * public push API (no SDK). Fail-open per user — one bad row never kills the run.
 *
 * Mondays only (UTC), a second block sends the stale-watchlist nudge
 * (HANDOFF §16.3 / §9 P-D): one summary push per user whose watchlist has
 * rows older than STALE_DAYS. The Monday gate on this daily cron IS the
 * weekly cap — nudges are stateless, no push_sent rows (that ledger is keyed
 * by per-film provider arrivals), no new tables.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TIERS = ["flatrate", "free", "ads"];
const USER_CAP = 500;
const STALE_DAYS = 90;

type Prefs = { user_id: string; country_code: string; provider_ids: number[] | null };
type Fpi = { film_id: string; provider_id: number; provider_name: string; kind: string };

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "auth" }, { status: 401 });
  }

  const db = createAdminClient();
  const { data: prefRows, error: prefErr } = await db
    .from("user_prefs")
    .select("user_id, country_code, provider_ids")
    .eq("push_enabled", true)
    .limit(USER_CAP);
  if (prefErr) {
    return NextResponse.json({ error: prefErr.message }, { status: 500 });
  }
  const prefs = (prefRows ?? []) as Prefs[];
  if (!prefs.length) return NextResponse.json({ ok: true, users: 0, sent: 0 });

  const { data: tokenRows } = await db
    .from("push_tokens")
    .select("token, user_id")
    .in("user_id", prefs.map((p) => p.user_id));
  const tokensByUser = new Map<string, string[]>();
  for (const t of (tokenRows ?? []) as { token: string; user_id: string }[]) {
    tokensByUser.set(t.user_id, [...(tokensByUser.get(t.user_id) ?? []), t.token]);
  }

  const messages: { to: string; title: string; body: string; data: { url: string } }[] = [];
  const ledger: { user_id: string; film_id: string; provider_id: number; country_code: string }[] = [];
  let usersNotified = 0;

  for (const pref of prefs) {
    try {
      const tokens = tokensByUser.get(pref.user_id) ?? [];
      if (!tokens.length) continue;

      const { data: wl } = await db
        .from("user_movies")
        .select("film_id")
        .eq("user_id", pref.user_id)
        .eq("watchlist", true)
        .limit(500);
      const filmIds = ((wl ?? []) as { film_id: string }[]).map((r) => r.film_id);
      if (!filmIds.length) continue;

      let q = db
        .from("film_provider_index")
        .select("film_id, provider_id, provider_name, kind")
        .eq("country_code", pref.country_code)
        .in("kind", TIERS)
        .in("film_id", filmIds);
      if (pref.provider_ids?.length) q = q.in("provider_id", pref.provider_ids);
      const { data: fpiRows } = await q.limit(2000);
      const fpi = (fpiRows ?? []) as Fpi[];
      if (!fpi.length) continue;

      const { data: sentRows } = await db
        .from("push_sent")
        .select("film_id, provider_id")
        .eq("user_id", pref.user_id)
        .eq("country_code", pref.country_code)
        .in("film_id", [...new Set(fpi.map((f) => f.film_id))]);
      const seen = new Set(
        ((sentRows ?? []) as { film_id: string; provider_id: number }[]).map(
          (s) => `${s.film_id}:${s.provider_id}`,
        ),
      );
      const fresh = fpi.filter((f) => !seen.has(`${f.film_id}:${f.provider_id}`));
      if (!fresh.length) continue;

      const freshFilmIds = [...new Set(fresh.map((f) => f.film_id))];
      const { data: filmRows } = await db
        .from("films")
        .select("id, slug, title")
        .in("id", freshFilmIds.slice(0, 50));
      const filmMap = new Map(
        ((filmRows ?? []) as { id: string; slug: string; title: string }[]).map((f) => [f.id, f]),
      );

      const first = fresh[0];
      const firstFilm = filmMap.get(first.film_id);
      const body =
        freshFilmIds.length === 1 && firstFilm
          ? `${firstFilm.title} is now on ${first.provider_name}`
          : `${freshFilmIds.length} watchlisted films just arrived on your services`;
      const url =
        freshFilmIds.length === 1 && firstFilm
          ? `https://metatake.net/film/${firstFilm.slug}`
          : `https://metatake.net/what-to-watch`;

      for (const to of tokens) messages.push({ to, title: "Metatake", body, data: { url } });
      for (const f of fresh) {
        ledger.push({
          user_id: pref.user_id,
          film_id: f.film_id,
          provider_id: f.provider_id,
          country_code: pref.country_code,
        });
      }
      usersNotified++;
    } catch {
      /* fail-open per user */
    }
  }

  // ── Monday stale-watchlist nudge (HANDOFF §16.3 / §9 P-D) ────────────────
  // One summary push per opted-in user with watchlist rows added > 90 days
  // ago. head:true count per user keeps this under the PostgREST 1000-row cap
  // and transfers no rows. Same fail-open-per-user contract as above.
  let nudged = 0;
  if (new Date().getUTCDay() === 1) {
    const cutoff = new Date(Date.now() - STALE_DAYS * 86400_000).toISOString();
    for (const pref of prefs) {
      try {
        const tokens = tokensByUser.get(pref.user_id) ?? [];
        if (!tokens.length) continue;

        const { count } = await db
          .from("user_movies")
          .select("film_id", { count: "exact", head: true })
          .eq("user_id", pref.user_id)
          .eq("watchlist", true)
          .lt("added_at", cutoff);
        if (!count) continue;

        const body =
          count === 1
            ? "Still planning to watch 1 film?"
            : `Still planning to watch ${count} films?`;
        // Deep link stays a metatake.net URL (§13-2); /room is the
        // watchlist's web home.
        for (const to of tokens) {
          messages.push({ to, title: "Metatake", body, data: { url: "https://metatake.net/room" } });
        }
        nudged++;
      } catch {
        /* fail-open per user */
      }
    }
  }

  let sent = 0;
  for (let i = 0; i < messages.length; i += 100) {
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(messages.slice(i, i + 100)),
      });
      if (res.ok) sent += Math.min(100, messages.length - i);
    } catch {
      /* chunk fail-open */
    }
  }

  if (ledger.length) {
    for (let i = 0; i < ledger.length; i += 500) {
      await db
        .from("push_sent")
        .upsert(ledger.slice(i, i + 500), {
          onConflict: "user_id,film_id,provider_id,country_code",
          ignoreDuplicates: true,
        });
    }
  }

  return NextResponse.json({ ok: true, users: usersNotified, sent, ledgered: ledger.length, nudged });
}
