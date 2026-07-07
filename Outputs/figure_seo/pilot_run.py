#!/usr/bin/env python3
"""파일럿: 30건 동기 병렬 생성 + count_tokens 기반 전량 비용 추정"""
import json, pathlib
from concurrent.futures import ThreadPoolExecutor
import anthropic
from gen_common import MODEL, SYSTEM, SCHEMA, user_msg, qa_row, anthropic_key, load_input

OUT = pathlib.Path(__file__).resolve().parent
client = anthropic.Anthropic(api_key=anthropic_key())
rows = load_input()
pilot = [rows[i * 605] for i in range(30)]

def gen(row):
    resp = client.messages.create(
        model=MODEL, max_tokens=200,
        system=SYSTEM,
        output_config={"format": SCHEMA},
        messages=[{"role": "user", "content": user_msg(row)}],
    )
    out = json.loads(next(b.text for b in resp.content if b.type == "text"))
    return row, out, resp.usage

results = list(ThreadPoolExecutor(6).map(gen, pilot))

in_tok = sum(u.input_tokens for _, _, u in results) / len(results)
out_tok = sum(u.output_tokens for _, _, u in results) / len(results)
n = len(rows)
# batch = 50% off: opus 4.8 $5/$25 → $2.5/$12.5 per MTok
cost = (in_tok * n / 1e6) * 2.5 + (out_tok * n / 1e6) * 12.5
print(f"avg tokens in/out: {in_tok:.0f}/{out_tok:.0f}  → projected FULL BATCH cost: ${cost:.2f}\n")

fails = 0
with open(OUT / "pilot_results.jsonl", "w") as f:
    for row, out, _ in results:
        probs = qa_row(row, out)
        fails += bool(probs)
        f.write(json.dumps({"slug": row["slug"], "out": out, "probs": probs}, ensure_ascii=False) + "\n")
        flag = " ⚠ " + ",".join(probs) if probs else ""
        print(f"[{row['film_title']}] {row['label'][:58]}")
        print(f"   Q: {out['q_title']}")
        print(f"   L: {out['short_label']}{flag}\n")
print(f"QA fails: {fails}/30")
