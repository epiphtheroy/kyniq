#!/usr/bin/env python3
"""Magazine ingest (W8b) — allow-listed critic outlets → SHORT snippets + embeddings.

Runs on a NETWORKED machine (your dev box), like mt-embed.py. Reads the outlet
allow-list, fetches each ACTIVE outlet's RSS feed, and stores — per recent
article — a SHORT excerpt only (never the full text), with attribution + link,
plus a 1536-d embedding for retrieval. Quote length is capped again at use time
by app/rag/_lib/quotation.ts.

Fair-use safeguards baked in:
  • Only outlets with active=true AND ingest_method='rss' are crawled.
  • Only the first ~SNIPPET_WORDS words of the RSS summary are stored.
  • article_url is always kept for link-out.
  • Respects a per-outlet enable flag (you flip `active` deliberately).

Usage:
  python3 worker/magazine-ingest.py --seed        # upsert outlets from the CSV (all inactive)
  python3 worker/magazine-ingest.py --enable rss  # mark RSS-incremental + robots-allows outlets active
  python3 worker/magazine-ingest.py               # crawl active outlets, store snippets, embed
  python3 worker/magazine-ingest.py --dry         # show what would happen, write nothing
"""
import os, sys, csv, json, re, html, urllib.request, urllib.error, urllib.parse
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)

def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT, ".env.local"))

URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
OPENAI = os.environ.get("OPENAI_API_KEY")
if not (URL and KEY and OPENAI):
    print("Missing env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + OPENAI_API_KEY)"); sys.exit(1)

ARGS = sys.argv[1:]
DRY = "--dry" in ARGS
SNIPPET_WORDS = 60          # fair use: store only a short excerpt
MODEL = "text-embedding-3-small"
ALLOWLIST = os.path.join(ROOT, "data", "sources", "magazine-allowlist.csv")
UA = "Metatake-Ingest/1.0 (+https://metatake.net; contact wonwoo@metatake.net)"

def http(method, url, headers=None, body=None, timeout=30):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data)
    req.add_header("User-Agent", UA)
    if body is not None: req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read()
    except urllib.error.HTTPError as e: return e.code, e.read()
    except Exception as e: return 0, str(e).encode()

def sb(method, path, body=None, prefer=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    if prefer: h["Prefer"] = prefer
    st, raw = http(method, f"{URL}/rest/v1/{path}", h, body)
    return st, raw

def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")[:60]

def strip_html(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    return html.unescape(re.sub(r"\s+", " ", s)).strip()

def clean_lead(summary, title=None):
    """Strip RSS boilerplate that leads many feeds — a repeated article title and a
    'By Author' byline — so the stored snippet begins with real prose."""
    t = strip_html(summary)
    if title:
        tt = strip_html(title).strip()
        if tt and t[:len(tt)].lower() == tt.lower():
            t = t[len(tt):].lstrip(" -–—:·|.")
    # drop a leading "By Firstname [M.] Lastname" byline (twice: handles title+byline)
    for _ in range(2):
        t = re.sub(r"^\s*by\s+[A-Z][\w.'’\-]*(?:\s+[A-Z][\w.'’\-]*){0,3}\s*[\.,—\-–:|]*\s*", "", t, flags=re.I)
    return re.sub(r"\s+", " ", t).strip()

def short_snippet(text, title=None):
    cleaned = clean_lead(text, title)
    base = cleaned if len(cleaned.split()) >= 8 else strip_html(text)
    w = base.split()
    return " ".join(w[:SNIPPET_WORDS]) + ("…" if len(w) > SNIPPET_WORDS else "")

def embed_one(text):
    st, raw = http("POST", "https://api.openai.com/v1/embeddings",
                   {"Authorization": f"Bearer {OPENAI}"}, {"model": MODEL, "input": text[:8000] or " "})
    if st != 200: raise RuntimeError(f"embed {st}: {raw[:200]}")
    return json.loads(raw)["data"][0]["embedding"]

# ── outlet seeding from the allow-list CSV ───────────────────────────────
def seed_outlets():
    rows = list(csv.DictReader(open(ALLOWLIST, encoding="utf-8")))
    print(f"[seed] {len(rows)} outlets from CSV{' [DRY]' if DRY else ''}")
    for r in rows:
        rec = {
            "slug": slugify(r.get("name")), "name": r.get("name"), "publisher": r.get("publisher"),
            "homepage_url": r.get("homepage_url"), "country": r.get("country"), "language": r.get("language"),
            "trust_tier": int(r["trust_tier"]) if (r.get("trust_tier") or "").isdigit() else None,
            "ingest_method": "rss" if (r.get("rss_url") or "").startswith("http") else r.get("api_available", "none"),
            "robots_ai_stance": r.get("robots_ai_stance"),
            "ingest_recommendation": r.get("ingest_recommendation"),  # kept in notes, see enable step
            "active": False,
        }
        # store rss_url in homepage if needed? keep separate via a side table-less convention:
        rec_db = {k: rec[k] for k in ("slug","name","publisher","homepage_url","country","language",
                                      "trust_tier","ingest_method","robots_ai_stance","active")}
        if DRY: continue
        sb("POST", "magazines?on_conflict=slug", rec_db, prefer="resolution=merge-duplicates,return=minimal")
    print("[seed] done. Next: --enable rss (activates safe RSS outlets), then run ingest.")

def enable_rss():
    """Activate only outlets that are RSS-incremental + robots allows (conservative)."""
    rows = list(csv.DictReader(open(ALLOWLIST, encoding="utf-8")))
    enabled = 0
    for r in rows:
        if r.get("ingest_recommendation") == "RSS-incremental" and r.get("robots_ai_stance") in ("allows", "partial") \
           and (r.get("rss_url") or "").startswith("http"):
            if not DRY:
                sb("PATCH", f"magazines?slug=eq.{slugify(r.get('name'))}", {"active": True}, prefer="return=minimal")
            enabled += 1
    print(f"[enable] {enabled} RSS outlets marked active{' [DRY]' if DRY else ''}")

# ── crawl active outlets' RSS, store short snippets ──────────────────────
def parse_rss(xml_bytes):
    items = []
    try: root = ET.fromstring(xml_bytes)
    except Exception: return items
    # RSS 2.0
    for it in root.iter("item"):
        g = lambda t: (it.findtext(t) or "").strip()
        items.append({"title": g("title"), "link": g("link"),
                      "author": g("{http://purl.org/dc/elements/1.1/}creator") or g("author"),
                      "date": g("pubDate"), "summary": g("description")})
    # Atom
    ns = "{http://www.w3.org/2005/Atom}"
    for it in root.iter(f"{ns}entry"):
        link = ""
        for l in it.findall(f"{ns}link"):
            if l.get("rel") in (None, "alternate"): link = l.get("href") or link
        items.append({"title": (it.findtext(f"{ns}title") or "").strip(), "link": link,
                      "author": (it.findtext(f"{ns}author/{ns}name") or "").strip(),
                      "date": (it.findtext(f"{ns}updated") or it.findtext(f"{ns}published") or "").strip(),
                      "summary": (it.findtext(f"{ns}summary") or it.findtext(f"{ns}content") or "").strip()})
    return items

def crawl():
    # fetch active outlets (id, slug, name) and their rss_url from the CSV by slug
    st, raw = sb("GET", "magazines?select=id,slug,name&active=eq.true")
    if st != 200: print(f"fetch magazines {st}: {raw[:200]}"); return
    active = {m["slug"]: m for m in json.loads(raw)}
    csv_by_slug = {slugify(r["name"]): r for r in csv.DictReader(open(ALLOWLIST, encoding="utf-8"))}
    print(f"[crawl] {len(active)} active outlets{' [DRY]' if DRY else ''}")
    if "--reset" in ARGS and not DRY:
        sb("DELETE", "magazine_passages?id=not.is.null", prefer="return=minimal")
        print("[crawl] --reset: cleared existing passages (will re-store cleaned snippets)")
    total = 0
    for slug, m in active.items():
        rss = (csv_by_slug.get(slug, {}).get("rss_url") or "").strip()
        if not rss.startswith("http"): continue
        st, raw = http("GET", rss, timeout=30)
        if st != 200: print(f"  {m['name']}: rss {st}"); continue
        items = parse_rss(raw)[:25]  # recent only
        st2, raw2 = sb("GET", f"magazine_passages?select=article_url&magazine_id=eq.{m['id']}")
        existing = set(x["article_url"] for x in json.loads(raw2)) if st2 == 200 else set()
        for e in items:
            link = e.get("link"); summ = e.get("summary")
            if not link or not summ: continue
            if link in existing: continue  # already stored → skip embed (no repeat cost)
            snip = short_snippet(summ, e.get("title"))
            if len(snip.split()) < 8: continue
            row = {"magazine_id": m["id"], "article_url": link, "article_title": e.get("title"),
                   "author": e.get("author") or None, "snippet": snip}
            if DRY:
                total += 1; continue
            try:
                row["embedding"] = embed_one(snip)
            except Exception as ex:
                print(f"    embed fail: {ex}"); continue
            sb("POST", "magazine_passages?on_conflict=article_url,snippet", row,
               prefer="resolution=merge-duplicates,return=minimal")
            total += 1
        print(f"  {m['name']}: {len(items)} items")
    print(f"[crawl] stored ~{total} short snippets. (Add the HNSW index in the DB-free window.)")

def main():
    if "--seed" in ARGS: seed_outlets()
    elif "--enable" in ARGS: enable_rss()
    else: crawl()

if __name__ == "__main__":
    main()
