# Keyword Radar — ledger

정본: [`HANDOFF-키워드레이더.md`](../HANDOFF-키워드레이더.md). 소스 헬스 경고(3연속 실패)·시드 기록·운영 메모가 여기 쌓임.

- [2026-07-12] radar/ 스캐폴딩 생성 (마이그 0083 적용, 이중 엔진, 무료 전용·Threads 제외 확정). 부트스트랩은 README §부트스트랩.
- [2026-07-12] 마이그 0083 적용(HTTP 201) + 키워드 100 시드 완료. sb_secret_ 키는 비브라우저 UA 필수(common._svc_headers).
- [2026-07-12] 라이브 검증: poll_feeds 78/107 피드 정상·실매칭 12건, poll_hn 커서 전진(니치라 0매칭 정상), Jetstream 20초 819포스트 수신(니치 0매칭 정상, "Mulholland Drive" 문자열엔 정상 매칭). matcher 자가테스트 12/12. tsc 클린(radar 파일 0에러).
- [2026-07-12] ⚠️ 첫주 튜닝 관측: 문맥 게이트 오탐 — "Aftersun (2022)"가 film-beat 아웃렛의 여름/Love Island 기사에 매칭됨. 초일반 단어 제목(aftersun/burning/stalker)은 film-beat 바이패스가 과함. 대응 옵션: (a) 해당 제목 require_context 유지하되 film-beat 바이패스에서 제외, (b) 네거티브 키워드, (c) 오탐 감내. HANDOFF §13 첫주 과제.
- [2026-07-12] 🎯 방향 A 전환(개인 창작자 발굴): 라이브 수집 1000건 중 556건(63%)이 기관이었음 → 마이그 0084 author_kind + classify_author(도메인 블록리스트)로 기본 뷰 기관 숨김; Letterboxd 추가(poll_letterboxd + add_letterboxd, 오너 큐레이션 멤버 RSS 풀 24명, filmTitle/filmYear로 전체 영화코퍼스 정확매칭±1년, /film/slug 직링크); GDELT 비활성 + 기관 피드 20개 비활성; 카드에 "→ metatake" 액션링크; Bluesky DID→핸들 해석. 라이브 검증: letterboxd 7건 개인리뷰(mike/Jay/hugo/Jack Moulton)·개인444/기관556 분리·매칭버그(연도무시 폴백 Obsession오매칭) 수정. ⚠️ 튜닝: firehose 비영화 오탐·wordpress 발견풀(389) 개인/기관 재점검.
- [2026-07-12] 멀티에이전트 적대적 코드리뷰(5차원×검증) → 11확정 발견 처리: (1)RLS는 프로젝트 자동활성으로 이미 안전(anon 읽기[]·쓰기401 실측, CRITICAL 오탐)이나 마이그에 명시적 enable RLS 추가; (2)검색폴러 3종(gdelt·wpcom·youtube) require_context 키워드 강제링크 제거→게이트 통과분만 저장; (3)process_inbox 업서트 실패 시 inbox행 미소비(원샷 푸시 유실 방지); (4)poll_hn 페이지네이션(>1000 백로그 유실 방지); (5)upsert_items items_new 반환(합성테스트 new=1/dedup new=0 검증); (6)matcher.py/.mjs norm 언더스코어 파리티+CONTEXT_WORDS 동기화(Python↔JS 매칭 결과 동일 검증); (7)watch.sh gdelt 락 stale 자가치유(하드킬 대비). 전 파일 py_compile·node --check·bash -n 클린, tsc 클린.
