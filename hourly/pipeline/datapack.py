#!/usr/bin/env python3
"""Now Playing — the data pack builder (deterministic SQL, no LLM).

Given the anchor entity, assembles "The record" modules straight from the
corpus with verified internal URLs. The writer may only SELECT from these
modules (by id) and caption them — nothing remembered, everything retrieved
(hourly/README.md v2, corpus-depth gate: >= 3 usable modules or PASS).
"""
from __future__ import annotations

from urllib.parse import quote

from .common import sb_get


def _film_row(env: dict, slug: str) -> dict | None:
    rows = sb_get(env, f"films?select=id,slug,title,year,director,director_slug,genres,is_analyzed&slug=eq.{quote(slug)}&limit=1")
    return rows[0] if isinstance(rows, list) and rows else None


def _honors_module(env: dict, film: dict, mid: str) -> dict | None:
    rows = sb_get(env, f"film_wd_honors?select=kind,label,event_date,year_only&film_id=eq.{film['id']}&order=event_date.asc.nullslast&limit=14")
    if not rows:
        return None
    body = []
    for r in rows:
        year = (r.get("event_date") or "")[:4] or (str(r["year_only"]) if r.get("year_only") else "—")
        kind = (r.get("kind") or "").replace("_", " ")
        body.append([year, r.get("label") or "", kind])
    return {"id": mid, "type": "honors", "title": f"The honors record — {film['title']}",
            "columns": ["Year", "Honor", "Kind"], "rows": body}


def _canon_module(env: dict, film: dict, mid: str) -> dict | None:
    rows = sb_get(env, "film_lineage?select=rank,result,facet,list:lineage_lists(label,tier),edition:lineage_editions(year,edition_label)"
                       f"&film_id=eq.{film['id']}&order=created_at.asc&limit=14")
    if not rows:
        return None
    body = []
    for r in rows:
        lst = (r.get("list") or {}).get("label") or "—"
        ed = r.get("edition") or {}
        when = str(ed.get("year") or ed.get("edition_label") or "")
        place = f"#{r['rank']}" if r.get("rank") else (r.get("result") or "listed")
        body.append([lst, when, place])
    return {"id": mid, "type": "canon",
            "title": "Canon appearances",
            "note": "Where the film stands in the lists and prizes the archive tracks.",
            "columns": ["List / prize", "Edition", "Standing"], "rows": body,
            "more_href": f"/film/lineage/{film['slug']}"}


def _takescore_module(env: dict, film: dict, mid: str) -> dict | None:
    rows = sb_get(env, f"film_scores?select=total_score,prestige_score,discovery_score,components&film_id=eq.{film['id']}&limit=1")
    if not (isinstance(rows, list) and rows):
        return None
    s = rows[0]
    items = [{"label": f"TakeScore {round(s['total_score'])}" if s.get("total_score") is not None else "TakeScore —",
              "href": f"/takescore/film/{film['slug']}", "note": "the full scorecard"}]
    for k, lbl in (("prestige_score", "Prestige"), ("discovery_score", "Discovery")):
        if s.get(k) is not None:
            items.append({"label": f"{lbl}: {round(s[k])}"})
    comps = s.get("components") or {}
    if isinstance(comps, dict):
        for k, v in list(comps.items())[:5]:
            if isinstance(v, (int, float)):
                items.append({"label": f"{k.replace('_', ' ').title()}: {round(v)}"})
    return {"id": mid, "type": "takescore", "title": f"TakeScore — {film['title']}", "items": items}


def _reception_module(env: dict, film: dict, mid: str) -> dict | None:
    rows = sb_get(env, f"film_reception?select=review_year,outlet,critic,verdict&film_id=eq.{film['id']}&order=review_year.asc.nullslast&limit=10")
    if not rows:
        return None
    body = [[str(r.get("review_year") or "—"), r.get("outlet") or r.get("critic") or "—", r.get("verdict") or "—"] for r in rows]
    return {"id": mid, "type": "reception", "title": "The reception arc",
            "note": "How the critical record moved, year by year.",
            "columns": ["Year", "Voice", "Verdict"], "rows": body}


def _filmography_module(env: dict, director: str, director_slug: str | None, mid: str, exclude_slug: str | None = None) -> dict | None:
    rows = sb_get(env, f"films?select=slug,title,year,is_analyzed&director=eq.{quote(director)}&visible=eq.true&order=year.asc&limit=20")
    if not rows:
        return None
    items = []
    for f in rows:
        if exclude_slug and f["slug"] == exclude_slug:
            continue
        items.append({"label": f"{f['title']} ({f.get('year') or '—'})", "href": f"/film/{f['slug']}",
                      **({"note": "analyzed in depth"} if f.get("is_analyzed") else {})})
    if not items:
        return None
    return {"id": mid, "type": "filmography", "title": f"{director} in the corpus",
            **({"more_href": f"/director/{director_slug}"} if director_slug else {}), "items": items[:12]}


def _theorist_module(env: dict, theorist_id: str, name: str, mid: str) -> dict | None:
    rows = sb_get(env, f"meta_takes?select=slug,title&theorist_id=eq.{theorist_id}&status=eq.published&kind=eq.reading&limit=10")
    if not rows:
        return None
    items = [{"label": r["title"], "href": f"/take/{r['slug']}"} for r in rows]
    return {"id": mid, "type": "readings", "title": f"Readings built on {name}", "items": items}


def build_pack(env: dict, anchor: dict) -> dict:
    """anchor = {type: film|person|theorist, slug, label}. Returns
    {anchor, film_slug, modules: [...], depth} — modules carry stable ids."""
    modules: list[dict] = []
    film_slug: str | None = None

    if anchor["type"] == "film" and anchor.get("slug"):
        film = _film_row(env, anchor["slug"])
        if film:
            film_slug = film["slug"]
            anchor = {**anchor, "label": f"{film['title']} ({film.get('year') or '—'})"}
            for build, mid in ((_honors_module, "honors"), (_canon_module, "canon"),
                               (_takescore_module, "takescore"), (_reception_module, "reception")):
                m = build(env, film, mid)
                if m:
                    modules.append(m)
            if film.get("director"):
                m = _filmography_module(env, film["director"], film.get("director_slug"), "filmography", exclude_slug=film["slug"])
                if m:
                    modules.append(m)

    elif anchor["type"] == "person":
        name = anchor["label"]
        m = _filmography_module(env, name, anchor.get("slug"), "filmography")
        if m:
            modules.append(m)
            # honors + scores of their strongest corpus films add depth
            films = sb_get(env, f"films?select=id,slug,title,year,is_analyzed&director=eq.{quote(name)}&visible=eq.true&order=is_analyzed.desc,year.desc&limit=3")
            for f in films or []:
                for build, mid in ((_honors_module, f"honors-{f['slug']}"), (_takescore_module, f"takescore-{f['slug']}")):
                    mm = build(env, f, mid)
                    if mm:
                        modules.append(mm)
                if not film_slug:
                    film_slug = f["slug"]

    elif anchor["type"] == "theorist" and anchor.get("slug"):
        rows = sb_get(env, f"theorists?select=id,name&slug=eq.{quote(anchor['slug'])}&limit=1")
        if isinstance(rows, list) and rows:
            m = _theorist_module(env, rows[0]["id"], rows[0]["name"], "readings")
            if m:
                modules.append(m)

    usable = [m for m in modules if (m.get("rows") or m.get("items"))]
    return {"anchor": anchor, "film_slug": film_slug, "modules": usable, "depth": len(usable)}
