#!/usr/bin/env python3
"""Now Playing — trend detection (Phase 0 dry run + the pipeline's DETECT stage).

Polls the free signal stack (TREND-SOURCES.md): Google Trends "Trending Now"
RSS per geo, the outlet RSS fleet, Reddit rising (optional) — then matches
candidates against the corpus entity cache (the beat gate) and scores the
mechanical rubric dimensions (spike, corroboration, beat). Corpus-depth and
search-shape are the selector's job (pipeline/produce.py).

Run alone = dry run: writes signals/ snapshot + appends to dryrun.log.md.
Stdlib only. Every source is optional — failures are logged, never fatal.

Usage: python3 hourly/poller/poller.py
"""
from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.common import HOURLY, http, log, now_utc  # noqa: E402

HERE = Path(__file__).resolve().parent
CFG = json.loads((HERE / "config.json").read_text())
STATE_DIR = HERE / "state"
STATE_DIR.mkdir(exist_ok=True)
SIGNALS = HOURLY / "signals"
SIGNALS.mkdir(exist_ok=True)

NS_HT = "{https://trends.google.com/trending/rss}"
CONTEXT_WORDS = re.compile(
    r"\b(film|movie|director|actor|actress|cast|casting|trailer|box office|sequel|remake|"
    r"oscar|academy award|festival|cannes|venice|premiere|review|cinema|screen|studio|a24|netflix)\b", re.I)


# ── fetch & parse ────────────────────────────────────────────────────────────

def fetch_trends(geo: str) -> list[dict]:
    status, data = http(f"https://trends.google.com/trending/rss?geo={geo}")
    if status != 200:
        log(f"trends {geo} -> HTTP {status}")
        return []
    out = []
    try:
        root = ET.fromstring(data)
        for item in root.iter("item"):
            kw = (item.findtext("title") or "").strip()
            if not kw:
                continue
            news = []
            for ni in item.findall(f"{NS_HT}news_item"):
                news.append({
                    "title": (ni.findtext(f"{NS_HT}news_item_title") or "").strip(),
                    "url": (ni.findtext(f"{NS_HT}news_item_url") or "").strip(),
                    "source": (ni.findtext(f"{NS_HT}news_item_source") or "").strip(),
                })
            out.append({
                "keyword": kw, "geo": geo,
                "traffic": (item.findtext(f"{NS_HT}approx_traffic") or "").strip(),
                "pub": (item.findtext("pubDate") or "").strip(),
                "news": news,
            })
    except ET.ParseError:
        log(f"trends {geo}: XML parse error")
    return out


def parse_feed(data: bytes) -> list[dict]:
    """Tolerant RSS/Atom item extraction: title, link, pubDate."""
    items = []
    try:
        root = ET.fromstring(data)
    except ET.ParseError:
        return items
    atom = "{http://www.w3.org/2005/Atom}"
    for it in root.iter("item"):
        items.append({"title": (it.findtext("title") or "").strip(),
                      "url": (it.findtext("link") or "").strip(),
                      "pub": (it.findtext("pubDate") or "").strip()})
    for it in root.iter(f"{atom}entry"):
        link = it.find(f"{atom}link")
        items.append({"title": (it.findtext(f"{atom}title") or "").strip(),
                      "url": link.get("href", "") if link is not None else "",
                      "pub": (it.findtext(f"{atom}updated") or "").strip()})
    return items


def fetch_fleet() -> list[dict]:
    """All outlet items, tagged with outlet + beat, best-effort recency filter."""
    out = []
    cutoff = datetime.now(timezone.utc) - timedelta(hours=CFG["fleet_window_hours"])
    for feed in CFG["fleet"]:
        status, data = http(feed["url"])
        if status != 200:
            log(f"fleet {feed['outlet']} -> HTTP {status}")
            continue
        n = 0
        for it in parse_feed(data):
            if not it["title"]:
                continue
            ts = None
            for fmt in ("%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S %Z", "%Y-%m-%dT%H:%M:%S%z"):
                try:
                    ts = datetime.strptime(it["pub"].replace("GMT", "+0000"), fmt)
                    break
                except Exception:
                    continue
            if ts and ts < cutoff:
                continue
            out.append({**it, "outlet": feed["outlet"], "beat": feed["beat"]})
            n += 1
        if n == 0:
            log(f"fleet {feed['outlet']}: 0 recent items")
    return out


def fetch_reddit() -> list[dict]:
    out = []
    for sub in CFG.get("reddit", []):
        status, data = http(f"https://www.reddit.com/r/{sub}/rising.json?limit=25",
                            headers={"User-Agent": CFG["user_agent"]})
        if status != 200:
            continue
        try:
            for ch in json.loads(data)["data"]["children"]:
                d = ch["data"]
                out.append({"title": d.get("title", ""), "score": d.get("score", 0),
                            "comments": d.get("num_comments", 0), "sub": sub})
        except Exception:
            continue
    return out


# ── beat gate: entity matching ───────────────────────────────────────────────

def load_entities() -> dict:
    f = HERE / "entities.json"
    if not f.exists():
        log("entities.json missing — run sync_entities.py first; beat gate disabled this run")
        return {"films": [], "directors": [], "theorists": []}
    return json.loads(f.read_text())


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", " ", s.lower()).strip()


def build_matchers(ents: dict):
    films, people = {}, {}
    for f in ents["films"]:
        t = norm(f["title"])
        if len(t) >= 3:
            films.setdefault(t, []).append(f)
    for d in ents["directors"]:
        people[norm(d["name"])] = {"type": "person", "slug": d.get("slug"), "label": d["name"], "films": d.get("films", 0)}
    for t in ents["theorists"]:
        if len(t["name"].split()) >= 2:
            people.setdefault(norm(t["name"]), {"type": "theorist", "slug": t["slug"], "label": t["name"], "films": 0})
    return films, people


def match_entity(text: str, films: dict, people: dict, assume_context: bool = False) -> dict | None:
    """Best corpus entity in `text`. Short or generic-phrase film titles only
    match when film-context words are present (trade/culture headlines pass
    `assume_context=True` — those outlets only write film/TV)."""
    t = norm(text)
    padded = f" {t} "
    best: dict | None = None

    for name, rec in people.items():
        if len(name) >= 7 and f" {name} " in padded:
            score = 5 if rec["type"] == "person" and rec["films"] >= 3 else 4
            if not best or score > best["beat"]:
                best = {"beat": score, "type": rec["type"], "slug": rec["slug"], "label": rec["label"]}

    has_context = assume_context or bool(CONTEXT_WORDS.search(text))
    for title, recs in films.items():
        if f" {title} " not in padded:
            continue
        # "the winner", "heat", "us" — generic phrases false-positive on world
        # news; anything short or single-token needs film context to count.
        risky = len(title) < 12 or len(title.split()) == 1
        if risky and not has_context:
            continue
        rec = max(recs, key=lambda r: (bool(r.get("analyzed")), r.get("year") or 0))
        score = 5 if rec.get("analyzed") else 4
        if not best or score > best["beat"] or (score == best["beat"] and len(title) > 10):
            best = {"beat": score, "type": "film", "slug": rec["slug"], "label": f"{rec['title']} ({rec.get('year') or '—'})"}
    return best


# ── scoring ──────────────────────────────────────────────────────────────────

def traffic_score(bucket: str) -> int:
    m = re.match(r"([\d.]+)\s*([KM]?)", bucket.replace(",", ""))
    if not m:
        return 1
    val = float(m.group(1)) * {"K": 1e3, "M": 1e6}.get(m.group(2), 1)
    for thresh, score in sorted(((int(k), v) for k, v in CFG["traffic_bucket_scores"].items()), reverse=True):
        if val >= thresh:
            return score
    return 1


def corroboration(keyword: str, entity_label: str | None, fleet: list[dict]) -> tuple[int, list[dict]]:
    """Distinct outlets whose recent titles carry the keyword (all long tokens) or the entity."""
    kw_tokens = [w for w in norm(keyword).split() if len(w) >= 4] or norm(keyword).split()
    ent = norm(entity_label.split("(")[0]) if entity_label else None
    hits, outlets = [], set()
    for it in fleet:
        t = norm(it["title"])
        ok = bool(kw_tokens) and all(w in t for w in kw_tokens)
        if not ok and ent and len(ent) >= 7 and ent in t:
            ok = True
        if ok:
            hits.append({"outlet": it["outlet"], "title": it["title"], "url": it["url"]})
            outlets.add(it["outlet"])
    n = len(outlets)
    return (5 if n >= 4 else 4 if n == 3 else 3 if n == 2 else 1 if n == 1 else 0), hits[:8]


# ── the run ──────────────────────────────────────────────────────────────────

def collect_candidates() -> dict:
    """One detection pass. Returns {'candidates': [...], 'errors': [...]} sorted best-first."""
    ents = load_entities()
    films, people = build_matchers(ents)
    fleet = fetch_fleet()
    reddit = fetch_reddit()
    reddit_blob = " ".join(norm(r["title"]) for r in reddit)

    seen_f = STATE_DIR / "seen.json"
    seen = json.loads(seen_f.read_text()) if seen_f.exists() else {}

    candidates = []
    for geo in CFG["trends_geos"]:
        for tr in fetch_trends(geo):
            key = f"{norm(tr['keyword'])}"
            first = seen.get(key, {}).get("first_seen") or now_utc()
            seen[key] = {"first_seen": first, "last_traffic": tr["traffic"], "last_seen": now_utc()}

            blob = " ".join([tr["keyword"]] + [n["title"] for n in tr["news"]])
            ent = match_entity(blob, films, people)
            corr, hits = corroboration(tr["keyword"], ent and ent["label"], fleet)
            reddit_echo = all(w in reddit_blob for w in norm(tr["keyword"]).split() if len(w) >= 4) and len(norm(tr["keyword"])) >= 8
            candidates.append({
                "source": "trends", "geo": geo, "keyword": tr["keyword"], "traffic": tr["traffic"],
                "first_seen": first, "spike": traffic_score(tr["traffic"]),
                "corroboration": corr, "beat": ent["beat"] if ent else 0,
                "entity": ent, "lane": "direct" if ent else "exception",
                "news": tr["news"], "fleet_hits": hits, "reddit_echo": reddit_echo,
            })

    # fleet-only early catches: corpus entity in ≥N distinct trade/culture outlets
    ent_outlets: dict[str, dict] = {}
    for it in fleet:
        if it["beat"] not in ("trade", "culture"):
            continue
        ent = match_entity(it["title"], films, people, assume_context=True)
        if not ent:
            continue
        rec = ent_outlets.setdefault(ent["label"], {"entity": ent, "outlets": set(), "hits": []})
        rec["outlets"].add(it["outlet"])
        rec["hits"].append({"outlet": it["outlet"], "title": it["title"], "url": it["url"]})
    known = {norm(c["entity"]["label"]) for c in candidates if c.get("entity")}
    for label, rec in ent_outlets.items():
        n = len(rec["outlets"])
        if n >= CFG["corroboration_min_outlets"] + 1 and norm(label) not in known:
            candidates.append({
                "source": "fleet", "geo": "-", "keyword": label.split("(")[0].strip(),
                "traffic": "", "first_seen": now_utc(), "spike": 2,
                "corroboration": 5 if n >= 4 else 4 if n == 3 else 3,
                "beat": rec["entity"]["beat"], "entity": rec["entity"], "lane": "direct",
                "news": [], "fleet_hits": rec["hits"][:8], "reddit_echo": False,
            })

    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    seen = {k: v for k, v in seen.items() if v.get("last_seen", "") >= cutoff}
    seen_f.write_text(json.dumps(seen))

    candidates.sort(key=lambda c: (c["spike"] + c["corroboration"] + c["beat"], c["beat"]), reverse=True)
    return {"at": now_utc(), "fleet_items": len(fleet), "candidates": candidates}


def main() -> None:
    snap = collect_candidates()
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d-%H%M")
    (SIGNALS / f"{stamp}.json").write_text(json.dumps(snap, ensure_ascii=False, indent=1))

    top = [c for c in snap["candidates"] if c["beat"] > 0][:5]
    lines = [f"\n## {snap['at']} — fleet items {snap['fleet_items']}, candidates {len(snap['candidates'])}"]
    if not top:
        lines.append("- PASS: no beat-territory candidate this run")
    for c in top:
        mech = c["spike"] + c["corroboration"] + c["beat"]
        lines.append(
            f"- [{mech:>2}] spike {c['spike']} · corr {c['corroboration']} · beat {c['beat']} · "
            f"**{c['keyword']}** ({c['traffic'] or c['source']}, {c['geo']}) → "
            f"{c['entity']['label'] if c['entity'] else '—'}"
            f"{' · reddit✓' if c.get('reddit_echo') else ''}")
    with open(HERE / "dryrun.log.md", "a") as f:
        f.write("\n".join(lines) + "\n")
    log(f"snapshot {stamp}: {len(snap['candidates'])} candidates, top beat: "
        + (top[0]["keyword"] if top else "none"))


if __name__ == "__main__":
    main()
