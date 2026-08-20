#!/usr/bin/env node
/**
 * asc-sales-pull — App Store Connect daily download units → mt_app_downloads.
 *
 * Feeds the 📱 app panel on /admin/metrics (migration 0144). Owner-run: the
 * ASC .p8 private key stays on the owner's machine — it is never committed and
 * never becomes a Vercel env.
 *
 *   node worker/asc-sales-pull.mjs             # last 14 days
 *   node worker/asc-sales-pull.mjs --days 30
 *   node worker/asc-sales-pull.mjs --date 2026-08-18
 *
 * Credentials (defaults read from mobile/eas.json, override via env):
 *   ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_P8   — the API key used for eas submit
 *   ASC_VENDOR_NUMBER — one-time setup: App Store Connect → Payments and
 *     Financial Reports, the "Vendor #" at the top (e.g. 9xxxxxxx). Sales
 *     reports cannot be requested without it.
 *
 * Report semantics: Apple's daily SALES/SUMMARY report, dated in Pacific time,
 * available the next morning. Product type 1* = first-time download,
 * 3* = redownload, 7* = update. A 404 on a day at least 2 days old means zero
 * transactions — recorded as 0 so the panel can tell "0" from "not fetched".
 */
import { readFileSync } from "node:fs";
import { dirname, join, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { createSign, createPrivateKey } from "node:crypto";
import { gunzipSync } from "node:zlib";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);
const APPLE_APP_ID = "6792487455"; // Metatake (iOS)

// ── env: .env.local (same loader shape as apply-sql.py) ─────────────────────
for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#") || !t.includes("=")) continue;
  const [k, ...rest] = t.split("=");
  const v = rest.join("=").trim().replace(/^["']|["']$/g, "");
  if (!(k.trim() in process.env)) process.env[k.trim()] = v;
}
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// ── ASC credentials: eas.json defaults, env overrides ───────────────────────
let eas = {};
try {
  eas = JSON.parse(readFileSync(join(ROOT, "mobile", "eas.json"), "utf8"))
    ?.submit?.production?.ios ?? {};
} catch { /* eas.json optional when env is set */ }
const KEY_ID = process.env.ASC_KEY_ID || eas.ascApiKeyId;
const ISSUER = process.env.ASC_ISSUER_ID || eas.ascApiKeyIssuerId;
const P8_RAW = process.env.ASC_KEY_P8 || eas.ascApiKeyPath;
const VENDOR = process.env.ASC_VENDOR_NUMBER;
if (!KEY_ID || !ISSUER || !P8_RAW) {
  console.error("Missing ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_P8 (and no mobile/eas.json defaults).");
  process.exit(1);
}
if (!VENDOR) {
  console.error(
    "Missing ASC_VENDOR_NUMBER — one-time setup:\n" +
    "  App Store Connect → Payments and Financial Reports → copy the \"Vendor #\"\n" +
    "  then: ASC_VENDOR_NUMBER=9xxxxxxx node worker/asc-sales-pull.mjs\n" +
    "  (or add ASC_VENDOR_NUMBER=... to .env.local)"
  );
  process.exit(1);
}
const P8_PATH = isAbsolute(P8_RAW) ? P8_RAW : join(ROOT, P8_RAW);

// ── ES256 JWT (ieee-p1363 signature — raw r||s, not DER) ────────────────────
const b64u = (buf) => Buffer.from(buf).toString("base64url");
function ascToken() {
  const key = createPrivateKey(readFileSync(P8_PATH, "utf8"));
  const iat = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" }));
  const body = b64u(JSON.stringify({ iss: ISSUER, iat, exp: iat + 600, aud: "appstoreconnect-v1" }));
  const sig = createSign("SHA256").update(`${head}.${body}`)
    .sign({ key, dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${b64u(sig)}`;
}

// ── report dates are Pacific time ───────────────────────────────────────────
function ptDate(offsetDays = 0) {
  const now = new Date(Date.now() - offsetDays * 86400_000);
  return now.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }); // YYYY-MM-DD
}

async function fetchReport(day, token, version) {
  const p = new URLSearchParams({
    "filter[frequency]": "DAILY",
    "filter[reportDate]": day,
    "filter[reportSubType]": "SUMMARY",
    "filter[reportType]": "SALES",
    "filter[vendorNumber]": VENDOR,
  });
  if (version) p.set("filter[version]", version);
  const r = await fetch(`https://api.appstoreconnect.apple.com/v1/salesReports?${p}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/a-gzip" },
  });
  if (r.status === 404) return { status: 404 };
  if (!r.ok) {
    const text = await r.text();
    // Version negotiation: Apple rejects an unknown version with a 400.
    if (r.status === 400 && !version && /version/i.test(text)) {
      for (const v of ["1_1", "1_0"]) {
        const retry = await fetchReport(day, token, v);
        if (retry.status !== 400) return retry;
      }
    }
    return { status: r.status, error: text.slice(0, 300) };
  }
  return { status: 200, tsv: gunzipSync(Buffer.from(await r.arrayBuffer())).toString("utf8") };
}

function parseUnits(tsv) {
  const lines = tsv.split("\n").filter((l) => l.trim());
  const cols = lines[0].split("\t");
  const iType = cols.indexOf("Product Type Identifier");
  const iUnits = cols.indexOf("Units");
  const iApple = cols.indexOf("Apple Identifier");
  const sums = { download: 0, redownload: 0, update: 0 };
  for (const line of lines.slice(1)) {
    const f = line.split("\t");
    if (f[iApple]?.trim() !== APPLE_APP_ID) continue;
    const type = f[iType]?.trim() ?? "";
    const units = Number(f[iUnits]) || 0;
    if (type.startsWith("1")) sums.download += units;
    else if (type.startsWith("3")) sums.redownload += units;
    else if (type.startsWith("7")) sums.update += units;
    else console.log(`  (unknown product type ${type}: ${units} units — skipped)`);
  }
  return sums;
}

async function upsert(rows) {
  if (!rows.length) return;
  const r = await fetch(`${SB_URL}/rest/v1/mt_app_downloads?on_conflict=day,platform,kind`, {
    method: "POST",
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json", Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`upsert failed ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

// ── main ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const daysArg = args.includes("--days") ? Number(args[args.indexOf("--days") + 1]) : 14;
const dateArg = args.includes("--date") ? args[args.indexOf("--date") + 1] : null;
const days = dateArg ? [dateArg] : Array.from({ length: daysArg }, (_, i) => ptDate(i + 1));

const token = ascToken();
let wrote = 0;
for (const day of days) {
  const rep = await fetchReport(day, token);
  if (rep.status === 404) {
    // ≥2 PT days old → genuinely zero transactions; newer → report not cut yet.
    if (day <= ptDate(2)) {
      await upsert([{ day, platform: "ios", kind: "download", units: 0 }]);
      wrote++;
      console.log(`${day}: no report (≥2d old) → 0 downloads recorded`);
    } else {
      console.log(`${day}: report not available yet — skipped`);
    }
    continue;
  }
  if (rep.status !== 200) {
    console.error(`${day}: HTTP ${rep.status} ${rep.error ?? ""}`);
    continue;
  }
  const s = parseUnits(rep.tsv);
  const rows = [{ day, platform: "ios", kind: "download", units: s.download }];
  if (s.redownload) rows.push({ day, platform: "ios", kind: "redownload", units: s.redownload });
  if (s.update) rows.push({ day, platform: "ios", kind: "update", units: s.update });
  await upsert(rows);
  wrote++;
  console.log(`${day}: ${s.download} downloads · ${s.redownload} redownloads · ${s.update} updates`);
}
console.log(`Done — ${wrote}/${days.length} day(s) written to mt_app_downloads.`);
