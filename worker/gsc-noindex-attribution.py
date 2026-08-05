#!/usr/bin/env python3
"""Attribute an impression collapse: our noindex tags, or Google's ranking call?

Written 2026-08-03 to settle a question the owner keeps returning to — "did I
break this by noindexing so much on 07-18?" — and to keep settling it without
re-deriving the evidence each time. Findings live in
docs/HANDOFF-구글-트래픽붕괴-2026-07.md §2.1.

The test only works one way round. Comparing totals before and after tells you
nothing about cause: pages we noindexed and pages Google demoted both go to
zero. So take the pages that HELD impressions before the drop, fetch each one
now, and read its actual `meta robots`. Impressions sitting on pages that are
still fully indexable cannot be explained by our tags — those pages are still
inviting Google in and Google is declining.

Measured 2026-08-03 for the 07-18 collapse: of the top 60 pre-collapse pages,
39 were still indexable and carried 72% of the lost impressions. 10 were
noindexed (13%). The verdict was not our tags.

Needs worker/gsc-sa.json (or GSC_SA_JSON), scope webmasters.readonly. The ~30
lines of JWT auth below are copied from gsc-pull.py rather than imported: that
file runs its whole pull at module level, so importing it fires a live Search
Console query as a side effect. A forensic tool should not depend on the shape
of the production puller — leave that file alone and stay self-contained.

  python3 worker/gsc-noindex-attribution.py                       # 07-18 event
  python3 worker/gsc-noindex-attribution.py --pre 2026-09-01:2026-09-07 \
                                            --post 2026-09-15:2026-09-21 --top 100
"""
import argparse
import base64
import concurrent.futures as cf
import json
import os
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)


def load_env(p):
    if not os.path.exists(p):
        return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env(os.path.join(ROOT, ".env.local"))
load_env(os.path.join(HERE, ".env.local"))

SA_PATH = os.environ.get("GSC_SA_JSON", os.path.join(HERE, "gsc-sa.json"))
PROPERTY = os.environ.get("GSC_PROPERTY", "sc-domain:metatake.net")
UA = "Mozilla/5.0 (compatible; MetatakeAudit/1.0; +https://metatake.net/bot)"


def b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def access_token() -> str:
    """Service-account JWT → access token. openssl signs RS256, so no pip deps."""
    sa = json.load(open(SA_PATH, encoding="utf-8"))
    now = int(time.time())
    header = b64url(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    claims = b64url(json.dumps({
        "iss": sa["client_email"],
        "scope": "https://www.googleapis.com/auth/webmasters.readonly",
        "aud": "https://oauth2.googleapis.com/token",
        "iat": now, "exp": now + 3600,
    }).encode())
    signing_input = f"{header}.{claims}".encode()
    with tempfile.NamedTemporaryFile("w", suffix=".pem", delete=False) as kf:
        kf.write(sa["private_key"])
        key_path = kf.name
    try:
        sig = subprocess.run(["openssl", "dgst", "-sha256", "-sign", key_path],
                             input=signing_input, capture_output=True, check=True).stdout
    finally:
        os.unlink(key_path)
    jwt = f"{header}.{claims}.{b64url(sig)}"
    body = ("grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer"
            f"&assertion={jwt}").encode()
    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token", data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["access_token"]


def pages(token: str, start: str, end: str, limit: int = 25000):
    """searchAnalytics rows at the page grain for [start, end]."""
    endpoint = (
        "https://www.googleapis.com/webmasters/v3/sites/"
        + urllib.parse.quote(PROPERTY, safe="")
        + "/searchAnalytics/query"
    )
    body = json.dumps({
        "startDate": start, "endDate": end,
        "dimensions": ["page"], "rowLimit": limit, "startRow": 0,
    }).encode()
    req = urllib.request.Request(
        endpoint, data=body, method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read()).get("rows", [])


def robots_state(url: str):
    """(http_status, state) for one live URL. state ∈ NOINDEX | indexable | ..."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=25) as r:
            html = r.read(400_000).decode("utf-8", "ignore")
            code = r.status
    except urllib.error.HTTPError as e:
        # 3xx surfaces here too (urllib follows same-host redirects, so a code
        # means the target refused or the redirect left the host).
        return e.code, "HTTP_ERROR"
    except Exception as e:
        return 0, f"ERR:{type(e).__name__}"
    if 'name="robots" content="noindex' in html.lower():
        return code, "NOINDEX"
    return code, "indexable"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pre", default="2026-07-11:2026-07-17", help="baseline window START:END")
    ap.add_argument("--post", default="2026-07-26:2026-08-01", help="after window START:END")
    ap.add_argument("--top", type=int, default=60, help="how many top pre-window pages to fetch live")
    a = ap.parse_args()
    pre_s, pre_e = a.pre.split(":")
    post_s, post_e = a.post.split(":")

    token = access_token()
    pre = pages(token, pre_s, pre_e)
    post = pages(token, post_s, post_e)
    post_imp = {r["keys"][0]: r.get("impressions", 0) for r in post}

    pi = sum(r.get("impressions", 0) for r in pre)
    qi = sum(r.get("impressions", 0) for r in post)
    print(f"PRE  {pre_s}~{pre_e}: {len(pre):>5} pages, {pi:>8.0f} impressions")
    print(f"POST {post_s}~{post_e}: {len(post):>5} pages, {qi:>8.0f} impressions")
    if pi:
        print(f"     pages {(len(post)-len(pre))/max(len(pre),1)*100:+.0f}%"
              f" · impressions {(qi-pi)/pi*100:+.0f}%")

    top = sorted(pre, key=lambda r: -r.get("impressions", 0))[: a.top]
    with cf.ThreadPoolExecutor(8) as ex:
        res = list(ex.map(
            lambda r: (r["keys"][0], r.get("impressions", 0), *robots_state(r["keys"][0])), top))

    total = sum(i for _, i, _, _ in res)
    by_state = Counter(s for _, _, _, s in res)
    imp_by_state = Counter()
    for _, imp, _, s in res:
        imp_by_state[s] += imp

    print(f"\nTop {len(res)} pre-collapse pages, robots state as of now:")
    for s, n in by_state.most_common():
        share = imp_by_state[s] / total * 100 if total else 0
        print(f"  {n:>3} pages  {imp_by_state[s]:>6.0f} impressions ({share:>4.0f}%)  {s}")

    ni = imp_by_state.get("NOINDEX", 0)
    ok = imp_by_state.get("indexable", 0)
    print(f"\nVERDICT: {ok/total*100:.0f}% of the lost impressions sit on pages that are "
          f"STILL INDEXABLE; {ni/total*100:.0f}% on pages we noindexed.")
    print("         Impressions on still-indexable pages cannot be blamed on our tags.")

    print("\nStill indexable, lost impressions (top 20):")
    for url, imp, code, st in [r for r in res if r[3] == "indexable"][:20]:
        print(f"  {imp:>6.0f} → {post_imp.get(url, 0):>4.0f}  [{code}]  "
              f"{url.replace('https://metatake.net', '')[:70]}")


if __name__ == "__main__":
    main()
