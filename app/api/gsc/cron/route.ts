import { NextResponse } from "next/server";
import { createSign } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * /api/gsc/cron — pulls Search Console into mt_gsc_daily + mt_gsc_totals.
 *
 * worker/gsc-pull.py did this by hand and had no schedule anywhere: no Vercel
 * cron, no launchd job, no crontab entry. It was last run 2026-07-10 and the admin
 * panel sat 24 days stale until someone noticed. This is the same pull with a
 * clock attached.
 *
 * TWO dimensions on purpose, because one of them cannot answer the question:
 *   ["page","query"] → mt_gsc_daily. The breakdown the panel's query and page
 *      lists need. It structurally EXCLUDES anonymized queries — Google withholds
 *      rare and personal query strings — so summing it gives a floor, not a total.
 *      Measured 2026-08-03: 4 impressions over 14 days against a real ~130.
 *   ["date"]        → mt_gsc_totals (migration 0119). Returns the true daily
 *      number, anonymized queries included. The panel's series and 7-day totals
 *      read from here.
 *
 * Window is deliberately short and re-upserted every run. Search Console data
 * lags ~2 days and keeps settling for about a day after that, so re-fetching the
 * last few days is not waste — it is how the numbers become final. Both writes are
 * upserts keyed on their primary keys, so running twice changes nothing.
 *
 * Auth is required, not optional: this writes to the database and spends an
 * external API quota, so an unauthenticated trigger is abuse. Vercel sends
 * `Authorization: Bearer $CRON_SECRET` on scheduled invocations.
 *
 * Needs GSC_SA_JSON in the environment — the whole service-account key file as a
 * single JSON string. worker/gsc-sa.json is gitignored and not readable from a
 * lambda, so the value has to live in project env. Missing key returns 503 with
 * a plain message rather than throwing, so a half-configured deploy is obvious in
 * the cron log instead of silently doing nothing.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PROPERTY = process.env.GSC_PROPERTY || "sc-domain:metatake.net";
const DAYS = 5;      // GSC lags ~2 days; re-upserting the tail is how it finalises
const LAG_DAYS = 2;

const b64url = (v: string | Buffer) => Buffer.from(v).toString("base64url");

async function accessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${signer.sign(sa.private_key, "base64url")}`;

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!r.ok) throw new Error(`token: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  return ((await r.json()) as { access_token: string }).access_token;
}

type Row = { keys: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };

async function query(token: string, day: string, dimensions: string[], rowLimit: number): Promise<Row[]> {
  const endpoint =
    "https://www.googleapis.com/webmasters/v3/sites/" +
    encodeURIComponent(PROPERTY) + "/searchAnalytics/query";
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ startDate: day, endDate: day, dimensions, rowLimit, startRow: 0 }),
  });
  if (!r.ok) throw new Error(`searchAnalytics ${dimensions.join("+")} ${day}: HTTP ${r.status}`);
  return ((await r.json()) as { rows?: Row[] }).rows ?? [];
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "auth" }, { status: 401 });
  }
  const raw = process.env.GSC_SA_JSON;
  if (!raw) {
    return NextResponse.json(
      { error: "GSC_SA_JSON is not set — add the service-account key JSON to project env" },
      { status: 503 },
    );
  }

  let token: string;
  try {
    token = await accessToken(JSON.parse(raw));
  } catch (e) {
    return NextResponse.json({ error: `auth to Google failed: ${(e as Error).message}` }, { status: 502 });
  }

  const db = createAdminClient();
  const end = new Date(Date.now() - LAG_DAYS * 86400000);
  const out: { day: string; rows: number; impressions: number; clicks: number }[] = [];
  const errors: string[] = [];

  for (let i = 0; i < DAYS; i++) {
    const day = new Date(end.getTime() - i * 86400000).toISOString().slice(0, 10);
    try {
      // True totals first — this is the number the panel shows, and it is one row.
      const [tot] = await query(token, day, ["date"], 10);
      const totals = {
        day,
        clicks: Math.round(tot?.clicks ?? 0),
        impressions: Math.round(tot?.impressions ?? 0),
        ctr: tot?.ctr ?? null,
        position: tot?.position ?? null,
      };
      await db.from("mt_gsc_totals").upsert(totals, { onConflict: "day" });

      // Then the page+query breakdown for the lists.
      const rows = await query(token, day, ["page", "query"], 25000);
      if (rows.length) {
        const payload = rows.map((r) => ({
          day,
          page: r.keys[0].slice(0, 500),
          query: r.keys[1].slice(0, 300),
          clicks: Math.round(r.clicks ?? 0),
          impressions: Math.round(r.impressions ?? 0),
          ctr: r.ctr ?? null,
          position: r.position ?? null,
        }));
        for (let j = 0; j < payload.length; j += 1000) {
          await db.from("mt_gsc_daily").upsert(payload.slice(j, j + 1000), { onConflict: "day,page,query" });
        }
      }
      out.push({ day, rows: rows.length, impressions: totals.impressions, clicks: totals.clicks });
    } catch (e) {
      // One bad day never kills the run — the next scheduled pass re-covers it.
      errors.push(`${day}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({ property: PROPERTY, days: out, errors });
}
