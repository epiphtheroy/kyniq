#!/usr/bin/env python3
"""Discovery scanner — newborn film-site radar (P0, files only, no DB).

Canonical spec: HANDOFF-발견피드.md (repo root). Daily batch:
  WhoisDS NRD list -> dictionary filter v2 -> homepage fetch -> Haiku classify
  -> state/candidates.jsonl + state/review-queue.md (append-only sections).

Usage:
  python3 scan.py                          # yesterday-2 (free list lags ~2 days)
  python3 scan.py --date 2026-07-16
  python3 scan.py --dates 2026-07-10,2026-07-11
  python3 scan.py --no-llm                 # filter+fetch only (no API cost)
  python3 scan.py --limit 40               # cap classified domains (testing)

Kill switch: `touch discovery/HOLD` (same convention as hourly/).
Stdlib only, Python 3.9+. Secrets read from repo .env.local (ANTHROPIC_API_KEY).
"""
import argparse
import base64
import concurrent.futures as cf
import html
import io
import json
import re
import socket
import ssl
import sys
import time
import urllib.error
import urllib.request
import zipfile
from datetime import date, datetime, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
STATE = HERE / "state"
CACHE = STATE / "cache"
CONFIG = json.loads((HERE / "config.json").read_text())

NRD_URL = "https://www.whoisds.com/whois-database/newly-registered-domains/{b64}/nrd"
API_URL = "https://api.anthropic.com/v1/messages"

PARKED_MARKERS = [
    "domain is for sale", "buy this domain", "this domain may be for sale",
    "sedoparking", "parkingcrew", "godaddy.com/domainsearch", "dan.com",
    "afternic", "domain parking", "hugedomains",
]

# Piracy players masquerading as "members-only cinemas" (plazmakino.ru class).
# A film-culture site links OUT to where films play; a piracy site embeds the
# player and offers quality toggles + a full watch-now catalog.
PIRACY_MARKERS = [
    "смотреть онлайн", "бесплатно в хорошем", "в hd качестве", "плеер",
    "watch online free", "full movie", "1080p", "720p", "4k hd", "webrip",
    "hdrip", "camrip", "player", "vidsrc", "streamtape", "doodstream",
    "putlocker", "reserv", "резерв", "плазма",
]
# Injected/interceptor scripts + reverse-proxy phishing tells (odeonkino.pro
# class): scripts that hook payment/booking, or a canonical/og host that does
# not match the domain being scanned (a clone points home at the real site).
SUSPICIOUS_SCRIPT_RE = re.compile(
    r'/inject/|payment[-_]?(widget|interceptor|hook)|admin[-_]?toolbar|'
    r'skimmer|cardhook', re.I)
CANONICAL_RE = re.compile(
    r'<(?:link[^>]+rel=["\']canonical["\'][^>]+href|meta[^>]+property='
    r'["\']og:url["\'][^>]+content)=["\']https?://([^/"\']+)', re.I)

CATEGORIES = (
    "criticism|journal|news|festival|venue|archive|podcast|education|"
    "database|prod-co|filmmaker|promo|business|piracy|phishing|content-farm|"
    "parked|broken|adult|unrelated|other"
)

SYSTEM_PROMPT = (
    "You are a SKEPTICAL verifier deciding whether a newly registered domain is a "
    "genuine, safe, worth-linking NEW film-culture website (criticism, journal, "
    "festival, cinema/venue, archive, podcast, film education, database). This link "
    "may be published under a respected film-criticism brand, so a single scam, "
    "piracy, or fake site slipping through is a serious failure. Assume nothing from "
    "the name; judge only the evidence in the payload, and when unsure, distrust.\n\n"
    "DANGEROUS classes to catch (set would_embarrass=true and the matching category):\n"
    "- phishing / lookalike clone: a canonical/og host different from the domain, or "
    "an injected payment/booking-interceptor script, means it impersonates a real "
    "venue to harvest data. category=phishing.\n"
    "- piracy: embedded video players, quality toggles (HD/4K/1080p), 'watch online "
    "free', a members-only 'private cinema' with a full watch-now catalog. category=piracy.\n"
    "- content-farm / fake-news: TMDB-wrapped databases with AI 'community' reviews and "
    "no editorial identity; 'news' about films that do not exist; brand name that does "
    "not match the domain. category=content-farm.\n"
    "- adult / thirst-clickbait: glamour/'slaying in black'/thirst galleries. category=adult.\n"
    "- broken shell: nav exists but the article/content feed fails to load or all "
    "counters are 0. category=broken.\n\n"
    "QUALITY (of real, safe film sites only): strong = substantial dated editorial or a "
    "real programmed festival/venue with lineup; decent = clearly real with some "
    "substance; thin = real but sparse; empty = loads but almost no content; bad = any "
    "dangerous class above.\n"
    "Score 0-100 = worth a human editor's glance. prod-co/filmmaker cap 55; single-film "
    "promo cap 50; every dangerous class = 0. Non-English sites are equally valid.\n\n"
    'Reply with ONLY a JSON object: {"score": <int>, "category": "<one of: '
    + CATEGORIES
    + '>", "quality": "<strong|decent|thin|empty|bad>", "would_embarrass": <bool>, '
    '"lang": "<iso2 or ?>", "reason": "<max 15 words>", "name_only": <bool>}'
)


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def load_env_key(name):
    import os
    if os.environ.get(name):
        return os.environ[name]
    env = REPO / ".env.local"
    if env.exists():
        for line in env.read_text().splitlines():
            line = line.strip()
            if line.startswith(name + "="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


# ---------------------------------------------------------------- ingest

def fetch_nrd_list(day):
    """Return list of domains for date string YYYY-MM-DD (cached zip)."""
    CACHE.mkdir(parents=True, exist_ok=True)
    zpath = CACHE / f"nrd-{day}.zip"
    if not zpath.exists():
        b64 = base64.b64encode(f"{day}.zip".encode()).decode()
        url = NRD_URL.format(b64=b64)
        log(f"downloading {day} …")
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        if not data or data[:2] != b"PK":
            raise RuntimeError(f"{day}: not a zip ({len(data)} bytes) — list not published yet?")
        zpath.write_bytes(data)
    with zipfile.ZipFile(io.BytesIO(zpath.read_bytes())) as z:
        name = next(n for n in z.namelist() if n.endswith(".txt"))
        text = z.read(name).decode("utf-8", "replace")
    return [d.strip().lower().rstrip(".") for d in text.splitlines() if d.strip()]


# ---------------------------------------------------------------- filter v2

CINE_RE = re.compile(CONFIG["cine_prefix_regex"])
TOKEN_SPLIT = re.compile(r"[-_0-9]+")


def label_of(domain):
    return domain.split(".", 1)[0]


def keyword_hit(label):
    for kw in CONFIG["core_keywords"]:
        if kw in label:
            return kw
    if CINE_RE.search(label):
        return "cine"
    return None


def blocked(label):
    for b in CONFIG["brand_blocklist"]:
        if b in label:
            return f"brand:{b}"
    for x in CONFIG.get("exclude_substrings", []):
        if x in label:
            return f"fp:{x}"
    tokens = [t for t in TOKEN_SPLIT.split(label) if t]
    for t in tokens:
        if t in CONFIG["junk_tokens"]:
            return f"token:{t}"
    return None


def filter_domains(domains):
    picked, brand_alerts = [], []
    for d in domains:
        lab = label_of(d)
        for bw in CONFIG["brand_watch"]:
            if bw in lab:
                brand_alerts.append(d)
        kw = keyword_hit(lab)
        if not kw:
            continue
        blk = blocked(lab)
        if blk:
            continue
        picked.append((d, kw))
    return picked, brand_alerts


# ---------------------------------------------------------------- fetch

FC = CONFIG["fetch"]
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.set_ciphers("DEFAULT")
CTX.verify_mode = ssl.CERT_NONE  # newborn domains: misconfigured certs are normal


def _get(url, timeout, max_bytes):
    req = urllib.request.Request(url, headers={"User-Agent": FC["user_agent"]})
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
        return r.read(max_bytes).decode("utf-8", "replace")


def robots_blocks_all(domain, timeout):
    try:
        body = _get(f"https://{domain}/robots.txt", timeout, 20000)
    except Exception:
        return False
    ua_all, disallow_all = False, False
    for line in body.splitlines()[:80]:
        line = line.split("#", 1)[0].strip().lower()
        if line.startswith("user-agent:"):
            ua_all = line.split(":", 1)[1].strip() == "*"
        elif ua_all and line.startswith("disallow:"):
            if line.split(":", 1)[1].strip() == "/":
                disallow_all = True
    return disallow_all


TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.I | re.S)
DESC_RE = re.compile(
    r'<meta[^>]+name=["\']description["\'][^>]+content=["\'](.*?)["\']', re.I | re.S)
DESC_RE2 = re.compile(
    r'<meta[^>]+content=["\'](.*?)["\'][^>]+name=["\']description["\']', re.I | re.S)
LANG_RE = re.compile(r"<html[^>]+lang=[\"']([a-zA-Z-]{2,8})[\"']", re.I)
TAG_RE = re.compile(r"<script.*?</script>|<style.*?</style>|<[^>]+>", re.S)


def _registrable(host):
    """Crude registrable-domain compare key (last two labels)."""
    parts = host.lower().lstrip("www.").split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else host.lower()


def fetch_home(item):
    domain, kw = item
    rec = {"domain": domain, "kw": kw, "status": "error:unknown",
           "title": "", "desc": "", "lang": "", "snippet": "", "flags": []}
    try:
        if robots_blocks_all(domain, FC["timeout_sec"]):
            rec["status"] = "robots_blocked"
            return rec
    except Exception:
        pass
    body = None
    for url in (f"https://{domain}", f"http://{domain}",
                f"https://www.{domain}"):
        try:
            body = _get(url, FC["timeout_sec"], FC["max_bytes"])
            break
        except (urllib.error.URLError, socket.timeout, ssl.SSLError,
                ConnectionError, OSError, ValueError) as e:
            rec["status"] = f"error:{type(e).__name__}"
    if body is None:
        return rec
    low = body.lower()
    m = TITLE_RE.search(body)
    rec["title"] = html.unescape(m.group(1)).strip()[:200] if m else ""
    m = DESC_RE.search(body) or DESC_RE2.search(body)
    rec["desc"] = html.unescape(m.group(1)).strip()[:300] if m else ""
    m = LANG_RE.search(body)
    rec["lang"] = m.group(1).lower() if m else ""
    text = re.sub(r"\s+", " ", TAG_RE.sub(" ", body)).strip()
    rec["snippet"] = html.unescape(text)[:400]

    # --- red flags: cheap safety heuristics (never let these auto-publish) ---
    flags = []
    if SUSPICIOUS_SCRIPT_RE.search(body):
        flags.append("injected-script")  # payment interceptor / admin toolbar
    cm = CANONICAL_RE.search(body)
    if cm and _registrable(cm.group(1)) != _registrable(domain):
        flags.append(f"canonical-mismatch:{_registrable(cm.group(1))}")  # clone tell
    piracy_hits = sum(1 for p in PIRACY_MARKERS if p in low)
    if piracy_hits >= 2:
        flags.append("piracy-player")
    rec["flags"] = flags

    if flags and ("injected-script" in flags or "canonical-mismatch" in " ".join(flags)):
        rec["status"] = "suspect:lookalike"   # odeonkino.pro class — hard exclude
    elif "piracy-player" in flags:
        rec["status"] = "suspect:piracy"       # plazmakino.ru class — hard exclude
    elif any(p in low for p in PARKED_MARKERS):
        rec["status"] = "parked"
    elif not rec["title"] and len(text) < 200:
        rec["status"] = "empty"
    else:
        rec["status"] = "ok"
    return rec


# ---------------------------------------------------------------- classify

def classify(rec, api_key):
    payload = {
        "model": CONFIG["llm"]["model"],
        "max_tokens": CONFIG["llm"]["max_tokens"],
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": json.dumps({
            "domain": rec["domain"], "tld": rec["domain"].split(".", 1)[-1],
            "fetch_status": rec["status"], "title": rec["title"],
            "meta_description": rec["desc"], "html_lang": rec["lang"],
            "text_snippet": rec["snippet"],
            "scanner_red_flags": rec.get("flags", []),
        }, ensure_ascii=False)}],
    }
    req = urllib.request.Request(
        API_URL, data=json.dumps(payload).encode(),
        headers={"content-type": "application/json", "x-api-key": api_key,
                 "anthropic-version": "2023-06-01"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                resp = json.loads(r.read().decode())
            text = resp["content"][0]["text"].strip()
            text = re.sub(r"^```(json)?|```$", "", text, flags=re.M).strip()
            out = json.loads(text)
            usage = resp.get("usage", {})
            with open(STATE / "usage.jsonl", "a") as f:
                f.write(json.dumps({"ts": datetime.now().isoformat(timespec="seconds"),
                                    "domain": rec["domain"],
                                    "in": usage.get("input_tokens"),
                                    "out": usage.get("output_tokens")}) + "\n")
            return {"score": int(out.get("score", 0)),
                    "category": str(out.get("category", "other"))[:20],
                    "quality": str(out.get("quality", "thin"))[:8],
                    "would_embarrass": bool(out.get("would_embarrass", False)),
                    "lang": str(out.get("lang", rec["lang"] or "?"))[:8],
                    "reason": str(out.get("reason", ""))[:120],
                    "name_only": bool(out.get("name_only", False))}
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 529) and attempt < 2:
                time.sleep(3 * (attempt + 1))
                continue
            return {"score": -1, "category": "llm-error", "quality": "bad",
                    "would_embarrass": True, "lang": "?",
                    "reason": f"http {e.code}", "name_only": False}
        except Exception as e:
            if attempt < 2:
                time.sleep(2)
                continue
            return {"score": -1, "category": "llm-error", "quality": "bad",
                    "would_embarrass": True, "lang": "?",
                    "reason": type(e).__name__, "name_only": False}


# ---------------------------------------------------------------- state + queue

def load_seen():
    p = STATE / "seen.json"
    return json.loads(p.read_text()) if p.exists() else {}


def save_seen(seen):
    (STATE / "seen.json").write_text(json.dumps(seen, indent=0, sort_keys=True))


def append_queue(day_range, rows, watch, stats):
    qp = STATE / "review-queue.md"
    if not qp.exists():
        qp.write_text(
            "# Discovery review queue\n\n"
            "> 사용법: 각 줄 맨 앞 `[ ]`에 **F**(Feature — 소개감, 코멘트 초안 메모) / "
            "**L**(List — 관측 로그행) / **R**(Reject) 기입. 발행 절차는 `HANDOFF-발견피드.md` §7.\n"
            "> 섹션은 실행마다 append — 과거 섹션의 판정 표기는 보존된다.\n")
    lines = [f"\n## {day_range} (generated {date.today().isoformat()}) — "
             f"{stats['input']:,} scanned → {stats['filtered']} filtered → "
             f"{stats['classified']} classified\n"]
    if rows:
        for r in sorted(rows, key=lambda x: -x["score"]):
            t = f" — “{r['title']}”" if r["title"] else ""
            d = f" — {r['desc'][:110]}" if r["desc"] else ""
            lines.append(
                f"- [ ] **{r['domain']}** ({r['score']}, {r['category']}, "
                f"{r['lang']}) {r['reason']}{t}{d} — https://{r['domain']}\n")
    else:
        lines.append("- (이번 구간 큐 후보 없음)\n")
    if watch:
        lines.append("\n**Watchlist (이름 유망·아직 빈 페이지 — 다음에 다시 열어볼 것):**\n")
        for r in sorted(watch, key=lambda x: -x["score"]):
            lines.append(f"- [ ] {r['domain']} ({r['score']}, {r['status']}) {r['reason']}\n")
    with open(qp, "a") as f:
        f.writelines(lines)


# ---------------------------------------------------------------- main

def run_day(day, seen, api_key, args):
    domains = fetch_nrd_list(day)
    picked, brand_alerts = filter_domains(domains)
    fresh = [(d, k) for d, k in picked if d not in seen]
    for d, _ in fresh:
        seen[d] = day
    log(f"{day}: {len(domains):,} domains → {len(picked)} matched → {len(fresh)} new")
    if brand_alerts:
        with open(STATE / "brand-alerts.log", "a") as f:
            for d in brand_alerts:
                f.write(f"{day} {d}\n")
        log(f"⚠️  BRAND WATCH: {brand_alerts}")
    if args.limit:
        fresh = fresh[: args.limit]
    with cf.ThreadPoolExecutor(max_workers=FC["max_workers"]) as ex:
        fetched = list(ex.map(fetch_home, fresh))
    if not args.no_llm and api_key:
        with cf.ThreadPoolExecutor(max_workers=CONFIG["llm"]["max_workers"]) as ex:
            results = list(ex.map(lambda r: classify(r, api_key), fetched))
    else:
        results = [{"score": 0, "category": "unclassified", "quality": "thin",
                    "would_embarrass": False, "lang": rec["lang"] or "?",
                    "reason": "", "name_only": False} for rec in fetched]
    out = []
    with open(STATE / "candidates.jsonl", "a") as f:
        for rec, cls in zip(fetched, results):
            row = dict(rec, **cls, first_seen=day,
                       scanned=datetime.now().isoformat(timespec="seconds"))
            row.pop("snippet", None)
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
            out.append(row)
    return out, {"input": len(domains), "filtered": len(fresh)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--date")
    ap.add_argument("--dates", help="comma-separated YYYY-MM-DD list")
    ap.add_argument("--no-llm", action="store_true")
    ap.add_argument("--limit", type=int)
    args = ap.parse_args()

    if (HERE / "HOLD").exists():
        log("HOLD file present — exiting.")
        return 0
    STATE.mkdir(exist_ok=True)

    if args.dates:
        days = args.dates.split(",")
    elif args.date:
        days = [args.date]
    else:
        days = [(date.today() - timedelta(days=2)).isoformat()]

    api_key = load_env_key("ANTHROPIC_API_KEY")
    if not api_key and not args.no_llm:
        log("no ANTHROPIC_API_KEY — running as --no-llm")
        args.no_llm = True

    seen = load_seen()
    all_rows, total_in, total_filtered = [], 0, 0
    for day in days:
        try:
            rows, st = run_day(day, seen, api_key, args)
        except Exception as e:
            log(f"{day}: FAILED — {e}")
            continue
        all_rows.extend(rows)
        total_in += st["input"]
        total_filtered += st["filtered"]
        save_seen(seen)

    q = CONFIG["queue"]
    legit = set(CONFIG.get("legit_categories", []))
    classified = [r for r in all_rows if r["score"] >= 0]
    # Queue gate: only real, safe, substantive film sites reach the human.
    # would_embarrass / suspect status / non-legit category are hard-rejected;
    # the human still confirms before anything publishes (HANDOFF §14).
    queue_rows = [r for r in classified
                  if r["score"] >= q["min_score"]
                  and not r["name_only"]
                  and r["status"] == "ok"
                  and not r.get("would_embarrass")
                  and r.get("quality") in ("strong", "decent")
                  and (not legit or r["category"] in legit)]
    queue_rows = queue_rows[: q["cap_per_day"] * len(days)]
    # Anything the scanner flagged as dangerous goes to a separate log so the
    # owner can see WHAT the gate is catching (and tune it), never the queue.
    rejected = [r for r in classified
                if r.get("would_embarrass") or str(r["status"]).startswith("suspect")]
    if rejected:
        with open(STATE / "rejected.log", "a") as f:
            for r in rejected:
                f.write(f"{r['first_seen']} {r['domain']} [{r['category']}/"
                        f"{r.get('quality')}] {r['status']} flags={r.get('flags')} "
                        f"{r['reason']}\n")
    watch = [r for r in classified
             if r["name_only"] and r["score"] >= q["watchlist_min_score"]]
    day_range = days[0] if len(days) == 1 else f"{min(days)} ~ {max(days)}"
    append_queue(day_range, queue_rows, watch,
                 {"input": total_in, "filtered": total_filtered,
                  "classified": len(classified)})
    errs = sum(1 for r in all_rows if r["score"] < 0)
    with open(STATE / "run.log", "a") as f:
        f.write(f"{datetime.now().isoformat(timespec='seconds')} {day_range} "
                f"in={total_in} filtered={total_filtered} queued={len(queue_rows)} "
                f"watch={len(watch)} rejected={len(rejected)} llm_err={errs}\n")
    log(f"done: queued {len(queue_rows)}, watchlist {len(watch)}, "
        f"rejected {len(rejected)}, llm errors {errs} → state/review-queue.md")
    log("⚠️  queue is a TRIAGE list — OPEN each site before publishing (HANDOFF §14).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
