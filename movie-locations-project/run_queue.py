#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
큐 실행기 — 영화 제목 리스트(파일)를 받아 에이전트를 순차 처리.
체크포인트(중단 후 재개), 증분 저장, 영화별 비용 추정 로그 포함.

준비:
  pip install requests openpyxl openai
  export LLM_API_KEY=...  SEARCH_API_KEY=...  SEARCH_PROVIDER=tavily
  (선택) export LLM_MODEL=gpt-4o-mini   GEOCODE=1

입력 파일(titles.txt): 한 줄에 영화 1편. '#'으로 시작하면 주석. 예)
  Parasite (2019)
  Heat 1995
  # 아래는 다음 배치
  Skyfall

실행:
  python run_queue.py --titles-file titles.txt --out-dir run1 --model gpt-4o-mini
  # 중단되면 같은 명령 재실행 → 이미 끝난 항목은 건너뜀(재개)
"""
import argparse, json, os, sys, time
import movie_locations_llmsearch as agent

# 모델별 단가 ($/1M tokens) — 2026-06 기준, 실제 청구 전 공식 페이지로 재확인 권장
PRICES = {
    "gpt-4o-mini":          (0.15, 0.60),
    "gpt-5-mini":           (0.25, 2.00),
    "gemini-2.5-flash-lite":(0.10, 0.40),
    "gemini-2.5-flash":     (0.30, 2.50),
    "claude-haiku-4-5":     (1.00, 5.00),
}
SEARCH_COST = 0.008          # Tavily basic 1 credit
EST_IN, EST_OUT = 8000, 2000 # 영화당 LLM 토큰 추정(GENERATE+batched VERIFY)
EST_SEARCHES = 5             # gather 3 + recovery 약 2


def est_cost(model):
    pin, pout = PRICES.get(model, PRICES["gpt-4o-mini"])
    llm = EST_IN/1e6*pin + EST_OUT/1e6*pout
    return llm + EST_SEARCHES*SEARCH_COST, llm, EST_SEARCHES*SEARCH_COST


def read_titles(path):
    out = []
    for line in open(path, encoding="utf-8"):
        t = line.strip()
        if t and not t.startswith("#"):
            out.append(t)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--titles-file", required=True)
    ap.add_argument("--out-dir", default="run")
    ap.add_argument("--min-sources", type=int, default=2)
    ap.add_argument("--model", default=os.getenv("LLM_MODEL", "gpt-4o-mini"))
    args = ap.parse_args()
    os.environ["LLM_MODEL"] = args.model
    os.makedirs(args.out_dir, exist_ok=True)

    done_path = os.path.join(args.out_dir, "done.txt")
    results_path = os.path.join(args.out_dir, "results.jsonl")
    done = set(l.strip() for l in open(done_path, encoding="utf-8")) if os.path.exists(done_path) else set()

    titles = read_titles(args.titles_file)
    todo = [t for t in titles if t not in done]
    per, llm_c, srch_c = est_cost(args.model)
    print(f"[queue] 총 {len(titles)} | 완료 {len(done)} | 남음 {len(todo)}")
    print(f"[cost ] 모델 {args.model}: 영화당 ≈ ${per:.4f} (LLM ${llm_c:.4f} + 검색 ${srch_c:.4f})")
    print(f"[cost ] 남은 {len(todo)}편 예상 ≈ ${per*len(todo):.2f}\n")

    spent = len(done) * per
    with open(results_path, "a", encoding="utf-8") as rf, open(done_path, "a", encoding="utf-8") as df:
        for i, title in enumerate(todo, 1):
            t0 = time.time()
            try:
                data = agent.process_film(title, args.min_sources)
            except Exception as e:
                print(f"  [error] {title}: {e}", file=sys.stderr)
                continue
            rf.write(json.dumps(data, ensure_ascii=False) + "\n"); rf.flush()
            df.write(title + "\n"); df.flush()
            spent += per
            ship = len(data.get("shipped", []))
            print(f"[{i}/{len(todo)}] {title} | 촬영지 {len(data['locations'])} / 배포 {ship} "
                  f"| {time.time()-t0:.1f}s | 누적 ≈ ${spent:.2f}")

    # 통합 결과물 생성
    movies = [json.loads(l) for l in open(results_path, encoding="utf-8")]
    agent.write_outputs(movies, os.path.join(args.out_dir, "dataset"))
    print(f"\n[done] {len(movies)}편 | 누적비용 ≈ ${spent:.2f} | 출력: {args.out_dir}/dataset.json|.xlsx")


if __name__ == "__main__":
    main()
