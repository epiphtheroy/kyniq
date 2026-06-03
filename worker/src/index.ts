/**
 * Kyniq Pipeline Worker — standalone service
 *
 * Polls the Supabase `jobs` queue, runs the generate→verify→gate graph,
 * writes results back. Runs outside Vercel (Railway/Render/Fly/cron).
 *
 * v3: Autonomous daily scheduler — when the manual queue is empty,
 *     auto-selects films from the pipeline list and enqueues jobs.
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
const SCHEDULER_INTERVAL_MS = 60 * 60 * 1000; // 1 hour between scheduler runs

// ── Daily counters (reset at midnight) ────────────────────────────

let todayPublished = 0;
let todayCost = 0;
let todayJobsEnqueued = 0;
let todayDate = new Date().toISOString().slice(0, 10);
let lastSchedulerRun = 0; // timestamp of last scheduler run

function resetDailyIfNeeded(): void {
  const now = new Date().toISOString().slice(0, 10);
  if (now !== todayDate) {
    todayPublished = 0;
    todayCost = 0;
    todayJobsEnqueued = 0;
    todayDate = now;
  }
}

// ── Queue polling ─────────────────────────────────────────────────

async function claimJob(): Promise<string | null> {
  // Two-step claim: find oldest queued, then atomically claim it.
  // Supabase PostgREST doesn't support update().order().limit().

  // Step 1: Find the oldest queued job
  const { data: candidates, error: findErr } = await supabase
    .from("jobs")
    .select("id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);

  if (findErr || !candidates || candidates.length === 0) return null;

  const candidateId = candidates[0].id;

  // Step 2: Atomically claim it (eq on both id AND status='queued' ensures no race)
  const { data, error } = await supabase
    .from("jobs")
    .update({
      status: "claimed",
      claimed_by: WORKER_ID,
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", candidateId)
    .eq("status", "queued") // only succeeds if still queued (atomic guard)
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

// ── Autonomous daily scheduler ────────────────────────────────────

async function getDailyCap(): Promise<number> {
  const { data } = await supabase
    .from("pipeline_config")
    .select("value")
    .eq("key", "rate_limits")
    .single();

  const limits = data?.value as { daily_films?: number } | null;
  return limits?.daily_films ?? 20;
}

/**
 * Autonomous scheduler: when the manual queue is empty, pick the next
 * batch of pipeline films and enqueue jobs for them.
 *
 * Runs at most once per SCHEDULER_INTERVAL_MS. Respects daily cap.
 */
async function runScheduler(): Promise<void> {
  const now = Date.now();
  if (now - lastSchedulerRun < SCHEDULER_INTERVAL_MS) return;
  lastSchedulerRun = now;

  const dailyCap = await getDailyCap();
  const remaining = dailyCap - todayJobsEnqueued;
  if (remaining <= 0) {
    console.log(`[scheduler] Daily cap reached (${dailyCap} films). Skipping.`);
    return;
  }

  // Check if there are already queued/running jobs (manual queue takes priority)
  const { count: pendingCount } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .in("status", ["queued", "claimed", "running"]);

  if ((pendingCount ?? 0) > 0) {
    console.log(`[scheduler] ${pendingCount} jobs still pending. Skipping auto-enqueue.`);
    return;
  }

  // Find films that need work: in_pipeline, under target, not currently being processed
  const batchSize = Math.min(remaining, 5); // Process 5 at a time max
  const { data: films, error } = await supabase
    .from("films")
    .select("id, title, questions_target, questions_published")
    .eq("in_pipeline", true)
    .in("pipeline_status", ["queued", "in_progress"])
    .order("questions_published", { ascending: true }) // Least-served first
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (error || !films || films.length === 0) {
    console.log("[scheduler] No pipeline films need work.");
    return;
  }

  console.log(`[scheduler] Auto-enqueuing ${films.length} films (daily: ${todayJobsEnqueued}/${dailyCap})`);

  for (const film of films) {
    const targetCount = Math.min(
      film.questions_target - film.questions_published,
      10 // Max 10 per job
    );

    if (targetCount <= 0) {
      // Film reached its target — mark done
      await supabase
        .from("films")
        .update({ pipeline_status: "done", last_processed_at: new Date().toISOString() })
        .eq("id", film.id);
      continue;
    }

    const { error: insertErr } = await supabase
      .from("jobs")
      .insert({
        film_id: film.id,
        target_count: targetCount,
        status: "queued",
        params: { threshold: 0.85, auto_scheduled: true },
      });

    if (!insertErr) {
      todayJobsEnqueued++;
      console.log(`[scheduler] Enqueued: ${film.title} (${targetCount} questions, ${film.questions_published}/${film.questions_target} done)`);

      // Mark film as in_progress
      await supabase
        .from("films")
        .update({ pipeline_status: "in_progress" })
        .eq("id", film.id);
    }
  }

  await writeHeartbeat(
    supabase, WORKER_ID, "idle",
    `scheduler enqueued ${films.length} films (${todayJobsEnqueued}/${dailyCap} today)`,
    null, todayPublished, todayCost
  );
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
        // No manual jobs — try the autonomous scheduler
        await runScheduler();

        // Try claiming again (scheduler may have enqueued something)
        const scheduledJobId = await claimJob();
        if (!scheduledJobId) {
          await writeHeartbeat(supabase, WORKER_ID, "idle", "waiting for jobs", null, todayPublished, todayCost);
          await sleep(POLL_INTERVAL_MS);
          continue;
        }
        // Fall through to process the scheduled job
        await processClaimedJob(scheduledJobId);
        continue;
      }

      await processClaimedJob(jobId);
    } catch (err) {
      console.error("[worker] Poll error:", err);
      await sleep(POLL_INTERVAL_MS * 2);
    }
  }
}

// ── Job execution (shared by manual + scheduled) ──────────────────

async function processClaimedJob(jobId: string): Promise<void> {
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

    // Update film's questions_published count
    const { data: jobData } = await supabase
      .from("jobs")
      .select("film_id")
      .eq("id", jobId)
      .single();

    if (jobData?.film_id && result.questions_published > 0) {
      // Count total published questions for this film
      const { count } = await supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("film_id", jobData.film_id)
        .eq("status", "published")
        .eq("source", "ai");

      const { data: filmData } = await supabase
        .from("films")
        .select("questions_target")
        .eq("id", jobData.film_id)
        .single();

      const published = count ?? 0;
      const target = filmData?.questions_target ?? 10;

      await supabase
        .from("films")
        .update({
          questions_published: published,
          last_processed_at: new Date().toISOString(),
          pipeline_status: published >= target ? "done" : "in_progress",
        })
        .eq("id", jobData.film_id);
    }

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
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Start ─────────────────────────────────────────────────────────

pollLoop().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
