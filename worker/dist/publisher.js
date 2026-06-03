/**
 * Publisher Loop (Loop 2) — Cadence Engine
 *
 * Releases approved items to published on schedule with jitter.
 * Runs every ~5 minutes. Decoupled from the generator.
 *
 * Rules:
 * - Each entity publishes on its own scheduled_for time
 * - Question publishes before its answer (enforced)
 * - Daily cap + slow ramp (volume grows as site ages)
 * - No two items share the same published_at (1-minute spacing)
 * - published_at = real release time, never backdated
 * - On release: log content_events
 *
 * Usage: imported and run by the main worker index.ts
 */
const DEFAULT_CONFIG = {
    daily_publish_cap: 30,
    ramp_up_days: 14,
    ramp_start_cap: 5,
    jitter_min_minutes: 15,
    jitter_max_minutes: 120,
    answer_delay_minutes: 60,
    contribution_delay_minutes: 180,
    publish_interval_seconds: 300,
};
// ── Config loading ────────────────────────────────────────────────
async function loadPublisherConfig(supabase) {
    const { data } = await supabase
        .from("pipeline_config")
        .select("value")
        .eq("key", "publisher")
        .single();
    if (!data?.value)
        return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...data.value };
}
// ── Ramp calculation ──────────────────────────────────────────────
async function getEffectiveDailyCap(supabase, config) {
    // Find the earliest published_at to determine site age
    const { data: earliest } = await supabase
        .from("questions")
        .select("published_at")
        .eq("status", "published")
        .not("published_at", "is", null)
        .order("published_at", { ascending: true })
        .limit(1);
    if (!earliest || earliest.length === 0) {
        return config.ramp_start_cap;
    }
    const firstPublish = new Date(earliest[0].published_at);
    const daysSinceFirst = Math.floor((Date.now() - firstPublish.getTime()) / (24 * 60 * 60 * 1000));
    if (daysSinceFirst >= config.ramp_up_days) {
        return config.daily_publish_cap;
    }
    // Linear ramp from ramp_start_cap to daily_publish_cap over ramp_up_days
    const progress = daysSinceFirst / config.ramp_up_days;
    return Math.floor(config.ramp_start_cap + progress * (config.daily_publish_cap - config.ramp_start_cap));
}
// ── Today's publish count ─────────────────────────────────────────
async function getTodayPublishCount(supabase) {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase
        .from("content_events")
        .select("id", { count: "exact", head: true })
        .eq("event", "published")
        .eq("actor_kind", "system")
        .gte("created_at", todayStart.toISOString());
    return count ?? 0;
}
// ── Core publisher function ───────────────────────────────────────
export async function runPublisherCycle(supabase) {
    const config = await loadPublisherConfig(supabase);
    const effectiveCap = await getEffectiveDailyCap(supabase, config);
    const todayCount = await getTodayPublishCount(supabase);
    const remaining = effectiveCap - todayCount;
    if (remaining <= 0) {
        return { published: 0, skipped: 0, cap_remaining: 0 };
    }
    const now = new Date().toISOString();
    let published = 0;
    let skipped = 0;
    // 1. Publish questions that are due
    const { data: dueQuestions } = await supabase
        .from("questions")
        .select("id, film_id, title, scheduled_for")
        .eq("status", "approved")
        .not("scheduled_for", "is", null)
        .lte("scheduled_for", now)
        .order("scheduled_for", { ascending: true })
        .limit(remaining);
    for (const q of dueQuestions ?? []) {
        if (published >= remaining)
            break;
        // Publish the question
        const { error } = await supabase
            .from("questions")
            .update({
            status: "published",
            published_at: new Date().toISOString(), // real release time
        })
            .eq("id", q.id)
            .eq("status", "approved"); // atomic guard
        if (error) {
            skipped++;
            continue;
        }
        // Log content event
        await supabase.from("content_events").insert({
            entity_type: "question",
            entity_id: q.id,
            event: "published",
            actor_kind: "system",
            meta: { publisher: "cadence_engine", scheduled_for: q.scheduled_for },
        });
        published++;
        console.log(`[publisher] 📰 Published question: "${q.title}"`);
        // Small delay between publishes (no burst)
        await new Promise((r) => setTimeout(r, 2000));
    }
    // 2. Publish canonical answers whose question is already published
    const { data: dueAnswers } = await supabase
        .from("canonical_answers")
        .select("id, question_id, scheduled_for")
        .eq("status", "approved")
        .not("scheduled_for", "is", null)
        .lte("scheduled_for", now)
        .order("scheduled_for", { ascending: true })
        .limit(remaining - published);
    for (const a of dueAnswers ?? []) {
        if (published >= remaining)
            break;
        // Check that the question is published first (ordering rule)
        const { data: question } = await supabase
            .from("questions")
            .select("status")
            .eq("id", a.question_id)
            .single();
        if (question?.status !== "published") {
            skipped++;
            continue; // question not published yet — wait
        }
        const { error } = await supabase
            .from("canonical_answers")
            .update({
            status: "published",
            published_at: new Date().toISOString(),
        })
            .eq("id", a.id)
            .eq("status", "approved");
        if (error) {
            skipped++;
            continue;
        }
        await supabase.from("content_events").insert({
            entity_type: "canonical_answer",
            entity_id: a.id,
            event: "published",
            actor_kind: "system",
            meta: { publisher: "cadence_engine", question_id: a.question_id },
        });
        published++;
        console.log(`[publisher] 📝 Published answer for question ${a.question_id.slice(0, 8)}…`);
        await new Promise((r) => setTimeout(r, 2000));
    }
    // 3. Publish contributions whose question is already published
    const { data: dueContribs } = await supabase
        .from("contributions")
        .select("id, question_id, scheduled_for")
        .eq("status", "approved")
        .not("scheduled_for", "is", null)
        .lte("scheduled_for", now)
        .order("scheduled_for", { ascending: true })
        .limit(remaining - published);
    for (const c of dueContribs ?? []) {
        if (published >= remaining)
            break;
        const { data: question } = await supabase
            .from("questions")
            .select("status")
            .eq("id", c.question_id)
            .single();
        if (question?.status !== "published") {
            skipped++;
            continue;
        }
        const { error } = await supabase
            .from("contributions")
            .update({
            status: "published",
            published_at: new Date().toISOString(),
        })
            .eq("id", c.id)
            .eq("status", "approved");
        if (error) {
            skipped++;
            continue;
        }
        await supabase.from("content_events").insert({
            entity_type: "contribution",
            entity_id: c.id,
            event: "published",
            actor_kind: "system",
            meta: { publisher: "cadence_engine", question_id: c.question_id },
        });
        published++;
        console.log(`[publisher] 💬 Published contribution for question ${c.question_id.slice(0, 8)}…`);
        await new Promise((r) => setTimeout(r, 2000));
    }
    if (published > 0) {
        console.log(`[publisher] Cycle done: ${published} published, ${skipped} skipped, ${remaining - published} cap remaining`);
    }
    return { published, skipped, cap_remaining: remaining - published };
}
//# sourceMappingURL=publisher.js.map