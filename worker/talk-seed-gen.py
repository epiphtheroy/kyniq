#!/usr/bin/env python3
"""talk-seed-gen — write Gazette opening comments (+ Prism angle lines for the
flagged third) for every audited film, through the SUBSCRIPTION CLI (claude -p,
Opus — Fable is banned for automation). ~15 films per call.

Input:  worker/talk-seed/src.jsonl   (from plan.py)
Output: worker/talk-seed/out/NNN.json (one per chunk) — {slug: {gazette, prism?}}
Ledger: worker/talk-seed/gen-ledger.jsonl (resume: done chunks are skipped)

    python3 worker/talk-seed-gen.py [--limit N] [--chunk 15]
"""
import json
import os
import subprocess
import sys
import time

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "talk-seed")
OUT = os.path.join(HERE, "out")
LEDGER = os.path.join(HERE, "gen-ledger.jsonl")
os.makedirs(OUT, exist_ok=True)

CHUNK = int(sys.argv[sys.argv.index("--chunk") + 1]) if "--chunk" in sys.argv else 15
LIMIT = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None

PROMPT = """You write opening comments for Metatake's Talk section. Two voices, both posting under clear APP badges — never pretending to be human users.

GAZETTE — a wire reporter filing from the world around the film. For each film you get one audited fact-anchor (the "rationale"). Write a 2–3 sentence opening comment in English:
- Declarative only. NO questions, no invitations, no greetings, no "we/you should".
- Concrete: years, places, practices. Stay strictly within the rationale plus facts that are common knowledge about the film's production/era. Never invent numbers, quotes, or names not commonly known.
- Tone: cool, factual, quietly striking. The last sentence lands like the end of a news item, not an essay.
- Vary sentence shapes across films — no repeated openers like "In 1948..." on every item.

PRISM — only for films marked "prism": true. One or two sentences that take the Gazette note and turn it one angle — an implication, a tension, a cost. Declarative, no questions, English. Prism speaks casually but precisely.

Return ONLY a JSON object: { "<slug>": { "gazette": "...", "prism": "..." (only if requested) }, ... } — every input slug must appear.

FILMS:
"""


def call(films):
    lines = []
    for f in films:
        lines.append(json.dumps(
            {"slug": f["slug"], "title": f["title"], "year": f["year"], "lane": f["lane"],
             "rationale": f["rationale"], "prism": f["prism"]}, ensure_ascii=False))
    p = subprocess.run(
        ["claude", "-p", PROMPT + "\n".join(lines), "--model", "claude-opus-5"],
        capture_output=True, text=True, timeout=600,
    )
    raw = p.stdout.strip()
    a, b = raw.find("{"), raw.rfind("}")
    if a < 0 or b < 0:
        raise RuntimeError(f"no JSON in output: {raw[:200]}")
    return json.loads(raw[a : b + 1])


def main():
    src = [json.loads(l) for l in open(os.path.join(HERE, "src.jsonl"), encoding="utf-8")]
    done = set()
    if os.path.exists(LEDGER):
        for l in open(LEDGER, encoding="utf-8"):
            r = json.loads(l)
            if r.get("ok"):
                done.add(r["chunk"])
    chunks = [src[i : i + CHUNK] for i in range(0, len(src), CHUNK)]
    ran = 0
    for n, films in enumerate(chunks):
        if n in done:
            continue
        if LIMIT is not None and ran >= LIMIT:
            break
        t0 = time.time()
        try:
            data = call(films)
            missing = [f["slug"] for f in films if f["slug"] not in data or not data[f["slug"]].get("gazette")]
            if missing:
                raise RuntimeError(f"missing slugs: {missing[:5]}")
            json.dump(data, open(os.path.join(OUT, f"{n:03d}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            with open(LEDGER, "a", encoding="utf-8") as fh:
                fh.write(json.dumps({"chunk": n, "ok": True, "films": len(films), "secs": round(time.time() - t0)}) + "\n")
            print(f"chunk {n}: ok ({len(films)} films, {round(time.time()-t0)}s)")
        except Exception as e:
            with open(LEDGER, "a", encoding="utf-8") as fh:
                fh.write(json.dumps({"chunk": n, "ok": False, "err": str(e)[:300]}) + "\n")
            print(f"chunk {n}: FAIL {e}")
        ran += 1
    print("done")


if __name__ == "__main__":
    main()
