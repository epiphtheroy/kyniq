/**
 * Visit-back handshake worker.
 *
 * For each crawler that visited metatake.net and declared its own homepage URL,
 * our MetatakeBot fetches that URL ONCE (per host, per 30 days) so metatake.net
 * shows up in the crawler operator's logs — an honest "you visited us, here we
 * are" handshake. Guardrails:
 *   • only the URL the crawler itself declared (never a guessed/scanned address)
 *   • robots.txt is fetched and obeyed
 *   • one visit per host per 30 days, a few per run, with a small delay
 *   • cloud-infra hosts (no human operator) are skipped
 *
 * Driven by app/api/bots/handshake (manual/cron) and piggybacked on the existing
 * 30-min insights cron. State lives in mt_crawler_handshakes (migration 0081).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { METATAKE_UA, isVisitableHost } from "@/lib/bots/identify";

const RETRY_DAYS = 30;

type HandshakeRow = {
  id: number;
  host: string;
  target_url: string;
  status: string;
  attempts: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Minimal robots.txt matcher. Returns true unless a Disallow rule that
 * out-specifies any Allow rule matches `path` for our agent (or the `*` group).
 * Fetch failure / 4xx → treated as "allowed" (the standard convention).
 */
async function robotsAllows(host: string, path: string): Promise<boolean> {
  let body = "";
  try {
    const r = await fetch(`https://${host}/robots.txt`, {
      headers: { "User-Agent": METATAKE_UA },
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return true; // no usable robots → allowed
    body = (await r.text()).slice(0, 200_000);
  } catch {
    return true;
  }

  // Group rules by user-agent. Consecutive User-agent lines share the rules that
  // follow (standard robots grouping). Prefer an exact "metatakebot" group over "*".
  const groups: Record<string, { allow: string[]; disallow: string[] }> = {};
  let agents: string[] = [];
  let sawRule = false;
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === "user-agent") {
      if (sawRule) {
        agents = []; // a rule already closed the previous group → start a new one
        sawRule = false;
      }
      const ua = value.toLowerCase();
      agents.push(ua);
      groups[ua] ??= { allow: [], disallow: [] };
    } else if (field === "allow" || field === "disallow") {
      sawRule = true;
      for (const ua of agents) {
        groups[ua][field === "allow" ? "allow" : "disallow"].push(value);
      }
    }
  }

  const rules = groups["metatakebot"] ?? groups["*"];
  if (!rules) return true;

  const longest = (list: string[]) =>
    list
      .filter((p) => p !== "" && path.startsWith(p))
      .reduce((max, p) => Math.max(max, p.length), -1);

  // An empty Disallow means "allow all"; only non-empty prefixes block.
  const dis = longest(rules.disallow);
  if (dis < 0) return true;
  const alw = longest(rules.allow);
  return alw >= dis; // Allow ties/most-specific wins → allowed
}

async function visitOnce(url: string): Promise<{ http: number | null; reason: string }> {
  try {
    const r = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": METATAKE_UA,
        // A truthful referrer: this visit was prompted by the bot's own visit to us.
        Referer: "https://metatake.net/bot",
        From: "wonwoo@metatake.net",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    // Drain a little so the connection completes cleanly; ignore the body.
    await r.text().catch(() => "");
    return { http: r.status, reason: "" };
  } catch (e) {
    return { http: null, reason: e instanceof Error ? e.message.slice(0, 200) : "fetch failed" };
  }
}

export async function runHandshakes(limit = 4): Promise<{
  done: number;
  robots_blocked: number;
  skipped: number;
  error: number;
  visited: string[];
}> {
  const sb = createAdminClient();
  const cutoff = new Date(Date.now() - RETRY_DAYS * 86_400_000).toISOString();

  const { data, error } = await sb
    .from("mt_crawler_handshakes")
    .select("id,host,target_url,status,attempts")
    .in("status", ["pending", "done", "error"])
    .or(`last_attempt.is.null,last_attempt.lt.${cutoff}`)
    .order("last_attempt", { ascending: true, nullsFirst: true })
    .limit(limit);

  const out = { done: 0, robots_blocked: 0, skipped: 0, error: 0, visited: [] as string[] };
  if (error || !data?.length) return out;

  for (const row of data as HandshakeRow[]) {
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      last_attempt: now,
      attempts: (row.attempts ?? 0) + 1,
    };

    if (!isVisitableHost(row.host)) {
      patch.status = "skipped";
      patch.reason = "infra/self host";
      out.skipped++;
    } else {
      let targetPath = "/";
      try {
        targetPath = new URL(row.target_url).pathname || "/";
      } catch {
        /* keep "/" */
      }
      const allowed = await robotsAllows(row.host, targetPath);
      if (!allowed) {
        patch.status = "robots_blocked";
        patch.reason = "disallowed by robots.txt";
        out.robots_blocked++;
      } else {
        const { http, reason } = await visitOnce(row.target_url);
        if (http !== null) {
          patch.status = "done";
          patch.http_status = http;
          patch.reason = null;
          out.done++;
          out.visited.push(row.host);
        } else {
          patch.status = "error";
          patch.reason = reason;
          out.error++;
        }
      }
      await sleep(400); // politeness between distinct hosts
    }

    await sb.from("mt_crawler_handshakes").update(patch).eq("id", row.id);
  }

  return out;
}
