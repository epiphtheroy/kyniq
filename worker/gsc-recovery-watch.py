#!/usr/bin/env python3
"""Read-only weekly follow-up for the September 2026 Google recovery cohort.

Uses the existing GSC read-only service-account helper. Never requests indexing,
changes a page, or sends a message. No third-party Python packages required.
"""
import argparse
import concurrent.futures
import datetime as dt
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser

ORIGIN = "https://metatake.net"
IMPROVED = ["the-piano-1993", "memories-of-murder-2003", "hook-1991",
            "gattaca-1997", "the-blair-witch-project-1999"]
# Same route family, with impressions in the July baseline. These remain
# unedited; they are references, not a randomized causal experiment.
COMPARISONS = ["andhadhun-2018", "mars-attacks-1996", "only-lovers-left-alive-2013",
               "barton-fink-1991"]
COHORT = [(f"/film/locations/{s}", "improved") for s in IMPROVED]
COHORT += [(f"/film/locations/{s}", "comparison") for s in COMPARISONS]
COHORT += [(p, "inspection") for p in ["/film/get-out-2017",
           "/director/steven-soderbergh", "/film/the-blair-witch-project-1999/credits"]]


class Tags(HTMLParser):
    def __init__(self):
        super().__init__()
        self.robots = []
        self.canonical = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "meta" and a.get("name", "").lower() in ("robots", "googlebot"):
            self.robots.append(a.get("content", ""))
        if tag == "link" and a.get("rel") == "canonical":
            self.canonical.append(a.get("href", ""))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--auth-root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path)
    parser.add_argument("--force", action="store_true", help="Allow a manual run after October 24")
    args = parser.parse_args()
    today = dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).date()
    if today > dt.date(2026, 10, 24) and not args.force:
        print("The six-week observation window has ended; no network requests made.")
        return
    out = args.output or args.auth_root / "docs/seo-recovery-2026-09-12/runs" / str(today)
    out.mkdir(parents=True, exist_ok=True)
    spec = importlib.util.spec_from_file_location("gsc_auth", args.auth_root / "worker/gsc-noindex-attribution.py")
    auth = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(auth)
    token = auth.access_token()
    endpoint = "https://www.googleapis.com/webmasters/v3/sites/" + urllib.parse.quote(auth.PROPERTY, safe="") + "/searchAnalytics/query"

    def post(url, payload):
        req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={
            "Authorization": f"Bearer {token}", "Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=45) as response:
            return json.load(response)

    def analytics(start, end, path=None):
        payload = {"startDate": str(start), "endDate": str(end), "type": "web",
                   "dataState": "final", "dimensions": ["date"], "rowLimit": 25000}
        if path:
            payload["dimensionFilterGroups"] = [{"filters": [{"dimension": "page",
                "operator": "equals", "expression": ORIGIN + path}]}]
        return post(endpoint, payload)

    # Find the latest returned final date; a missing recent date is never zero.
    daily = analytics(today - dt.timedelta(days=35), today)
    rows = daily.get("rows", [])
    if not rows:
        raise RuntimeError("No final daily GSC rows returned; no zero-traffic report produced")
    latest = dt.date.fromisoformat(max(r["keys"][0] for r in rows))
    start = latest - dt.timedelta(days=13)

    def inspect_page(item):
        path, group = item
        record = {"url": ORIGIN + path, "group": group}
        try:
            record["inspection"] = post("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
                {"inspectionUrl": ORIGIN + path, "siteUrl": auth.PROPERTY, "languageCode": "en-US"})
            record["performance"] = analytics(start, latest, path)
        except Exception as exc:
            record["gsc_error"] = type(exc).__name__
        try:
            req = urllib.request.Request(ORIGIN + path, headers={"User-Agent": auth.UA})
            with urllib.request.urlopen(req, timeout=45) as response:
                tags = Tags()
                tags.feed(response.read().decode("utf-8", errors="replace"))
                record["http"] = {"status": response.status, "final_url": response.url,
                    "robots": tags.robots, "canonical": tags.canonical,
                    "x_robots_tag": response.headers.get("X-Robots-Tag")}
        except urllib.error.HTTPError as exc:
            record["http"] = {"status": exc.code}
        except Exception as exc:
            record["http_error"] = type(exc).__name__
        return record

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        pages = list(pool.map(inspect_page, COHORT))
    report = {"checked_at_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "property": auth.PROPERTY, "latest_final_date": str(latest),
        "daily": daily, "pages": pages,
        "notes": ["Inspection API is stored index data, not a live Google render test.",
            "Comparison pages are observational references, not randomized controls.",
            "Page-level and site-level impressions use different aggregation; do not sum them together.",
            "Googlebot metrics include images, API calls and HTML, not unique content pages."]}
    binary = shutil.which("vercel") or "/opt/homebrew/bin/vercel"
    try:
        # Vercel day boundaries are UTC; the upper bound excludes today.
        cmd = [binary, "metrics", "vercel.request.count", "--project", "kyniq-5eox",
            "--since", str(today - dt.timedelta(days=7)), "--until", str(today),
            "--granularity", "1d", "--group-by", "httpStatus", "--group-by", "botVerified",
            "--filter", 'botName:"googlebot"', "--limit", "100", "--json"]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120, cwd=args.auth_root)
        if result.returncode:
            report["googlebot_error"] = f"Vercel CLI exit {result.returncode} (run the documented command interactively)"
        else:
            report["googlebot"] = json.loads(result.stdout)
    except Exception as exc:
        report["googlebot_error"] = type(exc).__name__

    def totals(rs, beginning, ending):
        selected = [r for r in rs if str(beginning) <= r["keys"][0] <= str(ending)]
        return sum(r["impressions"] for r in selected), sum(r["clicks"] for r in selected)

    recent_start = latest - dt.timedelta(days=6)
    prior_end = recent_start - dt.timedelta(days=1)
    recent = totals(rows, recent_start, latest)
    prior = totals(rows, start, prior_end)
    lines = [f"# Google follow-up — {today}", "",
        f"Latest returned final GSC day: {latest}. Unreturned days are not counted as zero.", "",
        f"Site impressions / clicks: {start}–{prior_end}: {prior[0]:g} / {prior[1]:g}; "
        f"{recent_start}–{latest}: {recent[0]:g} / {recent[1]:g}.", "",
        "| URL | Group | HTTP | Index coverage | Last crawl UTC | Recent impressions / clicks |",
        "|---|---|---|---|---|---|"]
    errors = []
    for p in pages:
        index = p.get("inspection", {}).get("inspectionResult", {}).get("indexStatusResult", {})
        metrics = totals(p.get("performance", {}).get("rows", []), recent_start, latest)
        measured = f"{metrics[0]:g} / {metrics[1]:g}" if "performance" in p else "unavailable"
        lines.append(f"| {p['url']} | {p['group']} | {p.get('http', {}).get('status', 'unavailable')} | "
            f"{index.get('coverageState', 'unavailable')} | {index.get('lastCrawlTime', 'unavailable')} | {measured} |")
        if p.get("gsc_error") or p.get("http_error"):
            errors.append(p["url"])
    lines += ["", "## Limits", ""] + ["- " + n for n in report["notes"]]
    if report.get("googlebot_error"):
        lines.append("- Googlebot metrics unavailable: " + report["googlebot_error"])
        errors.append("Vercel metrics")
    lines += ["", "Check raw report.json for verified bot response codes and detailed inspection results.",
        "No automatic reindex requests or site changes were made.", ""]
    (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    (out / "report.md").write_text("\n".join(lines))
    print(f"Saved {out / 'report.md'}; {len(pages)} URLs; latest final day {latest}.")
    if errors:
        print(f"Incomplete checks: {len(errors)}. See the report; unavailable does not mean zero.")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
