#!/usr/bin/env python3
"""talk-seed plan — curate the ground_truth audit (corner_assignments, 579 films)
into a themed day-by-day seeding schedule for the Talk layer.

The variation comes from themes, not RNG: one theme per day, day size = the
theme's natural size (clamped 8..50). Day 1 is the big opening. Season 1 =
first 21 days; the remainder is parked as season 2.

Output: schedule.json (days) + src.jsonl (one film per line, prism flag on
every 3rd). Deterministic — safe to re-run until generation starts.
"""
import json
import os
import re
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
env = {}
for line in open(os.path.join(ROOT, ".env.local"), encoding="utf-8"):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip().strip('"').strip("'")
URL, KEY = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "User-Agent": "metatake-worker/1.0"}


def q(path):
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", headers=H)
    return json.load(urllib.request.urlopen(req, timeout=30))


rows = q("corner_assignments?mode=eq.ground_truth&select=film_id,rationale,gt_lane&limit=1000")
ids = list({r["film_id"] for r in rows})
films = {}
for i in range(0, len(ids), 100):
    chunk = ",".join(f'"{x}"' for x in ids[i : i + 100])
    for f in q(f"films?id=in.({chunk})&select=id,slug,title,year,director,director_slug,visible"):
        if f.get("visible"):
            films[f["id"]] = f

BUCKETS = [
    ("streets", "이 거리들은 진짜다 — 네오리얼리즘의 계약", r"neorealis|real streets|real .*(location|village|slum)|shot in actual"),
    ("nonactors", "배우가 아닌 사람들", r"non-?professional|non-actor|nonprofessional|real (painter|pickpocket|drill|perpetrator)"),
    ("press", "신문이 먼저 알았다 — 실화 취재", r"journalis|newspaper|reporter|investigat|Globe|case"),
    ("war", "역사의 현장에서 찍다", r"war|massacre|battle|resistance|occupation|holocaust|genocide|survivor|bomb"),
    ("politics", "권력의 기록", r"trial|hearing|assassin|coup|protest|scandal|political|regime|purge"),
    ("rebuilt", "재현의 장인들", r"reconstruct|recreat|replica|period|rebuilt|built a|meticulous"),
    ("bodies", "몸으로 찍은 영화", r"without special effects|actually performed|12 real years|real time|improvis"),
    ("record_rest", "기록과 마주 선 영화들", r".*"),
]


def bucket_of(r):
    text = r["rationale"] or ""
    for key, _, rx in BUCKETS[:-1]:
        if re.search(rx, text, re.I):
            return key
    return "record_rest"


by_bucket = {k: [] for k, _, _ in BUCKETS}
for r in rows:
    f = films.get(r["film_id"])
    if not f:
        continue
    by_bucket[bucket_of(r)].append(
        {"slug": f["slug"], "title": f["title"], "year": f["year"], "director": f["director"],
         "director_slug": f["director_slug"], "lane": r["gt_lane"], "rationale": r["rationale"]}
    )

for k in by_bucket:
    by_bucket[k].sort(key=lambda x: (x["year"] or 9999, x["slug"]))

# Day plan: opening day from `streets` (up to 45), then rotate buckets in slices.
days = []
opening = by_bucket["streets"][:45]
by_bucket["streets"] = by_bucket["streets"][45:]
days.append({"theme": "이 거리들은 진짜다 — 개장", "films": opening})
order = ["press", "rebuilt", "war", "nonactors", "politics", "bodies", "streets", "record_rest"]
SLICE = {"press": 15, "rebuilt": 30, "war": 12, "nonactors": 20, "politics": 15, "bodies": 20, "streets": 25, "record_rest": 25}
labels = {k: t for k, t, _ in BUCKETS}
while any(by_bucket[k] for k in order):
    for k in order:
        if not by_bucket[k]:
            continue
        take = by_bucket[k][: SLICE[k]]
        by_bucket[k] = by_bucket[k][SLICE[k]:]
        if len(take) < 8 and by_bucket["record_rest"]:
            extra = by_bucket["record_rest"][: 8 - len(take)]
            by_bucket["record_rest"] = by_bucket["record_rest"][len(extra):]
            take += extra
        if take:
            days.append({"theme": labels[k], "films": take})

season1, season2, count = [], [], 0
for d in days:
    if len(season1) < 21:
        season1.append(d)
        count += len(d["films"])
    else:
        season2.append(d)

src = []
i = 0
for d in season1 + season2:
    for f in d["films"]:
        f["prism"] = i % 3 == 2
        src.append(f)
        i += 1

json.dump(
    {"season1": [{"day": n + 1, "theme": d["theme"], "slugs": [f["slug"] for f in d["films"]]} for n, d in enumerate(season1)],
     "season2": [{"theme": d["theme"], "slugs": [f["slug"] for f in d["films"]]} for d in season2]},
    open(os.path.join(HERE, "schedule.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
with open(os.path.join(HERE, "src.jsonl"), "w", encoding="utf-8") as fh:
    for f in src:
        fh.write(json.dumps(f, ensure_ascii=False) + "\n")

print(f"films: {len(src)} · season1 days: {len(season1)} ({count} films) · season2 days: {len(season2)}")
for n, d in enumerate(season1[:8]):
    print(f"  day{n+1}: {d['theme']} — {len(d['films'])}")
