/**
 * /api/bots/observe — records that an identifiable crawler visited us, together
 * with its User-Agent and self-declared homepage URL. Called fire-and-forget
 * from middleware.ts (event.waitUntil) only for crawler UAs, so it never touches
 * a human request path.
 *
 * Writes to mt_crawler_visits (dedup by UA, hit counter) and seeds a pending
 * mt_crawler_handshakes row for each new declared host, via the
 * mt_crawler_observe() RPC (migration 0081). Service-role only; best-effort.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ipToPrefix } from "@/lib/ip-prefix";
import { parseCrawler, isObservableCrawler } from "@/lib/bots/identify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Only accept the internal middleware beacon.
    if (req.headers.get("x-mt-observe") !== "1") {
      return NextResponse.json({ ok: false }, { status: 204 });
    }
    const raw = await req.text();
    if (!raw || raw.length > 4096) return NextResponse.json({ ok: false });
    const b = JSON.parse(raw) as { ua?: string; ip?: string; path?: string };

    const ua = (b.ua ?? "").slice(0, 1024);
    if (!ua || !isObservableCrawler(ua)) return NextResponse.json({ ok: true });

    const { botName, declaredUrl, declaredHost } = parseCrawler(ua);
    const prefix = b.ip ? ipToPrefix(b.ip) : null;
    const path = typeof b.path === "string" ? b.path.slice(0, 300) : null;

    const sb = createAdminClient();
    await sb.rpc("mt_crawler_observe", {
      p_ua: ua,
      p_bot_name: botName,
      p_declared_url: declaredUrl,
      p_declared_host: declaredHost,
      p_ip_prefix: prefix,
      p_path: path,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }); // never surface errors to middleware
  }
}
