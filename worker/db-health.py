#!/usr/bin/env python3
"""
db-health — is the production database well enough to be read from?

Exit 0 = healthy (a trivial statement returned quickly).
Exit 1 = not healthy. Exit 2 = credentials missing.

One statement, once. This exists so unattended jobs can WAIT for the database
instead of discovering its condition by adding to its load — which is how the
2026-08-06 saturation got its second wind.

    python3 worker/db-health.py            # quiet, exit code only
    python3 worker/db-health.py --verbose
"""
import json, pathlib, sys, time, urllib.request, urllib.error

ROOT = pathlib.Path(__file__).resolve().parent.parent
PROJECT = "jvgarcqrtsmgfimdcwgo"
BUDGET_S = 8.0          # a healthy `select 1` answers in well under a second


def token():
    import os
    t = os.environ.get("SUPABASE_ACCESS_TOKEN")
    if t:
        return t
    for name in (".env.local", ".env"):
        p = ROOT / name
        if p.exists():
            for line in p.read_text().splitlines():
                if line.startswith("SUPABASE_ACCESS_TOKEN="):
                    return line.split("=", 1)[1].strip()
    return None


def main():
    verbose = "--verbose" in sys.argv
    tok = token()
    if not tok:
        print("no SUPABASE_ACCESS_TOKEN", file=sys.stderr)
        return 2
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT}/database/query",
        data=json.dumps({"query": "select 1 as ok"}).encode(),
        headers={
            "Authorization": f"Bearer {tok}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
        },
        method="POST",
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            dt = time.time() - t0
            json.loads(r.read().decode())
            if dt > BUDGET_S:
                if verbose:
                    print(f"slow: {dt:.1f}s (budget {BUDGET_S}s)")
                return 1
            if verbose:
                print(f"healthy: {dt:.2f}s")
            return 0
    except urllib.error.HTTPError as e:
        if verbose:
            print(f"HTTP {e.code} after {time.time()-t0:.1f}s: {e.read().decode()[:160]}")
        return 1
    except Exception as e:  # noqa: BLE001
        if verbose:
            print(f"{type(e).__name__} after {time.time()-t0:.1f}s: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
