#!/usr/bin/env python3
"""Frame import (IA §8-2) — load frame-candidates.json into the DB.

Inserts each discovered frame as status='candidate' (admin approves later),
embeds label+definition (openai text-embedding-3-small) for the pgvector
column, and writes question_frames rows (is_primary, classified_by='bootstrap').
Idempotent: skips frames whose slug already exists and existing
question_frames pairs. Logs one content_events row per imported frame.

Usage:  python3 frame-import.py [--dry]
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
OPENAI_KEY = os.environ.get("OPENAI_API_KEY")
if not (SUPABASE_URL and SERVICE_KEY and OPENAI_KEY):
    print("Missing env vars"); sys.exit(1)

DRY = "--dry" in sys.argv[1:]


def http(method, url, headers=None, body=None, timeout=90):
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


def embed(texts):
    status, text = http("POST", "https://api.openai.com/v1/embeddings",
                        {"Authorization": f"Bearer {OPENAI_KEY}"},
                        {"model": "text-embedding-3-small", "input": texts})
    if status != 200:
        raise RuntimeError(f"OpenAI embed {status}: {text[:200]}")
    data = sorted(json.loads(text)["data"], key=lambda d: d["index"])
    return [d["embedding"] for d in data]


def main():
    path = os.path.join(ROOT, "frame-candidates.json")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    frames = [f for f in data.get("frames", []) if f.get("frame", {}).get("slug")]
    print(f"[import] {len(frames)} frame candidates, "
          f"{sum(len(f['members']) for f in frames)} memberships, "
          f"{len(data.get('orphans', []))} orphans{' [DRY]' if DRY else ''}")

    # existing slugs (idempotency)
    st, tx = sb("GET", "frames?select=id,slug&limit=1000")
    if st != 200:
        print(f"Supabase {st}: {tx}"); sys.exit(1)
    existing = {r["slug"]: r["id"] for r in json.loads(tx)}

    # embeddings for new frames
    new_frames = [f for f in frames if f["frame"]["slug"] not in existing]
    vecs = embed([f'{f["frame"]["label"]} — {f["frame"].get("definition", "")}'
                  for f in new_frames]) if new_frames and not DRY else [None] * len(new_frames)

    imported = links = 0
    vec_i = 0
    for f in frames:
        fr = f["frame"]
        slug = fr["slug"]
        if slug in existing:
            frame_id = existing[slug]
            print(f"[import] = exists: {slug}")
        else:
            row = {
                "dimension": fr.get("dimension", "uncategorised"),
                "slug": slug,
                "label": fr.get("label", slug),
                "definition": fr.get("definition", ""),
                "slot_schema": fr.get("suggested_slots", []),
                "status": "candidate",
                "source": "ai",
                "embedding": vecs[vec_i] if not DRY else None,
            }
            vec_i += 1
            if DRY:
                print(f"[import] + would insert: {slug} ({len(f['members'])} members)")
                continue
            st, tx = sb("POST", "frames", row, prefer="return=representation")
            if st >= 300:
                print(f"[import] ❌ frame insert {slug}: {st} {tx}")
                continue
            frame_id = json.loads(tx)[0]["id"]
            imported += 1
            sb("POST", "content_events", {
                "entity_type": "frame", "entity_id": frame_id,
                "event": "frame_bootstrapped", "actor_kind": "ai",
                "meta": {"slug": slug, "members": len(f["members"]), "source": "frame-discovery"},
            }, prefer="return=minimal")

        if DRY:
            continue
        # memberships (upsert, ignore dup)
        rows = [{"question_id": qid, "frame_id": frame_id, "is_primary": True,
                 "confidence": 0.70, "classified_by": "bootstrap"}
                for qid in f["members"]]
        st, tx = sb("POST", "question_frames?on_conflict=question_id,frame_id",
                    rows, prefer="resolution=ignore-duplicates,return=minimal")
        if st >= 300:
            print(f"[import] ❌ memberships {slug}: {st} {tx}")
        else:
            links += len(rows)
            print(f"[import] ✓ {slug}: {len(rows)} members")

    print(f"[import] done: {imported} frames inserted, {links} memberships written")


if __name__ == "__main__":
    main()
