# 촬영지 데이터셋 출판 — 오너 체크리스트 (item 2)

*생성 완료: `metatake-filming-locations.{csv,jsonl}` + `README.md`(데이터 카드) + `.zenodo.json`. 재생성은 `python3 worker/export-locations-dataset.py`. 아래 업로드는 계정이 필요해 오너 몫.*

**규모:** 17,341 위치 · 1,917 편 · 130개국 · 좌표 100%.

## ⚠️ 먼저 결정할 것 하나 — 라이선스 (되돌릴 수 없음)
- 지금 카드/메타데이터 기본값 = **CC BY-NC 4.0** (사이트 전체와 동일 — citeLine·푸터·API 모두 NC). 저작표시 필수 + 비상업.
- 오너 item 2 원문은 **"CC BY"**(상업 허용)를 언급 — 연구자 인용·기관 신뢰 자산 극대화 목적.
- **핵심 비대칭:** 나중에 **NC→BY 완화는 가능**, 그러나 **BY→NC 강화는 출판 후 불가**(이미 퍼진 CC BY는 영구). 그래서 안전 기본값을 NC로 뒀다. CC BY로 낼지 = 오너 확정 필요.
  - CC BY로 가면: `README.md` 프론트매터 `license: cc-by-4.0`, 본문 문구, `.zenodo.json` `"license": "cc-by-4.0"`로 3곳 바꾸면 됨.
  - 상업권을 넘길지(경쟁사·관광청이 무료 상업 이용 가능해짐) vs 인용·도달 극대화 — 이 트레이드오프가 결정의 전부.
- ⚠️ 좌표 공개 자체가 팩 상품의 "좌표 0" 불변식을 뒤집는다(의도된 반전). 팩은 계속 좌표 없음 유지; 좌표는 이 데이터셋+`/api/v1/locations`로만 나감.

## A. Hugging Face Datasets (AI 개발자 발견 채널)
1. huggingface.co 로그인 → **New Dataset** → 이름 예 `metatake/filming-locations`.
2. 이 폴더의 `README.md`(카드) + `.jsonl` + `.csv`를 업로드(웹 UI 드래그 또는 `huggingface-cli upload`).
3. 카드 `<owner>`를 실제 네임스페이스로 치환.
4. 다운로드 수가 곧 수요 증거(mcp_calls보다 빨리 쌓임) + 백링크.

## B. Zenodo (DOI = 학술 인용 가능 객체)
1. zenodo.org 로그인(ORCID 연동 권장) → **New upload**.
2. `.csv` + `.jsonl` 업로드, **Metadata**는 `.zenodo.json` 값 그대로(제목·설명·creators·license·keywords) 입력하거나 GitHub 연동 릴리스로 자동 인입.
3. **Publish** → DOI 발급. 이 DOI를 사이트 `/data`·`/methodology#locations`·데이터 카드에 역링크.
4. (선택) 데이터셋 논문 1편(코퍼스 구축법·TakeScore 척도 근거) → 오너의 본업과 겹치는 무기, 협상 테이블 명함.

## C. 출판 후 사이트 배선 (내가 할 수 있음 — 지시 시)
- `/data` 페이지에 "Open dataset: HF + Zenodo DOI" 카드 + 다운로드 링크.
- `/methodology#locations`에 데이터셋·DOI 인용.
- README `<owner>` 실경로 확정.

## 검증
```bash
python3 -c "import json;print(sum(1 for _ in open('datasets/filming-locations/metatake-filming-locations.jsonl')),'rows')"
head -1 datasets/filming-locations/metatake-filming-locations.jsonl
```
