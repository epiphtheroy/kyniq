# 한국어 검색 축 — 네이버 · 다음 등록 (오너 체크리스트)

*2026-07-13. Metatake는 한국어 영화비평 사이트인데 네이버·다음 검색축이 통째로 비어 있었다. 코드 배선은 완료(아래 "이미 된 것"); 실제 등록은 오너 로그인이 필요하다.*

## 이미 된 것 (코드)
- **네이버 봇(Yeti)·다음(Daumoa)·NaverBot을 middleware `GOOD_BOT` 허용목록에 추가** — 봇 게이트가 절대 차단 안 함. (robots의 TRAINING_BOTS에도 없음 = `*` allow 적용)
- **`/api` 개발자 랜딩만 크롤 허용**(robots `/api/`로 변경) — 데이터 엔드포인트는 계속 noindex.
- **네이버 사이트 인증 메타 태그 배선**: Vercel 환경변수 `NAVER_SITE_VERIFICATION`만 넣으면 `<meta name="naver-site-verification">`가 전 페이지에 자동 출력(layout.tsx). 다음 배포부터 반영.

## 오너 액션 — 네이버 서치어드바이저 (가장 큰 절대 증분)
1. https://searchadvisor.naver.com → 네이버 로그인 → **웹마스터 도구** → **사이트 등록**에 `https://metatake.net` 입력.
2. **소유확인** = "HTML 태그" 방식 선택 → 제공되는 `content="..."` 값(토큰)만 복사.
3. Vercel → 프로젝트 → Settings → **Environment Variables** → `NAVER_SITE_VERIFICATION` = 그 토큰 (Production). 저장 후 **재배포**(또는 다음 자동배포 대기).
   - `! echo`로 값 확인 금지(토큰은 공개 메타라 민감치 않지만 습관). 배포 후 `curl -s https://metatake.net/ | grep naver-site-verification`로 태그 출력 확인 → 네이버 화면에서 "확인" 클릭.
4. **사이트맵 제출**: 서치어드바이저 → **요청** → **사이트맵 제출** → `https://metatake.net/sitemap.xml` (뉴스: `https://metatake.net/news-sitemap.xml`도).
5. **RSS 제출**(있으면): `/blog` 피드 등.
6. (선택) **웹페이지 수집** 요청으로 핵심 URL 몇 개 즉시 크롤 유도.

## 오너 액션 — 다음
- 다음은 현재 **네이버·구글 대비 트래픽 작고 등록 창구가 축소**됨. Daum 검색은 상당부분 카카오/자체 색인 + 구글 신디케이션에 의존. 우선순위 낮음.
- 공식 등록: https://register.search.daum.net/index.daum (사이트 등록 신청). 신청 후 수집은 Daumoa가 하며 이미 GOOD_BOT 허용됨.

## 왜 중요한가
- 국내 검색 점유율상 **네이버 미등록 = 한국어권에서 사실상 부재**. 주당 뷰가 낮은 지금, 한국어 영화비평이라는 정체성에 비해 네이버 색인 0은 가장 큰 누수.
- 국내 AI(CLOVA X 등)의 인용·학습 소스는 네이버 색인에 크게 의존 → ②답변시점 인용 채널의 한국어판 진입로.

## 검증 (등록 후)
```bash
curl -s https://metatake.net/robots.txt | grep -i "api\|disallow"     # /api/ 만 disallow, /api 랜딩 허용
curl -s "https://metatake.net/" | grep -o 'naver-site-verification[^>]*'  # 토큰 태그 출력
```
