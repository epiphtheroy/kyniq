#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
reception-discover.py  (v2)  —  영화별 "Reception" 박스의 *발굴(discovery)* 단계.
핸드오버의 comment_extractor.py(검증된 추출 사다리)를 재사용하고, 비어 있던
"이 영화를 어떤 매체·논문이 다뤘는가" 발굴만 자동화한다.

소스
  • 학술: OpenAlex 검색(무료). 오탐 차단 — 작품 '제목'에 영화제목이 박힌 경우(강),
          또는 초록에 박혔고 (긴 distinctive 제목 또는 감독 성 동반)일 때만 채택.
  • 비평: Brave Web Search(무료 API, .env.local의 BRAVE_API_KEY)로
          `"<제목>" <감독> review` → allowlist 도메인만 → 매체당 1개(상위 우선).
          키가 없으면 위키백과 외부링크(정리본)로 폴백.
  • 추출: 비평은 그 페이지의 og:description, 학술은 초록에서 ≤10단어 축어 verdict.

원칙: 본문 미저장 · 매체당 1개 · robots 존중 · 실존 URL/DOI만(날조 0) · LLM 0 → 비용 $0~소액.

산출
  • pilot_<slug>_enriched.csv      (comment_extractor 와 동일 스키마)
  • reception-pilot-summary.md     (검토용 한 장 요약: 커버리지 + 샘플)

사용
  python3 reception-discover.py                       # 내장 20편
  python3 reception-discover.py --acad-cap 8 --crit-cap 12
"""
from __future__ import annotations
import csv, json, os, re, sys, time, html, unicodedata, socket, threading
from urllib import parse
from urllib.request import Request, urlopen
from urllib.error import HTTPError

socket.setdefaulttimeout(20)   # robotparser.read() 등 모든 소켓에 전역 타임아웃 → 행(hang) 방지

import comment_extractor as ce  # 같은 폴더의 검증된 추출기
ce.MAX_WORDS = 15              # verdict 인용 길이 ≤15단어(가독성 ↔ 저작권 절충)

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(HERE)                       # /…/MetaTake
ALLOWLIST = os.path.join(HERE, "magazine-allowlist.csv")
EXTRA = os.path.join(HERE, "reception-extra-outlets.csv")   # 주류 평론매체 보강(아트하우스 allowlist는 그대로)
UA = ce.UA
TIMEOUT = ce.TIMEOUT
MAILTO = "contact@metatake.net"

FILMS = [
    ("grave-of-the-fireflies-1988", "Grave of the Fireflies", 1988, "Isao Takahata"),
    ("gravity-2013", "Gravity", 2013, "Alfonso Cuarón"),
    ("the-terminator", "The Terminator", 1984, "James Cameron"),
    ("papicha-2019", "Papicha", 2019, "Mounia Meddour"),
    ("a-prophet-2009", "A Prophet", 2009, "Jacques Audiard"),
    ("black-swan-2010", "Black Swan", 2010, "Darren Aronofsky"),
    ("ocean-s-eleven-2001", "Ocean's Eleven", 2001, "Steven Soderbergh"),
    ("the-ballad-of-narayama-1983", "The Ballad of Narayama", 1983, "Shōhei Imamura"),
    ("comrades-almost-a-love-story-1996", "Comrades, Almost a Love Story", 1996, "Peter Chan"),
    ("perfect-days-2023", "Perfect Days", 2023, "Wim Wenders"),
    ("nomadland-2020", "Nomadland", 2020, "Chloé Zhao"),
    ("winter-sleep-2014", "Winter Sleep", 2014, "Nuri Bilge Ceylan"),
    ("scott-pilgrim-vs-the-world-2010", "Scott Pilgrim vs. the World", 2010, "Edgar Wright"),
    ("300-2006", "300", 2006, "Zack Snyder"),
    ("bad-education-2004", "Bad Education", 2004, "Pedro Almodóvar"),
    ("10-things-i-hate-about-you-1999", "10 Things I Hate About You", 1999, "Gil Junger"),
    ("ida-2013", "Ida", 2013, "Paweł Pawlikowski"),
    ("cold-war-2018", "Cold War", 2018, "Paweł Pawlikowski"),
    ("life-is-beautiful", "Life Is Beautiful", 1997, "Roberto Benigni"),
    ("the-zone-of-interest-2023", "The Zone of Interest", 2023, "Jonathan Glazer"),
]

FILM_CUES = ("film", "films", "cinema", "cinematic", "movie", "director", "directed",
             "screen", "melodrama", "documentary", "anime", "filmmaker", "auteur")
BOILER = ("sign up", "newsletter", "subscribe", "best of the city", "log in", "sign in",
          "create an account", "cookie", "your inbox", "for the best of", "privacy policy",
          "advertisement", "all rights reserved", "enable javascript", "browser")


def is_boiler(t: str) -> bool:
    t = (t or "").lower()
    return any(b in t for b in BOILER)
TYPE_LABEL = {"article": "Journal article", "book-chapter": "Book chapter",
              "book": "Book", "dissertation": "Thesis", "preprint": "Preprint",
              "review": "Review", "report": "Report"}


# ── env (.env.local: BRAVE_API_KEY) ───────────────────────────────────────
def load_env():
    for fn in (".env.local", ".env"):
        p = os.path.join(PROJECT, fn)
        if not os.path.exists(p):
            continue
        for line in open(p, encoding="utf-8"):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def brave_key():
    return os.environ.get("BRAVE_API_KEY") or os.environ.get("BRAVE_SEARCH_API_KEY") or ""


# ── helpers ────────────────────────────────────────────────────────────────
_oa_lock = threading.Lock()
_oa_last = [0.0]
_oa_streak = [0]      # 연속 OpenAlex 실패 수
_oa_open = [False]    # 회로 개방 = 학술 일시중단(이번 실행 한정)


def _oa_pace(min_int: float = 0.34):
    """OpenAlex/Crossref 전역 페이싱(≈3 req/s) — 동시성에서도 429 방지."""
    with _oa_lock:
        dt = time.time() - _oa_last[0]
        if dt < min_int:
            time.sleep(min_int - dt)
        _oa_last[0] = time.time()


def get_json(url: str, headers: dict | None = None):
    oa = ("openalex" in url) or ("crossref" in url)
    if oa and _oa_open[0]:
        return None                       # 회로 개방 중 → 학술 즉시 스킵(보류로 처리)
    last = None
    tries = 3 if oa else 2
    for attempt in range(tries):
        if oa:
            _oa_pace()
        try:
            h = {"User-Agent": UA}
            if headers:
                h.update(headers)
            with urlopen(Request(url, headers=h), timeout=TIMEOUT) as r:
                data = json.load(r)
            if oa:
                _oa_streak[0] = 0
            return data
        except HTTPError as e:
            last = e
            if e.code in (429, 500, 502, 503, 504) and attempt < tries - 1:
                time.sleep(1.5 * (attempt + 1))
                continue
            break
        except Exception as e:
            last = e
            if attempt < tries - 1:
                time.sleep(1.2 * (attempt + 1))
                continue
            break
    if oa:
        _oa_streak[0] += 1
        if _oa_streak[0] >= 8 and not _oa_open[0]:
            _oa_open[0] = True
            print("    ⚠ OpenAlex 연속 실패 8회 → 학술 일시중단(보류). 회복 후 run-reception-fill-academic 로 채우세요.",
                  file=sys.stderr)
    print(f"    api fail: {url[:80]} ({last})", file=sys.stderr)
    return None


def _fetch_abstract(doi: str) -> str:
    """초록 취득을 율속·재시도 되는 get_json 경로로 통일(OpenAlex → Crossref)."""
    doi = (doi or "").replace("https://doi.org/", "").strip()
    if not doi:
        return ""
    d = get_json(f"https://api.openalex.org/works/doi:{parse.quote(doi)}"
                 f"?select=abstract_inverted_index&mailto={MAILTO}")
    if d:
        ab = ce.reconstruct_inverted(d.get("abstract_inverted_index"))
        if ab:
            return ab
    d = get_json(f"https://api.crossref.org/works/{parse.quote(doi)}?select=abstract")
    if d:
        ab = (d.get("message", {}) or {}).get("abstract", "") or ""
        return re.sub(r"<[^>]+>", " ", ab).strip()
    return ""


ce.fetch_abstract = _fetch_abstract   # ce.build_comment 이 쓰는 초록 취득을 율속 버전으로 교체


def norm(s: str) -> str:
    return ce._norm(s or "").lower()


def deacc(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def wb(needle: str, hay: str) -> bool:
    if not needle:
        return False
    return re.search(r"(?<![a-z0-9])" + re.escape(needle) + r"(?![a-z0-9])", hay) is not None


def distinctive(title_norm: str) -> bool:
    """본문 우연일치 방지: 길이≥4 알파 토큰이 2개 이상인 '변별력 있는' 제목인가."""
    return sum(1 for t in re.findall(r"[a-z]+", title_norm) if len(t) >= 4) >= 2


def host_of(url: str) -> str:
    h = parse.urlparse(url).netloc.lower()
    return h[4:] if h.startswith("www.") else h


def is_homepage(url: str) -> bool:
    return parse.urlparse(url).path.strip("/") == ""


def title_of(htmltext: str) -> str:
    for key, attr in (("og:title", "property"), ("twitter:title", "name")):
        v = ce._meta(htmltext, key, attr)
        if v:
            return v
    m = re.search(r"<title[^>]*>(.*?)</title>", htmltext, re.S | re.I)
    return html.unescape(m.group(1)).strip() if m else ""


def byline_of(htmltext: str) -> str:
    """리뷰 페이지의 글쓴이(평론가) 추출: meta[author]/article:author/byl + JSON-LD author.name."""
    for key, attr in (("author", "name"), ("article:author", "property"),
                      ("byl", "name"), ("parsely-author", "name")):
        v = ce._meta(htmltext, key, attr)
        if v and len(v) < 80 and not v.lower().startswith("http"):
            return v.strip()
    for m in re.finditer(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', htmltext, re.S | re.I):
        try:
            data = json.loads(m.group(1).strip())
        except Exception:
            continue
        for node in (data if isinstance(data, list) else [data]):
            if not isinstance(node, dict):
                continue
            a = node.get("author")
            if isinstance(a, dict) and a.get("name"):
                return str(a["name"])[:80].strip()
            if isinstance(a, list) and a and isinstance(a[0], dict) and a[0].get("name"):
                return str(a[0]["name"])[:80].strip()
            if isinstance(a, str) and a and not a.lower().startswith("http"):
                return a[:80].strip()
    return ""


def body_text(htmltext: str, limit: int = 1500) -> str:
    """본문 앞부분 텍스트(첫 문단들). 저장하지 않고 ≤MAX_WORDS 인용 추출에만 쓴다."""
    paras = re.findall(r"<p[^>]*>(.*?)</p>", htmltext, re.S | re.I)
    txt = " ".join(re.sub(r"<[^>]+>", " ", p) for p in paras[:6])
    return re.sub(r"\s+", " ", html.unescape(txt)).strip()[:limit]


def clean_headline(t: str, outlet: str) -> str:
    """헤드라인 끝의 ' | 매체', ' - 매체', ' — 매체' 꼬리를 제거."""
    for sep in (" | ", " — ", " – ", " - ", " : "):
        if sep in t:
            head, tail = t.rsplit(sep, 1)
            if norm(tail) == norm(outlet) or norm(outlet) in norm(tail) or norm(tail) in norm(outlet):
                t = head.strip()
    return t.strip()


# ── allowlist ──────────────────────────────────────────────────────────────
def _read_outlets(path: str, m: dict):
    if not os.path.exists(path):
        return
    for r in csv.DictReader(open(path, encoding="utf-8")):
        hp = (r.get("homepage_url") or "").strip()
        if not hp:
            continue
        host = host_of(hp)
        if host:
            m[host] = {"name": r.get("name", host), "language": r.get("language", ""),
                       "tier": r.get("trust_tier", ""), "stance": r.get("robots_ai_stance", ""),
                       "ingest": r.get("ingest_recommendation", "")}


def load_allowlist() -> dict:
    m = {}
    _read_outlets(ALLOWLIST, m)   # 아트하우스 비평지 150곳
    _read_outlets(EXTRA, m)       # + 주류 평론매체 보강
    return m


def allow_match(host: str, allow: dict):
    if host in allow:
        return host
    for ah in allow:
        if host.endswith("." + ah) or ah.endswith("." + host):
            return ah
    return None


# ── 학술: OpenAlex ─────────────────────────────────────────────────────────
def discover_academic(title: str, director: str, year: int, cap: int):
    q = parse.quote(f"{title} {director}")
    url = (f"https://api.openalex.org/works?search={q}&per_page=25&mailto={MAILTO}"
           "&select=id,doi,title,type,publication_year,language,authorships,primary_location,"
           "abstract_inverted_index")
    raw = get_json(url)
    failed = raw is None                 # API 실패(429 등) → 호출부가 캐시 안 하도록 신호
    data = raw or {}
    ftn = norm(title)
    dist = distinctive(ftn)
    surname = re.sub(r"[^a-z]", "", deacc((director.split()[-1] if director else "").lower()))
    out = []
    for w in data.get("results", []):
        doi = (w.get("doi") or "").replace("https://doi.org/", "").strip()
        if not doi:
            continue
        wt = w.get("title") or ""
        wtn = norm(wt)
        ab = ce.reconstruct_inverted(w.get("abstract_inverted_index"))
        abn = norm(ab)
        py = w.get("publication_year") or 0
        if py and year and py < year:
            continue
        hay = deacc(wtn + " " + abn)
        has_surname = bool(surname) and len(surname) >= 3 and wb(surname, hay)  # 단어경계(‘lee’가 ‘fleeting’에 안 걸리게)
        has_cue = any(c in hay for c in FILM_CUES)
        strong_title = wb(ftn, wtn)
        # base: 작품 제목에 영화제목  OR  초록에 영화제목(변별력 제목일 때만)
        base = strong_title or (wb(ftn, abn) and dist)
        if not base:
            continue
        # 영화성 신호 필수: 영화 단서(film/cinema/director…) OR 감독 성. 둘 다 없으면 동음 오탐으로 제거.
        if not (has_cue or has_surname):
            continue   # 의학(점막)·생태·정치(국가브랜딩)·고전학(실제 전투) 등 제거
        src = (w.get("primary_location") or {}).get("source") or {}
        venue = src.get("display_name") or TYPE_LABEL.get(w.get("type") or "", "Scholarship")
        auths = w.get("authorships") or []
        critic = ""
        if auths:
            critic = (auths[0].get("author") or {}).get("display_name", "")
            if critic and len(auths) > 1:
                critic += " et al."
        out.append({"type": "academic", "outlet": venue, "critic": critic, "year": str(py or year),
                    "language": w.get("language") or "", "title": wt,
                    "url": f"https://doi.org/{doi}", "doi": doi, "abstract": ab})  # 검색에서 받은 초록 재사용
        if len(out) >= cap:
            break
    return out, failed


# ── 비평: Brave Web Search ─────────────────────────────────────────────────
def brave_search(q: str, key: str, count: int = 20):
    u = "https://api.search.brave.com/res/v1/web/search?" + parse.urlencode(
        {"q": q, "count": count, "result_filter": "web", "safesearch": "off"})
    d = get_json(u, headers={"X-Subscription-Token": key, "Accept": "application/json"})
    return ((d or {}).get("web", {}) or {}).get("results", []) or []


def discover_criticism_brave(title, director, year, allow, key, cap):
    q = f'"{title}" {director} review'
    results = brave_search(q, key)
    time.sleep(1.1)                                   # free tier ~1 req/s
    out, seen = [], set()
    for r in results:
        url = r.get("url") or ""
        if not url or is_homepage(url):
            continue
        ah = allow_match(host_of(url), allow)
        if not ah:
            continue
        info = allow[ah]
        if info["name"] in seen:
            continue
        seen.add(info["name"])
        out.append({"type": "criticism", "outlet": info["name"], "critic": "", "year": str(year),
                    "language": info["language"], "title": clean_headline(r.get("title", ""), info["name"]),
                    "url": url, "dek": r.get("description", ""),
                    "stance": info["stance"], "ingest": info["ingest"]})
        if len(out) >= cap:
            break
    return out, q


# ── 비평: 위키백과 폴백(정리본) ────────────────────────────────────────────
def wiki_page(title, year):
    u = ("https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&srsearch="
         + parse.quote(f"{title} {year} film"))
    s = (get_json(u) or {}).get("query", {}).get("search", [])
    return s[0]["title"] if s else None


def wiki_extlinks(pagetitle):
    urls, offset = [], None
    for _ in range(4):
        u = ("https://en.wikipedia.org/w/api.php?action=query&prop=extlinks&ellimit=500&format=json&titles="
             + parse.quote(pagetitle))
        if offset:
            u += f"&eloffset={offset}"
        d = get_json(u) or {}
        for p in d.get("query", {}).get("pages", {}).values():
            for el in p.get("extlinks", []):
                urls.append(el.get("*") or el.get("url") or "")
        offset = d.get("continue", {}).get("eloffset")
        if not offset:
            break
    return [u for u in urls if u.startswith("http")]


def discover_criticism_wiki(title, year, allow, cap):
    pg = wiki_page(title, year)
    if not pg:
        return [], None
    best = {}                                          # outlet → 딥링크 우선
    for url in wiki_extlinks(pg):
        if is_homepage(url):                           # 매체 홈페이지 링크 제거
            continue
        ah = allow_match(host_of(url), allow)
        if not ah:
            continue
        nm = allow[ah]["name"]
        if nm not in best:
            best[nm] = (url, allow[ah])
    out = []
    for nm, (url, info) in best.items():
        out.append({"type": "criticism", "outlet": nm, "critic": "", "year": str(year),
                    "language": info["language"], "title": "", "url": url,
                    "stance": info["stance"], "ingest": info["ingest"]})
        if len(out) >= cap:
            break
    return out, pg


# ── 추출(사다리) ──────────────────────────────────────────────────────────
COLS = ["id", "type", "outlet", "critic", "year", "language", "tier",
        "title", "comment", "verdict_le10", "verbatim_verified", "dek_lead", "url"]


def to_row(idx, r, c):
    return {"id": idx, "type": r["type"], "outlet": c.outlet, "critic": c.critic, "year": c.year,
            "language": r.get("language", ""), "tier": c.tier, "title": c.title, "comment": c.comment,
            "verdict_le10": c.verdict_le10, "verbatim_verified": "true" if c.verbatim_verified else "false",
            "dek_lead": c.dek_lead, "url": c.url}


def junky_verdict(v: str) -> bool:
    """초록에서 뽑힌 ≤10단어가 평가가 아니라 메타데이터·쪼가리면 True → 제목 폴백."""
    v = (v or "").strip()
    words = re.findall(r"[A-Za-zÀ-ÿ]+", v)
    if len(words) < 3:
        return True
    if re.search(r"\(\d{4}\)\s*\d", v):                 # "(1991)6" 식 각주
        return True
    if v.endswith(("(", ":", ",", "—", "–")):
        return True
    if v.lower() in ("international audience", "abstract", "introduction", "open access"):
        return True
    if sum(ch.isdigit() for ch in v) > len(v) * 0.3:    # 숫자 과다(표/메타)
        return True
    return False


def enrich(idx, r, film_title):
    if r["type"] == "academic":
        title = r.get("title", "")
        ab = r.get("abstract", "")
        if ab:                                  # 검색에서 이미 받은 초록 사용(OpenAlex 재호출 없음)
            v = ce.verdict_span(ab, film_title, allow_first=True)
            if v and not junky_verdict(v):
                c = ce.Comment(r["outlet"], r["critic"], r["year"], r["url"], title, v, v,
                               "verdict", "abstract", ab[:240], v in ce._norm(ab))
            else:
                c = ce.Comment(r["outlet"], r["critic"], r["year"], r["url"], title, title, "",
                               "title", "abstract", "", False)
        else:                                   # 초록이 없으면(드묾) DOI로 폴백
            c = ce.build_comment(r["url"], r["outlet"], r["critic"], r["year"], film_title=film_title,
                                 title=title, is_academic=True, doi=r.get("doi", ""))
            if c.tier == "verdict" and junky_verdict(c.verdict_le10):
                c = ce.Comment(c.outlet, c.critic, c.year, c.url, c.title, c.title, "", "title",
                               c.source_field, c.dek_lead, False)
        return to_row(idx, r, c)
    # 비평: Brave 스니펫(발행사 링크 미리보기)에서 ≤15단어 verdict. 페이지를 직접 크롤하지 않음(빠름·robots 무관).
    dek = r.get("dek", "") or ""
    if is_boiler(dek):
        dek = ""
    t = r.get("title") or r["outlet"]
    critic = r.get("critic", "")
    v = ce.verdict_span(dek, film_title)
    if v and is_boiler(v):
        v = ""
    if v:
        c = ce.Comment(r["outlet"], critic, r["year"], r["url"], t, v, v, "verdict",
                       "brave", dek[:240], True)
    else:
        c = ce.Comment(r["outlet"], critic, r["year"], r["url"], t, t, "", "title",
                       "brave", "", False)
    return to_row(idx, r, c)


def is_junk(row):
    """매체명만 남은 빈 row 제거."""
    return row["type"] == "criticism" and (
        not row["comment"].strip() or norm(row["comment"]) == norm(row["outlet"]))


# ── 메인 ──────────────────────────────────────────────────────────────────
def main():
    load_env()
    args = sys.argv[1:]
    acad_cap = crit_cap = None
    for i, a in enumerate(args):
        if a == "--acad-cap":
            acad_cap = int(args[i + 1])
        elif a == "--crit-cap":
            crit_cap = int(args[i + 1])
    acad_cap = acad_cap or 8
    crit_cap = crit_cap or 12

    allow = load_allowlist()
    key = brave_key()
    print(f"allowlist domains: {len(allow)}  ·  criticism source: "
          f"{'Brave Search' if key else 'Wikipedia (no BRAVE_API_KEY)'}")

    summary, grand = [], {"films": 0, "rows": 0, "reviews": 0, "papers": 0,
                          "verdict": 0, "title": 0, "verbatim": 0}

    for slug, title, year, director in FILMS:
        print(f"\n■ {title} ({year}) — {director}")
        ac, _ = discover_academic(title, director, year, acad_cap)
        if key:
            cr, src = discover_criticism_brave(title, director, year, allow, key, crit_cap)
        else:
            cr, src = discover_criticism_wiki(title, year, allow, crit_cap)
        print(f"  discovered: {len(cr)} reviews ({src or '—'}) · {len(ac)} papers")

        enriched = []
        for i, r in enumerate(cr + ac, 1):
            row = enrich(i, r, title)
            if is_junk(row):
                print(f"    [drop   ] {row['outlet']} (no headline)")
                continue
            enriched.append(row)
            print(f"    [{row['tier']:7}] {row['type'][:4]} {row['outlet']}: {row['comment'][:62]}")
            time.sleep(0.7)
        for i, row in enumerate(enriched, 1):
            row["id"] = i

        with open(os.path.join(HERE, f"pilot_{slug}_enriched.csv"), "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=COLS, extrasaction="ignore"); w.writeheader()
            for row in enriched:
                w.writerow(row)

        rv = sum(1 for r in enriched if r["type"] == "criticism")
        pp = sum(1 for r in enriched if r["type"] == "academic")
        vd = sum(1 for r in enriched if r["tier"] == "verdict")
        tt = sum(1 for r in enriched if r["tier"] == "title")
        vb = sum(1 for r in enriched if r["verbatim_verified"] == "true")
        for k, v in (("films", 1), ("rows", len(enriched)), ("reviews", rv), ("papers", pp),
                     ("verdict", vd), ("title", tt), ("verbatim", vb)):
            grand[k] += v
        summary.append((slug, title, year, rv, pp, vd, tt, enriched))

    md = [f"# Reception 파일럿 v2 — {grand['films']}편",
          f"비평 소스: **{'Brave Search' if key else 'Wikipedia'}** · 비용: **{'≈$0 (Brave 무료티어)' if key else '$0'}** · LLM 0.",
          "원칙: 본문 미저장 · 매체당 1개 · ≤10단어 축어 · robots 존중 · 실존 URL/DOI만.\n",
          "| # | 영화 | 리뷰 | 논문 | verdict | 제목폴백 |", "|---|---|--:|--:|--:|--:|"]
    for i, (slug, title, year, rv, pp, vd, tt, _) in enumerate(summary, 1):
        md.append(f"| {i} | {title} ({year}) | {rv} | {pp} | {vd} | {tt} |")
    md.append(f"| | **합계** | **{grand['reviews']}** | **{grand['papers']}** | "
              f"**{grand['verdict']}** | **{grand['title']}** |\n")
    md.append(f"- 평균 {grand['rows']/max(1,grand['films']):.1f}/편 · 축어정합 {grand['verbatim']}\n\n---\n## 샘플 (영화별 최대 8개)\n")
    for slug, title, year, rv, pp, vd, tt, enriched in summary:
        md.append(f"### {title} ({year}) — 리뷰 {rv} · 논문 {pp}")
        if not enriched:
            md.append("_발굴 0._\n"); continue
        for r in sorted(enriched, key=lambda r: (r["type"] != "criticism", r["tier"] != "verdict"))[:8]:
            mark = "❝" if r["tier"] == "verdict" else "·"
            md.append(f"- {mark} **{r['comment']}**  \n  ↳ _{r['outlet']}_ · {r['type']} "
                      f"· [{(r['title'][:80] or 'link')}]({r['url']})")
        md.append("")
    open(os.path.join(HERE, "reception-pilot-summary.md"), "w", encoding="utf-8").write("\n".join(md))

    print("\n" + "=" * 60)
    print(f"FILMS {grand['films']} · ROWS {grand['rows']} (reviews {grand['reviews']} / papers {grand['papers']})")
    print(f"verdict {grand['verdict']} · title-fallback {grand['title']} · verbatim {grand['verbatim']}")
    print(f"criticism: {'Brave' if key else 'Wikipedia'} · cost: {'≈$0 (free tier)' if key else '$0'}")
    print(f"→ {os.path.join(HERE, 'reception-pilot-summary.md')}")


if __name__ == "__main__":
    main()
