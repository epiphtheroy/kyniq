/**
 * /api/crm/unsub?token=... — public 1-click unsubscribe (§9 P3). No auth. The
 * token is an HMAC over the contact email so only links we minted work. Writes
 * crm_suppression (permanent) + marks the contact unsubscribed. noindex.
 *
 * Token = base64url(email) + "." + base64url(hmacSha256(email)).
 * Mint with unsubToken(email) (exported for the renderer / server actions).
 */
import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secret(): string {
  return process.env.CRM_UNSUB_SECRET || process.env.REVALIDATION_SECRET || "crm-unsub-fallback";
}
function b64u(s: string | Buffer): string {
  return Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function unsubToken(email: string): string {
  const e = email.trim().toLowerCase();
  const sig = createHmac("sha256", secret()).update(e).digest();
  return `${b64u(e)}.${b64u(sig).slice(0, 22)}`;
}
function verify(token: string): string | null {
  const [ePart, sig] = token.split(".");
  if (!ePart || !sig) return null;
  let email: string;
  try { email = Buffer.from(ePart.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8"); }
  catch { return null; }
  const expected = b64u(createHmac("sha256", secret()).update(email).digest()).slice(0, 22);
  return sig === expected ? email : null;
}

function page(msg: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta name="robots" content="noindex"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;color:#1a1a1a"><p style="font-size:1.05rem;line-height:1.6">${msg}</p></body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" } }
  );
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const email = verify(token);
  if (!email) return page("This unsubscribe link is invalid or has expired.");

  const supabase = createAdminClient();
  await supabase.from("crm_suppression").upsert({ email, reason: "unsubscribe", source: "unsub_link" }, { onConflict: "email" });
  await supabase.from("crm_contacts").update({ stage: "unsubscribed" }).eq("email", email);

  return page("You have been unsubscribed. We will not email you again. Thank you.");
}
