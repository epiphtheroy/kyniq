#!/usr/bin/env python3
"""Offline parser for "Between Film and the World" drafts.

Parses substack/drafts/YYYY-MM-DD.md into the posts-table shape and prints JSON to stdout.
NO network, NO env, NO DB — pure parse. (Film year/backdrop + link verification + upsert
are done by the caller via the Supabase MCP.) Mirrors blog-ingest.py's parsing exactly.

Usage: python3 worker/blog-parse.py --date 2026-06-24
       python3 worker/blog-parse.py --file <path.md>
"""
import os, sys, re, json, glob

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
DRAFTS = os.path.join(ROOT, "substack", "drafts")
args = sys.argv[1:]
def argval(flag):
    return args[args.index(flag) + 1] if flag in args and args.index(flag) + 1 < len(args) else None

def md_inline(s):
    def link(m):
        text, url = m.group(1).strip(), m.group(2).strip()
        if "metatake.net" in url:
            path = re.sub(r"^https?://(www\.)?metatake\.net", "", url) or "/"
            return f"<a class='lk-in' href='{path}'>{text}</a>"
        return f"<a class='lk-out' href='{url}' target='_blank' rel='noopener'>{text}</a>"
    s = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", link, s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", s)
    return s.strip()

def internal_links(html):
    return re.findall(r"href='(/(?:film|take|trope)/[^']+)'", html)

if argval("--file"):
    path = argval("--file")
elif argval("--date"):
    path = os.path.join(DRAFTS, argval("--date") + ".md")
else:
    files = sorted(glob.glob(os.path.join(DRAFTS, "*.md")))
    path = files[-1] if files else None
if not path or not os.path.exists(path):
    print(json.dumps({"error": f"no draft ({path})"})); sys.exit(1)
raw = open(path, encoding="utf-8").read()

fm, body = "", raw
m = re.match(r"^---\n(.*?)\n---\n(.*)$", raw, re.S)
if m: fm, body = m.group(1), m.group(2)
slug = (re.search(r'issue_date:\s*"?(\d{4}-\d{2}-\d{2})"?', fm) or [None, os.path.basename(path)[:10]])[1]
fm_status = (re.search(r'status:\s*"?([A-Za-z_]+)"?', fm) or [None, "pending_review"])[1]
rhyme_by_url = {u: int(r) for u, r in re.findall(r'film_url:\s*"([^"]+)".*?rhyme:\s*(\d+)', fm, re.S)}

chunks = [c.strip() for c in re.split(r"\n-{3,}\n", body) if c.strip()]
intro_html, dek, entries, floor = None, None, [], []
for ch in chunks:
    lines = ch.split("\n"); head = lines[0].strip()
    paras = [p.strip() for p in re.split(r"\n\s*\n", ch) if p.strip()]
    mi = re.match(r"^#{2,3}\s+(\d+)\s*[·.]\s*(.+)$", head)
    if mi:
        rank = int(mi.group(1)); ehead = mi.group(2).strip()
        midx, meta = None, ""
        for idx, l in enumerate(lines):
            if l.strip().startswith("**") and "→" in l: midx, meta = idx, l.strip(); break
        mm = re.match(r"\*\*(.+?)\s*→\s*\[(.+?)\]\((.+?)\)\*\*", meta)
        if not mm:
            sys.stderr.write(f"item {rank}: bad meta line — skipped\n"); continue
        event = mm.group(1).strip(); film_title = mm.group(2).strip(); film_url = mm.group(3).strip()
        stars = rhyme_by_url.get(film_url) or meta.count("★")
        film_slug = re.sub(r"^https?://(www\.)?metatake\.net/film/", "", film_url).strip("/")
        after = "\n".join(lines[midx + 1:]) if midx is not None else ""
        bps = [p.strip() for p in re.split(r"\n\s*\n", after) if p.strip()]
        dep = next((p for p in reversed(bps) if "In Metatake" in p or p.lstrip().startswith("→")), "")
        mids = [p for p in bps if p != dep]
        news = md_inline(mids[0]) if mids else ""
        read = md_inline(" ".join(mids[1:])) if len(mids) > 1 else ""
        deposit = md_inline(re.sub(r"^\s*→\s*", "", dep))
        entries.append({"rank": rank, "ehead": ehead, "event": event, "film_title": film_title,
                        "film_slug": film_slug, "film_year": None, "stars": int(stars), "bd": None,
                        "news": news, "read": read, "deposit": deposit})
        continue
    if re.match(r"^#{2,3}\s+On the cutting", head, re.I):
        for ln in lines[1:]:
            ln = ln.strip()
            if not ln.startswith("- "): continue
            item = re.sub(r"\s*(Cut|Held)\.?\s*$", "", ln[2:].strip())
            floor.append({"html": md_inline(item)})
        continue
    if intro_html is None:
        md = re.search(r"^#{2,3}\s+Metatake.+?—\s*(.+)$", ch, re.M)
        if md:
            d = md.group(1).strip().rstrip("."); dek = d[0].upper() + d[1:] + "."
        it = next((p for p in paras if p.startswith("*") and not p.startswith("**") and p.rstrip().endswith("*")), None)
        if it: intro_html = md_inline(it.strip().strip("*").strip())

entries.sort(key=lambda e: e["rank"])
out = {
    "slug": slug, "status_draft": fm_status, "dek": dek or "The day's news, read as cinema.",
    "intro": intro_html, "read_min": len(entries) + 1, "entries": entries, "floor": floor,
    "film_slugs": sorted({e["film_slug"] for e in entries}),
    "internal_links": sorted(set(
        ["/film/" + e["film_slug"] for e in entries]
        + [l for e in entries for l in internal_links(e["news"]) + internal_links(e["read"]) + internal_links(e["deposit"])]
        + [l for fl in floor for l in internal_links(fl["html"])]
    )),
}
print(json.dumps(out, ensure_ascii=False))
