#!/usr/bin/env python3
"""next-load — next-all.resolved.jsonl → Supabase film_next (per source film replace; idempotent)."""
import os, sys, json, time, urllib.request, urllib.error, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT, ".env.local"))
URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
SRC = os.path.join(HERE, "next-all.resolved.jsonl")
DRY = "--dry" in sys.argv
if not (URL and KEY): sys.exit("Missing SUPABASE env")
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}

def http(method, url, body=None, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data)
    for k, v in H.items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:300]

def main():
    if not os.path.exists(SRC): sys.exit(f"missing {SRC} — run next-resolve.py first")
    rows = [json.loads(l) for l in open(SRC, encoding="utf-8") if l.strip()]
    src_ids = sorted({r["source_film_id"] for r in rows})
    linked = sum(1 for r in rows if r.get("target_film_id"))
    print(f"rows {len(rows)} · source films {len(src_ids)} · linked-to-DB {linked} · tmdb-only {len(rows)-linked}")
    if DRY:
        for r in rows[:8]:
            tag = "→DB" if r.get("target_film_id") else ("→TMDB" if r.get("tmdb_id") else "—")
            print(f"  {r['source_slug']} #{r['position']} {tag} {r['rec_title']} ({r.get('rec_year')})")
        print("DRY — no write."); return
    # delete existing for these films
    for i in range(0, len(src_ids), 80):
        chunk = src_ids[i:i + 80]
        flt = "in.(" + ",".join(chunk) + ")"
        u = f"{URL}/rest/v1/film_next?source_film_id={urllib.parse.quote(flt, safe='().,')}"
        st, tx = http("DELETE", u)
        if st >= 300: print(f"  ! delete {st}: {tx[:160]}")
        time.sleep(0.03)
    print(f"cleared {len(src_ids)} films")
    # insert
    payload = [{"source_film_id": r["source_film_id"], "position": r["position"],
                "rec_title": r["rec_title"][:300], "rec_year": r.get("rec_year"),
                "rec_director": (r.get("rec_director") or "")[:200], "reason": (r.get("reason") or "")[:400],
                "target_film_id": r.get("target_film_id"), "tmdb_id": r.get("tmdb_id"),
                "poster_path": r.get("poster_path")} for r in rows]
    ins = 0
    for i in range(0, len(payload), 500):
        chunk = payload[i:i + 500]
        st, tx = http("POST", f"{URL}/rest/v1/film_next", chunk)
        if st >= 300: print(f"  ! insert @{i} {st}: {tx[:200]}")
        else: ins += len(chunk)
        time.sleep(0.03)
    print(f"✅ inserted {ins} rows into film_next")

if __name__ == "__main__":
    main()
