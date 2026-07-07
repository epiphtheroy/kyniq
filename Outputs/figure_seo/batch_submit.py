#!/usr/bin/env python3
"""전량 배치 제출: 18,168건 → Message Batches API (Opus 4.8). 비용 가드: 추정 $80 초과 시 중단."""
import json, pathlib, sys
import anthropic
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
from anthropic.types.messages.batch_create_params import Request
from gen_common import MODEL, SYSTEM, SCHEMA, user_msg, anthropic_key, load_input

OUT = pathlib.Path(__file__).resolve().parent
rows = load_input()

# 비용 가드 (파일럿 실측: 평균 in 770 / out 45)
est = (770 * len(rows) / 1e6) * 2.5 + (45 * len(rows) / 1e6) * 12.5
print(f"projected cost: ${est:.2f}")
if est > 80:
    sys.exit("ABORT: projected cost exceeds $80 guard")

client = anthropic.Anthropic(api_key=anthropic_key())
requests_list = [
    Request(
        custom_id=row["id"],
        params=MessageCreateParamsNonStreaming(
            model=MODEL, max_tokens=200,
            system=SYSTEM,
            output_config={"format": SCHEMA},
            messages=[{"role": "user", "content": user_msg(row)}],
        ),
    )
    for row in rows
]
batch = client.messages.batches.create(requests=requests_list)
(OUT / "batch_id.txt").write_text(batch.id)
print(f"submitted: {batch.id}  status={batch.processing_status}  n={len(requests_list)}")
