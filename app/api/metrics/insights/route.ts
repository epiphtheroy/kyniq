/**
 * /api/metrics/insights — runs the rule-based insight generator
 * (mt_generate_insights, migration 0060) and stamps a '_run' marker.
 *
 * Called by: Vercel cron every 30 min (vercel.json), the /admin/metrics page
 * when the feed is stale, or manually (?key=REVALIDATION_SECRET).
 * A 20-minute guard makes stray triggers harmless.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { runHandshakes } from "@/lib/bots/handshake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_INTERVAL_MS = 20 * 60 * 1000;

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

  const supabase = createAdminClient();

  const { data: last } = await supabase
    .from("mt_insights")
    .select("ts")
    .eq("kind", "_run")
    .order("ts", { ascending: false })
    .limit(1);
  const lastTs = last?.[0]?.ts ? new Date(last[0].ts).getTime() : 0;
  if (Date.now() - lastTs < MIN_INTERVAL_MS && !req.nextUrl.searchParams.get("force")) {
    return NextResponse.json({ skipped: true, last_run: last?.[0]?.ts });
  }

  const { data: inserted, error } = await supabase.rpc("mt_generate_insights");

  // Same cadence, same guard: run the autonomous bot detector. It flags stealth
  // scrapers, auto-blocks them (middleware enforces bot_blocks), and lets 24h-
  // quiet blocks expire. Isolated so a failure never affects the insight feed.
  let botBlocks = 0;
  try {
    const { data: bb } = await supabase.rpc("mt_detect_bots");
    botBlocks = bb ?? 0;
  } catch {
    /* best-effort */
  }

  // Same cadence again: the layer-1 uncovered-intent detector (0079,
  // docs/PLAN-intent-coverage.md §1). Folds fresh GSC (page, query) demand
  // into intent_queue for the coverage waves. Isolated the same way.
  let intentNew = 0;
  try {
    const { data: iq } = await supabase.rpc("mt_intent_scan");
    intentNew = iq ?? 0;
  } catch {
    /* best-effort */
  }

  // Same cadence again: politely visit back a few crawlers that declared a URL
  // (lib/bots/handshake) so metatake.net lands in their logs. Robots-respecting,
  // one visit per host per 30 days. Isolated so a failure never affects insights.
  let handshakes = 0;
  try {
    const hs = await runHandshakes(4);
    handshakes = hs.done;
  } catch {
    /* best-effort */
  }

  // Same cadence again: roll up the AI-usage ledgers (mcp_calls + api_calls) into
  // usage_daily / crawler_daily and GC raw rows past retention (migration 0100,
  // HANDOFF-AI사용현황-어드민 §4). Isolated so a failure never affects the feed.
  try {
    await supabase.rpc("usage_rollup");
  } catch {
    /* best-effort */
  }

  await supabase.from("mt_insights").insert({
    kind: "_run",
    key: "run:" + new Date().toISOString().slice(0, 19),
    line: "",
  });

  return NextResponse.json({
    inserted: inserted ?? 0,
    bot_blocks: botBlocks,
    intent_new: intentNew,
    handshakes,
    error: error?.message ?? null,
  });
}
