#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""essay-embed.py — embed verified EN desk essays (title+dek+body) for semantic search.

Model: OpenAI text-embedding-3-small (~$0.03 for 1,654 essays). Fills
essays.embedding (migration 0056); search_semantic's essay leg picks them up
immediately. Resumable: only rows where embedding is null. Batches 48 inputs/call.

Usage: python3 worker/essay-embed.py [--dry] [--limit N]
"""
from __future__ import annotations
import json, os, sys, time
from urllib.request import Request, urlopen

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
for line in open(os.path.join(ROOT, ".env.local"), encoding="utf-8"):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

BASE = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
OAI = os.environ["OPENAI_API_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
DRY = "--dry" in sys.argv
LIMIT = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None


def rest(path, method="GET", body=None, prefer=None):
    h = dict(H)
    if prefer: h["Prefer"] = prefer
    req = Request(f"{BASE}/rest/v1/{path}", method=method,
                  data=json.dumps(body).encode() if body is not None else None, headers=h)
    with urlopen(req, timeout=120) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw.strip() else None


def embed(texts, tries=4):
    body = {"model": "text-embedding-3-small", "input": texts}
    for a in range(tries):
        try:
            req = Request("https://api.openai.com/v1/embeddings", data=json.dumps(body).encode(),
                          headers={"Authorization": f"Bearer {OAI}", "Content-Type": "application/json"})
            with urlopen(req, timeout=120) as r:
                d = json.load(r)
            return [row["embedding"] for row in d["data"]]
        except Exception as e:
            if a < tries - 1:
                time.sleep(6 * (a + 1)); continue
            raise


def main():
    rows, off = [], 0
    while True:
        page = rest(f"essays?select=id,title,dek,body_md&status=eq.verified&lang=eq.en&embedding=is.null&order=id&limit=500&offset={off}")
        rows += page
        if len(page) < 500: break
        off += 500
    if LIMIT: rows = rows[:LIMIT]
    print(f"[essay-embed] {len(rows)} essays to embed{'  [DRY]' if DRY else ''}")
    done = 0
    for i in range(0, len(rows), 48):
        batch = rows[i:i + 48]
        texts = [(f"{r['title'] or ''}\n{r['dek'] or ''}\n{r['body_md'] or ''}")[:16000] for r in batch]
        if DRY:
            print(f"  [DRY] batch {i}: {len(texts)} texts, first 60 chars: {texts[0][:60]!r}")
            break
        vecs = embed(texts)
        for r, v in zip(batch, vecs):
            rest(f"essays?id=eq.{r['id']}", "PATCH", {"embedding": v}, prefer="return=minimal")
        done += len(batch)
        print(f"  [{done}/{len(rows)}]")
        time.sleep(0.4)
    print(f"✅ essay-embed done: {done}")


if __name__ == "__main__":
    main()
