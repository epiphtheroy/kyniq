#!/usr/bin/env python3
"""Frame classification — Loop 5 (IA §8-3).

Finds published questions that have no primary frame yet, shows the LLM the
current frame ontology (candidate + approved), and classifies each question
into exactly one frame (with slot values) or the orphan pool. Re-runnable:
only unclassified questions are processed. Orphans are recorded as a
content_events row so the consolidation step can later cluster them into
new frame candidates.

Usage:  python3 frame-classify.py [--limit 200] [--dry]
"""

import json
import os
import sys
import time
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
LIMIT = int(args[args.index("--limit") + 1]) if "--limit" in args else 200
DRY = "--dry" in args
BATCH = 25
MIN_CONFIDENCE = 0.6


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
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 16384,
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


SYSTEM_TMPL = """You are FilmCurio's frame classifier. Below is the site's frame ontology (question archetypes). Classify each input question into EXACTLY ONE frame — its primary frame — or "orphan" if none fits at the level a reader would recognise as "the same big question asked of a different film".

FRAMES:
%s

Return ONLY JSON:
{"classifications":[{"index":0,"frame_slug":"<slug or null>","confidence":0.0,"slots":{"<slot_name>":"<value>"},"reason":"<one short sentence>"}]}

Rules: confidence is your honest probability the assignment is right; use null frame_slug for orphans; fill slot values only when clearly inferable from the question text; never invent a slug not in the list."""


def main():
    # 1. ontology
    st, tx = sb("GET", "frames?select=id,slug,label,definition,slot_schema,status"
                       "&status=in.(candidate,approved)&limit=1000")
    if st != 200:
        print(f"Supabase {st}: {tx}"); sys.exit(1)
    frames = json.loads(tx)
    if not frames:
        print("[classify] no frames in DB — run frame-import first"); sys.exit(1)
    by_slug = {f["slug"]: f for f in frames}
    frame_lines = []
    for f in frames:
        slots = ", ".join(s.get("name", "?") for s in (f.get("slot_schema") or []))
        frame_lines.append(f'- {f["slug"]}: {f["label"]} — {(f.get("definition") or "")[:160]}'
                           + (f' [slots: {slots}]' if slots else ""))
    system = SYSTEM_TMPL % "\n".join(frame_lines)

    # 2. unclassified published questions
    st, tx = sb("GET", "question_frames?select=question_id&limit=100000")
    classified_ids = {r["question_id"] for r in json.loads(tx)} if st == 200 else set()
    sel = urllib.parse.quote("id,title,film:films!inner(title,year)", safe="!,():*")
    st, tx = sb("GET", f"questions?select={sel}&status=eq.published&limit=1000")
    if st != 200:
        print(f"Supabase {st}: {tx}"); sys.exit(1)
    todo = [q for q in json.loads(tx) if q["id"] not in classified_ids][:LIMIT]
    print(f"[classify] {len(todo)} unclassified published questions"
          f"{' [DRY]' if DRY else ''}")
    if not todo:
        return

    assigned = orphaned = errors = 0
    for off in range(0, len(todo), BATCH):
        chunk = todo[off:off + BATCH]
        listing = "\n".join(
            f'{i}. [{q["film"]["title"]} ({q["film"].get("year") or "?"})] {q["title"]}'
            for i, q in enumerate(chunk))
        try:
            raw = call_gemini(listing + "\n\nClassify now. JSON only.", system)
            out = json.loads(raw)
        except Exception as e:
            print(f"[classify] ❌ batch {off}: {e}")
            errors += len(chunk)
            continue
        for c in out.get("classifications", []):
            i = c.get("index")
            if not isinstance(i, int) or not (0 <= i < len(chunk)):
                continue
            q = chunk[i]
            slug = c.get("frame_slug")
            conf = float(c.get("confidence") or 0)
            if slug and slug in by_slug and conf >= MIN_CONFIDENCE:
                if not DRY:
                    sb("POST", "question_frames?on_conflict=question_id,frame_id", [{
                        "question_id": q["id"], "frame_id": by_slug[slug]["id"],
                        "is_primary": True, "confidence": round(conf, 2),
                        "slots": c.get("slots") or {},
                        "evidence": c.get("reason") or "",
                        "classified_by": "loop5-gemini",
                    }], prefer="resolution=ignore-duplicates,return=minimal")
                assigned += 1
            else:
                if not DRY:
                    sb("POST", "content_events", {
                        "entity_type": "question", "entity_id": q["id"],
                        "event": "frame_orphaned", "actor_kind": "ai",
                        "meta": {"reason": c.get("reason") or "no frame fits",
                                 "best_slug": slug, "confidence": conf},
                    }, prefer="return=minimal")
                orphaned += 1
        time.sleep(0.4)

    print(f"[classify] done: {assigned} assigned, {orphaned} orphaned, {errors} errors")


if __name__ == "__main__":
    main()
