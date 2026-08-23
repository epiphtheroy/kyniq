/**
 * /api/metrics/app — collector for the native app beacon (see mobile/src/lib/beacon.ts).
 *
 * POST { events: [{ t, name, arg?, props?, ts? }], sid, vid, platform, app_v }
 *   → mt_app_events rows (migration 0145).
 *
 * The app twin of /api/metrics, deliberately kept apart from it: mt_events
 * feeds every web number on /admin/metrics (and the 0120 bot classifier, which
 * would read app sessions as farms), so app traffic gets its own table and its
 * own panel rather than inflating the web ones.
 *
 * Identity: the device sends `vid`, already hashed on-device as
 * sha256(install_id | day). The raw install id never leaves the phone and the
 * hash rotates daily, so this counts daily actives without tracking anyone.
 * No IP is stored — geo comes from Vercel's headers, as on the web collector.
 *
 * Batched: the app flushes a few events per request, so this is nowhere near
 * the per-event volume of the web beacon.
 */
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = new Set(["screen", "tap", "action"]);
const MAX_EVENTS = 40;

// Same in-memory shape as /api/metrics. A phone batches, so the ceiling is
// generous per event but still bounds a misbehaving client.
const hits = new Map<string, number[]>();
const RATE_KEYS_MAX = 5000;
function rateLimited(key: string): boolean {
  const now = Date.now();
  if (!hits.has(key) && hits.size >= RATE_KEYS_MAX) {
    for (const [k, arr] of hits) {
      if (!arr.length || now - arr[arr.length - 1] > 60_000) hits.delete(k);
      if (hits.size < RATE_KEYS_MAX) break;
    }
    if (hits.size >= RATE_KEYS_MAX) hits.clear();
  }
  const arr = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > 30; // 30 batches/min from one device is already absurd
}

const ok = () => new Response(null, { status: 204 });
const str = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (!raw || raw.length > 16_384) return ok();
    const b = JSON.parse(raw) as Record<string, unknown>;

    const vid = str(b.vid, 64);
    const sid = str(b.sid, 64);
    if (!vid) return ok();
    if (rateLimited(vid)) return ok();

    const list = Array.isArray(b.events) ? b.events.slice(0, MAX_EVENTS) : [];
    if (!list.length) return ok();

    const platform = b.platform === "ios" || b.platform === "android" ? b.platform : null;
    const appV = str(b.app_v, 24);
    const city = req.headers.get("x-vercel-ip-city");
    const geo = {
      country: req.headers.get("x-vercel-ip-country"),
      region: req.headers.get("x-vercel-ip-country-region"),
      city: city ? decodeURIComponent(city) : null,
    };

    const rows = [];
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const e = item as Record<string, unknown>;
      const t = String(e.t ?? "");
      if (!TYPES.has(t)) continue;
      const name = str(e.name, 120);
      if (!name) continue;
      // Client timestamps are trusted only for ordering within a recent batch:
      // anything outside ±1 day of now falls back to server time.
      const clientTs = typeof e.ts === "number" && Math.abs(Date.now() - e.ts) < 86_400_000
        ? new Date(e.ts).toISOString()
        : undefined;
      rows.push({
        ...(clientTs ? { ts: clientTs } : {}),
        type: t,
        name,
        arg: str(e.arg, 200),
        visitor: vid,
        session: sid,
        platform,
        app_v: appV,
        ...geo,
        props: e.props && typeof e.props === "object" ? e.props : null,
      });
    }
    if (!rows.length) return ok();

    await createAdminClient().from("mt_app_events").insert(rows);
    return ok();
  } catch {
    return ok(); // the beacon must never surface errors to the app
  }
}
