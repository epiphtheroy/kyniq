#!/usr/bin/env python3
"""apply-sql — Supabase Management API로 SQL 파일 실행 (토큰은 .env.local에서 로드).

Usage: python3 apply-sql.py <file.sql | ->
"""
import os, sys, json, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
for line in open(os.path.join(ROOT, ".env.local"), encoding="utf-8"):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

TOKEN = os.environ["SUPABASE_ACCESS_TOKEN"]
PROJECT = "jvgarcqrtsmgfimdcwgo"
src = sys.argv[1]
sql = sys.stdin.read() if src == "-" else open(os.path.join(HERE, src) if not os.path.isabs(src) else src, encoding="utf-8").read()

req = urllib.request.Request(
    f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
    method="POST",
    data=json.dumps({"query": sql}).encode(),
)
req.add_header("Authorization", f"Bearer {TOKEN}")
req.add_header("Content-Type", "application/json")
req.add_header("User-Agent", "metatake-worker/1.0 (supabase management api client)")
req.add_header("Accept", "application/json")
try:
    with urllib.request.urlopen(req, timeout=180) as r:
        print("HTTP", r.status, r.read().decode()[:500])
except urllib.error.HTTPError as e:
    print("ERR", e.code, e.read().decode()[:600]); sys.exit(1)
