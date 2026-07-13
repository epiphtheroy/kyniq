# 촬영지 데이터셋 출판 — 오너 체크리스트 (item 2)

*생성 완료: `metatake-filming-locations.{csv,jsonl}` + `README.md`(데이터 카드) + `.zenodo.json`. 재생성은 `python3 worker/export-locations-dataset.py`. 아래 업로드는 계정이 필요해 오너 몫.*

**규모:** 17,341 위치 · 1,917 편 · 130개국 · 좌표 100%.

## ✅ 라이선스 결정 완료 — CC BY 4.0 (2026-07-13 오너 확정)
- **데이터셋 = CC BY 4.0**: 저작표시만 하면 상업 포함 자유 재사용. 목표=인용·권위·도달 극대화(데이터 판매 아님), 연구자 마찰 0. HF 드롭다운에서 **"Creative Commons Attribution 4.0"** 선택.
- **분리 원칙(일관성):** *촬영지 지오데이터 = CC BY* / *사이트의 원저작 비평(readings·essays) = CC BY-NC 4.0* 그대로. `/api/v1/locations`도 CC BY로 맞춤(같은 데이터라). films·takescore 등 비평 엔드포인트는 NC 유지.
- **되돌릴 수 없음 주의:** CC BY는 출판 후 NC로 강화 불가(BY→NC 영구 불가). 판매 계획이 생기면 그건 *새* 데이터/서비스로. 이 스냅샷은 영구 오픈.
- ⚠️ 좌표 공개 = 팩 상품의 "좌표 0" 불변식을 뒤집는 의도된 반전. 팩은 계속 좌표 없음 유지; 좌표는 이 데이터셋+`/api/v1/locations`로만 나감.
- 카드/메타는 이미 CC BY로 갱신됨(README frontmatter·본문·.zenodo.json·API). 추가로 만질 것 없음.

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
