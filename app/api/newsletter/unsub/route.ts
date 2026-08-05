/**
 * /api/newsletter/unsub?t=... — public one-click unsubscribe for the consumer
 * newsletter (HANDOFF-회원가입-전환-설계.md §8). No auth: the token is a stateless HMAC
 * over the subscriber email (scoped "|nl" so it can't collide with the CRM token),
 * so only links we minted work — no DB column needed. Flips newsletter_subscribers
 * .status to 'unsubscribed'. noindex.
 *
 * Mint with nlUnsubToken(email) here (JS) or the matching helper in worker/blog-send.py.
 */
import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secret(): string {
  return process.env.NEWSLETTER_UNSUB_SECRET || process.env.REVALIDATION_SECRET || "mt-nl-unsub-fallback";
}
function b64u(s: string | Buffer): string {
  return Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function nlUnsubToken(email: string): string {
  const e = email.trim().toLowerCase();
  const sig = createHmac("sha256", secret()).update(`${e}|nl`).digest();
  return `${b64u(e)}.${b64u(sig).slice(0, 22)}`;
}
function verify(token: string): string | null {
  const [ePart, sig] = token.split(".");
  if (!ePart || !sig) return null;
  let email: string;
  try { email = Buffer.from(ePart.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8"); }
  catch { return null; }
  const expected = b64u(createHmac("sha256", secret()).update(`${email}|nl`).digest()).slice(0, 22);
  return sig === expected ? email : null;
}

function page(msg: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html><head><meta name="robots" content="noindex"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe · Metatake</title></head><body style="font-family:Georgia,serif;max-width:34rem;margin:4rem auto;padding:0 1.2rem;color:#0D0D0D"><p style="color:#E3120B;font-weight:700;font-family:system-ui,sans-serif;letter-spacing:.02em">Metatake</p><p style="font-size:1.1rem;line-height:1.6">${msg}</p><p style="font-family:system-ui,sans-serif;font-size:.9rem;color:#6B6B6B"><a href="/" style="color:#6B6B6B">Return to Metatake</a></p></body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" } }
  );
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? req.nextUrl.searchParams.get("token") ?? "";
  const email = verify(token);
  if (!email) return page("This unsubscribe link is invalid or has expired.");
  try {
    const supabase = createAdminClient();
    await supabase.from("newsletter_subscribers").update({ status: "unsubscribed" }).eq("email", email);
  } catch { /* fault-soft — still confirm to the reader */ }
  return page("You&rsquo;re unsubscribed — the edition will stop landing in your inbox. Thank you for reading.");
}
