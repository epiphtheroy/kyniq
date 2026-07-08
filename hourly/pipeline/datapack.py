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
    rows = sb_get(env, f"films?select=id,slug,title,year,director,director_slug,genres,is_analyzed,backdrop_path,poster_path&slug=eq.{quote(slug)}&limit=1")
    return rows[0] if isinstance(rows, list) and rows else None


def _count(env: dict, path: str) -> int:
    """HEAD-less count via a tiny select; returns len of a capped fetch."""
    rows = sb_get(env, path)
    return len(rows) if isinstance(rows, list) else 0


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


def _locations_module(env: dict, film: dict, mid: str) -> dict | None:
    # film_locations is RLS-protected (atlas pages read it via a definer RPC);
    # the pipeline holds the service key, so read it directly with that.
    rows = sb_get(env, f"film_locations?select=name,country,narrative_setting,scene_role,tier&film_id=eq.{film['id']}&order=tier.asc.nullslast&limit=12", service=True)
    if not rows:
        return None
    body = []
    for r in rows:
        where = ", ".join([x for x in (r.get("name"), r.get("country")) if x]) or "—"
        role = r.get("scene_role") or r.get("narrative_setting") or ""
        body.append([where, role])
    return {"id": mid, "type": "locations",
            "title": f"Where it was shot — {film['title']}",
            "note": "Geolocated shooting and setting places behind the Atlas.",
            "columns": ["Place", "In the film"], "rows": body,
            "more_href": f"/film/atlas/{film['slug']}"}


def _misreadings_module(env: dict, film: dict, mid: str) -> dict | None:
    # published, non-invitation readings anchored on this film's figures
    rows = sb_get(env, "takes?select=meta_take:meta_takes!inner(slug,title,status,kind),figure:figures!inner(film:films!inner(slug))"
                       f"&figure.film.slug=eq.{quote(film['slug'])}&meta_take.status=eq.published&is_invitation=eq.false&limit=40")
    if not isinstance(rows, list) or not rows:
        return None
    seen, items = set(), []
    for r in rows:
        mt = r.get("meta_take") or {}
        s = mt.get("slug")
        if s and s not in seen and mt.get("kind") == "reading":
            seen.add(s)
            items.append({"label": mt["title"], "href": f"/take/{s}"})
    if len(items) < 2:
        return None
    return {"id": mid, "type": "misreadings",
            "title": f"Strong misreadings — {film['title']}",
            "note": "Readings the corpus already holds against this film's figures.",
            "items": items[:8], "more_href": f"/film/{film['slug']}/misreadings"}


def _essays_module(env: dict, film: dict, mid: str) -> dict | None:
    rows = sb_get(env, f"essays?select=mode,title,slug&film_id=eq.{film['id']}&status=eq.verified&lang=eq.en&limit=10")
    if not isinstance(rows, list) or not rows:
        return None
    items = [{"label": (r.get("title") or r.get("mode") or "essay").strip(),
              "note": (r.get("mode") or "").replace("_", " ") or None}
             for r in rows]
    return {"id": mid, "type": "essays",
            "title": f"Essays on file — {film['title']}",
            "note": "The desk's long-form readings of this film.",
            "items": items[:6]}


def _theorist_module(env: dict, theorist_id: str, name: str, mid: str) -> dict | None:
    rows = sb_get(env, f"meta_takes?select=slug,title&theorist_id=eq.{theorist_id}&status=eq.published&kind=eq.reading&limit=10")
    if not rows:
        return None
    items = [{"label": r["title"], "href": f"/take/{r['slug']}"} for r in rows]
    return {"id": mid, "type": "readings", "title": f"Readings built on {name}", "items": items}


def _film_archive_links(env: dict, film: dict, modules: list[dict]) -> list[dict]:
    """The anchor film's other live pages — collected at the foot of the piece
    so the reader can walk into the archive. Only links we know resolve."""
    slug, links = film["slug"], []
    types = {m["type"] for m in modules}
    links.append({"label": "The film page", "href": f"/film/{slug}", "note": "overview, figures, connections"})
    if "takescore" in types:
        links.append({"label": "TakeScore scorecard", "href": f"/takescore/film/{slug}", "note": "the full 13-dimension read"})
    if "canon" in types:
        links.append({"label": "Lineage & honors", "href": f"/film/lineage/{slug}", "note": "the record in the lists"})
    if "locations" in types:
        links.append({"label": "Shooting atlas", "href": f"/film/atlas/{slug}", "note": "every mapped place"})
    if "misreadings" in types:
        links.append({"label": "Strong misreadings", "href": f"/film/{slug}/misreadings", "note": "the readings, assembled"})
    if film.get("director_slug"):
        links.append({"label": film.get("director") or "The director", "href": f"/director/{film['director_slug']}", "note": "the filmography"})
    return links


def build_pack(env: dict, anchor: dict) -> dict:
    """anchor = {type: film|person|theorist, slug, label}. Returns
    {anchor, film_slug, image, modules, archive_links, depth} — modules carry ids."""
    modules: list[dict] = []
    film_slug: str | None = None
    image: dict | None = None
    archive_links: list[dict] = []

    if anchor["type"] == "film" and anchor.get("slug"):
        film = _film_row(env, anchor["slug"])
        if film:
            film_slug = film["slug"]
            anchor = {**anchor, "label": f"{film['title']} ({film.get('year') or '—'})"}
            bp = film.get("backdrop_path") or film.get("poster_path")
            if bp:
                image = {"path": bp, "alt": f"{film['title']} ({film.get('year') or ''})".strip()}
            for build, mid in ((_honors_module, "honors"), (_canon_module, "canon"),
                               (_takescore_module, "takescore"), (_reception_module, "reception"),
                               (_locations_module, "locations"), (_misreadings_module, "misreadings"),
                               (_essays_module, "essays")):
                m = build(env, film, mid)
                if m:
                    modules.append(m)
            if film.get("director"):
                m = _filmography_module(env, film["director"], film.get("director_slug"), "filmography", exclude_slug=film["slug"])
                if m:
                    modules.append(m)
            archive_links = _film_archive_links(env, film, modules)

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
    return {"anchor": anchor, "film_slug": film_slug, "image": image,
            "archive_links": archive_links, "modules": usable, "depth": len(usable)}
