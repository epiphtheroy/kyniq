#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
reception-load.py  —  reception-all.jsonl → Supabase film_reception 적재(멱등).
영화별로 기존 행을 지우고 새로 넣는다(재실행 안전). service_role 키 사용.

사용
  python3 reception-load.py --dry     # 미리보기(쓰기 없음)
  python3 reception-load.py           # 실제 적재
"""
from __future__ import annotations
import html as _html
import json, os, re, sys, time
from urllib import parse
from urllib.request import Request, urlopen
from urllib.error import HTTPError


def clean(s: str) -> str:
    """학술 제목·초록의 HTML 태그/엔티티 제거: <i>, <JATS1:p>, &lt;i&gt; 등."""
    s = s or ""
    s = re.sub(r"<[^>]+>", "", s)
    s = _html.unescape(s)
    s = re.sub(r"<[^>]+>", "", s)      # &lt;i&gt; → <i> → 제거
    return re.sub(r"\s+", " ", s).strip()

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(HERE)
SRC = os.path.join(HERE, "reception-all.jsonl")


def load_env():
    for fn in (".env.local", ".env"):
        p = os.path.join(PROJECT, fn)
        if not os.path.exists(p):
            continue
        for line in open(p, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def to_int(v):
    try:
        return int(str(v)[:4])
    except Exception:
        return None


def main():
    load_env()
    dry = "--dry" in sys.argv
    base = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not base or not key:
        print("‼ .env.local 에 NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 필요", file=sys.stderr)
        sys.exit(1)
    if not os.path.exists(SRC):
        print(f"‼ {SRC} 없음 — 먼저 reception-run.py 를 돌리세요", file=sys.stderr)
        sys.exit(1)
    H = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    rows, film_ids = [], []
    for line in open(SRC, encoding="utf-8"):
        line = line.strip()
        if not line:
            continue
        rec = json.loads(line)
        fid = rec["film_id"]
        film_ids.append(fid)
        for r in rec["rows"]:
            head = clean(r.get("title") or r.get("comment") or "")
            cmt = clean(r.get("comment") or "")
            rows.append({
                "film_id": fid, "kind": r["type"], "outlet": clean(r["outlet"]),
                "critic": clean(r.get("critic", "")), "year": to_int(r.get("year")),
                "language": r.get("language", ""), "tier": r["tier"],
                "headline": head[:600], "comment": (cmt or head)[:600],
                "verdict": clean(r.get("verdict_le10", "")),
                "verbatim": str(r.get("verbatim_verified", "")).lower() == "true",
                "url": r["url"], "position": r.get("id", 0),
            })
    rev = sum(1 for r in rows if r["kind"] == "criticism")
    pap = sum(1 for r in rows if r["kind"] == "academic")
    print(f"films {len(film_ids)} · rows {len(rows)} (reviews {rev} / papers {pap})")
    if dry:
        for r in rows[:8]:
            print(f"  [{r['tier']:7}] {r['kind'][:4]} {r['outlet']}: {r['comment'][:60]}")
        print("DRY — 쓰기 없음.")
        return

    # 1) 영화별 기존 행 삭제(청크)
    uniq = sorted(set(film_ids))
    for i in range(0, len(uniq), 80):
        chunk = uniq[i:i + 80]
        flt = "in.(" + ",".join(chunk) + ")"
        u = f"{base}/rest/v1/film_reception?film_id={parse.quote(flt, safe='().,')}"
        req = Request(u, method="DELETE", headers={**H, "Prefer": "return=minimal"})
        try:
            urlopen(req, timeout=60)
        except HTTPError as e:
            print(f"  delete chunk fail: {e} {e.read()[:200]}", file=sys.stderr)
        time.sleep(0.05)
    print(f"cleared existing rows for {len(uniq)} films")

    # 2) bulk insert(청크 500)
    ins = 0
    for i in range(0, len(rows), 500):
        chunk = rows[i:i + 500]
        req = Request(f"{base}/rest/v1/film_reception",
                      data=json.dumps(chunk).encode("utf-8"),
                      method="POST", headers={**H, "Prefer": "return=minimal"})
        try:
            urlopen(req, timeout=120)
            ins += len(chunk)
        except HTTPError as e:
            print(f"  insert chunk fail @ {i}: {e} {e.read()[:300]}", file=sys.stderr)
        if (i // 500) % 4 == 0:
            print(f"  inserted {ins}/{len(rows)}")
        time.sleep(0.05)
    print(f"✅ inserted {ins} rows into film_reception")


if __name__ == "__main__":
    main()
