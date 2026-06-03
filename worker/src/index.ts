/**
 * Kyniq Pipeline Worker — standalone service
 *
 * Polls the Supabase `jobs` queue, runs the generate→verify→gate graph,
 * writes results back. Runs outside Vercel (Railway/Render/Fly/cron).
 *
 * Usage: DOTENV_CONFIG_PATH=../.env.local tsx src/index.ts
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { processJob } from "./graph.js";

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

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      // Check if paused
      if (await isWorkerPaused()) {
        console.log("[worker] Paused — skipping poll");
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      const jobId = await claimJob();

      if (!jobId) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      console.log(`[worker] Claimed job ${jobId}`);

      // Mark running
      await supabase
        .from("jobs")
        .update({ status: "running", updated_at: new Date().toISOString() })
        .eq("id", jobId);

      try {
        const result = await processJob(jobId, supabase);

        await supabase
          .from("jobs")
          .update({
            status: "done",
            result,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

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
