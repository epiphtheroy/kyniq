#!/usr/bin/env node
// Tier-2 factual backfill for hidden films (films.visible = false).
// Fill-only: original_title (when null AND differs from title), overview, genres,
// runtime, release_date, tagline (each only when currently null).
// Probes for an original_language column; fills it only if it exists (never alters schema).
//
// Usage:
//   node backfill.mjs --dry-run [--limit 50]   # fetch + report, no writes
//   node backfill.mjs                          # full live run
//
// Env from ../../.env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TMDB_READ_TOKEN

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- config ----------
const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes('--dry-run');
const limitIdx = ARGS.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(ARGS[limitIdx + 1], 10) : Infinity;

const TMDB_BATCH = 20;        // concurrent TMDB requests per batch
const TMDB_GAP_MS = 500;      // gap between batches -> ~40 req/s ceiling
const PAGE_SIZE = 1000;       // Supabase REST row cap per request
const PATCH_CONCURRENCY = 10;

// ---------- env ----------
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, '..', '..', '.env.local');
const env = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
}
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const TMDB_TOKEN = env.TMDB_READ_TOKEN;
if (!SUPA_URL || !SERVICE_KEY || !TMDB_TOKEN) {
  console.error('Missing env: need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TMDB_READ_TOKEN in .env.local');
  process.exit(1);
}

const SUPA_HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- generic fetch with retry ----------
async function fetchRetry(url, options = {}, { retries = 4, label = 'request' } = {}) {
  let attempt = 0;
  for (;;) {
    let res;
    try {
      res = await fetch(url, options);
    } catch (err) {
      if (attempt >= retries) throw new Error(`${label}: network error after ${retries} retries: ${err.message}`);
      await sleep(1000 * 2 ** attempt++);
      continue;
    }
    if (res.status === 429) {
      if (attempt >= retries) throw new Error(`${label}: still 429 after ${retries} retries`);
      const ra = parseFloat(res.headers.get('retry-after')) || 2 ** attempt;
      await sleep(ra * 1000 + 250);
      attempt++;
      continue;
    }
    if (res.status >= 500) {
      if (attempt >= retries) throw new Error(`${label}: HTTP ${res.status} after ${retries} retries`);
      await sleep(1000 * 2 ** attempt++);
      continue;
    }
    return res; // includes 404 and other 4xx -- caller decides
  }
}

// ---------- step 0: probe schema for original_language ----------
async function probeHasLanguageColumn() {
  const res = await fetchRetry(`${SUPA_URL}/rest/v1/films?select=*&limit=1`, { headers: SUPA_HEADERS }, { label: 'schema probe' });
  if (!res.ok) throw new Error(`schema probe failed: HTTP ${res.status}`);
  const rows = await res.json();
  if (!rows.length) throw new Error('schema probe: films table returned no rows');
  return Object.prototype.hasOwnProperty.call(rows[0], 'original_language');
}

// ---------- step 1: page through hidden films ----------
async function fetchHiddenFilms() {
  const films = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = `${SUPA_URL}/rest/v1/films?select=id,tmdb_id,title,original_title,overview,genres,runtime,release_date,tagline&visible=is.false&order=id.asc&offset=${offset}&limit=${PAGE_SIZE}`;
    const res = await fetchRetry(url, { headers: SUPA_HEADERS }, { label: `films page offset=${offset}` });
    if (!res.ok) throw new Error(`films page offset=${offset}: HTTP ${res.status} ${await res.text()}`);
    const page = await res.json();
    films.push(...page);
    process.stderr.write(`  fetched ${films.length} hidden films...\r`);
    if (page.length < PAGE_SIZE) break;
    if (films.length >= LIMIT) break;
  }
  process.stderr.write('\n');
  return Number.isFinite(LIMIT) ? films.slice(0, LIMIT) : films;
}

// ---------- step 2: TMDB detail ----------
// TMDB_READ_TOKEN may be a v4 read access token (JWT, "eyJ...") used as Bearer,
// or a v3 API key (32 hex chars) used as ?api_key= query param.
const TMDB_IS_V4 = TMDB_TOKEN.startsWith('eyJ');
async function tmdbMovie(tmdbId) {
  const url = TMDB_IS_V4
    ? `https://api.themoviedb.org/3/movie/${tmdbId}`
    : `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_TOKEN}`;
  const headers = { accept: 'application/json' };
  if (TMDB_IS_V4) headers.Authorization = `Bearer ${TMDB_TOKEN}`;
  const res = await fetchRetry(url, { headers }, { label: `tmdb ${tmdbId}` });
  if (res.status === 404) return { notFound: true };
  if (!res.ok) throw new Error(`tmdb ${tmdbId}: HTTP ${res.status}`);
  const d = await res.json();
  return {
    original_title: d.original_title ?? null,
    original_language: d.original_language ?? null,
    overview: (d.overview || '').trim() || null,
    tagline: (d.tagline || '').trim() || null,
    genres: Array.isArray(d.genres) ? d.genres.map((g) => g.name).filter(Boolean) : [],
    runtime: typeof d.runtime === 'number' && d.runtime > 0 ? d.runtime : null,
    release_date: (d.release_date || '').trim() || null,
  };
}

// ---------- step 3: fill-only PATCH ----------
async function patchFilm(id, payload) {
  // Filter re-asserts visible=false so a visible=true row can never be touched.
  const url = `${SUPA_URL}/rest/v1/films?id=eq.${id}&visible=is.false`;
  const res = await fetchRetry(
    url,
    { method: 'PATCH', headers: { ...SUPA_HEADERS, Prefer: 'return=minimal' }, body: JSON.stringify(payload) },
    { label: `patch film ${id}` },
  );
  if (!res.ok) throw new Error(`patch film ${id}: HTTP ${res.status} ${await res.text()}`);
}

// ---------- main ----------
async function main() {
  const t0 = Date.now();
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}${Number.isFinite(LIMIT) ? `, limit ${LIMIT}` : ''}`);

  const hasLang = await probeHasLanguageColumn();
  console.log(`original_language column: ${hasLang ? 'EXISTS -> will fill' : 'absent -> skipping language fill'}`);

  const films = await fetchHiddenFilms();
  console.log(`Hidden films to process: ${films.length}`);

  const stats = {
    fetched: 0,
    tmdb404: 0,
    tmdbErrors: 0,
    otSet: 0,
    otSkippedIdentical: 0,
    otAlreadyPresent: 0,
    ovSet: 0,
    gSet: 0,
    rtSet: 0,
    rdSet: 0,
    tgSet: 0,
    langSet: 0,
    noChange: 0,
    patchErrors: 0,
  };
  const errorSamples = [];
  const dryRunSamples = [];

  // PATCH queue with limited concurrency, running alongside TMDB batches
  let inFlight = [];
  async function enqueuePatch(id, payload) {
    while (inFlight.length >= PATCH_CONCURRENCY) {
      await Promise.race(inFlight);
      inFlight = inFlight.filter((p) => !p.settled);
    }
    const p = patchFilm(id, payload)
      .catch((err) => {
        stats.patchErrors++;
        if (errorSamples.length < 10) errorSamples.push(err.message);
      })
      .finally(() => { p.settled = true; });
    inFlight.push(p);
  }

  for (let i = 0; i < films.length; i += TMDB_BATCH) {
    const batch = films.slice(i, i + TMDB_BATCH);
    const results = await Promise.all(
      batch.map(async (film) => {
        try {
          return { film, data: await tmdbMovie(film.tmdb_id) };
        } catch (err) {
          stats.tmdbErrors++;
          if (errorSamples.length < 10) errorSamples.push(err.message);
          return { film, data: null };
        }
      }),
    );

    for (const { film, data } of results) {
      if (!data) continue;
      stats.fetched++;
      if (data.notFound) { stats.tmdb404++; continue; }

      const payload = {};

      if (film.original_title == null) {
        if (data.original_title && data.original_title.trim() !== (film.title || '').trim()) {
          payload.original_title = data.original_title;
          stats.otSet++;
        } else if (data.original_title) {
          stats.otSkippedIdentical++;
        }
      } else {
        stats.otAlreadyPresent++;
      }

      if (film.overview == null && data.overview) {
        payload.overview = data.overview;
        stats.ovSet++;
      }

      if (film.genres == null && data.genres.length) {
        payload.genres = data.genres;
        stats.gSet++;
      }
      if (film.runtime == null && data.runtime != null) {
        payload.runtime = data.runtime;
        stats.rtSet++;
      }
      if (film.release_date == null && data.release_date) {
        payload.release_date = data.release_date;
        stats.rdSet++;
      }
      if (film.tagline == null && data.tagline) {
        payload.tagline = data.tagline;
        stats.tgSet++;
      }

      if (hasLang && film.original_language == null && data.original_language) {
        payload.original_language = data.original_language;
        stats.langSet++;
      }

      if (Object.keys(payload).length === 0) { stats.noChange++; continue; }

      if (DRY_RUN) {
        if (dryRunSamples.length < 25) {
          dryRunSamples.push({ id: film.id, title: film.title, ...payload });
        }
      } else {
        await enqueuePatch(film.id, payload);
      }
    }

    const done = Math.min(i + TMDB_BATCH, films.length);
    if (done % 500 < TMDB_BATCH || done === films.length) {
      console.log(`  progress: ${done}/${films.length} (${Math.round((Date.now() - t0) / 1000)}s)`);
    }
    if (i + TMDB_BATCH < films.length) await sleep(TMDB_GAP_MS);
  }

  await Promise.allSettled(inFlight);

  console.log('\n===== REPORT =====');
  console.log(`mode:                        ${DRY_RUN ? 'dry-run' : 'live'}`);
  console.log(`films processed:             ${films.length}`);
  console.log(`tmdb fetched ok:             ${stats.fetched - stats.tmdb404}`);
  console.log(`tmdb 404:                    ${stats.tmdb404}`);
  console.log(`tmdb errors (non-404):       ${stats.tmdbErrors}`);
  console.log(`original_title ${DRY_RUN ? 'would set' : 'set'}:      ${stats.otSet}`);
  console.log(`original_title skipped (identical to title): ${stats.otSkippedIdentical}`);
  console.log(`original_title already present:              ${stats.otAlreadyPresent}`);
  console.log(`overview ${DRY_RUN ? 'would set' : 'set'}:            ${stats.ovSet}`);
  console.log(`genres ${DRY_RUN ? 'would set' : 'set'}:              ${stats.gSet}`);
  console.log(`runtime ${DRY_RUN ? 'would set' : 'set'}:             ${stats.rtSet}`);
  console.log(`release_date ${DRY_RUN ? 'would set' : 'set'}:        ${stats.rdSet}`);
  console.log(`tagline ${DRY_RUN ? 'would set' : 'set'}:             ${stats.tgSet}`);
  console.log(`original_language ${DRY_RUN ? 'would set' : 'set'}:   ${hasLang ? stats.langSet : 'n/a (column absent)'}`);
  console.log(`rows with no change needed:  ${stats.noChange}`);
  console.log(`patch errors:                ${stats.patchErrors}`);
  console.log(`elapsed:                     ${Math.round((Date.now() - t0) / 1000)}s`);
  if (errorSamples.length) {
    console.log('\nerror samples:');
    for (const e of errorSamples) console.log(`  - ${e}`);
  }
  if (DRY_RUN && dryRunSamples.length) {
    console.log('\ndry-run change samples:');
    for (const s of dryRunSamples) {
      const parts = [];
      if (s.original_title) parts.push(`original_title="${s.original_title}"`);
      if (s.overview) parts.push(`overview=${JSON.stringify(s.overview.slice(0, 60))}...`);
      if (s.original_language) parts.push(`lang=${s.original_language}`);
      console.log(`  [${s.id}] "${s.title}" -> ${parts.join(' | ')}`);
    }
  }

  if (stats.tmdbErrors > 0 || stats.patchErrors > 0) process.exitCode = 2;
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
