#!/usr/bin/env python3
"""Generate a search-friendly title phrase (meta_takes.seo_phrase) for each hub,
via the Anthropic Message Batches API (≈50% cheaper, async).

Hubs (readings + tropes) are named with distinctive concept names ("Extractive
Empathy") that nobody Googles. This writes a plain-language phrase a person WOULD
search ("Films About Caring As Exploitation"), used in the page <title> so hubs
rank for "films about/with X" — while the on-page H1 keeps the concept name.

  --submit : one tiny request per published reading/trope lacking seo_phrase → batch.
             Returns immediately; saves batch id. (you can close the laptop)
  --fetch  : poll; when ENDED, write seo_phrase to meta_takes. Idempotent
             (only fills rows still NULL). Safe to re-run.

Usage:
  python3 mt-seo-batch.py --submit
  python3 mt-seo-batch.py --fetch
"""
import os, sys, json, time, urllib.request, urllib.error, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT, ".env.local"))
URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY"); ANT = os.environ.get("ANTHROPIC_API_KEY")
if not (URL and KEY and ANT): print("Missing env (Supabase url/service key + ANTHROPIC_API_KEY)"); sys.exit(1)

args = sys.argv[1:]
SUBMIT = "--submit" in args; FETCH = "--fetch" in args
BATCH = args[args.index("--batch") + 1] if "--batch" in args else None
MODEL = "claude-haiku-4-5-20251001"  # a 9-word search phrase doesn't need Opus; Haiku is ~15x cheaper
STATE = os.path.join(HERE, "mt-seo-batch.json")
API = "https://api.anthropic.com/v1/messages/batches"

def http(method, url, headers=None, body=None, timeout=300):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None)
    for k, v in (headers or {}).items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:600]
def anth(method, url, body=None):
    return http(method, url, {"x-api-key": ANT, "anthropic-version": "2023-06-01", "content-type": "application/json"}, body)
def sb(method, path, body=None, prefer=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
    if prefer: h["Prefer"] = prefer
    return http(method, f"{URL}/rest/v1/{path}", h, body)
def fetch_all(path):
    rows = []; off = 0
    while True:
        st, tx = sb("GET", f"{path}{'&' if '?' in path else '?'}limit=1000&offset={off}")
        if st != 200: raise RuntimeError(f"{st}: {tx[:200]}")
        b = json.loads(tx); rows += b
        if len(b) < 1000: break
        off += 1000
    return rows
def parse(t):
    try: return json.loads(t)
    except Exception:
        s = t.find("{"); e = t.rfind("}")
        if s >= 0 and e > s:
            try: return json.loads(t[s:e + 1])
            except Exception: return None
    return None

SYSTEM = (
"You write ONE short, search-friendly page title for a film-criticism hub — the phrase a real person "
"would type into Google. The hub gathers many films that share a single critical idea or on-screen device.\n"
"RULES: Title Case. <= 9 words. Concrete and plain (no jargon, no the hub's invented name). NO count, NO period, "
"NO quotes. Start with 'Films' or 'Movies'.\n"
"  • reading (a recurring idea/meaning) -> 'Films About {X}' or 'Films That {verb} {X}'\n"
"  • trope (a recurring on-screen device/image) -> 'Films With {X}' or 'Films That {verb} {X}'\n"
"Examples: 'Films About Caring As Exploitation', 'Films With a Menacing Face in Close-Up', "
"'Films That Use Color As Emotion', 'Films About Surveillance and Control'.\n"
'Return ONLY JSON: {"seo_phrase":"..."}'
)

def build_user(h):
    kind = "trope" if h.get("kind") == "figure_type" else "reading"
    return (f"TYPE: {kind}\nName: {h.get('title')}\nOne-liner: {h.get('laconic') or '—'}\n"
            f"Thesis: {(h.get('thesis') or '—')[:400]}\nWrite the search phrase. JSON only.")

def hubs_needing():
    q = ("meta_takes?select=id,kind,title,laconic,thesis&status=eq.published"
         "&kind=in.(reading,figure_type)&seo_phrase=is.null")
    return fetch_all(q)

def submit():
    hubs = hubs_needing()
    print(f"[mt-seo submit] hubs needing a phrase: {len(hubs)} | model {MODEL}")
    if not hubs: print("  nothing to do (all hubs have seo_phrase)."); return
    reqs = [{"custom_id": h["id"],
             "params": {"model": MODEL, "max_tokens": 200, "system": SYSTEM,
                        "messages": [{"role": "user", "content": build_user(h) + "\n\nReturn ONLY the raw JSON object."}]}}
            for h in hubs]
    st, tx = anth("POST", API, {"requests": reqs})
    if st >= 300: print(f"  ! submit failed {st}: {tx}"); sys.exit(1)
    d = json.loads(tx); bid = d.get("id")
    json.dump({"batch_id": bid, "count": len(reqs)}, open(STATE, "w"))
    print(f"\n✅ Submitted batch {bid} ({len(reqs)} hubs). status={d.get('processing_status')}")
    print("   Later: run the FETCH command to write the phrases. (close the laptop is fine)")

def fetch():
    bid = BATCH or (json.load(open(STATE)).get("batch_id") if os.path.exists(STATE) else None)
    if not bid: print("No batch id — run --submit first, or pass --batch"); sys.exit(1)
    st, tx = anth("GET", f"{API}/{bid}")
    if st >= 300: print(f"  ! status {st}: {tx}"); sys.exit(1)
    d = json.loads(tx); ps = d.get("processing_status")
    print(f"[batch {bid}] status={ps} counts={d.get('request_counts', {})}")
    if ps != "ended": print("  Not ready yet — re-run later."); return
    st, body = anth("GET", d.get("results_url"))
    if st >= 300: print(f"  ! results {st}: {body[:300]}"); sys.exit(1)
    n = err = 0
    for line in body.splitlines():
        if not line.strip(): continue
        rec = json.loads(line); mid = rec.get("custom_id"); res = rec.get("result", {})
        if res.get("type") != "succeeded": err += 1; continue
        text = "".join(p.get("text", "") for p in res.get("message", {}).get("content", []) if p.get("type") == "text")
        obj = parse(text) or {}
        phrase = (obj.get("seo_phrase") or "").strip().strip('"').rstrip(".")
        if not phrase or len(phrase) > 120: err += 1; continue
        st2, _ = sb("PATCH", f"meta_takes?id=eq.{mid}", {"seo_phrase": phrase}, prefer="return=minimal")
        if st2 < 300: n += 1
        else: err += 1
    print(f"\n✅ Wrote seo_phrase for {n} hubs. errors/skipped={err}")
    print("   Hub <title>s now use these phrases on next revalidate. Re-run --fetch if any errored.")

if __name__ == "__main__":
    if SUBMIT: submit()
    elif FETCH: fetch()
    else: print("Specify --submit or --fetch"); sys.exit(1)
