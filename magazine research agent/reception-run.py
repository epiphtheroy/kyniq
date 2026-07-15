#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
reception-run.py  —  전체 영화 Reception 발굴+추출(프로덕션).
reception-discover.py 의 검증된 로직을 그대로 재사용하되:
  • 영화 목록을 Supabase(films)에서 가져온다(film_id 포함 → DB 적재용).
  • 동시성(ThreadPool) + Brave 전역 throttle(무료티어 ~1 req/s).
  • 재개(resume): 영화별 결과를 reception_out/<slug>.json 으로 저장, 이미 있으면 건너뜀.
  • 산출: reception-all.jsonl (DB 적재 입력) + reception-run-summary.md.

비용: OpenAlex/Wikipedia/og 무료. Brave 1쿼리/편 → 전체 ~1,935쿼리(무료티어 월 2,000 내). LLM 0.

사용
  python3 reception-run.py                 # 전체
  python3 reception-run.py --limit 50      # 앞 50편만(스모크)
  python3 reception-run.py --workers 6 --acad-cap 8 --crit-cap 10
"""
from __future__ import annotations
import csv, importlib.util, json, os, sys, threading, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib import parse
from urllib.request import Request, urlopen

HERE = os.path.dirname(os.path.abspath(__file__))

# 파일럿 모듈(하이픈 파일명) 로드 → 함수 재사용
_spec = importlib.util.spec_from_file_location("recv_discover", os.path.join(HERE, "reception-discover.py"))
rd = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rd)
ce = rd.ce

# ── Brave 전역 throttle (무료티어 1 req/s 보호) ────────────────────────────
_brave_lock = threading.Lock()
_brave_last = [0.0]


def brave_throttled(q, key):
    with _brave_lock:
        dt = time.time() - _brave_last[0]
        if dt < 1.1:
            time.sleep(1.1 - dt)
        _brave_last[0] = time.time()
        return rd.brave_search(q, key)


def crit_brave(title, director, year, allow, key, cap):
    q = f'"{title}" {director} review'
    out, seen = [], set()
    for r in brave_throttled(q, key):
        url = r.get("url") or ""
        if not url or rd.is_homepage(url):
            continue
        ah = rd.allow_match(rd.host_of(url), allow)
        if not ah:
            continue
        info = allow[ah]
        if info["name"] in seen:
            continue
        seen.add(info["name"])
        out.append({"type": "criticism", "outlet": info["name"], "critic": "", "year": str(year),
                    "language": info["language"], "title": rd.clean_headline(r.get("title", ""), info["name"]),
                    "url": url, "dek": r.get("description", ""),  # Brave 스니펫 = verdict 소스(페이지 미크롤)
                    "stance": info["stance"], "ingest": info["ingest"]})
        if len(out) >= cap:
            break
    return out


# ── Supabase: 영화 목록 ────────────────────────────────────────────────────
def get_films(limit=None):
    base = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
    if not base or not key:
        print("‼ .env.local 에 SUPABASE URL/KEY 가 필요합니다", file=sys.stderr)
        sys.exit(1)
    films, offset, page = [], 0, 1000
    while True:
        u = (f"{base}/rest/v1/films?select=id,slug,title,year,director"
             f"&order=id&limit={page}&offset={offset}")
        req = Request(u, headers={"apikey": key, "Authorization": f"Bearer {key}",
                                  "Accept": "application/json"})
        with urlopen(req, timeout=30) as r:
            batch = json.load(r)
        films.extend(batch)
        if len(batch) < page:
            break
        offset += page
        if limit and len(films) >= limit:
            break
    if limit:
        films = films[:limit]
    return [f for f in films if f.get("slug") and f.get("title")]


# ── 한 편 처리 (비평 Brave + 학술 OpenAlex) ────────────────────────────────
def enrich_rows(prefix_rows, title):
    rows = []
    for i, r in enumerate(prefix_rows, 1):
        try:
            row = rd.enrich(i, r, title)
        except Exception:
            continue
        if not rd.is_junk(row):
            rows.append(row)
    for i, row in enumerate(rows, 1):
        row["id"] = i
    return rows


def process(film, allow, key, acad_cap, crit_cap, outdir):
    slug = film["slug"]
    out_path = os.path.join(outdir, f"{slug}.json")
    if os.path.exists(out_path):
        try:
            return json.load(open(out_path, encoding="utf-8")), True   # resumed (Brave 재호출 안 함)
        except Exception:
            pass
    title, year, director = film["title"], film.get("year") or 0, film.get("director") or ""
    ac, ac_failed = rd.discover_academic(title, director, year, acad_cap)
    cr = crit_brave(title, director, year, allow, key, crit_cap) if key else []
    rows = enrich_rows(cr + ac, title)
    rec = {"film_id": film["id"], "slug": slug, "title": title, "year": year,
           "director": director, "ap": bool(ac_failed), "rows": rows}
    for attempt in range(2):                   # iCloud 동기화로 디렉터리가 잠깐 사라지는 ENOENT 보강
        try:
            os.makedirs(outdir, exist_ok=True)
            with open(out_path, "w", encoding="utf-8") as fh:
                json.dump(rec, fh, ensure_ascii=False)
            break
        except FileNotFoundError:
            if attempt:
                raise
            time.sleep(0.3)
    return rec, False


def fill_one(path, allow, acad_cap):
    """OpenAlex 회복 후, 학술 보류(ap) 영화의 논문만 채워 넣는다(비평 Brave는 건드리지 않음)."""
    rec = json.load(open(path, encoding="utf-8"))
    if not rec.get("ap"):
        return rec, False
    ac, ac_failed = rd.discover_academic(rec["title"], rec.get("director", ""), rec.get("year") or 0, acad_cap)
    if ac_failed:
        return rec, False                      # 아직도 실패 → 보류 유지
    crit = [r for r in rec["rows"] if r["type"] == "criticism"]
    acad = enrich_rows(ac, rec["title"])
    merged = crit + acad
    for i, row in enumerate(merged, 1):
        row["id"] = i
    rec["rows"] = merged
    rec["ap"] = False
    json.dump(rec, open(path, "w", encoding="utf-8"), ensure_ascii=False)
    return rec, True                           # changed


def aggregate(outdir):
    recs = []
    for fn in sorted(os.listdir(outdir)):
        if fn.endswith(".json"):
            try:
                recs.append(json.load(open(os.path.join(outdir, fn), encoding="utf-8")))
            except Exception:
                pass
    rows_total = reviews = papers = verdict = with_any = pending = 0
    with open(os.path.join(HERE, "reception-all.jsonl"), "w", encoding="utf-8") as f:
        for rec in recs:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            n = len(rec["rows"])
            rows_total += n
            reviews += sum(1 for r in rec["rows"] if r["type"] == "criticism")
            papers += sum(1 for r in rec["rows"] if r["type"] == "academic")
            verdict += sum(1 for r in rec["rows"] if r["tier"] == "verdict")
            with_any += 1 if n else 0
            pending += 1 if rec.get("ap") else 0
    nf = max(1, len(recs))
    md = [f"# Reception — {len(recs)}편",
          f"리뷰 **{reviews}** · 논문 **{papers}** · verdict **{verdict}** · 비어있지 않은 영화 **{with_any}** "
          f"({with_any/nf*100:.0f}%)",
          f"학술 보류(OpenAlex 재시도 필요) **{pending}**편 · 평균 {rows_total/nf:.1f}/편 · 비용 ≈$0 · LLM 0\n",
          "상위 커버리지 20편:", ""]
    for rec in sorted(recs, key=lambda r: -len(r["rows"]))[:20]:
        rv = sum(1 for r in rec["rows"] if r["type"] == "criticism")
        pp = sum(1 for r in rec["rows"] if r["type"] == "academic")
        md.append(f"- {rec['title']} ({rec['year']}): 리뷰 {rv} · 논문 {pp}")
    open(os.path.join(HERE, "reception-run-summary.md"), "w", encoding="utf-8").write("\n".join(md))
    print("\n" + "=" * 60)
    print(f"FILMS {len(recs)} · rows {rows_total} (reviews {reviews} / papers {papers})")
    print(f"non-empty {with_any} ({with_any/nf*100:.0f}%) · verdict {verdict} · academic-pending {pending}")
    if pending:
        print(f"→ OpenAlex 회복 후 run-reception-fill-academic.command 로 논문 {pending}편 채우기")
    print(f"→ reception-all.jsonl  (DB 적재 입력)  ·  reception-run-summary.md")


def main():
    rd.load_env()
    args = sys.argv[1:]
    fill = "--fill-academic" in args
    limit = workers = acad_cap = crit_cap = None
    for i, a in enumerate(args):
        if a == "--limit":
            limit = int(args[i + 1])
        elif a == "--workers":
            workers = int(args[i + 1])
        elif a == "--acad-cap":
            acad_cap = int(args[i + 1])
        elif a == "--crit-cap":
            crit_cap = int(args[i + 1])
    workers = workers or 6
    acad_cap = acad_cap or 8
    crit_cap = crit_cap or 10
    allow = rd.load_allowlist()
    outdir = os.path.join(HERE, "reception_out_smoke" if limit else "reception_data")
    os.makedirs(outdir, exist_ok=True)
    t0 = time.time()

    if fill:                                   # 학술만 채우기(비평 Brave 미사용)
        files = [os.path.join(outdir, f) for f in sorted(os.listdir(outdir)) if f.endswith(".json")]
        pend = [p for p in files if json.load(open(p, encoding="utf-8")).get("ap")]
        print(f"fill-academic: {len(pend)} pending / {len(files)} cached · workers {workers}")
        done = changed = 0
        with ThreadPoolExecutor(max_workers=workers) as ex:
            futs = {ex.submit(fill_one, p, allow, acad_cap): p for p in pend}
            for fut in as_completed(futs):
                try:
                    _, ch = fut.result()
                except Exception:
                    ch = False
                done += 1
                changed += 1 if ch else 0
                if done % 25 == 0 or done == len(pend):
                    print(f"  [{done}/{len(pend)}] {time.time()-t0:5.0f}s  filled {changed}")
        aggregate(outdir)
        return

    key = rd.brave_key()
    FILMS_ARG = (args[args.index("--films") + 1].split(",")) if "--films" in args else None  # §7.13: factory scoping — restrict discovery to explicit slugs (Tier-2 noindex cohort)
    films = get_films(limit)
    if FILMS_ARG:
        films = [f for f in films if f["slug"] in FILMS_ARG]
    print(f"films: {len(films)} · outlets: {len(allow)} · criticism: "
          f"{'Brave' if key else 'OFF(no key)'} · workers: {workers} · out: {os.path.basename(outdir)}")
    if not key:
        print("‼ BRAVE_API_KEY 없음 → 비평 없이 학술만 수집합니다.", file=sys.stderr)
    done = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(process, f, allow, key, acad_cap, crit_cap, outdir): f for f in films}
        for fut in as_completed(futs):
            f = futs[fut]
            try:
                rec, resumed = fut.result()
            except Exception as e:
                print(f"  FAIL {f['slug']}: {e}", file=sys.stderr)
                continue
            done += 1
            if done % 25 == 0 or done == len(films):
                rv = sum(1 for r in rec["rows"] if r["type"] == "criticism")
                pp = sum(1 for r in rec["rows"] if r["type"] == "academic")
                print(f"  [{done}/{len(films)}] {time.time()-t0:5.0f}s  {f['slug'][:36]}: {rv}r/{pp}p"
                      f"{' ·ap' if rec.get('ap') else ''}{' (resume)' if resumed else ''}")
    aggregate(outdir)


if __name__ == "__main__":
    main()
