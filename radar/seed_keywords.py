#!/usr/bin/env python3
"""Seed the Phase-0 100 keywords (정본: HANDOFF-키워드레이더.md §10).

47 curated, verified entities (film titles with the ⚠ context-gate flag,
directors, theorists, movements/concepts) + up to 53 supplements drawn from the
local hourly/poller/entities.json (analyzed, distinctive, 2+-word names; the
theorist list is filtered for composite-name pollution). Upserts into
radar_keywords on the unique `keyword`. Idempotent — safe to re-run.

Usage: python3 radar/seed_keywords.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from common import load_env, log, sb_post  # noqa: E402
from matcher import norm  # noqa: E402

ENTITIES = HERE.parent / "hourly" / "poller" / "entities.json"

# (display, match_text, kind, require_context, aliases)
CURATED: list[tuple] = [
    # ── films (⚠ require_context = short/generic title) ──
    ("In the Mood for Love (2000)", "In the Mood for Love", "film", False, ["화양연화"]),
    ("Mulholland Drive (2001)", "Mulholland Drive", "film", False, ["멀홀랜드 드라이브"]),
    ("Parasite (2019)", "Parasite", "film", True, ["기생충"]),
    ("Melancholia (2011)", "Melancholia", "film", True, []),
    ("Stalker (1979)", "Stalker", "film", True, ["스토커"]),
    ("Persona (1966)", "Persona", "film", True, []),
    ("Oldboy (2003)", "Oldboy", "film", True, ["올드보이"]),
    ("Chungking Express (1994)", "Chungking Express", "film", False, ["중경삼림"]),
    ("The Zone of Interest (2023)", "The Zone of Interest", "film", False, []),
    ("Burning (2018)", "Burning", "film", True, ["버닝"]),
    ("Aftersun (2022)", "Aftersun", "film", True, []),
    ("Portrait of a Lady on Fire (2019)", "Portrait of a Lady on Fire", "film", False, []),
    ("Come and See (1985)", "Come and See", "film", True, []),
    ("Paris, Texas (1984)", "Paris, Texas", "film", True, []),
    ("Anatomy of a Fall (2023)", "Anatomy of a Fall", "film", False, []),
    ("Memories of Murder (2003)", "Memories of Murder", "film", False, ["살인의 추억"]),
    ("Decision to Leave (2022)", "Decision to Leave", "film", False, ["헤어질 결심"]),
    ("Poor Things (2023)", "Poor Things", "film", True, []),
    ("La Haine (1995)", "La Haine", "film", True, []),
    ("Perfect Days (2023)", "Perfect Days", "film", True, []),
    # ── directors (people, no context gate needed) ──
    ("Hong Sang-soo", "Hong Sang-soo", "director", False, ["홍상수"]),
    ("Martin Scorsese", "Martin Scorsese", "director", False, ["마틴 스코세이지"]),
    ("Alfred Hitchcock", "Alfred Hitchcock", "director", False, ["히치콕"]),
    ("Akira Kurosawa", "Akira Kurosawa", "director", False, ["구로사와 아키라"]),
    ("Jean-Luc Godard", "Jean-Luc Godard", "director", False, ["장뤽 고다르"]),
    ("Ingmar Bergman", "Ingmar Bergman", "director", False, ["잉마르 베리만"]),
    ("Pedro Almodóvar", "Pedro Almodóvar", "director", False, ["알모도바르"]),
    ("Werner Herzog", "Werner Herzog", "director", False, ["베르너 헤어초크"]),
    ("Richard Linklater", "Richard Linklater", "director", False, []),
    ("Spike Lee", "Spike Lee", "director", True, []),
    ("Stanley Kubrick", "Stanley Kubrick", "director", False, ["큐브릭"]),
    ("Im Kwon-taek", "Im Kwon-taek", "director", False, ["임권택"]),
    # ── theorists ──
    ("Laura Mulvey", "Laura Mulvey", "theorist", False, []),
    ("Gilles Deleuze", "Gilles Deleuze", "theorist", False, ["들뢰즈"]),
    ("André Bazin", "André Bazin", "theorist", False, ["바쟁"]),
    ("Siegfried Kracauer", "Siegfried Kracauer", "theorist", False, []),
    ("Walter Benjamin", "Walter Benjamin", "theorist", False, ["벤야민"]),
    ("Susan Sontag", "Susan Sontag", "theorist", False, ["손택"]),
    ("Slavoj Žižek", "Slavoj Žižek", "theorist", False, ["지젝"]),
    ("Sergei Eisenstein", "Sergei Eisenstein", "theorist", False, ["에이젠슈타인"]),
    ("David Bordwell", "David Bordwell", "theorist", False, []),
    ("Mark Fisher", "Mark Fisher", "theorist", True, []),
    ("Jacques Rancière", "Jacques Rancière", "theorist", False, ["랑시에르"]),
    ("bell hooks", "bell hooks", "theorist", True, []),
    # ── movements / concepts ──
    ("French New Wave", "French New Wave", "movement", False, ["누벨바그", "Nouvelle Vague"]),
    ("Italian Neorealism", "Italian Neorealism", "movement", False, ["네오리얼리즘"]),
    ("Dogme 95", "Dogme 95", "movement", False, ["도그마 95"]),
    ("auteur theory", "auteur theory", "concept", True, ["작가주의"]),
    ("male gaze", "male gaze", "concept", True, ["남성적 시선"]),
]


def supplements(target: int) -> list[tuple]:
    """Pull distinctive analyzed films + prolific directors + clean theorists
    from the local entity cache to reach `target` total."""
    out: list[tuple] = []
    if not ENTITIES.exists():
        log(f"entities.json missing at {ENTITIES} — curated-only seed ({len(CURATED)})")
        return out
    ents = json.loads(ENTITIES.read_text())
    have = {norm(m) for _, m, *_ in CURATED}

    # films: analyzed, 12+-char title, multi-word (distinctive)
    films = [f for f in ents.get("films", [])
             if f.get("analyzed") and f.get("title") and len(f["title"]) >= 12
             and len(f["title"].split()) >= 2 and norm(f["title"]) not in have]
    films.sort(key=lambda f: -(f.get("year") or 0))
    for f in films[:30]:
        disp = f"{f['title']} ({f['year']})" if f.get("year") else f["title"]
        out.append((disp, f["title"], "film", False, []))
        have.add(norm(f["title"]))

    # directors: prolific, 2+-word names
    dirs = [d for d in ents.get("directors", [])
            if d.get("name") and len(d["name"].split()) >= 2 and norm(d["name"]) not in have]
    for d in dirs[:15]:
        out.append((d["name"], d["name"], "director", False, []))
        have.add(norm(d["name"]))

    # theorists: 2+-word, no parentheses (composite-name pollution filter)
    ths = [t for t in ents.get("theorists", [])
           if t.get("name") and len(t["name"].split()) >= 2 and "(" not in t["name"]
           and norm(t["name"]) not in have]
    for t in ths[:20]:
        out.append((t["name"], t["name"], "theorist", False, []))
        have.add(norm(t["name"]))

    need = target - len(CURATED)
    return out[:max(0, need)]


def tier_for(kind: str, disp: str) -> str:
    if kind == "director":
        return "hot"
    m = re.search(r"\((\d{4})\)", disp)
    if m and int(m.group(1)) >= 2022:
        return "hot"
    if kind in ("theorist", "concept", "movement"):
        return "warm"
    return "warm"


def main() -> None:
    env = load_env()
    rows_spec = CURATED + supplements(100)
    rows = []
    seen = set()
    for disp, match, kind, ctx, aliases in rows_spec:
        if disp in seen:
            continue
        seen.add(disp)
        rows.append({
            "keyword": disp, "match_text": match, "norm": norm(match), "kind": kind,
            "tier": tier_for(kind, disp), "aliases": aliases, "require_context": ctx,
            "active": True,
        })
    status, _ = sb_post(env, "radar_keywords", rows, on_conflict="keyword", ignore=True)
    ctx = sum(1 for r in rows if r["require_context"])
    log(f"seeded {len(rows)} keywords (HTTP {status}); curated={len(CURATED)} "
        f"supplements={len(rows) - len(CURATED)}, {ctx} context-gated")


if __name__ == "__main__":
    main()
