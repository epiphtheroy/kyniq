#!/usr/bin/env python3
"""Frame approve + editorial ranking (IA §4.3, §8-4 vertical slice).

For one frame: optionally flips status to 'approved', then asks the LLM to
rank all published instances by how powerfully they exemplify the frame,
with a one-line rationale each. Materialises the result into frame_rankings
(replacing previous rows for the frame). Re-run whenever instances change.

Usage:
  python3 frame-rank.py --slug is-the-ending-real --approve
  python3 frame-rank.py --slug symbolic-motif          # rank only
  python3 frame-rank.py --all-gated                    # approve+rank every
                                                       # candidate frame with
                                                       # >=5 published instances
"""

import json
import os
import sys
import urllib.parse
import urllib.request
import urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def load_env(path):
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env(os.path.join(ROOT, ".env.local"))
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
if not (SUPABASE_URL and SERVICE_KEY and GEMINI_KEY):
    print("Missing env vars"); sys.exit(1)

args = sys.argv[1:]
ALL_GATED = "--all-gated" in args
HUB_GATE = 5
if not ALL_GATED and "--slug" not in args:
    print("Usage: frame-rank.py --slug <frame-slug> [--approve] | --all-gated"); sys.exit(1)
SLUG = args[args.index("--slug") + 1] if "--slug" in args else None
APPROVE = "--approve" in args or ALL_GATED


def http(method, url, headers=None, body=None, timeout=120):
    req = urllib.request.Request(url, method=method,
                                 data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:400]


def sb(method, path, body=None, prefer=None):
    headers = {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}
    if prefer:
        headers["Prefer"] = prefer
    return http(method, f"{SUPABASE_URL}/rest/v1/{path}", headers, body)


def call_gemini(prompt, system):
    for model in ("gemini-3.5-flash", "gemini-2.5-flash"):
        body = {
            "contents": [
                {"role": "user", "parts": [{"text": system}]},
                {"role": "model", "parts": [{"text": "Understood."}]},
                {"role": "user", "parts": [{"text": prompt}]},
            ],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 8192,
                                 "responseMimeType": "application/json"},
        }
        status, text = http(
            "POST",
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_KEY}",
            body=body)
        if status == 200:
            data = json.loads(text)
            return (data.get("candidates") or [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        if status in (400, 404):
            continue
        raise RuntimeError(f"Gemini {status}: {text[:200]}")
    raise RuntimeError("no gemini model worked")


SYSTEM = """You are FilmCurio Editorial's ranking critic. You receive one FRAME (a big question of cinema) and its instances (questions asked of specific films, with the answer's core insight). Rank ALL instances by how powerfully the film exemplifies the frame — the canonical, most illuminating cases first. Judge by: how central the frame is to that film, how strong/famous the case is in film history, and how illuminating the answer's insight is. NOT by recency or view counts.

Return ONLY JSON:
{"ranking":[{"index":0,"rank":1,"rationale":"<ONE sentence, spoiler-free, why this film is a defining case of the frame — no endings, twists, deaths, or identities revealed>"}]}
Every input index appears exactly once. Rationales must be spoiler-free (they appear on a public list page)."""


def process_frame(frame):
    print(f"[rank] frame: {frame['label']} ({frame['status']})")

    # instances
    sel = urllib.parse.quote(
        "question:questions!inner(id,title,slug,view_count,status,"
        "film:films!inner(title,year),canonical_answers(aha,status))",
        safe="!,():*")
    st, tx = sb("GET", f"question_frames?select={sel}&frame_id=eq.{frame['id']}"
                       f"&is_primary=eq.true&question.status=eq.published&limit=500")
    if st != 200:
        print(f"Supabase {st}: {tx}"); sys.exit(1)
    inst = []
    for r in json.loads(tx):
        q = r["question"]
        ca = q.get("canonical_answers") or []
        ca = ca[0] if isinstance(ca, list) and ca else (ca if isinstance(ca, dict) else {})
        inst.append({"id": q["id"], "title": q["title"],
                     "film": f'{q["film"]["title"]} ({q["film"].get("year") or "?"})',
                     "aha": (ca or {}).get("aha") or ""})
    print(f"[rank] {len(inst)} published instances")
    if not inst:
        return

    listing = "\n".join(f'{i}. [{x["film"]}] {x["title"]}' + (f'\n   insight: {x["aha"]}' if x["aha"] else "")
                        for i, x in enumerate(inst))
    prompt = (f'FRAME: {frame["label"]}\nDEFINITION: {frame.get("definition") or ""}\n\n'
              f'INSTANCES:\n{listing}\n\nRank them now. JSON only.')
    raw = call_gemini(prompt, SYSTEM)
    try:
        ranking = json.loads(raw)["ranking"]
    except Exception:
        print(f"[rank] ❌ ranking JSON parse failed: {raw[:300]}"); return

    # replace rankings
    sb("DELETE", f"frame_rankings?frame_id=eq.{frame['id']}", prefer="return=minimal")
    rows = []
    for r in ranking:
        i = r.get("index")
        if isinstance(i, int) and 0 <= i < len(inst):
            rows.append({"frame_id": frame["id"], "question_id": inst[i]["id"],
                         "rank": int(r.get("rank") or 999),
                         "rationale": r.get("rationale") or "", "model": "gemini-flash"})
    st, tx = sb("POST", "frame_rankings", rows, prefer="return=minimal")
    if st >= 300:
        print(f"[rank] ❌ insert {st}: {tx}"); return
    for r in sorted(rows, key=lambda x: x["rank"]):
        q = next(x for x in inst if x["id"] == r["question_id"])
        print(f'  #{r["rank"]} [{q["film"]}] — {r["rationale"][:90]}')

    if APPROVE and frame["status"] != "approved":
        sb("PATCH", f"frames?id=eq.{frame['id']}", {"status": "approved"}, prefer="return=minimal")
        print(f"[rank] ✅ frame approved: {frame['slug']}")

    sb("POST", "content_events", {
        "entity_type": "frame", "entity_id": frame["id"],
        "event": "frame_ranked", "actor_kind": "ai",
        "meta": {"slug": frame["slug"], "instances": len(rows), "approved": APPROVE},
    }, prefer="return=minimal")
    print(f"[rank] done: {len(rows)} rankings written\n")


def main():
    if ALL_GATED:
        # candidate frames passing the hub gate (>=5 published instances)
        st, tx = sb("GET", f"frame_instance_counts?select=frame_id,instance_count"
                           f"&instance_count=gte.{HUB_GATE}&limit=1000")
        if st != 200:
            print(f"Supabase {st}: {tx}"); sys.exit(1)
        gated_ids = [r["frame_id"] for r in json.loads(tx)]
        if not gated_ids:
            print("[rank] no frames pass the gate"); return
        ids = ",".join(gated_ids)
        st, tx = sb("GET", f"frames?select=id,slug,label,definition,status"
                           f"&id=in.({ids})&status=eq.candidate&order=slug")
        frames = json.loads(tx) if st == 200 else []
        print(f"[rank] {len(frames)} candidate frames pass the >= {HUB_GATE} gate\n")
        for fr in frames:
            process_frame(fr)
        return

    st, tx = sb("GET", f"frames?select=id,slug,label,definition,status&slug=eq.{urllib.parse.quote(SLUG)}")
    rows = json.loads(tx) if st == 200 else []
    if not rows:
        print(f"frame not found: {SLUG}"); sys.exit(1)
    process_frame(rows[0])


if __name__ == "__main__":
    main()
