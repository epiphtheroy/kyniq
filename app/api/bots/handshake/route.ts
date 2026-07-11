/**
 * /api/bots/handshake — runs the visit-back worker (lib/bots/handshake).
 *
 * Auth mirrors /api/metrics/insights: Vercel cron, ?key=REVALIDATION_SECRET, or
 * a logged-in admin. Also invoked best-effort from the insights cron so it runs
 * automatically every 30 min without a separate cron entry.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { runHandshakes } from "@/lib/bots/handshake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const fromCron =
    req.headers.get("x-vercel-cron") !== null ||
    (req.headers.get("user-agent") ?? "").startsWith("vercel-cron/");
  const key = req.nextUrl.searchParams.get("key");
  const keyOk = !!key && key === process.env.REVALIDATION_SECRET;
  if (!fromCron && !keyOk) {
    const admin = await getAdminUser();
    if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const limitParam = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 20) : 4;

  const result = await runHandshakes(limit);
  return NextResponse.json(result);
}
