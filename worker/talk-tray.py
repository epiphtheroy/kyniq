#!/usr/bin/env python3
"""talk-tray — the one Talk app on stage (owner's final call, 2026-08-08).

When a real person leaves a root note, Tray replies once with information
only: no greeting, cool delivery, kind 해요체. Strictly LLM-0 — verified data
(TakeScore, the director's shelf) composed into fixed templates; if the plate
is empty, Tray stays silent. It never joins the conversation.

Run from cron every ~15 minutes:
    python3 /Users/jerryje/Developer/MetaTake/worker/talk-tray.py [--dry-run]

Guards: root human posts only (author_app null, parent null) · one tray reply
per thread, ever · posts must be 3+ minutes old (natural delay) · max 3
replies per run · watermark in worker/state/talk-tray.json.
"""
import json
import os
import re
import sys
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
STATE_PATH = os.path.join(HERE, "state", "talk-tray.json")
DRY = "--dry-run" in sys.argv

for line in open(os.path.join(ROOT, ".env.local"), encoding="utf-8"):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

SB_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SRK = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
HEADERS = {
    "apikey": SRK,
    "Authorization": f"Bearer {SRK}",
    "Content-Type": "application/json",
    # Supabase secret-key + default UA trips the 401 trap (common.py SB_UA lesson)
    "User-Agent": "metatake-worker/1.0 (talk-tray)",
}


def rest(path, method="GET", body=None):
    req = urllib.request.Request(
        f"{SB_URL}/rest/v1/{path}",
        method=method,
        headers=dict(HEADERS, Prefer="return=representation") if method == "POST" else HEADERS,
        data=json.dumps(body).encode() if body is not None else None,
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read().decode()
        return json.loads(raw) if raw else None


def load_state():
    try:
        return json.load(open(STATE_PATH, encoding="utf-8"))
    except Exception:
        return {"last": "2026-08-01T00:00:00+00:00"}


def save_state(state):
    os.makedirs(os.path.dirname(STATE_PATH), exist_ok=True)
    json.dump(state, open(STATE_PATH, "w", encoding="utf-8"), indent=2)


def is_korean(text):
    return re.search(r"[가-힣]", text) is not None


def takescore(slug):
    try:
        rows = rest("rpc/takescore_for_slugs", "POST", {"p_slugs": [slug]})
        for r in rows or []:
            if r.get("slug") == slug and r.get("ts") is not None:
                return int(r["ts"])
    except Exception:
        pass
    return None


def compose(post, film):
    """The plate: verified items only. Empty plate → None (Tray stays silent)."""
    slug = film["slug"]
    ts = takescore(slug)
    dslug = film.get("director_slug")
    director = film.get("director")
    items_ko, items_en = [], []
    if ts is not None:
        items_ko.append(f"TakeScore {ts} — 축 내역은 /takescore/film/{slug} 에 펴 있어요")
        items_en.append(f"TakeScore {ts} — the axis breakdown is at /takescore/film/{slug}")
    if dslug and director:
        items_ko.append(f"{director} 서가는 /director/{dslug} 에 있어요")
        items_en.append(f"{director}'s shelf is at /director/{dslug}")
    if not items_ko:
        return None
    if is_korean(post["body"]):
        return ". ".join(items_ko) + ". 놓고 가요."
    return ". ".join(items_en) + ". Leaving this here."


def main():
    state = load_state()
    posts = rest(
        "talk_posts?status=eq.published&author_app=is.null&parent_id=is.null"
        f"&film_key=not.is.null&created_at=gt.{urllib.parse.quote(state['last'])}"
        "&select=id,addr_type,addr_key,film_key,body,created_at"
        "&order=created_at.asc&limit=20"
    ) or []
    import datetime

    now = datetime.datetime.now(datetime.timezone.utc)
    served = 0
    for post in posts:
        if served >= 3:
            break
        created = datetime.datetime.fromisoformat(post["created_at"].replace("Z", "+00:00"))
        if (now - created).total_seconds() < 180:
            break  # too fresh — natural delay; watermark stays before it
        existing = rest(f"talk_posts?parent_id=eq.{post['id']}&author_app=eq.tray&select=id&limit=1")
        if existing:
            state["last"] = post["created_at"]
            continue
        films = rest(f"films?slug=eq.{post['film_key']}&select=slug,title,director,director_slug&limit=1")
        if not films:
            state["last"] = post["created_at"]
            continue
        body = compose(post, films[0])
        if body is None:
            state["last"] = post["created_at"]
            continue  # empty plate — silence
        if DRY:
            print(f"[dry] would reply to {post['id']} ({post['film_key']}):\n      {body}")
        else:
            rest(
                "talk_posts",
                "POST",
                {
                    "parent_id": post["id"],
                    "addr_type": post["addr_type"],
                    "addr_key": post["addr_key"],
                    "film_key": post["film_key"],
                    "author_app": "tray",
                    "body": body,
                    "status": "published",
                },
            )
            print(f"served {post['id']} ({post['film_key']})")
        served += 1
        state["last"] = post["created_at"]
    if not DRY:
        save_state(state)
    print(f"done — {served} served, watermark {state['last']}")


if __name__ == "__main__":
    main()
