#!/usr/bin/env python3
"""build-entity-links — 에세이 본문에서 개념/이론가 언급을 결정론적으로 추출해
essay_entity_links 테이블을 채운다. LLM 호출 없음(무비용).

렌더타임 링크화(lib/desks.ts linkifyEntities)와 같은 규칙:
대소문자 무시 + 단어 경계 + 이름 길이 >= 5. 에세이당 엔티티 최대 20.

Usage: python3 build-entity-links.py [--truncate]
"""
import os, sys, json, re, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
for line in open(os.path.join(ROOT, ".env.local"), encoding="utf-8"):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]; SKEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

DESK_KEY = {"fan_theories": "theories", "concept_briefing": "decoder", "meta_critique": "debates",
            "radical_critique": "contested", "reception_meta": "reception-story",
            "juxtaposition": "parallel-lives", "the_lens": "field-test", "exegesis": "exegesis"}

def rest(method, path, body=None, extra=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", method=method, data=data)
    for k, v in {"apikey": SKEY, "Authorization": f"Bearer {SKEY}", "Content-Type": "application/json", **(extra or {})}.items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=180) as r:
        t = r.read().decode()
        return json.loads(t) if t.strip() else None

def get_all(path):
    rows, off = [], 0
    while True:
        b = rest("GET", f"{path}&limit=1000&offset={off}")
        rows.extend(b)
        if len(b) < 1000: break
        off += 1000
    return rows

def mdplain(s):
    s = re.sub(r"\*\*([^*]+)\*\*", r"\1", s)
    s = re.sub(r"\*([^*]+)\*", r"\1", s)
    return re.sub(r"\s+", " ", s).strip()

def main():
    dic = rest("POST", "rpc/desk_link_dictionary", body={})
    entries = []
    seen = set()
    def norm(x): return re.sub(r"[^a-z0-9]", "", x.lower().replace("the ", "", 1))
    for c in dic.get("concepts", []):
        if c.get("name") and c.get("slug") and len(c["name"]) >= 4:
            entries.append(("concept", c["slug"], c["name"])); seen.add(norm(c["name"]))
    # 이론DB 편입 (lib/desks.ts loadFullLinkDict와 동일 규칙: 이름 dedupe + 괄호 별칭)
    for t in get_all("theory_concepts?select=concept,concept_slug&order=id"):
        nm, sl = t.get("concept"), t.get("concept_slug")
        if not nm or not sl: continue
        if norm(nm) not in seen:
            seen.add(norm(nm)); entries.append(("concept", sl, nm))
        m = re.search(r"\(([^)]{4,60})\)\s*$", nm)
        if m:
            alias = m.group(1).strip()
            # 머리말(도메인 꼬리표 제거)은 안전한 별칭
            head = re.sub(r"\s*\([^)]*\)\s*$", "", nm).strip()
            if len(head) >= 5 and norm(head) not in seen:
                seen.add(norm(head)); entries.append(("concept", sl, head))
            # 괄호 안은 대개 도메인 꼬리표("(Sociology)", "(Human)") — 일반어 링크 오염 방지.
            # 명백히 고유한 용어만 허용: 공백 없는 단일 토큰이면서 길이>=12 또는 비ASCII.
            specific = (" " not in alias) and (len(alias) >= 12 or any(ord(ch) > 127 for ch in alias))
            if specific and norm(alias) not in seen:
                seen.add(norm(alias)); entries.append(("concept", sl, alias))
    for t in dic.get("theorists", []):
        if t.get("name") and t.get("slug") and len(t["name"]) >= 5:
            entries.append(("theorist", t["slug"], t["name"]))
    # 긴 이름 우선 + 단어경계 정규식 사전 컴파일
    entries.sort(key=lambda e: -len(e[2]))
    pats = [(ty, sl, nm, re.compile(r"(?<![A-Za-z0-9])" + re.escape(nm) + r"(?![A-Za-z0-9])", re.I)) for ty, sl, nm in entries]
    print(f"dictionary: {len(entries)} entries")

    films = {f["id"]: f for f in get_all("films?select=id,slug,title,year&visible=eq.true")}
    essays = get_all("essays?select=id,film_id,mode,title,body_md&lang=eq.en&status=eq.verified")
    print(f"essays: {len(essays)}")

    if "--truncate" in sys.argv:
        rest("DELETE", "essay_entity_links?id=gt.0", extra={"Prefer": "return=minimal"})
        print("truncated")

    rows = []
    for e in essays:
        f = films.get(e["film_id"])
        if not f or not e.get("body_md"): continue
        body = e["body_md"]; body_l = body.lower()
        found = 0
        for ty, sl, nm, pat in pats:
            if found >= 20: break
            if nm.lower() not in body_l: continue
            if pat.search(body):
                rows.append({"essay_id": e["id"], "film_slug": f["slug"], "film_title": f["title"],
                             "film_year": f.get("year"), "mode": e["mode"],
                             "desk_key": DESK_KEY.get(e["mode"], "decoder"),
                             "essay_title": mdplain(e["title"])[:300],
                             "entity_type": ty, "entity_slug": sl, "entity_name": nm})
                found += 1
    print(f"links found: {len(rows)}")

    for i in range(0, len(rows), 500):
        rest("POST", "essay_entity_links?on_conflict=essay_id,entity_type,entity_slug", rows[i:i+500],
             {"Prefer": "resolution=merge-duplicates,return=minimal"})
    print("✅ inserted")

main()
