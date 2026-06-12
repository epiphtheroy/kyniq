#!/usr/bin/env python3
"""Spoiler-guard backfill — re-audit loop for legacy published rows.

Stdlib-only port of spoiler-backfill.mjs (for machines without Node).
Grades published questions with the generator's Spoiler-gate rules, then fills
questions.spoiler_level / title_spoiler / display_title / safe_hook and
canonical_answers.spoiler_level. Never touches status or content.

Usage:
  python3 spoiler-backfill.py            # newest 10 published (home-feed order)
  python3 spoiler-backfill.py --limit 25
  python3 spoiler-backfill.py --dry      # call the model, print, write nothing
  python3 spoiler-backfill.py --force    # re-grade rows that already have a level
"""

import json
import os
import re
import sys
import time
import urllib.request
import urllib.parse
import urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))

# ── env ───────────────────────────────────────────────────────────
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

load_env(os.path.join(HERE, "..", ".env.local"))
load_env(os.path.join(HERE, ".env"))

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
if not (SUPABASE_URL and SERVICE_KEY and GEMINI_KEY):
    print("Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / GEMINI_API_KEY")
    sys.exit(1)

args = sys.argv[1:]
LIMIT = int(args[args.index("--limit") + 1]) if "--limit" in args else 10
DRY = "--dry" in args
FORCE = "--force" in args
MODELS = ["gemini-3.5-flash", "gemini-2.5-flash"]

# ── deterministic backstops (mirror worker/src/generator.ts) ─────
SPOILER_LEVELS = ("none", "mild", "major")
SPOILER_TITLE_RE = re.compile(
    r"\b(dies?|death|kills?|killed|murder(er|s)?|the killer|is actually|turns? out|twist|"
    r"betray(s|ed|al)?|ending reveals?|was dead|isn'?t real|imagin(ed|ary))\b", re.I)
EMOJI_RE = re.compile(
    "[\U0001F000-\U0001FAFF☀-➿️⬀-⯿]")
MAX_HOOK_LENGTH = 200

SYSTEM = """You are FilmCurio Editorial's spoiler auditor. You grade ONE published film-interpretation Q&A for spoiler exposure. Readers who have NOT seen the film browse the site's lists; the answer page itself is allowed to spoil.

Return ONLY a JSON object:
{
  "spoiler_level": "none|mild|major",
  "title_spoiler": false,
  "question_display": "",
  "hook": "",
  "reason": ""
}
Rules:
- spoiler_level grades what the ANSWER reveals. none = premise-level (themes, craft, context). mild = mid-film developments, no ending/twist/death/fate. major = the ending, a twist, a character's death or fate, a killer's/impostor's identity.
- title_spoiler: would the question TITLE ALONE spoil an unwatched viewer? Judge the title in isolation. "What actually happens at the end?" = false (promises a spoiler, doesn't deliver one). "Why does X shoot Y at the end?" = true.
- question_display: ONLY when title_spoiler is true — the title with ONLY the spoiling words (names whose fate is revealed, verbs like kill/die/betray/shoot, twist nouns) replaced by 1-3 fitting trendy emojis. Keep every other word and the sentence shape intact; never mask the film title; the result must stay an enticing riddle. e.g. "Why did the detective shoot his partner?" -> "Why did the detective \U0001F52B his \U0001F91D?". Else "".
- hook: ONLY when spoiler_level is "major" — one spoiler-free teaser sentence (<=30 words) selling the answer without revealing it, for list previews. Else "".
- reason: one short sentence on why this grade.
Emojis are allowed ONLY inside question_display. No prose outside the JSON."""


def http(method, url, headers=None, body=None, timeout=60):
    req = urllib.request.Request(url, method=method,
                                 data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


def sb(method, path, body=None, prefer=None):
    headers = {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}
    if prefer:
        headers["Prefer"] = prefer
    return http(method, f"{SUPABASE_URL}/rest/v1/{path}", headers, body)


def call_gemini(model, user):
    body = {
        "contents": [
            {"role": "user", "parts": [{"text": SYSTEM}]},
            {"role": "model", "parts": [{"text": "Understood."}]},
            {"role": "user", "parts": [{"text": user}]},
        ],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 1024,
                             "responseMimeType": "application/json"},
    }
    status, text = http(
        "POST",
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_KEY}",
        body=body)
    if status != 200:
        raise RuntimeError(f"Gemini {status}: {text[:200]}", status)
    data = json.loads(text)
    return (data.get("candidates") or [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")


def grade(user):
    last = None
    for model in MODELS:
        try:
            return call_gemini(model, user), model
        except RuntimeError as e:
            last = e
            if len(e.args) > 1 and e.args[1] in (400, 404):
                continue
            raise
    raise last


def validate(parsed, title):
    flags = []
    if (not isinstance(parsed, dict)
            or parsed.get("spoiler_level") not in SPOILER_LEVELS
            or not isinstance(parsed.get("title_spoiler"), bool)):
        return None, ["invalid shape"]
    item = {
        "spoiler_level": parsed["spoiler_level"],
        "title_spoiler": parsed["title_spoiler"],
        "question_display": (parsed.get("question_display") or "").strip(),
        "hook": (parsed.get("hook") or "").strip(),
        "reason": parsed.get("reason") or "",
    }
    if item["title_spoiler"]:
        qd = item["question_display"]
        if not qd or not EMOJI_RE.search(qd) or qd == title.strip():
            flags.append("masked title invalid → dropped mask")
            item["title_spoiler"] = False
            item["question_display"] = ""
            if item["spoiler_level"] == "none":
                item["spoiler_level"] = "mild"
    else:
        item["question_display"] = ""
    if item["spoiler_level"] == "major":
        if not item["hook"] or len(item["hook"]) > MAX_HOOK_LENGTH:
            flags.append("hook missing/too long")
            item["hook"] = ""
    else:
        item["hook"] = ""
    if not item["title_spoiler"] and SPOILER_TITLE_RE.search(title):
        if item["spoiler_level"] == "none":
            item["spoiler_level"] = "mild"
        flags.append("regex backstop: title matches spoiler pattern (escalated)")
    return item, flags


# ── main ──────────────────────────────────────────────────────────
select = ("id,title,slug,spoiler_level,published_at,"
          "film:films!inner(title,year,director),"
          "canonical_answers!inner(body,status)")
qs = (f"questions?select={urllib.parse.quote(select, safe='!,():*')}"
      f"&status=eq.published&canonical_answers.status=eq.published"
      f"&order=published_at.desc&limit={LIMIT}")
status, text = sb("GET", qs)
if status != 200:
    print(f"Supabase {status}: {text}")
    sys.exit(1)
rows = json.loads(text)
targets = [r for r in rows if FORCE or r.get("spoiler_level") is None]
print(f"[spoiler-backfill] {len(rows)} fetched (home-feed order), "
      f"{len(targets)} to grade{' [DRY RUN]' if DRY else ''}\n")

ICON = {"none": "\U0001F7E2", "mild": "\U0001F7E1", "major": "\U0001F534"}
results = []
for q in targets:
    film = q["film"]
    ca = q["canonical_answers"][0] if isinstance(q["canonical_answers"], list) else q["canonical_answers"]
    user = (f'FILM: "{film["title"]}" ({film.get("year") or "?"}), dir. {film.get("director") or "?"}\n'
            f'QUESTION TITLE: {q["title"]}\n'
            f'ANSWER: {(ca.get("body") or "")[:2500]}\n\nGrade this item now. JSON only.')
    try:
        text, model = grade(user)
        try:
            parsed = json.loads(text)
        except Exception:
            parsed = None
        item, flags = validate(parsed, q["title"])
        if item is None:
            results.append((q, None, None, flags, "validation failed"))
            continue
        if not DRY:
            st, tx = sb("PATCH", f'questions?id=eq.{q["id"]}', {
                "spoiler_level": item["spoiler_level"],
                "title_spoiler": item["title_spoiler"],
                "display_title": item["question_display"] or None,
                "safe_hook": item["hook"] or None,
            }, prefer="return=minimal")
            if st >= 300:
                results.append((q, None, None, flags, f"update {st}: {tx}"))
                continue
            sb("PATCH", f'canonical_answers?question_id=eq.{q["id"]}',
               {"spoiler_level": item["spoiler_level"]}, prefer="return=minimal")
            sb("POST", "content_events", {
                "entity_type": "question", "entity_id": q["id"],
                "event": "spoiler_backfilled", "actor_kind": "ai",
                "meta": {"model": model, **item, "flags": flags},
            }, prefer="return=minimal")
        results.append((q, item, model, flags, None))
        time.sleep(0.4)
    except Exception as e:
        results.append((q, None, None, [], str(e)[:200]))

for q, item, model, flags, err in results:
    print(f'— {q["film"]["title"]} · "{q["title"]}"')
    if err:
        print(f"   ❌ {err}\n")
        continue
    print(f'   {ICON[item["spoiler_level"]]} spoiler_level={item["spoiler_level"]} · title_spoiler={item["title_spoiler"]}')
    if item["question_display"]:
        print(f'   masked: {item["question_display"]}')
    if item["hook"]:
        print(f'   hook:   {item["hook"]}')
    if item["reason"]:
        print(f'   why:    {item["reason"]}')
    if flags:
        print(f'   flags:  {"; ".join(flags)}')
    print()

ok = [r for r in results if r[4] is None]
lv = lambda s: sum(1 for r in ok if r[1]["spoiler_level"] == s)
print(f"[spoiler-backfill] done: {len(ok)} graded{' (dry)' if DRY else ' + written'}, {len(results) - len(ok)} errors")
print(f"  none: {lv('none')} · mild: {lv('mild')} · major: {lv('major')} · "
      f"masked titles: {sum(1 for r in ok if r[1]['question_display'])}")
