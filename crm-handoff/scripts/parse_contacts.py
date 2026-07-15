#!/usr/bin/env python3
"""Parse the 4 CRM source files → mapped, deduped contacts.json.
Mirrors lib/crm/importPresets.ts (§5-4-B). stdlib + openpyxl.
Output: crm-handoff/contacts.json  (⚠️ contains personal emails — gitignored, do NOT commit)

Usage:  python3 crm-handoff/scripts/parse_contacts.py
        (pip install openpyxl --quiet   # if missing)
"""
import csv, json, re
from pathlib import Path
from collections import Counter
import openpyxl

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "crm-handoff" / "contacts.json"

FREEMAIL = {"gmail.com","googlemail.com","yahoo.com","yahoo.co.uk","yahoo.co.jp","outlook.com","hotmail.com",
            "live.com","msn.com","aol.com","naver.com","daum.net","hanmail.net","protonmail.com","proton.me",
            "icloud.com","me.com","gmx.com","mail.com","yandex.com","qq.com","163.com"}

SEG_ACADEMIA = {"학계":"E1","대학원":"E1","사서":"E2","학회/저널":"E3","학술지":"E3","영화교육":"G1","Substack":"D1",
    "블로거":"D1","크리에이터":"D2","평론가":"C1","에디터":"C1","영화제프로그래밍":"K3","시네마테크/극장":"K4",
    "미디어아트/협동조합":"K4","필름커미션":"F2","영화기관":"F1","시네클럽":"D5","시네필커뮤니티":"D5","영상번역/자막":"H2"}
SEG_TRADE = {"트레이드":"C1","온라인매체":"C1","일간지문화부":"C1","잡지":"C1","리뷰비평":"C1","방송":"M1","팟캐스트유튜브":"D3"}
SEG_MAG = {"editorial":"C1","press":"C1","general":"C1","advertising":"C1","marketing":"C1",
           "partnerships":"C2","syndication":"C2","licensing":"C2"}
SEG_CONTACTDB = {"영화제":"K3","트레이드매체/기자":"C1","배급/제작사":"K2"}

def s(v): return "" if v is None else str(v).strip()
def norm_email(raw):
    v = s(raw).lower()
    if not v or v in ("unknown","n/a","-","none"): return None
    return v if "@" in v else None
def norm_jur(raw):
    v = s(raw).lower()
    if re.search(r"한국|korea|\bkr\b", v): return ("KR", True)
    if re.search(r"미국|united states|\bus\b|usa", v): return ("US", False)
    if re.search(r"영국|united kingdom|\buk\b|britain", v): return ("UK", False)
    if re.search(r"캐나다|canada|\bca\b", v): return ("CA", False)
    if re.search(r"eu|유럽|europe|germany|france|italy|spain|독일|프랑스", v): return ("EU", False)
    return ("OTHER", False)
def truthy(raw): return bool(re.match(r"^(y|yes|true|1|o|예|✓)$", s(raw), re.I))
def date_iso(raw):
    v = s(raw)
    if not v: return None
    m = re.search(r"(\d{4})[-./](\d{1,2})[-./](\d{1,2})", v)
    return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}" if m else None

def rows_xlsx(path, sheet):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True); ws = wb[sheet]
    it = ws.iter_rows(values_only=True); headers = [s(h) for h in next(it)]
    for r in it:
        if r is None: continue
        d = {headers[i]: r[i] for i in range(min(len(headers), len(r)))}
        if any(s(v) for v in d.values()): yield d
    wb.close()
def rows_csv(path):
    with open(path, encoding="utf-8-sig") as f:
        yield from csv.DictReader(f)

out = []; stats = {"src": Counter(), "email": Counter(), "seg": Counter(), "unseg": Counter()}
def add(preset, d):
    out.append(d); stats["src"][preset] += 1
    if d.get("email"): stats["email"][preset] += 1
    stats["seg"][d.get("segment_code") or "(none)"] += 1
    if not d.get("segment_code"): stats["unseg"][preset] += 1

for r in rows_xlsx(REPO/"Metatake_학계_평론가_DB.xlsx", "학계_평론가_개인"):
    org = s(r.get("소속/플랫폼")) or s(r.get("이름/매체"))
    if not org: continue
    jur, kr = norm_jur(s(r.get("관할권")) or s(r.get("국가")))
    add("academia", {"name": s(r.get("이름/매체")) or None, "org_name": org, "country": s(r.get("국가")) or None,
        "jurisdiction": jur, "kr_law_flag": kr or truthy(r.get("KR법유의")), "email": norm_email(r.get("공개이메일")),
        "channel_type":"email", "source_url": s(r.get("공식/프로필URL")) or None, "legal_basis":"문의용",
        "segment_code": SEG_ACADEMIA.get(s(r.get("카테고리")))})
for r in rows_xlsx(REPO/"Metatake_트레이드매체_DB.xlsx", "트레이드매체"):
    org = s(r.get("기관/매체"))
    if not org: continue
    emails = [e for e in (norm_email(x) for x in s(r.get("공개이메일")).split(";")) if e]
    jur, kr = norm_jur(s(r.get("관할권")) or s(r.get("국가")))
    add("trade", {"name": None, "org_name": org, "country": s(r.get("국가")) or None,
        "jurisdiction": jur, "kr_law_flag": kr or truthy(r.get("KR법유의")),
        "email": emails[0] if emails else None, "alt_emails": emails[1:], "channel_type":"email",
        "source_url": s(r.get("공식페이지URL")) or None, "legal_basis":"공개프레스",
        "segment_code": SEG_TRADE.get(s(r.get("매체유형")), "C1")})
for r in rows_csv(REPO/"data/sources/magazine-contacts.csv"):
    org = s(r.get("outlet_name"))
    if not org: continue
    cat = s(r.get("contact_type")).lower()
    add("magazine", {"name": s(r.get("person_name")) or None, "org_name": org,
        "role_title": s(r.get("person_title")) or None, "jurisdiction":"OTHER", "kr_law_flag": False,
        "email": norm_email(r.get("email")), "channel_type":"email",
        "source_url": s(r.get("source_url")) or s(r.get("profile_url")) or None,
        "collected_at": date_iso(r.get("last_verified")),
        "legal_basis": "비즈니스문의" if cat in ("advertising","marketing") else "공개프레스",
        "segment_code": SEG_MAG.get(cat, "C1")})
for r in rows_xlsx(REPO/"Metatake_컨택DB_템플릿.xlsx", "컨택DB"):
    org = s(r.get("이름/매체명"))
    if not org: continue
    ch = s(r.get("채널유형")).lower()
    channel = "form" if ("폼" in ch or "form" in ch) else "dm" if "dm" in ch else "email"
    jur, kr = norm_jur(s(r.get("관할권")) or s(r.get("국가/지역")))
    add("contactdb", {"org_name": org, "role_title": s(r.get("역할/부서")) or None, "country": s(r.get("국가/지역")) or None,
        "jurisdiction": jur, "kr_law_flag": kr,
        "email": norm_email(r.get("이메일/문의채널")) if channel=="email" else None,
        "contact_url": s(r.get("이메일/문의채널")) if channel!="email" else None, "channel_type": channel,
        "source_url": s(r.get("출처URL")) or None, "collected_at": date_iso(r.get("수집일")),
        "legal_basis": s(r.get("법적근거")) or "문의용", "segment_code": SEG_CONTACTDB.get(s(r.get("세그먼트")))})

seen = set(); deduped = []; dropped = 0
for d in out:
    e = (d.get("email") or "").lower()
    if e:
        if e in seen: dropped += 1; continue
        seen.add(e)
    d.setdefault("alt_emails", [])
    deduped.append(d)

OUT.write_text(json.dumps(deduped, ensure_ascii=False))
print("source:", dict(stats["src"]), "| with_email:", dict(stats["email"]))
print(f"mapped {len(out)} | after email-dedup {len(deduped)} | dropped {dropped} | with_email(final) {sum(1 for d in deduped if d.get('email'))}")
print("unsegmented:", dict(stats["unseg"]), "| out:", OUT)
