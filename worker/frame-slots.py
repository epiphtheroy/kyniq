#!/usr/bin/env python3
"""Frame slot filling — activates the hub pages' "for writers" craft block.

For every APPROVED frame, takes instances whose question_frames.slots is
empty, shows the LLM the frame's slot schema plus each question+answer, and
fills consistent slot values (lowercase, reusing the same value for the same
concept across instances). Updates question_frames.slots. Re-runnable: only
empty-slot instances are processed (use --force to re-fill everything).

Usage:  python3 frame-slots.py [--slug <frame-slug>] [--force]
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
ONLY_SLUG = args[args.index("--slug") + 1] if "--slug" in args else None
FORCE = "--force" in args


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
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 8192,
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


def parse_json_robust(text):
    try:
        return json.loads(text)
    except Exception:
        t = text.strip()
        if t.startswith("```"):
            t = t.split("\n", 1)[-1].rsplit("```", 1)[0]
        s, e = t.find("{"), t.rfind("}")
        if s >= 0 and e > s:
            try:
                return json.loads(t[s:e + 1])
            except Exception:
                return None
    return None


SYSTEM = """You are FilmCurio's slot annotator. You receive one FRAME (a recurring question of cinema) with its SLOT SCHEMA (the axes along which films differ in handling this question), plus the frame's instances (question + answer for a specific film). For EACH instance, fill a value for each slot.

Return ONLY JSON:
{"instances":[{"index":0,"slots":{"<slot_name>":"<value>"}}]}

Rules:
- Values: lowercase, 1-3 words, film-agnostic category labels (e.g. "guilt", "open ending", "dream logic") — NOT plot descriptions.
- CONSISTENCY IS THE POINT: if two instances express the same concept, give them the IDENTICAL value string. Prefer the schema's suggested values; coin a new value only when none fits, then reuse it.
- A slot may be omitted for an instance if truly not inferable.
- Values must not contain spoilers beyond category level (e.g. "character death" as an outcome category is fine; naming who dies is not)."""


def main():
    q = "frames?select=id,slug,label,definition,slot_schema&status=eq.approved&order=slug"
    if ONLY_SLUG:
        q += f"&slug=eq.{urllib.parse.quote(ONLY_SLUG)}"
    st, tx = sb("GET", q)
    if st != 200:
        print(f"Supabase {st}: {tx}"); sys.exit(1)
    frames = json.loads(tx)
    print(f"[slots] {len(frames)} approved frames{' [FORCE]' if FORCE else ''}")

    total = 0
    for frame in frames:
        schema = frame.get("slot_schema") or []
        if not schema:
            print(f"[slots] – {frame['slug']}: no slot schema, skipped")
            continue
        sel = urllib.parse.quote(
            "question_id,slots,question:questions!inner(title,status,"
            "canonical_answers(body,status))", safe="!,():*")
        st, tx = sb("GET", f"question_frames?select={sel}&frame_id=eq.{frame['id']}"
                           f"&is_primary=eq.true&question.status=eq.published&limit=500")
        if st != 200:
            print(f"[slots] ❌ {frame['slug']}: fetch {st}"); continue
        rows = json.loads(tx)
        todo = [r for r in rows if FORCE or not (r.get("slots") or {})]
        if not todo:
            print(f"[slots] = {frame['slug']}: nothing to fill")
            continue

        schema_txt = "\n".join(
            f'- {s.get("name", "?")}: suggested values: {", ".join(s.get("values", [])) or "(open)"}'
            for s in schema)
        inst_txt = []
        for i, r in enumerate(todo):
            qq = r["question"]
            ca = qq.get("canonical_answers") or []
            ca = ca[0] if isinstance(ca, list) and ca else (ca if isinstance(ca, dict) else {})
            body = ((ca or {}).get("body") or "")[:1200]
            inst_txt.append(f'{i}. Q: {qq["title"]}\n   A: {body}')

        prompt = (f'FRAME: {frame["label"]}\nDEFINITION: {frame.get("definition") or ""}\n'
                  f'SLOT SCHEMA:\n{schema_txt}\n\nINSTANCES:\n' + "\n".join(inst_txt) +
                  "\n\nFill the slots now. JSON only.")
        try:
            raw = call_gemini(prompt, SYSTEM)
        except Exception as e:
            print(f"[slots] ❌ {frame['slug']}: {e}"); continue
        out = parse_json_robust(raw)
        if not isinstance(out, dict):
            print(f"[slots] ❌ {frame['slug']}: JSON parse failed"); continue

        valid_names = {s.get("name") for s in schema}
        written = 0
        for item in out.get("instances", []):
            i = item.get("index")
            if not isinstance(i, int) or not (0 <= i < len(todo)):
                continue
            slots = {k: str(v).strip().lower()
                     for k, v in (item.get("slots") or {}).items()
                     if k in valid_names and v and len(str(v)) <= 60}
            if not slots:
                continue
            st, tx = sb("PATCH",
                        f'question_frames?question_id=eq.{todo[i]["question_id"]}'
                        f'&frame_id=eq.{frame["id"]}',
                        {"slots": slots}, prefer="return=minimal")
            if st < 300:
                written += 1
        total += written
        print(f"[slots] ✓ {frame['slug']}: {written}/{len(todo)} instances filled")
        time.sleep(0.4)

    print(f"[slots] done: {total} instances updated")


if __name__ == "__main__":
    main()
