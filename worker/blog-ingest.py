#!/usr/bin/env python3
"""Reflect a "Between Film and the World" Substack draft into the metatake blog.

Parses substack/drafts/YYYY-MM-DD.md → the posts-table shape (intro, entries[], floor[]),
looks up each film's year + backdrop, VERIFIES every internal /film, /take, /trope link
resolves on the live DB, then (with --persist) upserts a published posts row.

SAFE: DRY by default (parses + verifies + prints, NO DB writes).
Usage:
  python3 blog-ingest.py                      # newest draft in substack/drafts, DRY
  python3 blog-ingest.py --date 2026-06-19
  python3 blog-ingest.py --file <path.md>
  python3 blog-ingest.py --persist            # write (aborts if any link 404s; --force overrides)
"""
import os, sys, re, json, glob, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8-sig"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("="); k = k.strip()
            if k.startswith("export "): k = k[7:].strip()
            os.environ.setdefault(k, v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT, ".env.local"))
URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not (URL and KEY): print("Missing env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)"); sys.exit(1)

args = sys.argv[1:]
PERSIST = "--persist" in args
FORCE = "--force" in args
def argval(flag):
    return args[args.index(flag) + 1] if flag in args and args.index(flag) + 1 < len(args) else None
DRAFTS = os.path.join(ROOT, "substack", "drafts")

def http(method, url, body=None):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type", "application/json")
    req.add_header("apikey", KEY); req.add_header("Authorization", f"Bearer {KEY}")
    try:
        with urllib.request.urlopen(req, timeout=40) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:300]
def sb(method, path, body=None):
    return http(method, f"{URL}/rest/v1/{path}", body)
def sb_get(path):
    st, tx = sb("GET", path)
    if st != 200: raise RuntimeError(f"{st}: {tx[:200]}")
    return json.loads(tx)

# ---------- markdown → html (links / bold / italic) ----------
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

# ---------- pick + read draft ----------
if argval("--file"):
    path = argval("--file")
elif argval("--date"):
    path = os.path.join(DRAFTS, argval("--date") + ".md")
else:
    files = sorted(glob.glob(os.path.join(DRAFTS, "*.md")))
    path = files[-1] if files else None
if not path or not os.path.exists(path):
    print(f"No draft found ({path})"); sys.exit(1)
print(f"[ingest] draft: {os.path.relpath(path, ROOT)}{'' if PERSIST else '   [DRY — no DB writes]'}")
raw = open(path, encoding="utf-8").read()

# ---------- front-matter ----------
fm, body = "", raw
m = re.match(r"^---\n(.*?)\n---\n(.*)$", raw, re.S)
if m: fm, body = m.group(1), m.group(2)
slug = (re.search(r'issue_date:\s*"?(\d{4}-\d{2}-\d{2})"?', fm) or [None, os.path.basename(path)[:10]])[1]
fm_status = (re.search(r'status:\s*"?([A-Za-z_]+)"?', fm) or [None, "pending_review"])[1]
rhyme_by_url = {u: int(r) for u, r in re.findall(r'film_url:\s*"([^"]+)".*?rhyme:\s*(\d+)', fm, re.S)}
if fm_status == "hold":
    print("  ! draft status is 'hold' — the editor pulled it. Not publishing."); sys.exit(0)

# ---------- split body into --- chunks ----------
chunks = [c.strip() for c in re.split(r"\n-{3,}\n", body) if c.strip()]
intro_html, dek, entries, floor = None, None, [], []

for ch in chunks:
    lines = ch.split("\n")
    head = lines[0].strip()
    paras = [p.strip() for p in re.split(r"\n\s*\n", ch) if p.strip()]
    # ----- item: "### N · ehead" -----
    mi = re.match(r"^#{2,3}\s+(\d+)\s*[·.]\s*(.+)$", head)
    if mi:
        rank = int(mi.group(1)); ehead = mi.group(2).strip()
        # the meta line usually sits right under the heading (no blank line) → scan lines
        midx, meta = None, ""
        for idx, l in enumerate(lines):
            if l.strip().startswith("**") and "→" in l: midx, meta = idx, l.strip(); break
        mm = re.match(r"\*\*(.+?)\s*→\s*\[(.+?)\]\((.+?)\)\*\*", meta)
        if not mm:
            print(f"  ! item {rank}: couldn't parse the **event → [film](url)** line — skipped"); continue
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
    # ----- cutting-room floor -----
    if re.match(r"^#{2,3}\s+On the cutting", head, re.I):
        for ln in lines[1:]:
            ln = ln.strip()
            if not ln.startswith("- "): continue
            item = re.sub(r"\s*(Cut|Held)\.?\s*$", "", ln[2:].strip())
            floor.append({"html": md_inline(item)})
        continue
    # ----- masthead: dek + intro (first non-item chunk) -----
    if intro_html is None:
        md = re.search(r"^#{2,3}\s+Metatake.+?—\s*(.+)$", ch, re.M)
        if md:
            d = md.group(1).strip().rstrip(".")
            dek = d[0].upper() + d[1:] + "."
        it = next((p for p in paras if p.startswith("*") and not p.startswith("**") and p.rstrip().endswith("*")), None)
        if it: intro_html = md_inline(it.strip().strip("*").strip())

if not entries:
    print("  ! no items parsed — aborting."); sys.exit(1)
entries.sort(key=lambda e: e["rank"])
dek = dek or "The day's news, read as cinema."
read_min = len(entries) + 1

# ---------- resolve films (year + backdrop) + verify ALL internal links ----------
film_slugs = sorted({e["film_slug"] for e in entries})
fmap = {}
if film_slugs:
    rows = sb_get("films?select=slug,year,backdrop_path,visible&slug=in.(" + ",".join(film_slugs) + ")")
    fmap = {r["slug"]: r for r in rows}
for e in entries:
    f = fmap.get(e["film_slug"])
    if f: e["film_year"] = f.get("year"); e["bd"] = f.get("backdrop_path")

# gather every internal link across the whole edition + the entry films
links = set("/film/" + e["film_slug"] for e in entries)
for e in entries:
    links |= set(internal_links(e["news"]) + internal_links(e["read"]) + internal_links(e["deposit"]))
for fl in floor:
    links |= set(internal_links(fl["html"]))

bad, warn = [], []
for ln in sorted(links):
    kind, _, s = ln.lstrip("/").partition("/")
    if kind == "film":
        f = fmap.get(s)
        if f is None:
            rows = sb_get(f"films?select=slug,visible&slug=eq.{s}")
            f = rows[0] if rows else None
        if not f: bad.append(ln)
        elif f.get("visible") is False: warn.append(ln + "  (held/not visible)")
    else:  # take | trope
        rows = sb_get(f"meta_takes?select=slug,status,kind&slug=eq.{s}")
        if not rows: bad.append(ln)
        elif rows[0].get("status") != "published": bad.append(ln + f"  ({rows[0].get('status')})")

# ---------- report ----------
print(f"  slug={slug}  status(draft)={fm_status}  items={len(entries)}  floor={len(floor)}  read_min={read_min}")
print(f"  dek: {dek}")
for e in entries:
    miss = "" if e["bd"] else "  ⚠ no backdrop"
    print(f"   {e['rank']}. ★{e['stars']} {e['film_title']} ({e['film_year']}) [{e['film_slug']}]{miss}  — {e['ehead'][:60]}")
print(f"  internal links checked: {len(links)}  ok={len(links)-len(bad)}  bad={len(bad)}  warn={len(warn)}")
for b in bad:  print(f"     ✗ {b}")
for w in warn: print(f"     ⚠ {w}")

if bad and not FORCE:
    print("\n  ✗ Some internal links don't resolve (404 would kill the premise). Fix the draft, or re-run with --force.")
    if PERSIST: sys.exit(1)

row = {"slug": slug, "title": "Between Film and the World", "edition_date": slug, "dek": dek,
       "read_min": read_min, "status": "published", "intro": intro_html,
       "entries": entries, "floor": floor}

if not PERSIST:
    print("\n[ingest] DRY done. Re-run with --persist to publish to the blog.")
    sys.exit(0)

st, _ = sb("DELETE", f"posts?slug=eq.{slug}")
st2, tx2 = sb("POST", "posts", row)
if st2 >= 300:
    print(f"  ✗ insert failed {st2}: {tx2[:200]}"); sys.exit(1)
print(f"\n  ✅ Published /blog/{slug}  ({len(entries)} items). Live within the ISR window (~2 min).")
