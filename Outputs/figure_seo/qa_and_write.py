#!/usr/bin/env python3
"""검수 → (선택) 불합격분 동기 재생성 → DB PATCH 반영.
사용: python3 qa_and_write.py qa      # 검수 리포트만
      python3 qa_and_write.py retry   # 불합격분 재생성(동기, 피드백 포함)
      python3 qa_and_write.py write   # 합격분 DB 반영 (per-row PATCH, 신규 컬럼만)
      python3 qa_and_write.py verify  # DB 카운트 검증
"""
import json, pathlib, sys, collections
from concurrent.futures import ThreadPoolExecutor
import requests
from gen_common import MODEL, SYSTEM, SCHEMA, user_msg, qa_row, anthropic_key, load_input, ROOT

OUT = pathlib.Path(__file__).resolve().parent

def env(name):
    for line in (ROOT / ".env.local").read_text().splitlines():
        if line.startswith(name + "="):
            return line.split("=", 1)[1].strip()
    sys.exit(f"missing {name}")

def load_results():
    res = {}
    p = OUT / "results.jsonl"
    with open(p) as f:
        for line in f:
            r = json.loads(line)
            res[r["id"]] = r
    retry_p = OUT / "retry_results.jsonl"
    if retry_p.exists():
        with open(retry_p) as f:
            for line in f:
                r = json.loads(line)
                res[r["id"]] = r  # retry가 원본을 덮음
    return res

def run_qa():
    rows = {r["id"]: r for r in load_input()}
    res = load_results()
    passed, failed, missing = {}, {}, []
    # 영화 내 질문 중복 검사용
    byfilm = collections.defaultdict(list)
    for fid, row in rows.items():
        r = res.get(fid)
        if not r or "out" not in r:
            missing.append(fid)
            continue
        probs = qa_row(row, r["out"])
        if not probs:
            byfilm[row["film_title"]].append((fid, r["out"]["q_title"].lower().strip()))
        (passed if not probs else failed)[fid] = {"row": row, "out": r["out"], "probs": probs}
    # 중복: 같은 영화에서 같은 질문 → 뒤엣것 탈락
    dup = 0
    for film, qs in byfilm.items():
        seen = {}
        for fid, q in qs:
            if q in seen:
                failed[fid] = {"row": rows[fid], "out": passed[fid]["out"], "probs": ["dup-in-film"]}
                del passed[fid]
                dup += 1
            else:
                seen[q] = fid
    prob_counts = collections.Counter(p for v in failed.values() for p in v["probs"])
    print(f"pass={len(passed)} fail={len(failed)} missing/api-err={len(missing)} (dup={dup})")
    print("fail reasons:", dict(prob_counts))
    return passed, failed, missing

if sys.argv[1] == "qa":
    run_qa()

elif sys.argv[1] == "retry":
    import anthropic
    client = anthropic.Anthropic(api_key=anthropic_key())
    _, failed, missing = run_qa()
    rows = {r["id"]: r for r in load_input()}
    targets = [(fid, v["row"], v["probs"]) for fid, v in failed.items()] + [(fid, rows[fid], ["api-error"]) for fid in missing if fid in rows]
    print(f"retrying {len(targets)}")
    def regen(t):
        fid, row, probs = t
        fb = f"\n\nYour previous attempt failed checks: {', '.join(probs)}. Fix these issues (keep the question spoiler-safe, include the film title, end with '?', respect length limits, and make it distinct from other figures in the same film)."
        try:
            resp = client.messages.create(
                model=MODEL, max_tokens=200, system=SYSTEM,
                output_config={"format": SCHEMA},
                messages=[{"role": "user", "content": user_msg(row) + fb}],
            )
            out = json.loads(next(b.text for b in resp.content if b.type == "text"))
            return {"id": fid, "out": out}
        except Exception as e:
            return {"id": fid, "error": str(e)[:200]}
    results = list(ThreadPoolExecutor(6).map(regen, targets))
    mode = "a" if (OUT / "retry_results.jsonl").exists() else "w"
    with open(OUT / "retry_results.jsonl", mode) as f:
        for r in results:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print("retry done:", sum(1 for r in results if "out" in r), "ok /", len(results))

elif sys.argv[1] == "write":
    URL, KEY = env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY")
    H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json", "Prefer": "return=minimal"}
    passed, _, _ = run_qa()
    items = [(fid, v["out"]) for fid, v in passed.items()]
    print(f"writing {len(items)} rows (PATCH, new columns only)")
    fails = []
    def patch(item):
        fid, out = item
        for attempt in range(3):
            r = requests.patch(
                f"{URL}/rest/v1/figures?id=eq.{fid}",
                headers=H,
                json={"seo_question": out["q_title"].strip(), "seo_short_label": out["short_label"].strip()},
                timeout=30,
            )
            if r.status_code < 300:
                return None
        return (fid, r.status_code, r.text[:120])
    with ThreadPoolExecutor(16) as ex:
        for i, res in enumerate(ex.map(patch, items)):
            if res: fails.append(res)
            if (i + 1) % 2000 == 0: print(f"  {i+1}/{len(items)}")
    print(f"write done. failures={len(fails)}")
    for f_ in fails[:10]: print(" ", f_)

elif sys.argv[1] == "verify":
    URL, KEY = env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY")
    H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Prefer": "count=exact", "Range": "0-0"}
    for q, lbl in [("figures?select=id&status=eq.approved", "approved total"),
                   ("figures?select=id&status=eq.approved&seo_question=not.is.null", "with seo_question"),
                   ("figures?select=id&status=eq.approved&seo_short_label=not.is.null", "with seo_short_label")]:
        r = requests.get(f"{URL}/rest/v1/{q}", headers=H, timeout=30)
        print(lbl, r.headers.get("content-range"))
