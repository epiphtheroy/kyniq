/**
 * /api/metrics/insights — runs the rule-based insight generator
 * (mt_generate_insights, migration 0060) and stamps a '_run' marker.
 *
 * Called by: Vercel cron every 5 min (vercel.json), the /admin/metrics page
 * when the feed is stale, or manually (?key=REVALIDATION_SECRET).
 * A 20-minute guard makes stray triggers harmless — for the insight feed. The bot
 * detector sits ahead of that guard and runs on every invocation; see below.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import * as Sentry from "@sentry/nextjs";
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

  // The detector runs on EVERY invocation, deliberately ahead of the interval guard
  // below. The guard is right for the insight feed: the same lines regenerated five
  // times an hour are noise. It is wrong for the detector, which is a race. The fleet
  // that arrived 2026-08-30 spends a fresh /24 every handful of pageviews, so a
  // 30-minute cadence handed each prefix half an hour to read for free — measured
  // that morning, 184 prefixes in three hours and 33 of them blocked. The cron is now
  // every 5 minutes (vercel.json); everything past the guard still keeps its own
  // 20-minute floor, so this costs one RPC per run and nothing else.
  //
  // It flags stealth scrapers, auto-blocks them (middleware enforces bot_blocks), and
  // lets 24h-quiet blocks expire. Isolated so a failure never affects the feed.
  //
  // ⚠️ The catch below is not the safety net it looks like. A Supabase RPC
  // reports a SQL fault in `error`; it does not throw. Dropping `error` — as this
  // call did — means a detector that raises on every run reports botBlocks: 0 and
  // looks like a quiet week. That is exactly how the harvest guard stayed dead for
  // 24 days (see the docblock in lib/apiGuard.ts). Read `error`, say so out loud.
  let botBlocks = 0;
  let botDetectError: string | null = null;
  try {
    const { data: bb, error: bbErr } = await supabase.rpc("mt_detect_bots");
    if (bbErr) {
      botDetectError = bbErr.message;
      Sentry.captureException(new Error(`mt_detect_bots failed: ${bbErr.message}`), {
        level: "error",
        tags: { subsystem: "bot-sentinel" },
        extra: { hint: "auto bot detection is OFF until fixed — no new prefixes will be blocked" },
      });
    } else {
      botBlocks = bb ?? 0;
    }
  } catch (e) {
    botDetectError = e instanceof Error ? e.message : "unknown throw";
    Sentry.captureException(e, { level: "error", tags: { subsystem: "bot-sentinel" } });
  }

  const { data: last } = await supabase
    .from("mt_insights")
    .select("ts")
    .eq("kind", "_run")
    .order("ts", { ascending: false })
    .limit(1);
  const lastTs = last?.[0]?.ts ? new Date(last[0].ts).getTime() : 0;
  if (Date.now() - lastTs < MIN_INTERVAL_MS && !req.nextUrl.searchParams.get("force")) {
    // The detector above already ran; report it, or a 5-minute cron looks idle.
    return NextResponse.json({
      skipped: true,
      bot_blocks: botBlocks,
      bot_detect_error: botDetectError,
      last_run: last?.[0]?.ts,
    });
  }

  const { data: inserted, error } = await supabase.rpc("mt_generate_insights");

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
    bot_detect_error: botDetectError,
    intent_new: intentNew,
    handshakes,
    error: error?.message ?? null,
  });
}
