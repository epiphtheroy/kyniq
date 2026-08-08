#!/usr/bin/env python3
"""
panel_ab — measure the gap between two scoring panels on the SAME films.

The cinecodex corpus was scored by one panel (sonnet-4-6, temp 0.6). Scoring the
remaining films with a different model puts them in the same ranked space as
everything else, so a systematic offset would move those films up or down the
league table for a reason that has nothing to do with the films. This measures
that offset before any of it is published.

Reads published sub-scores through the public RPC, re-scores the same titles with
the candidate model, and reports per-dimension deltas. WRITES NOTHING.

  CINECODEX_MODEL=claude-opus-5 python3 score/panel_ab.py 24
"""
import os, sys, json, statistics, pathlib, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
PROMPT = (HERE / "PROMPT_PRODUCTION_v2.txt").read_text()
KEYS = ["cog","aff","form","moral","dur","itx","fr","etx","ctx","bank","insincere","coward","polar"]
CAND = os.environ.get("CINECODEX_MODEL", "claude-opus-5")
N = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 24
B = 8

env = {}
for line in (ROOT / ".env.local").read_text().splitlines():
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1); env[k.strip()] = v.strip().strip('"').strip("'")
AK = os.environ.get("ANTHROPIC_API_KEY") or env["ANTHROPIC_API_KEY"]
SB = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/"); SK = env["SUPABASE_SERVICE_ROLE_KEY"]
SBH = {"apikey": SK, "Authorization": f"Bearer {SK}", "Content-Type": "application/json"}


def http(url, headers, data=None, timeout=180):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method="POST" if body else "GET")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw.strip() else None


def rest(path):
    return http(f"{SB}/rest/v1/{path}", SBH)


def rpc(fn, payload):
    return http(f"{SB}/rest/v1/rpc/{fn}", SBH, data=payload)


def score(films):
    """Score a batch with the candidate model. Mirrors cinecodex_score.anthropic()."""
    lst = "\n".join(f"{i+1}. {f['title']} ({f.get('year') or '?'}, {f.get('director') or 'Unknown'})"
                    for i, f in enumerate(films))
    body = {"model": CAND, "max_tokens": 4000,
            "system": [{"type": "text", "text": PROMPT, "cache_control": {"type": "ephemeral"}}],
            "messages": [{"role": "user", "content": lst}],
            "thinking": {"type": "disabled"}}
    hdr = {"x-api-key": AK, "anthropic-version": "2023-06-01", "content-type": "application/json"}
    try:
        r = http("https://api.anthropic.com/v1/messages", hdr, data=body)
    except urllib.error.HTTPError as e:
        print(f"  ! {e.code}: {e.read().decode()[:300]}", file=sys.stderr); return {}
    txt = r["content"][0]["text"].strip()
    txt = txt[txt.find("["): txt.rfind("]") + 1]
    arr = json.loads(txt)
    out = {}
    for f, o in zip(films, arr):
        vals = {}
        for k in KEYS:
            v = o.get(k.upper(), o.get(k))
            if isinstance(v, (int, float)) and 0 <= v <= 100:
                vals[k] = int(v)
        if len(vals) == len(KEYS):
            out[f["slug"]] = vals
    return out


# ── sample films that already carry a published score ────────────────────────
films = rest(f"films?select=id,slug,title,year,director&is_analyzed=eq.true&order=slug&limit={N*3}")
sample, published = [], {}
for f in films:
    if len(sample) >= N:
        break
    try:
        card = rpc("cinecodex_film_subscores", {"p_slug": f["slug"]})
    except Exception:
        continue
    # cinecodex_film_subscores returns {"scores": {dim: raw}, "pct": {dim: percentile}, …}
    # — the raw `scores` block is the panel's own output and the only thing
    # comparable across panels; `pct` is relative to the corpus and would move
    # even if the candidate agreed with sonnet exactly.
    raw = (card or {}).get("scores") or {}
    dims = {k: float(raw[k]) for k in KEYS if isinstance(raw.get(k), (int, float))}
    if len(dims) == len(KEYS):
        published[f["slug"]] = dims
        sample.append(f)

if not sample:
    print("published sub-scores unreadable through cinecodex_film_subscores — "
          "cannot run a paired comparison. Score a calibration set and compare by hand.")
    sys.exit(1)

print(f"paired sample: {len(sample)} films · candidate {CAND}")
batches = [sample[i:i+B] for i in range(0, len(sample), B)]
cand = {}
with ThreadPoolExecutor(max_workers=4) as ex:
    for d in ex.map(score, batches):
        cand.update(d)

paired = [s for s in cand if s in published]
print(f"scored {len(paired)} of {len(sample)}\n")
print(f"{'dim':<10} {'sonnet':>8} {'cand':>8} {'Δ평균':>8} {'Δ중앙':>8}")
alldelta = []
for k in KEYS:
    a = [published[s][k] for s in paired]
    b = [cand[s][k] for s in paired]
    d = [y - x for x, y in zip(a, b)]
    alldelta += d
    print(f"{k:<10} {statistics.mean(a):8.1f} {statistics.mean(b):8.1f} "
          f"{statistics.mean(d):+8.1f} {statistics.median(d):+8.1f}")
print(f"\n전체 Δ 평균 {statistics.mean(alldelta):+.2f} · 중앙 {statistics.median(alldelta):+.1f} "
      f"· 표준편차 {statistics.pstdev(alldelta):.1f}")
print(f"|Δ|>10 인 축-영화 조합: {sum(1 for d in alldelta if abs(d) > 10)}/{len(alldelta)} "
      f"({sum(1 for d in alldelta if abs(d) > 10)*100//max(len(alldelta),1)}%)")
