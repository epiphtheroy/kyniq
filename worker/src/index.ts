/**
 * Kyniq Pipeline Worker — standalone service
 *
 * Polls the Supabase `jobs` queue, runs the generate→verify→gate graph,
 * writes results back. Runs outside Vercel (Railway/Render/Fly/cron).
 *
 * v2: Heartbeat writes to agent_activity, step tracking on jobs.
 *
 * Usage: DOTENV_CONFIG_PATH=../.env.local tsx src/index.ts
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { processJob, writeHeartbeat } from "./graph.js";

// ── Supabase (service role) ───────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
});

// ── Worker ID ─────────────────────────────────────────────────────

const WORKER_ID = `worker-${process.pid}-${Date.now()}`;
const POLL_INTERVAL_MS = 10_000; // 10 seconds

// ── Daily counters (reset at midnight) ────────────────────────────

let todayPublished = 0;
let todayCost = 0;
let todayDate = new Date().toISOString().slice(0, 10);

function resetDailyIfNeeded(): void {
  const now = new Date().toISOString().slice(0, 10);
  if (now !== todayDate) {
    todayPublished = 0;
    todayCost = 0;
    todayDate = now;
  }
}

// ── Queue polling ─────────────────────────────────────────────────

async function claimJob(): Promise<string | null> {
  // Atomic claim: only one worker gets the job
  const { data, error } = await supabase
    .from("jobs")
    .update({
      status: "claimed",
      claimed_by: WORKER_ID,
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .select("id")
    .single();

  if (error || !data) return null;
  return data.id;
}

async function isWorkerPaused(): Promise<boolean> {
  const { data } = await supabase
    .from("pipeline_config")
    .select("value")
    .eq("key", "worker_state")
    .single();

  return (data?.value as { paused?: boolean })?.paused === true;
}

async function pollLoop(): Promise<void> {
  console.log(`[${WORKER_ID}] Pipeline worker started. Polling every ${POLL_INTERVAL_MS / 1000}s`);

  // Initial heartbeat
  await writeHeartbeat(supabase, WORKER_ID, "idle", "worker started, waiting for jobs", null, 0, 0);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      resetDailyIfNeeded();

      // Check if paused
      if (await isWorkerPaused()) {
        console.log("[worker] Paused — skipping poll");
        await writeHeartbeat(supabase, WORKER_ID, "paused", "paused by admin", null, todayPublished, todayCost);
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      // Idle heartbeat (less frequently — every 6th poll = ~60s)
      const jobId = await claimJob();

      if (!jobId) {
        // Periodic idle heartbeat
        await writeHeartbeat(supabase, WORKER_ID, "idle", "waiting for jobs", null, todayPublished, todayCost);
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      console.log(`[worker] Claimed job ${jobId}`);

      // Mark running
      await supabase
        .from("jobs")
        .update({ status: "running", updated_at: new Date().toISOString() })
        .eq("id", jobId);

      await writeHeartbeat(supabase, WORKER_ID, "running", `processing job ${jobId.slice(0, 8)}…`, jobId, todayPublished, todayCost);

      try {
        const result = await processJob(jobId, supabase, WORKER_ID);

        // Update daily counters
        todayPublished += result.questions_published;
        todayCost += result.total_cost_usd;

        await supabase
          .from("jobs")
          .update({
            status: "done",
            result,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        await writeHeartbeat(supabase, WORKER_ID, "idle", `completed job — ${result.questions_published} published, ${result.questions_in_review} in review`, null, todayPublished, todayCost);

        console.log(`[worker] Job ${jobId} completed:`, JSON.stringify(result));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[worker] Job ${jobId} failed:`, msg);

        await supabase
          .from("jobs")
          .update({
            status: "failed",
            error: msg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        await writeHeartbeat(supabase, WORKER_ID, "idle", `job failed: ${msg.slice(0, 100)}`, null, todayPublished, todayCost);
      }
    } catch (err) {
      console.error("[worker] Poll error:", err);
      await sleep(POLL_INTERVAL_MS * 2);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Start ─────────────────────────────────────────────────────────

pollLoop().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
