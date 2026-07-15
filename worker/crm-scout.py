#!/usr/bin/env python3
"""worker/crm-scout.py — CRM search bot (§5-8-A). Scans official Contact/Press
pages in crm_sources and files candidates into crm_candidates. Candidates only —
never contacts (a human promotes them in /crm/research).

Guardrails (HANDOFF-CRM §10-3/§10-14):
  • KR hosts (.kr/.co.kr/.or.kr) or country=KR are SKIPPED at request time,
    regardless of the stored is_kr flag (정보통신망법 §50-2).
  • robots.txt is honored; depth-1 only (contact/press/about), not a crawl.
  • polite: 2s between hosts, ≤4 requests/source.

Runs on the operator's Mac (sandbox has no internet). stdlib only.
Usage:  python3 worker/crm-scout.py [--limit 30] [--dry]
"""
from __future__ import annotations

import re
import sys
import time
import fcntl
import datetime as dt
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / "hourly" / "pipeline"))
from common import load_env, http, sb_get, sb_insert, sb_update  # noqa: E402

KR_HOST = re.compile(r"\.(kr|co\.kr|or\.kr|ne\.kr|go\.kr)$", re.I)
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
CONTACT_LINK = re.compile(r"/(contact|press|about|team|imprint|impressum)", re.I)
GENERIC_LOCAL = re.compile(r"^(example|test|noreply|no-reply|donotreply)@", re.I)


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def is_kr_host(url: str, country: str | None) -> bool:
    host = (urlparse(url).hostname or "").lower()
    if KR_HOST.search(host):
        return True
    if country and ("한국" in country or country.strip().upper() in ("KR", "KOREA", "SOUTH KOREA")):
        return True
    return False


def robots_ok(url: str) -> bool:
    try:
        p = urlparse(url)
        rp = RobotFileParser()
        rp.set_url(f"{p.scheme}://{p.netloc}/robots.txt")
        status, data = http(f"{p.scheme}://{p.netloc}/robots.txt", timeout=10)
        if status == 200:
            rp.parse(data.decode("utf-8", "ignore").splitlines())
            return rp.can_fetch("MetatakeBot", url)
    except Exception:
        pass
    return True  # fail-open: absent/broken robots.txt = allowed


def extract(html: str, base: str) -> tuple[set[str], set[str], list[str]]:
    emails = {e.lower() for e in EMAIL_RE.findall(html) if not GENERIC_LOCAL.match(e.lower())}
    mailtos = {m.lower() for m in re.findall(r'mailto:([^"\'>?\s]+)', html, re.I)}
    emails |= {m for m in mailtos if "@" in m}
    forms = re.findall(r'href=["\']([^"\']*(?:contact|press|about)[^"\']*)["\']', html, re.I)
    links = []
    for href in forms:
        u = urljoin(base, href)
        if urlparse(u).netloc == urlparse(base).netloc and CONTACT_LINK.search(u):
            links.append(u)
    return emails, mailtos, links[:3]


def dedup_key(email: str | None, org: str) -> str:
    if email:
        return email.lower()
    return f"{org.strip().lower()}"


def already_known(env, key: str) -> bool:
    if "@" in key:
        for tbl in ("crm_contacts", "crm_candidates", "crm_suppression"):
            col = "email" if tbl != "crm_candidates" else "email_found"
            if tbl == "crm_suppression":
                col = "email"
            r = sb_get(env, f"{tbl}?{col}=eq.{key}&limit=1", service=True)
            if r:
                return True
    else:
        r = sb_get(env, f"crm_candidates?dedup_key=eq.{key}&status=eq.new&limit=1", service=True)
        if r:
            return True
    return False


def main() -> int:
    limit = 30
    dry = "--dry" in sys.argv
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])

    lock = open(REPO / "worker" / ".crm-scout.lock", "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        print("crm-scout already running"); return 0

    env = load_env()
    q = (f"crm_sources?status=eq.active&is_kr=eq.false"
         f"&or=(next_scan_at.is.null,next_scan_at.lte.{now_iso()})&limit={limit}")
    sources = sb_get(env, q, service=True) or []
    print(f"crm-scout: {len(sources)} sources due")

    found = 0
    for s in sources:
        url, sid = s["url"], s["id"]
        country = s.get("country")

        if is_kr_host(url, country):
            sb_update(env, "crm_sources", f"id=eq.{sid}", {"is_kr": True, "notes": "KR host — auto-skip"})
            continue
        if not robots_ok(url):
            sb_update(env, "crm_sources", f"id=eq.{sid}", {"robots_ok": False, "last_scanned_at": now_iso(),
                      "next_scan_at": (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=30)).replace(microsecond=0).isoformat()})
            continue

        emails: set[str] = set()
        reqs = 0
        status, data = http(url, timeout=20)
        reqs += 1
        if status == 200:
            html = data.decode("utf-8", "ignore")
            e, _m, links = extract(html, url)
            emails |= e
            for link in links:
                if reqs >= 4 or is_kr_host(link, country):
                    continue
                st2, d2 = http(link, timeout=15)
                reqs += 1
                if st2 == 200:
                    e2, _m2, _l2 = extract(d2.decode("utf-8", "ignore"), link)
                    emails |= e2
                time.sleep(0.5)

        ok = status == 200
        for email in list(emails)[:5]:
            key = dedup_key(email, s.get("org_name") or url)
            if already_known(env, key):
                continue
            cand = {
                "source": "scout", "segment_guess": s.get("segment_code"),
                "org_name": s.get("org_name") or urlparse(url).netloc,
                "country": country, "email_found": email, "evidence_url": url,
                "evidence_snippet": f"Found on {url}", "dedup_key": key,
            }
            if dry:
                print("  would add", email, "<-", url)
            else:
                sb_insert(env, "crm_candidates", cand)
            found += 1

        fail = (s.get("fail_count") or 0) + (0 if ok else 1)
        patch = {"last_scanned_at": now_iso(), "robots_ok": True, "fail_count": fail,
                 "next_scan_at": (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=30)).replace(microsecond=0).isoformat()}
        if fail >= 3:
            patch["status"] = "dead"
        if not dry:
            sb_update(env, "crm_sources", f"id=eq.{sid}", patch)
        time.sleep(2.0)  # polite between hosts

    print(f"crm-scout: {found} candidates {'(dry)' if dry else 'filed'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
