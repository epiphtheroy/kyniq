#!/usr/bin/env node
/**
 * asc-release — drive an App Store submission from the terminal.
 *
 * The App Store Connect website is the only place the keyword field can be
 * changed, and only while a version is in "Prepare for Submission" — miss the
 * window and the words wait for the next build. Doing that by hand means a
 * browser, a login and eight screens. This is the same eight screens as API
 * calls, so a release can be prepared and submitted from the machine that
 * built it, and by a session that has no browser at all.
 *
 *   node scripts/asc-release.mjs status
 *   node scripts/asc-release.mjs prepare --version 1.0.1 --build 21
 *   node scripts/asc-release.mjs submit  --version 1.0.1
 *   node scripts/asc-release.mjs release --version 1.0.1     # an approved, MANUAL version
 *
 * `prepare` is idempotent — it reads before every write and only changes what
 * differs — so it can be re-run after a partial failure. `submit` refuses to run
 * unless the version has a build attached and both keyword fields match the
 * listing files, because after this call the metadata is frozen.
 *
 * Credentials: the eas submit key (mobile/eas.json → submit.production.ios),
 * overridable through ASC_KEY_ID / ASC_ISSUER_ID / ASC_KEY_P8. The .p8 is read
 * by this process and never printed. Role matters: a "Developer" key can read
 * everything below but Apple rejects its writes with 403 — that error is
 * surfaced verbatim so the fix (an App Manager key) is obvious.
 *
 * Copy comes from the listing files, never from flags: keywords from
 * store/listing-en.md and store/listing-ko.md (the first fenced block under
 * "### Keywords" / "### 키워드"), "What's New" from store/RELEASE-NOTES-<v>.md
 * (the "## en-US" and "## ko-KR" sections). The files are the record; this
 * script just carries them across.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { createSign, createPrivateKey } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const MOBILE = dirname(HERE);
const API = "https://api.appstoreconnect.apple.com/v1";

// ── args ────────────────────────────────────────────────────────────────────
const [cmd, ...rest] = process.argv.slice(2);
const flag = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};
const VERSION = flag("version");
const BUILD = flag("build");
const RELEASE_TYPE = flag("release") ?? "AFTER_APPROVAL"; // or MANUAL
if (!["status", "prepare", "submit", "release"].includes(cmd ?? "")) {
  console.error("usage: asc-release.mjs status | prepare --version X --build N | submit --version X | release --version X");
  process.exit(2);
}

// ── credentials (eas.json defaults, env overrides) ──────────────────────────
const eas = JSON.parse(readFileSync(join(MOBILE, "eas.json"), "utf8"));
const sub = eas?.submit?.production?.ios ?? {};
const APP_ID = sub.ascAppId;
const KEY_ID = process.env.ASC_KEY_ID || sub.ascApiKeyId;
const ISSUER = process.env.ASC_ISSUER_ID || sub.ascApiKeyIssuerId;
const CONVENTIONAL = KEY_ID
  ? join(process.env.HOME ?? "", ".appstoreconnect", "private_keys", `AuthKey_${KEY_ID}.p8`)
  : null;
const P8_RAW = process.env.ASC_KEY_P8
  || (CONVENTIONAL && existsSync(CONVENTIONAL) ? CONVENTIONAL : sub.ascApiKeyPath);
if (!APP_ID || !KEY_ID || !ISSUER || !P8_RAW) {
  console.error("Missing ASC app id / key id / issuer / .p8 path (mobile/eas.json submit.production.ios).");
  process.exit(1);
}
const P8_PATH = isAbsolute(P8_RAW) ? P8_RAW : join(MOBILE, P8_RAW);

// ── ES256 JWT (ieee-p1363 — raw r||s, not DER) ──────────────────────────────
const b64u = (buf) => Buffer.from(buf).toString("base64url");
function token() {
  const key = createPrivateKey(readFileSync(P8_PATH, "utf8"));
  const iat = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" }));
  const body = b64u(JSON.stringify({ iss: ISSUER, iat, exp: iat + 900, aud: "appstoreconnect-v1" }));
  const sig = createSign("SHA256").update(`${head}.${body}`).sign({ key, dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${b64u(sig)}`;
}
const TOKEN = token();

async function asc(method, path, body) {
  const r = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON error body */ }
  if (!r.ok) {
    const detail = json?.errors?.map((e) => `${e.status} ${e.code}: ${e.title} — ${e.detail ?? ""}`).join("\n  ")
      ?? text.slice(0, 400);
    const err = new Error(`${method} ${path} → ${r.status}\n  ${detail}`);
    err.status = r.status;
    throw err;
  }
  return json;
}

// ── copy from the listing files ─────────────────────────────────────────────
function fenced(md, heading) {
  // First ``` block after the heading line.
  const i = md.indexOf(heading);
  if (i < 0) throw new Error(`heading not found: ${heading}`);
  const m = md.slice(i).match(/```\n([\s\S]*?)\n```/);
  if (!m) throw new Error(`no fenced block under ${heading}`);
  return m[1].trim();
}
function section(md, heading) {
  // Prose between "## <heading>" and the next "## ".
  const re = new RegExp(`^## ${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n([\\s\\S]*?)(?=^## |\\Z)`, "m");
  const m = md.match(re);
  if (!m) throw new Error(`section not found: ## ${heading}`);
  return m[1].trim().replace(/\n{2,}/g, "\n\n");
}
function listingCopy(version) {
  const en = readFileSync(join(MOBILE, "store", "listing-en.md"), "utf8");
  const ko = readFileSync(join(MOBILE, "store", "listing-ko.md"), "utf8");
  const notesPath = join(MOBILE, "store", `RELEASE-NOTES-${version}.md`);
  const notes = existsSync(notesPath) ? readFileSync(notesPath, "utf8") : null;
  const copy = {
    "en-US": { keywords: fenced(en, "### Keywords"), whatsNew: notes ? section(notes, "en-US") : null },
    "ko":    { keywords: fenced(ko, "### 키워드"),   whatsNew: notes ? section(notes, "ko-KR") : null },
  };
  for (const [loc, c] of Object.entries(copy)) {
    if (c.keywords.length > 100) throw new Error(`${loc} keywords are ${c.keywords.length} chars (max 100)`);
    if (c.whatsNew && c.whatsNew.length > 4000) throw new Error(`${loc} whatsNew is ${c.whatsNew.length} chars (max 4000)`);
  }
  return copy;
}

// ── reads ───────────────────────────────────────────────────────────────────
async function versions() {
  const j = await asc("GET", `/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&limit=10`);
  return j.data.map((v) => ({
    id: v.id,
    version: v.attributes.versionString,
    state: v.attributes.appStoreState,
    releaseType: v.attributes.releaseType,
  }));
}
async function builds(limit = 5) {
  const j = await asc("GET", `/builds?filter[app]=${APP_ID}&sort=-uploadedDate&limit=${limit}&fields[builds]=version,processingState,uploadedDate,expired`);
  return j.data.map((b) => ({
    id: b.id,
    number: b.attributes.version,
    state: b.attributes.processingState,
    uploaded: b.attributes.uploadedDate,
    expired: b.attributes.expired,
  }));
}
async function versionBuild(vid) {
  const j = await asc("GET", `/appStoreVersions/${vid}/build?fields[builds]=version,processingState`);
  return j.data ? { id: j.data.id, number: j.data.attributes.version, state: j.data.attributes.processingState } : null;
}
async function localizations(vid) {
  const j = await asc("GET", `/appStoreVersions/${vid}/appStoreVersionLocalizations?limit=20`);
  return Object.fromEntries(j.data.map((l) => [l.attributes.locale, {
    id: l.id,
    keywords: l.attributes.keywords ?? "",
    whatsNew: l.attributes.whatsNew ?? "",
  }]));
}
async function reviewDetail(vid) {
  try {
    const j = await asc("GET", `/appStoreVersions/${vid}/appStoreReviewDetail`);
    return j.data ? { id: j.data.id, ...j.data.attributes } : null;
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

// ── commands ────────────────────────────────────────────────────────────────
const show = (o) => console.log(JSON.stringify(o, null, 2));

async function status() {
  const vs = await versions();
  const bs = await builds();
  console.log("versions:"); show(vs);
  console.log("builds (newest first):"); show(bs);
  for (const v of vs.slice(0, 2)) {
    const b = await versionBuild(v.id);
    const l = await localizations(v.id);
    console.log(`\n${v.version} (${v.state}) build=${b ? `${b.number}/${b.state}` : "none"}`);
    for (const [loc, c] of Object.entries(l)) {
      console.log(`  ${loc}: keywords[${c.keywords.length}]="${c.keywords}"`);
      if (c.whatsNew) console.log(`  ${loc}: whatsNew[${c.whatsNew.length}]`);
    }
  }
}

async function prepare() {
  if (!VERSION || !BUILD) { console.error("prepare needs --version and --build"); process.exit(2); }
  const copy = listingCopy(VERSION);

  // 1. The version. Creating it copies the previous version's localizations,
  //    review details and screenshots — so everything below is a patch.
  let vs = await versions();
  let v = vs.find((x) => x.version === VERSION);
  if (!v) {
    console.log(`creating version ${VERSION}…`);
    const j = await asc("POST", "/appStoreVersions", {
      data: {
        type: "appStoreVersions",
        attributes: { platform: "IOS", versionString: VERSION, releaseType: RELEASE_TYPE },
        relationships: { app: { data: { type: "apps", id: APP_ID } } },
      },
    });
    v = { id: j.data.id, version: VERSION, state: j.data.attributes.appStoreState, releaseType: RELEASE_TYPE };
  } else {
    console.log(`version ${VERSION} exists (${v.state})`);
    if (v.state !== "PREPARE_FOR_SUBMISSION" && v.state !== "DEVELOPER_REJECTED") {
      console.error(`refusing: ${VERSION} is ${v.state} — metadata is no longer editable`);
      process.exit(1);
    }
    if (v.releaseType !== RELEASE_TYPE) {
      await asc("PATCH", `/appStoreVersions/${v.id}`, {
        data: { type: "appStoreVersions", id: v.id, attributes: { releaseType: RELEASE_TYPE } },
      });
      console.log(`  releaseType → ${RELEASE_TYPE}`);
    }
  }

  // 2. The build. Must be processed (VALID) before Apple lets it attach.
  const bs = await builds(10);
  const b = bs.find((x) => String(x.number) === String(BUILD));
  if (!b) { console.error(`build ${BUILD} not found among the last 10 uploads`); show(bs); process.exit(1); }
  if (b.state !== "VALID") {
    console.error(`build ${BUILD} is ${b.state} — wait for Apple's processing mail, then re-run`);
    process.exit(1);
  }
  const attached = await versionBuild(v.id);
  if (attached?.id !== b.id) {
    await asc("PATCH", `/appStoreVersions/${v.id}/relationships/build`, { data: { type: "builds", id: b.id } });
    console.log(`  build ${BUILD} attached`);
  } else {
    console.log(`  build ${BUILD} already attached`);
  }

  // 3. Keywords + What's New, per locale. Read → compare → patch only the diff.
  const locs = await localizations(v.id);
  for (const [loc, want] of Object.entries(copy)) {
    const have = locs[loc];
    const attrs = {};
    if (!have) {
      // A locale the previous version did not carry. Creating one needs the
      // full description set; that is a listing decision, not a script's, so
      // say so and stop rather than invent a description.
      console.error(`  ${loc}: no localization on ${VERSION} — add it in ASC once (description etc.), then re-run`);
      process.exit(1);
    }
    if (have.keywords !== want.keywords) attrs.keywords = want.keywords;
    if (want.whatsNew && have.whatsNew !== want.whatsNew) attrs.whatsNew = want.whatsNew;
    if (Object.keys(attrs).length) {
      await asc("PATCH", `/appStoreVersionLocalizations/${have.id}`, {
        data: { type: "appStoreVersionLocalizations", id: have.id, attributes: attrs },
      });
      console.log(`  ${loc}: updated ${Object.keys(attrs).join(", ")}`);
    } else {
      console.log(`  ${loc}: already current`);
    }
  }

  // 4. Review details carry over from the previous version; verify, don't assume.
  const rd = await reviewDetail(v.id);
  if (!rd || !rd.demoAccountName || !rd.contactEmail) {
    console.error("  review detail incomplete (demo account / contact) — copy from the previous version in ASC");
    process.exit(1);
  }
  console.log(`  review detail ok (demo=${rd.demoAccountName}, contact=${rd.contactEmail})`);
  console.log(`\nprepared: ${VERSION} build ${BUILD}, release ${RELEASE_TYPE}. Next: submit --version ${VERSION}`);
}

async function submit() {
  if (!VERSION) { console.error("submit needs --version"); process.exit(2); }
  const copy = listingCopy(VERSION);
  const v = (await versions()).find((x) => x.version === VERSION);
  if (!v) { console.error(`version ${VERSION} not found`); process.exit(1); }
  if (v.state !== "PREPARE_FOR_SUBMISSION" && v.state !== "DEVELOPER_REJECTED") {
    console.error(`refusing: ${VERSION} is ${v.state}`); process.exit(1);
  }
  const b = await versionBuild(v.id);
  if (!b || b.state !== "VALID") { console.error("no valid build attached — run prepare first"); process.exit(1); }
  const locs = await localizations(v.id);
  for (const [loc, want] of Object.entries(copy)) {
    if (locs[loc]?.keywords !== want.keywords) {
      console.error(`refusing: ${loc} keywords differ from the listing file — run prepare first`);
      process.exit(1);
    }
  }

  // Review submissions (the post-2022 flow): a submission, one item, then flip it.
  let s = (await asc("GET", `/apps/${APP_ID}/reviewSubmissions?filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW&filter[platform]=IOS`)).data[0];
  if (s) {
    console.log(`review submission already exists: ${s.id} (${s.attributes.state})`);
    return;
  }
  s = (await asc("POST", "/reviewSubmissions", {
    data: { type: "reviewSubmissions", attributes: { platform: "IOS" }, relationships: { app: { data: { type: "apps", id: APP_ID } } } },
  })).data;
  await asc("POST", "/reviewSubmissionItems", {
    data: {
      type: "reviewSubmissionItems",
      relationships: {
        reviewSubmission: { data: { type: "reviewSubmissions", id: s.id } },
        appStoreVersion: { data: { type: "appStoreVersions", id: v.id } },
      },
    },
  });
  const done = await asc("PATCH", `/reviewSubmissions/${s.id}`, {
    data: { type: "reviewSubmissions", id: s.id, attributes: { submitted: true } },
  });
  console.log(`submitted: ${VERSION} build ${b.number} → ${done.data.attributes.state}`);
}

async function release() {
  // For a version Apple has approved under releaseType MANUAL. Irreversible:
  // after this the build is live in every storefront the app is sold in.
  if (!VERSION) { console.error("release needs --version"); process.exit(2); }
  const v = (await versions()).find((x) => x.version === VERSION);
  if (!v) { console.error(`version ${VERSION} not found`); process.exit(1); }
  if (v.state !== "PENDING_DEVELOPER_RELEASE") {
    console.error(`refusing: ${VERSION} is ${v.state}, not PENDING_DEVELOPER_RELEASE`); process.exit(1);
  }
  const b = await versionBuild(v.id);
  const j = await asc("POST", "/appStoreVersionReleaseRequests", {
    data: {
      type: "appStoreVersionReleaseRequests",
      relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: v.id } } },
    },
  });
  console.log(`release requested: ${VERSION} build ${b?.number ?? "?"} (request ${j.data.id})`);
  const after = (await versions()).find((x) => x.version === VERSION);
  console.log(`state now: ${after?.state}`);
}

try {
  await ({ status, prepare, submit, release })[cmd]();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
