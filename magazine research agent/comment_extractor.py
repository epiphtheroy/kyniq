"""
comment_extractor.py
─────────────────────
영화별 "주요 매체 코멘트" 박스를 채우는 추출기.

설계 원칙(앞선 논의의 tier-3):
  1) 기사 본문 전체를 수집/저장하지 않는다.
  2) 코멘트는 '사다리' 순으로 가장 안전·풍부한 필드에서 가져온다:
       (a) 발행사 dek / og:description / meta description / twitter:description
           → 발행사가 '링크 미리보기용'으로 공개한 redistribution 필드.
       (b) JSON-LD Review.reviewBody / Article.description (구조화 메타데이터).
       (c) 학술은 OpenAlex/Crossref 초록.
       (d) 위 텍스트에서 ≤MAX_WORDS(기본 10) 단어의 '연속 축어' verdict 구간.
  3) verdict는 반드시 원문에 '정확히 존재하는 부분문자열'만 채택(패러프레이즈·생성 금지).
  4) 매체당 코멘트 1개로 제한(원문 재구성 방지). 출처표시 + 링크 필수.
  5) robots.txt를 존중. 가져오는 페이지는 '내가 링크할 그 페이지' 1건뿐.
  6) 제목(title)은 항상 그대로 보존한다. verdict가 없으면 comment는 제목으로 폴백.

출력 스키마(= *_enriched.csv 와 동일):
  id,type,outlet,critic,year,language,tier,title,comment,verdict_le10,verbatim_verified,dek_lead,url
  - tier        : "verdict"(축어 평가 확보) | "title"(폴백; 요약·초록 없음)
  - title       : 기사·논문 원제목(그대로). 박스에서 코멘트 '아래'.
  - comment     : 박스 상단(핵심). verdict 있으면 그 값, 없으면 title.
  - verdict_le10: ≤10단어 축어 평가(없으면 "").
  - dek_lead    : 발행사 요약/초록 앞부분(근거·검증용).

법적 메모(요지): 짧은 축어 인용 + 출처표시 + 링크는 대체로 '인용'(한국 저작권법 §28 등)의
전형이다. 다만 한 출처에서 여러 조각을 모아 원문을 재구성하면 인용을 벗어난다 → 매체당 1개.
이 스크립트는 '메타데이터/짧은 축어'만 다루며, 본문 보존·대량 발췌는 하지 않는다.
변호사 자문은 아니며, 다국적 매체 취급 방침은 별도 검토 권장.
"""

from __future__ import annotations
import csv, json, re, sys, time, html
from dataclasses import dataclass, asdict
from urllib import robotparser, request, parse
from urllib.request import Request, urlopen

MAX_WORDS = 10
UA = "MetatakeCommentBot/1.0 (+contact@yourdomain.example; respects robots.txt)"
TIMEOUT = 15

# 평가성 단서(코멘트다움 판정용, 다국어). 필요시 계속 확장(handover §7 참고).
CUES = [
    # en
    "masterpiece","remarkable","brilliant","best","stunning","powerful","precise","sterile",
    "cool","icy","slow-burn","slow-burning","thriller","melodrama","paranoia","culmination",
    "breakthrough","subtle","restrained","tense","haunting","quiet","austere","triumph","flawed",
    "neat","calculated","pat","compelling","exhilarating","devastating","luminous",
    "minimalist","minimalism","compact","probing","profound","revelatory","elemental","droll",
    "slight","ponderous","expressive","humour","humor","didactic","treat","spare","tender",
    "gem","gems","masterful","poignant","delicate","playful","sly","slyly","pleasurable","gentle",
    # de
    "meisterwerk","brillant","beste","kühl","spannung","melodram","paranoia","fremd","perspektive",
    "eindrucksvoll",
    # fr
    "remarquable","chef-d'œuvre","anatomie","subtil","glaçant","maîtrise",
    # es/it/pt
    "obra maestra","notable","sutil","capolavoro","scelta","obra-prima",
]

def fetch(url: str) -> str | None:
    """robots 허용 시에만 단일 페이지 GET. 본문 저장하지 않고 head/meta 파싱에만 사용."""
    p = parse.urlparse(url)
    robots_url = f"{p.scheme}://{p.netloc}/robots.txt"
    rp = robotparser.RobotFileParser()
    try:
        rp.set_url(robots_url); rp.read()
        if not rp.can_fetch(UA, url):
            print(f"  robots disallow → skip: {url}", file=sys.stderr); return None
    except Exception:
        pass  # robots 못 읽으면 보수적으로 진행하되, 운영시 정책에 맞춰 조정
    try:
        req = Request(url, headers={"User-Agent": UA})
        with urlopen(req, timeout=TIMEOUT) as r:
            charset = r.headers.get_content_charset() or "utf-8"
            return r.read(600_000).decode(charset, "replace")  # head/meta면 충분
    except Exception as e:
        print(f"  fetch fail: {url} ({e})", file=sys.stderr); return None

def _meta(htmltext: str, key: str, attr: str = "property") -> str:
    m = re.search(rf'<meta[^>]+{attr}=["\']{re.escape(key)}["\'][^>]+content=["\'](.*?)["\']',
                  htmltext, re.I | re.S)
    if not m:
        m = re.search(rf'<meta[^>]+content=["\'](.*?)["\'][^>]+{attr}=["\']{re.escape(key)}["\']',
                      htmltext, re.I | re.S)
    return html.unescape(m.group(1)).strip() if m else ""

def _jsonld_desc(htmltext: str) -> str:
    for m in re.finditer(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', htmltext, re.S | re.I):
        try:
            data = json.loads(m.group(1).strip())
        except Exception:
            continue
        for node in (data if isinstance(data, list) else [data]):
            if not isinstance(node, dict):
                continue
            for fld in ("reviewBody", "description"):
                if node.get(fld):
                    return html.unescape(str(node[fld])).strip()
    return ""

def best_dek(htmltext: str) -> tuple[str, str]:
    """가장 풍부한 발행사 제공 요약과 그 출처 필드명을 반환."""
    for key, attr, label in [
        ("og:description", "property", "og:description"),
        ("twitter:description", "name", "twitter:description"),
        ("description", "name", "meta-description"),
    ]:
        v = _meta(htmltext, key, attr)
        if v and len(v.split()) >= 4:
            return v, label
    j = _jsonld_desc(htmltext)
    if j:
        return j, "json-ld"
    return "", ""

def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.replace("_", "")).strip()

def verdict_span(dek: str, film_title: str = "", allow_first: bool = False) -> str:
    """dek/초록에서 평가 단서를 포함한 ≤MAX_WORDS 연속 축어 구간을 추출.
    allow_first=True면(주로 학술 초록·비영어) 단서가 없을 때 첫 절의 ≤MAX_WORDS 축어로 폴백."""
    text = _norm(dek)
    if not text:
        return ""
    ft = (film_title or "").lower()
    cand = []
    # 절(.,!?…;:–—) 단위로 끊어, 단서를 포함한 3~MAX_WORDS '온전한 절'만 후보로(윈도우 절단 없음)
    for seg in re.split(r"[\.\!\?…;:–—,]\s+", text):
        seg = seg.strip().strip('"“”…').strip()
        n = len(seg.split())
        if 3 <= n <= MAX_WORDS and seg in text and any(c in seg.lower() for c in CUES):
            cand.append(seg)
    # 영화 제목을 포함하지 않는 절 우선, 그다음 더 긴(정보량 많은) 절 우선
    cand.sort(key=lambda c: (1 if ft and ft in c.lower() else 0, -len(c.split())))
    if cand:
        return cand[0]
    if allow_first:
        f = first_span(text)
        return f if f and f in text else ""
    return ""

def first_span(text: str, max_words: int = MAX_WORDS) -> str:
    """첫 문장에서 ≤max_words 연속 축어를 취하는 폴백(비영어 초록 등 단서 미검출 시)."""
    text = _norm(text)
    first = re.split(r"(?<=[\.\!\?…])\s+", text)[0] if text else ""
    words = first.split()
    return " ".join(words[:max_words]) if words else ""

def reconstruct_inverted(idx: dict) -> str:
    """OpenAlex abstract_inverted_index → 원문 초록 텍스트 복원."""
    pos = {}
    for w, ps in (idx or {}).items():
        for p in ps:
            pos[p] = w
    return " ".join(pos[i] for i in sorted(pos))

def fetch_abstract(doi: str) -> str:
    """학술 초록을 재배포 메타데이터에서 취득: OpenAlex(역색인) → Crossref(JATS 제거)."""
    doi = doi.replace("https://doi.org/", "").strip()
    try:
        u = f"https://api.openalex.org/works/doi:{parse.quote(doi)}?select=abstract_inverted_index"
        with urlopen(Request(u, headers={"User-Agent": UA}), timeout=TIMEOUT) as r:
            ab = reconstruct_inverted(json.load(r).get("abstract_inverted_index"))
        if ab:
            return ab
    except Exception:
        pass
    try:
        u = f"https://api.crossref.org/works/{parse.quote(doi)}?select=abstract"
        with urlopen(Request(u, headers={"User-Agent": UA}), timeout=TIMEOUT) as r:
            ab = json.load(r).get("message", {}).get("abstract", "")
        return re.sub(r"<[^>]+>", " ", ab).strip()
    except Exception:
        return ""

@dataclass
class Comment:
    outlet: str; critic: str; year: str; url: str
    title: str            # 기사·논문의 원제목(그대로). 박스에서 코멘트 '아래'에 표시.
    comment: str          # 박스 상단(핵심): verdict(≤10단어 축어)면 그 값, 없으면 제목으로 폴백.
    verdict_le10: str     # ≤10단어 축어 평가(없으면 "")
    tier: str             # "verdict" | "title"
    source_field: str     # og:description / twitter:description / abstract / ...
    dek_lead: str         # 발행사 요약·초록 앞부분(근거·검증용; 표시는 caller 정책)
    verbatim_verified: bool

def build_comment(url, outlet, critic, year, film_title="", title="",
                  is_academic=False, doi="") -> Comment:
    """코멘트 사다리: 학술=초록, 비평=dek/og 에서 ≤10단어 축어 verdict를 뽑는다.
    verdict가 없으면 comment는 제목(title)으로 폴백 → 박스의 '모든 칸이 채워짐'을 보장."""
    # 학술: 발행사/OpenAlex 초록에서 ≤10단어 축어(없으면 첫 절 폴백). 초록 없으면 제목.
    if is_academic and (doi or "doi.org" in url):
        d = doi or url.split("doi.org/")[-1]
        ab = fetch_abstract(d)
        if ab:
            v = verdict_span(ab, film_title, allow_first=True)
            if v:
                return Comment(outlet, critic, year, url, title, v, v, "verdict",
                               "abstract", ab[:240], v in _norm(ab))
        return Comment(outlet, critic, year, url, title, title, "", "title", "", "", False)
    # 비평: dek/og:description → ≤10단어 verdict → 제목 폴백
    htmltext = fetch(url) or ""
    dek, field = best_dek(htmltext)
    v = verdict_span(dek, film_title)
    if v:
        return Comment(outlet, critic, year, url, title, v, v, "verdict",
                       field, dek[:240], v in _norm(dek))
    return Comment(outlet, critic, year, url, title, title, "", "title", "", dek[:240], False)

def run(in_csv: str, out_csv: str, film_title: str = ""):
    """입력 CSV(id,type,outlet,critic,year,language,comment_or_title,url,note)의 각 행을 보강해
    title/comment/verdict_le10 를 채운 out_csv 를 생성. 출력 스키마는 *_enriched.csv 와 동일."""
    rows = list(csv.DictReader(open(in_csv, encoding="utf-8")))
    out = []
    for r in rows:
        is_acad = r.get("type") == "academic"
        doi = r["url"].split("doi.org/")[-1] if "doi.org/" in r["url"] else ""
        c = build_comment(r["url"], r["outlet"], r["critic"], r["year"],
                          film_title=film_title, title=r["comment_or_title"],
                          is_academic=is_acad, doi=doi)
        time.sleep(1.0)  # 예의상 rate-limit
        d = asdict(c)
        d["id"] = r["id"]; d["type"] = r["type"]; d["language"] = r.get("language", "")
        d["verbatim_verified"] = "true" if c.verbatim_verified else "false"
        out.append(d)
        print(f'  [{c.tier:8}] {c.outlet}: {c.comment[:70]}')
    cols = ["id","type","outlet","critic","year","language","tier",
            "title","comment","verdict_le10","verbatim_verified","dek_lead","url"]
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore"); w.writeheader()
        for d in out: w.writerow(d)
    print(f"\nwrote {len(out)} rows → {out_csv}")

if __name__ == "__main__":
    # 사용: python comment_extractor.py barbara_comments.csv barbara_comments_enriched.csv "Barbara"
    args = sys.argv[1:]
    src = args[0] if args else "barbara_comments.csv"
    dst = args[1] if len(args) > 1 else "barbara_comments_enriched.csv"
    film = args[2] if len(args) > 2 else ""
    run(src, dst, film)
