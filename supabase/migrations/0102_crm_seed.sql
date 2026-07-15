-- 0102: CRM seed — 세그먼트(클러스터 14 + 그룹 52 = 66), 오퍼 41, 템플릿 7,
-- 설정 기본 행, 기본 룰 3종(전부 enabled=false). 정본: HANDOFF-CRM-비즈니스접점엔진.md §6.
-- 재실행 안전(on conflict do nothing / where not exists 가드).

-- ── 클러스터 14행 (A–N, parent_code null) ─────────────────────────────────────
insert into crm_segments (code, parent_code, name_ko, name_en, rationale, priority) values
('A', null, '자본·투자', 'Capital', 'AI-네이티브 콘텐츠 인프라에 초저비용·고배수로 베팅', 40),
('B', null, 'AI 기업', 'AI', '라이선스 클린 문화 코퍼스·인용 강제 배포·eval 데이터', 10),
('C', null, '전통 영화 매체', 'Media', '광고·위젯·데이터 라이선스로 매체 매출과 결합', 30),
('D', null, '블로거·크리에이터', 'Creators', '독점 데이터 훅·임베드 위젯·스폰서십', 50),
('E', null, '학계·연구·기관', 'Academia', '공저 데이터 페이퍼·그랜트·리서치 가이드 등재', 40),
('F', null, '관광·지자체', 'Tourism', '촬영지 데이터 — 최대 단일 수익($5–30k/딜)', 20),
('G', null, '교육', 'Education', '레브셰어 강좌·근거인용 AI 튜터(B2B2C)', 60),
('H', null, '인재·채용', 'Talent', '사업부 신설 제안·케이스스터디·기여자 영입', 50),
('I', null, '배포·플랫폼', 'Distribution', '등재만으로 즉시 접점(스토어·PH·HN)', 40),
('J', null, '데이터공급·법률', 'Data', 'Gracenote 포지션 — 레브셰어 SKU·소송 면역 데이터', 60),
('K', null, '영화 산업', 'Industry', '스트리밍·스튜디오·영화제 데이터 제휴', 50),
('L', null, '브랜드·인프라', 'Brand', '스폰서십·인프라 케이스스터디', 70),
('M', null, '언론·PR', 'Press', '"1인+AI 에이전트" 서사 독점 스토리', 50),
('N', null, '영화 관계자(크레딧 인물)', 'Filmmakers', '게이트키퍼 없는 below-the-line·인디·퍼블리시스트', 25)
on conflict (code) do nothing;

-- ── 그룹 52행 ─────────────────────────────────────────────────────────────────
insert into crm_segments (code, parent_code, name_ko, rationale, touch_types, priority) values
('A1','A','시드/프리시드 VC','재현 불가 코퍼스+인용 강제 배포+수요 계기판의 1인 팀','{1,12}',40),
('A2','A','엔젤(영화테크·시네필)','혼자 이 규모를 AI로 운영한 실행력에 베팅','{1,7}',40),
('A3','A','액셀러레이터','배치 참가로 배포·네트워크 확보','{1,7}',40),
('A4','A','전략투자·CVC(네이버·카카오·CJ)','K-콘텐츠 관광·메타데이터 인접 전략 자산','{1,7,11}',40),
('A5','A','비희석 그랜트(KOCCA 등)','오픈 문화데이터·공익 아카이브 프레임','{13}',40),
('B1','B','파운데이션 모델 랩','인용 가능한 검증된 영화비평 그라운딩 피드','{4,5,7,2,12}',10),
('B2','B','AI 검색·답변엔진(Perplexity 등)','회색지대 없는 라이선스형 해석 데이터','{4,5,7}',10),
('B3','B','MCP 생태계·AI 개발툴','레퍼런스 MCP 사례로 쇼케이스·등록','{10,12}',10),
('B4','B','바이브코딩·AI툴(채용)','1인 에이전트 운영 = 살아있는 포트폴리오','{2}',10),
('B5','B','AI 데이터·평가사','큐레이션 선호·평가 데이터 판매 또는 취업','{4,2}',10),
('C1','C','레거시 비평지·트레이드','위젯으로 사이트 업그레이드 + 인용 파트너십','{6,7,14}',30),
('C2','C','영화 DB·플랫폼(Letterboxd·TMDB)','거부된 촬영지·해석 데이터를 우리가 공급','{4,5,7}',30),
('C3','C','평점 아그리게이터(RT·Metacritic)','대안 스코어 공급/통합','{5,7}',30),
('D1','D','블로거·Substack 필자','TakeScore 배지·리딩 링크 삽입(백링크)','{6,14,7}',50),
('D2','D','유튜브 영화 에세이스트','영상 소재로 데이터 제공 → 엠배서더','{8,6}',50),
('D3','D','영화 팟캐스터','데이터 협업·스폰서십·게스트','{8,6,7}',50),
('D4','D','레터박스 파워리뷰어','큐레이션 협업·엠배서더','{8,6}',50),
('D5','D','시네필 커뮤니티','AMA·툴 소개·커뮤니티 파트너십','{7,10}',50),
('E1','E','영화학과·연구자·교수','인용 가능한 데이터 접근·공동연구','{9,4,3}',40),
('E2','E','대학 도서관·LibGuides','데이터셋을 리서치 가이드에 등재','{9,10}',40),
('E3','E','영화이론 학술지·학회','인용·데이터 제공·방법론 발표','{9,12}',40),
('E4','E','데이터 리포지토리(HF·Zenodo)','데이터셋 발행 = 권위·백링크','{10,13}',40),
('E5','E','디지털인문학·영화학 학회','발표·협업','{9,12}',40),
('F1','F','관광공사·지역재단(KTO 등)','set-jetting 제도화 맞춤 데이터/API','{11,4,5}',20),
('F2','F','전세계 필름커미션(AFCI)','촬영지 데이터 파트너십','{4,7}',20),
('F3','F','지도·여행 플랫폼','촬영지 레이어 통합/라이선스','{4,5,14}',20),
('F4','F','OTA·여행 미디어','콘텐츠·데이터 파트너십','{6,4}',20),
('G1','G','영화학교·MOOC','사고 파트너 교육 라이선스·툴','{4,7}',60),
('G2','G','온라인 강의(Coursera 등)','콘텐츠·데이터 파트너십','{6,4}',60),
('G3','G','미디어 리터러시·중등 교육자','비평 사고 교육 툴','{6,7}',60),
('H1','H','AI-네이티브 기업(오너→기업)','포지션/사업부 신설 제안','{2,3}',50),
('H2','H','프리랜스 비평가(오너→기여자)','인간 기여로 코퍼스 권위 확보','{3}',50),
('H3','H','그로스·BD 파트너','배포 실행 영입/지분','{3,1}',50),
('H4','H','빌드인퍼블릭·인디해커','가시성 → 오퍼·협업자 유입','{12,3}',50),
('I1','I','GPT Store·커넥터 디렉토리','앱/커넥터 등재 = 배포','{10}',40),
('I2','I','Chrome 웹스토어·확장','확장 배포','{10,14}',40),
('I3','I','Product Hunt·HN·BetaList','런칭 스파이크','{12,10}',40),
('I4','I','뉴스레터 네트워크·Substack 추천','상호 추천·크로스 프로모션','{7,6}',40),
('J1','J','메타데이터 벤더(Gracenote 포지션)','합법 공급 가능한 해석 데이터 벤더','{4,5}',60),
('J2','J','콘텐츠 라이선스 마켓·브로커','데이터셋 등재','{4,10}',60),
('K1','K','스트리밍(Netflix·MUBI 등)','발견/추천·에디토리얼 메타데이터','{5,7}',50),
('K2','K','스튜디오·배급사(A24·CJ)','관객 인사이트·set-jetting·제휴','{7,4,11}',50),
('K3','K','영화제·마켓(칸·부산)','에디토리얼 제휴·라인리지 데이터','{7,9}',50),
('K4','K','시네마테크·아트하우스 극장','상영 노트·큐레이션 제휴','{7,6}',50),
('L1','L','문화 인접 브랜드','뉴스레터·TV 스폰서십','{8}',70),
('L2','L','인프라사(Vercel·Supabase·Anthropic)','스타트업 크레딧·케이스 스터디','{13,12}',70),
('M1','M','테크·문화 언론','1인 AI 빌더 스토리','{12}',50),
('M2','M','AI·인디메이커 뉴스레터','피처','{12}',50),
('N1','N','below-the-line 크루','대중 비평의 사각 — 진지한 리딩이 경력 자산. 게이트키퍼 없음','{6,7}',25),
('N2','N','인디·신진 감독','커버리지 갈증 — 인용 가능한 비평이 배급·페스티벌 어필','{6,12}',25),
('N3','N','퍼블리시스트(홍보담당)','존재이유가 곧 클라이언트 커버리지 확보','{12,6}',25),
('N4','N','A급 배우·감독(대리인 경유)','직접 도달 불가 — N3 경유가 유일 경로','{12}',25)
on conflict (code) do nothing;

-- ── 오퍼 41행 (§6-b, 1:1) ─────────────────────────────────────────────────────
insert into crm_offers (segment_code, title, coupling, depth, sort)
select v.segment_code, v.title, v.coupling, v.depth, v.sort
from (values
('A1','1인 운영으로 자산 규모 대비 번레이트가 사실상 0인 시드 딜 — 데이터룸을 열어두었으니 귀 펀드의 AI-네이티브 테제 검증 케이스로 20분 리뷰를 제안한다','VC의 존재이유는 저비용·고배수 리턴과 테제 실증 — 검토 비용이 낮고 서사가 완성된 딜은 파트너 미팅에 올리기 쉬운 상품','deep',10),
('A4','귀사 지도·검색·IP 사업의 K-콘텐츠 촬영지 데이터 공백을 연간 라이선스+지분 옵션 패키지로 채우겠다 — 3단계 요율표를 첨부하니 조달 검토를 요청한다','전략 CVC의 mandate는 모회사 코어 강화 — 자체 구축보다 싸고 빠른 외부 조달은 실무 부서의 분기 성과','deep',10),
('A5','한류 콘텐츠의 해외 검색·콘텐츠 수요를 촬영지 좌표 단위로 집계·보고하는 성과 계기판을 지원사업 산출물로 제안한다 — 귀 기관 KPI 보고서에 바로 들어가는 숫자','지원기관의 존재이유는 측정 가능한 정책 성과 — 정량 산출물을 스스로 만들어 오는 지원자는 심사·정산 리스크를 낮춘다','mid',10),
('B1','IMDb·Letterboxd가 API를 막은 촬영지·비평 질의를 라이선스 클린하게 채우는 독점 공급 계약 — 30일 무상 파일럿 후 사용량 과금','답변엔진의 존재이유는 경쟁사가 못 답하는 쿼리 커버리지 — 공급 거부된 영역의 유일 대안은 조달 담당의 쉬운 결재','deep',10),
('B2','소송 리스크 0으로 계약 가능한 문화 도메인 학습·평가 데이터 패키지 — 귀사 데이터 조달·법무 기준으로 먼저 심사해 달라','랩의 두 병목은 클린 데이터와 도메인 eval — 심사 요청은 그들의 기존 구매 프로세스에 정확히 꽂힌다','deep',10),
('B3','귀사 레지스트리의 플래그십 쇼케이스로 라이브 MCP 서버를 등재하고 공동 마케팅 슬롯을 맞바꾸자 — 귀사 활성 지표를 채우는 실사용 서버','레지스트리·개발툴의 KPI는 고품질 서버 수와 사용량 — 완성도 높은 실물은 그들의 트래픽 미끼','light',10),
('C1','귀지 광고·스폰서십 상품의 미디어킷과 단가표를 요청한다 — 시네필 타깃 캠페인 집행 의사가 있다','매체의 존재이유는 광고 매출 — 광고 문의는 편집부 소개 부탁과 달리 영업 조직이 반드시 회신하는 메일','deep',10),
('C1','기사 페이지의 체류시간·검색 롱테일을 늘리는 촬영지 지도·스코어 위젯을 무상 공급한다 — 광고 인벤토리 가치 상승이 근거','매체 매출은 CPM×체류 — 유니크 데이터 위젯이 페이지 가치를 직접 올린다','mid',20),
('C2','귀사 작품 페이지에 없는 촬영지 레이어를 연간 데이터 라이선스로 공급하겠다 — 요율표를 보내니 조달 검토를 요청한다','플랫폼의 존재이유는 페이지당 체류·재방문 — 자체 구축이 거부된 필드의 외부 조달은 PM의 로드맵을 공짜로 지워준다','deep',10),
('C3','귀사 작품 페이지에 없는 촬영지·재상영 이력 데이터 레이어를 무상 파일럿 API로 공급하겠다 — 체류시간 개선을 확인한 뒤 라이선스 전환','아그리게이터의 해자는 커버리지 폭 — 인증 매체 편입 기준과 충돌하지 않는 보강 데이터로 진입','mid',10),
('D1','귀 뉴스레터의 유료 스폰서 슬롯 단가를 문의한다 — 집행 예산과 타깃 적합성 자료를 함께 보낸다','크리에이터의 존재이유는 구독·스폰서 수익 — 광고 문의는 콘텐츠 소개 부탁과 격이 다른, 반드시 답하는 메일','deep',10),
('D2','다음 영상 한 편의 리서치를 통째로 줄이는 독점 데이터 리빌 패키지(스크립트 소재+그래픽)를 무상 제공한다 — 남들에게 없는 훅으로 조회수를 가져가라','유튜브 에세이스트의 병목은 리서치 시간=업로드 빈도=수익 — 독점 소재는 알고리즘 노출을 직접 견인','mid',10),
('D3','에피소드 한 편을 통째로 끌고 갈 독점 데이터 스토리(토크 노트+통계)를 무상 제공한다 — 게스트 출연·데이터 코너 정례화도 열려 있다','팟캐스트의 병목은 매회 기획 소재 — 준비된 스토리는 제작 비용을 직접 줄인다','mid',10),
('D5','커뮤니티 전용 무료 툴 액세스와 AMA를 제공한다 — 운영진에게는 멤버 리텐션 이벤트, 우리에게는 첫 사용자','커뮤니티 운영진의 KPI는 활성도 — 검증된 외부 이벤트는 운영 비용 없는 콘텐츠','light',10),
('E1','귀 연구실 실적에 즉시 잡히는 공저 데이터 페이퍼를 제안한다 — 이 규모의 1차 좌표·온톨로지 데이터를 우리가 제공하고 분석·집필을 나눈다','연구자의 존재이유는 논문·피인용·테뉴어 — 스스로 못 만드는 데이터의 공저 제안은 실적 KPI에 직결','deep',10),
('E1','DH 그랜트 공동 신청의 데이터 인프라 파트너로 참여하겠다 — 펀딩 근거가 되는 검증된 대규모 리소스를 우리가 댄다','그랜트 수주가 랩 운영의 생명선 — 인프라 보유 파트너는 신청서의 승률을 올린다','deep',20),
('E2','구독료·구매 절차 없이 영구 무료인 시네마 스터디 DB를 리서치 가이드에 등재해 달라 — 인용 양식과 영구 링크를 갖춰 보낸다','사서의 KPI는 이용자에게 제공하는 큐레이션 리소스 — 무비용·무계약 추가는 거절할 이유가 없는 제안','light',10),
('E3','재사용 가능한 데이터 페이퍼·방법론 노트를 투고하고 특별호의 데이터 파트너를 맡겠다 — 피인용을 끌어올리는 논문 유형','저널의 존재이유는 인용지수 — 데이터 논문은 검증된 피인용 견인 포맷','mid',10),
('E4','시장에 없는 촬영지·이론 온톨로지 데이터셋을 DOI 발행으로 귀 카탈로그에 등재한다 — 귀 플랫폼의 검색·인용 지표를 채우는 유니크 자산','리포지토리의 존재이유는 고품질 데이터셋 밀도 — 유일무이 데이터는 그들의 카탈로그 가치를 올린다','light',10),
('F1','이미 예산이 배정된 한류올레길 MOU의 데이터 백엔드 용역을 3단계 견적으로 제출하겠다 — 해외 검색·콘텐츠 수요 기반 방문 수요 추정 리포팅 포함','발주 기관의 존재이유는 집행 성과 — 견적서를 들고 오는 공급자는 검토가 아니라 조달 프로세스로 들어간다','deep',10),
('F2','귀 관할 촬영지의 글로벌 콘텐츠 노출·검색 수요 대시보드를 연간 라이선스로 — 로케이션 유치 세일즈 자료로 쓰라','커미션은 유치 경쟁력을 수치로 증명해야 예산을 지킨다 — 촬영 후 관광가치 데이터가 그 숫자','deep',10),
('F3','시장에 없는 촬영지 POI 레이어를 귀사 콘텐츠 파트너 프로그램 규격(GeoJSON 등)으로 라이선스 공급하겠다 — 샘플 데이터셋과 요율표를 보낸다','플랫폼의 존재이유는 독점 POI로 인한 체류·광고 노출 — 차별적 콘텐츠 재고의 외부 조달','deep',10),
('G1','귀 플랫폼에 데이터로 읽는 영화 신규 강좌를 레브셰어로 공동 출시하자 — 커리큘럼 초안과 샘플 강의를 첨부한다','교육 플랫폼의 존재이유는 신규 SKU=매출 라인 — 완성된 커리큘럼 제안은 콘텐츠 조달 비용 0의 신상품','deep',10),
('G1','완주율을 올리는 근거인용형 AI 학습조교를 파일럿 1개 강좌에 무상 화이트라벨로 — 성과 나오면 라이선스 전환','교육 플랫폼의 KPI는 완주율·재수강 — 무위험 파일럿 후 과금은 교육 조달의 표준 경로','mid',20),
('H1','입사지원이 아니라 사업부 신설 제안이다 — 귀사 안에 AI-네이티브 프로덕트 라인(RAG·에이전트·평가)을 0→1로 세우는 사내 창업형 합류를 제안한다','기업의 존재이유는 신제품 속도 — 완성 플랫폼을 혼자 지은 실물 증거는 역량 인수의 검토 대상','deep',10),
('H1','귀사 제품의 공식 케이스스터디와 빌더-에반젤리스트 계약을 제안한다 — 나는 지원자가 아니라 귀사의 세일즈 자산이다','데브툴의 KPI는 실증 사례와 리텐션 — 살아있는 레퍼런스는 마케팅 예산으로 사는 것보다 싸다','deep',20),
('H2','당신 이름의 크리틱을 우리 데이터·인용 인프라(구조화 점수·영구 링크) 위에서 유료 상품화하자 — 초기 수익 배분은 당신에게 압도적으로 유리한 조건으로 시작한다','프리랜서의 존재이유는 수익화 가능한 지면 — 인프라·수익구조를 제공하는 제안은 실체가 있다','mid',10),
('H3','성사 딜($5–30k 로케이션 커스텀) 레브셰어 조건의 BD 파트너로 합류하라 — 무경쟁 데이터와 실제 인바운드 문의 로그를 그대로 공개한다','BD의 동기는 성과보수 — 검증 가능한 파이프라인 증거만이 움직인다','deep',10),
('I1','귀 스토어 신규 규격·기능 런칭의 데이 원 파트너로 버티컬 커넥터를 공급하겠다 — 런칭 블로그에 실릴 실사용 사례를 우리가 채운다','스토어의 존재이유는 생태계 활성 증거 — 런칭 시점의 완성 사례는 그들 마케팅의 재료','mid',10),
('I3','검증 가능한 1인+AI 에이전트 빌드 스토리를 런칭 독점으로 — 업보트·토론을 부르는 서사','이 플랫폼들의 트래픽 엔진은 논쟁적 메이커 서사 — 참여 지표를 채우는 소재 제공','light',10),
('J1','귀사 스트리머향 카탈로그에 없는 촬영지 필드를 레브셰어 SKU로 얹자 — 기존 유통망에 순증 매출','벤더의 존재이유는 권리정리된 메타데이터 라이선싱 — 신규 필드는 영업 비용 없는 업셀','deep',10),
('K2','귀사 작품의 스틸·로케이션 정보 공식 라이선스 단가를 문의한다 — 사용처(작품 페이지·지도 레이어)와 트래픽 전망을 첨부한다','스튜디오 라이선싱 부서의 존재이유가 IP 사용료 매출 — 구매 문의는 반드시 회신되고 관계의 합법적 출발점','deep',10),
('K3','산업 프로그램 유료 참가와 마켓용 데이터 세션을 제안한다 — 참가비를 내는 산업 참가자이자 프로그램 차별화 소재','영화제의 존재이유는 마켓 권위와 집객(참가비 매출) — 돈 내는 참가자+콘텐츠 제공자는 이중으로 반갑다','mid',10),
('K4','상영작마다 큐레이션 노트·계보 자료를 무상 공급한다 — 프로그램 북·SNS 소재 제작 비용을 줄이는 상영 보조 패키지','소규모 극장의 병목은 프로그램 자료 제작 리소스 — 준비된 큐레이션 자료는 상영 가치를 올린다','mid',10),
('L1','성장 단계 니치 시네필 지면의 카테고리 독점 얼리 스폰서 자리를 저단가로 제안한다 — 현재 지표와 성장 로드맵을 그대로 공개한 미디어킷 첨부','브랜드의 존재이유는 정밀 타깃 도달 — 수치를 숨기지 않는 얼리 스폰서 제안은 저위험 실험 예산으로 검토된다','mid',10),
('L2','유료 고객 실사례로 공식 케이스스터디·공동 웨비나를 제안한다 — 귀사 DevRel 콘텐츠 캘린더의 한 슬롯을 우리가 채운다','인프라사의 마케팅 존재이유는 개발자 획득용 실증 사례 — 완결된 레퍼런스는 콘텐츠 조달 비용 절감','light',10),
('M1','팩트체크 자료 일체를 갖춘 독점 기사 패키지 — 1인이 AI 에이전트만으로 플랫폼을 지었다를 검증 가능한 형태로 제공한다','프레스의 존재이유는 클릭을 부르는 오리지널 서사 — 취재 비용 0의 완성형 소재','mid',10),
('M2','매주 쓸 수 있는 재미있는 영화 데이터 인사이트를 무상 큐레이션으로 공급한다 — 오픈율을 지키는 콘텐츠 조달 비용 절감','뉴스레터의 존재이유는 오픈율 유지 — 공유 가능한 데이터 훅의 정기 공급은 편집 비용을 낮춘다','light',10),
('N1','당신의 작업을 다룬 심층 리딩 페이지를 보낸다 — 포트폴리오·수상 캠페인에 인용 무제한, 원하면 코멘트를 받아 페이지에 반영한다','below-the-line은 대중 비평의 사각 — 진지한 분석은 그들의 경력 자산이 된다. 게이트키퍼 없음','mid',10),
('N2','차기작 홍보 시점에 맞춰 전작 리딩·계보 페이지를 프레스 킷 자료로 제공한다 — 인터뷰·공동 Q&A도 열려 있다','인디 감독의 병목은 커버리지 — 인용 가능한 비평 자료는 배급·페스티벌 어필 재료','mid',10),
('N3','당신 클라이언트를 다룬 심층 커버리지 페이지와 인용문 팩을 보낸다 — 클라이언트 보고·EPK에 바로 쓰라','퍼블리시스트의 존재이유가 곧 커버리지 확보 — 완성된 커버리지는 그들의 실적 그 자체','mid',10)
) as v(segment_code, title, coupling, depth, sort)
where not exists (select 1 from crm_offers o where o.segment_code = v.segment_code and o.title = v.title);

-- ── 템플릿 7행 (운영설계 §7-A~E + 팔로업 + 응답) ─────────────────────────────
insert into crm_templates (name, segment_code, language, kind, non_commercial, subject_tpl, body_tpl)
select * from (values
('영화제 프레스', 'K3'::text, 'en'::text, 'first'::text, false,
 'Metatake — a film-curation tool for {{org}}',
 'Hi {{name}},

{{personal_line}}

Metatake is an independent film-criticism and location-data platform. I thought it might be useful to {{org}} — details here: {{metatake_url}}

If this isn''t relevant, just reply and I''ll leave you be.

Best,
Metatake'),
('트레이드 매체 제보', 'C1', 'en', 'first', false,
 'A new film curation/data platform — Metatake',
 'Hi {{name}},

{{personal_line}}

Metatake pairs original film readings with a 17k-location shooting-site dataset. Happy to send a demo, data, or an interview.

Take a look: {{metatake_url}}

Best,
Metatake'),
('배급/제작사', 'K2', 'en', 'first', false,
 'Metatake — collaboration on {{org}} titles',
 'Hi {{name}},

{{personal_line}}

Metatake can connect {{org}}''s lineup to audiences and buyers through location data and editorial readings. Five minutes shows the core.

{{metatake_url}}

Best,
Metatake'),
('학계 비상업', 'E1', 'en', 'first', true,
 'Free film-studies data & tools for {{org}}',
 'Dear {{name}},

{{personal_line}}

Metatake offers open film-studies data (locations, theory ontology) usable in teaching and research. For educational/research use it''s free.

{{metatake_url}}

Best,
Metatake'),
('크리에이터 비즈니스', 'D1', 'en', 'first', false,
 'Metatake — a fit for {{org}}',
 'Hi {{name}},

{{personal_line}}

Metatake gives you data hooks and an embeddable score widget your audience will like. Trial accounts and collaboration both open.

{{metatake_url}}

Best,
Metatake'),
('팔로업 1회', null, 'en', 'followup', false,
 'Re: Metatake',
 'Hi {{name}},

Just following up on my note below — no pressure at all. If there''s any interest, {{metatake_url}} has the details, and I''m happy to answer anything.

If not relevant, a one-word reply is enough and I won''t write again.

Best,
Metatake'),
('응답 감사', null, 'en', 'reply', false,
 'Re: Metatake — thank you',
 'Hi {{name}},

{{personal_line}}

Thank you for getting back to me. {{metatake_url}} has the specifics — happy to jump on a quick call or send whatever''s most useful.

Best,
Metatake')
) as v(name, segment_code, language, kind, non_commercial, subject_tpl, body_tpl)
where not exists (select 1 from crm_templates t where t.name = v.name);

-- ── 설정 기본 행 ──────────────────────────────────────────────────────────────
insert into crm_settings (id, data) values (1, '{
  "daily_send_cap": 20, "weekly_send_cap": 10, "per_cron_send_cap": 5,
  "system_send_enabled": false,
  "kr_window": {"start": 8, "end": 21, "tz": "Asia/Seoul"},
  "followup_max": 2,
  "bounce_rate_threshold": 0.05, "bounce_rate_window": 50,
  "gmail_account": null, "gmail_sync_cursor": null, "gmail_token_error": false,
  "physical_address": null, "lia_doc_path": null,
  "unsubscribe_line": {"en": "If you prefer not to hear from us, just reply with \"unsubscribe\" and we will never email you again.", "ko": "수신을 원치 않으시면 \"수신거부\"라고 회신해 주세요. 즉시 그리고 영구히 중단합니다."}
}'::jsonb)
on conflict (id) do nothing;

-- ── 기본 룰 3종 (전부 enabled=false; offer_id/template_id는 시드 시점 서브쿼리 해석) ─
insert into crm_rules (name, enabled, match, trigger, action, caps)
select * from (values
('첫 접촉 — C1 트레이드매체', false,
 '{"segment_codes":["C1"],"stages":["none"],"require_email":true}'::jsonb,
 '{"kind":"stage_age","days_since_last_touch":0,"max_total_touches":2}'::jsonb,
 jsonb_build_object('kind','create_draft','draft_kind','first',
   'offer_id',(select id from crm_offers where segment_code='C1' and depth='deep' order by sort limit 1),
   'template_id',(select id from crm_templates where kind='first' and segment_code='C1' limit 1)),
 '{"per_run":10,"per_day":10}'::jsonb),
('팔로업 1회 — 전체', false,
 '{"stages":["first_sent"],"require_email":true}'::jsonb,
 '{"kind":"stage_age","days_since_last_touch":7,"max_total_touches":2}'::jsonb,
 jsonb_build_object('kind','create_draft','draft_kind','followup',
   'template_id',(select id from crm_templates where kind='followup' limit 1)),
 '{"per_run":10,"per_day":10}'::jsonb),
('휴면 재접촉 — 오너 보류분만', false,
 '{"stages":["parked"],"parked_reason":"owner","require_email":true}'::jsonb,
 '{"kind":"stage_age","days_since_last_touch":60,"max_total_touches":2}'::jsonb,
 jsonb_build_object('kind','create_draft','draft_kind','followup',
   'template_id',(select id from crm_templates where kind='followup' limit 1)),
 '{"per_run":5,"per_day":5}'::jsonb)
) as v(name, enabled, match, trigger, action, caps)
where not exists (select 1 from crm_rules r where r.name = v.name);
