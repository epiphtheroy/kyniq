/**
 * GET /embed/takescore/{slug} — self-contained TakeScore badge as a full HTML
 * document, for <iframe> embedding (the no-JavaScript fallback to the
 * /api/v1/embed.js script badge). Served as a route handler (not a page) so it
 * escapes the site's root layout / footer and controls its own framing headers.
 * Links to the film page via target=_top so a click escapes the iframe.
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, "").slice(0, 200);
  const db = createAdminClient();

  let title = "";
  let score: number | null = null;
  try {
    const [{ data: film }, { data: ts }] = await Promise.all([
      db.from("films").select("title, year").eq("slug", safeSlug).maybeSingle(),
      db.rpc("takescore_for_slugs", { p_slugs: [safeSlug] }),
    ]);
    title = film?.title ? `${film.title}${film.year ? ` (${film.year})` : ""}` : "";
    const row = (Array.isArray(ts) ? ts : [])[0] as { ts?: number } | undefined;
    if (row && typeof row.ts === "number") score = Math.max(0, Math.round(row.ts));
  } catch { /* neutral badge */ }

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow">
<title>Metatake TakeScore${title ? " — " + esc(title) : ""}</title>
<style>html,body{margin:0;background:transparent}
.b{display:inline-flex;align-items:center;gap:.5em;text-decoration:none;
font:600 13px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c2029;background:#fff;
border:1px solid rgba(0,0,0,.14);border-radius:999px;padding:.45em .72em;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.n{font-weight:800;font-size:15px;color:#0f766e}.l{color:#3a3f4a}.x{color:#8a8f99;font-size:11px}.w{color:#b91c1c;font-weight:800}
@media (prefers-color-scheme:dark){.b{color:#e8eaed;background:#16181d;border-color:rgba(255,255,255,.16)}.l{color:#c4c8d0}.n{color:#2dd4bf}}</style></head>
<body><a class="b" href="https://metatake.net/film/${encodeURIComponent(safeSlug)}" target="_top" rel="noopener"
title="TakeScore${title ? " for " + esc(title) : ""} on Metatake — human-curated film criticism">
<span class="n">${score != null ? score : "&ndash;"}</span><span class="l">TakeScore</span><span class="x">on</span><span class="w">Metatake</span>
</a></body></html>`;

  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800",
      "x-robots-tag": "noindex",
      // explicitly framable anywhere (badge is meant to be embedded)
      "content-security-policy": "frame-ancestors *",
    },
  });
}
