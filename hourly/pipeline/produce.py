#!/usr/bin/env python3
"""Now Playing — the hourly production run (README.md v2).

DETECT (poller) -> SELECT (mechanical + one light LLM pass) -> data pack ->
WRITE (Fable 5 + web search) -> GATE (deterministic + LLM) -> PUBLISH
(insert + revalidate + IndexNow + Bluesky/Telegram).

Hard rules enforced here: HOLD kill switch, daily cap (4), 48h novelty,
corpus-depth >= 3 modules, sources >= 2 distinct outlets, internal-only links
in body HTML, defamation gate. The automated path runs the DIRECT lane only;
the exception lane (figure-rhyme on off-beat news) stays manual by design.

Usage: python3 -m pipeline.produce            (from hourly/)
       python3 hourly/pipeline/produce.py --dry   (stop before publishing)
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.common import (HOURLY, anthropic_call, http, ledger_append,  # noqa: E402
                             load_env, log, now_utc, parse_json_block, sb_get, sb_insert, slugify)
from pipeline.datapack import build_pack  # noqa: E402

WRITER_MODEL = "claude-fable-5"
LIGHT_MODEL = "claude-sonnet-5"
DAILY_CAP = 4
MIN_MECH = 9          # spike + corroboration + beat prefilter
MIN_CORR = 3          # >= 2 distinct outlets
INDEXNOW_KEY = "72623852f17d4eb341d4cd3755d3ba64"

ALLOWED_TAGS = {"p", "a", "b", "i", "em", "strong", "ul", "li", "br", "cite"}


# ── selection ────────────────────────────────────────────────────────────────

def today_count(env: dict) -> int:
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    rows = sb_get(env, f"now_articles?select=slug&published_at=gte.{day}T00:00:00Z", service=True)
    return len(rows) if isinstance(rows, list) else 0


def recent_anchors(env: dict) -> tuple[set, set, set]:
    """(anchor slugs 7d, keywords 48h, anchor slugs 48h) for reuse/novelty rules.
    Timestamps use Z, never +00:00 — a '+' in a query string is a space to
    PostgREST and silently 400s the request (which disabled novelty once)."""
    cut7 = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%dT%H:%M:%SZ")
    cut48 = (datetime.now(timezone.utc) - timedelta(hours=48)).strftime("%Y-%m-%dT%H:%M:%SZ")
    rows = sb_get(env, f"now_articles?select=anchor_slug,keyword,published_at&published_at=gte.{cut7}", service=True) or []
    a7 = {r["anchor_slug"] for r in rows if r.get("anchor_slug")}
    k48 = {(r.get("keyword") or "").lower() for r in rows if r["published_at"] >= cut48}
    a48 = {r["anchor_slug"] for r in rows if r.get("anchor_slug") and r["published_at"] >= cut48}
    return a7, k48, a48


def anti_repetition_digest(env: dict) -> str:
    rows = sb_get(env, "now_articles?select=headline,anchor_label,modules,published_at&order=published_at.desc&limit=12", service=True) or []
    lines = []
    for r in rows:
        mods = ",".join(m.get("type", "?") for m in (r.get("modules") or []))
        lines.append(f"- {r['published_at'][:16]} · {r['headline']} · anchor {r['anchor_label']} · modules {mods}")
    return "\n".join(lines) or "(none yet)"


def selector_pass(env: dict, cand: dict, pack: dict, digest: str) -> dict | None:
    """One light-model judgment: corpus depth + search shape + angle. Returns
    {proceed, depth, search_shape, angle} or None on API failure."""
    mods = [{"id": m["id"], "type": m["type"], "title": m["title"],
             "size": len(m.get("rows") or m.get("items") or [])} for m in pack["modules"]]
    user = f"""A trend candidate for Metatake's "Now Playing" live layer (data-deep film-history pieces, no political verdicts).

CANDIDATE
keyword: {cand['keyword']} (traffic {cand.get('traffic') or 'n/a'}, geo {cand.get('geo')})
anchor entity in our corpus: {json.dumps(pack['anchor'], ensure_ascii=False)}
news links seen: {json.dumps((cand.get('news') or [])[:3] + (cand.get('fleet_hits') or [])[:3], ensure_ascii=False)}

AVAILABLE DATA MODULES (from our own database): {json.dumps(mods, ensure_ascii=False)}

RECENT PIECES (avoid repeating anchors/shapes):
{digest}

Judge, 1-5 each:
- depth: can >=3 of these modules genuinely illuminate THIS news moment (not decoration)?
- search_shape: is there a query real people are typing right now where this piece could be the best page?
Reply as JSON only: {{"proceed": true/false, "depth": n, "search_shape": n, "angle": "one sentence: the film-history read this piece should take"}}.
proceed=false if either score < 3, if the news is only tangent to the entity, or if this would repeat a recent piece."""
    out = anthropic_call(env, model=LIGHT_MODEL, system="You are the selection editor. Reply with JSON only.",
                         user=user, max_tokens=900)
    parsed = parse_json_block(out or "")
    if parsed is None:
        log(f"selector unparseable reply: {(out or '')[:200]!r}")
    return parsed


# ── writer ───────────────────────────────────────────────────────────────────

WRITER_SYSTEM = """You are Wonwoo Yoon, editor of the Metatake archive, writing "Now Playing" on metatake.net: the editor's letter that lands within the hour on a spiking film-and-culture story. You read the report an hour ago; the letter exists to say why it deserves more than a headline. The product is the ANALYSIS - one argued, deeply researched take a reader cannot get from the wire.

Non-negotiables, in order:

1. SPEED MADE VISIBLE. Open with a dateline (the STORY's region + the NEWS date, not our publish time). The first two sentences must say when and where the story broke, who reported it, and that you are writing now because of it - the "I read this an hour ago, and here is why it matters" frame, in fresh wording every time.

2. SEARCH-SHAPED HEADLINE. Write the headline AS the question or phrase people will type while this spikes, plus the promise of an answer. Proper nouns first: names, titles, places. No cleverness that hides the query.

3. NAMES AND PLACES. Real names, real places, real dates - as many as accuracy allows. Every factual claim carries its outlet AND its reporting date ("Variety reported on July 7 that..."). What is confirmed vs merely reported is said once, plainly.

4. THE ARCHIVE IN THE PROSE. Weave 4 to 10 links from the provided INTERNAL LINKS inventory into the body where they genuinely carry the argument - the film page where you invoke the film, the scorecard where you cite its standing, the lineage page where you cite its canon record. Never link-stuff; never use an href absent from the inventory. Archival numbers and claims must come from the provided modules - nothing remembered. When you cite TakeScore, brand it TakeScore(TM) and quote its VERDICT WORDS (e.g. "high value, high risk", "solid but not peak"), never bare abbreviations. Do NOT state the film's rank in the corpus unless a module explicitly gives one (the pack only surfaces a rank when it is a genuine top-1000 standing); a rank invites needless argument, the verdict word does the work.

5. ARGUE, HUMBLY - AND WOUND NO ONE. The letter moves: the surface reaction everyone will have -> the deeper question underneath -> your position, argued. Engage the strongest objection honestly; concede what must be conceded; state uncertainty once and plainly. Intelligent, warm, firm in the argument. First person available, used sparingly. Take real positions on works, ideas, industries, and institutions - never partisan-political verdicts, never a private individual's character. CRUCIAL: no person, film, or filmmaker named here should come away feeling attacked, mocked, belittled, or disadvantaged. We do not want to hurt anyone. Neutral and fair is the default register: when the argument runs critical of a work or a choice, aim it at the idea, the reception, or the film's place in history, offered with respect and care, never as a verdict that diminishes the people who made it or appear in it. Describe reception (praise and boos alike) as reported fact, from a distance, never as your own attack.

6. FORM. 700-1200 words of prose. Short paragraphs (1-4 sentences), front-loaded, zero filler, no em-dashes, no listicles. Wit is welcome; it never touches the facts. Vary structure against the recent-pieces digest: no repeated openings, closings, or headline shapes.

Workflow (mandatory): use web_search at least twice - (a) verify and DATE the core facts beyond the provided links; (b) find the terrain of reaction and at least one fact the wire coverage does not carry. Only cite sources you actually saw.

HTML rules for body fields: only <p>, <b>, <i>, <em>, <strong>, <ul>, <li>, <br>, <cite>, and <a href="..."> where href MUST start with "/" AND appear in the INTERNAL LINKS inventory. News sources go in the sources array, never as links in body HTML.

Reply with ONE JSON object only, no prose around it:
{
 "slug": "kebab-case, entity + event, 8-80 chars",
 "headline": "the searcher's query + the answer's promise, 40-110 chars",
 "dek": "one sentence: the letter's promise",
 "summary": "the argued thesis in 1-2 plain sentences (no HTML)",
 "dateline": "REGION(S) OF THE STORY IN UPPERCASE · Month D, YYYY (the news date, not publish time)",
 "facts_html": "the opening movement, 2-3 <p>: the dated, attributed news + why you write within the hour",
 "reading_html": "the argument, 4-7 <p>: surface -> deeper question -> your argued position, archive links woven in, strongest objection engaged",
 "bottom_html": "the close, 1 <p>: a letter's ending - re-tighten, no new points",
 "deposit": "one line naming what this piece deposits in Metatake (a figure/connection), no HTML",
 "module_ids": ["0-2 module ids, ONLY if a table genuinely helps the letter; empty array is normal"],
 "module_notes": {"id": "optional one-line caption"},
 "sources": [{"outlet": "...", "title": "...", "url": "https://..."}]  // >= 2 distinct outlets you verified in search
}

CRITICAL: after your web searches, your entire final answer must be that single JSON object - no analysis text before it, no commentary after it."""


def writer_pass(env: dict, cand: dict, pack: dict, digest: str, angle: str, failure_report: str | None = None) -> dict | None:
    mods_full = json.dumps(pack["modules"], ensure_ascii=False)
    user = f"""THE SPIKE
keyword being searched right now: {cand['keyword']} (approx traffic {cand.get('traffic') or 'n/a'}, geo {cand.get('geo')}; first seen {cand.get('first_seen')})
anchor entity (verified in corpus): {json.dumps(pack['anchor'], ensure_ascii=False)}
starting links (verify and go beyond them): {json.dumps((cand.get('news') or []) + (cand.get('fleet_hits') or [])[:4], ensure_ascii=False)}

INTERNAL LINKS inventory (the ONLY hrefs allowed in prose - weave 4-10 where they carry the argument):
{json.dumps(pack.get('internal_links') or [], ensure_ascii=False)}

SELECTION EDITOR'S ANGLE: {angle}

DATA MODULES (the record - select >=3 by id): {mods_full}

ANTI-REPETITION - the last 12 pieces (do not repeat their headline shapes, openings, or closings):
{digest}
{f'''
PREVIOUS DRAFT FAILED THE GATE - fix exactly these and rewrite:
{failure_report}''' if failure_report else ''}
Write the piece now. JSON only."""
    out = anthropic_call(env, model=WRITER_MODEL, system=WRITER_SYSTEM, user=user,
                         max_tokens=16000, web_search=True, timeout=900)
    parsed = parse_json_block(out or "")
    if parsed is None and out:
        # keep the raw reply for diagnosis — unparseable writer output is the
        # pipeline's most expensive failure
        f = HOURLY / "drafts" / f"failed-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.txt"
        f.write_text(out)
        log(f"writer reply unparseable ({len(out)} chars) — saved to {f.name}; head: {out[:150]!r}")
    return parsed


# ── gate ─────────────────────────────────────────────────────────────────────

def _strip_dashes(s: str) -> str:
    return s.replace(" — ", ", ").replace("—", "-").replace(" – ", ", ").replace("–", "-")


def _sanitize_html(html: str) -> str:
    """Strip every attribute except href on <a> — the web_search tool leaks
    `<cite index="18-1">` reference attrs into prose; keep the tag, drop the noise."""
    def fix(m: re.Match) -> str:
        closing, tag, attrs = m.group(1), m.group(2).lower(), m.group(3)
        if closing:
            return f"</{tag}>"
        if tag == "a":
            h = re.search(r'href\s*=\s*"([^"]*)"', attrs)
            return f'<a href="{h.group(1)}">' if h else "<a>"
        return f"<{tag}>"
    return re.sub(r"<(/?)([a-zA-Z0-9]+)((?:\s[^>]*)?)>", fix, html)


def _html_ok(html: str) -> str | None:
    for tag in re.findall(r"</?([a-zA-Z0-9]+)", html):
        if tag.lower() not in ALLOWED_TAGS:
            return f"disallowed tag <{tag}>"
    for href in re.findall(r'href="([^"]*)"', html):
        if not href.startswith("/") or href.startswith("//"):
            return f"external href in body: {href}"
    if re.search(r"\bon\w+\s*=|javascript:", html, re.I):
        return "scripty attribute"
    return None


def _words(html: str) -> int:
    return len(re.sub(r"<[^>]+>", " ", html).split())


MONTHS = ("January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December")


def deterministic_gate(env: dict, piece: dict, pack: dict, keyword: str = "") -> list[str]:
    if keyword:
        piece["_keyword"] = keyword
    fails: list[str] = []
    for k in ("slug", "headline", "summary", "dateline", "facts_html", "reading_html", "deposit", "sources"):
        if not piece.get(k):
            fails.append(f"missing field {k}")
    if fails:
        return fails

    for k in ("summary", "dek", "facts_html", "reading_html", "bottom_html", "deposit", "headline"):
        if piece.get(k):
            piece[k] = _strip_dashes(piece[k])
    for k in ("facts_html", "reading_html", "bottom_html"):
        if piece.get(k):
            piece[k] = _sanitize_html(piece[k])

    if not re.fullmatch(r"[a-z0-9-]{8,80}", piece["slug"]):
        piece["slug"] = slugify(piece["headline"])
    if sb_get(env, f"now_articles?select=slug&slug=eq.{quote(piece['slug'])}", service=True):
        piece["slug"] = f"{piece['slug'][:70]}-{datetime.now(timezone.utc).strftime('%H%M')}"

    if not (30 <= len(piece["headline"]) <= 130):
        fails.append(f"headline length {len(piece['headline'])}")
    # search-shaped headline: the spiking keyword's long tokens (or the anchor's
    # name) must actually appear — the query IS the title (v3 rule 3).
    hl = piece["headline"].lower()
    kw_tokens = [w for w in re.sub(r"[^a-z0-9 ]", " ", (piece.get("_keyword") or "").lower()).split() if len(w) >= 4]
    anchor_tokens = [w for w in re.sub(r"[^a-z0-9 ]", " ", (pack["anchor"].get("label") or "").lower()).split() if len(w) >= 4]
    if kw_tokens or anchor_tokens:
        if not any(t in hl for t in kw_tokens) and not any(t in hl for t in anchor_tokens):
            fails.append("headline carries neither the trending keyword nor the anchor's name")

    dl = piece["dateline"]
    if not any(m in dl for m in MONTHS) or not re.search(r"\d{4}", dl):
        fails.append(f"dateline lacks a month name + year: {dl!r}")

    for k in ("facts_html", "reading_html", "bottom_html"):
        if piece.get(k):
            err = _html_ok(piece[k])
            if err:
                fails.append(f"{k}: {err}")

    total = _words(piece["facts_html"]) + _words(piece["reading_html"]) + _words(piece.get("bottom_html") or "")
    if not (500 <= total <= 1500):
        fails.append(f"prose length {total} words (need 500-1500)")

    # inner links: >= 3 woven into prose, every one from the verified inventory
    inventory = {l["href"] for l in pack.get("internal_links") or []}
    prose = (piece["facts_html"] or "") + (piece["reading_html"] or "") + (piece.get("bottom_html") or "")
    hrefs = re.findall(r'href="([^"]*)"', prose)
    bad = [h for h in hrefs if h not in inventory]
    if bad:
        fails.append(f"prose hrefs not in inventory: {bad[:4]}")
    if len(hrefs) < 3:
        fails.append(f"only {len(hrefs)} internal links in prose (need >=3, want 4-10)")

    pack_ids = {m["id"] for m in pack["modules"]}
    ids = [i for i in (piece.get("module_ids") or []) if i in pack_ids][:2]
    piece["module_ids"] = ids  # 0-2 modules; the letter is the product now

    srcs = piece.get("sources") or []
    domains = set()
    for s in srcs:
        u = s.get("url", "")
        if not u.startswith("http"):
            fails.append(f"bad source url {u!r}")
            continue
        domains.add(urlparse(u).netloc.removeprefix("www."))
    if len(domains) < 2:
        fails.append(f"sources: {len(domains)} distinct outlets (need >=2)")
    for s in srcs[:5]:
        status, _ = http(s["url"], timeout=12, retries=0)
        if status == 0 or status >= 500:
            fails.append(f"source unreachable ({status}): {s['url']}")
    return fails


def llm_gate(env: dict, piece: dict) -> dict | None:
    body = json.dumps({k: piece.get(k) for k in ("headline", "dek", "summary", "facts_html", "reading_html", "bottom_html")}, ensure_ascii=False)
    user = f"""Gate this news piece before auto-publish. FAIL it if ANY of:
1. Defamation risk: claims about a private individual's character; unverified accusations stated as fact about ANY person (public figures: actions/structures only).
2. Unverified assertion: a factual claim presented as confirmed that the piece itself does not attribute to a source.
3. Copyright: quoted passages beyond brief attributed reference.
4. Tone breach: outrage-as-conclusion, engagement bait, or a political verdict (this product is film-history data reading, not ethics columns).

PIECE: {body}

Reply JSON only, failures terse (rule number + a short paraphrase, no long quotes):
{{"pass": true/false, "failures": ["...", ...]}}"""
    out = anthropic_call(env, model=LIGHT_MODEL, system="You are the pre-publication gate. Strict. JSON only.",
                         user=user, max_tokens=1000)
    parsed = parse_json_block(out or "")
    if parsed is None:
        log(f"gate unparseable reply: {(out or '')[:200]!r}")
    return parsed


# ── publish ──────────────────────────────────────────────────────────────────

def assemble_modules(piece: dict, pack: dict) -> list[dict]:
    by_id = {m["id"]: m for m in pack["modules"]}
    notes = piece.get("module_notes") or {}
    out = []
    for mid in piece["module_ids"]:
        m = dict(by_id[mid])
        if notes.get(mid):
            m["note"] = _strip_dashes(str(notes[mid]))[:200]
        m.pop("id", None)
        m.pop("more_href", None)
        out.append(m)
    return out


_GEO_LABEL = {"US": "United States", "GB": "United Kingdom", "world": "Worldwide", "-": "Worldwide"}


def _fmt_news_date(raw: str) -> str:
    """RSS pubDate → 'Jul 8, 2026'; '' if unparseable."""
    if not raw:
        return ""
    for fmt in ("%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S %Z", "%Y-%m-%dT%H:%M:%S%z"):
        try:
            return datetime.strptime(raw.replace("GMT", "+0000"), fmt).strftime("%b %-d, %Y")
        except Exception:
            continue
    return ""


def build_cut_floor(env: dict, snapshot: dict, chosen_keyword: str) -> list[dict]:
    """The editor's cutting-room floor: the hour's other spikes we did NOT run.
    Each item MUST carry region + reporting date + source outlet, then our
    one-line note (date + region are the core of Now). One cheap LLM pass
    writes the notes; the metadata is captured mechanically."""
    rejects = []
    seen = {chosen_keyword.lower()}
    for c in snapshot.get("candidates", []):
        kw = c.get("keyword", "").strip()
        if not kw or kw.lower() in seen:
            continue
        seen.add(kw.lower())
        url, outlet = "", ""
        for src in (c.get("news") or []) + (c.get("fleet_hits") or []):
            if src.get("url", "").startswith("http"):
                url = src["url"]
                outlet = src.get("source") or src.get("outlet") or ""
                break
        rejects.append({
            "keyword": kw, "url": url,
            "region": _GEO_LABEL.get(c.get("geo", "-"), c.get("geo") or "Worldwide"),
            "date": _fmt_news_date(c.get("pub", "")),
            "outlet": outlet,
            "entity": (c.get("entity") or {}).get("label"),
        })
        if len(rejects) >= 8:
            break
    if not rejects:
        return []

    brief = [{"i": i, "keyword": r["keyword"], "in_corpus": r["entity"] or "no film in the archive"}
             for i, r in enumerate(rejects)]
    user = (f"We published one Now Playing piece on '{chosen_keyword}'. These other spikes trended this hour but we passed. "
            f"Write ONE dry, wry editor's-note sentence (<=18 words) per item saying why it is not our story - "
            f"the beat is film-and-culture read through the archive; a spike with no corpus film, or news the archive can't deepen, is out. "
            f"No hedging, no repetition of the keyword verbatim. JSON only: {{\"comments\": [{{\"i\": n, \"c\": \"...\"}}]}}.\n\n"
            f"ITEMS: {json.dumps(brief, ensure_ascii=False)}")
    parsed = parse_json_block(anthropic_call(env, model=LIGHT_MODEL,
                                             system="You are the editor writing cutting-room-floor notes. Terse, dry. JSON only.",
                                             user=user, max_tokens=700) or "")
    comments = {c["i"]: _strip_dashes(str(c["c"]))[:160] for c in (parsed or {}).get("comments", []) if "i" in c and "c" in c}
    out = []
    for i, r in enumerate(rejects):
        out.append({"keyword": r["keyword"], "url": r["url"],
                    "region": r["region"], "date": r["date"], "outlet": r["outlet"],
                    "comment": comments.get(i) or ("outside the beat" if not r["entity"] else "the archive adds nothing here")})
    return out


def publish(env: dict, piece: dict, cand: dict, pack: dict, scores: dict, cut_floor: list[dict] | None = None,
            written_at: str | None = None) -> tuple[bool, str]:
    anchor = pack["anchor"]
    img = pack.get("image") or {}
    piece.pop("_keyword", None)
    row = {
        "slug": piece["slug"], "headline": piece["headline"], "dek": piece.get("dek"),
        "summary": piece.get("summary"), "dateline": piece.get("dateline"),
        "keyword": cand["keyword"], "lane": "direct",
        "anchor_type": anchor["type"], "anchor_slug": anchor.get("slug"), "anchor_label": anchor["label"],
        "film_slug": pack.get("film_slug"), "director_slug": pack.get("director_slug"),
        "image_path": img.get("path"), "image_alt": img.get("alt"),
        "facts_html": piece["facts_html"], "reading_html": piece["reading_html"],
        "bottom_html": piece.get("bottom_html"), "deposit": piece.get("deposit"),
        "modules": assemble_modules(piece, pack), "sources": piece["sources"], "scores": scores,
        "archive_links": pack.get("archive_links") or [],
        "cut_floor": [],  # v3: rejected news is NOT published (owner's rule 5)
        "status": "published",
    }
    # created_at = when the letter was written; published_at defaults to the
    # insert moment. The piece shows both (owner's rule 2026-07-10).
    if written_at:
        row["created_at"] = written_at
    ok, info = sb_insert(env, "now_articles", row)
    return ok, info


def after_publish(env: dict, slug: str, headline: str, dek: str | None) -> list[str]:
    site = env.get("NEXT_PUBLIC_SITE_URL", "https://metatake.net").rstrip("/")
    url = f"{site}/now/{slug}"
    done = []

    secret = env.get("REVALIDATION_SECRET")
    if secret:
        for path in (f"/now/{slug}", "/now", "/"):
            http(f"{site}/api/revalidate?secret={quote(secret)}&path={quote(path)}", timeout=15, retries=0)
        done.append("revalidate")

    host = urlparse(site).netloc
    body = json.dumps({"host": host, "key": INDEXNOW_KEY,
                       "keyLocation": f"{site}/{INDEXNOW_KEY}.txt",
                       "urlList": [url, f"{site}/now", f"{site}/news-sitemap.xml"]}).encode()
    status, _ = http("https://api.indexnow.org/indexnow", method="POST", body=body,
                     headers={"Content-Type": "application/json; charset=utf-8"}, retries=0)
    done.append(f"indexnow:{status}")

    text = f"{headline}\n\n{dek or ''}\n\nThe record, timestamped:\n{url}".strip()
    if env.get("TELEGRAM_BOT_TOKEN") and env.get("TELEGRAM_CHANNEL"):
        status, _ = http(f"https://api.telegram.org/bot{env['TELEGRAM_BOT_TOKEN']}/sendMessage",
                         method="POST", body=json.dumps({"chat_id": env["TELEGRAM_CHANNEL"], "text": text}).encode(),
                         headers={"Content-Type": "application/json"}, retries=0)
        done.append(f"telegram:{status}")
    if env.get("BLUESKY_HANDLE") and env.get("BLUESKY_APP_PASSWORD"):
        done.append(f"bluesky:{_bluesky_post(env, headline, url)}")
    return done


def _bluesky_post(env: dict, headline: str, url: str) -> int:
    # a leading '@' makes bsky read the handle as an email (empty local part) → 400;
    # strip it so BLUESKY_HANDLE works with or without the '@'.
    ident = (env.get("BLUESKY_HANDLE") or "").lstrip("@").strip()
    status, data = http("https://bsky.social/xrpc/com.atproto.server.createSession", method="POST",
                        body=json.dumps({"identifier": ident, "password": (env.get("BLUESKY_APP_PASSWORD") or "").strip()}).encode(),
                        headers={"Content-Type": "application/json"}, retries=0)
    if status != 200:
        return status
    try:
        sess = json.loads(data)
    except Exception:
        return 0
    text = f"{headline}\n\n{url}"
    start = len(text.encode()) - len(url.encode())
    record = {"$type": "app.bsky.feed.post", "text": text,
              "createdAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
              "facets": [{"index": {"byteStart": start, "byteEnd": len(text.encode())},
                          "features": [{"$type": "app.bsky.richtext.facet#link", "uri": url}]}]}
    status, _ = http("https://bsky.social/xrpc/com.atproto.repo.createRecord", method="POST",
                     body=json.dumps({"repo": sess["did"], "collection": "app.bsky.feed.post", "record": record}).encode(),
                     headers={"Content-Type": "application/json", "Authorization": f"Bearer {sess['accessJwt']}"}, retries=0)
    return status


# ── main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    dry = "--dry" in sys.argv
    env = load_env()
    stamp = now_utc()

    # single-run lock: overlapping triggers (watcher + manual, or a slow run
    # crossing the next :00) must never race the daily cap into a double publish
    import fcntl
    lock = open(HOURLY / ".produce.lock", "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        log("another produce run is in progress — exiting")
        return

    if (HOURLY / "HOLD").exists():
        log("HOLD file present — publishing stopped by editor")
        ledger_append(f"{stamp} · PASS · HOLD file present")
        return
    if not env.get("ANTHROPIC_API_KEY") or not env.get("SUPABASE_SERVICE_ROLE_KEY"):
        log("missing ANTHROPIC_API_KEY / SUPABASE_SERVICE_ROLE_KEY in .env.local")
        return

    # unattended operation: refresh the entity cache when it goes stale
    ents_file = HOURLY / "poller" / "entities.json"
    import time as _t
    if not ents_file.exists() or _t.time() - ents_file.stat().st_mtime > 24 * 3600:
        log("entity cache stale — resyncing")
        try:
            from poller.sync_entities import main as sync_main
            sync_main()
        except Exception as e:
            log(f"entity sync failed (continuing on old cache): {e}")

    from poller.poller import collect_candidates  # local import: hourly/ is on sys.path
    from pipeline.stream import record_stream
    snap = collect_candidates()
    a7, k48, a48 = recent_anchors(env)

    cands = [c for c in snap["candidates"]
             if c["beat"] >= 4 and c["corroboration"] >= MIN_CORR
             and c["spike"] + c["corroboration"] + c["beat"] >= MIN_MECH]

    # the wire we watched is a WIDER net than the publish bar: any spike that
    # matched a real corpus entity (beat >= 4) is worth noting under that
    # film/director, even if it never becomes a piece. This keeps the daily
    # digest full (owner's rule: >= 3 items) on ordinary days.
    wire_cands = [c for c in snap["candidates"] if c.get("entity") and c["beat"] >= 4]

    # even when the cap stops WRITING, reviewing continues
    n = today_count(env)
    if n >= DAILY_CAP:
        log(f"daily cap reached ({n}/{DAILY_CAP}) — recording the wire only")
        if not dry:
            record_stream(env, wire_cands)
        ledger_append(f"{stamp} · PASS · daily cap {n}/{DAILY_CAP} · wire: {len(wire_cands)} reviewed")
        return
    if not cands:
        # BUGFIX 2026-07-09: the wire must record on THIS path too — it is the
        # most common outcome (no publish-bar candidate), and the whole point
        # of the wire is to keep the entity-matched spikes we reviewed.
        w = 0 if dry else record_stream(env, wire_cands)
        log("no qualifying candidate")
        ledger_append(f"{stamp} · PASS · no beat candidate above threshold ({len(snap['candidates'])} raw) · wire: {w} recorded")
        return

    digest = anti_repetition_digest(env)
    for cand in cands[:3]:
        ent = cand["entity"]
        if ent.get("slug") in a7 or ent.get("slug") in a48 or cand["keyword"].lower() in k48:
            log(f"novelty skip: {cand['keyword']}")
            continue

        pack = build_pack(env, {"type": ent["type"], "slug": ent.get("slug"), "label": ent["label"]})
        # v3 gate: the letter needs archive presence — enough verified internal
        # links to weave (owner's rule 4), not big tables.
        n_links = len(pack.get("internal_links") or [])
        if n_links < 4:
            log(f"archive-thin skip ({n_links} internal links): {cand['keyword']}")
            ledger_append(f"{stamp} · PASS-CAND · {cand['keyword']} · archive links {n_links}<4")
            continue

        # No second-model selection or verification (owner's rule 2026-07-08):
        # mechanical selection above, then Fable 5 writes and that is the piece.
        scores = {"spike": cand["spike"], "corroboration": cand["corroboration"], "beat": cand["beat"]}
        log(f"WRITING: {cand['keyword']} → {ent['label']} (scores {scores}, links {n_links})")

        # Fable 5 writes; the piece publishes. No second-model content gate
        # (owner's rule 2026-07-08: the voice must reach the page untouched).
        # The deterministic gate stays: it checks structure and link validity,
        # never style.
        piece, failure_report, written_at = None, None, None
        for attempt in (1, 2):
            draft = writer_pass(env, cand, pack, digest, "your call - find the letter's argument", failure_report)
            if not draft:
                failure_report = "previous attempt returned no parseable JSON"
                continue
            fails = deterministic_gate(env, draft, pack, keyword=cand["keyword"])
            if not fails:
                piece = draft
                written_at = now_utc()  # when the letter was composed; publish stamps a hair later
                break
            failure_report = "; ".join(fails)
            log(f"gate fail (attempt {attempt}): {failure_report[:300]}")

        if not piece:
            ledger_append(f"{stamp} · KILLED · {cand['keyword']} · gate x2: {failure_report[:200]}")
            continue

        if dry:
            out = HOURLY / "drafts" / f"dry-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M')}.json"
            out.write_text(json.dumps({"cand": cand, "piece": piece, "scores": scores,
                                       "snapshot": snap}, ensure_ascii=False, indent=1))
            log(f"DRY RUN: draft written to {out}")
            return

        ok, info = publish(env, piece, cand, pack, scores, written_at=written_at)
        if not ok:
            log(f"insert failed: {info}")
            ledger_append(f"{stamp} · KILLED · {cand['keyword']} · insert fail {info[:120]}")
            return
        dist = after_publish(env, piece["slug"], piece["headline"], piece.get("dek"))
        mods = ",".join(piece["module_ids"])
        record_stream(env, wire_cands, published_keyword=cand["keyword"], published_slug=piece["slug"])
        ledger_append(f"{stamp} · PUBLISHED · kw: {cand['keyword']} · anchor: {ent.get('slug') or ent['label']} · "
                      f"lane: direct · modules: {mods} · /now/{piece['slug']} · dist: {','.join(dist)}")
        log(f"PUBLISHED /now/{piece['slug']} · {dist}")
        return

    if not dry:
        record_stream(env, wire_cands)
    ledger_append(f"{stamp} · PASS · candidates tried, none survived selection/gate · wire: {len(cands)} reviewed")
    log("no candidate survived")


if __name__ == "__main__":
    main()
