#!/usr/bin/env node
/**
 * i18n-audit — the observability tool for the "manage English only" regime.
 * 정본: HANDOFF-KO프로젝션-한국어사이트.md §5
 *
 * A REPORT, not a CI gate. Nothing here should ever fail a build: every gap it
 * finds is already handled at runtime by an English fallback (P2). Its job is to
 * make those fallbacks visible, because the whole design's promise — "change the
 * English and the translation can't go stale" — is only true if someone can see
 * what went stale.
 *
 * Four checks:
 *   1. Dictionary coverage — t() calls whose English string has no entry.
 *   2. Key parity — keys one locale has and another lacks (silent per-language holes).
 *   3. DB coverage — how many films/locations still lack their _<loc> values,
 *      i.e. the backfill queue and the §6.2 index-gate population.
 *   4. Shell thickness — a locale route file over the line budget means page body
 *      is leaking into a shell (P1 violation in progress).
 *
 * Usage:
 *   node scripts/i18n-audit.mjs            # full report, writes Outputs/i18n-audit-<date>.md
 *   node scripts/i18n-audit.mjs --no-db    # skip the network checks
 *   node scripts/i18n-audit.mjs --quiet    # file only, no stdout body
 */

import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const NO_DB = args.includes("--no-db");
const QUIET = args.includes("--quiet");
const SHELL_MAX_LINES = 25; // work order §5.3

// ── env (mirrors worker/*.py load_env: repo-root .env.local, never overwrite) ──
function loadEnv() {
  const p = join(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const s = line.trim();
    if (!s || s.startsWith("#") || !s.includes("=")) continue;
    const i = s.indexOf("=");
    const k = s.slice(0, i).trim();
    const v = s.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv();

// ── file walk ────────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".next" || e === "__pycache__") continue;
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p)) out.push(p);
  }
  return out;
}

// ── the locale registry, read from source (no TS runtime needed) ─────────────
function readLocales() {
  const src = readFileSync(join(ROOT, "lib/i18n/locales.ts"), "utf8");
  const live = [];
  const all = [];
  const re = /^\s{2}(\w+):\s*\{\s*live:\s*(true|false)/gm;
  let m;
  while ((m = re.exec(src))) {
    all.push(m[1]);
    if (m[2] === "true") live.push(m[1]);
  }
  return { all, live, projected: live.filter((l) => l !== "en") };
}

function readDict(loc) {
  const p = join(ROOT, `lib/i18n/dict/${loc}.ts`);
  if (!existsSync(p)) return null;
  const src = readFileSync(p, "utf8");
  const keys = new Set();
  // Object literal keys: quoted ("a b": / 'a b':) or bare identifiers (Films:).
  const re = /^\s{2}(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([A-Za-z_$][\w$]*))\s*:/gm;
  let m;
  while ((m = re.exec(src))) {
    const raw = m[1] ?? m[2] ?? m[3];
    keys.add(raw.replace(/\\"/g, '"').replace(/\\'/g, "'"));
  }
  return keys;
}

// ── 1. dictionary coverage ───────────────────────────────────────────────────
// Matches t(locale, "…") / t(l, '…') and captures the English string. Template
// literals are NOT matched on purpose: a t(`…${x}…`) call is itself a bug (the
// key must be a static string), and it should surface as an untranslated string.
function collectTCalls() {
  const files = [...walk(join(ROOT, "app")), ...walk(join(ROOT, "components")), ...walk(join(ROOT, "lib"))];
  const calls = new Map(); // english -> [file:line]
  const dynamic = []; // t(`...`) — always a bug
  for (const f of files) {
    if (f.includes(`${"lib/i18n"}`)) continue; // the module itself + dictionaries
    const src = readFileSync(f, "utf8");
    const lines = src.split("\n");
    lines.forEach((line, i) => {
      const re = /\bt\(\s*[A-Za-z_$][\w$.]*\s*,\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;
      let m;
      while ((m = re.exec(line))) {
        const en = (m[1] ?? m[2]).replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\n/g, "\n");
        const at = `${relative(ROOT, f)}:${i + 1}`;
        if (!calls.has(en)) calls.set(en, []);
        calls.get(en).push(at);
      }
      if (/\bt\(\s*[A-Za-z_$][\w$.]*\s*,\s*`/.test(line)) dynamic.push(`${relative(ROOT, f)}:${i + 1}`);
    });
  }
  return { calls, dynamic };
}

// ── 3. DB coverage ───────────────────────────────────────────────────────────
// Runs with the service key when present. This is a local operator tool, never
// shipped, and it must count rows the site itself reads through SECURITY DEFINER
// RPCs: film_locations has RLS with no policy, so anon sees 0 rows and would
// report a 100%-translated table that is in fact empty to it. Anon is the
// fallback so the script still runs (with that caveat) without the service key.
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const USE_SERVICE = !!process.env.SUPABASE_SERVICE_ROLE_KEY && args.includes("--service");
const SB_KEY = USE_SERVICE ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SB_ROLE = USE_SERVICE ? "service_role" : "anon";
// An exact count on films is a scan (~7s on this dataset when the DB is idle),
// so the budget has to absorb a busy moment. The checks below run concurrently,
// so this is the whole §3 wall-clock, not a per-check cost.
const REQ_TIMEOUT_MS = 25_000;

/** dbCount — row count via PostgREST.
 *  `count=exact` scans; on this dataset films answers in ~7s and bigger tables
 *  can exceed any sane wait, so every request is bounded and a timeout is
 *  reported rather than hung on. Never let a report block a person. */
async function dbCount(table, filter, tries = 2, mode = "exact") {
  if (!SB_URL || !SB_KEY) return { error: "no supabase env" };
  let last = "";
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${SB_URL}/rest/v1/${table}?${filter}`, {
        method: "HEAD",
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, Prefer: `count=${mode}` },
        signal: AbortSignal.timeout(REQ_TIMEOUT_MS),
      });
      if (res.ok) {
        const cr = res.headers.get("content-range") || "";
        const n = Number(cr.split("/")[1]);
        return Number.isFinite(n) ? { n, mode } : { error: `bad content-range: ${cr}` };
      }
      last = `HTTP ${res.status}`;
      // 400 = the column does not exist (migration not applied) — a real answer,
      // not a flake. Only back off on transient 5xx.
      if (res.status < 500) return { error: last };
    } catch (e) {
      last = e.name === "TimeoutError" ? `timed out after ${REQ_TIMEOUT_MS / 1000}s` : e.message;
    }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  return { error: last };
}

async function dbCoverage(projected) {
  const out = [];
  for (const loc of projected) {
    // Concurrent: each is an independent count, and the slowest (the unfiltered
    // total) then sets the wall-clock instead of the sum.
    const [total, title, overview, gate] = await Promise.all([
      dbCount("films", "select=id&tmdb_id=not.is.null"),
      dbCount("films", `select=id&tmdb_id=not.is.null&title_${loc}=not.is.null`),
      dbCount("films", `select=id&tmdb_id=not.is.null&overview_${loc}=not.is.null`),
      // The §6.2 v1 gate: both present. This count IS the locale-indexable population.
      dbCount("films", `select=id&tmdb_id=not.is.null&title_${loc}=not.is.null&overview_${loc}=not.is.null`),
    ]);
    if (total.error) {
      out.push({ loc, error: total.error });
      continue;
    }
    out.push({ loc, total: total.n, title, overview, gate });
  }
  return out;
}

// ── 4. shell thickness ───────────────────────────────────────────────────────
function shellThickness(projected) {
  const rows = [];
  for (const loc of projected) {
    const dir = join(ROOT, "app", loc);
    if (!existsSync(dir)) continue;
    for (const f of walk(dir)) {
      if (!/\/(page|layout)\.tsx$/.test(f)) continue;
      const n = readFileSync(f, "utf8").split("\n").filter((l) => l.trim()).length;
      rows.push({ file: relative(ROOT, f), lines: n, over: n > SHELL_MAX_LINES });
    }
  }
  return rows;
}

// ── report ───────────────────────────────────────────────────────────────────
function main() {
  const { live, projected, all } = readLocales();
  const dicts = new Map();
  for (const loc of projected) {
    const d = readDict(loc);
    if (d) dicts.set(loc, d);
  }
  const { calls, dynamic } = collectTCalls();

  const L = [];
  const p = (s = "") => L.push(s);
  const today = new Date().toISOString().slice(0, 10);

  p(`# i18n audit — ${today}`);
  p();
  p(`Locales: live \`${live.join(", ")}\` · reserved \`${all.filter((l) => !live.includes(l)).join(", ") || "—"}\``);
  p(`Localized \`t()\` strings in code: **${calls.size}**`);
  p(`DB read as: \`${SB_ROLE}\`${SB_ROLE === "anon" ? " (pass `--service` with SUPABASE_SERVICE_ROLE_KEY set to include film_locations — see §3)" : ""}`);
  p();

  // 1. coverage
  p(`## 1. Dictionary coverage`);
  p();
  for (const loc of projected) {
    const d = dicts.get(loc);
    if (!d) {
      p(`- **${loc}** — no dictionary file (\`lib/i18n/dict/${loc}.ts\`). Every string falls back to English.`);
      continue;
    }
    const missing = [...calls.keys()].filter((k) => !d.has(k));
    const pct = calls.size ? Math.round(((calls.size - missing.length) / calls.size) * 100) : 100;
    p(`- **${loc}** — ${calls.size - missing.length}/${calls.size} (${pct}%) · **${missing.length} falling back to English**`);
    if (missing.length) {
      p();
      p(`  <details><summary>${missing.length} untranslated</summary>`);
      p();
      for (const k of missing.slice(0, 200)) {
        p(`  - \`${k.replace(/`/g, "\\`").slice(0, 120)}\` — ${calls.get(k)[0]}`);
      }
      if (missing.length > 200) p(`  - …and ${missing.length - 200} more`);
      p();
      p(`  </details>`);
    }
  }
  p();
  if (dynamic.length) {
    p(`> ⚠️ **${dynamic.length} dynamic \`t(\\\`…\\\`)\` call(s)** — the key must be a static English string (P4), or it can never be translated:`);
    for (const d of dynamic) p(`> - ${d}`);
    p();
  }

  // 2. parity
  p(`## 2. Key parity across locales`);
  p();
  if (dicts.size < 2) {
    p(`Only one dictionary (${[...dicts.keys()].join(", ") || "none"}) — parity is trivially satisfied. This check earns its keep from wave 2 (ja/fr/es).`);
  } else {
    const union = new Set();
    for (const d of dicts.values()) for (const k of d) union.add(k);
    let clean = true;
    for (const [loc, d] of dicts) {
      const gaps = [...union].filter((k) => !d.has(k));
      if (gaps.length) {
        clean = false;
        p(`- **${loc}** lacks ${gaps.length} key(s) other locales have:`);
        for (const g of gaps.slice(0, 40)) p(`  - \`${g.slice(0, 100)}\``);
        if (gaps.length > 40) p(`  - …and ${gaps.length - 40} more`);
      }
    }
    if (clean) p(`All ${dicts.size} dictionaries share the same ${union.size} keys.`);
  }
  p();

  // 3. db
  p(`## 3. DB coverage (backfill queue + index-gate population)`);
  p();
  return { L, p, projected, today };
}

async function run() {
  const { L, p, projected, today } = main();

  if (NO_DB) {
    p(`_skipped (--no-db)_`);
  } else {
    const rows = await dbCoverage(projected);
    for (const r of rows) {
      if (r.error) {
        p(`- **${r.loc}** — unavailable: ${r.error}`);
        p(`  (Expected before migration 0105 is applied: the \`_${r.loc}\` columns do not exist yet.)`);
        continue;
      }
      const pct = (x) => (r.total ? `${Math.round((x / r.total) * 100)}%` : "—");
      const cell = (c) => (c.error ? `⚠️ ${c.error}` : `${c.n.toLocaleString()} (${pct(c.n)})`);
      p(`- **${r.loc}** — of ${r.total.toLocaleString()} films with a TMDB id:`);
      p(`  - \`title_${r.loc}\`: ${cell(r.title)}`);
      p(`  - \`overview_${r.loc}\`: ${cell(r.overview)}`);
      p(`  - **both (§6.2 index gate ⇒ indexable in ${r.loc})**: ${cell(r.gate)}`);
    }
    // film_locations has RLS with no policy (verified 2026-07-16: 0 policies), so
    // anon reads it as an empty table — the site itself only reaches it through
    // the SECURITY DEFINER film_geo RPC. Reporting "0 rows" here would read as
    // "nothing to translate" when the truth is ~28k rows. Say which it is.
    if (!USE_SERVICE) {
      p(`- \`film_locations\` — not visible to \`anon\` (RLS, no policy). Re-run with \`--service\` for Phase 3 numbers.`);
    } else {
      const locs = await dbCount("film_locations", "select=id", 2, "estimated");
      if (locs.error) {
        p(`- \`film_locations\` — unavailable: ${locs.error}`);
      } else {
        p(`- \`film_locations\`: ~${locs.n.toLocaleString()} rows (planner estimate)`);
        for (const loc of projected) {
          const n = await dbCount("film_locations", `select=id&name_${loc}=not.is.null`);
          p(`  - \`name_${loc}\`: ${n.error ? `⚠️ ${n.error}` : n.n.toLocaleString()}`);
        }
      }
    }
  }
  p();

  // 4. shells
  p(`## 4. Shell thickness (P1 — a shell over ${SHELL_MAX_LINES} non-blank lines is body leaking in)`);
  p();
  const shells = shellThickness(projected);
  if (!shells.length) p(`No locale route files yet.`);
  for (const s of shells) p(`- ${s.over ? "⚠️ " : ""}\`${s.file}\` — ${s.lines} lines${s.over ? ` (over ${SHELL_MAX_LINES})` : ""}`);
  p();

  const body = L.join("\n");
  const dir = join(ROOT, "Outputs");
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `i18n-audit-${today.replace(/-/g, "")}.md`);
  writeFileSync(out, body + "\n");
  if (!QUIET) console.log(body);
  console.log(`\n→ ${relative(ROOT, out)}`);
}

run().catch((e) => {
  console.error("i18n-audit failed:", e.message);
  process.exit(1);
});
