#!/usr/bin/env node
/**
 * i18n-verify — compare what we translated on disk against what landed in the DB.
 * Read-only (anon key). Run after scripts/i18n-load-all.sh.
 *
 *   node scripts/i18n-verify.mjs
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const OUT = join(ROOT, "data/i18n/out");

for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
  const s = line.trim();
  if (!s || s.startsWith("#") || !s.includes("=")) continue;
  const i = s.indexOf("=");
  const k = s.slice(0, i).trim();
  if (!(k in process.env)) process.env[k] = s.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
}
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** on-disk expectation: entity_type -> count (segments are build material) */
const disk = new Map();
for (const d of readdirSync(OUT).filter((d) => !d.includes("__pilot") && d !== "tow_segments")) {
  for (const f of readdirSync(join(OUT, d)).filter((f) => f.endsWith(".json"))) {
    for (const r of JSON.parse(readFileSync(join(OUT, d, f), "utf8"))) {
      const k = `${r.entity_type}|${r.field}`;
      disk.set(k, (disk.get(k) || 0) + 1);
    }
  }
}

async function dbCount(entityType, field) {
  const q = `${URL}/rest/v1/content_i18n?select=entity_key&entity_type=eq.${encodeURIComponent(entityType)}` +
    `&field=eq.${encodeURIComponent(field)}&lang=eq.ko`;
  const res = await fetch(q, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: "count=exact", Range: "0-0" },
  });
  const cr = res.headers.get("content-range") || "";
  return Number(cr.split("/")[1] || 0);
}
async function shaCount(entityType, field) {
  const q = `${URL}/rest/v1/content_i18n?select=entity_key&entity_type=eq.${encodeURIComponent(entityType)}` +
    `&field=eq.${encodeURIComponent(field)}&lang=eq.ko&source_sha256=not.is.null`;
  const res = await fetch(q, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: "count=exact", Range: "0-0" },
  });
  return Number((res.headers.get("content-range") || "").split("/")[1] || 0);
}

console.log("entity_type|field".padEnd(34) + "disk".padStart(7) + "db".padStart(8) + "sha".padStart(8) + "  status");
let bad = 0;
for (const [k, n] of [...disk.entries()].sort()) {
  const [type, field] = k.split("|");
  const [db, sha] = await Promise.all([dbCount(type, field), shaCount(type, field)]);
  const ok = db >= n;
  if (!ok) bad++;
  console.log(k.padEnd(34) + String(n).padStart(7) + String(db).padStart(8) + String(sha).padStart(8) +
    `  ${ok ? "✓" : "✗ MISSING " + (n - db)}`);
}
console.log(bad ? `\n${bad} group(s) short — re-run the loader.` : "\n모든 그룹 적재 확인.");
