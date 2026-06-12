#!/usr/bin/env python3
"""Film features generator — the 4 fixed hub sections per film.

Two model calls per film (see film-features-plan.md):
  Call A (creative, spoiler-ZERO): pitch — 3 acquisition assets + invitation.
  Call B (factual): record (structured facts) + reception (discourse arc)
                    + experience (10-level aesthetic classification).

Upserts film_features(film_id, kind) and syncs films.aesthetic_level.
Re-runnable: films that already have all 4 sections are skipped
(--force regenerates). Pilot default: films that have >=1 published question.

Usage:
  python3 film-features.py [--limit 15] [--film <slug>] [--force] [--dry]
"""

import json
import os
import re
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
LIMIT = int(args[args.index("--limit") + 1]) if "--limit" in args else 15
ONLY_FILM = args[args.index("--film") + 1] if "--film" in args else None
FORCE = "--force" in args
DRY = "--dry" in args

KINDS = ("pitch", "record", "reception", "experience")
MIN_CONFIDENCE = 0.75
SPOILER_RE = re.compile(
    r"\b(dies?|death|kills?|killed|murder(er|s)?|the killer|is actually|turns? out|twist "
    r"(is|was)|betray(s|ed|al)?|ending reveals?|was dead|isn'?t real|in the (final|last) "
    r"(scene|act|shot)|at the end,? (he|she|they|we learn))\b", re.I)

LEVELS = {
    1: "Passive Consumption", 2: "Formulaic Enjoyment", 3: "Impressive Craft",
    4: "Thematic Engagement", 5: "High Artistic Merit", 6: "Enduring Afterimage",
    7: "Aesthetic Resonance", 8: "Provoked Contemplation", 9: "Perceptual Shift",
    10: "Transcendent Encounter",
}


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


def call_gemini(prompt, system, temperature):
    for model in ("gemini-3.5-flash", "gemini-2.5-flash"):
        body = {
            "contents": [
                {"role": "user", "parts": [{"text": system}]},
                {"role": "model", "parts": [{"text": "Understood."}]},
                {"role": "user", "parts": [{"text": prompt}]},
            ],
            "generationConfig": {"temperature": temperature, "maxOutputTokens": 8192,
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


# ── Call A: the Pitch (spoiler-ZERO) ─────────────────────────────
PITCH_SYSTEM = """You are Cine Codex, FilmCurio's curator for viewers who have NOT yet seen the film. Write the film's acquisition pitch: persuade a hesitant cinephile to watch it.

ABSOLUTE SPOILER BAN — this is a contract, not a guideline: no plot points beyond the premise, no narrative arcs, no twists, no character fates, no scene outcomes. If a fact requires knowing what happens after act one, it does not belong here. Third person only.

THE CADENCE: in every asset body, the first sentence must be five words or less; the second sentence ten words or fewer. Then write freely.

Return ONLY JSON:
{
  "assets": [   // exactly 3, each <=110 words, the three strongest from:
                // director's gambit / aesthetic coordinates / power of place /
                // philosophical core / cinematic lineage / discourse & controversy / pantheon status
    {"title": "<provocative symbolic title, <=6 words>", "body": "<the asset>"}
  ],
  "invitation": "<one seamless paragraph, <=120 words: director (b. YYYY) and position in oeuvre; one symbolic location; the protagonist as archetype transcended (NO fate); the original title's nuance ending on a hwadu — one lingering question>",
  "hwadu": "<that one lingering question, restated alone>",
  "self_confidence": 0.0,   // probability every factual claim is true AND nothing spoils
  "claims_sourced": true
}"""

# ── Call B: record + reception + experience (factual) ────────────
FACTS_SYSTEM = """You are FilmCurio's archivist. For one film produce three structured sections. Accuracy over completeness: if you are not certain of a figure or fact, use null or omit it — never estimate or invent. No spoilers in any field (category-level descriptions only).

Return ONLY JSON:
{
  "record": {
    "premiere": "<festival/date or null>",
    "budget": "<e.g. '$25M (reported)' or null>",
    "box_office": "<worldwide gross or null>",
    "awards": ["<up to 5 major, most prestigious first>"],
    "production_notes": ["<2-4 verifiable, non-spoiler production facts worth knowing>"],
    "strategic_significance": "<1-2 sentences: what this film was as a bet in the director's career and the industry moment>"
  },
  "reception": {
    "at_release": "<2-3 sentences: the dominant critical reading and reaction when it opened — name real critics/outlets only if certain>",
    "turning_point": "<1-2 sentences: what shifted the discourse (re-release, retrospective, cultural change) or null if unchanged>",
    "today": "<2-3 sentences: its standing now and what today's viewers argue about>"
  },
  "experience": {
    "level": 0,             // 1-10 per the framework below
    "rationale": "<2 sentences: why this level, grounded in the film's effect on a viewer>",
    "comparables": ["<5 well-known films offering a similar aesthetic experience at the same level>"]
  },
  "self_confidence": 0.0,
  "claims_sourced": true
}

THE 10 LEVELS OF AESTHETIC EXPERIENCE:
1 Passive Consumption · 2 Formulaic Enjoyment · 3 Impressive Craft · 4 Thematic Engagement · 5 High Artistic Merit (festival standard) · 6 Enduring Afterimage · 7 Aesthetic Resonance · 8 Provoked Contemplation · 9 Perceptual Shift · 10 Transcendent Encounter"""


def upsert_feature(film_id, kind, body, payload, confidence, sourced):
    row = {
        "film_id": film_id, "kind": kind, "body": body, "payload": payload,
        "status": "published", "source": "ai", "generated_by": "gemini-flash",
        "self_confidence": round(confidence, 2), "claims_sourced": bool(sourced),
        "updated_at": "now()",
    }
    st, tx = sb("POST", "film_features?on_conflict=film_id,kind", [row],
                prefer="resolution=merge-duplicates,return=minimal")
    return st < 300, tx


def main():
    q = ("films?select=id,title,year,director,overview,slug,"
         "questions!inner(id,status)&questions.status=eq.published&limit=200")
    if ONLY_FILM:
        q += f"&slug=eq.{urllib.parse.quote(ONLY_FILM)}"
    st, tx = sb("GET", q)
    if st != 200:
        print(f"Supabase {st}: {tx}"); sys.exit(1)
    films = json.loads(tx)

    st, tx = sb("GET", "film_features?select=film_id,kind&limit=10000")
    have = {}
    for r in (json.loads(tx) if st == 200 else []):
        have.setdefault(r["film_id"], set()).add(r["kind"])
    todo = [f for f in films if FORCE or have.get(f["id"], set()) != set(KINDS)][:LIMIT]
    print(f"[features] {len(films)} films with published Q&A, {len(todo)} to generate"
          f"{' [DRY]' if DRY else ''}")

    ok = err = 0
    for film in todo:
        label = f'{film["title"]} ({film.get("year") or "?"})'
        user = (f'Film: {film["title"]} ({film.get("year") or "?"})\n'
                f'Director: {film.get("director") or "?"}\n'
                f'Premise (safe to use): {(film.get("overview") or "")[:500]}\n\n'
                'Produce the JSON now.')
        try:
            # Call A — pitch
            a = parse_json_robust(call_gemini(user, PITCH_SYSTEM, 0.7))
            # Call B — facts
            b = parse_json_robust(call_gemini(user, FACTS_SYSTEM, 0.2))
        except Exception as e:
            print(f"[features] ❌ {label}: {e}"); err += 1; continue

        # validate A
        a_ok = (isinstance(a, dict) and isinstance(a.get("assets"), list)
                and len(a["assets"]) == 3 and a.get("invitation")
                and float(a.get("self_confidence") or 0) >= MIN_CONFIDENCE)
        if a_ok:
            full = " ".join(x.get("body", "") for x in a["assets"]) + " " + a["invitation"]
            if SPOILER_RE.search(full):
                a_ok = False
                print(f"[features] ⛔ {label}: pitch tripped the spoiler backstop — skipped pitch")
        # validate B
        b_ok = (isinstance(b, dict) and isinstance(b.get("experience"), dict)
                and isinstance(b["experience"].get("level"), int)
                and 1 <= b["experience"]["level"] <= 10
                and len(b["experience"].get("comparables") or []) >= 3
                and float(b.get("self_confidence") or 0) >= MIN_CONFIDENCE)

        if DRY:
            lv = b["experience"]["level"] if b_ok else "?"
            print(f"[features] (dry) {label}: pitch={'ok' if a_ok else 'FAIL'} "
                  f"facts={'ok' if b_ok else 'FAIL'} level={lv}")
            continue

        wrote = []
        if a_ok:
            good, tx = upsert_feature(
                film["id"], "pitch", a["invitation"],
                {"assets": a["assets"], "hwadu": a.get("hwadu") or ""},
                float(a["self_confidence"]), a.get("claims_sourced", True))
            wrote.append(("pitch", good, tx))
        if b_ok:
            exp = b["experience"]
            lv = exp["level"]
            exp_payload = {"level": lv, "label": LEVELS.get(lv, ""),
                           "rationale": exp.get("rationale") or "",
                           "comparables": (exp.get("comparables") or [])[:5]}
            conf = float(b["self_confidence"])
            sourced = b.get("claims_sourced", True)
            wrote.append(("record", *upsert_feature(
                film["id"], "record", None, b.get("record") or {}, conf, sourced)))
            rec = b.get("reception") or {}
            reception_body = " ".join(x for x in
                                      [rec.get("at_release"), rec.get("turning_point"),
                                       rec.get("today")] if x)
            wrote.append(("reception", *upsert_feature(
                film["id"], "reception", reception_body, rec, conf, sourced)))
            wrote.append(("experience", *upsert_feature(
                film["id"], "experience", exp_payload["rationale"], exp_payload,
                conf, sourced)))
            sb("PATCH", f'films?id=eq.{film["id"]}',
               {"aesthetic_level": lv, "aesthetic_label": LEVELS.get(lv, "")},
               prefer="return=minimal")

        bad = [w for w in wrote if not w[1]]
        if bad:
            print(f"[features] ❌ {label}: write failed {[(w[0], w[2][:80]) for w in bad]}")
            err += 1
        elif wrote:
            lv = b["experience"]["level"] if b_ok else "?"
            print(f"[features] ✓ {label}: {len(wrote)} sections (level {lv})")
            ok += 1
            sb("POST", "content_events", {
                "entity_type": "film", "entity_id": film["id"],
                "event": "film_features_generated", "actor_kind": "ai",
                "meta": {"sections": [w[0] for w in wrote],
                         "aesthetic_level": lv if b_ok else None},
            }, prefer="return=minimal")
        else:
            print(f"[features] ❌ {label}: both calls failed validation")
            err += 1
        time.sleep(0.5)

    print(f"[features] done: {ok} films completed, {err} errors")


if __name__ == "__main__":
    main()
