#!/usr/bin/env python3
"""Now Playing — the data pack builder (deterministic SQL, no LLM).

Given the anchor entity, assembles "The record" modules straight from the
corpus with verified internal URLs. The writer may only SELECT from these
modules (by id) and caption them — nothing remembered, everything retrieved
(hourly/README.md v2, corpus-depth gate: >= 3 usable modules or PASS).
"""
from __future__ import annotations

from urllib.parse import quote

from .common import sb_get, sb_rpc

# TakeScore / CineCodex dimensions — key → (route slug, label). Mirrors
# lib/cinecodex_dims.ts so each score links to its /takescore/[dim] page.
CODEX_DIMS = {
    "cog": ("cognitive", "Cognitive"), "aff": ("affective", "Affective"),
    "form": ("formal", "Formal"), "moral": ("moral", "Moral"),
    "dur": ("durability", "Durability"), "itx": ("intertextual", "Intertextual"),
    "fr": ("formal-radicalism", "Formal radicalism"), "etx": ("extratextual", "Extratextual"),
    "ctx": ("auteur-oeuvre", "Auteur oeuvre"), "bank": ("hollowness", "Hollowness"),
    "insincere": ("insincerity", "Insincerity"), "coward": ("cowardice", "Cowardice"),
    "polar": ("polarization", "Polarization"),
}

# Which of the three TakeScore groups each sub-dimension belongs to (mirrors
# lib/cinecodex_dims.ts CodexDim.group). Used to pick the right verdict word.
DIM_GROUP = {
    "cog": "value", "aff": "value", "form": "value", "moral": "value", "dur": "value",
    "itx": "cost", "fr": "cost", "etx": "cost", "ctx": "cost",
    "bank": "risk", "insincere": "risk", "coward": "risk", "polar": "risk",
}

# The 1..5 verdict WORDS per group — byte-identical to lib/takescore_prose.ts
# BAND_WORDS (public vocabulary). We surface these instead of a corpus rank
# (owner's rule 2026-07-10: rank invites criticism; verdict words are the honest
# read). Em-dashes removed to satisfy the no-em-dash house rule.
BAND_WORDS = {
    "value": ["Faint traces", "Fair returns", "Solid, not peak", "Strong, lasting", "Exceptional, canon-grade"],
    "cost": ["Walk right in", "Some homework", "Real preparation", "Advanced viewing", "Expert terrain"],
    "risk": ["Nearly riskless", "Low downside", "Some hazard", "High letdown risk", "Severe, a gamble"],
}


def _band_of(score: float) -> int:
    return max(1, min(5, round(score / 20)))


def _band_word(group: str, score: float) -> str:
    return BAND_WORDS[group][_band_of(score) - 1]


def _verdict_quadrant(v: float, r: float) -> tuple[str, str]:
    """(headline phrase, tail) — the same quadrant logic as verdictSentence().
    Thresholds match the private Appraisal: high value >= 72, low risk <= 20."""
    hi_v, lo_r = v >= 72, r <= 20
    if hi_v and lo_r:
        return "High value, low risk", "a safe masterpiece"
    if hi_v and not lo_r:
        return "High value, high risk", "ambitious but divisive"
    if not hi_v and lo_r:
        return "Solid but not peak", "a stable choice"
    return "Mid value, mid risk", "approach with care"


def _film_row(env: dict, slug: str) -> dict | None:
    rows = sb_get(env, f"films?select=id,slug,title,year,director,director_slug,genres,is_analyzed,backdrop_path,poster_path&slug=eq.{quote(slug)}&limit=1")
    return rows[0] if isinstance(rows, list) and rows else None


def _count(env: dict, path: str) -> int:
    """HEAD-less count via a tiny select; returns len of a capped fetch."""
    rows = sb_get(env, path)
    return len(rows) if isinstance(rows, list) else 0


def _honors_module(env: dict, film: dict, mid: str) -> dict | None:
    rows = sb_get(env, f"film_wd_honors?select=kind,label,event_date,year_only,qid&film_id=eq.{film['id']}&order=event_date.asc.nullslast&limit=14")
    if not rows:
        return None
    body = []
    for r in rows:
        year = (r.get("event_date") or "")[:4] or (str(r["year_only"]) if r.get("year_only") else "—")
        kind = (r.get("kind") or "").replace("_", " ")
        # each honor links to its Wikidata entity (the authoritative record)
        label = r.get("label") or ""
        cell = {"text": label, "href": f"https://www.wikidata.org/wiki/{r['qid']}"} if r.get("qid") else label
        body.append([year, cell, kind])
    return {"id": mid, "type": "honors", "title": f"The honors record — {film['title']}",
            "note": "Each entry links to its Wikidata record.",
            "columns": ["Year", "Honor", "Kind"], "rows": body}


def _canon_module(env: dict, film: dict, mid: str) -> dict | None:
    rows = sb_get(env, "film_lineage?select=rank,result,facet,list:lineage_lists(label,slug,tier),edition:lineage_editions(year,edition_label)"
                       f"&film_id=eq.{film['id']}&order=created_at.asc&limit=14")
    if not rows:
        return None
    body = []
    for r in rows:
        lst = r.get("list") or {}
        label = lst.get("label") or "—"
        # link the list to our lineage hub for it (internal)
        cell = {"text": label, "href": f"/lineage/{lst['slug']}"} if lst.get("slug") else label
        ed = r.get("edition") or {}
        when = str(ed.get("year") or ed.get("edition_label") or "")
        place = f"#{r['rank']}" if r.get("rank") else (r.get("result") or "listed")
        body.append([cell, when, place])
    return {"id": mid, "type": "canon",
            "title": "Canon appearances",
            "note": "Where the film stands in the lists and prizes the archive tracks. Each list links to its page here.",
            "columns": ["List / prize", "Edition", "Standing"], "rows": body,
            "more_href": f"/film/lineage/{film['slug']}"}


def _takescore_module(env: dict, film: dict, mid: str) -> dict | None:
    # Metatake's own appraisal via the cinecodex_card RPC (V/C/R + the 13 named
    # dimensions). We surface VERDICT WORDS, never a corpus rank (owner's rule
    # 2026-07-10) — rank is criticizable; a rank only appears when it is a
    # genuine top-1000 standing. V/C/R are spelled out (no bare abbreviations);
    # only the film's value strengths are named, so no dimension reads as a jab.
    card = sb_rpc(env, "cinecodex_card", {"p_slug": film["slug"]})
    if not isinstance(card, dict) or card.get("v") is None:
        return None
    v = card["v"]
    c = card.get("c") or 0
    r = card.get("r") or 0
    rank, total = card.get("rank"), card.get("rank_total")
    slug = film["slug"]
    qword, qtail = _verdict_quadrant(v, r)

    comp_note = qtail
    if rank and total and rank <= 1000:  # a top-1000 standing is a fact worth stating
        comp_note = f"{qtail} · ranks {rank} of {total:,} in the corpus"

    items = [
        {"label": f"TakeScore™ — {qword}", "href": f"/takescore/film/{slug}", "note": comp_note},
        {"label": f"Value (what you keep) — {_band_word('value', v)}", "href": f"/takescore/film/{slug}"},
        {"label": f"Cost (what it asks) — {_band_word('cost', c)}", "href": f"/takescore/film/{slug}"},
        {"label": f"Risk (how it can go wrong) — {_band_word('risk', r)}", "href": f"/takescore/film/{slug}"},
    ]
    # name only the strongest VALUE dimensions (strengths), each as a verdict word
    subs = card.get("subs") or {}
    if isinstance(subs, dict):
        val = sorted(((k, s) for k, s in subs.items()
                      if isinstance(s, (int, float)) and DIM_GROUP.get(k) == "value" and k in CODEX_DIMS),
                     key=lambda kv: kv[1], reverse=True)
        for k, s in val[:3]:
            dslug, label = CODEX_DIMS[k]
            items.append({"label": f"{label} — {_band_word('value', s)}", "href": f"/takescore/{dslug}"})
    return {"id": mid, "type": "takescore",
            "title": f"TakeScore™ — {film['title']}",
            "note": "Metatake's own appraisal, read as verdicts rather than a ranking: Value (what you keep), "
                    "Cost (what it asks), Risk (how it can go wrong). Each links to its scale.",
            "items": items}


def _reception_module(env: dict, film: dict, mid: str) -> dict | None:
    rows = sb_get(env, f"film_reception?select=review_year,outlet,critic,verdict,url&film_id=eq.{film['id']}&order=review_year.asc.nullslast&limit=10")
    if not rows:
        return None
    body = []
    for r in rows:
        year = str(r.get("review_year") or "—")
        voice = r.get("outlet") or r.get("critic") or "—"
        # the voice cell links to the actual review (external, trustworthy)
        vcell = {"text": voice, "href": r["url"]} if (r.get("url") or "").startswith("http") else voice
        body.append([year, vcell, r.get("verdict") or "—"])
    return {"id": mid, "type": "reception", "title": "The reception arc",
            "note": "How the critical record moved, year by year - each outlet links to its review.",
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
    """The anchor film's other live pages — the reader's on-ramps into the
    archive. Built abundantly (owner's rule 2026-07-09: pack the foot with
    links, drive the on-site click). Only links we know resolve."""
    slug, fid = film["slug"], film["id"]
    types = {m["type"] for m in modules}
    title = film["title"]
    tlabel = f"{title} ({film['year']})" if film.get("year") else title
    # bottom box: name the film, not a generic "film page" (owner's rule 2026-07-10)
    links = [{"label": tlabel, "href": f"/film/{slug}", "note": "the full record"}]

    if "takescore" in types:
        links.append({"label": f"TakeScore™ — {title}", "href": f"/takescore/film/{slug}", "note": "Value, Cost, Risk read as verdicts"})
    if "canon" in types:
        links.append({"label": f"{title} in the canon", "href": f"/film/lineage/{slug}", "note": "the record in the lists and prizes"})
    if "locations" in types:
        links.append({"label": f"Where {title} was shot", "href": f"/film/atlas/{slug}", "note": "every mapped place"})
    if "misreadings" in types:
        links.append({"label": f"Strong misreadings of {title}", "href": f"/film/{slug}/misreadings", "note": "the readings, assembled"})

    # movies-like (kinship connections)
    kin = sb_get(env, f"film_affinities?select=film_id&film_id=eq.{fid}&limit=1")
    if kin:
        links.append({"label": f"Movies like {film['title']}", "href": f"/movies-like/{slug}", "note": "kin by figure and idea"})

    # curious questions viewers actually ask (each its own page). spoiler_level
    # is a text enum (none/mild/major) — skip only the heavy-spoiler ones.
    qs = sb_get(env, f"questions?select=slug,display_title,title,spoiler_level&film_id=eq.{fid}&order=created_at.asc&limit=5")
    for q in qs or []:
        if q.get("spoiler_level") == "major":
            continue
        t = (q.get("display_title") or q.get("title") or "").strip()
        if t:
            links.append({"label": t, "href": f"/film/{slug}/q/{q['slug']}", "note": "on Curious"})

    # tropes the film deposits (figure-type readings)
    tr = sb_get(env, "figure_type_members?select=meta_take:meta_takes!inner(slug,title,status,kind),figure:figures!inner(film_id)"
                     f"&figure.film_id=eq.{fid}&meta_take.status=eq.published&meta_take.kind=eq.figure_type&limit=6")
    seen_t = set()
    for r in tr or []:
        mt = r.get("meta_take") or {}
        if mt.get("slug") and mt["slug"] not in seen_t:
            seen_t.add(mt["slug"])
            links.append({"label": mt["title"], "href": f"/trope/{mt['slug']}", "note": "a recurring figure"})

    # essays / desk readings
    es = sb_get(env, f"essays?select=mode&film_id=eq.{fid}&status=eq.verified&lang=eq.en&limit=1")
    if es:
        links.append({"label": f"Essays on {film['title']}", "href": f"/film/{slug}", "note": "long-form, on the film page"})

    if film.get("director_slug"):
        links.append({"label": f"{film.get('director') or 'The director'} — the filmography",
                      "href": f"/director/{film['director_slug']}", "note": "every film we hold"})
    return links[:16]


def build_pack(env: dict, anchor: dict) -> dict:
    """anchor = {type: film|person|theorist, slug, label}. Returns
    {anchor, film_slug, image, modules, archive_links, depth} — modules carry ids."""
    modules: list[dict] = []
    film_slug: str | None = None
    image: dict | None = None
    archive_links: list[dict] = []
    director_slug: str | None = None
    maps: list[dict] = []  # visual connection/geo blocks (owner's rule 2026-07-09)

    if anchor["type"] == "film" and anchor.get("slug"):
        film = _film_row(env, anchor["slug"])
        if film:
            film_slug = film["slug"]
            director_slug = film.get("director_slug")
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
            # visuals: the connections galaxy (every film) + the geo map (if located)
            maps.append({"kind": "connections", "film_slug": film["slug"], "title": film["title"]})
            if any(m["type"] == "locations" for m in modules):
                maps.append({"kind": "geo", "film_slug": film["slug"], "title": film["title"]})

    elif anchor["type"] == "person":
        name = anchor["label"]
        director_slug = anchor.get("slug")
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

    # for person/theorist anchors, seed archive_links from the filmography module
    if not archive_links:
        if director_slug and anchor["type"] == "person":
            archive_links.append({"label": f"{anchor.get('label')} — the filmography",
                                  "href": f"/director/{director_slug}", "note": "every film we hold"})
        for m in modules:
            for it in (m.get("items") or [])[:10]:
                if (it.get("href") or "").startswith("/"):
                    archive_links.append({"label": it["label"], "href": it["href"], "note": it.get("note")})
        archive_links = archive_links[:16]

    usable = [m for m in modules if (m.get("rows") or m.get("items"))]

    # Internal-link inventory — every VERIFIED metatake.net link the writer may
    # weave into the letter's prose (v3: inner links in prose are the archive's
    # presence in the piece; the writer may only use hrefs from this list).
    inv: dict[str, str] = {}
    for l in archive_links:
        inv.setdefault(l["href"], l["label"] + (f" ({l['note']})" if l.get("note") else ""))
    for m in usable:
        for it in m.get("items") or []:
            h = it.get("href") or ""
            if h.startswith("/"):
                inv.setdefault(h, it["label"])
        for row in m.get("rows") or []:
            for cell in row:
                if isinstance(cell, dict) and (cell.get("href") or "").startswith("/"):
                    inv.setdefault(cell["href"], cell.get("text", ""))
    internal_links = [{"href": h, "label": t} for h, t in list(inv.items())[:24]]

    return {"anchor": anchor, "film_slug": film_slug, "director_slug": director_slug,
            "image": image, "archive_links": archive_links, "modules": usable,
            "maps": maps, "internal_links": internal_links, "depth": len(usable)}
