#!/usr/bin/env python3
"""
Cinecodex scorer — runs on YOUR Mac (has internet + ANTHROPIC_API_KEY). The Cowork sandbox
blocks the Anthropic API (egress guardrail), so this runs locally, like the Phase-0 finalizer.

Synchronous Messages API + prompt caching + a small thread pool. Resumable (skips already-scored
films). Writes raw scores to the isolated `cinecodex` schema via public RPCs (service role).

Reads from ~/Documents/MetaTake/.env.local:
  ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

Usage (or just double-click a .command wrapper):
  python3 cinecodex_score.py [LIMIT] [SCOPE]
    LIMIT  = max films this run (e.g. 16 for a plumbing test; omit for all)
    SCOPE  = 'visible' (default) or 'all'
Stdlib only. Model: claude-sonnet-4-6 (Pass 1, N=1). temp 0.6, B=8.
"""
import os, sys, json, time, hashlib, pathlib, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

HERE = pathlib.Path(__file__).resolve().parent
PROMPT_FILE = HERE / "PROMPT_PRODUCTION_v2.txt"
PROMPT_VERSION = "cinecodex-prod-v2"
MODEL = "claude-sonnet-4-6"
TEMP = 0.6
B = 8            # films per request
THREADS = 6
PRICE_IN, PRICE_OUT, PRICE_CACHE = 3.0/1e6, 15.0/1e6, 0.30/1e6

def load_env():
    for p in [".env.local", os.path.expanduser("~/Documents/MetaTake/.env.local")]:
        f = pathlib.Path(p)
        if f.exists():
            for line in f.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env()
def need(k):
    v = os.environ.get(k)
    if not v: print(f"ERROR: {k} missing in .env.local", file=sys.stderr); sys.exit(1)
    return v
AK = need("ANTHROPIC_API_KEY")
SB = need("NEXT_PUBLIC_SUPABASE_URL").rstrip("/")
SK = need("SUPABASE_SERVICE_ROLE_KEY")
REST = SB + "/rest/v1"
SBH = {"apikey": SK, "Authorization": f"Bearer {SK}", "Content-Type": "application/json"}
PROMPT = PROMPT_FILE.read_text()
SHA = hashlib.sha256(PROMPT.encode()).hexdigest()
KEYS = ["cog","aff","form","moral","dur","itx","fr","etx","ctx","bank","insincere","coward","polar"]

def http(url, headers, data=None, timeout=120):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method="POST" if body else "GET")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read().decode(); return json.loads(raw) if raw.strip() else None
def rpc(fn, payload): return http(f"{REST}/rpc/{fn}", SBH, data=payload)

def anthropic(films):
    """Score a batch of up to B films; return list of run-row dicts (or [] on failure)."""
    lst = "\n".join(f"{i+1}. {f['title']} ({f.get('year') or '?'}, {f.get('director') or 'Unknown'})" for i, f in enumerate(films))
    body = {
        "model": MODEL, "max_tokens": 1500, "temperature": TEMP,
        "system": [{"type": "text", "text": PROMPT, "cache_control": {"type": "ephemeral"}}],
        "messages": [{"role": "user", "content": lst}],
    }
    hdr = {"x-api-key": AK, "anthropic-version": "2023-06-01", "content-type": "application/json"}
    for attempt in range(2):
        try:
            r = http("https://api.anthropic.com/v1/messages", hdr, data=body)
            txt = r["content"][0]["text"].strip()
            if txt.startswith("```"): txt = txt.split("```")[1].lstrip("json").strip() if "```" in txt else txt
            txt = txt[txt.find("["): txt.rfind("]") + 1]
            arr = json.loads(txt)
            if len(arr) != len(films): raise ValueError(f"count {len(arr)}!={len(films)}")
            u = r.get("usage", {})
            cin, cout = u.get("input_tokens", 0), u.get("output_tokens", 0)
            cache = u.get("cache_read_input_tokens", 0)
            cost = (cin*PRICE_IN + cout*PRICE_OUT + cache*PRICE_CACHE) / max(len(films), 1)
            rows = []
            def gv(o, k):  # model outputs UPPERCASE keys (COG, AFF, …); be case-insensitive
                v = o.get(k.upper(), o.get(k))
                return int(v) if isinstance(v, (int, float)) and 0 <= v <= 100 else None
            for i, f in enumerate(films):
                o = arr[i]
                vals = {k: gv(o, k) for k in KEYS}
                if any(vals[k] is None for k in KEYS): raise ValueError("bad scores")
                rows.append({"film_id": f["film_id"], "prompt_version": PROMPT_VERSION, "vendor": "anthropic",
                    "model_id": MODEL, "temperature": TEMP, "sample_index": 1,
                    **vals, "raw_json": o,
                    "input_tokens": cin//len(films), "output_tokens": cout//len(films),
                    "cache_read_tokens": cache//len(films), "cost_usd": round(cost, 6), "parse_ok": True})
            return rows
        except (urllib.error.HTTPError, urllib.error.URLError, ValueError, KeyError, json.JSONDecodeError) as e:
            if attempt == 0: time.sleep(3); continue
            print(f"  batch failed ({films[0]['title']}…): {e}", file=sys.stderr); return []

def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 100000
    scope = sys.argv[2] if len(sys.argv) > 2 else "visible"
    print(f"Freezing prompt {PROMPT_VERSION} (sha {SHA[:12]}…)")
    rpc("cinecodex_freeze_prompt", {"p_version": PROMPT_VERSION, "p_sha": SHA, "p_text": PROMPT})
    films = rpc("cinecodex_targets", {"p_scope": scope, "p_limit": limit}) or []
    print(f"targets ({scope}, unscored): {len(films)}")
    if not films: print("Nothing to score."); return
    batches = [films[i:i+B] for i in range(0, len(films), B)]
    done = scored = 0; total_cost = 0.0
    with ThreadPoolExecutor(max_workers=THREADS) as ex:
        futs = {ex.submit(anthropic, b): b for b in batches}
        buf = []
        for fut in as_completed(futs):
            rows = fut.result(); done += 1
            if rows:
                buf.extend(rows); scored += len(rows); total_cost += sum(r["cost_usd"] for r in rows)
            if len(buf) >= 200:
                rpc("cinecodex_write_runs", {"p_rows": buf}); buf = []
            if done % 10 == 0:
                print(f"  {done}/{len(batches)} batches · scored {scored} · ~${total_cost:.2f}")
        if buf: rpc("cinecodex_write_runs", {"p_rows": buf})
    print("Aggregating medians → cinecodex.scores …")
    rpc("cinecodex_aggregate", {"p_prompt_version": PROMPT_VERSION, "p_panel": "sonnet-n1"})
    print(f"DONE. scored {scored} films this run · ~${total_cost:.2f}. Re-run to resume; tell the assistant to review the distribution.")

if __name__ == "__main__":
    main()
