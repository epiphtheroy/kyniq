/**
 * /api/radar/websub — WebSub (PubSubHubbub) callback for the YouTube channel
 * pool (정본: HANDOFF-키워드레이더.md §7.3).
 *
 * GET  = hub subscription verification → echo hub.challenge.
 * POST = new-video Atom push → park raw XML in radar_inbox (service role) and
 *        answer 200 immediately; radar/process_inbox.py parses it on the Mac.
 * Both require ?key=RADAR_WEBSUB_SECRET (baked into the callback URL we register).
 */
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function authed(req: NextRequest): boolean {
  const secret = process.env.RADAR_WEBSUB_SECRET;
  if (!secret) return true; // unset = open (dev); set it in prod
  return req.nextUrl.searchParams.get("key") === secret;
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return new Response("forbidden", { status: 403 });
  const sp = req.nextUrl.searchParams;
  const challenge = sp.get("hub.challenge");
  const mode = sp.get("hub.mode");
  if (challenge && (mode === "subscribe" || mode === "unsubscribe")) {
    return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new Response("ok", { status: 200 });
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return new Response("forbidden", { status: 403 });
  let xml = "";
  try {
    xml = await req.text();
  } catch {
    /* ignore */
  }
  if (!xml) return new Response("no body", { status: 400 });
  try {
    const sb = createAdminClient();
    await sb.from("radar_inbox").insert({ channel: "websub-youtube", payload: { xml } });
  } catch {
    // swallow — the hub retries on non-2xx, and we must not block; a dropped
    // push is reconciled by the daily channel-RSS sweep.
  }
  return new Response("", { status: 200 });
}
