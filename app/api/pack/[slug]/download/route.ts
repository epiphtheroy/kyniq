import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  renderPackMarkdown,
  renderPackSelected,
  packFilename,
  type FilmPack,
  type PackSectionKey,
  PACK_SECTION_LABEL,
} from "@/lib/pack";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// GET /api/pack/{slug}/download            → status JSON { authed, remaining, limit, already }
// GET /api/pack/{slug}/download?dl=1&sections=a,b  → the .md file (attachment)
//
// The DOWNLOAD is the login-gated convenience (§ owner decision): copy is free
// everywhere, but saving a .md file needs sign-in and is capped at LIMIT distinct
// films per calendar month. Re-downloading a film already taken this month is
// free (does not consume quota).

const LIMIT = 10;
const ALL_KEYS = Object.keys(PACK_SECTION_LABEL) as PackSectionKey[];
const NOINDEX = { "x-robots-tag": "noindex" } as const;

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const u = new URL(req.url);
  const isDownload = u.searchParams.get("dl") === "1";

  const ssr = await createServerClient();
  const { data: { user } } = await ssr.auth.getUser();

  const admin = createAdminClient();

  // Resolve film id (needed for quota + ledger). Also gates Tier-1 eligibility.
  const { data: film } = await admin
    .from("films")
    .select("id, is_analyzed, visible")
    .eq("slug", slug)
    .maybeSingle();

  const eligible = !!film && film.is_analyzed === true && film.visible !== false;

  // Quota status (0 remaining if not signed in). `already` = ever downloaded
  // (all-time → free re-download); `remaining` counts only NEW films this month.
  let remaining = 0;
  let already = false;
  if (user && film) {
    const { data: cnt } = await admin.rpc("pack_new_films_this_month", { p_user: user.id });
    const { data: had } = await admin.rpc("pack_downloaded_film_ever", { p_user: user.id, p_film: film.id });
    already = !!had;
    remaining = Math.max(0, LIMIT - (typeof cnt === "number" ? cnt : 0));
  }

  if (!isDownload) {
    return NextResponse.json(
      { authed: !!user, limit: LIMIT, remaining, already, eligible },
      { headers: NOINDEX }
    );
  }

  // --- actual download ---
  if (!user) {
    return NextResponse.json({ error: "sign-in required", authed: false }, { status: 401, headers: NOINDEX });
  }
  if (!eligible || !film) {
    return NextResponse.json({ error: "No context pack for this film." }, { status: 404, headers: NOINDEX });
  }

  const { data, error } = await admin.rpc("film_context_pack", { p_slug: slug, p_tier: "full" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: NOINDEX });
  if (!data) return NextResponse.json({ error: "No context pack for this film." }, { status: 404, headers: NOINDEX });

  const pack = data as FilmPack;
  const keys = (u.searchParams.get("sections") || "")
    .split(",").map((s) => s.trim())
    .filter((s) => ALL_KEYS.includes(s as PackSectionKey)) as PackSectionKey[];

  // Atomically claim a quota slot + record the ledger row (advisory-locked per user,
  // so concurrent requests can't overshoot LIMIT; ever-downloaded films claim free).
  const { data: claimed } = await admin.rpc("pack_download_claim", {
    p_user: user.id, p_film: film.id, p_slug: slug,
    p_sections: keys.length ? keys : ALL_KEYS, p_fmt: "md",
  });
  if (claimed === false) {
    return NextResponse.json(
      { error: `Monthly download limit reached (${LIMIT}). Copying stays free; the limit resets next month.`, remaining: 0 },
      { status: 402, headers: NOINDEX }
    );
  }

  const md = keys.length ? renderPackSelected(pack, keys) : renderPackMarkdown(pack);
  const scope = keys.length && keys.length < ALL_KEYS.length ? "custom" : "full";
  const fname = packFilename(slug, scope, "md");

  return new NextResponse(md, {
    headers: {
      ...NOINDEX,
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${fname}"`,
      "cache-control": "private, no-store",
    },
  });
}
