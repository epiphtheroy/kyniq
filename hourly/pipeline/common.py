#!/usr/bin/env python3
"""Now Playing pipeline — shared plumbing (stdlib only).

Env comes from the repo's .env.local (same convention as worker/blog-ingest.py).
The sandbox has no internet: everything here runs on the operator's machine
via cron/launchd.
"""
from __future__ import annotations

import json
import re
import time
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
HOURLY = REPO / "hourly"
UA = "MetatakeNowPipeline/0.1 (metatake.net)"


def load_env() -> dict:
    """Merge os.environ over .env.local (never log values)."""
    import os

    env: dict[str, str] = {}
    f = REPO / ".env.local"
    if f.exists():
        for line in f.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    env.update({k: v for k, v in os.environ.items() if k in {
        "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
        "ANTHROPIC_API_KEY", "NEXT_PUBLIC_SITE_URL", "REVALIDATION_SECRET",
        "BLUESKY_HANDLE", "BLUESKY_APP_PASSWORD", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHANNEL",
    }})
    return env


def http(url: str, *, method: str = "GET", headers: dict | None = None,
         body: bytes | None = None, timeout: int = 20, retries: int = 2) -> tuple[int, bytes]:
    """One HTTP call with small retry; returns (status, body). Never raises on HTTP errors."""
    hdrs = {"User-Agent": UA}
    if headers:
        hdrs.update(headers)
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.status, r.read()
        except urllib.error.HTTPError as e:
            return e.code, e.read() if e.fp else b""
        except Exception:
            if attempt == retries:
                return 0, b""
            time.sleep(1.5 * (attempt + 1))
    return 0, b""


# ── Supabase REST ────────────────────────────────────────────────────────────

def sb_get(env: dict, path: str, *, service: bool = False) -> list | dict | None:
    """GET {SUPABASE_URL}/rest/v1/{path}. Returns parsed JSON or None."""
    key = env["SUPABASE_SERVICE_ROLE_KEY" if service else "NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    url = f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/{path}"
    status, data = http(url, headers={"apikey": key, "Authorization": f"Bearer {key}"})
    if status != 200:
        return None
    try:
        return json.loads(data)
    except Exception:
        return None


def sb_insert(env: dict, table: str, row: dict) -> tuple[bool, str]:
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    url = f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/{table}"
    status, data = http(url, method="POST", body=json.dumps(row).encode(),
                        headers={"apikey": key, "Authorization": f"Bearer {key}",
                                 "Content-Type": "application/json", "Prefer": "return=minimal"})
    return status in (200, 201), f"{status} {data[:300].decode('utf-8', 'ignore')}"


def sb_rpc(env: dict, fn: str, args: dict, *, service: bool = False):
    """POST /rest/v1/rpc/{fn}. Returns parsed JSON or None."""
    key = env["SUPABASE_SERVICE_ROLE_KEY" if service else "NEXT_PUBLIC_SUPABASE_ANON_KEY"]
    url = f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/rpc/{fn}"
    status, data = http(url, method="POST", body=json.dumps(args).encode(),
                        headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    if status != 200:
        return None
    try:
        return json.loads(data)
    except Exception:
        return None


def sb_update(env: dict, table: str, filt: str, patch: dict) -> tuple[bool, str]:
    """PATCH rows matching a PostgREST filter, e.g. filt='slug=eq.foo'."""
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    url = f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/{table}?{filt}"
    status, data = http(url, method="PATCH", body=json.dumps(patch).encode(),
                        headers={"apikey": key, "Authorization": f"Bearer {key}",
                                 "Content-Type": "application/json", "Prefer": "return=minimal"})
    return status in (200, 204), f"{status} {data[:300].decode('utf-8', 'ignore')}"


# ── Anthropic Messages API ───────────────────────────────────────────────────

def anthropic_call(env: dict, *, model: str, system: str, user: str,
                   max_tokens: int = 4096, web_search: bool = False,
                   timeout: int = 600) -> str | None:
    """One Messages API call; returns concatenated text blocks or None."""
    payload: dict = {
        "model": model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    if web_search:
        payload["tools"] = [{"type": "web_search_20250305", "name": "web_search", "max_uses": 6}]
    status, data = http(
        "https://api.anthropic.com/v1/messages", method="POST",
        body=json.dumps(payload).encode(),
        headers={"x-api-key": env["ANTHROPIC_API_KEY"],
                 "anthropic-version": "2023-06-01",
                 "content-type": "application/json"},
        timeout=timeout, retries=1)
    if status != 200:
        log(f"anthropic {model} -> HTTP {status}: {data[:200].decode('utf-8', 'ignore')}")
        return None
    try:
        msg = json.loads(data)
        return "".join(b.get("text", "") for b in msg.get("content", []) if b.get("type") == "text")
    except Exception:
        return None


def parse_json_block(text: str) -> dict | None:
    """Extract the outermost JSON object from a model reply (handles ```json fences)."""
    if not text:
        return None
    m = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    raw = m.group(1) if m else None
    if raw is None:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            return None
        raw = text[start:end + 1]
    try:
        return json.loads(raw)
    except Exception:
        return None


# ── misc ─────────────────────────────────────────────────────────────────────

def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s[:80] or "piece"


def now_utc() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def log(msg: str) -> None:
    print(f"[{now_utc()}] {msg}", flush=True)


def ledger_append(line: str) -> None:
    with open(HOURLY / "ledger.md", "a") as f:
        f.write(line.rstrip() + "\n")
