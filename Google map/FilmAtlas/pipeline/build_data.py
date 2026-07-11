#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Film Spatial Atlas — 확장용 자동화 파이프라인 (수천 편 → 데이터 자동 생성)
================================================================================
폴더 안의 모든 *_*.md (영화 공간초록) 파일을 읽어서:
  1) Gemini로 지명 추출 + 단위(scale)/역할(role) 분류  (지오파싱: 인식 단계)
  2) 지오코딩으로 위경도 부여 (캐시로 중복 호출 제거)    (지오파싱: 해소 단계)
  3) data/places.geojson + data/articles.json 재생성
  4) webmap/index.html 에 데이터 인라인 주입

이 스크립트 하나가 "내가 중간에 손대지 않아도 되는" 에이전트입니다.
새 .md 파일을 폴더에 넣고 다시 실행하면 지도가 갱신됩니다.

사용법
------
  pip install google-genai requests
  export GEMINI_API_KEY="..."            # https://aistudio.google.com/apikey (무료 등급 있음)
  # (선택) export GEOCODER=google ; export GOOGLE_MAPS_KEY="..."
  python build_data.py  --src "../"  --out "../"

설계 메모
--------
* 추출 모델: gemini-2.5-flash (저렴·빠름). 구조화 출력(JSON 스키마)로 형식 보장.
* 지오코딩 기본값: Nominatim(OpenStreetMap) — 무료, 키 불필요, 초당 1회 제한 준수.
            GEOCODER=google 로 바꾸면 Google Geocoding API 사용(더 정확, 유료).
* 캐시: geocode_cache.json — 같은 지명은 다시 호출하지 않음(비용·시간 80~95% 절감).
* 환각 방지: name_raw 가 원문에 실제로 존재하는지 검증 후에만 채택.
"""
import os, re, json, time, glob, argparse, sys, hashlib

# ── 추출 스키마 (Gemini structured output) ───────────────────────────────────
PLACE_SCHEMA = {
  "type": "object",
  "properties": {
    "film_title": {"type": "string"},
    "year": {"type": "integer"},
    "director": {"type": "string"},
    "city": {"type": "string", "description": "영화의 대표 배경 한 줄"},
    "places": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name_raw":   {"type": "string", "description": "원문에 등장한 표현 그대로"},
          "name_query": {"type": "string", "description": "지오코딩용 정규화 명칭(상위 행정구역 포함)"},
          "scale": {"type": "string", "enum":
              ["country","region","city","district","street","poi","natural"]},
          "role":  {"type": "string", "enum":
              ["setting","production","festival","symbolic"],
              "description":"setting=디에게시스 배경, production=촬영·제작지, festival=영화제, symbolic=상징/부재"},
          "persp": {"type": "integer", "description": "몇 번째 perspective(0부터)"},
          "is_real": {"type": "boolean"}
        },
        "required": ["name_raw","name_query","scale","role","persp","is_real"]
      }
    }
  },
  "required": ["film_title","year","director","city","places"]
}

EXTRACT_PROMPT = """You are a geoparser for film 'spatial abstract' essays.
From the markdown below, extract every PLACE NAME that refers to a real-world location.
Rules:
- name_raw MUST be copied verbatim from the text (no inventions).
- name_query: add parent admin context for unambiguous geocoding
  (e.g. "Savoca" -> "Savoca, Messina, Sicily, Italy").
- scale: country/region/city/district/street/poi/natural.
- role: setting (diegetic story setting) / production (where it was actually
  filmed or co-produced) / festival / symbolic (mentioned as absent or symbolic).
- persp: which "## Perspective" section it appears in, 0-indexed.
- Skip purely fictional names (e.g. movie titles, company-only references with no place).
Return JSON only, matching the schema.

MARKDOWN:
---
{md}
---"""

# ── Gemini 추출 ──────────────────────────────────────────────────────────────
def extract_with_gemini(md_text, model="gemini-2.5-flash"):
    from google import genai
    from google.genai import types
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    resp = client.models.generate_content(
        model=model,
        contents=EXTRACT_PROMPT.format(md=md_text[:12000]),
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=PLACE_SCHEMA,
            temperature=0.1,
        ),
    )
    return json.loads(resp.text)

# ── 원문 perspective 파싱 (전체 읽기 패널용) ─────────────────────────────────
def parse_article(md_text):
    title_m = re.search(r"^#\s+(.*)", md_text, re.M)
    header = title_m.group(1) if title_m else "Untitled"
    ym = re.search(r"\((\d{4}),\s*([^)]+)\)", header)
    year = int(ym.group(1)) if ym else None
    director = ym.group(2).strip() if ym else ""
    title = re.sub(r"\s*\(.*", "", header).strip().rstrip("—").strip()
    persps = []
    blocks = re.split(r"^##\s+Perspective.*$", md_text, flags=re.M)[1:]
    for b in blocks:
        h  = re.search(r"^###\s+(.*)", b, re.M)
        sub= re.search(r"^\*\*(.*?)\*\*", b, re.M)
        # 본문 = 가장 긴 문단
        paras = [p.strip() for p in b.split("\n\n") if len(p.strip()) > 200]
        body = max(paras, key=len) if paras else ""
        persps.append({"heading": h.group(1).strip() if h else "",
                       "subheading": sub.group(1).strip() if sub else "",
                       "body": re.sub(r"\s+"," ", body).strip()})
    srcs = re.findall(r"\[([^\]]+)\]\((https?://[^)]+)\)", md_text.split("### Sources")[-1]) \
           if "### Sources" in md_text else []
    return {"title": title, "year": year, "director": director,
            "city": "", "perspectives": persps, "sources": [list(s) for s in srcs]}

# ── 지오코딩 (캐시 포함) ─────────────────────────────────────────────────────
def load_cache(path):
    return json.load(open(path, encoding="utf-8")) if os.path.exists(path) else {}

def geocode(query, cache, geocoder="nominatim"):
    key = query.strip().lower()
    if key in cache:
        return cache[key]
    import requests
    coord = None
    if geocoder == "google":
        r = requests.get("https://maps.googleapis.com/maps/api/geocode/json",
            params={"address": query, "key": os.environ["GOOGLE_MAPS_KEY"]}, timeout=20).json()
        if r.get("results"):
            loc = r["results"][0]["geometry"]["location"]; coord = [loc["lng"], loc["lat"]]
    else:  # nominatim — 초당 1회 제한 준수
        r = requests.get("https://nominatim.openstreetmap.org/search",
            params={"q": query, "format": "json", "limit": 1},
            headers={"User-Agent": "Mozilla/5.0 (compatible; MetatakeBot/1.0; +https://metatake.net/bot)"}, timeout=20).json()
        time.sleep(1.1)
        if r:
            coord = [float(r[0]["lon"]), float(r[0]["lat"])]
    cache[key] = coord
    return coord

def excerpt(body, n=160):
    return (body[:n].rsplit(" ",1)[0] + "…") if len(body) > n else body

# ── 메인 ─────────────────────────────────────────────────────────────────────
def slugify(s):
    return re.sub(r"[^a-z0-9]+","", s.lower())[:24] or hashlib.md5(s.encode()).hexdigest()[:8]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="..", help="*.md 들이 있는 폴더")
    ap.add_argument("--out", default="..", help="data/ webmap/ 를 쓸 폴더")
    ap.add_argument("--model", default="gemini-2.5-flash")
    args = ap.parse_args()

    geocoder = os.environ.get("GEOCODER","nominatim")
    cache_path = os.path.join(os.path.dirname(__file__), "geocode_cache.json")
    cache = load_cache(cache_path)

    md_files = sorted(glob.glob(os.path.join(args.src, "*.md")))
    md_files = [f for f in md_files if "README" not in os.path.basename(f)]
    print(f"발견한 .md: {len(md_files)}개  | 지오코더: {geocoder}")

    ARTICLES, FEATURES, fid = {}, [], 0
    for path in md_files:
        md = open(path, encoding="utf-8").read()
        art = parse_article(md)
        slug = slugify(art["title"])
        print(f"  · {art['title']}  →  추출 중…")
        try:
            ext = extract_with_gemini(md, args.model)
            art["city"] = ext.get("city","")
        except Exception as e:
            print(f"    ! Gemini 추출 실패({e}); 이 파일 건너뜀"); continue
        ARTICLES[slug] = art

        for pl in ext["places"]:
            if not pl.get("is_real", True):       # 가상지명 제외
                continue
            if pl["name_raw"] not in md:          # 환각 방지: 원문 존재 검증
                continue
            coord = geocode(pl["name_query"], cache, geocoder)
            if not coord:
                print(f"    ? 지오코딩 실패: {pl['name_query']}"); continue
            pidx = min(pl.get("persp",0), len(art["perspectives"])-1)
            per = art["perspectives"][pidx] if art["perspectives"] else {"heading":"","subheading":"","body":""}
            FEATURES.append({
                "type":"Feature",
                "geometry":{"type":"Point","coordinates":coord},
                "properties":{
                    "id":fid,"place":pl["name_raw"],"scale":pl["scale"],"role":pl["role"],
                    "film_id":slug,"film_title":art["title"],"year":art["year"],
                    "director":art["director"],"persp":pidx,
                    "persp_heading":per["heading"],"persp_subheading":per["subheading"],
                    "excerpt":excerpt(per["body"]),
                }})
            fid += 1
        json.dump(cache, open(cache_path,"w",encoding="utf-8"), ensure_ascii=False, indent=2)

    geojson = {"type":"FeatureCollection",
               "metadata":{"count":len(FEATURES),"films":len(ARTICLES)},
               "features":FEATURES}
    os.makedirs(os.path.join(args.out,"data"), exist_ok=True)
    json.dump(geojson,  open(os.path.join(args.out,"data","places.geojson"),"w",encoding="utf-8"), ensure_ascii=False, indent=2)
    json.dump(ARTICLES, open(os.path.join(args.out,"data","articles.json"),"w",encoding="utf-8"), ensure_ascii=False, indent=2)

    # webmap/index.html 데이터 인라인 갱신 (있을 때만)
    idx = os.path.join(args.out,"webmap","index.html")
    if os.path.exists(idx):
        h = open(idx, encoding="utf-8").read()
        h = re.sub(r"const ARTICLES = .*?;\nconst DATA",
                   "const ARTICLES = "+json.dumps(ARTICLES,ensure_ascii=False)+";\nconst DATA", h, flags=re.S)
        h = re.sub(r"const DATA = .*?;\nconst ROLE_LABEL",
                   "const DATA = "+json.dumps(geojson,ensure_ascii=False)+";\nconst ROLE_LABEL", h, flags=re.S)
        open(idx,"w",encoding="utf-8").write(h)
        print("  webmap/index.html 데이터 갱신 완료")

    print(f"완료: 영화 {len(ARTICLES)}편, 장소 {len(FEATURES)}곳")

if __name__ == "__main__":
    main()
