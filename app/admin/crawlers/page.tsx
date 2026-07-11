/**
 * /admin/crawlers — who crawls metatake.net, and our visit-back handshakes.
 *
 * Reads mt_crawler_visits / mt_crawler_handshakes (migration 0081).
 * Collection: middleware.ts → /api/bots/observe. Visit-back: lib/bots/handshake
 * (piggybacked on the 30-min insights cron; also /api/bots/handshake?key=…).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Visit = {
  bot_name: string | null;
  ua: string;
  declared_host: string | null;
  ip_prefix: string | null;
  sample_path: string | null;
  hits: number;
  last_seen: string;
};
type Handshake = {
  host: string;
  target_url: string;
  status: string;
  http_status: number | null;
  reason: string | null;
  attempts: number;
  last_attempt: string | null;
};

const fmt = (s: string | null) => (s ? new Date(s).toISOString().slice(0, 16).replace("T", " ") : "—");

const STATUS_COLOR: Record<string, string> = {
  done: "#137333",
  pending: "#8a6d00",
  robots_blocked: "#9aa0a6",
  skipped: "#9aa0a6",
  error: "#b3261e",
};

export default async function CrawlersPage() {
  const admin = await getAdminUser();
  if (!admin) notFound();

  const sb = createAdminClient();
  const [{ data: visits }, { data: handshakes }] = await Promise.all([
    sb.from("mt_crawler_visits").select("*").order("last_seen", { ascending: false }).limit(300),
    sb.from("mt_crawler_handshakes").select("*").order("last_attempt", { ascending: false, nullsFirst: true }).limit(300),
  ]);
  const V = (visits ?? []) as Visit[];
  const H = (handshakes ?? []) as Handshake[];
  const done = H.filter((h) => h.status === "done").length;

  const th: React.CSSProperties = { textAlign: "left", padding: "6px 10px", borderBottom: "2px solid #ddd", fontSize: 12, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "6px 10px", borderBottom: "1px solid #eee", fontSize: 13, verticalAlign: "top" };

  return (
    <div className="mt">
      <div className="mt-wrap" style={{ maxWidth: 1100 }}>
        <div className="mt-crumb"><Link href="/admin/metrics">Metrics</Link></div>
        <h1 className="mt-h1">Who crawls us</h1>
        <p className="mt-laconic">
          {V.length} crawler{V.length === 1 ? "" : "s"} observed · {H.length} host
          {H.length === 1 ? "" : "s"} eligible for a visit-back · {done} visited back
        </p>
        <p style={{ fontSize: 13, color: "#555" }}>
          When an identifiable crawler visits us, we record its User-Agent and the homepage URL it
          declares, then MetatakeBot visits that URL once (robots-respecting, one per host / 30 days)
          so metatake.net lands in the operator&rsquo;s logs. Runs automatically every 30 minutes.
        </p>

        <h2 className="mt-h2">Visit-back handshakes</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={th}>Host</th><th style={th}>Status</th><th style={th}>HTTP</th>
                <th style={th}>Tries</th><th style={th}>Last attempt</th><th style={th}>Target / reason</th>
              </tr>
            </thead>
            <tbody>
              {H.length === 0 && <tr><td style={td} colSpan={6}>No handshakes yet — nothing has crawled us with a declared URL since this shipped.</td></tr>}
              {H.map((h) => (
                <tr key={h.host}>
                  <td style={td}><strong>{h.host}</strong></td>
                  <td style={{ ...td, color: STATUS_COLOR[h.status] ?? "#333", fontWeight: 600 }}>{h.status}</td>
                  <td style={td}>{h.http_status ?? "—"}</td>
                  <td style={td}>{h.attempts}</td>
                  <td style={td}>{fmt(h.last_attempt)}</td>
                  <td style={{ ...td, color: "#666", wordBreak: "break-all" }}>{h.reason ?? h.target_url}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-h2">Observed crawlers</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={th}>Bot</th><th style={th}>Declared host</th><th style={th}>Hits</th>
                <th style={th}>Last seen</th><th style={th}>IP /24</th><th style={th}>Sample path</th>
              </tr>
            </thead>
            <tbody>
              {V.length === 0 && <tr><td style={td} colSpan={6}>No crawlers observed yet.</td></tr>}
              {V.map((v) => (
                <tr key={v.ua}>
                  <td style={td}><strong>{v.bot_name ?? "?"}</strong><div style={{ color: "#999", fontSize: 11, maxWidth: 340, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.ua}</div></td>
                  <td style={td}>{v.declared_host ?? "—"}</td>
                  <td style={td}>{v.hits}</td>
                  <td style={td}>{fmt(v.last_seen)}</td>
                  <td style={td}>{v.ip_prefix ?? "—"}</td>
                  <td style={{ ...td, color: "#666" }}>{v.sample_path ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
