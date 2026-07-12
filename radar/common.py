#!/usr/bin/env python3
"""Keyword Radar — shared plumbing (정본: HANDOFF-키워드레이더.md §7).

Re-uses hourly/pipeline/common.py wholesale (http+UA, .env.local loader, log,
now_utc) and adds radar-only helpers: URL normalization + hashing, service-role
upsert-ignore, the items+hits writer, keyword→automaton loading, and run/ledger
bookkeeping. Stdlib only (no pip); the sandbox has no internet — this runs on
the operator's Mac. All radar_* tables are service-role only (no RLS policies),
so every DB call here uses the service key.
"""
from __future__ import annotations

import hashlib
import html as _html
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "hourly"))
from pipeline.common import UA, http, load_env, log, now_utc  # noqa: E402,F401  (re-exported)

LEDGER = HERE / "ledger.md"
USAGE = HERE / "usage.jsonl"

# Only well-known analytics params are stripped — never generic ?ref=/?source=
# which some sites use as real routing keys.
_TRACKING = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "igsh", "gclid", "mc_cid", "mc_eid", "s_cid", "_hsenc", "_hsmi",
}


# ── URL normalization / hashing ──────────────────────────────────────────────

def normalize_url(u: str) -> str:
    """Lowercase host, drop tracking params + fragment, trim trailing slash.
    Stable across sources so the same article hashes once."""
    try:
        s = urlsplit((u or "").strip())
        if not s.netloc:
            return (u or "").strip()
        q = [(k, v) for k, v in parse_qsl(s.query, keep_blank_values=False)
             if k.lower() not in _TRACKING]
        path = s.path.rstrip("/") or "/"
        return urlunsplit((s.scheme.lower() or "https", s.netloc.lower(), path,
                           urlencode(sorted(q)), ""))
    except Exception:
        return (u or "").strip()


def url_hash(u: str) -> str:
    return hashlib.sha256(normalize_url(u).encode("utf-8")).hexdigest()


# ── author classification: individual vs institution (개인 창작자 발굴) ─────────
# The radar's purpose pivoted to finding INDIVIDUAL creators (people you can build
# relationships with), not major outlets. classify_author tags each item so the
# feed can hide institutions by default. We only need to reliably identify
# institutions — everything else flows through as 'individual'.

INSTITUTION_DOMAINS = {
    # trade / news / big culture outlets — never an "individual creator"
    "variety.com", "deadline.com", "hollywoodreporter.com", "thewrap.com",
    "indiewire.com", "theguardian.com", "nytimes.com", "washingtonpost.com",
    "bbc.com", "bbc.co.uk", "npr.org", "apnews.com", "reuters.com", "cnn.com",
    "latimes.com", "vulture.com", "avclub.com", "rollingstone.com", "ew.com",
    "empireonline.com", "totalfilm.com", "screenrant.com", "collider.com",
    "slashfilm.com", "ign.com", "polygon.com", "theverge.com", "vice.com",
    "buzzfeed.com", "huffpost.com", "salon.com", "slate.com", "theatlantic.com",
    "newyorker.com", "vanityfair.com", "gq.com", "esquire.com", "time.com",
    "usatoday.com", "forbes.com", "businessinsider.com", "yahoo.com",
    "aljazeera.com", "ft.com", "wsj.com", "economist.com", "sky.com",
    "metacritic.com", "rottentomatoes.com", "imdb.com", "themoviedb.org",
    "mubi.com", "criterion.com", "filmcomment.com", "sensesofcinema.com",
    "lwlies.com", "littlewhitelies.co.uk", "filmmakermagazine.com",
    "cineuropa.org", "screendaily.com", "thefilmstage.com", "reverseshot.org",
    "lareviewofbooks.org", "kinolorber.com", "gamespot.com", "engadget.com",
    "gizmodo.com", "wired.com", "mashable.com", "cbr.com", "gamesradar.com",
    "movieweb.com", "livemint.com", "hindustantimes.com", "indiatimes.com",
    "koreaherald.com", "koreatimes.co.kr", "hankyung.com", "chosun.com",
}
_INSTITUTION_AUTHOR = re.compile(
    r"\b(staff|editor|editorial|newsroom|team|desk|reporters?|correspondent|"
    r"associated press|reuters|agency|bureau|press|wire)\b", re.I)


def _host(u: str) -> str:
    try:
        h = urlsplit((u or "").strip()).netloc.lower()
        return h[4:] if h.startswith("www.") else h
    except Exception:
        return ""


def classify_author(platform: str, url: str, author: str | None) -> str:
    """'institution' | 'individual'. Only institutions are positively detected;
    the default is 'individual' so ambiguous items still surface."""
    if platform == "news":                      # GDELT et al. = news index
        return "institution"
    h = _host(url)
    if h and (h in INSTITUTION_DOMAINS or any(h.endswith("." + d) for d in INSTITUTION_DOMAINS)):
        return "institution"
    if author and _INSTITUTION_AUTHOR.search(author):
        return "institution"
    return "individual"


# ── text / date utils (shared by every poller) ───────────────────────────────

_TAG = re.compile(r"<[^>]+>")
_WS2 = re.compile(r"\s+")


def strip_html(s: str) -> str:
    return _WS2.sub(" ", _html.unescape(_TAG.sub(" ", s or ""))).strip()


def clip(s: str, n: int = 300) -> str:
    """Snippet for public display — cut at a word boundary, add an ellipsis."""
    s = (s or "").strip()
    if len(s) <= n:
        return s
    cut = s[:n].rsplit(" ", 1)[0] or s[:n]
    return cut + "…"


_DATE_FMTS = (
    "%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S %Z",
    "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S.%f%z",
    "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%d %H:%M:%S",
)


def parse_date(s: str) -> str | None:
    """Parse an RSS/Atom/ISO date to a UTC 'Z' ISO string, or None."""
    if not s:
        return None
    raw = s.strip().replace("GMT", "+0000").replace("Z", "+0000") if s.strip().endswith("Z") else s.strip()
    for fmt in _DATE_FMTS:
        try:
            dt = datetime.strptime(raw, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        except Exception:
            continue
    return None


def hours_ago_iso(h: float) -> str:
    """PostgREST-safe (Z-format) timestamp h hours before now."""
    return (datetime.now(timezone.utc) - timedelta(hours=h)).strftime("%Y-%m-%dT%H:%M:%SZ")


def within_hours(iso_z: str | None, h: float) -> bool:
    """True if iso_z is missing (keep — dedup protects) or newer than h hours."""
    if not iso_z:
        return True
    try:
        dt = datetime.strptime(iso_z, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        return dt >= datetime.now(timezone.utc) - timedelta(hours=h)
    except Exception:
        return True


# ── Supabase REST (service role — radar_* has no RLS) ────────────────────────

def _svc_headers(env: dict, extra: dict | None = None) -> dict:
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    # NOTE: sb_secret_* keys are REJECTED (401 "Forbidden use of secret API key
    # in browser") when the request's User-Agent looks like a browser — and
    # hourly's shared http() always sets a "Mozilla/5.0 (compatible; ...)" UA.
    # Override it with a non-browser UA on every service-role radar call.
    h = {"apikey": key, "Authorization": f"Bearer {key}",
         "Content-Type": "application/json", "User-Agent": "metatake-radar/1.0"}
    if extra:
        h.update(extra)
    return h


def sb_get(env: dict, path: str) -> list | dict | None:
    """GET /rest/v1/{path} with the SERVICE key (radar tables bypass RLS)."""
    url = f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/{path}"
    status, data = http(url, headers=_svc_headers(env))
    if status != 200:
        return None
    try:
        return json.loads(data)
    except Exception:
        return None


def sb_post(env: dict, table: str, rows, *, on_conflict: str | None = None,
            ignore: bool = False, representation: bool = False) -> tuple[int, list | None]:
    """POST rows (list or dict). ignore=True → resolution=ignore-duplicates.
    Returns (status, parsed_representation_or_None)."""
    q = f"?on_conflict={on_conflict}" if on_conflict else ""
    url = f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/{table}{q}"
    prefer = []
    if ignore:
        prefer.append("resolution=ignore-duplicates")
    prefer.append("return=representation" if representation else "return=minimal")
    status, data = http(url, method="POST", body=json.dumps(rows).encode(),
                        headers=_svc_headers(env, {"Prefer": ",".join(prefer)}))
    parsed = None
    if representation and status in (200, 201):
        try:
            parsed = json.loads(data)
        except Exception:
            parsed = None
    if status not in (200, 201):
        log(f"sb_post {table} -> HTTP {status}: {data[:200].decode('utf-8', 'ignore')}")
    return status, parsed


def sb_patch(env: dict, table: str, filt: str, patch: dict) -> bool:
    url = f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/{table}?{filt}"
    status, _ = http(url, method="PATCH", body=json.dumps(patch).encode(),
                     headers=_svc_headers(env, {"Prefer": "return=minimal"}))
    return status in (200, 204)


# ── items + hits writer ──────────────────────────────────────────────────────

def upsert_items(env: dict, items: list[dict]) -> tuple[int, int, int]:
    """Insert new radar_items (dedup by url_hash) and link radar_hits.

    Each item dict carries a `_kw` set of keyword ids and a `_matched_on` map
    {kw_id: 'title'|'text'|...}. Underscore-prefixed keys are stripped before
    the DB write. Idempotent: re-seen URLs are ignored; hits are upserted on
    (item_id, keyword_id) so re-linking is a no-op.

    Returns (items_seen, items_new, hits). A hard items-insert failure returns
    (0, 0, 0) — callers with one-shot inputs (process_inbox) MUST treat a
    0-seen result from a NON-empty batch as a failure and not consume the source.
    """
    if not items:
        return (0, 0, 0)
    # dedup within the batch, unioning keyword hits
    by_hash: dict[str, dict] = {}
    for it in items:
        h = it["url_hash"]
        if h in by_hash:
            by_hash[h]["_kw"] |= it.get("_kw", set())
            by_hash[h].setdefault("_matched_on", {}).update(it.get("_matched_on", {}))
        else:
            it.setdefault("_kw", set())
            it.setdefault("_matched_on", {})
            by_hash[h] = it
    batch = list(by_hash.values())
    for it in batch:  # tag individual vs institution unless the caller pre-set it
        if not it.get("author_kind"):
            it["author_kind"] = classify_author(it.get("platform", ""), it.get("url", ""), it.get("author"))
    rows = [{k: v for k, v in it.items() if not k.startswith("_")} for it in batch]

    status, rep = sb_post(env, "radar_items", rows, on_conflict="url_hash",
                          ignore=True, representation=True)
    if status not in (200, 201):
        return (0, 0, 0)
    items_new = len(rep or [])

    # map url_hash -> id for the WHOLE batch (new + pre-existing), chunked to
    # keep the ?in.() URL short. Covers the cross-source "same URL, new keyword"
    # case so those hits still get linked.
    id_by_hash: dict[str, int] = {}
    hashes = [it["url_hash"] for it in batch]
    for i in range(0, len(hashes), 60):
        chunk = hashes[i:i + 60]
        got = sb_get(env, "radar_items?select=id,url_hash&url_hash=in.(" + ",".join(chunk) + ")")
        for r in (got or []):
            id_by_hash[r["url_hash"]] = r["id"]

    hits = []
    for it in batch:
        iid = id_by_hash.get(it["url_hash"])
        if not iid:
            continue
        for kid in it["_kw"]:
            hits.append({"item_id": iid, "keyword_id": kid,
                         "matched_on": it["_matched_on"].get(kid, "text")})
    if hits:
        sb_post(env, "radar_hits", hits, on_conflict="item_id,keyword_id", ignore=True)
    return (len(batch), items_new, len(hits))


# ── keyword loading / automaton ──────────────────────────────────────────────

def load_keywords(env: dict) -> list[dict]:
    """All active radar_keywords, paged past the 1000-row cap."""
    rows: list[dict] = []
    offset = 0
    while True:
        batch = sb_get(env, "radar_keywords?select=id,keyword,match_text,norm,aliases,"
                            f"require_context,tier&active=is.true&order=id&limit=1000&offset={offset}")
        if not isinstance(batch, list) or not batch:
            break
        rows.extend(batch)
        if len(batch) < 1000:
            break
        offset += 1000
    return rows


def build_matcher(env: dict):
    """Load keywords and return a ready Matcher (radar/matcher.py)."""
    from matcher import Matcher  # local module
    return Matcher(load_keywords(env))


def load_film_corpus() -> dict:
    """metatake's full film corpus (title+year → slug) from the local entity
    cache, for Letterboxd's STRUCTURED matching (RSS carries filmTitle/filmYear,
    so we match precisely against all ~7k films — no keyword automaton, no false
    positives, and we get the slug for the '→ metatake page' action link).
    Returns {'by_ty': {(norm_title, year): slug}, 'by_t': {norm_title: slug}}."""
    from matcher import norm
    f = HERE.parent / "hourly" / "poller" / "entities.json"
    by_ty: dict = {}
    by_t: dict = {}
    if not f.exists():
        return {"by_ty": by_ty, "by_t": by_t}
    try:
        films = json.loads(f.read_text()).get("films", [])
    except Exception:
        return {"by_ty": by_ty, "by_t": by_t}
    for fm in films:
        t, y, slug = fm.get("title"), fm.get("year"), fm.get("slug")
        if not t or not slug:
            continue
        nt = norm(t)
        if y:
            try:
                by_ty[(nt, int(y))] = slug
            except Exception:
                pass
        by_t.setdefault(nt, slug)
    return {"by_ty": by_ty, "by_t": by_t}


# ── run / ledger bookkeeping ─────────────────────────────────────────────────

def record_run(env: dict, engine: str, *, items_seen: int = 0, items_new: int = 0,
               hits: int = 0, cost_usd: float = 0.0, errors: list | None = None) -> None:
    """Append a completed radar_runs row and, if this + the previous two runs of
    this engine all carry errors, drop a ledger warning (no source is load-bearing)."""
    errors = errors or []
    sb_post(env, "radar_runs", {
        "engine": engine, "finished_at": now_utc(), "items_seen": items_seen,
        "items_new": items_new, "hits": hits, "cost_usd": round(cost_usd, 4),
        "errors": errors,
    })
    if errors:
        prev = sb_get(env, f"radar_runs?select=errors&engine=eq.{engine}"
                          "&order=started_at.desc&limit=3")
        if isinstance(prev, list) and len(prev) >= 3 and all((p.get("errors") or []) for p in prev):
            ledger(f"⚠️ {engine}: 3 consecutive runs with errors — {errors[:1]}")


def ledger(line: str) -> None:
    with open(LEDGER, "a") as f:
        f.write(f"- [{now_utc()}] {line.rstrip()}\n")


def log_cost(engine: str, calls: int, cost_usd: float, note: str = "") -> None:
    """Append paid-API spend to usage.jsonl (Phase 0 has none, but Phase 1 must
    stay accountable — owner is pay-per-use)."""
    try:
        with open(USAGE, "a") as f:
            f.write(json.dumps({"at": now_utc(), "engine": engine, "calls": calls,
                                "cost_usd": round(cost_usd, 4), "note": note}) + "\n")
    except Exception:
        pass
