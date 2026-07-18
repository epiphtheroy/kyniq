#!/usr/bin/env python3
"""worker/crm-agent.py — CRM 에이전트(총괄비서) · 일일 브리핑 (P1 MVP).

정본: HANDOFF-CRM에이전트-총괄비서.md. hourly/pipeline/common.py 재사용(stdlib + Anthropic).

무엇을 하나 (하루 1~2회 스케줄 실행 상정):
  1) 기회 풀 수집 — 모드 B 초대된 창구(crm_channels) + 소수의 웜 컨택(crm_contacts)
  2) 규칙기반 점수화 → 상위 N 선정 (점수는 설명가능 · 블랙박스 금지)
  3) Opus 1콜로 각 건 초안 + 한국어 근거(주요구조·왜중요·왜오늘) 생성 (과장 금지)
  4) crm_briefings / crm_briefing_items 적재 (초안-온리, 발송 아님)
  5) 브리핑 HTML 메일을 **오너에게만** 발송 (상대에게 가는 초안은 절대 발송하지 않는다)

불변식: 상대 발송 0(오너 OK 전) · 발신=Wonwoo Yoon/wonwoo@metatake.net · 과장 금지 ·
        점수 설명가능 · KR 트랙 제외 · 창구 지원(웹폼)은 오너가 그들의 인터페이스로 제출.

실행:  python3 worker/crm-agent.py [--seed] [--n 10] [--no-send] [--dry]
"""
from __future__ import annotations
import sys, json, base64, argparse
from email.mime.text import MIMEText
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "hourly" / "pipeline"))
import common as c  # noqa: E402

FROM_ADDR = "wonwoo@metatake.net"
OWNER_TO = ["wonwoo@metatake.net", "thinkartist1@gmail.com"]
OPUS = "claude-opus-4-8"

# ── 팩트 시트 (초안의 유일한 근거 — 여기 없는 자랑은 쓰지 않는다) ──────────────
ASSET_SHEET = """Metatake (metatake.net) — 실측 자산 (2026-07):
- 6,701편에 13차원 TakeScore(구조화 평가 축) 부여
- 다프레임워크 비평 리딩(철학/이론 렌즈로 읽는 원본 비평)
- 촬영지 지오데이터: 좌표 단위 filming-locations 레이어(시장에 드문 고유 데이터)
- figures ~4,600 · 트로프 · 킨드레드(유사작) 연결 · 캐논 스탠딩
- film_sentences 문장 임베딩 ~466,974
- 라이브 MCP 서버(공식 MCP Registry 등재 net.metatake/mcp) · 공개 REST /api/v1 · 임베드 위젯 · 크롬 확장
- 한국어 전면 로컬라이즈(/ko)
- 라이선스(혼동 금지): 원저작 비평(readings·essays)=CC BY-NC 4.0 / **촬영지 지오데이터셋=CC BY 4.0**(상업 포함 자유·귀속만). 좌표 데이터는 개방, 비평은 비상업.
- 이미 공개된 데이터셋: Hugging Face `wonwooyoon/metatake-filming-locations`(17,341 위치·1,917편·130개국·좌표100%·CC BY 4.0) + Zenodo DOI 동반.
- 파트너십 창구: metatake.net/partners
정직 규칙: 위 목록에 없는 수치·권위·트래픽을 지어내지 말 것. 초기 단계임을 숨기지 말 것. **오너의 기존 자산·계정을 언급할 땐 반드시 과거 자료 검색 결과의 실제 값만 쓸 것.**"""

# ── 모드 B 초대된 창구 시드 (HANDOFF-CRM §-1.3에서 상위 실채널) ───────────────
# URL은 '정독 좌표'이지 확정이 아니다(§-1.2 1단계). owner_notes에 확인 필요를 표기.
CHANNELS = [
    dict(name="Rotten Tomatoes — Approved Tomatometer Publication",
         segment_code="C3", industry_family="평론 인증·아그리게이터",
         channel_url="https://www.rottentomatoes.com/critics-application",
         channel_type="accreditation", depth="deep", grade="AAA",
         their_benefit="커버리지 폭이 곧 제품 — 승인 매체가 많을수록 아그리게이터 가치 상승",
         screening_policy="편집 기준·발행 빈도/볼륨·독립 편집·아카이브 규모·전문성 심사",
         our_fit="6,701편 구조화 리딩 + 13차원 TakeScore로 편집 일관성/볼륨을 증명",
         owner_notes="라이브 신청 요건·매체 자격 재정독 필요"),
    dict(name="Metacritic — Publication Inclusion",
         segment_code="C3", industry_family="평론 인증·아그리게이터",
         channel_url="https://www.metacritic.com/about/",
         channel_type="accreditation", depth="deep", grade="AAA",
         their_benefit="스코어 소스 다양성 = 메타스코어 신뢰",
         screening_policy="발행 이력·전문성·독립 편집 심사",
         our_fit="TakeScore가 그들 메타스코어와 병렬적 구조화 서사",
         owner_notes="편입 문의 경로 확인 필요"),
    dict(name="TMDB — Data Contribution / Commercial API",
         segment_code="C2", industry_family="영화 데이터·카탈로그",
         channel_url="https://developer.themoviedb.org/",
         channel_type="api_application", depth="deep", grade="AAA",
         their_benefit="데이터 기여가 곧 그들 카탈로그 가치",
         screening_policy="사용목적·기여 데이터 품질·라이선스 심사",
         our_fit="작품 페이지에 없는 촬영지 GEO 레이어 기여 + API 라이선스"),
    dict(name="Perplexity — Publisher Program",
         segment_code="B1", industry_family="AI·검색 퍼블리셔",
         channel_url="https://www.perplexity.ai/hub/getting-started",
         channel_type="portal", depth="deep", grade="AAA",
         their_benefit="인용 소스 다양성 = 답변 품질",
         screening_policy="콘텐츠 독창성·권위·라이선스 심사",
         our_fit="IMDb/Letterboxd가 API 막은 비평·촬영지 질의를 CC 라이선스로 커버",
         owner_notes="퍼블리셔 프로그램 라이브 인테이크 확인 필요"),
    dict(name="Wikidata / Wikipedia — Structured Data Contribution",
         segment_code="B3", industry_family="지식그래프·엔티티",
         channel_url="https://www.wikidata.org/wiki/Wikidata:Data_donation",
         channel_type="submission", depth="deep", grade="AAA",
         their_benefit="지식 커버리지 밀도",
         screening_policy="출처·중립성·notability(커뮤니티 심사)",
         our_fit="엔티티 신원 갭 해소 + 촬영지 GEO를 출처와 함께 기여"),
    dict(name="Hugging Face — Datasets",
         segment_code="E4", industry_family="데이터셋 배포",
         channel_url="https://huggingface.co/datasets",
         channel_type="registry", depth="mid", grade="AAA",
         their_benefit="고품질 데이터셋 밀도 = 플랫폼 가치",
         screening_policy="데이터 카드 품질·라이선스·유용성(큐레이션/featured)",
         our_fit="촬영지·온톨로지 유니크 데이터셋(CC BY-NC)"),
    dict(name="University Libraries — LibGuides Inclusion Request",
         segment_code="E2", industry_family="학계·도서관",
         channel_url="https://community.libguides.com/",
         channel_type="email", depth="light", grade="AAA",
         their_benefit="이용자에게 제공할 큐레이션 리소스",
         screening_policy="무비용·인용 양식·영구 링크·권위(사서 심사)",
         our_fit="무계약·영구무료 시네마 스터디 DB · 22곳 등재 검증 이력 · CC BY-NC"),
    dict(name="Atlas Obscura — Contributor",
         segment_code="F3", industry_family="문화·장소",
         channel_url="https://www.atlasobscura.com/contribute",
         channel_type="submission", depth="mid", grade="AA",
         their_benefit="장소 콘텐츠 밀도",
         screening_policy="사실성·독창성 심사",
         our_fit="촬영지 GEO = 장소 콘텐츠와 정확히 겹침"),
    dict(name="Product Hunt — Launch",
         segment_code="I3", industry_family="개발자 배포",
         channel_url="https://www.producthunt.com/",
         channel_type="submission", depth="light", grade="AA",
         their_benefit="트래픽 엔진 = 메이커 서사",
         screening_policy="완성도·독창성(커뮤니티 심사)",
         our_fit="'1인+AI 에이전트가 비평 플랫폼 구축' 서사 + 라이브 제품"),
    dict(name="Google Dataset Search — schema.org/Dataset",
         segment_code="E4", industry_family="지식그래프·발견",
         channel_url="https://developers.google.com/search/docs/appearance/structured-data/dataset",
         channel_type="submission", depth="mid", grade="AAA",
         their_benefit="데이터셋 발견성",
         screening_policy="유효 구조화 마크업(자동 색인)",
         our_fit="Dataset 스키마만 붙이면 촬영지 데이터가 색인 편입"),
]


def sb_insert_returning(env: dict, table: str, row: dict):
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    url = f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/{table}"
    status, data = c.http(url, method="POST", body=json.dumps(row).encode(),
        headers={"apikey": key, "Authorization": f"Bearer {key}", "User-Agent": c.SB_UA,
                 "Content-Type": "application/json", "Prefer": "return=representation"})
    if status in (200, 201):
        try:
            j = json.loads(data)
            return j[0] if isinstance(j, list) else j
        except Exception:
            return None
    c.log(f"insert {table} -> {status} {data[:200].decode('utf-8','ignore')}")
    return None


def seed_channels(env: dict):
    for ch in CHANNELS:
        exist = c.sb_get(env, f"crm_channels?select=id&channel_url=eq.{ch['channel_url']}", service=True)
        if exist:
            continue
        ok, msg = c.sb_insert(env, "crm_channels", ch)
        c.log(f"seed channel {'OK' if ok else 'FAIL'}: {ch['name']} {'' if ok else msg}")


def score_channel(ch: dict) -> tuple[float, dict]:
    g = {"AAA": 100, "AA": 70, "A": 40}.get(ch.get("grade"), 40)
    d = {"deep": 30, "mid": 20, "light": 10}.get(ch.get("depth"), 20)
    # 채널 용이성: 웹폼/등록/제출/마크업은 이메일 평판 캡 무관 → 가점
    ease = {"web_form": 15, "portal": 15, "submission": 15, "registry": 15,
            "api_application": 12, "accreditation": 10, "grant": 8, "email": 5}.get(ch.get("channel_type"), 8)
    fit = 20 if ch.get("our_fit") else 0
    total = g + d + ease + fit
    return total, {"grade": g, "depth": d, "channel_ease": ease, "fit": fit, "total": total}


def score_contact(ct: dict, has_offer: bool) -> tuple[float, dict]:
    base = 35  # 콜드 컨택은 창구보다 낮게(도메인 평판·워밍업)
    fit = 20 if ct.get("metatake_url") else 0
    off = 15 if has_offer else 0
    total = base + fit + off
    return total, {"base": base, "fit": fit, "offer": off, "total": total, "note": "콜드 이메일(캡·워밍업 대상)"}


def gather_pool(env: dict, n_channels: int, n_contacts: int):
    chans = c.sb_get(env, "crm_channels?select=*&status=eq.discovered&order=grade.asc,depth.asc", service=True) or []
    for ch in chans:
        ch["_score"], ch["_bd"] = score_channel(ch)
    chans.sort(key=lambda x: -x["_score"])
    top_ch = chans[:n_channels]

    # 소수 웜 콜드 컨택 (email + stage=none + KR 제외 + legal_basis 유효)
    conts = c.sb_get(env,
        "crm_contacts?select=id,org_name,name,email,segment_code,legal_basis,metatake_url,jurisdiction"
        "&email=not.is.null&stage=eq.none&kr_law_flag=eq.false&legal_basis=not.is.null"
        "&order=id.desc&limit=60", service=True) or []
    seen, picked = set(), []
    for ct in conts:
        if ct.get("legal_basis") == "기타":
            continue
        key = (ct.get("org_name") or "").lower()
        if key in seen:
            continue
        seen.add(key)
        # 매칭 오퍼(있으면)
        offs = c.sb_get(env, f"crm_offers?select=title,coupling,depth&segment_code=eq.{ct['segment_code']}&status=eq.active&order=sort&limit=1", service=True) or []
        ct["_offer"] = offs[0] if offs else None
        ct["_score"], ct["_bd"] = score_contact(ct, bool(offs))
        picked.append(ct)
        if len(picked) >= n_contacts:
            break
    return top_ch, picked


def _terms_for(name: str) -> list:
    left = name.split("—")[0].strip()
    return [left] + [w for w in left.split() if len(w) > 3]


def research_context(terms: list, max_chars: int = 1600) -> str:
    """과거 자료 검색 — '모른다'고 하기 전에 저장소 문서·데이터 카드를 먼저 뒤진다.
    (오너 지침 2026-07-18: 과거에 함께 만든 자료가 있으면 반드시 찾아 반영하라.)"""
    import glob
    files = (glob.glob(str(c.REPO / "HANDOFF*.md"))
             + glob.glob(str(c.REPO / "docs" / "*.md"))
             + glob.glob(str(c.REPO / "datasets" / "**" / "*.md"), recursive=True)
             + [str(c.REPO / "lib" / "datasets.ts")])
    low = [t.lower() for t in terms if t]
    hits, seen, total, out = [], set(), 0, []
    for fp in files:
        try:
            lines = Path(fp).read_text(errors="ignore").splitlines()
        except Exception:
            continue
        for i, ln in enumerate(lines):
            if any(t in ln.lower() for t in low):
                ctx = " ".join(x.strip() for x in lines[max(0, i - 1):i + 2]).strip()
                hits.append(f"[{Path(fp).name}] {ctx}")
    for h in hits:
        k = h[:90]
        if k in seen:
            continue
        seen.add(k)
        if total + len(h) > max_chars:
            break
        out.append(h)
        total += len(h)
    return "\n".join(out)


def build_prompt(channels: list, contacts: list) -> str:
    lines = ["아래는 오늘 선정된 접점 후보다. 각 건에 대해 (1) 상대에게 보낼 초안과 "
             "(2) 오너용 한국어 근거를 만들어라.\n"]
    idx = 0
    for ch in channels:
        idx += 1
        lines.append(f"[{idx}] 유형=초대된창구({ch['channel_type']}) | {ch['name']}")
        lines.append(f"    제출지점: {ch['channel_url']}")
        lines.append(f"    그들이 문 연 이유: {ch.get('their_benefit')}")
        lines.append(f"    심사 기준: {ch.get('screening_policy')}")
        lines.append(f"    우리 적합: {ch.get('our_fit')}")
        ctx = research_context(_terms_for(ch["name"]))
        if ctx:
            lines.append(f"    ⟨과거 자료(우리 문서에서 검색됨 — 사실 근거로 사용, 지어내기 금지)⟩: {ctx[:700]}")
        lines.append(f"    점수: {ch['_bd']}")
    for ct in contacts:
        idx += 1
        off = ct.get("_offer") or {}
        lines.append(f"[{idx}] 유형=콜드컨택(email) | {ct['org_name']} (세그먼트 {ct['segment_code']}, {ct.get('jurisdiction')})")
        lines.append(f"    제출지점(이메일): {ct.get('email')}")
        lines.append(f"    매칭 오퍼: {off.get('title','(없음)')} | 결합점: {off.get('coupling','')}")
        lines.append(f"    우리 페이지 링크(있으면 개인화): {ct.get('metatake_url') or '(없음)'}")
        lines.append(f"    점수: {ct['_bd']}")
    return "\n".join(lines)


SYSTEM = f"""너는 Metatake의 총괄비서(CRM 에이전트)다. 사장(오너, Wonwoo Yoon)을 최고의 의사결정자로 대하며, 공동 목표(metatake의 근본적 비즈니스 접점 확대)를 위해 일한다.

{ASSET_SHEET}

전략 원칙(모드 B = 초대된 창구):
- 콜드로 찌르지 말고, 상대가 자기 이익을 위해 열어둔 창구에 그들의 정책 언어로 지원한다.
- 상대의 존재이유·mandate에서 출발한다("우리가 대단하다"가 아니라 "당신에게 이것이 왜 이득인가").
- 예의 있게, 그들의 인터페이스 형식에 맞춰. 심사·거절은 정상이며 존중한다.
- 발신 신원은 투명하게(Wonwoo Yoon, wonwoo@metatake.net). 가공 인물 금지.
- 과장 절대 금지: 위 자산 시트에 없는 수치·권위·트래픽을 지어내지 말 것. 초기 단계임을 숨기지 말 것.

초안 작성:
- 초대된 창구: 그 창구의 지원서/신청서에 맞는 간결한 영어 초안(제목+본문). 본문 120~200단어.
- 콜드 컨택: 상대 세그먼트에 맞는 간결한 영어 초안(제목+본문 120~180단어). 개인화 링크가 있으면 자연스럽게 1회 인용.
- 모든 초안은 상대가 '검토할 이유'가 분명해야 한다.

각 건의 오너용 한국어 3필드:
- structure_ko: 초안의 주요 구조를 2~3문장으로 (무엇을·어떤 순서로 말하는가)
- rationale_ko: 왜 이것이 우리에게 중요한가 (전략적 이유)
- why_today_ko: 여러 후보 중 왜 오늘 이것을 골랐는가 (점수·적합·시의성 근거를 실제로 언급)

반드시 아래 JSON만 출력(설명 금지):
{{"items":[{{"idx":1,"draft_subject":"...","draft_body":"...","structure_ko":"...","rationale_ko":"...","why_today_ko":"..."}}, ...]}}
idx는 입력의 [n]과 일치시켜라."""


def render_html(kind_ko: str, items: list, summary_ko: str) -> str:
    css = ("font-family:-apple-system,Segoe UI,Roboto,'Apple SD Gothic Neo',sans-serif;"
           "color:#1a1a1a;line-height:1.6;")
    cards = []
    for it in items:
        badge = "초대된 창구" if it["item_type"] == "channel" else "콜드 컨택"
        badge_bg = "#0e5a3a" if it["item_type"] == "channel" else "#7a4a10"
        submit = it.get("submit_target") or ""
        submit_html = (f'<div style="font-size:13px;color:#555;margin:6px 0;">제출: '
                       f'<a href="{submit}" style="color:#0e5a3a;">{submit}</a></div>') if submit else ""
        draft = (it.get("draft_subject") or "", it.get("draft_body") or "")
        cards.append(f"""
        <div style="border:1px solid #e3e3e3;border-radius:10px;padding:16px 18px;margin:14px 0;background:#fff;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:700;font-size:15px;">#{it['rank']}. {it['title']}</span>
            <span style="font-size:11px;color:#fff;background:{badge_bg};padding:2px 8px;border-radius:10px;">{badge} · 점수 {int(it['score'])}</span>
          </div>
          {submit_html}
          <div style="margin:10px 0 4px;font-size:13px;color:#0e5a3a;font-weight:700;">왜 우리에게 중요한가</div>
          <div style="font-size:14px;">{it['rationale_ko']}</div>
          <div style="margin:10px 0 4px;font-size:13px;color:#0e5a3a;font-weight:700;">왜 오늘 이것인가</div>
          <div style="font-size:14px;">{it['why_today_ko']}</div>
          <div style="margin:10px 0 4px;font-size:13px;color:#0e5a3a;font-weight:700;">초안 구조</div>
          <div style="font-size:14px;">{it['structure_ko']}</div>
          <details style="margin-top:10px;">
            <summary style="cursor:pointer;font-size:13px;color:#333;font-weight:700;">📄 초안 전문 (제목+본문)</summary>
            <div style="background:#f6f7f8;border-radius:8px;padding:12px;margin-top:8px;font-size:13px;white-space:pre-wrap;">
<b>Subject:</b> {draft[0]}

{draft[1]}</div>
          </details>
        </div>""")
    return f"""<div style="{css}max-width:720px;margin:0 auto;padding:8px;">
      <div style="border-bottom:3px solid #0e5a3a;padding-bottom:12px;margin-bottom:6px;">
        <div style="font-size:12px;color:#0e5a3a;letter-spacing:1px;">METATAKE · 총괄비서 브리핑</div>
        <h2 style="margin:6px 0 2px;font-size:22px;">오늘의 {kind_ko}</h2>
        <div style="font-size:13px;color:#666;">사장님, 아래는 오늘 제가 우선순위를 매겨 올리는 제안입니다. 판단만 해주십시오.</div>
      </div>
      <div style="background:#f0f6f2;border-radius:10px;padding:14px 16px;margin:12px 0;font-size:14px;">
        <b>오늘의 총평</b><br>{summary_ko}
      </div>
      {''.join(cards)}
      <div style="border-top:1px solid #e3e3e3;margin-top:18px;padding-top:12px;font-size:12px;color:#888;">
        · <b>초대된 창구</b> 항목은 상대가 연 문입니다 — OK하시면 위 '제출' 링크로 초안을 넣으시면 됩니다(자동발송 아님, 그들의 인터페이스).<br>
        · <b>콜드 컨택</b> 항목의 원클릭 OK→자동발송 버튼(웹·모바일)은 다음 빌드입니다. 지금은 이 메일에 <b>회신으로 코멘트</b> 주시면 다음 브리핑에 반영합니다.<br>
        · 이 브리핑은 전부 <b>초안</b>이며, 상대에게 발송된 것은 <b>한 건도 없습니다</b>. 발신 예정 신원: Wonwoo Yoon &lt;wonwoo@metatake.net&gt;.<br>
        · 모든 항목은 클라이언트별로 기록되어 다음 컨택·회신 때 참조됩니다.
      </div>
    </div>"""


import urllib.parse, urllib.request, urllib.error  # noqa: E402


def gmail_token(env: dict) -> str | None:
    body = urllib.parse.urlencode({
        "client_id": env["GMAIL_CLIENT_ID"], "client_secret": env["GMAIL_CLIENT_SECRET"],
        "refresh_token": env["GMAIL_REFRESH_TOKEN"], "grant_type": "refresh_token"}).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request(
                "https://oauth2.googleapis.com/token", data=body,
                headers={"Content-Type": "application/x-www-form-urlencoded"})) as r:
            return json.loads(r.read())["access_token"]
    except urllib.error.HTTPError as e:
        c.log(f"gmail token {e.code} {e.read().decode()[:200]}")
        return None


def gmail_send(env: dict, to_list: list, subject: str, html: str,
               thread_id: str | None = None, in_reply_to: str | None = None) -> tuple[bool, str, str]:
    """Returns (ok, message_id, thread_id)."""
    at = gmail_token(env)
    if not at:
        return False, "no-token", ""
    msg = MIMEText(html, "html", "utf-8")
    msg["From"] = f"Metatake 총괄비서 <{FROM_ADDR}>"
    msg["To"] = ", ".join(to_list)
    msg["Subject"] = subject
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
        msg["References"] = in_reply_to
    raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    payload = {"raw": raw}
    if thread_id:
        payload["threadId"] = thread_id
    req = urllib.request.Request(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        data=json.dumps(payload).encode(),
        headers={"Authorization": "Bearer " + at, "Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req) as r:
            j = json.loads(r.read())
            return True, j.get("id", "sent"), j.get("threadId", thread_id or "")
    except urllib.error.HTTPError as e:
        return False, f"send {e.code} {e.read().decode()[:300]}", ""


def gmail_get_thread(env: dict, thread_id: str) -> dict | None:
    at = gmail_token(env)
    if not at:
        return None
    req = urllib.request.Request(
        f"https://gmail.googleapis.com/gmail/v1/users/me/threads/{thread_id}?format=full",
        headers={"Authorization": "Bearer " + at})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        c.log(f"get_thread {e.code} {e.read().decode()[:200]}")
        return None


def _payload_text(payload: dict) -> str:
    """Decode a Gmail message payload to plain text (prefer text/plain)."""
    import re

    def walk(p, want):
        if p.get("mimeType") == want and p.get("body", {}).get("data"):
            return base64.urlsafe_b64decode(p["body"]["data"] + "===").decode("utf-8", "ignore")
        for part in p.get("parts", []) or []:
            t = walk(part, want)
            if t:
                return t
        return ""
    txt = walk(payload, "text/plain")
    if not txt:
        html = walk(payload, "text/html")
        txt = re.sub(r"<[^>]+>", " ", html)
    return txt


def _strip_quoted(text: str) -> str:
    """Keep only the new reply text, drop quoted original."""
    import re
    out = []
    for ln in text.splitlines():
        s = ln.strip()
        if s.startswith(">"):
            break
        if re.match(r"^On .*wrote:$", s) or s.endswith("작성:") or ("wrote:" in s and "@" in s):
            break
        out.append(ln)
    return "\n".join(out).strip()


def extract_owner_reply(env: dict, thread: dict, our_ids: set | None = None) -> tuple[str, str] | None:
    """Newest message that is NOT one we sent = the owner's reply.
    오너도 wonwoo@metatake.net에서 회신하므로 발신자로 구분 불가 → 우리가 보낸 메시지의
    Gmail id(브리핑 meta에 저장)로 우리 것을 제외하고, 콘텐츠 마커로 이중 방어."""
    our_ids = our_ids or set()
    msgs = thread.get("messages", []) or []
    for m in reversed(msgs):
        if m.get("id") in our_ids:
            continue
        text = _strip_quoted(_payload_text(m.get("payload", {})))
        if not text or "METATAKE · 총괄비서" in text:  # 빈 텍스트 또는 우리 브리핑/최종본이 새어든 경우
            continue
        hdrs = {h["name"].lower(): h["value"] for h in m.get("payload", {}).get("headers", [])}
        return text, hdrs.get("message-id", ""), m.get("id")
    return None


REPLY_SYSTEM = f"""너는 Metatake의 총괄비서다. 오너(Wonwoo Yoon)를 최고의 의사결정자로 대한다. 오너가 오늘 브리핑에 회신으로 코멘트를 남겼다 — 자유로운 한국어이고, 번호/이름으로 특정 항목을 지목하거나 전체에 대한 지시일 수 있다.

{ASSET_SHEET}

각 항목에 대해:
- decision: "ok"(그대로 승인) | "revise"(수정) | "skip"(오늘 보류)
- owner_comment: 그 항목에 대한 오너 지시를 한국어로 요약(전체 지시면 그것을 반영, 정말 없으면 "")
- applied_ko: 그 코멘트를 초안에 '어떻게' 반영했는지 한국어 1~2문장(변경 없으면 "변경 없음")
- decision이 revise면 revised_subject/revised_body(영문 초안 전문)를 제시. 오너 지시를 충실히 반영하되 위 자산 시트에 없는 수치·권위·트래픽 과장 금지·정직 유지.
- ⚠️오너가 비서가 모르는 외부 정보(예: 오너의 기존 신청·계정·저작권 상태)를 언급하면 **절대 지어내지 말 것**. 그런 항목은 초안을 그 사실을 반영할 자리를 비워 두고(플레이스홀더 대신 정직한 문구), applied_ko에 "무엇을 확인/제공해야 초안을 완성할 수 있는지"를 명확히 적어라(오너를 의사결정자로 대함).

전역 학습 신호도 추출(feedback): 예) "너무 격식적"→scope=tone; 특정 세그먼트 선호/제외→scope=segment; 특정 창구 제외→scope=channel.
reply_understanding_ko: 오너의 회신을 어떻게 이해했는지 1~2문장.

반드시 아래 JSON만 출력(설명 금지):
{{"reply_understanding_ko":"...","items":[{{"idx":1,"decision":"revise","owner_comment":"...","applied_ko":"...","revised_subject":"...","revised_body":"..."}}],"feedback":[{{"scope":"tone","scope_key":"","signal":"..."}}]}}
idx는 입력 [n]과 일치시켜라."""


def render_final_html(understanding_ko: str, items: list, n_feedback: int) -> str:
    css = ("font-family:-apple-system,Segoe UI,Roboto,'Apple SD Gothic Neo',sans-serif;"
           "color:#1a1a1a;line-height:1.6;")
    badge_map = {"ok": ("승인 · 그대로", "#0e5a3a"), "revise": ("수정 반영", "#1c4fd8"),
                 "skip": ("오늘 보류", "#8a8a8a")}
    cards = []
    for it in items:
        label, bg = badge_map.get(it.get("owner_decision", "ok"), badge_map["ok"])
        draft_html = "" if it.get("owner_decision") == "skip" else f"""
          <div style="margin:10px 0 4px;font-size:13px;color:#1c4fd8;font-weight:700;">최종 초안</div>
          <div style="background:#f6f7f8;border-radius:8px;padding:12px;font-size:13px;white-space:pre-wrap;">
<b>Subject:</b> {it.get('final_subject','')}

{it.get('final_body','')}</div>"""
        cards.append(f"""
        <div style="border:1px solid #e3e3e3;border-radius:10px;padding:16px 18px;margin:14px 0;background:#fff;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:700;font-size:15px;">#{it['_idx']}. {it['_title']}</span>
            <span style="font-size:11px;color:#fff;background:{bg};padding:2px 8px;border-radius:10px;">{label}</span>
          </div>
          <div style="margin:10px 0 4px;font-size:13px;color:#7a4a10;font-weight:700;">당신의 코멘트</div>
          <div style="font-size:14px;">{it.get('owner_comment') or '(이 항목에 대한 개별 코멘트 없음)'}</div>
          <div style="margin:10px 0 4px;font-size:13px;color:#1c4fd8;font-weight:700;">어떻게 반영했는가</div>
          <div style="font-size:14px;">{it.get('applied_ko') or '변경 없음'}</div>
          {draft_html}
        </div>""")
    return f"""<div style="{css}max-width:720px;margin:0 auto;padding:8px;">
      <div style="border-bottom:3px solid #1c4fd8;padding-bottom:12px;margin-bottom:6px;">
        <div style="font-size:12px;color:#1c4fd8;letter-spacing:1px;">METATAKE · 총괄비서 · 최종본</div>
        <h2 style="margin:6px 0 2px;font-size:22px;">회신 반영 완료</h2>
      </div>
      <div style="background:#eef2fd;border-radius:10px;padding:14px 16px;margin:12px 0;font-size:14px;">
        <b>당신의 회신을 이렇게 이해했습니다</b><br>{understanding_ko}
      </div>
      {''.join(cards)}
      <div style="border-top:1px solid #e3e3e3;margin-top:18px;padding-top:12px;font-size:12px;color:#888;">
        · 승인(초대된 창구) 항목은 각 초안을 그들의 인터페이스(제출 링크)로 넣으시면 됩니다 — 자동발송 아님.<br>
        · 이번 회신에서 <b>학습 신호 {n_feedback}건</b>을 기록했고, 다음 브리핑의 점수·톤에 반영됩니다.<br>
        · 여전히 상대에게 발송된 것은 <b>0건</b>입니다. 추가 수정이 있으면 이 메일에 다시 회신해 주세요.
      </div>
    </div>"""


def process_reply(env: dict, briefing_id: int | None = None) -> int:
    if briefing_id:
        b = c.sb_get(env, f"crm_briefings?select=id,meta,kind&id=eq.{briefing_id}", service=True)
    else:
        b = c.sb_get(env, "crm_briefings?select=id,meta,kind&status=neq.closed&order=id.desc&limit=1", service=True)
    if not b:
        c.log("no briefing found"); return 1
    b = b[0]; bid = b["id"]; meta = b.get("meta") or {}
    thread_id = meta.get("gmail_thread_id")
    if not thread_id:
        c.log(f"briefing {bid} has no gmail_thread_id — cannot read reply"); return 1
    thread = gmail_get_thread(env, thread_id)
    if not thread:
        c.log("thread fetch failed"); return 1
    our_ids = set(filter(None, [meta.get("gmail_message_id")] + (meta.get("our_message_ids") or [])))
    rep = extract_owner_reply(env, thread, our_ids)
    if not rep:
        c.log("no new owner reply"); return 2
    reply_text, reply_msgid, reply_gid = rep
    if reply_gid and reply_gid == meta.get("last_processed_reply_id"):
        c.log("no new owner reply (already processed)"); return 2
    c.log(f"owner reply captured ({len(reply_text)} chars) on briefing {bid}")

    items = c.sb_get(env, f"crm_briefing_items?select=*&briefing_id=eq.{bid}&order=id.asc", service=True) or []
    for i, it in enumerate(items, start=1):
        it["_idx"] = i
        if it["item_type"] == "channel" and it.get("channel_id"):
            r = c.sb_get(env, f"crm_channels?select=name&id=eq.{it['channel_id']}", service=True)
            it["_title"] = r[0]["name"] if r else (it.get("draft_subject") or "항목")
        elif it.get("contact_id"):
            r = c.sb_get(env, f"crm_contacts?select=org_name&id=eq.{it['contact_id']}", service=True)
            it["_title"] = r[0]["org_name"] if r else (it.get("draft_subject") or "항목")
        else:
            it["_title"] = it.get("draft_subject") or "항목"

    lines = ["오늘 브리핑 항목(초안 포함):"]
    for it in items:
        lines.append(f"[{it['_idx']}] {it['_title']}")
        lines.append(f"    현재 제목: {it.get('draft_subject','')}")
        lines.append(f"    현재 본문: {it.get('draft_body','')}")
    lines.append("\n오너의 회신 원문:\n" + reply_text)
    c.log("calling Opus to interpret reply + revise …")
    out = c.anthropic_call(env, model=OPUS, system=REPLY_SYSTEM, user="\n".join(lines), max_tokens=8192)
    parsed = c.parse_json_block(out) if out else None
    if not parsed or "items" not in parsed:
        c.log("reply model returned no parseable items"); return 1
    by_idx = {int(i.get("idx", 0)): i for i in parsed["items"]}

    render = []
    for it in items:
        g = by_idx.get(it["_idx"], {})
        decision = g.get("decision", "ok")
        decision = decision if decision in ("ok", "revise", "skip") else "ok"
        patch = {"owner_decision": decision, "owner_comment": g.get("owner_comment", ""), "decided_at": c.now_utc()}
        if decision == "revise":
            if g.get("revised_subject"):
                patch["draft_subject"] = g["revised_subject"]
            if g.get("revised_body"):
                patch["draft_body"] = g["revised_body"]
        c.sb_update(env, "crm_briefing_items", f"id=eq.{it['id']}", patch)
        render.append({**it, **patch, "applied_ko": g.get("applied_ko", "변경 없음"),
                       "final_subject": patch.get("draft_subject", it.get("draft_subject", "")),
                       "final_body": patch.get("draft_body", it.get("draft_body", ""))})

    fb = parsed.get("feedback", []) or []
    for f in fb:
        c.sb_insert(env, "crm_feedback", {"scope": f.get("scope", "global"),
            "scope_key": f.get("scope_key"), "signal": (f.get("signal", "") or "")[:400], "weight": 1})
    c.sb_update(env, "crm_briefings", f"id=eq.{bid}", {"status": "partly_acted"})

    understanding = parsed.get("reply_understanding_ko", "회신을 반영했습니다.")
    html = render_final_html(understanding, render, len(fb))
    Path(c.REPO / "worker" / "_last_final.html").write_text(html)
    ok, msg, _ = gmail_send(env, OWNER_TO, "[Metatake 총괄비서] 최종본 — 회신 반영 완료",
                            html, thread_id=thread_id, in_reply_to=reply_msgid)
    c.log(f"final email -> {'SENT ' + msg if ok else 'FAIL ' + msg} | 학습 {len(fb)}건 기록")
    if ok:
        nm = dict(meta)
        nm["our_message_ids"] = list(our_ids | {msg})
        nm["last_processed_reply_id"] = reply_gid
        c.sb_update(env, "crm_briefings", f"id=eq.{bid}", {"meta": nm})
    return 0 if ok else 1


REDRAFT_SYSTEM = f"""너는 Metatake 총괄비서다. 오너가 특정 항목에 대해 '과거 자료를 찾아 반영하라'고 지시했다. 아래에 우리 문서에서 검색된 과거 자료가 주어진다. 그 실제 값(데이터셋 이름·URL·수치·라이선스)만 사용하고 **절대 지어내지 마라.** 과거 자료에 없으면 그 부분은 정직하게 비워라.

{ASSET_SHEET}

반드시 아래 JSON만 출력(설명 금지):
{{"found_summary_ko":"<과거 자료에서 확인한 핵심 사실 요약(한국어 2~3문장)>","changes_ko":"<이전 초안 대비 무엇을 왜 바꿨는지(한국어)>","draft_subject":"<영문 제목>","draft_body":"<영문 본문 120~220단어>"}}"""


def render_redraft_html(name: str, found_ko: str, changes_ko: str, subject: str, body: str, submit: str) -> str:
    css = "font-family:-apple-system,Segoe UI,Roboto,'Apple SD Gothic Neo',sans-serif;color:#1a1a1a;line-height:1.6;"
    return f"""<div style="{css}max-width:720px;margin:0 auto;padding:8px;">
      <div style="border-bottom:3px solid #b8860b;padding-bottom:12px;margin-bottom:6px;">
        <div style="font-size:12px;color:#b8860b;letter-spacing:1px;">METATAKE · 총괄비서 · 수정 재제출</div>
        <h2 style="margin:6px 0 2px;font-size:21px;">{name}</h2>
        <div style="font-size:13px;color:#666;">과거 자료를 찾아 반영했습니다. 확인 후 컨펌해 주십시오.</div>
      </div>
      <div style="background:#fbf6e9;border-radius:10px;padding:14px 16px;margin:12px 0;font-size:14px;">
        <b>📚 우리 과거 자료에서 확인한 사실</b><br>{found_ko}
      </div>
      <div style="background:#eef2fd;border-radius:10px;padding:14px 16px;margin:12px 0;font-size:14px;">
        <b>✏️ 무엇을 바꿨는가</b><br>{changes_ko}
      </div>
      <div style="font-size:13px;color:#555;margin:6px 0;">제출: <a href="{submit}" style="color:#0e5a3a;">{submit}</a></div>
      <div style="background:#f6f7f8;border-radius:8px;padding:12px;font-size:13px;white-space:pre-wrap;">
<b>Subject:</b> {subject}

{body}</div>
      <div style="border-top:1px solid #e3e3e3;margin-top:18px;padding-top:12px;font-size:12px;color:#888;">
        컨펌하시면 이 초안으로 확정합니다(초대된 창구는 위 제출 링크로 넣으시면 됩니다). 추가 수정은 이 메일에 회신해 주세요. 상대 발송 0건.
      </div>
    </div>"""


def redraft_item(env: dict, substr: str) -> int:
    b = c.sb_get(env, "crm_briefings?select=id,meta&status=neq.closed&order=id.desc&limit=1", service=True)
    if not b:
        c.log("no open briefing"); return 1
    bid = b[0]["id"]; meta = b[0].get("meta") or {}
    items = c.sb_get(env, f"crm_briefing_items?select=*&briefing_id=eq.{bid}", service=True) or []
    target = ch = None
    for it in items:
        if it.get("channel_id"):
            r = c.sb_get(env, f"crm_channels?select=*&id=eq.{it['channel_id']}", service=True)
            if r and substr.lower() in r[0]["name"].lower():
                target, ch = it, r[0]; break
    if not target:
        c.log(f"item matching '{substr}' not found in briefing {bid}"); return 1
    ctx = research_context(_terms_for(ch["name"]))
    c.log(f"redraft '{ch['name']}': found {len(ctx)} chars of past material")
    user = (f"창구: {ch['name']} ({ch['channel_type']})\n제출지점: {ch['channel_url']}\n"
            f"그들이 문 연 이유: {ch.get('their_benefit')}\n심사 기준: {ch.get('screening_policy')}\n"
            f"오너 지적: {target.get('owner_comment')}\n\n현재(부정확) 초안:\n제목: {target.get('draft_subject')}\n"
            f"본문: {target.get('draft_body')}\n\n우리 과거 자료(반드시 이 실제 값만 사용):\n{ctx or '(검색 결과 없음)'}\n\n"
            f"위 과거 자료를 반영해 정확한 초안으로 고쳐라.")
    out = c.anthropic_call(env, model=OPUS, system=REDRAFT_SYSTEM, user=user, max_tokens=3000)
    p = c.parse_json_block(out) if out else None
    if not p or not p.get("draft_body"):
        c.log("redraft model failed"); return 1
    c.sb_update(env, "crm_briefing_items", f"id=eq.{target['id']}",
                {"draft_subject": p.get("draft_subject", ""), "draft_body": p["draft_body"],
                 "owner_decision": "pending", "decided_at": None})
    if p.get("found_summary_ko"):
        c.sb_update(env, "crm_channels", f"id=eq.{ch['id']}", {"our_fit": (ch.get("our_fit") or "") + " | 갱신: " + p["found_summary_ko"][:300]})
    html = render_redraft_html(ch["name"], p.get("found_summary_ko", ""), p.get("changes_ko", ""),
                               p.get("draft_subject", ""), p["draft_body"], ch["channel_url"])
    Path(c.REPO / "worker" / "_last_redraft.html").write_text(html)
    ok, msg, _ = gmail_send(env, OWNER_TO, f"[Metatake 총괄비서] 수정 재제출 — {ch['name'].split('—')[0].strip()}",
                            html, thread_id=meta.get("gmail_thread_id"))
    c.log(f"redraft email -> {'SENT ' + msg if ok else 'FAIL ' + msg}")
    return 0 if ok else 1


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", action="store_true")
    ap.add_argument("--redraft", type=str, default=None, help="특정 항목을 과거 자료 반영해 재초안·재발송(이름 부분일치)")
    ap.add_argument("--n", type=int, default=10)
    ap.add_argument("--contacts", type=int, default=2)
    ap.add_argument("--no-send", action="store_true")
    ap.add_argument("--dry", action="store_true", help="초안 생성·적재 없이 선정만 출력")
    ap.add_argument("--reply", action="store_true", help="브리핑 스레드의 오너 회신을 읽어 최종본 발송")
    ap.add_argument("--briefing", type=int, default=None, help="--reply 대상 브리핑 id(기본: 최신)")
    args = ap.parse_args()
    env = c.load_env()

    if args.reply:
        return process_reply(env, args.briefing)

    if args.redraft:
        return redraft_item(env, args.redraft)

    if args.seed:
        seed_channels(env)

    n_ch = max(0, args.n - args.contacts)
    channels, contacts = gather_pool(env, n_ch, args.contacts)
    c.log(f"pool: {len(channels)} channels + {len(contacts)} contacts")
    if args.dry:
        for x in channels:
            c.log(f"  CH {x['_score']:.0f} {x['name']}")
        for x in contacts:
            c.log(f"  CT {x['_score']:.0f} {x['org_name']}")
        return 0

    prompt = build_prompt(channels, contacts)
    c.log("calling Opus for drafts + rationale …")
    out = c.anthropic_call(env, model=OPUS, system=SYSTEM, user=prompt, max_tokens=8192)
    parsed = c.parse_json_block(out) if out else None
    if not parsed or "items" not in parsed:
        c.log("model returned no parseable items; abort.")
        return 1
    by_idx = {int(i.get("idx", 0)): i for i in parsed["items"]}

    # 브리핑 헤더
    brief = sb_insert_returning(env, "crm_briefings",
        {"kind": "proposals", "status": "open",
         "meta": {"n_channels": len(channels), "n_contacts": len(contacts), "generated_by": "crm-agent"}})
    if not brief:
        c.log("briefing insert failed; abort.")
        return 1
    bid = brief["id"]

    render_items, rank = [], 0
    combined = [("channel", x) for x in channels] + [("contact", x) for x in contacts]
    for i, (kind, obj) in enumerate(combined, start=1):
        gen = by_idx.get(i, {})
        rank += 1
        title = obj["name"] if kind == "channel" else obj["org_name"]
        submit = obj["channel_url"] if kind == "channel" else obj.get("email")
        row = {
            "briefing_id": bid, "item_type": kind,
            "channel_id": obj["id"] if kind == "channel" else None,
            "contact_id": obj["id"] if kind == "contact" else None,
            "submit_target": submit,
            "draft_subject": gen.get("draft_subject", ""),
            "draft_body": gen.get("draft_body", "(초안 생성 실패)"),
            "score": obj["_score"], "score_breakdown": obj["_bd"],
            "structure_ko": gen.get("structure_ko", ""),
            "rationale_ko": gen.get("rationale_ko", ""),
            "why_today_ko": gen.get("why_today_ko", ""),
        }
        sb_insert_returning(env, "crm_briefing_items", row)
        render_items.append({**row, "rank": rank, "title": title})

    # 총평 (정확히 2~3 평서문 · 마크다운 금지 · 후보 제목만 전달해 과생성 방지)
    titles = "; ".join(f"{it['rank']}. {it['title']}(점수 {int(it['score'])})" for it in render_items)
    summary = c.anthropic_call(env, model=OPUS,
        system="너는 Metatake 총괄비서다. 정확히 2~3개의 평서문(한국어)으로 오늘의 총평을 써라. "
               "마크다운·머리표·제목·번호·불릿 절대 금지. 과장 없이, 오너를 최고의 의사결정자로 대하며, "
               "오늘 우선순위 판단의 핵심 근거(왜 초대된 창구 위주인지, 왜 이 순서인지)만 담아라.",
        user="오늘 선정된 제안 목록: " + titles, max_tokens=300) \
        or "오늘은 상대가 이미 열어둔 심사 창구 위주로, 통과 확률과 전략 가치가 높은 순으로 선정했습니다."
    summary = summary.strip().lstrip("#").strip()

    html = render_html("신규 제안", render_items, summary.strip())
    Path(c.REPO / "worker" / "_last_briefing.html").write_text(html)  # 로컬 미리보기

    if args.no_send:
        c.log("no-send: HTML saved to worker/_last_briefing.html")
        return 0
    ok, msg, thread_id = gmail_send(env, OWNER_TO, f"[Metatake 총괄비서] 오늘의 신규 제안 {len(render_items)}건", html)
    c.log(f"briefing email -> {'SENT ' + msg + ' thread=' + thread_id if ok else 'FAIL ' + msg}")
    if ok:
        meta = dict(brief.get("meta") or {})
        meta.update({"gmail_message_id": msg, "gmail_thread_id": thread_id})
        c.sb_update(env, "crm_briefings", f"id=eq.{bid}", {"summary_ko": summary, "meta": meta})
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
