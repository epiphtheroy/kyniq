/**
 * ipToPrefix — reduce a client IP to the CIDR block we block on.
 *
 * /24 for IPv4, /48 for IPv6: the granularity a datacenter scraper rotates
 * within. Used identically by the beacon ingest (records the prefix) and the
 * edge middleware (matches incoming requests), so the two must agree — keep
 * this the single source of truth. Pure, edge-safe (no Node APIs).
 */
export function ipToPrefix(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const raw = ip.split(",")[0].trim();
  if (!raw || raw === "anon" || raw === "127.0.0.1" || raw === "::1") return null;

  if (raw.includes(":")) {
    const hextets = raw.split(":");
    if (hextets.length < 3 || !hextets[0]) return null;
    return `${hextets[0]}:${hextets[1]}:${hextets[2]}::/48`;
  }

  const o = raw.split(".");
  if (o.length !== 4 || o.some((p) => !/^\d{1,3}$/.test(p))) return null;
  return `${o[0]}.${o[1]}.${o[2]}.0/24`;
}
