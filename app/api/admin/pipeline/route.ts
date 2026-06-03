import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Pipeline API — now enqueues jobs for the worker instead of running inline.
 * POST creates a job in the `jobs` queue; the worker picks it up.
 */
export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let filmId: string;
  let targetCount: number;
  let threshold: number;

  if (contentType.includes("application/json")) {
    const body = await request.json();
    filmId = body.film_id;
    targetCount = Math.min(body.target_count ?? 10, 20);
    threshold = body.threshold ?? 0.85;
  } else {
    const body = await request.formData();
    filmId = body.get("film_id") as string;
    targetCount = Math.min(parseInt((body.get("target_count") as string) ?? "10"), 20);
    threshold = parseFloat((body.get("threshold") as string) ?? "0.85");
  }

  if (!filmId) {
    return NextResponse.json({ error: "Missing film_id" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Create job in the queue
  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      film_id: filmId,
      target_count: targetCount,
      status: "queued",
      params: { threshold },
      created_by: admin.id,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Failed to enqueue job: ${error.message}` },
      { status: 500 }
    );
  }

  // Redirect for form submissions
  const referer = request.headers.get("referer");
  if (referer && contentType.includes("form")) {
    return NextResponse.redirect(referer, 303);
  }

  return NextResponse.json({
    ok: true,
    job_id: job.id,
    message: "Job enqueued — the worker will process it shortly.",
  });
}
