import { NextResponse } from "next/server";

/**
 * POST /api/revalidate
 *
 * On-demand ISR revalidation endpoint for the publisher loop.
 * Called by the worker after publishing content to refresh cached pages.
 *
 * Body: { paths: string[], secret: string }
 */
/**
 * GET /api/revalidate?secret=...&path=/about,/meta-takes
 * Same semantics as POST, for tooling that can only issue GETs.
 * (Added 2026-07-02 to evict ISR entries that persisted across deployments —
 * e.g. /about serving a pre-launch noindex prerender.)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret") ?? undefined;
  const expectedSecret = process.env.REVALIDATION_SECRET;
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }
  const paths = (url.searchParams.get("path") ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.startsWith("/"));
  if (paths.length === 0) {
    return NextResponse.json({ error: "Missing path param" }, { status: 400 });
  }
  const tags = (url.searchParams.get("tag") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  try {
    const { revalidatePath, revalidateTag } = await import("next/cache");
    for (const path of paths.slice(0, 20)) {
      revalidatePath(path);
    }
    // Page ISR entries and unstable_cache Data-Cache entries are invalidated
    // separately — the home bundle lives under the "home-v2" tag, so callers
    // must pass ?tag=home-v2 (alongside path=/) to force an immediate refresh.
    for (const tag of tags.slice(0, 20)) {
      revalidateTag(tag);
    }
    return NextResponse.json({ ok: true, revalidated: paths.length, paths, tags });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Revalidation failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { paths, tags, secret } = body as {
    paths?: string[];
    tags?: string[];
    secret?: string;
  };

  // Validate secret
  const expectedSecret = process.env.REVALIDATION_SECRET;
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    return NextResponse.json({ error: "Missing paths array" }, { status: 400 });
  }

  // Note: In Next.js App Router, on-demand revalidation uses revalidatePath/revalidateTag
  // from next/cache. Since this is a route handler, we import and call it.
  try {
    const { revalidatePath, revalidateTag } = await import("next/cache");

    for (const path of paths.slice(0, 20)) {
      revalidatePath(path);
    }
    // e.g. { paths: ["/"], tags: ["home-v2"] } after the nightly bundle rebuild.
    for (const tag of (Array.isArray(tags) ? tags : []).slice(0, 20)) {
      revalidateTag(tag);
    }

    return NextResponse.json({
      ok: true,
      revalidated: paths.length,
      paths,
      tags: Array.isArray(tags) ? tags : [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Revalidation failed" },
      { status: 500 }
    );
  }
}
