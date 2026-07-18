# HANDOFF — CRM ("Touchpoint Engine") · 비즈니스 접점 관리 시스템 구축 지시서 (단일 정본)

> **기획 정본 (2026-07-15, 구축 대기).** 라우트 **`/crm`** — `/admin`과 분리된 별도 운영 표면(같은 인증 게이트, 다른 셸·나브). 전략 부모 문서: `lib/admindocs/content/business-touchpoints.ts`(13개 클러스터 A–M 접점 지도, `/admin/docs/business-touchpoints`) + `Metatake_아웃리치_운영설계.md`(컴플라이언스 캐논 — 이 문서의 법적 가드레일은 전부 그 문서에서 상속). 본 문서는 5개 관점(요구충족·구축가능성·컴플라이언스·사실검증·오퍼포지셔닝) 적대 검증을 거친 개정본이다. 구축 AI는 이 문서 하나로 DB 마이그레이션 → 페이지 → 크론 → 워커까지 그대로 만들 수 있어야 한다. 섹션마다 **의도**를 명시했다 — 의도와 충돌하는 구현 편의는 의도가 이긴다.
>
> **⭐ 2026-07-18 전략 개편 v2 — 먼저 읽어라: [§-1 「초대된 창구(Invited Channels)」](#§-1-전략-개편-v2--초대된-창구invited-channels를-1차-척추로-2026-07-18).** 오너가 홀딩한 이유는 이 문서가 **모드 A(콜드 아웃리치)를 1차 척추로** 놓았기 때문이다. 레터박스에 보낸 이메일 한 통이 실제로 원하는 커뮤니케이션을 정의했다 — **상대가 자기 이익을 위해 열어두었으나 심사해서 거절하는 창구**에, 그들의 정책을 정독하고 우리 실제 상황을 정확히 담아, 그들의 인터페이스로 예의 있게 지원하는 것. §-1이 이것을 **모드 B**로 명명하고 새 1차 척추로 승격한다. §0~§12의 엔진(컨택·룰·발송·컴플라이언스)은 폐기가 아니라 **모드 B에 재배치**된다.

---

## §-1. 전략 개편 v2 — "초대된 창구(Invited Channels)"를 1차 척추로 (2026-07-18)

> **이 섹션이 본 문서의 새 척추다.** 계기: 2026-07-18 오너가 레터박스(Letterboxd)에 보낸 이메일 한 통. 오너 판정 — "참으로 내가 하고 싶은 유형의 커뮤니케이션. 상대의 정책을 정확히 이해하고, 실제 내 상황을 잘 포착해서, 충분히 예의를 갖추어 그들의 인터페이스에 요청했다. **중요한 것은, 그들이 자기 이익을 위해 채널을 열어두지만 심사해서 거절하는 영역을 찾는 것 — 그게 정확히 내가 하고 싶은 지점이다.**" 기존 CRM(§0~§12)이 오너 마음에 들지 않아 홀딩된 근본 원인은 **모드 A(콜드 아웃리치)를 1차로 놓은 설계**였다. 모드 A는 "상대가 부탁하지 않았는데 내가 먼저 찌른다" → 그래서 LIA·CAN-SPAM·GDPR·정보통신망법이라는 두꺼운 갑옷이 필요했고, 그 갑옷의 무게 자체가 오너의 미학과 충돌했다.

### §-1.0 한 문장 재정의 (모드 B)

**모드 B = 상대가 자기 이익을 위해 이미 만들어 둔 창구(파트너십 폼·API 액세스 신청·투고 포털·평론 매체 인증·데이터 제휴 인테이크·개발자 프로그램·그랜트 공고)를 발굴하고, 그들의 공개 정책을 정독한 뒤, 메타테이크의 실제·구체 상황을 그 정책의 언어로 담아, 그들의 인터페이스로 예의 있게 지원하는 것. 심사·거절은 버그가 아니라 기능이다.**

핵심 통찰 4가지:

1. **동일 대상, 다른 접근.** 모드 B는 새 타깃 리스트가 아니다. §6-b 오퍼의 상당수(C2 Letterboxd·C3 RT/Metacritic·B1 Perplexity·B2 프런티어랩·B3 MCP·E2 LibGuides·E4 HF/Zenodo·F1/F2 관광·I1 GPT store·L2 인프라사)가 **이미 이 대상들을 겨눈다** — 다만 콜드 이메일로. 그런데 이 대상 다수가 **이미 인테이크 창구를 운영한다.** 모드 B는 콜드 메일을 그 창구 지원으로 바꾼다. 타깃을 새로 찾는 게 아니라 **접근 방법을 바꾸는 것**이 대부분의 일이다.
2. **엔진은 그대로, 봉사 대상만 바뀐다.** 이미 SHIPPED된 draft-only 파이프라인(초안→사람 승인→Gmail compose), `/crm` 셸, 컨택 원장, touches 원장은 모드 B에도 **그대로 최적**이다. 신규 개념은 단 하나 — **창구 레지스트리(`crm_channels`)**(§-1.4).
3. **컴플라이언스 갑옷이 붕괴한다.** 그들이 초대했으므로 자동수집·콜드발송 금지 규정의 표면이 대부분 사라진다(§-1.6). 오너가 홀딩한 무게의 정체가 여기서 벗겨진다.
4. **심사가 곧 가치.** 그들의 "아니오"는 비용 0이고 관계를 훼손하지 않는다. 그들의 "예"는 진짜다(그들이 걸러냈으므로). **재지원으로 조르지 않는다** — 그 순간 모드 B는 다시 스팸이 된다(§-1.6 불변식).

### §-1.1 두 모드 — 무엇이 달라지나

| 축 | 모드 A · 콜드 아웃리치 (구 1차 → 강등) | 모드 B · 초대된 창구 (**신 1차 척추**) |
|---|---|---|
| 방향 | Push — 상대가 안 물었는데 내가 찌름 | Pull — 상대가 연 문에 내가 응답 |
| 법적 표면 | 무거움 (LIA·CAN-SPAM·GDPR·정보통신망법·suppression·발송캡·워밍업) | 거의 0 (그들이 초대 — 나는 그들의 폼을 씀) |
| 신뢰 출발점 | 낮음 (콜드=의심) | 높음 (나는 그들 프로그램의 **지원자**) |
| 심사 주체 | 내가 상대를 타깃·선별 | **그들이 나를 심사** — 거절이 곧 인터페이스 |
| 거절 비용 | 평판 리스크·스팸 신고·도메인 훼손 | 0 — 예의 있는 "아니오"는 문을 남긴다 |
| 개인화 핵심 | "당신을 이렇게 읽었다"(metatake_url) | "귀 **정책**을 이렇게 이해했고, 우리 **실제** 상황은 이렇다"(정책 적합) |
| 스케일 한계 | 발송캡·워밍업·전용도메인 필요 | 열린 창구의 수 — 유한·큐레이션·고신호(2,384 컨택이 아니라 ~80–150개의 잘 고른 문) |
| 오너 적합도 | 낮음 (미학 충돌 → 홀딩의 원인) | **높음** (오너가 명시적으로 "하고 싶은 커뮤니케이션") |

### §-1.2 레터박스 사례가 정의한 크래프트 (3+1) — 오퍼가 아니라 이 절차가 정본이다

모드 A의 정본이 "오퍼 한 줄"(§6-b)이었다면, 모드 B의 정본은 **지원서 한 통을 만드는 절차**다. 창구마다 이 4단계를 밟는다:

1. **정책 정독** ("상대의 정책을 정확히 이해하고") — 그들의 공개 인테이크 페이지·약관·심사 기준·과거 승인 사례를 실제로 읽는다. `crm_channels.screening_policy`에 요지를 기록. **이것 없이는 초안 생성 금지**(§-1.6 불변식 B1).
2. **자기 상황 정확 포착** ("실제로 나의 상황을 잘 포착해서") — 메타테이크의 **진짜** 자산·규모·단계를 그 정책의 언어로 매핑. **과장 금지**(AI집필 크레딧 개편의 교훈: 검증 안 된 자랑은 심사 순간 신뢰를 무너뜨린다). `crm_channels.our_fit`에 기록.
3. **예의 + 그들의 인터페이스** ("충분히 예의를 갖추어 그들의 인터페이스에") — 그들이 만든 폼/이메일/포털로, 그들이 원하는 형식으로 제출한다. 웹 폼이면 시스템은 초안 텍스트만 만들고 오너가 폼에 붙여넣어 제출(§-1.4).
4. **거절 수용** ("상대입장에서는 거절을 할수 있지만") — 심사·거절을 존중. 거절은 `rejected`로 기록하고 **재지원하지 않는다**(정책이 명시적으로 재신청을 허용하는 경우 + 실질 변화가 생긴 경우 제외).

### §-1.3 산업별 "초대된 창구" 인벤토리 — 메타테이크의 접점 지도

레터박스를 원형으로 삼아 타 산업으로 확장한 실제 창구 목록. 등급: **★★★** = 레터박스형 정확 일치·즉시 착수 · **★★** = 강함 · **★** = 조건부/후순위. `our_fit` 자산 약칭: **TS**=13차원 TakeScore 6,701편 · **GEO**=촬영지 지오데이터(고유) · **MCP**=라이브 MCP 서버(공식 레지스트리 등재) · **API**=/api/v1 · **DS**=문장임베딩 466k·온톨로지 · **KO**=한국어 로컬라이즈 · **CCBYNC**=오픈 라이선스.

| 산업군 | 초대된 창구 (구체) | 그들이 문 연 이유 | 심사 기준(정독 대상) | 메타테이크 실제 적합 | 등급 |
|---|---|---|---|---|---|
| **평론 인증·아그리게이터** | Rotten Tomatoes — 토마토미터 승인 매체(Approved Tomatometer Publication) 신청 | 커버리지 폭이 곧 제품 — 매체가 많을수록 아그리게이터 가치 상승 | 편집 기준·발행 빈도·독립성·아카이브 규모·에디토리얼 스탠다드 | 6,701편 구조화 리딩+TS. **정책의 언어=편집 일관성/볼륨** — 정면 매치 | ★★★ |
| | Metacritic — 매체 편입(publication inclusion) | 동일 — 스코어 소스 다양성 | 발행 이력·전문성·독립 편집 | 동일. TS는 그들의 메타스코어와 병렬 서사 | ★★★ |
| | IMDb 외부 리뷰/평론 편입 | 작품 페이지 풍부화 | 매체 신뢰도 | 리딩 페이지 영구 링크 | ★ |
| **영화 데이터·카탈로그** | Letterboxd — API 액세스/데이터 제휴 (원형) | 페이지 체류·데이터 풍부화 | API 사용목적·비상업/상업·데이터 출처 | GEO 촬영지 레이어(그들에 없음)+CCBYNC | ★★★ |
| | TMDB — 상업 API 라이선스 + 기여자 프로그램 | 데이터 기여가 곧 그들 카탈로그 | 사용목적·기여 데이터 품질 | GEO 기여·API 라이선스 | ★★★ |
| | Trakt / JustWatch / Reelgood — 데이터·API 파트너 | 커버리지·체류·제휴 매출 | 파트너 적격·데이터 규격 | GEO·TS 라이선스 | ★★ |
| **AI·검색 퍼블리셔·데이터** | Perplexity — 퍼블리셔 프로그램 | 인용 소스 다양성=답변 품질 | 콘텐츠 독창성·권위·라이선스 | 고유 비평+GEO, IMDb/LB가 API 막은 영역 | ★★★ |
| | Anthropic·OpenAI·Google — 데이터 파트너십 인테이크(공개 모집) | 클린 데이터+도메인 eval 병목 | 데이터 클린성·라이선스·법무 기준 | CCBYNC·소송리스크 0·문화 도메인 eval | ★★★ |
| | Common Crawl / Internet Archive — 수록 | 코퍼스 폭 | 공개·robots·품질 | 공개 표면+CCBYNC | ★ |
| **지식그래프·엔티티** | Wikidata / Wikipedia — 구조화 데이터 기여(커뮤니티 심사) | 지식 커버리지 | 출처·중립성·notability | **엔티티 신원 갭 직접 해소**(AI봇맞이 §③)+GEO 인용 | ★★★ |
| | Google Dataset Search — schema.org/Dataset 마크업으로 색인 편입 | 데이터셋 발견성 | 유효 구조화 마크업 | Dataset 스키마만 붙이면 편입 | ★★★ |
| | OpenAlex / Crossref / DataCite — 메타데이터·DOI 등록 | 학술 그래프 밀도 | 메타데이터 규격 | 데이터페이퍼 DOI | ★★ |
| **데이터셋 배포** | Hugging Face Datasets — 등재(큐레이션·featured) | 고품질 데이터셋 밀도=플랫폼 가치 | 카드 품질·라이선스·유용성 | GEO·온톨로지 유니크 데이터셋 | ★★★ |
| | Kaggle / Zenodo(DOI) / data.world — 데이터셋 발행 | 카탈로그 인용·검색 지표 | 문서화·라이선스 | 동일 | ★★ |
| **AI 도구 레지스트리** | Anthropic MCP 디렉토리 · Smithery · mcp.so · Glama — 서버 등재 | 고품질 서버 수=생태계 활성 | 완성도·readOnly·문서 | **MCP 이미 라이브+공식 레지스트리 등재** | ★★ |
| | GPT store · 커넥터 디렉토리 · Zapier/Make 통합 | 생태계 활성 증거 | 앱 심사·규격 | API 기반 커넥터 | ★★ |
| **개발자 배포** | Product Hunt — 런칭(커뮤니티 심사) | 트래픽 엔진=메이커 서사 | 완성도·독창성 | "1인+AI 에이전트가 플랫폼 구축" 서사 | ★★ |
| | Chrome Web Store — 확장 심사 | 스토어 품질 | 리뷰 정책 | **확장 이미 보유** | ★★ |
| | GitHub awesome-* 리스트 — 메인테이너 심사 PR | 리스트 품질 | 관련성·품질 | awesome-mcp/-movies/-datasets | ★★ |
| **학계·도서관** | 대학 LibGuides — 리서치 가이드 등재 요청(사서 심사) | 이용자 큐레이션 리소스 | 무비용·인용양식·영구링크·권위 | **22곳 검증 이력**·무계약·CCBYNC | ★★★ |
| | 영화학 저널 투고 포털(Screen·JCMS·Senses of Cinema·[in]Transition) — 피어리뷰=심사 | 인용지수·독자 | 방법론·기여도·피어리뷰 | 데이터페이퍼·방법론 노트·DS | ★★ |
| **언론·뉴스 배포** | Google News Publisher Center — 퍼블리셔 편입 | 뉴스 커버리지 폭 | 저널리즘 기준·기술 요건 | Now/뉴스층·에디토리얼 | ★★ |
| | Apple News · Flipboard · SmartNews · MSN — 퍼블리셔 | 콘텐츠 재고 | 퍼블리셔 심사 | 발행 표면 | ★ |
| | Substack 추천 네트워크 | 상호 성장 | 상호 추천 적격 | (뉴스레터 운영 시) | ★ |
| **문화·페스티벌·기관** | 영화제 프레스 인증(accreditation) — 심사 | 커버리지 확보 | 매체 자격·발행 이력 | 리딩 매체 자격 | ★★★ |
| | 영화제 공식 파트너·마켓 데이터 세션 인테이크 | 프로그램 차별화·참가비 | 파트너 적격 | GEO/TS 세션 | ★★ |
| | Atlas Obscura — 기여자(장소 심사) | 장소 콘텐츠 밀도 | 사실성·독창성 | **GEO 촬영지=정확 매치** | ★★ |
| **관광·지도·지오** | KTO·지자체·필름커미션 — 공개 그랜트·조달 공고 지원 | 집행 성과·유치 경쟁력 | 공고 요건·정량 산출물 | GEO+KO, F1/F2 오퍼 재프레임 | ★★ |
| | Google Maps 콘텐츠 파트너·Local Guides · Mapbox/OSM 기여 | POI 밀도=체류 | 데이터 규격·정확성 | GEO POI 레이어 | ★ |
| **인프라·스타트업 프로그램** | Vercel·Supabase·Anthropic — 고객 사례/DevRel 인테이크(공개 모집) | 개발자 획득용 실증 사례 | 유료 고객·스토리 완성도 | **유료 고객 정당성**+실물 레퍼런스 | ★★ |
| | AWS Activate · Google for Startups · MS for Startups — 크레딧 신청 | 미래 고객 락인 | 스타트업 적격 | 초기 단계·AI 네이티브 | ★★ |
| **그랜트·엑셀러레이터** | Google News Initiative · Knight · Mozilla · Fast Forward(비영리테크) · NEH/DH · KOCCA — 지원 공고 | 측정 가능한 미션 성과 | 공고 심사 기준 | 문화 아카이브·오픈 데이터·정량 산출물 | ★ |

⚠️ **구축·운영 규율**: 위 표의 창구명·프로그램명은 **정독 대상을 가리키는 좌표이지 확정 사실이 아니다.** 모드 B의 1단계(§-1.2)가 바로 "그들의 **현재** 공개 정책을 실제로 읽는 것"이다 — 착수 시점에 각 창구의 라이브 인테이크·심사 기준을 재확인하고 `crm_channels`에 기록한 뒤 초안을 만든다. 존재하지 않거나 닫힌 창구는 `status='closed'`로 남기고 모드 A 후보로 강등할지 판단한다.

### §-1.4 데이터 모델 증분 — `crm_channels` + 기존 파이프라인 재사용

신규 테이블 **딱 1개**. 나머지(drafts·touches·suppression·settings)는 그대로 재사용. 하우스 규약 준수(RLS on·정책 0·service-role 전용). 마이그레이션 번호는 구현 시점 3곳(supabase/·worker/·radar/) 최대+1로 재확인(현재 최신은 이미 0108 이상 — §10-10).

```sql
-- 초대된 창구 레지스트리 — 모드 B의 심장. 한 행 = 상대가 열어둔 문 하나.
create table crm_channels (
  id bigint generated always as identity primary key,
  org_id bigint references crm_orgs(id),           -- 기존 조직 앵커 재사용(있으면)
  segment_code text references crm_segments(code),  -- 산업군 매핑(기존 세그먼트 재사용)
  name text not null,                               -- 예: "Rotten Tomatoes — Approved Publication"
  industry_family text,                             -- §-1.3의 산업군
  channel_url text not null,                        -- 실제 인테이크 폼/포털/이메일 URL(정독·제출 지점)
  channel_type text not null check (channel_type in
    ('web_form','email','portal','submission','api_application','registry','grant','accreditation')),
  their_benefit text,                               -- 그들이 문을 연 이유(존재이유 결합)
  screening_policy text,                            -- §-1.2 1단계 산출: 정독한 심사 기준 요지
  our_fit text,                                     -- §-1.2 2단계 산출: 우리 실제 상황(과장 금지)
  depth text not null default 'mid' check (depth in ('deep','mid','light')),
  grade text check (grade in ('AAA','AA','A')),     -- ★★★/★★/★ (우선순위)
  status text not null default 'discovered' check (status in
    ('discovered','studying','drafted','submitted','under_review','accepted','rejected','maintaining','closed')),
  -- discovered→studying(정독)→drafted(초안)→submitted(제출)→under_review→accepted|rejected|closed. maintaining=관계 유지 중.
  decided_at timestamptz,                           -- accepted/rejected 시각
  reapply_allowed boolean not null default false,   -- 정책이 재신청 명시 허용 시에만 true(§-1.6 B4)
  evidence_url text,                                -- 정책 페이지 스냅샷 근거
  owner_notes text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create unique index crm_channels_url_uq on crm_channels (lower(channel_url));
create index crm_channels_status on crm_channels (status, grade);
```

**파이프라인 재사용(신규 코드 최소)**:
- **초안**: `crm_drafts`에 `created_by='manual'` + 신규 nullable `channel_id bigint`(참조 논리) 1컬럼 추가. 지원서 본문은 기존 컴포저로 작성, 기존 사람-승인 게이트 통과.
- **제출**:
  - `channel_type='email'` → 기존 Gmail compose 파이프라인 그대로(§5-6). 초안→승인→Gmail 초안→오너 수동 전송.
  - `channel_type∈(web_form·portal·submission·api_application·grant·accreditation)` → 시스템은 **초안 텍스트만** 생성. 오너가 그들의 폼에 붙여넣어 제출한 뒤 `/crm/channels`에서 `status='submitted'` 수동 전환. **발송 자동화 없음**(§10-1 불변식 그대로 — 오히려 더 강하게 지켜진다).
- **이력**: 모든 정독·제출·응답을 기존 `crm_touches`에 1행씩(`channel='form'|'gmail'`, `kind='note'|'first'|'reply_in'`). 시스템의 심장은 여전히 접촉 원장이다.

### §-1.5 IA·구축순서 개편 — 모드 B 먼저

- **신규 라우트 1개**: `/crm/channels`(레지스트리 리스트 → 상세: 정책 정독 필드·적합 브리프·초안·상태 파이프라인). `/crm/channels/[id]`. 대시보드(§5-1)에 "심사 대기 창구"·"정독 대기 창구" 타일 2개 추가.
- **구축 순서 재정렬**(§9 대체 우선순위): 이미 SHIPPED된 엔진 위에서, **모드 B가 새 P1**이다 — `crm_channels` 마이그레이션(1테이블) + `/crm/channels` UI + drafts.channel_id 1컬럼. 컨택 임포트·룰 엔진·콜드 발송(구 P1~P4)은 **모드 A로 강등**, 실제 콜드가 불가피한 세그먼트에만 남긴다. 오너가 홀딩했던 무거운 절반은 "나중에·필요할 때만".
- **착수 즉시 가능**: `/crm` 셸·인증·Gmail·컴포저·touches가 전부 라이브(메모리 [[crm-touchpoint-engine]]). 모드 B는 **1테이블+1페이지**면 오늘의 레터박스 이메일을 시스템 안에서 재현할 수 있다.

### §-1.6 컴플라이언스 붕괴 + 모드 B 불변식

**붕괴하는 것**(모드 A 전용이었다): 자동수집 금지(정보통신망법 §50-2)는 **그들이 초대했으므로** 대부분 무관 · 콜드 발송 캡/워밍업/전용도메인(§10-11)은 웹 폼·API 신청엔 무의미 · LIA(§10-4)는 그들의 공개 인테이크가 곧 적법 근거 · (광고) 표기(§10-3)는 상업 광고가 아닌 파트너십/투고 지원엔 부적용. **오너가 홀딩한 무게의 정체가 여기서 벗겨진다.**

**그대로 유지**: 사람 승인 없는 제출 0(§10-1) · suppression은 여전히 하드 게이트(거절 창구는 재접촉 금지 목록과 동치) · 개인정보 최소화(§10-15) · 과장 금지(§-1.2 2단계).

**모드 B 신규 불변식**:
- **B1. 정독 없이 초안 없다.** `crm_channels.screening_policy`가 비면 초안 생성 금지. 그들의 정책을 안 읽고 쓰는 지원서는 레터박스 사례의 정반대다.
- **B2. 과장 금지 = 심사 신뢰의 생명선.** `our_fit`은 검증된 실제 자산만. (AI집필 크레딧 개편에서 배운 것: 검증 안 된 자랑은 심사 순간 무너진다.)
- **B3. 그들의 인터페이스로만.** 웹 폼이 있으면 이메일로 우회하지 않는다. 그들이 만든 문으로 들어간다.
- **B4. 거절은 종착이다.** `status='rejected'` 창구에 재지원 금지 — **단** `reapply_allowed=true`(정책이 재신청 명시 허용) **그리고** 실질 변화(자산·규모·자격)가 생긴 경우만 예외. 조르는 순간 모드 B는 스팸이 된다.
- **B5. 창구는 유한·큐레이션.** 목표는 리스트 크기가 아니라 **잘 고른 문의 통과율**. ~80–150개를 넘겨 기계적으로 늘리지 않는다(늘리면 정독 품질이 무너진다).

---

## §0. 한 문장 정의

**Metatake의 자산(콘텐츠·기술)을 지렛대로 한 B2B 접점 관리 전 과정을, 한 화면에서 시작해 세부 페이지로 파고들 수 있게 만든 오너 전용 CRM.** 두 모드로 구성된다 — **모드 B(초대된 창구, 신 1차 척추 §-1)**: 상대가 열어둔 창구 발굴 → 정책 정독 → 적합 브리프 → 지원 초안 → 사람 승인 → 그들의 인터페이스로 제출 → 심사 결과 추적. **모드 A(콜드 아웃리치, 강등)**: 후보 발굴(서치 봇) → 컨택 DB → 오퍼 매칭 → 초안 생성(룰 엔진) → 사람 승인 → Gmail 발송 → 응답 관리 → 이력·지표. 두 모드 모두 **초안까지는 기계, 제출/발송 버튼은 사람**이라는 draft-only 원칙을 공유한다(§10-1).

`/admin`과의 차이(오너 정의): `/admin`은 **제품(사이트·콘텐츠·파이프라인) 운영**, `/crm`은 **비즈니스 접점(사람·조직·딜) 운영**. 데이터도 나브도 섞지 않는다. 인증 게이트만 공유한다.

핵심 설계 사상 4가지:

1. **컨택이력이 중심이다.** 모든 자동화(룰·초안·팔로업)는 `crm_touches`(접촉 원장)를 읽어서 결정된다. "이 그룹에 무엇을 언제 보냈고 무슨 답이 왔나"가 시스템의 심장이고, 나머지는 그 주변 장치다.
2. **기계는 후보와 초안까지, 발송 버튼은 사람이.** 서치 봇은 후보(candidates)까지만, 룰 엔진은 초안(drafts)까지만 만든다. 승인 없는 발송은 어떤 경로로도 일어나지 않는다(§10-1). 이것이 운영설계 §4의 "봇은 후보를 모으고 사람이 검수한다" 원칙의 코드화다.
3. **오퍼는 상대의 존재이유와 결합되어야 한다.** 오퍼 라이브러리(§6)의 모든 한 줄 제안은 "내 부탁"이 아니라 "상대가 자기 이익(매출·mandate·KPI) 때문에 검토하게 되는 거래"로 작성된다. 얕은 결합(소개 부탁)보다 깊은 결합(광고 구매 문의·레브셰어·사업부 신설 제안)을 우선한다. 단, **1인 운영이 실제로 이행 가능한 약속만** 한다 — 과장된 딜은 검증 순간 신뢰가 무너진다.
4. **가장 강한 개인화는 "당신을 이렇게 읽었다"이다.** Metatake에는 대상 인물·작품을 다룬 페이지가 이미 존재하는 경우가 많다(figures 4.6k·readings·takes). 그 링크 한 줄이 콜드 메일을 선물로 바꾼다 — 컨택마다 `metatake_url`을 기록하고 템플릿이 이를 사용한다(§5-2).

---

## §1. 포지셔닝 — 표면 지도

| 표면 | 멘탈모델 | 입력 | 출력 |
|---|---|---|---|
| `/crm` 대시보드 | "오늘 접점 상황이 어떤가, 무엇부터 하나" | 전 테이블 집계 | KPI 타일 + 오늘 할 일 큐 + 파이프라인 퍼널 |
| `/crm/contacts` | "누구를 알고 있고 어느 단계인가" | 필터·검색 | 컨택 리스트 → 상세(이력 타임라인) |
| `/crm/segments` | "어떤 그룹에 어떤 명분·오퍼로 가나" | 터치포인트 맵 A–N | 그룹별 컨택 수·오퍼·룰 현황 + 그룹 CRUD |
| `/crm/rules` | "기계가 언제 무엇을 제안하게 할 것인가" | 룰 CRUD | 크론이 실행하는 스케줄링 룰 |
| `/crm/outbox` | "기계가 만든 초안을 검토·승인한다" | proposed 초안 | Gmail 초안 생성/발송 |
| `/crm/inbox` | "온 답장에 어떻게 대응하나" | Gmail 수신 동기화 | 분류 + 자동응답 초안 승인 |
| `/crm/research` | "봇이 찾아온 새 접점 후보 심사 + 봇의 사냥터 관리" | scout·radar·수동 | 승인 → 컨택 승격, 소스 등록/중지 |
| `/crm/import` | "이미 가진 리스트를 시스템에 넣는다" | CSV/XLSX 업로드 | 매핑→중복제거→적재 리포트 |
| `/crm/settings` | "발송 규율·컴플라이언스 콘솔" | 캡·수신거부·계정 | 하드 게이트 설정 |

핵심 통찰: **엔진의 상당 부분이 이미 존재한다.** 인증 게이트(`lib/admin.ts`), 감사 로그(`content_events`), 크론 패턴(`/api/metrics/insights`), 서치 봇 골격(키워드 레이더 `radar/`), 파서(`papaparse`·`xlsx` 이미 package.json에 있음), 컨택 데이터 2,384행(§2). 신규 개념은 4개뿐 — **오퍼 매칭, 룰 엔진, Gmail 연동, 수신함 분류**.

---

## §2. 보유 자산 — 검증된 사실 (2026-07-15 저장소 실측)

### 2-a. 임포트할 컨택 데이터 (전수 실측 완료)

| 소스 파일 | 행 | 검증 이메일 | 비고 |
|---|---|---|---|
| `Metatake_학계_평론가_DB.xlsx` 시트 `학계_평론가_개인` | **1,394** | 1,238 | 19개 카테고리(학계 561·Substack 124·평론가 104·사서 69·영화제프로그래밍 60…). KR법유의=Y 15행. "1000개 넘는 리스트"의 실체 |
| `Metatake_트레이드매체_DB.xlsx` 시트 `트레이드매체` | **641** | 420 | 9개 권역·63개국, 세미콜론 다중 이메일 셀 존재, `KR법유의` 컬럼 |
| `data/sources/magazine-contacts.csv` | **288** | 143 | 145행은 의도적 `unknown`(Cloudflare 난독 미해독 — 스킬 규칙). `outlet_id`로 allowlist와 FK. contact_type 8종: editorial 148·general 88·partnerships 16·licensing 14·marketing 12·press 7·advertising 2·syndication 1 |
| `Metatake_컨택DB_템플릿.xlsx` 시트 `컨택DB` | **61** | 61 | 영화제 34·트레이드 15·배급 12. 운영설계 §5 스키마의 원형 |
| **컨택 소계** | **2,384** | **1,862** | 전 행 발송단계=`미발송` |
| `magazine research agent/magazine-allowlist.csv` | 150 | — | 조직(outlet) 메타·robots·trust_tier. ⚠️ `data/sources/` 사본과 33행 상이 — **`magazine research agent/` 쪽이 신본** |
| `Metatake_컨택DB_템플릿.xlsx` 시트 `소스리스트` | 111 | — | 리드(공식 페이지만) → `crm_sources` 시드 |
| `magazine research agent/film-theory-journals-50.csv` | 50 | — | 학술지 타깃 리스트 |
| `magazine research agent/reception-extra-outlets.csv` | 33 | — | 보조 outlet 리스트 |

### 2-b. 인프라 사실 (구축 전 검증됨)

- 스택: Next 16.2.7 / React 19 / `@supabase/ssr` / Tailwind v4(단, **admin 계열 표면은 인라인 스타일 하우스룰** — `/crm`도 동일). Vercel `hnd1`, 크론은 현재 1개(`/api/metrics/insights` */30).
- 인증: `middleware.ts`의 `/admin` 블록 — 미로그인 → `/admin/login` 리다이렉트, 비admin → `/_not-found` 스텔스 rewrite. `profiles.role='admin'`이 유일한 권한 소스. `lib/admin.ts`의 `getAdminUser()/requireAdmin()/logContentEvent()` + `lib/supabase/admin.ts`의 `createAdminClient()`(service-role).
- 마이그레이션: 최신 `0099`. ⚠️ 번호는 `supabase/migrations/` + `worker/*.sql` + `radar/*.sql` **3곳의 최대값+1**(구현 시점 재확인 — 본 지시서는 0100/0101 가정). 하우스 규약: 기계 테이블은 **RLS on + 정책 0개 = service-role 전용**, RPC는 `security definer` + `service_role`에게만 grant + `set statement_timeout '8s'`.
- 이메일: **Resend는 뉴스레터(`worker/blog-send.py`) 전용.** 콜드 아웃리치에 쓰지 않는다(Resend AUP가 콜드 메일 금지 + 운영설계 §8 "메인 도메인 콜드 발송 금지"). **Gmail 코드 통합은 현재 0** — 본 구축에서 신설.
- 서치 봇 골격: 키워드 레이더(`radar/`, HANDOFF-키워드레이더.md) — Mac 상주 `radar-watch.sh`, `radar_sources/items/runs` 원장, Aho-Corasick 매칭, 디스커버리 플라이휠.
- Mac↔Vercel 큐 패턴: `/admin/factory`의 "버튼 → `factory.runs` queued → **`worker/factory-watch.sh`**(30초 폴링, 원자적 클레임)가 집어간다" — scout 수동 트리거에 재사용(§5-8). ⚠️ 루트의 `factory-watch.sh`(300초 planning 루프)와 다른 파일이다 — 반드시 `worker/` 쪽을 복제원으로.
- 워커 규약: Python **stdlib only(pip 금지)**, `.env.local` 파싱, PostgREST를 urllib로 직접 호출(`hourly/pipeline/common.py`의 `sb_get/sb_insert/sb_rpc` 재사용), 이중실행 방지 flock은 `hourly/pipeline/produce.py` 참조, PostgREST 1000행 캡 페이징은 `radar/common.py` 참조, `sb_secret_` 키는 Mozilla UA에 401(⚠️ 실사고 이력 — `SB_UA` 사용).
- 기존 운영 상한(오너 메모 [outreach-execution-status]): **백링크 아웃리치 주 10통 상한 + 발송 전 중복 확인** — 이 관행을 settings 기본값으로 승계한다(§5-9).

### 2-c. ⚠️ 갭 — 구축 전/중 오너 액션 필요

1. **`OUTREACH-2주-실행플랜.md` + `OUTREACH-실행현황-2026-07-04.md`가 저장소에 없다**(00-INDEX·STATE가 참조하지만 미커밋 — Mac 로컬 `/Users/jerryje/Documents/MetaTake`에만 존재 추정). 여기에만 있는 기록: **Gmail 초안 18건(발송 여부는 보낸편지함이 진실)·LibGuides 22곳 검증·매체 티어·휴면 타깃**. → 오너가 두 파일을 커밋하거나 `/crm/import`의 재대사(§5-4-D)로 흡수한다. 그 전까지 발송 이력의 시스템 오브 레코드는 **Gmail 보낸편지함**이다.
2. Gmail OAuth 자격증명(§5-6-A)은 오너의 GCP 콘솔 작업 1회가 필요하다(약 15분). P2 완료 조건.
3. **물리 주소(CAN-SPAM 푸터 필수)와 LIA 평가 문서**(운영설계 §2의 3단계 — 컨택별 출처 필드는 증빙이지 평가서가 아니다): 둘 다 P2 발송 개시 전 오너 제공/작성. LIA 문서는 저장소에 커밋하고 `/crm/settings`에서 링크.
4. `수신거부` 시트(컨택DB 템플릿)는 현재 빈 상태 — suppression은 0에서 시작하되, Gmail에서 수신거부 회신이 있었는지 P2 재대사 때 확인.

---

## §3. IA — 페이지 지도 (라우트 12개)

```
/crm                          대시보드 (한눈 화면)
├── /crm/contacts             컨택 DB 리스트 (필터·검색·일괄작업)
│    └── /crm/contacts/[id]   컨택 상세 — 이력 타임라인·오퍼·초안 작성·GDPR 삭제
├── /crm/segments             세그먼트(카테고리) 허브 — A–N 클러스터 + 그룹 CRUD
│    └── /crm/segments/[code] 그룹 상세 — 소속 컨택·오퍼·룰·성과
├── /crm/offers               오퍼 라이브러리 (한 줄 제안 + 결합점, 세그먼트별)
├── /crm/rules                스케줄링 룰 목록·편집
├── /crm/outbox               초안 검토 큐 (proposed → approved/queued → sent)
├── /crm/inbox                수신 응답 큐 (분류·자동응답 초안 승인)
├── /crm/research             서치 봇 — 후보 심사 큐 + 소스 레지스트리 관리
├── /crm/import               임포트 마법사 (CSV/XLSX → 매핑 → dedup → 적재)
└── /crm/settings             발송 캡·발송 윈도우·suppression·채널 계정·컴플라이언스 체크리스트
```

**의도**: 대시보드는 "상태 파악 + 오늘 할 일 진입점"이고, 실제 작업은 전부 세부 페이지에서 한다. 오너가 아침에 `/crm` 한 번 열면 ① 검토 대기 초안 ② 미처리 응답 ③ 승인 대기 후보 ④ 오늘 예정 팔로업이 숫자로 보이고, 각 숫자가 해당 큐로 링크된다.

셸: `app/crm/layout.tsx`는 `app/admin/layout.tsx`를 복제(고정 220px 사이드바 + 인라인 스타일 + CSS 변수 다크 테마)하되 **배경색만 구분**(사이드바 `#1a2e1f` 계열 — admin의 남색과 시각적으로 즉시 구별). `metadata.robots = noindex,nofollow`. 미인증 시 bare-render(리다이렉트는 middleware 몫 — admin과 동일한 함정 회피). admin 나브에 `CRM ↗` 링크 1줄 추가(선택).

---

## §4. 데이터 모델 — 마이그레이션 계약

**의도**: 운영설계 §5의 필드 구조(= LIA/CAN-SPAM/CASL 증빙 구조)를 그대로 관계형으로 편 것. 모든 테이블 **RLS on·정책 0(service-role 전용)**. 상태값은 영문 코드(DB) + 한글 라벨(UI) — 운영설계의 `미발송/1차발송/팔로업/응답/수신거부`는 아래 `stage` 코드에 1:1 매핑된다.

`supabase/migrations/0100_crm_core.sql` (번호는 구현 시점 최신+1로 재확인). **아래 DDL이 0100의 전량이다 — 이 블록에 없는 테이블을 임의로 만들지 말 것**:

```sql
-- 조직(outlet/기관). magazine-allowlist가 시드. 컨택의 dedup 앵커.
create table crm_orgs (
  id bigint generated always as identity primary key,
  name text not null,
  domain text,                          -- 예: variety.com (소문자, dedup 키)
  kind text,                            -- outlet|festival|distributor|platform|university|agency|brand|other
  country text, region text,
  homepage_url text, meta jsonb default '{}'::jsonb,  -- allowlist의 rss/robots/trust_tier 등 원본 보존
  created_at timestamptz default now()
);
create unique index crm_orgs_domain_uq on crm_orgs (lower(domain)) where domain is not null;

-- 세그먼트 = 터치포인트 맵의 클러스터·그룹 트리 + 신설 N 클러스터. §6-a가 시드. 이후 확장은 /crm/segments CRUD.
create table crm_segments (
  code text primary key,                -- 'A' | 'A1' | 'N1' ...
  parent_code text references crm_segments(code),
  name_ko text not null, name_en text,
  rationale text,                       -- 명분(터치포인트 맵의 '명분' 열)
  touch_types int[] default '{}',       -- 접점 유형 범례 1..14
  priority int default 100,             -- 낮을수록 우선
  status text not null default 'active' check (status in ('active','retired')),  -- 소프트 은퇴(참조 보존)
  notes text
);

-- 컨택 본체. 운영설계 §5 필드 전량 + 동의(옵트인) 필드. LIA 3필드는 초안 생성 전제조건(§10-4).
create table crm_contacts (
  id bigint generated always as identity primary key,
  org_id bigint references crm_orgs(id),
  segment_code text references crm_segments(code),
  name text,                            -- 사람 이름(없으면 null, org_name으로 표시)
  org_name text not null,               -- 매체/기관명(임포트 시 원문 보존)
  role_title text,
  country text,
  jurisdiction text not null default 'OTHER' check (jurisdiction in ('EU','UK','US','CA','KR','OTHER')),
  kr_law_flag boolean not null default false,   -- 정보통신망법 트랙(§10-3)
  email text,                           -- 소문자 정규화. 'unknown' 금지 — 없으면 null
  alt_emails text[] default '{}',
  channel_type text not null default 'email' check (channel_type in ('email','form','dm')),
  contact_url text,                     -- form/dm일 때의 문의 URL
  metatake_url text,                    -- 이 인물/조직을 다룬 Metatake 페이지("당신을 이렇게 읽었다" 링크)
  source_url text,                      -- LIA 증빙: 공개 게시처
  collected_at date,
  legal_basis text,                     -- 공개프레스|문의용|비즈니스문의|동의|기타 ('기타'는 LIA 통과로 치지 않음 §10-4)
  consent_status text not null default 'none' check (consent_status in ('none','requested','granted','denied')),
  consent_at timestamptz, consent_evidence_url text,   -- KR·CA 게이트가 검사(§10-3)
  verify_status text not null default 'unverified' check (verify_status in ('unverified','valid','risky','bounced')),
  email_verified_at timestamptz,
  stage text not null default 'none' check (stage in
    ('none','first_sent','followup','replied','negotiating','won','parked','unsubscribed','bounced')),
  -- UI 라벨: 미발송/1차발송/팔로업/응답/협상/성사/보류/수신거부/반송
  -- 전이 규칙: first_sent/followup ← 발송 동기화(§5-6-D) · replied ← 인바운드 분류기(§5-7)
  --            negotiating/won ← 수동 전용(상세·일괄 액션) · parked ← 수동 또는 분류기(negative)
  parked_reason text check (parked_reason in ('owner','negative_reply')),
  last_touch_at timestamptz,
  next_action_at timestamptz,           -- 룰·수동으로 세팅되는 "다음 액션 예정일"
  tags text[] default '{}',
  score int default 0,                  -- 우선순위 점수(수동, 기본 0 — 자동 스코어링은 ⛔ 의도적 미구현)
  owner_notes text,
  import_batch_id bigint,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create unique index crm_contacts_email_uq on crm_contacts (lower(email)) where email is not null;
create index crm_contacts_seg_stage on crm_contacts (segment_code, stage);
create index crm_contacts_next_action on crm_contacts (next_action_at) where next_action_at is not null;
create index crm_contacts_org_name_trgm on crm_contacts using gin (org_name gin_trgm_ops);

-- 오퍼 라이브러리. §6-b가 시드. depth: deep(구매·레브셰어·사업제안) > mid(공급·제휴) > light(등재·소개).
create table crm_offers (
  id bigint generated always as identity primary key,
  segment_code text not null references crm_segments(code),
  title text not null,                  -- 한 줄 오퍼
  coupling text not null,               -- 왜 상대의 이익인가(존재이유 결합점)
  depth text not null default 'mid' check (depth in ('deep','mid','light')),
  status text not null default 'active' check (status in ('active','draft','retired')),
  sort int default 100
);

-- 이메일 템플릿. 렌더러(lib/crm/render.ts)가 푸터·(광고) 표기를 강제(§10-13).
create table crm_templates (
  id bigint generated always as identity primary key,
  name text not null,
  segment_code text references crm_segments(code),
  offer_id bigint references crm_offers(id),
  language text not null default 'en' check (language in ('en','ko')),
  subject_tpl text not null,            -- {{name}} {{org}} {{personal_line}} {{metatake_url}} 플레이스홀더
  body_tpl text not null,
  kind text not null default 'first' check (kind in ('first','followup','reply')),
  non_commercial boolean not null default false,  -- true = 학계·교육용 비상업 톤(§10-5b)
  created_at timestamptz default now()
);

-- 스케줄링 룰. 크론이 평가해 초안을 만든다(§5-5). match/trigger/action 계약은 §5-5-B.
create table crm_rules (
  id bigint generated always as identity primary key,
  name text not null,
  enabled boolean not null default false,        -- 기본 off — 오너가 명시적으로 켠다
  match jsonb not null default '{}'::jsonb,
  trigger jsonb not null default '{}'::jsonb,
  action jsonb not null default '{}'::jsonb,
  caps jsonb not null default '{"per_run":10,"per_day":20}'::jsonb,
  priority int default 100,
  last_run_at timestamptz, notes text
);

-- 룰 실행 원장(레이더 radar_runs 패턴).
create table crm_rule_runs (
  id bigint generated always as identity primary key,
  rule_id bigint references crm_rules(id),
  started_at timestamptz default now(),
  matched int default 0, drafted int default 0, skipped_suppressed int default 0,
  skipped_capped int default 0, errors text
);

-- 접촉 원장 — 시스템의 심장. 방향·채널 불문 모든 접촉 1행.
create table crm_touches (
  id bigint generated always as identity primary key,
  contact_id bigint not null references crm_contacts(id),
  direction text not null check (direction in ('out','in')),
  channel text not null check (channel in ('gmail','form','dm','manual','import','system')),
  kind text not null check (kind in ('first','followup','reply_in','reply_out','auto_reply_in','bounce','unsub','note')),
  rule_id bigint references crm_rules(id),
  offer_id bigint references crm_offers(id),
  draft_id bigint,                      -- crm_drafts FK(순환 회피 위해 제약 없이 논리 참조)
  subject text, snippet text,           -- snippet ≤ 300자(레이더 규약과 동일)
  gmail_message_id text, gmail_thread_id text,
  happened_at timestamptz not null default now(),
  meta jsonb default '{}'::jsonb
);
create index crm_touches_contact on crm_touches (contact_id, happened_at desc);
create index crm_touches_thread on crm_touches (gmail_thread_id) where gmail_thread_id is not null;

-- 발송 초안(아웃박스). 상태기계:
--   proposed --승인(P2)--> approved(Gmail 초안 생성됨, 오너가 Gmail에서 전송)
--   proposed --승인·발송(P3, system_send_enabled)--> queued --크론 집행--> sent | failed
--   proposed --> rejected
create table crm_drafts (
  id bigint generated always as identity primary key,
  contact_id bigint not null references crm_contacts(id),
  rule_id bigint references crm_rules(id),
  offer_id bigint references crm_offers(id),
  template_id bigint references crm_templates(id),
  kind text not null default 'first' check (kind in ('first','followup','reply')),
  subject text not null, body text not null,
  status text not null default 'proposed' check (status in ('proposed','approved','queued','sent','rejected','failed')),
  created_by text not null default 'rule' check (created_by in ('rule','manual','ai')),
  scheduled_for timestamptz,            -- 발송 윈도우 계산 결과(KR 08–21 KST 등). 집행 시 재계산(§10-3)
  gmail_draft_id text, sent_message_id text, gmail_thread_id text,  -- thread_id는 초안 생성 응답에서 즉시 저장(§5-6-C)
  error text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index crm_drafts_status on crm_drafts (status, created_at desc);

-- 수신 메시지(인박스). Gmail 동기화가 적재, 분류기가 채운다(§5-7).
create table crm_inbound (
  id bigint generated always as identity primary key,
  contact_id bigint references crm_contacts(id),   -- 매칭 실패 시 null(수동 연결)
  gmail_message_id text not null unique, gmail_thread_id text,
  from_email text not null, subject text, snippet text,
  classified_as text check (classified_as in ('positive','question','negative','unsubscribe','bounce','auto_ooo','unmatched')),
  auto_draft_id bigint,                 -- 생성된 자동응답 초안
  handled boolean not null default false,
  received_at timestamptz not null, created_at timestamptz default now()
);

-- 수신거부·차단 목록 — 발송 경로의 하드 게이트(§10-2). 절대 삭제하지 않는다.
create table crm_suppression (
  id bigint generated always as identity primary key,
  email text, domain text,              -- 둘 중 하나 필수(체크는 앱 레벨)
  reason text not null check (reason in ('unsubscribe','bounce','complaint','manual','legal')),
  source text,                          -- 어떤 경로로 알게 됐나 (complaint는 수동 등록 — Postmaster Tools 확인 SOP §5-9)
  added_at timestamptz default now()
);
create unique index crm_suppression_email_uq on crm_suppression (lower(email)) where email is not null;
create unique index crm_suppression_domain_uq on crm_suppression (lower(domain)) where domain is not null;

-- 서치 봇 후보 큐. scout·radar·LLM 리서치·수동이 적재, 사람이 심사(§5-8).
create table crm_candidates (
  id bigint generated always as identity primary key,
  source text not null check (source in ('scout','radar','research','manual')),
  segment_guess text references crm_segments(code),
  name text, org_name text not null, country text,
  email_found text, contact_url text,
  evidence_url text not null,           -- 반드시 공개 게시처 URL(LIA)
  evidence_snippet text,
  status text not null default 'new' check (status in ('new','approved','rejected','merged')),
  promoted_contact_id bigint references crm_contacts(id),
  found_at timestamptz default now(),
  dedup_key text                        -- lower(email) 또는 lower(domain)+lower(name)
);
create index crm_candidates_status on crm_candidates (status, found_at desc);

-- scout 소스 레지스트리 — 공식 Contact/Press 페이지만. 컨택DB 템플릿 '소스리스트' 111행이 시드.
create table crm_sources (
  id bigint generated always as identity primary key,
  url text not null unique, org_name text, segment_code text references crm_segments(code),
  country text, is_kr boolean not null default false,   -- true면 자동수집 제외. 판정 규칙 §5-8-A
  robots_ok boolean, last_scanned_at timestamptz, next_scan_at timestamptz,
  fail_count int default 0, status text not null default 'active' check (status in ('active','paused','dead')),
  notes text
);

-- 설정 싱글턴 — 발송 규율의 데이터화(§5-9). 0101이 기본 행 시드.
create table crm_settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- 임포트 배치 원장.
create table crm_import_batches (
  id bigint generated always as identity primary key,
  filename text not null, source_kind text,
  rows_total int, rows_imported int, rows_deduped int, rows_skipped int,
  mapping jsonb, created_at timestamptz default now()
);

-- 전 테이블 service-role 전용.
alter table crm_orgs enable row level security;
alter table crm_segments enable row level security;
alter table crm_contacts enable row level security;
alter table crm_offers enable row level security;
alter table crm_templates enable row level security;
alter table crm_rules enable row level security;
alter table crm_rule_runs enable row level security;
alter table crm_touches enable row level security;
alter table crm_drafts enable row level security;
alter table crm_inbound enable row level security;
alter table crm_suppression enable row level security;
alter table crm_candidates enable row level security;
alter table crm_sources enable row level security;
alter table crm_settings enable row level security;
alter table crm_import_batches enable row level security;
```

`0101_crm_seed.sql` 내용:
1. **세그먼트**: §6-a — 클러스터 14행(A–N) + 그룹 52행(맵의 48 + N1~N4) = 66행.
2. **오퍼**: §6-b 표 41행을 **1:1 insert**(변형·요약 금지). 같은 segment_code 안에서는 depth deep→light 순으로 sort.
3. **템플릿**: 운영설계 §7-A~E의 5종(kind='first' — 학계용 §7-D는 `non_commercial=true`) + 팔로업 1종 + 응답 감사 1종 = 7행. 본문에 `{{metatake_url}}` 자리 포함.
4. **설정 기본 행**:
```sql
insert into crm_settings (id, data) values (1, '{
  "daily_send_cap": 20, "weekly_send_cap": 10, "per_cron_send_cap": 5,
  "system_send_enabled": false,
  "kr_window": {"start": 8, "end": 21, "tz": "Asia/Seoul"},
  "followup_max": 2,
  "bounce_rate_threshold": 0.05, "bounce_rate_window": 50,
  "gmail_account": null, "gmail_sync_cursor": null,
  "physical_address": null, "lia_doc_path": null,
  "unsubscribe_line": {"en": "If you prefer not to hear from us, just reply with \"unsubscribe\" and we will never email you again.", "ko": "수신을 원치 않으시면 \"수신거부\"라고 회신해 주세요. 즉시 그리고 영구히 중단합니다."}
}'::jsonb);
```
   `weekly_send_cap=10`은 기존 백링크 아웃리치 주 10통 관행(§2-b)의 승계 — 초기에는 이것이 실효 상한이다.
5. **기본 룰 3종**(전부 enabled=false). offer_id/template_id는 identity라 시드가 미리 알 수 없다 — **시드 시점에 서브쿼리로 해석**한다:
```sql
insert into crm_rules (name, enabled, match, trigger, action, caps) values
('첫 접촉 — C1 트레이드매체', false,
 '{"segment_codes":["C1"],"stages":["none"],"require_email":true}',
 '{"kind":"stage_age","days_since_last_touch":0,"max_total_touches":2}',
 jsonb_build_object('kind','create_draft','draft_kind','first',
   'offer_id',(select id from crm_offers where segment_code='C1' and depth='deep' order by sort limit 1),
   'template_id',(select id from crm_templates where kind='first' and segment_code is null limit 1)),
 '{"per_run":10,"per_day":10}'),
('팔로업 1회 — 전체', false,
 '{"stages":["first_sent"],"require_email":true}',
 '{"kind":"stage_age","days_since_last_touch":7,"max_total_touches":2}',
 jsonb_build_object('kind','create_draft','draft_kind','followup',
   'template_id',(select id from crm_templates where kind='followup' limit 1)),
 '{"per_run":10,"per_day":10}'),
('휴면 재접촉 — 오너 보류분만', false,
 '{"stages":["parked"],"parked_reason":"owner","require_email":true}',
 '{"kind":"stage_age","days_since_last_touch":60,"max_total_touches":2}',
 jsonb_build_object('kind','create_draft','draft_kind','followup',
   'template_id',(select id from crm_templates where kind='followup' limit 1)),
 '{"per_run":5,"per_day":5}');
```
   ⚠️ `parked_reason='negative_reply'`(거절 응답) 컨택은 **어떤 룰로도 재접촉하지 않는다** — 휴면 룰의 match가 'owner'로 제한된 이유.

감사 로그는 신설하지 않는다 — 기존 `logContentEvent()`(→`content_events`)를 `entityType:'crm_contact'|'crm_draft'|...`로 재사용한다(하우스 패턴).

RPC는 2개(둘 다 `security definer` + service_role 전용 grant + `set statement_timeout '8s'`):

```sql
-- 대시보드 집계 1콜. 반환 jsonb 계약(§5-1과 1:1):
-- { "queues":  {"proposed":n, "unhandled_inbound":n, "new_candidates":n, "due_actions":n},
--   "funnel":  {"none":n,"first_sent":n,"followup":n,"replied":n,"negotiating":n,"won":n,"parked":n,"unsubscribed":n,"bounced":n},
--   "clusters":[{"code":"A","contacts":n,"sent":n,"replied":n}, ...],   -- 클러스터(1글자 code)별
--   "hygiene": {"bounce_rate":x, "unsubs":n, "suppression":n, "sent_7d":n} }
create or replace function crm_dashboard_stats() returns jsonb
  language sql stable security definer as $$ ... $$;

-- 후보 승격 원자화. lower(email)이 기존 컨택과 충돌하면 insert하지 않고
-- 기존 contact id를 반환하며 후보를 status='merged'로 마킹한다(예외를 던지지 않는다).
-- email이 suppression에 있으면 예외를 던진다(승격 자체 거부).
create or replace function crm_promote_candidate(p_id bigint, p_segment text) returns bigint
  language plpgsql security definer as $$ ... $$;
```

---

## §5. 기능 스펙

### 5-1. 대시보드 `/crm`

**의도**: "시스템이 지금 나 대신 무엇을 준비해 뒀고, 내가 오늘 무엇을 결정해야 하나"를 30초 안에 파악.

구성(위→아래) — 데이터는 `crm_dashboard_stats()` 1콜(§4의 jsonb 계약):
- **액션 큐 4타일**(각각 해당 페이지로 링크): 검토 대기 초안(queues.proposed) · 미처리 응답(queues.unhandled_inbound) · 심사 대기 후보(queues.new_candidates) · 오늘 예정 액션(queues.due_actions).
- **파이프라인 퍼널**: funnel의 stage별 컨택 수. 가로 막대, 숫자 병기.
- **세그먼트 현황 표**: 클러스터 A–N별 contacts/sent/replied + 응답률(계산은 프론트).
- **위생 지표**: hygiene — 반송률·수신거부·suppression·최근 7일 발송 수(주간 캡 대비). 운영설계 §10 "보낸 수가 아니라 도달·응답·전환을 본다". 반송률이 `bounce_rate_threshold` 초과면 **빨간 배너**(발송 자동 차단 상태 표시, §5-9).
- **최근 활동 20행**: `crm_touches` 최신순.

오픈율·클릭 추적은 **⛔ 의도적 미구현** — 1:1 메일에 트래킹 픽셀은 도달률·신뢰를 깎는다. 응답률과 반송률이 유일한 진실 지표. (P6 외부 툴 단계에서 툴 자체 지표로 대체.)

### 5-2. 컨택 DB `/crm/contacts` · `/crm/contacts/[id]`

**의도**: 2,384행에서 시작해 수천 행까지, "다음에 누구에게 무엇을"이 항상 필터 한 번으로 나오는 작업대.

리스트: 서버 컴포넌트 + `searchParams` 필터(하우스 규약 — `useSearchParams` 금지). 필터: segment(클러스터/그룹), stage, jurisdiction, kr_law_flag, verify_status, 이메일 유무, tag, 텍스트 검색(`org_name`/`name`/`email` — pg_trgm 인덱스). 페이지당 100행. 일괄 작업(체크박스 + 서버 액션): 태그 부여 / stage 변경(negotiating·won은 여기와 상세에서만 — 수동 전용) / 세그먼트 이동 / suppression 추가.

상세 `[id]`:
- 헤더: 이름·조직·역할·국가·관할권 배지. **KR과 CA는 경고 배지**(KR "옵트인 필요·(광고) 표기·야간 금지", CA "CASL — 동의 우선") + consent_status 표시. LIA 3필드(source_url 링크·수집일·법적근거) — **누락 또는 legal_basis='기타'면 노란 경고 박스 "초안 생성 불가: 출처 증빙 미기록"**.
- **이력 타임라인**: `crm_touches` 시간역순 — 방향 아이콘(→/←), kind, 제목, 스니펫, Gmail 스레드 링크.
- **Metatake 페이지 링크(`metatake_url`)**: 입력 필드 + [사이트에서 찾기] 버튼(figures/films를 name으로 pg_trgm 검색해 후보 5개 제시 — 실패 시 무해). **이 링크가 가장 강한 개인화 재료다** — 템플릿의 `{{metatake_url}}`에 주입된다.
- **매칭 오퍼 패널**: 이 컨택의 segment_code에 걸린 `crm_offers`를 depth순으로 표시. 각 오퍼에 [이 오퍼로 초안 작성] 버튼 → 초안 컴포저.
- **초안 컴포저**: 템플릿 선택 → 플레이스홀더 자동 채움({{name}}, {{org}}, {{metatake_url}}) → `{{personal_line}}`(개인화 1~2줄)은 오너 수기 또는 [AI 제안] 버튼(ANTHROPIC_API_KEY, 실패 시 빈칸 — §11-4) → 저장 시 `crm_drafts(status='proposed', created_by='manual')`. E·G 세그먼트 컨택에 non_commercial=false 템플릿을 고르면 차단 경고(§10-5b).
- 수동 접촉 기록 폼: 시스템 밖 접촉(폼 제출·DM 등)을 원장에 남김. **기본 kind='note'**(stage 불변). 실제 아웃리치를 기록할 때만 셀렉터로 kind='first'|'followup'|'reply_out' 선택 — 이 경우 stage·last_touch_at도 갱신.
- **[개인정보 삭제(GDPR)] 액션**: 확인 다이얼로그 → ① email을 `crm_suppression(reason='legal')`에 등록 ② crm_contacts의 인적 필드(name·email·alt_emails·role_title·owner_notes) null/익명화 ③ 해당 컨택의 touches·inbound에서 name·snippet 스크럽(집계용 행 자체는 보존) ④ `logContentEvent` 기록. suppression에 남는 이메일 1건은 재발송 방지를 위한 적법 보존 예외로 문서화(§10-15).

### 5-3. 세그먼트·오퍼 `/crm/segments` · `/crm/offers`

**의도**: 터치포인트 맵(전략)과 컨택 DB(실행)를 잇는 다리. "이 그룹에 왜 가는가(명분) → 무엇을 제안하나(오퍼) → 누가 있나(컨택) → 기계가 뭘 하고 있나(룰)"가 한 페이지에. **카테고리는 계속 늘어난다는 것이 전제다** — 시드는 출발점일 뿐.

`/crm/segments`: A–N 클러스터 카드(name_ko, rationale 요약, 컨택 수, 응답률, priority). **그룹 CRUD**(서버 액션): 신규 그룹 추가(code — 형식 검증 `^[A-Z]{1,2}\d{0,2}$`, parent_code, name_ko, rationale, touch_types, priority), 수정, 소프트 은퇴(status='retired' — 컨택·오퍼·룰이 참조하므로 하드 삭제 금지). 신규 code는 시드된 A–N 트리 밖으로 자유 확장 가능(예: 새 클러스터 O). **임포트 매핑 화면·후보 승격 피커·룰 편집기는 전부 live crm_segments를 읽는다** — 새 카테고리는 등록 즉시 전 시스템에서 사용 가능.

클릭 → `[code]` 상세: 소속 그룹 트리, 그룹별 컨택 리스트 링크, 걸려 있는 오퍼·룰·템플릿, 세그먼트 성과(발송/응답/성사).

`/crm/offers`: 전 오퍼 표(segment, depth 배지, title, coupling) + CRUD(서버 액션). 오퍼는 소프트 삭제(status='retired') — 과거 touches가 참조하므로 하드 삭제 금지.

### 5-4. 임포트 `/crm/import`

**의도**: 이미 확보한 2,384행(§2-a)을 **한 번에, 중복 없이, 출처 보존하며** 넣는다. 이후로도 새 리서치 CSV가 생길 때마다 같은 문으로 들어온다.

A. **파서**: 클라이언트 컴포넌트에서 `papaparse`(CSV)·`xlsx`(엑셀) — 둘 다 이미 의존성에 있음. 시트 선택 → 헤더 미리보기 100행.

B. **매핑 프리셋**: `lib/crm/importPresets.ts`에 아래 4종을 상수로 내장(+ "수동 매핑" 폴백). 프리셋은 컬럼→필드 매핑과 세그먼트 규칙을 포함하며, **세그먼트 규칙은 화면에서 오너가 수정 가능**(live crm_segments 피커):

| 프리셋 | 소스 → crm_contacts 매핑 요지 | 세그먼트 규칙(기본값 — 소스 카테고리 전수 커버) |
|---|---|---|
| `academia` (학계_평론가 1,394) | 카테고리→segment 규칙표, 이름/매체→name, 소속/플랫폼→org_name, 공개이메일→email, 공식/프로필URL→source_url, 관할권 직매핑, KR법유의→kr_law_flag | 19종 전수: 학계→E1 · 대학원→E1 · 사서→E2 · 학회/저널→E3 · 학술지→E3 · 영화교육→G1 · Substack→D1 · 블로거→D1 · 크리에이터→D2 · 평론가→C1 · 에디터→C1 · 영화제프로그래밍→K3 · 시네마테크/극장→K4 · 미디어아트/협동조합→K4 · 필름커미션→F2 · 영화기관→F1 · 시네클럽→D5 · 시네필커뮤니티→D5 · 영상번역/자막→H2 |
| `trade` (트레이드매체 641) | 기관/매체→org_name, 공개이메일→email(세미콜론 분해: 첫 값→email, 나머지→alt_emails), 공식페이지URL→source_url, KR법유의→kr_law_flag | 매체유형 7종 전수: 트레이드→C1 · 온라인매체→C1 · 일간지문화부→C1 · 잡지→C1 · 리뷰비평→C1 · 방송→M1 · 팟캐스트유튜브→D3 |
| `magazine` (magazine-contacts 288) | outlet_id→crm_orgs FK(allowlist 신본을 먼저 crm_orgs로), person_name→name, email=='unknown'→null, source_url 직매핑, last_verified→collected_at | contact_type 8종 전수: editorial→C1 · press→C1 · general→C1(비고 general 표기) · partnerships→C2 · syndication→C2 · licensing→C2 · advertising→C1(비고 '광고 창구' — C1 광고 구매 오퍼의 진입로) · marketing→C1 |
| `contactdb` (컨택DB 61) | 운영설계 §5 필드 1:1(원형이므로 무손실) | 세그먼트 3종 전수: 영화제→K3 · 트레이드매체/기자→C1 · 배급/제작사→K2 |

공통 규칙: `KR법유의=Y` 또는 관할권=한국 → jurisdiction='KR' + kr_law_flag=true.

C. **Dedup 파이프라인**(적재 전 dry-run 리포트 필수 — blog-send.py의 DRY-first 사다리 하우스룰):
1. `lower(email)` 정확 일치 → 기존 행에 **병합**(빈 필드만 채움, source_url은 보존, 신규 태그 추가).
2. email 없으면 `lower(org_name)+lower(name)` 일치 → 병합 후보로 리포트(자동 병합 금지, 화면에서 확인).
3. 조직 연결: email 도메인을 추출해 `crm_orgs.domain`과 매칭 — 단 **프리메일 차단 목록**(gmail.com, yahoo.*, outlook.com, hotmail.com, naver.com, daum.net, protonmail.com, icloud.com 등)의 도메인은 org를 만들지도 매칭하지도 않는다(가짜 "gmail.com 조직" 방지). 프리메일 행의 org 연결은 org_name pg_trgm 유사도 제안 → 수동 확인만.
4. 리포트 화면: 신규 N / 병합 N / 보류 N → [적재 실행] → `crm_import_batches` 기록. touches에 임포트 흔적 행은 남기지 않는다(원장 오염 방지 — batch_id로 충분).

D. **재대사(reconcile) 모드**: 기발송 이력 흡수용. ① Gmail 발신함 소급 동기화(§5-6-D — 초기 1회는 소급 기간을 인자로, 기본 60일·필요시 확대)가 `from:me` 매칭으로 stage를 `first_sent`로 올린다(건수는 재대사 리포트가 산출 — "18건"은 초안 기준이라 실발송 수는 보낸편지함이 진실). ② OUTREACH 실행현황 문서가 커밋되면 그 안의 발송 리스트를 수동 임포트(kind='first' touches 생성). **이 재대사가 끝나기 전에는 룰 엔진을 켜지 않는다(§10-6) — 중복 발송 방지.**

E. 소스리스트 111행·allowlist 150행은 컨택이 아니라 `crm_sources`·`crm_orgs`로 각각 임포트(별도 프리셋 2종). sources 프리셋은 **is_kr을 country=='한국' 또는 URL 호스트가 `.kr/.co.kr/.or.kr`로 끝나는지로 자동 판정**해 채운다(§10-3).

### 5-5. 스케줄링 룰 엔진 `/crm/rules` + 크론

**의도**: "각 그룹에 컨택이력을 중심으로 새로운 오퍼를 만들어낸다"의 구현. 오너가 자는 동안 기계가 **다음에 보낼 것**을 계산해 초안 큐에 쌓아 두면, 아침에 오너가 승인만 한다.

A. **크론 배선**: `vercel.json`에 `{ "path": "/api/crm/cron", "schedule": "0 * * * *" }`(매시) 추가. 라우트는 하우스 패턴 그대로: `x-vercel-cron` 헤더 or `?key=REVALIDATION_SECRET` or `getAdminUser()` 3중 인증, 20분 최소간격 마커 가드, `export const maxDuration = 300`, 잡별 try/catch 격리(insights 크론의 피기백 구조 복제). 피기백 잡 순서:
① 룰 평가(아래 C) → ② Gmail 동기화(§5-6-D — 발신함+수신함, 런당 최대 100 메시지, `crm_settings.data.gmail_sync_cursor`로 증분) → ③ 인바운드 분류(§5-7) → ④ next_action_at 도래 컨택 플래그 → ⑤ **(P3, system_send_enabled=true일 때만) 발송 집행**: `status='queued' and scheduled_for<=now()` 초안을 per_cron_send_cap(5)·daily_send_cap(20)·**weekly_send_cap(10)** 한도 내에서 `sendDraft()` — 발송 직전 suppression·stage·KR 윈도우 재검사(§10-2·§10-3), 반송률 서킷브레이커 검사(§5-9).

B. **룰 계약**(jsonb — UI는 이 계약의 폼일 뿐). trigger.kind는 **P3에서 'stage_age' 하나만 구현**한다(no_reply·date 등 추가 kind는 ⛔ 의도적 미구현 — 필요해지면 오너가 결정):

```jsonc
// match: 어떤 컨택이 대상인가
{ "segment_codes": ["C1","C2"],        // 생략 시 전체
  "jurisdictions": ["US","EU"],        // 생략 시 전체(단 KR·CA는 하드 필터가 동의 없으면 제외)
  "stages": ["none"],
  "parked_reason": "owner",            // stages에 parked가 있을 때만 의미
  "require_email": true, "exclude_tags": ["hold"] }
// trigger
{ "kind": "stage_age",
  "days_since_last_touch": 7,          // last_touch_at(없으면 created_at) 이후 경과일 >= 값
  "max_total_touches": 2 }             // 아웃바운드 실접촉 수 상한: count(crm_touches where direction='out'
                                       //   and kind in ('first','followup')) < 값. note는 세지 않는다.
// action
{ "kind": "create_draft", "draft_kind": "first|followup",
  "offer_id": 12, "template_id": 3 }
// caps
{ "per_run": 10,                       // 이 룰이 크론 1회에 만들 최대 초안 수
  "per_day": 20 }                      // 이 룰이 오늘 만든 crm_drafts 수(rule_id 기준, created_at::date=today) 상한
```

C. **평가기**(`lib/crm/rules.ts`, 크론 잡 ①): enabled 룰을 priority순으로. 각 룰마다 —
1. match 조건으로 컨택 질의 + **하드 필터(모든 룰에 무조건 적용)**:
   - suppression 이메일/도메인 제외
   - `stage in ('replied','negotiating','won','unsubscribed','bounced')` 제외 — **응답이 온 컨택은 룰이 아니라 사람이 다룬다**
   - `parked_reason='negative_reply'` 제외(영구)
   - LIA 미비 제외: source_url·collected_at·legal_basis 중 하나라도 null이거나 legal_basis='기타'
   - **jurisdiction in ('KR','CA')이고 consent_status≠'granted'면 제외**(CA는 오너가 CASL 예외 근거를 owner_notes에 기록하고 tag 'casl-exempt'를 단 경우만 통과)
   - 세그먼트가 E*·G*인데 action의 template이 non_commercial=false면 룰 자체를 에러 스킵(§10-5b)
   - 이미 `proposed|approved|queued` 초안이 있는 컨택 제외
   - `max_total_touches`는 `min(rule값, settings.followup_max + 1)`로 클램프(설정이 글로벌 천장)
2. 통과분에 대해 cap까지 초안 생성: 템플릿 렌더 → `crm_drafts(status='proposed', created_by='rule')`. `scheduled_for`는 발송 윈도우 계산(KR: Asia/Seoul 08–21시 안으로; 그 외: 관할권별 고정 오프셋 테이블로 화–목 오전 근사. 정밀 타임존은 ⛔ 미구현). **집행 시점(잡 ⑤)에 윈도우를 재검증**하므로 밀린 발송이 금지 시간대에 나가는 일은 없다.
3. `crm_rule_runs`에 matched/drafted/skipped_* 기록.

**룰은 발송하지 않는다. 초안을 만들 뿐이다.** 발송은 잡 ⑤(옵트인)와 사람 승인의 몫(§10-1).

### 5-6. 발송 파이프라인 — Gmail 연동 `/crm/outbox`

**의도**: 지금 실제로 쓰는 채널(Gmail 수동 초안)을 그대로 시스템화한다. 도달률과 계정 신뢰를 지키기 위해 **소량·수동승인·개인 계정** 원칙에서 출발하고, 규모는 P6 외부 툴로 푼다.

A. **OAuth 셋업(오너 1회, P2 선행조건)** — `/crm/settings`에 체크리스트로 표시:
1. GCP 콘솔 → 새 프로젝트 → Gmail API enable.
2. OAuth 동의화면: External로 만들고 발송 계정을 테스트 사용자로 추가한 뒤, **반드시 "PUBLISH APP"으로 In production 전환** — ⚠️ Testing 상태의 refresh token은 **7일 만료**라 주 1회 파이프라인이 죽는다. 미검증 프로덕션 앱은 본인에게 경고 화면이 한 번 뜰 뿐(1인 내부 도구로 허용 범위). scope가 sensitive라 검증 요구가 떠도 개인 사용에는 차단 없음.
3. 클라이언트 ID(데스크톱 앱) 생성 → `GMAIL_CLIENT_ID`/`GMAIL_CLIENT_SECRET`.
4. `worker/gmail-auth.py`(신규, stdlib only): 로컬 루프백 OAuth 플로우로 **refresh token** 1회 발급 — scopes `gmail.compose gmail.readonly`. `gmail.compose`가 drafts 생성·`drafts.send`까지 허용하므로 **P3에서 재동의 불필요**. 토큰을 `.env.local`(`GMAIL_REFRESH_TOKEN`)과 Vercel env에 저장.
5. 발송 계정 결정은 §11-1(기본값: 기존 아웃리치에 쓰던 Gmail 계정).

B. **Gmail REST 클라이언트**(`lib/crm/gmail.ts`, 신규 — **googleapis 패키지 도입 금지**, fetch로 직접):
- `refreshAccessToken()`: POST `https://oauth2.googleapis.com/token` (refresh_token grant). 액세스 토큰은 모듈 메모리 캐시(만료 5분 전 갱신). **invalid_grant 응답이 오면 settings에 오류 플래그를 세워 `/crm` 상단 빨간 배너로 표시**(토큰 재발급 필요 신호).
- `createDraft(to, subject, body, threadId?)`: RFC822 MIME 조립(quoted-printable UTF-8) → base64url → POST `/gmail/v1/users/me/drafts`. **응답의 `message.threadId`를 즉시 `crm_drafts.gmail_thread_id`에 저장** — 초안이 전송되면 메시지 id는 바뀌지만 threadId는 불변이라 이것이 발송 감지의 키다.
- `sendDraft(draftId)`: POST `/gmail/v1/users/me/drafts/send` (P3 잡 ⑤에서만 호출).
- `listMessages(q)`, `getMessage(id, format='metadata')`: 동기화용.
- 전 호출 지수 백오프 재시도 2회, 429/5xx 이외 즉시 실패 기록.

C. **아웃박스 상태기계**(`/crm/outbox` 페이지 + 서버 액션):
- `proposed` 리스트: 룰/수동/AI가 만든 초안. 카드에 컨택 요약 + LIA·관할권 배지 + 렌더된 본문(컴플라이언스 푸터 포함 — 렌더러가 강제) + KR 컨택이면 현재 시각의 윈도우 경고. [수정] [승인] [거부].
- **P2 모드(기본)**: [승인] → `createDraft()` → Gmail 초안 생성, status='approved', gmail_draft_id·gmail_thread_id 저장 → **오너가 Gmail 앱에서 마지막 확인 후 직접 전송**.
- **P3 모드(옵트인)**: settings에서 system_send_enabled를 켜면 [승인·발송] 버튼 활성 → status='queued' → 크론 잡 ⑤가 scheduled_for 도래분을 캡 한도 내 `sendDraft()` → sent|failed.
- 발송 감지(P2·P3 공통, 동기화 잡): `in:sent`를 **threadId로 매칭**해 해당 초안을 status='sent' 처리 + touches(kind=draft.kind, direction='out') + stage 전이(none→first_sent, first_sent→followup) + last_touch_at 갱신. (수신자 이메일 매칭은 소급 재대사에서만 폴백으로 쓰고, 폴백 매칭 건은 수동 확인 플래그를 단다 — 같은 주소로 보낸 사적 메일 오인 방지.)
- 발송 직전 최종 게이트(잡 ⑤): suppression 재조회 + stage 재확인 + KR 윈도우 재계산 — 승인 후 수신거부가 들어온 경우를 막는다(§10-2).

D. **동기화 잡**(크론 잡 ②): `listMessages('in:sent newer_than:3d')` + `listMessages('in:inbox newer_than:3d')` → 메타(From/To/Subject/threadId/internalDate)를 threadId·이메일로 매칭 → sent는 위 발송 감지, inbox는 `crm_inbound` 적재(§5-7로). 매칭 실패 inbox 메시지는 `classified_as='unmatched'`. 런당 100 메시지 상한 + `gmail_sync_cursor`(마지막 internalDate) 증분 — 초기 소급(기본 60일, 인자로 확대 가능)도 몇 번의 크론 런에 걸쳐 완주된다.

### 5-7. 인바운드·룰베이스 자동응답 `/crm/inbox`

**의도**: 응답이 시작되면 병목은 "답장 쓰기"로 이동한다. 분류와 초안까지 기계가, 전송 판단은 사람이.

분류기(`lib/crm/classify.ts` — **룰베이스 우선, LLM은 폴백**). 컨택 매칭된 메시지에 순서대로 적용:

| 순서 | 규칙(대소문자 무시, 제목+스니펫) | classified_as | 자동 액션 |
|---|---|---|---|
| 1 | from에 `mailer-daemon|postmaster` 또는 제목 `delivery status|undeliverable` | bounce | verify_status='bounced', stage='bounced', touches(kind='bounce') |
| 2 | `unsubscribe|remove me|opt.?out|stop email|수신거부|구독.?취소` | unsubscribe | **suppression insert(reason='unsubscribe') + stage='unsubscribed'** + touches(kind='unsub'). 자동응답 없음 — 즉시 영구 중단 |
| 3 | `out of office|자동 응답|autoreply|vacation` | auto_ooo | next_action_at += 7일 (stage 불변) |
| 4 | `not interested|no thank|관심 없` | negative | **stage='replied' 경유 없이 곧장 'parked', parked_reason='negative_reply'**(영구 룰 제외), touches(kind='reply_in') |
| 5 | 나머지 | positive 또는 question | **stage in ('first_sent','followup')이면 stage='replied'로 전이** + touches(kind='reply_in') + **자동응답 초안 생성** → crm_drafts(kind='reply', status='proposed', created_by='rule') — 템플릿: 감사 + 세그먼트 오퍼 1줄 재확인 + 구체 CTA(데모/자료/통화). inbound.auto_draft_id 연결 |

5번의 positive/question 세분류만 LLM 1콜(선택, §11-4) — 실패 시 'question'으로 두고 사람이 본다. **자동응답도 초안일 뿐 자동 전송되지 않는다.** stage='negotiating'/'won'으로의 전이는 언제나 수동(§5-2). `/crm/inbox`는 handled=false 목록 → 각 행에서 [초안 검토](아웃박스 카드 인라인) / [수동 연결] / [처리 완료].

### 5-8. 서치 봇 `/crm/research` + `worker/crm-scout.py`

**의도**: "한 쪽에서는 새로운 접점을 찾는 봇이 돌아다닌다" — 단, 운영설계가 그은 선 안에서. **봇은 공식 Contact/Press 페이지만, 후보까지만, 한국 도메인은 건드리지 않는다.** 사람 승인 없이 컨택이 되는 경로는 없다.

4개 레인:

A. **Scout 워커**(`worker/crm-scout.py`, 신규 — 워커 규약은 §2-b: stdlib only, `.env.local`, `hourly/pipeline/common.py` 재사용, flock은 `produce.py` 패턴):
- 입력: `crm_sources` where status='active' and (next_scan_at is null or next_scan_at<=now) and **is_kr=false**, 1회 최대 30 소스.
- **KR 이중 방어**: 저장된 is_kr 플래그와 무관하게, **요청 직전 호스트를 재검사**한다 — 호스트가 `.kr/.co.kr/.or.kr`로 끝나거나 source.country가 한국이면 fetch 자체를 건너뛰고 is_kr=true로 백필. 링크 추적으로 도달한 페이지도 동일 검사(깊이 1이라도 KR 호스트면 이메일 추출 금지).
- 소스당: `urllib.robotparser`로 robots.txt 확인(불허 시 robots_ok=false, 스킵) → 해당 URL 1페이지 fetch(UA `MetatakeBot/1.0 (+https://metatake.net/bot)`) → 같은 호스트의 `/contact|/press|/about` 링크 최대 3개 추가 fetch(**깊이 1, 사이트 크롤 아님**) → `mailto:` + 가시 텍스트 이메일 정규식 + 문의 폼 URL 추출.
- 산출: `crm_candidates(source='scout', evidence_url=발견 페이지, evidence_snippet=주변 텍스트 200자, dedup_key)`. 기존 컨택/후보/suppression과 dedup_key 일치 시 적재 생략.
- 예의: 호스트당 2초 간격, 소스당 총 4요청 상한, next_scan_at=+30일, 3연속 실패 시 status='dead'.
- 실행: Mac에서 `run-crm-scout.command`(더블클릭) 또는 `/crm/research`의 [스캔 실행] 버튼 → **`worker/factory-watch.sh`의 큐 클레임 패턴**(queued 행 원자적 claim) 복제로 Mac 워처가 집어간다. Vercel에서 실행하지 않는다(장시간·외부 fetch — 하우스 원칙: 무거운 건 Mac).

B. **레이더 브리지**(크론 피기백, SQL 1개): `radar_items`에서 author_kind='institution'이고 아직 후보/컨택에 없는 신규 발화 주체를 주 1회 `crm_candidates(source='radar')`로 밀어 넣는다 — 키워드 레이더가 "Metatake 관련 신호를 낸 기관"을 이미 잡고 있으므로, **응답 확률이 가장 높은 웜 리드 공급선**이다. **KR 도메인·한국 계정은 제외**(§10-3).
- ⚠️ 정확한 컬럼 매핑은 구현 시점에 `radar_items` 실스키마를 확인해 작성(§12의 레이더 정본 필독). 매칭 실패 시 이 레인은 스킵 가능 — P5 완료 조건이 아니다.

C. **LLM 리서치 레인**(코드 아님, 운영 절차): 새 세그먼트 리스트가 필요할 때 `magazine research agent/` 스킬 SOP(robots 실확인·evidence URL 필수·`unknown` 규약·파일럿 5건 게이트)로 리서치 세션을 돌리고, 산출 CSV를 `/crm/import`의 수동 매핑으로 `crm_candidates`(또는 검증 완료분은 바로 contacts)에 넣는다. 학계 1,394행을 만든 검증된 방법론이다.

D. **영화 관계자 수동 레인(N 클러스터 전용 — 자동화 금지)**: 크레딧 인물(§6-a N)의 연락처는 scout가 아니라 **오너의 수동 리서치**로만 들어온다. 채널 우선순위(2026-07-15 IMDbPro 검토 대화 반영):
- **below-the-line 크루·인디 감독(N1·N2)**: 개인 포트폴리오 사이트의 공개 비즈니스 문의처, 길드 공개 디렉토리(ASC 등), Stage 32 — 게이트키퍼가 없고 진지한 비평에 대한 감사가 가장 크다. **여기부터 시작한다.**
- **퍼블리시스트(N3)**: IMDbPro(월 ~$20 구독, §11-6)의 인물 페이지 "Publicist" 필드 — 에이전트가 아니라 퍼블리시스트다(커버리지를 원하는 쪽). 페스티벌 프레스 킷의 홍보 연락처도 동급 소스.
- **금지**: IMDbPro·LinkedIn의 자동 수집/대량 추출(양쪽 다 약관 위반 + GDPR 리스크) — 건별 수동 조회·기록만. 에이전시 대표번호로의 콜드 발송은 하지 않는다(도달 확률 0에 가까움).
- 입력 방법: `/crm/research`의 [수동 후보 추가] 폼(source='manual', evidence_url 필수) 또는 contacts 직접 생성.

`/crm/research` 페이지: ① status='new' 후보 카드(증거 링크·스니펫·세그먼트 추정) → [승인+세그먼트 지정](→`crm_promote_candidate` RPC) / [거부] / [기존 컨택에 병합]. 일괄 승인 없음 — **한 건씩 사람 눈이 닿는 것 자체가 컴플라이언스 장치다.** ② **소스 레지스트리 관리 섹션**: crm_sources 목록(robots_ok·fail_count·last_scanned 표시) + [소스 추가](url·segment·country — is_kr 자동 판정) / [일시정지/재개] / [은퇴]. 후보 승인 화면에는 "이 호스트의 contact 페이지를 소스로도 등록" 체크박스.

### 5-9. 설정 `/crm/settings`

**의도**: 발송 규율(운영설계 §8)을 코드가 아니라 데이터로 — 오너가 조절하되 시스템이 강제.

`crm_settings.data`(기본값은 §4의 0101 시드): daily_send_cap(20) · **weekly_send_cap(10 — 기존 주 10통 관행 승계, 초기 실효 상한)** · per_cron_send_cap(5) · system_send_enabled(false) · kr_window(08–21 KST) · followup_max(2 — 룰의 max_total_touches를 클램프하는 글로벌 천장) · bounce_rate_threshold(0.05)/bounce_rate_window(50) · gmail_account · physical_address · lia_doc_path · unsubscribe_line(en/ko).

**반송률 서킷브레이커**: 크론 잡 ⑤가 매 런 시작 시 최근 bounce_rate_window(50)건 발송 대비 반송률을 계산 — threshold 초과 시 **system_send_enabled를 자동 false로 내리고** content_event 기록 + `/crm` 대시보드 빨간 배너. 재개는 오너가 수동으로.

화면: 설정 폼 + suppression 관리(추가/조회 — 삭제 없음, §10-2; complaint 사유는 수동 등록 — 오너 SOP: Google Postmaster Tools 주기 확인) + Gmail 연결 상태(토큰 유효성 테스트 버튼, invalid_grant 경고) + 컴플라이언스 체크리스트(OAuth 셋업 §5-6-A · 물리 주소 · LIA 문서 커밋·링크 §2-c).

---

## §6. 세그먼트·오퍼 시드

### 6-a. 세그먼트 (crm_segments 시드)

**클러스터 14행**: A 자본·투자(priority 40) · B AI 기업(10) · C 전통 영화 매체(30) · D 블로거·크리에이터(50) · E 학계·연구·기관(40) · F 관광·지자체(20) · G 교육(60) · H 인재·채용(50) · I 배포·플랫폼(40) · J 데이터공급·법률(60) · K 영화 산업(50) · L 브랜드·인프라(70) · M 언론·PR(50) · **N 영화 관계자(크레딧 인물)(25)**. priority는 터치포인트 맵 '우선순위' 절(B1/B3 → F1 → C1/C2 → E4 → H1/M1)의 수치화 + N은 "게이트키퍼 없음·감사 큼"으로 상위 배치.

**그룹 52행**: 터치포인트 맵의 A1~M2 48개 그룹을 코드·대상명·명분(rationale)·접점유형(touch_types) 그대로 전사 + 신설 4개:

| 코드 | 대상 | 명분 | 비고 |
|---|---|---|---|
| N1 | below-the-line 크루(촬영·편집·미술·음악) | 대중 비평의 사각지대 — 진지한 리딩이 경력 자산이 됨. 게이트키퍼 없음 | 포트폴리오 사이트·길드 디렉토리로 직접 도달 |
| N2 | 인디·신진 감독 | 커버리지 갈증 — 인용 가능한 비평이 배급·페스티벌 어필 재료 | X/인스타 DM·제작사·페스티벌 경유 |
| N3 | 퍼블리시스트(홍보담당) | 존재이유가 곧 클라이언트 커버리지 확보 — 완성된 커버리지는 그들의 실적 | IMDbPro Publicist 필드·프레스 킷. 에이전트 아님 |
| N4 | A급 배우·감독(대리인 경유) | 직접 도달 불가 — N3 경유가 유일 경로 | 최후순위. 전용 오퍼 없음(N3 오퍼로 접근) |

⚠️ **전사 시 함정**: `business-touchpoints.ts`의 "자산 인벤토리" 절에 있는 C1~C7(콘텐츠 자산)·L1~L12(로직 자산)는 **자산 코드이지 세그먼트 코드가 아니다** — 'C1'이 그룹(레거시 비평지)과 자산(촬영지 지오데이터) 양쪽에 존재한다. 시드는 `## A`~`## M` 절의 13개 표 행(48개)만 사용하고, 표의 '자산 레버' 열(C1/L11 등 자산 참조)은 segment 참조로 해석하지 말고 notes 문자열로만 보존한다. F 클러스터의 전제 문구("K-콘텐츠 커버리지 보강 필요")도 F의 notes에 기록.

### 6-b. 오퍼 시드 — 카테고리별 업그레이드 오퍼 (crm_offers 시드 41행, 1:1 insert)

**업그레이드 원칙(오너 지시의 코드화)**: 기존 터치포인트 맵의 오퍼는 "우리 데이터·기술이 이렇게 대단하다"에서 출발하는 경향이 있다(자산 전시형). 아래는 **상대의 손익·mandate에서 출발**하도록 다시 썼다 — ① 가능하면 **내가 구매자·발주자 포지션**(광고비 문의·참가비·라이선스 구매 — 상대에게 즉시 매출인 제안은 반드시 검토된다), ② 아니면 **상대의 매출·KPI에 신규 라인을 더하는 거래**(레브셰어·SKU·사업부 신설), ③ 마지막이 무상 공급(단 상대 지표에 직결될 때만). 그리고 **1인 운영이 이행 불가능한 약속(상대 플랫폼 내부 데이터 기반 리포팅, 실방문 실측, 검증 안 된 트래픽 과시)은 쓰지 않는다.** "1~3개" 규칙은 **segment_code(그룹) 단위**다 — 클러스터당 행 수는 3을 넘을 수 있다. depth: **deep**=구매/레브셰어/사업제안, **mid**=공급/제휴, **light**=등재/소개.

| 코드 | 대상 | 오퍼 (한 줄) | 상대의 존재이유·이익 결합점 | depth |
|---|---|---|---|---|
| A1 | 시드 VC | "1인 운영으로 자산 규모 대비 번레이트가 사실상 0인 시드 딜 — 데이터룸 열어두었으니 귀 펀드의 AI-네이티브 테제 검증 케이스로 20분 리뷰를 제안한다" | VC의 존재이유는 저비용·고배수 리턴과 테제 실증 — 검토 비용이 낮고 서사가 완성된 딜은 파트너 미팅에 올리기 쉬운 상품 | deep |
| A4 | 전략 CVC(네이버·카카오·CJ) | "귀사 지도·검색·IP 사업의 K-콘텐츠 촬영지 데이터 공백을 연간 라이선스+지분 옵션 패키지로 채우겠다 — 3단계 요율표를 첨부하니 조달 검토를 요청한다" | CVC의 mandate는 모회사 코어 강화 — 자체 구축보다 싸고 빠른 외부 조달은 실무 부서의 분기 성과가 된다 | deep |
| A5 | 그랜트 기관(KOCCA 등) | "한류 콘텐츠의 해외 검색·콘텐츠 수요를 촬영지 좌표 단위로 집계·보고하는 성과 계기판을 지원사업 산출물로 제안한다 — 귀 기관 KPI 보고서에 바로 들어가는 숫자" | 지원기관의 존재이유는 측정 가능한 정책 성과 — 정량 산출물을 스스로 만들어 오는 지원자는 심사·정산 리스크를 낮춘다 | mid |
| B1 | 답변엔진(Perplexity 등) | "IMDb·Letterboxd가 API를 막은 촬영지·비평 질의를 라이선스 클린하게 채우는 독점 공급 계약 — 30일 무상 파일럿 후 사용량 과금" | 답변엔진의 존재이유는 경쟁사가 못 답하는 쿼리 커버리지 — 공급 거부된 영역의 유일 대안은 조달 담당의 쉬운 결재 | deep |
| B2 | 프런티어 랩(Anthropic·OpenAI·Google) | "소송 리스크 0으로 계약 가능한 문화 도메인 학습·평가 데이터 패키지 — 귀사 데이터 조달·법무 기준으로 먼저 심사해 달라" | 랩의 두 병목은 클린 데이터와 도메인 eval — '심사해 달라'는 요청은 그들의 기존 구매 프로세스에 정확히 꽂힌다 | deep |
| B3 | MCP 생태계·AI 개발툴 | "귀사 레지스트리의 플래그십 쇼케이스로 라이브 MCP 서버를 등재하고 공동 마케팅 슬롯을 맞바꾸자 — 귀사 활성 지표를 채우는 실사용 서버" | 레지스트리·개발툴의 KPI는 고품질 서버 수와 사용량 — 완성도 높은 실물은 그들의 트래픽 미끼 | light |
| C1 | 레거시 비평지·트레이드 | "귀지 광고·스폰서십 상품의 미디어킷과 단가표를 요청한다 — 시네필 타깃 캠페인 집행 의사가 있다" | 매체의 존재이유는 광고 매출 — 광고 문의는 편집부 소개 부탁과 달리 영업 조직이 반드시 회신하는 메일이다(오너가 지목한 '깊은 결합'의 원형) | deep |
| C1 | 레거시 비평지·트레이드 | "기사 페이지의 체류시간·검색 롱테일을 늘리는 촬영지 지도·스코어 위젯을 무상 공급한다 — 광고 인벤토리 가치 상승이 근거" | 매체 매출은 CPM×체류 — 유니크 데이터 위젯이 페이지 가치를 직접 올린다 | mid |
| C2 | 영화 DB·플랫폼(Letterboxd·TMDB 등) | "귀사 작품 페이지에 없는 촬영지 레이어를 연간 데이터 라이선스로 공급하겠다 — 요율표를 보내니 조달 검토를 요청한다" | 플랫폼의 존재이유는 페이지당 체류·재방문 — 자체 구축이 거부된 필드의 외부 조달은 PM의 로드맵 항목을 공짜로 지워준다 | deep |
| C3 | 평점 아그리게이터(RT·Metacritic) | "귀사 작품 페이지에 없는 촬영지·재상영 이력 데이터 레이어를 무상 파일럿 API로 공급하겠다 — 체류시간 개선을 확인한 뒤 라이선스 전환" | 아그리게이터의 해자는 커버리지 폭 — 인증 매체 편입 기준과 충돌하지 않는 보강 데이터로 진입 | mid |
| D1 | 블로거·Substack 필자 | "귀 뉴스레터의 유료 스폰서 슬롯 단가를 문의한다 — 집행 예산과 타깃 적합성 자료를 함께 보낸다" | 크리에이터의 존재이유는 구독·스폰서 수익 — 광고 문의는 콘텐츠 소개 부탁과 격이 다른, 반드시 답하는 메일 | deep |
| D2 | 유튜브 에세이스트 | "다음 영상 한 편의 리서치를 통째로 줄이는 독점 데이터 리빌 패키지(스크립트 소재+그래픽)를 무상 제공한다 — 남들에게 없는 훅으로 조회수를 가져가라" | 이들의 병목은 리서치 시간=업로드 빈도=수익 — 독점 소재는 알고리즘 노출을 직접 견인 | mid |
| D3 | 팟캐스터 | "에피소드 한 편을 통째로 끌고 갈 독점 데이터 스토리(토크 노트+통계)를 무상 제공한다 — 게스트 출연·데이터 코너 정례화도 열려 있다" | 팟캐스트의 병목은 매회 기획 소재 — 준비된 스토리는 제작 비용을 직접 줄인다 | mid |
| D5 | 시네필 커뮤니티 | "커뮤니티 전용 무료 툴 액세스와 AMA를 제공한다 — 운영진에게는 멤버 리텐션 이벤트, 우리에게는 첫 사용자" | 커뮤니티 운영진의 KPI는 활성도 — 검증된 외부 이벤트는 운영 비용 없는 콘텐츠 | light |
| E1 | 영화학과·연구자 | "귀 연구실 실적에 즉시 잡히는 공저 데이터 페이퍼를 제안한다 — 이 규모의 1차 좌표·온톨로지 데이터를 우리가 제공하고 분석·집필을 나눈다" | 연구자의 존재이유는 논문·피인용·테뉴어 — 스스로 못 만드는 데이터의 공저 제안은 실적 KPI에 직결 | deep |
| E1 | 영화학과·연구자 | "DH 그랜트 공동 신청의 데이터 인프라 파트너로 참여하겠다 — 펀딩 근거가 되는 검증된 대규모 리소스를 우리가 댄다" | 그랜트 수주가 랩 운영의 생명선 — 인프라 보유 파트너는 신청서의 승률을 올린다 | deep |
| E2 | 대학 도서관·사서 | "구독료·구매 절차 없이 영구 무료인 시네마 스터디 DB를 리서치 가이드에 등재해 달라 — 인용 양식과 영구 링크를 갖춰 보낸다" | 사서의 KPI는 이용자에게 제공하는 큐레이션 리소스 — 무비용·무계약 추가는 거절할 이유가 없는 제안(LibGuides 22곳 검증 이력) | light |
| E3 | 학술지·학회 | "재사용 가능한 데이터 페이퍼·방법론 노트를 투고하고 특별호의 데이터 파트너를 맡겠다 — 피인용을 끌어올리는 논문 유형" | 저널의 존재이유는 인용지수 — 데이터 논문은 검증된 피인용 견인 포맷 | mid |
| E4 | 데이터 리포지토리(HF·Zenodo·Kaggle) | "시장에 없는 촬영지·이론 온톨로지 데이터셋을 DOI 발행으로 귀 카탈로그에 등재한다 — 귀 플랫폼의 검색·인용 지표를 채우는 유니크 자산" | 리포지토리의 존재이유는 고품질 데이터셋 밀도 — 유일무이 데이터는 그들의 카탈로그 가치를 올린다 | light |
| F1 | 관광공사·지역재단(KTO 등) | "이미 예산이 배정된 한류올레길 MOU의 데이터 백엔드 용역을 3단계 견적으로 제출하겠다 — 해외 검색·콘텐츠 수요 기반 방문 수요 추정 리포팅 포함" | 발주 기관의 존재이유는 집행 성과 — 견적서를 들고 오는 공급자는 '검토'가 아니라 '조달' 프로세스로 들어간다 | deep |
| F2 | 필름커미션(AFCI) | "귀 관할 촬영지의 글로벌 콘텐츠 노출·검색 수요 대시보드를 연간 라이선스로 — 로케이션 유치 세일즈 자료로 쓰라" | 커미션은 유치 경쟁력을 수치로 증명해야 예산을 지킨다 — 촬영 후 관광가치 데이터가 그 숫자 | deep |
| F3 | 지도·여행 플랫폼 | "시장에 없는 촬영지 POI 레이어를 귀사 콘텐츠 파트너 프로그램 규격(GeoJSON 등)으로 라이선스 공급하겠다 — 샘플 데이터셋과 요율표를 보낸다" | 플랫폼의 존재이유는 독점 POI로 인한 체류·광고 노출 — 차별적 콘텐츠 재고의 외부 조달 | deep |
| G1 | 영화학교·MOOC | "귀 플랫폼에 '데이터로 읽는 영화' 신규 강좌를 레브셰어로 공동 출시하자 — 커리큘럼 초안과 샘플 강의를 첨부한다" | 교육 플랫폼의 존재이유는 신규 SKU=매출 라인 — 완성된 커리큘럼 제안은 콘텐츠 조달 비용 0의 신상품 | deep |
| G1 | 영화학교·MOOC | "완주율을 올리는 근거인용형 AI 학습조교를 파일럿 1개 강좌에 무상 화이트라벨로 — 성과 나오면 라이선스 전환" | 교육 플랫폼의 KPI는 완주율·재수강 — 무위험 파일럿 후 과금은 교육 조달의 표준 경로 | mid |
| H1 | AI-네이티브 기업(오너→기업) | "입사지원이 아니라 사업부 신설 제안이다 — 귀사 안에 AI-네이티브 프로덕트 라인(RAG·에이전트·평가)을 0→1로 세우는 사내 창업형 합류를 제안한다" | 기업의 존재이유는 신제품 속도 — 완성 플랫폼을 혼자 지은 실물 증거는 채용이 아니라 역량 인수의 검토 대상(오너가 지목한 '큰 제안'의 원형) | deep |
| H1 | 데브툴·에이전트 기업 | "귀사 제품의 공식 케이스스터디와 빌더-에반젤리스트 계약을 제안한다 — 나는 지원자가 아니라 귀사의 세일즈 자산이다" | 데브툴의 KPI는 실증 사례와 리텐션 — 살아있는 레퍼런스는 마케팅 예산으로 사는 것보다 싸다 | deep |
| H2 | 프리랜스 비평가(오너→기여자) | "당신 이름의 크리틱을 우리 데이터·인용 인프라(구조화 점수·영구 링크) 위에서 유료 상품화하자 — 초기 수익 배분은 당신에게 압도적으로 유리한 조건으로 시작한다" | 프리랜서의 존재이유는 수익화 가능한 지면 — 인프라·수익구조를 제공하는 제안은 실체가 있다 | mid |
| H3 | 그로스·BD 파트너 | "성사 딜($5–30k 로케이션 커스텀) 레브셰어 조건의 BD 파트너로 합류하라 — 무경쟁 데이터와 실제 인바운드 문의 로그를 그대로 공개한다" | BD의 동기는 성과보수 — 검증 가능한 파이프라인 증거만이 움직인다(인바운드 0이면 이 오퍼는 첫 딜 후로 보류) | deep |
| I1 | GPT Store·커넥터 디렉토리 | "귀 스토어 신규 규격·기능 런칭의 데이 원 파트너로 버티컬 커넥터를 공급하겠다 — 런칭 블로그에 실릴 실사용 사례를 우리가 채운다" | 스토어의 존재이유는 생태계 활성 증거 — 런칭 시점의 완성 사례는 그들 마케팅의 재료 | mid |
| I3 | Product Hunt·HN | "검증 가능한 '1인+AI 에이전트' 빌드 스토리를 런칭 독점으로 — 업보트·토론을 부르는 서사" | 이 플랫폼들의 트래픽 엔진은 논쟁적 메이커 서사 — 참여 지표를 채우는 소재 제공 | light |
| J1 | 메타데이터 벤더(Gracenote 포지션) | "귀사 스트리머향 카탈로그에 없는 촬영지 필드를 레브셰어 SKU로 얹자 — 기존 유통망에 순증 매출" | 벤더의 존재이유는 권리정리된 메타데이터 라이선싱 — 신규 필드는 영업 비용 없는 업셀 | deep |
| K2 | 스튜디오·배급사(A24·CJ 등) | "귀사 작품의 스틸·로케이션 정보 공식 라이선스 단가를 문의한다 — 사용처(작품 페이지·지도 레이어)와 트래픽 전망을 첨부한다" | 스튜디오 라이선싱 부서의 존재이유가 IP 사용료 매출 — 구매 문의는 반드시 회신되는 메일이고, 관계의 합법적 출발점이 된다 | deep |
| K3 | 영화제·마켓 | "산업 프로그램 유료 참가와 마켓용 데이터 세션을 제안한다 — 참가비를 내는 산업 참가자이자 프로그램 차별화 소재" | 영화제의 존재이유는 마켓 권위와 집객(참가비 매출) — 돈 내는 참가자+콘텐츠 제공자는 이중으로 반갑다 | mid |
| K4 | 시네마테크·아트하우스 극장 | "상영작마다 큐레이션 노트·계보 자료를 무상 공급한다 — 프로그램 북·SNS 소재 제작 비용을 줄이는 상영 보조 패키지" | 소규모 극장의 병목은 프로그램 자료 제작 리소스 — 준비된 큐레이션 자료는 그들의 상영 가치를 올린다 | mid |
| L1 | 문화 인접 브랜드 | "성장 단계 니치 시네필 지면의 카테고리 독점 얼리 스폰서 자리를 저단가로 제안한다 — 현재 지표와 성장 로드맵을 그대로 공개한 미디어킷 첨부" | 브랜드의 존재이유는 정밀 타깃 도달 — 수치를 숨기지 않는 얼리 스폰서 제안은 저위험 실험 예산으로 검토된다 | mid |
| L2 | 인프라사(Vercel·Supabase·Anthropic) | "유료 고객 실사례로 공식 케이스스터디·공동 웨비나를 제안한다 — 귀사 DevRel 콘텐츠 캘린더의 한 슬롯을 우리가 채운다" | 인프라사의 마케팅 존재이유는 개발자 획득용 실증 사례 — 완결된 레퍼런스는 콘텐츠 조달 비용 절감 | light |
| M1 | 테크·문화 언론 | "팩트체크 자료 일체를 갖춘 독점 기사 패키지 — '1인이 AI 에이전트만으로 플랫폼을 지었다'를 검증 가능한 형태로 제공한다" | 프레스의 존재이유는 클릭을 부르는 오리지널 서사 — 취재 비용 0의 완성형 소재 | mid |
| M2 | AI·인디메이커 뉴스레터 | "매주 쓸 수 있는 재미있는 영화 데이터 인사이트를 무상 큐레이션으로 공급한다 — 오픈율을 지키는 콘텐츠 조달 비용 절감" | 뉴스레터의 존재이유는 오픈율 유지 — 공유 가능한 데이터 훅의 정기 공급은 편집 비용을 낮춘다 | light |
| N1 | below-the-line 크루 | "당신의 [촬영/편집/미술/음악] 작업을 다룬 심층 리딩 페이지를 보낸다 — 포트폴리오·수상 캠페인에 인용 무제한, 원하면 코멘트를 받아 페이지에 반영한다" | below-the-line은 대중 비평의 사각 — 진지한 분석은 그들의 경력 자산(포트폴리오·FYC 재료)이 된다. 게이트키퍼 없음 | mid |
| N2 | 인디·신진 감독 | "차기작 홍보 시점에 맞춰 전작 리딩·계보 페이지를 프레스 킷 자료로 제공한다 — 인터뷰·공동 Q&A도 열려 있다" | 인디 감독의 병목은 커버리지 — 인용 가능한 비평 자료는 배급·페스티벌 어필 재료 | mid |
| N3 | 퍼블리시스트 | "당신 클라이언트 [X]를 다룬 심층 커버리지 페이지와 인용문 팩을 보낸다 — 클라이언트 보고·EPK에 바로 쓰라" | 퍼블리시스트의 존재이유가 곧 커버리지 확보 — 완성된 커버리지는 그들의 실적 그 자체 | mid |

시드 규칙: 위 표 41행을 `0101_crm_seed.sql`에 1:1 insert. 같은 segment_code 안에서는 depth deep→light 순으로 sort. 터치포인트 맵의 기존 오퍼 절(자산 전시형)은 admin doc에 그대로 두되, CRM의 실사용 오퍼는 **이 표가 정본**이다. N1~N3 오퍼의 `[...]` 부분은 컨택의 metatake_url·작품명으로 채우는 개인화 슬롯이다.

---

## §7. 외부 이메일 발송 툴 연계 — 필요하다 (P6)

**결론(오너 질문에 대한 답)**: 필요하다. 단 처음부터는 아니다.

- **~주 10통·월 수십 통(P2–P4)**: Gmail 수동승인 발송으로 충분. 개인 계정 신뢰도가 오히려 콜드 도달률에 유리.
- **월 수백 통+ 또는 시퀀스 자동화가 필요해지면(P6)**: 콜드 아웃리치 전용 툴이 필요하다. **Resend는 안 된다**(트랜잭션/뉴스레터용, AUP가 콜드 금지) — 뉴스레터 전용으로 유지.
- 권장: **Instantly**(기본값 — 워밍업·유니박스·1클릭 수신거부 내장, 대중적) 또는 **Smartlead**(대안 — API 중심·멀티 인박스 저가). §11-3.
- 선결: 발송 전용 도메인 구매(예: `get-metatake.net`) + SPF/DKIM/DMARC + 2–4주 워밍업(운영설계 §8). 메인 `metatake.net` 평판과 격리. **외부 툴의 1클릭 수신거부 링크는 볼륨 확대의 필수 전제**(P2–P4의 회신형 수신거부는 소량 1:1에서만 허용되는 방식).
- 통합 설계: `crm_drafts.status='approved'` 배치를 툴 API로 push하는 어댑터(`lib/crm/adapters/instantly.ts`) + 웹훅/폴링으로 sent/reply/bounce/unsub를 `crm_touches`·`crm_suppression`에 역동기화. **suppression은 양방향 동기화 필수** — 어느 쪽에서 수신거부가 들어와도 양쪽 모두 차단.
- 이메일 검증(NeverBounce/ZeroBounce)은 P6 발송량 증가 시점에 배치 검증으로 도입 — `verify_status` 필드가 이미 준비되어 있다.

---

## §8. 재사용 지도

| 필요 | 재사용원 |
|---|---|
| 인증 게이트 | `middleware.ts`의 `/admin` 블록 복제(`/crm` 블록 추가 — 미로그인→`/admin/login`, 비admin→`/_not-found` rewrite) + `lib/admin.ts`의 `requireAdmin()` 그대로 |
| DB 접근 | `lib/supabase/admin.ts` `createAdminClient()` — 전 페이지·액션·크론 |
| 감사 로그 | `lib/admin.ts` `logContentEvent()` → `content_events` (신규 테이블 만들지 않음) |
| 셸·스타일 | `app/admin/layout.tsx` 복제(인라인 스타일 + CSS 변수, NAV_ITEMS 상수, 미인증 bare-render) |
| 크론 인증·가드 | `app/api/metrics/insights/route.ts`의 x-vercel-cron 3중 인증 + 마커행 최소간격 + 잡별 try/catch 피기백 |
| 뮤테이션 | admin 서버 액션 패턴("use server" + `getAdminUser()` 재검증 + `createAdminClient()` + `logContentEvent` + `revalidatePath`) |
| CSV/XLSX 파싱 | `papaparse`·`xlsx` (이미 의존성 — 신규 설치 0) |
| 워커 골격 | `hourly/pipeline/common.py`(`load_env/sb_get/sb_insert/sb_rpc/http/UA`) · flock 이중실행 방지는 `hourly/pipeline/produce.py` · 1000행 페이징·fail-soft는 `radar/common.py`+`radar/poll_*.py` |
| Mac 실행 트리거 | **`worker/factory-watch.sh`**의 큐 클레임 패턴(queued 행 원자적 claim — 루트 `factory-watch.sh`와 다른 파일) |
| 발송 안전 사다리 | `worker/blog-send.py`의 DRY 기본 → --test → --send 관행(임포트 dry-run·발송 캡 사상의 원류) |
| 텍스트 검색 | pg_trgm(이미 extension) — `crm_contacts` gin 인덱스 |
| 서치 봇 방법론 | `magazine research agent/` 스킬 SOP + `radar/` 디스커버리 플라이휠 |

신규 파일 전량: `app/crm/**`(라우트 12), `app/api/crm/{cron,import}/route.ts`, `lib/crm/{gmail,rules,render,classify,importPresets}.ts`, `worker/{crm-scout.py,gmail-auth.py}`, `run-crm-scout.command`, `supabase/migrations/{0100_crm_core,0101_crm_seed}.sql`, `vercel.json` 크론 1행 추가, `middleware.ts` 블록 1개 추가. **기존 파일 수정은 마지막 2개뿐이다(§10-12).**

---

## §9. 구축 순서 — P0~P6 (각 Phase 독립 배포 가능)

| Phase | 내용 | 완료 기준 |
|---|---|---|
| **P0 기반** | middleware `/crm` 블록 · layout · 마이그레이션 0100+0101(시드 포함) · 대시보드(카운트만) · settings 골격 | `/crm` 접속: admin만 보임(비로그인→login, 일반유저→404), 대시보드 타일에 0들, **세그먼트 66행(클러스터 14+그룹 52)·오퍼 41행·설정 1행** 조회됨 |
| **P1 임포트** | `/crm/import` 마법사 + 프리셋 4종 + dedup dry-run + orgs/sources 프리셋 2종 | 4개 소스 전량 적재: contacts ≈2,300±(병합 후) · orgs ≈150 · sources 111(is_kr 자동 판정 확인), dedup 리포트에 Variety류 교차 병합 확인, **프리셋이 참조하는 모든 segment_code에 active 오퍼 ≥1 존재 확인**, 발송단계 전부 none |
| **P2 컨택 운영** | contacts 리스트/상세/타임라인 · segments(그룹 CRUD 포함)/offers 페이지 · 초안 컴포저 · Gmail OAuth(§5-6-A 오너 액션: 토큰+물리주소+LIA 문서) · outbox 승인→Gmail 초안 생성 · **크론 라우트 골격+vercel.json+발신함 동기화(잡 ②의 sent 절반)** | 컨택 1건 선택→오퍼로 초안 작성→승인→Gmail 앱에 초안 등장(threadId 저장 확인)→수동 발송→다음 크론 런에서 status='sent'+touches 적재+stage 전이 확인 |
| **P3 룰 엔진** | crm_rules CRUD · 평가기(하드 필터 전량) · 기본 룰 3종(off) · (옵트인) 잡 ⑤ 발송 집행 + 서킷브레이커 · **공개 수신거부 엔드포인트 `/api/crm/unsub?token=`(시스템 발송 켜기 전 필수 — 토큰=draft id 서명, suppression 직행)** | 테스트 룰 1개 on→크론 수동 트리거(`?key=`)→proposed 초안 생성·캡 준수·KR/CA/replied 제외를 `crm_rule_runs`로 확인 |
| **P4 인바운드** | 수신함 동기화(잡 ② 완성) · 분류기 5규칙 · 자동응답 초안 · `/crm/inbox` · 소급 재대사(기간 인자) | 실제 수신 1건이 분류→stage='replied' 전이→초안 생성까지 도달, 수신거부 테스트 메일이 suppression 자동 등재, **Gmail 보낸편지함 기준 실발송분 전량이 재대사로 stage 반영(건수는 재대사 리포트 산출)** |
| **P5 서치 봇** | crm-scout.py + `.command` · `/crm/research` 심사 큐 + 소스 관리 UI · 승격 RPC · (선택) 레이더 브리지 | 소스 10곳 스캔→후보 적재(전 건 evidence_url 보유)→1건 승인→컨택 승격, KR 소스 요청 전 재검사로 스킵되는 로그 확인 |
| **P6 스케일** | 외부 툴 어댑터(Instantly 기본) · 발송 도메인 · 이메일 배치 검증 · suppression 양방향 동기화 | 오너가 발송량 필요를 확인한 뒤 착수(구축 대기 상태로 종료 가능) |

각 Phase 후: `node node_modules/typescript/bin/tsc --noEmit` 신규 에러 0 → 커밋 → 라이브 검증(캐시버스터). 마이그레이션은 코드보다 먼저 적용(신규 테이블 없이 코드가 먼저 가면 라이브 500 — 하우스 함정).

---

## §10. 불변식·함정 (구축 AI 필독 — 위반 시 이 시스템의 존재이유가 무너진다)

1. **사람 승인 없는 발송 제로.** 룰·AI·자동응답 어느 경로도 최종 산출은 `status='proposed'` 초안이다. 발송은 오너의 명시 액션(P2: Gmail 앱에서 전송 / P3+: [승인·발송]으로 queued 전환 후 크론 집행)뿐.
2. **Suppression은 하드 게이트, 발송 시점에 재검사.** 승인 시점 검사만으로는 부족하다(승인 후 수신거부 유입 케이스). suppression 행은 영구 — 삭제 UI를 만들지 않는다.
3. **KR·CA 트랙 분리.** KR: scout는 저장 플래그와 무관하게 **요청 직전 호스트를 재검사**해 `.kr/.co.kr/.or.kr`·한국 소스를 건너뛴다(정보통신망법 §50-2 자동수집 금지 — 레이더 브리지도 동일). `jurisdiction='KR'` 컨택은 consent_status='granted' 전 초안 생성 금지(하드 필터), **(광고) 제목 표기는 렌더러가 강제**, 08–21 KST 밖 발송은 집행 시점에 재검사·연기. CA: consent 또는 'casl-exempt' 태그(근거 기록) 없으면 초안 생성 금지.
4. **LIA 3필드(source_url·collected_at·legal_basis) 미비 또는 legal_basis='기타'인 컨택은 초안 생성 불가**(룰 하드 필터 + 컴포저 경고). 이것은 초안 생성 게이트지 stage 고정이 아니다 — 재대사로 과거 발송이 first_sent로 기록되는 것은 허용, 단 상세 페이지에 노란 경고가 출처 보강 전까지 상주.
5. **팔로업 상한.** settings.followup_max(2)가 글로벌 천장 — 평가기는 `min(rule.max_total_touches, followup_max+1)`로 클램프. `stage in ('replied','negotiating','won','unsubscribed','bounced')`와 `parked_reason='negative_reply'`는 룰 대상에서 영구 제외 — **응답한 사람과 거절한 사람에게 기계가 또 보내는 순간 이 시스템은 스팸 머신이 된다.**
5b. **학계·교육(E*·G*) 세그먼트는 non_commercial=true 템플릿만.** 운영설계 §4-D — 논문 교신저자식 접근에 상업 톤은 금지. 룰 평가기와 컴포저 양쪽에서 차단.
6. **재대사 전 룰 금지.** Gmail 소급 동기화(P4)와 OUTREACH 원장 흡수가 끝나기 전에 룰을 켜면 기발송분에 중복 1차 메일이 나간다. 기본 룰이 enabled=false로 시드되는 이유.
7. **crm_* 전 테이블 service-role 전용**(RLS on·정책 0). 클라이언트 컴포넌트에서 supabase 직접 조회 금지 — 전부 서버 컴포넌트/액션 경유.
8. **Resend로 콜드 발송 금지.** Resend는 뉴스레터 전용(AUP + 도메인 평판). 콜드는 Gmail(P2–P4) → 전용 도메인+외부 툴(P6).
9. **메일 푸터·표기는 렌더러가 강제.** `lib/crm/render.ts`가 모든 아웃바운드 본문에 수신거부 안내+물리 주소를, KR 수신자에겐 제목 앞 `(광고)`를 부착한다 — 템플릿이 아니라 렌더러 레벨에서(빠뜨린 템플릿이 있어도 안전).
10. **마이그레이션 번호는 3곳(supabase/·worker/·radar/) 최대+1**로 구현 시점 재확인. 신규 RPC는 `security definer`+service_role 전용 grant+`set statement_timeout '8s'`.
11. **발송 캡 3중 보수 운영.** 주 10(weekly — 초기 실효 상한)·일 20(daily)·크론당 5. Gmail 쿼터가 아니라 **도메인·계정 평판**이 이유다(운영설계 §8). 반송률 서킷브레이커(threshold 초과 시 시스템 발송 자동 차단)는 잡 ⑤ 매 런 선두에서 검사.
12. **기존 코드 수정 최소.** 건드리는 기존 파일은 `middleware.ts`(블록 추가)·`vercel.json`(크론 1행)뿐. admin 나브 링크는 선택. 공용 lib 변경 금지.
13. **googleapis 등 신규 npm 의존성 도입 금지.** Gmail은 fetch 직접 호출(§5-6-B). 파서는 기존 papaparse/xlsx.
14. **봇→컨택 직행 금지.** scout·radar·리서치 산출은 `crm_candidates`까지. `crm_promote_candidate`는 사람 액션에서만 호출. IMDbPro·LinkedIn 자동 추출 금지(약관+GDPR) — N 클러스터는 수동 레인 전용(§5-8-D).
15. **개인정보 최소화 + GDPR 권리.** 수신 메일 본문 전문을 DB에 저장하지 않는다(snippet ≤300자 + gmail_message_id 참조). 삭제 요청은 §5-2의 삭제 액션으로 즉시 이행 — suppression에 남는 이메일 1건이 유일한 적법 보존 예외.
16. `/crm` 전 페이지 `force-dynamic`+noindex. 사이트맵·공개 나브에 절대 등장하지 않는다.
17. **Gmail 토큰 수명 관리.** OAuth 앱은 반드시 In production 상태로(Testing=7일 만료 함정). invalid_grant 발생 시 대시보드 빨간 배너.

---

## §11. 오픈 결정 (오너 몫 — 구축 AI는 기본값으로 진행)

| 결정 | 기본값 | 대안 |
|---|---|---|
| 1. 발송 Gmail 계정 | 기존 아웃리치에 쓰던 Gmail 계정(기존 초안·보낸편지함과의 재대사 정합성) | Google Workspace `wonwoo@metatake.net`(정식 브랜드 발신 — 단 메인 도메인 평판 노출, P6 전용 도메인과 함께 재검토) |
| 2. 물리 주소(CAN-SPAM 필수 푸터) | 오너 제공 대기 — 그 전까지 발송 Phase(P2+) 완료 불가 | 가상 오피스 주소 |
| 3. P6 외부 툴 | Instantly | Smartlead(API 중심·저가) / Lemlist |
| 4. 초안 개인화 AI | 사용(ANTHROPIC_API_KEY, `{{personal_line}}` 1–2줄 제안, 콜당 실패 무해) | 순수 템플릿(비용 0) |
| 5. 이 지시서의 admin docs 등재 | 안 함(md.ts가 코드블록 미지원 — 본 문서는 코드 다량) | 요약본만 `lib/admindocs`에 별도 작성 |
| 6. IMDbPro 구독(월 ~$20) | N 클러스터 착수 시점(P5 전후)에 구독 — Publicist 필드가 목적 | 미구독(포트폴리오·길드·프레스킷 소스만으로 N1·N2 진행) |
| 7. 레이더 브리지(§5-8-B) | P5에서 시도, 스키마 불일치 시 스킵 | 완전 생략 |

---

## §12. 구축 AI가 먼저 읽을 파일

`Metatake_아웃리치_운영설계.md`(컴플라이언스 캐논 — §2 법적 가드레일·§8 발송 규율은 이 시스템의 헌법) · `lib/admindocs/content/business-touchpoints.ts`(세그먼트·명분 원본 — §6-a의 자산 코드 함정 주의) · `middleware.ts` + `lib/admin.ts` + `app/admin/layout.tsx`(게이트·셸 복제원) · `app/api/metrics/insights/route.ts`(크론 패턴) · `lib/supabase/admin.ts` · `HANDOFF-키워드레이더.md` §4(마이그레이션 번호 규약)·§7(워커 구성) · `hourly/pipeline/common.py`(워커 헬퍼) · `worker/blog-send.py`(발송 안전 사다리) · `worker/factory-watch.sh`(Mac 큐 클레임) · `Metatake_컨택DB_템플릿.xlsx`(스키마 원형) · 이 문서.
