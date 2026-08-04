#!/usr/bin/env node
// The architecture, as a test.
//
// There is no Android device on this project yet, so no one can SEE whether the
// two platforms agree. Every rule this file checks was therefore written to be
// decidable by reading text — if a rule needs judgement, it is not a rule here,
// it is a paragraph in HANDOFF-안드로이드-패리티-아키텍처.md.
//
// Two kinds of rule:
//
//   HARD    must be zero, forever. These encode the containment design: break one
//           and the seam has leaked, which is the failure the whole design exists
//           to prevent.
//
//   RATCHET must not GROW. These are real problems the codebase already has; a
//           gate that failed on day one would just be turned off, so instead the
//           current count is frozen and CI fails only on an increase. Lower the
//           baseline as they get fixed. (Same convention as the repo's tsc ratchet.)
//
// Usage: node scripts/check-platform.mjs [--update-baseline]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BASELINE_PATH = join(ROOT, "scripts", "platform-baseline.json");
const SEAM = "src/platform/";

// ---------------------------------------------------------------------------

async function sourceFiles() {
  const out = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(join(ROOT, dir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const rel = join(dir, e.name);
      if (e.isDirectory()) {
        if (["node_modules", ".expo", "dist", "android", "ios", ".git"].includes(e.name)) continue;
        await walk(rel);
      } else if ([".ts", ".tsx"].includes(extname(e.name))) {
        out.push(rel);
      }
    }
  }
  await walk("app");
  await walk("src");
  return out;
}

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const posix = (p) => p.split("\\").join("/");

// ---------------------------------------------------------------------------

const hard = [];
const counts = {};
const files = await sourceFiles();

function hit(rule, file, line, detail) {
  hard.push({ rule, where: `${posix(file)}:${line}`, detail });
}

function lines(file) {
  return read(file).split("\n");
}

// --- HARD R1: Platform.* lives only in the seam ------------------------------
// Platform-extension files (*.web.tsx etc.) are a different mechanism — Metro
// picks them by filename, so they carry no runtime branch to contain.
for (const f of files) {
  const p = posix(f);
  if (p.startsWith(SEAM)) continue;
  if (/\.(ios|android|native|web)\.tsx?$/.test(p)) continue;
  lines(f).forEach((l, i) => {
    if (/\bPlatform\s*\.\s*(OS|select|Version)\b/.test(l)) {
      hit("R1 containment", f, i + 1, `Platform.* outside ${SEAM} — move the decision into the seam`);
    }
  });
}

// --- HARD R2: every @divergence tag names a real ledger entry ----------------
const capsPath = "src/platform/capabilities.ts";
let ledgerKeys = new Set();
if (existsSync(join(ROOT, capsPath))) {
  const caps = read(capsPath);
  const body = caps.slice(caps.indexOf("export const DIVERGENCE"));
  for (const m of body.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*):\s*\{/gm)) ledgerKeys.add(m[1]);
} else {
  hard.push({ rule: "R2 ledger", where: capsPath, detail: "the divergence ledger is missing" });
}
for (const f of files) {
  lines(f).forEach((l, i) => {
    const m = l.match(/@divergence\s+([a-zA-Z][a-zA-Z0-9]*)/);
    if (m && !ledgerKeys.has(m[1])) {
      hit("R2 ledger", f, i + 1, `@divergence ${m[1]} is not an entry in capabilities.ts`);
    }
  });
}

// --- HARD R3: routes never fork ---------------------------------------------
for (const f of files) {
  const p = posix(f);
  if (p.startsWith("app/") && /\.(ios|android|native)\.tsx?$/.test(p)) {
    hit("R3 no route forks", f, 1, "a route may not have a per-platform sibling; put the fork in the seam");
  }
}

// --- HARD R4: banned native modules are gone, not commented out --------------
const pkg = JSON.parse(read("package.json"));
const appJson = JSON.parse(read("app.json"));
for (const banned of ["@maplibre/maplibre-react-native", "expo-symbols"]) {
  if (pkg.dependencies?.[banned]) {
    hard.push({ rule: "R4 banned module", where: "package.json", detail: `${banned} is still a dependency` });
  }
  if (JSON.stringify(appJson.expo?.plugins ?? []).includes(banned)) {
    hard.push({ rule: "R4 banned module", where: "app.json", detail: `${banned} is still a config plugin` });
  }
}

// --- HARD R6: the app's own chrome stays English -----------------------------
// Owner invariant: EDITIONS (where you watch) and CONTENT_LANGS (film titles) are
// user-facing axes, but the UI itself is English and Korean must not return to it.
// That is decided by exactly one constant.
if (!/export const UI_LOCALE:\s*UILocale\s*=\s*"en";/.test(read("src/editions.ts"))) {
  hard.push({
    rule: "R6 english UI",
    where: "src/editions.ts",
    detail: "UI_LOCALE must remain \"en\" — the UI locale axis is deliberately not user-facing",
  });
}

// --- HARD R5: the iOS Maps key must never reach the Android config -----------
const appConfig = read("app.config.js");
if (/android[\s\S]{0,400}googleMaps[\s\S]{0,200}IOS_MAPS_KEY|googleMaps[\s\S]{0,120}process\.env\.GOOGLE_MAPS_IOS_KEY/.test(appConfig)) {
  hard.push({
    rule: "R5 maps key",
    where: "app.config.js",
    detail: "the iOS-restricted Maps key is being written into the Android config",
  });
}

// ---------------------------------------------------------------------------
// RATCHET counts.

function countMatching(re, filter = () => true) {
  let n = 0;
  for (const f of files) {
    if (!filter(posix(f))) continue;
    for (const l of lines(f)) if (re.test(l)) n++;
  }
  return n;
}

// Haptics: one owner. Direct expo-haptics imports elsewhere bypass the Android throttle.
counts.directHapticImports = countMatching(
  /from ["']expo-haptics["']/,
  (p) => !p.startsWith(SEAM),
);
// Modal: one owner, so the statusBarTranslucent contract cannot be half-applied.
// The trailing (\s|>|$) matters: these counts are taken line by line, and a
// `<Modal` that opens a multi-line prop list has nothing after it on its line.
// The first version of this rule missed exactly that and reported a 3 -> 1
// "improvement" when three modals had merely been reformatted. A ratchet that
// congratulates you for wrapping a line is worse than no ratchet.
counts.modalConstructions = countMatching(/<Modal(\s|>|$)/);
// Runtime CDN fetches: an app's assets come from its binary or our own domain.
counts.cdnUrls = countMatching(/https:\/\/unpkg\.com|https:\/\/cdn\./);
// Shadow geometry outside the token layer: Android ignores all of it.
counts.rawShadowLiterals = countMatching(
  /\b(shadowRadius|shadowOffset|shadowOpacity)\b|^\s*elevation:/,
  (p) => !p.startsWith(SEAM) && p !== "src/theme.ts",
);
// Magic bottom padding tuned to the iOS tab bar.
counts.magicClearance = countMatching(/paddingBottom:\s*(76|96|104|120|140|160)\b/);
// NOTE on a rule that was tried and rejected: scanning for Hangul codepoints
// outside src/i18n/dict/ looks like it enforces the owner's English-only UI rule,
// but it does not \u2014 it matches Korean COMMENTS and the Korean HANDOFF filenames
// those comments cite, and matches no UI copy at all (every visible string goes
// through t()). It would have frozen a meaningless number at 23 and taught people
// to ignore the gate. The invariant it was standing in for is exact and lives one
// line away, so check that instead.

// ---------------------------------------------------------------------------

const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")) : {};

if (process.argv.includes("--update-baseline")) {
  writeFileSync(BASELINE_PATH, JSON.stringify(counts, null, 2) + "\n");
  console.log("baseline written:", JSON.stringify(counts));
  process.exit(0);
}

let failed = false;

if (hard.length) {
  failed = true;
  console.error(`\n✗ ${hard.length} hard rule violation(s) — the seam has leaked:\n`);
  for (const h of hard) console.error(`  [${h.rule}] ${h.where}\n      ${h.detail}`);
}

const regressions = [];
const improvements = [];
for (const [k, v] of Object.entries(counts)) {
  const base = baseline[k];
  if (base === undefined) continue;
  if (v > base) regressions.push(`  ${k}: ${base} → ${v}  (+${v - base})`);
  else if (v < base) improvements.push(`  ${k}: ${base} → ${v}`);
}

if (regressions.length) {
  failed = true;
  console.error(`\n✗ ratchet regressions — these may not grow:\n${regressions.join("\n")}`);
}
if (improvements.length) {
  console.log(`\n↓ ratchet improved — run with --update-baseline to lock it in:\n${improvements.join("\n")}`);
}

if (!failed) {
  console.log("✓ platform rules pass");
  console.log(`  ledger entries: ${ledgerKeys.size}   files scanned: ${files.length}`);
  console.log(`  ratchets: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join("  ")}`);
}

process.exit(failed ? 1 : 0);
