#!/usr/bin/env python3
"""배치 완료까지 폴링 → results.jsonl 저장 (custom_id, out|error)"""
import json, pathlib, time
import anthropic
from gen_common import anthropic_key

OUT = pathlib.Path(__file__).resolve().parent
client = anthropic.Anthropic(api_key=anthropic_key())
bid = (OUT / "batch_id.txt").read_text().strip()

while True:
    b = client.messages.batches.retrieve(bid)
    c = b.request_counts
    print(f"{time.strftime('%H:%M:%S')} {b.processing_status} ok={c.succeeded} err={c.errored} processing={c.processing}", flush=True)
    if b.processing_status == "ended":
        break
    time.sleep(120)

ok = err = parse_err = 0
with open(OUT / "results.jsonl", "w") as f:
    for r in client.messages.batches.results(bid):
        if r.result.type == "succeeded":
            msg = r.result.message
            text = next((blk.text for blk in msg.content if blk.type == "text"), "")
            try:
                out = json.loads(text)
                ok += 1
                f.write(json.dumps({"id": r.custom_id, "out": out}, ensure_ascii=False) + "\n")
            except Exception:
                parse_err += 1
                f.write(json.dumps({"id": r.custom_id, "error": "parse", "raw": text[:200]}, ensure_ascii=False) + "\n")
        else:
            err += 1
            f.write(json.dumps({"id": r.custom_id, "error": r.result.type}, ensure_ascii=False) + "\n")

print(f"DONE ok={ok} err={err} parse_err={parse_err}")
