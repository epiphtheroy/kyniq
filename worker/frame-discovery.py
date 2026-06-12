#!/usr/bin/env python3
"""Frame discovery (IA §8-1) — bottom-up frame candidate extraction.

Embeds every published question (title + aha), clusters them with pure-Python
agglomerative clustering (no numpy needed), then asks Gemini to name each
cluster as a frame candidate (label, definition, dimension, slots).

Writes a report only — NO database writes:
  frame-candidates.md   (human-readable report, repo root)
  frame-candidates.json (machine-readable, for the later import step)

Usage:
  python3 frame-discovery.py                  # threshold sweep + naming at 0.82
  python3 frame-discovery.py --threshold 0.86
"""

import json
import math
import os
import sys
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
OPENAI_KEY = os.environ.get("OPENAI_API_KEY")
if not (SUPABASE_URL and SERVICE_KEY and (GEMINI_KEY or OPENAI_KEY)):
    print("Missing env vars"); sys.exit(1)

args = sys.argv[1:]
# Threshold is derived from the data (percentiles of the pairwise-similarity
# distribution) unless --threshold is passed explicitly.
FIXED_THRESHOLD = float(args[args.index("--threshold") + 1]) if "--threshold" in args else None

DIMENSIONS = [
    "ending", "central-ambiguity", "character-motive-or-fate", "symbol-or-motif",
    "craft-choice", "theme", "contested-point", "rewatch-detail",
    "director-connection", "central-provocation",
]


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


# ── 1. Fetch published questions ─────────────────────────────────
def fetch_questions():
    sel = "id,title,slug,spoiler_level,film:films!inner(title,year),canonical_answers!inner(aha,status)"
    qs = (f"{SUPABASE_URL}/rest/v1/questions?select={urllib.parse.quote(sel, safe='!,():*')}"
          f"&status=eq.published&canonical_answers.status=eq.published&limit=1000")
    status, text = http("GET", qs, {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"})
    if status != 200:
        print(f"Supabase {status}: {text}"); sys.exit(1)
    rows = json.loads(text)
    out = []
    for r in rows:
        ca = r["canonical_answers"][0] if isinstance(r["canonical_answers"], list) else r["canonical_answers"]
        aha = (ca or {}).get("aha") or ""
        out.append({
            "id": r["id"], "title": r["title"], "slug": r["slug"],
            "film": f'{r["film"]["title"]} ({r["film"].get("year") or "?"})',
            # Embed the TITLE only: the frame is the question's shape; mixing in
            # the answer's aha pulls instances of the same frame apart.
            "text": r["title"],
            "aha": aha,
        })
    return out


# ── 2. Embeddings (Gemini batch, OpenAI fallback) ────────────────
def embed_gemini(texts):
    vecs = []
    for i in range(0, len(texts), 100):
        chunk = texts[i:i + 100]
        body = {"requests": [
            {"model": "models/text-embedding-004", "content": {"parts": [{"text": t}]}}
            for t in chunk]}
        status, text = http(
            "POST",
            f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key={GEMINI_KEY}",
            body=body)
        if status != 200:
            raise RuntimeError(f"Gemini embed {status}: {text[:200]}")
        vecs.extend([e["values"] for e in json.loads(text)["embeddings"]])
    return vecs


def embed_openai(texts):
    vecs = []
    for i in range(0, len(texts), 500):
        chunk = texts[i:i + 500]
        status, text = http("POST", "https://api.openai.com/v1/embeddings",
                            {"Authorization": f"Bearer {OPENAI_KEY}"},
                            {"model": "text-embedding-3-small", "input": chunk})
        if status != 200:
            raise RuntimeError(f"OpenAI embed {status}: {text[:200]}")
        data = sorted(json.loads(text)["data"], key=lambda d: d["index"])
        vecs.extend([d["embedding"] for d in data])
    return vecs


def embed(texts):
    if GEMINI_KEY:
        try:
            print(f"[discovery] embedding {len(texts)} texts (gemini text-embedding-004)…")
            return embed_gemini(texts)
        except Exception as e:
            print(f"[discovery] gemini embed failed ({e}); trying openai…")
    print(f"[discovery] embedding {len(texts)} texts (openai text-embedding-3-small)…")
    return embed_openai(texts)


# ── 3. Pure-python centroid agglomerative clustering ─────────────
def normalize(v):
    n = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / n for x in v]


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def components(vecs, threshold):
    """Graph connected components: edge iff cosine sim >= threshold.
    Used as a cross-check on the LLM grouping (chaining-resistant at high θ)."""
    n = len(vecs)
    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for i in range(n):
        for j in range(i + 1, n):
            if dot(vecs[i], vecs[j]) >= threshold:
                parent[find(i)] = find(j)
    groups = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(i)
    return sorted(groups.values(), key=len, reverse=True)


# ── 4. LLM naming ────────────────────────────────────────────────
NAMING_SYSTEM = """You are FilmCurio's ontology curator. You receive the COMPLETE list of the site's published film-interpretation questions, numbered. Group them bottom-up into FRAMES — the underlying big questions of cinema that individual questions are instances of.

Return ONLY JSON:
{"frames":[{"label":"<frame name, e.g. 'Was it all a dream?'>","slug":"<kebab-case>","definition":"<2 sentences: what this frame asks, why viewers keep asking it>","dimension":"<one of: %s>","suggested_slots":[{"name":"<slot>","values":["<3-6 example values>"]}],"member_indices":[<question numbers>]}],"orphans":[<numbers that fit no frame yet>]}

Rules:
- A frame needs >=2 member questions. Questions that stand alone go to "orphans".
- Frames must be film-agnostic (no film titles in label/definition) and should hold at the level a reader would recognise as "the same big question asked of a different film". Not too broad ("questions about endings" is a dimension, not a frame) and not too narrow (one film's plot point is not a frame).
- Each question belongs to exactly ONE frame (its primary frame).
- Slots = the choices that differentiate instances within the frame (motive type, outcome, who, device).
- Every index 0..N-1 must appear exactly once across member_indices and orphans.""" % ", ".join(DIMENSIONS)


def call_gemini_text(prompt, system):
    for model in ("gemini-3.5-flash", "gemini-2.5-flash"):
        body = {
            "contents": [
                {"role": "user", "parts": [{"text": system}]},
                {"role": "model", "parts": [{"text": "Understood."}]},
                {"role": "user", "parts": [{"text": prompt}]},
            ],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 49152,
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


# ── main ─────────────────────────────────────────────────────────
def percentile(sorted_vals, p):
    if not sorted_vals:
        return 0.0
    k = min(len(sorted_vals) - 1, max(0, int(round(p / 100 * (len(sorted_vals) - 1)))))
    return sorted_vals[k]


def main():
    questions = fetch_questions()
    print(f"[discovery] {len(questions)} published questions")
    vecs = [normalize(v) for v in embed([q["text"] for q in questions])]

    # Pairwise-similarity distribution → data-derived thresholds
    sims = []
    for i in range(len(vecs)):
        for j in range(i + 1, len(vecs)):
            sims.append(dot(vecs[i], vecs[j]))
    sims.sort()
    dist = {f"p{p}": round(percentile(sims, p), 4)
            for p in (10, 50, 90, 95, 97, 99)}
    dist["max"] = round(sims[-1], 4)
    print(f"[discovery] pairwise sim distribution: {dist}")

    # Embedding cross-check: graph components at high thresholds
    sweep_t = [FIXED_THRESHOLD] if FIXED_THRESHOLD is not None else [0.45, 0.50, 0.55]
    sweep_stats = []
    comp_at = {}
    for t in sweep_t:
        comps = components(vecs, t)
        sizes = [len(c) for c in comps]
        multi_sizes = [s for s in sizes if s >= 2]
        comp_at[t] = comps
        sweep_stats.append({
            "threshold": round(t, 4), "components": len(comps),
            "multi_member": len(multi_sizes), "singletons": sizes.count(1),
            "largest": sizes[0] if sizes else 0, "covered_questions": sum(multi_sizes),
        })
        print(f"[discovery] θ={t:.2f}: {len(multi_sizes)} multi-components, "
              f"largest={sizes[0] if sizes else 0}, covered={sum(multi_sizes)}")

    # Primary method at this corpus size: LLM groups ALL titles directly
    print(f"[discovery] grouping all {len(questions)} questions via LLM…")
    listing = "\n".join(f'{i}. [{q["film"]}] {q["title"]}' for i, q in enumerate(questions))
    raw = call_gemini_text(listing + "\n\nGroup them into frames now. JSON only.", NAMING_SYSTEM)
    with open(os.path.join(HERE, "frame-grouping-raw.txt"), "w", encoding="utf-8") as fh:
        fh.write(raw)

    def parse_json_robust(text):
        try:
            return json.loads(text)
        except Exception:
            pass
        # strip code fences, take outermost braces
        t = text.strip()
        if t.startswith("```"):
            t = t.split("\n", 1)[-1].rsplit("```", 1)[0]
        s, e = t.find("{"), t.rfind("}")
        if s >= 0 and e > s:
            try:
                return json.loads(t[s:e + 1])
            except Exception:
                pass
        # truncated output: progressively close at the last complete frame object
        for cut in range(len(t), max(len(t) - 20000, 0), -200):
            chunk = t[:cut]
            last = chunk.rfind("}")
            if last < 0:
                break
            candidate = chunk[:last + 1]
            for closer in ("]}", "],\"orphans\":[]}"):
                try:
                    return json.loads(candidate + closer)
                except Exception:
                    continue
        return None

    naming = parse_json_robust(raw)
    if naming is None:
        print("[discovery] WARN: grouping JSON parse failed even after repair "
              "(full raw in worker/frame-grouping-raw.txt)")
        naming = {"frames": [], "orphans": [], "_raw": raw[:3000]}
    elif not isinstance(naming, dict):
        naming = {"frames": [], "orphans": []}

    # Validate coverage: every index exactly once; strays → orphans
    n = len(questions)
    seen = {}
    frames = []
    for f in naming.get("frames", []):
        mem = [m for m in (f.get("member_indices") or [])
               if isinstance(m, int) and 0 <= m < n and m not in seen]
        for m in mem:
            seen[m] = True
        if len(mem) >= 2:
            f["member_indices"] = mem
            frames.append(f)
    orphans = [m for m in (naming.get("orphans") or [])
               if isinstance(m, int) and 0 <= m < n and m not in seen]
    for m in orphans:
        seen[m] = True
    missing = [i for i in range(n) if i not in seen]
    orphans += missing
    if missing:
        print(f"[discovery] WARN: {len(missing)} indices unassigned by LLM → orphans")
    frames.sort(key=lambda f: len(f["member_indices"]), reverse=True)
    multi = [f["member_indices"] for f in frames]
    singles = orphans
    by_idx = {ci: f for ci, f in enumerate(frames)}

    # ── report ──
    md = []
    md.append("# Frame discovery report (IA §8-1)\n")
    md.append(f"Questions analysed: **{len(questions)}** · method: **LLM bottom-up grouping** "
              f"(primary) + embedding graph components (cross-check)\n")
    md.append(f"Pairwise similarity distribution (openai text-embedding-3-small): `{dist}`\n")
    md.append("## Embedding cross-check (graph components)\n")
    md.append("| θ | components | multi-member | singletons | largest | covered |")
    md.append("|---|---|---|---|---|---|")
    for s in sweep_stats:
        md.append(f'| {s["threshold"]} | {s["components"]} | {s["multi_member"]} '
                  f'| {s["singletons"]} | {s["largest"]} | {s["covered_questions"]}/{len(questions)} |')
    md.append("\n## Frame candidates (LLM grouping)\n")
    for ci, members in enumerate(multi):
        f = by_idx.get(ci, {})
        label = f.get("label", f"(unnamed cluster {ci})")
        md.append(f"### {ci + 1}. {label}  —  {len(members)} instances")
        if f:
            md.append(f'- **dimension:** {f.get("dimension", "?")} · **slug:** `{f.get("slug", "")}`')
            md.append(f'- **definition:** {f.get("definition", "")}')
            slots = f.get("suggested_slots") or []
            if slots:
                md.append("- **slots:** " + "; ".join(
                    f'{s.get("name", "?")} ({", ".join(s.get("values", [])[:6])})' for s in slots))
        md.append("- **members:**")
        for m in members:
            md.append(f'  - [{questions[m]["film"]}] {questions[m]["title"]}')
        md.append("")
    md.append(f"## Singletons ({len(singles)}) — no frame yet (orphan pool)\n")
    for m in singles:
        md.append(f'- [{questions[m]["film"]}] {questions[m]["title"]}')
    if "_raw" in naming:
        md.append("\n## RAW naming output (parse failed)\n```\n" + naming["_raw"] + "\n```")

    with open(os.path.join(ROOT, "frame-candidates.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(md))
    with open(os.path.join(ROOT, "frame-candidates.json"), "w", encoding="utf-8") as fh:
        json.dump({
            "method": "llm-bottom-up", "sim_distribution": dist, "embedding_sweep": sweep_stats,
            "frames": [{"frame": {k: v for k, v in by_idx.get(ci, {}).items() if k != "member_indices"},
                        "members": [questions[m]["id"] for m in c],
                        "titles": [questions[m]["title"] for m in c]}
                       for ci, c in enumerate(multi)],
            "orphans": [questions[m]["id"] for m in singles],
        }, fh, ensure_ascii=False, indent=2)

    print(f"[discovery] done → frame-candidates.md / frame-candidates.json")


import urllib.parse  # noqa: E402  (used in fetch_questions)

if __name__ == "__main__":
    main()
