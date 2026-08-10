#!/usr/bin/env python3
"""talk-seed-post — publish the daily themed seed sets (owner-armed).

Each film gets its pre-generated, owner-skimmed set: a Gazette opening comment
(root), a Tray delivery reply (LLM-0: real score + director shelf), and on
flagged films a Prism angle reply. Runs hourly from cron; spreads the day's
quota across 09:00–23:00 local so nothing lands in one robotic burst. The
film-page Talk gate opens by itself once posts exist (lib/talk/server.ts).

    python3 worker/talk-seed-post.py --arm 2026-08-11   # start season day 1
    python3 worker/talk-seed-post.py [--dry-run]         # cron entry
"""
import datetime
import json
import math
import os
import re
import sys
import urllib.request

HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "talk-seed")
ROOT = os.path.dirname(os.path.dirname(HERE))
STATE = os.path.join(HERE, "post-state.json")
DRY = "--dry-run" in sys.argv

env = {}
for line in open(os.path.join(ROOT, ".env.local"), encoding="utf-8"):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip().strip('"').strip("'")
URL, KEY = env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json",
     "User-Agent": "metatake-worker/1.0 (talk-seed-post)"}


def rest(path, method="GET", body=None):
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", method=method,
        headers=dict(H, Prefer="return=representation") if method == "POST" else H,
        data=json.dumps(body).encode() if body is not None else None)
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw else None


def load_json(p, default):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return default


def comments():
    out = {}
    d = os.path.join(HERE, "out")
    for fn in sorted(os.listdir(d)):
        if fn.endswith(".json"):
            out.update(load_json(os.path.join(d, fn), {}))
    return out


def takescore(slug):
    try:
        rows = rest("rpc/takescore_for_slugs", "POST", {"p_slugs": [slug]})
        for r in rows or []:
            if r.get("slug") == slug and r.get("ts") is not None:
                return int(r["ts"])
    except Exception:
        pass
    return None


def tray_body(film):
    items = []
    ts = takescore(film["slug"])
    if ts is not None:
        items.append(f"TakeScore {ts} — the axis breakdown is at /takescore/film/{film['slug']}")
    if film.get("director_slug") and film.get("director"):
        items.append(f"{film['director']}'s shelf is at /director/{film['director_slug']}")
    return (". ".join(items) + ". Leaving this here.") if items else None


def post(row):
    if DRY:
        print("[dry]", row["author_app"], row.get("parent_id") or "root", "|", row["body"][:80])
        return {"id": f"dry-{row['addr_key']}"}
    return rest("talk_posts", "POST", row)[0]


def main():
    if "--arm" in sys.argv:
        date = sys.argv[sys.argv.index("--arm") + 1]
        st = load_json(STATE, {})
        st.update({"armed_from": date, "posted": st.get("posted", {})})
        json.dump(st, open(STATE, "w"), indent=1)
        print(f"armed: day 1 = {date}")
        return

    st = load_json(STATE, {})
    if not st.get("armed_from"):
        print("not armed — run with --arm YYYY-MM-DD after the skim")
        return
    today = datetime.date.today()
    day = (today - datetime.date.fromisoformat(st["armed_from"])).days + 1
    sched = load_json(os.path.join(HERE, "schedule.json"), {})
    days = {d["day"]: d for d in sched.get("season1", [])}
    if day < 1 or day not in days:
        print(f"day {day}: nothing scheduled")
        return
    hour = datetime.datetime.now().hour
    if hour < 9 or hour > 23:
        print("outside posting hours")
        return
    stamp = datetime.datetime.now().strftime("%Y-%m-%d-%H")
    if st.get("last_hour") == stamp:
        print("already posted this hour")
        return
    st["last_hour"] = stamp
    posted = st.setdefault("posted", {})
    todo = [s for s in days[day]["slugs"] if s not in posted]
    if not todo:
        print(f"day {day}: complete")
        return
    hours_left = max(1, 23 - hour + 1)
    quota = math.ceil(len(todo) / hours_left)
    src = {json.loads(l)["slug"]: json.loads(l) for l in open(os.path.join(HERE, "src.jsonl"), encoding="utf-8")}
    gen = comments()
    done = 0
    for slug in todo[:quota]:
        film, c = src.get(slug), gen.get(slug)
        if not film or not c or not c.get("gazette") or "?" in c["gazette"]:
            posted[slug] = "skipped"
            continue
        root = post({"addr_type": "film", "addr_key": slug, "film_key": slug,
                     "author_app": "gazette", "body": c["gazette"].strip(), "status": "published"})
        tb = tray_body(film)
        if tb:
            post({"parent_id": root["id"], "addr_type": "film", "addr_key": slug, "film_key": slug,
                  "author_app": "tray", "body": tb, "status": "published"})
        pr = (c.get("prism") or "").strip()
        if film.get("prism") and pr and "?" not in pr:
            post({"parent_id": root["id"], "addr_type": "film", "addr_key": slug, "film_key": slug,
                  "author_app": "prism", "body": pr, "status": "published"})
        posted[slug] = True
        done += 1
    if not DRY:
        json.dump(st, open(STATE, "w"), indent=1)
    print(f"day {day} ({days[day]['theme']}): +{done}, {len(todo) - done} remaining today")


if __name__ == "__main__":
    main()
