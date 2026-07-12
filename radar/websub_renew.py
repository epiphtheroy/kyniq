#!/usr/bin/env python3
"""WebSub lease renewal for the YouTube channel pool (§6.1-D, §7).

Subscribes/renews every radar_sources(platform='youtube', kind='websub') whose
lease expires within 2 days, at Google's hub. The hub then POSTs new-video Atom
to our Vercel callback (/api/radar/websub), which parks it in radar_inbox for
process_inbox.py. Lease max is 10 days → renew ~every 5. Runs daily on the Mac.

Usage: python3 radar/websub_renew.py
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlencode

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from common import http, load_env, log, record_run, sb_get, sb_patch  # noqa: E402

HUB = "https://pubsubhubbub.appspot.com/subscribe"
LEASE_S = 432000  # 5 days
RENEW_WITHIN_DAYS = 2


def main() -> None:
    env = load_env()
    site = (env.get("NEXT_PUBLIC_SITE_URL") or "https://metatake.net").rstrip("/")
    secret = env.get("RADAR_WEBSUB_SECRET", "")
    callback = f"{site}/api/radar/websub" + (f"?key={secret}" if secret else "")

    srcs = sb_get(env, "radar_sources?select=id,url,websub_lease_until"
                       "&platform=eq.youtube&kind=eq.websub&active=is.true&order=id&limit=1000") or []
    soon = (datetime.now(timezone.utc) + timedelta(days=RENEW_WITHIN_DAYS))
    due = []
    for s in srcs:
        lu = s.get("websub_lease_until")
        if not lu:
            due.append(s)
            continue
        try:
            if datetime.fromisoformat(lu.replace("Z", "+00:00")) <= soon:
                due.append(s)
        except Exception:
            due.append(s)

    renewed = 0
    errors: list = []
    for s in due:
        body = urlencode({
            "hub.mode": "subscribe", "hub.topic": s["url"], "hub.callback": callback,
            "hub.verify": "async", "hub.lease_seconds": str(LEASE_S),
        }).encode()
        status, _ = http(HUB, method="POST", body=body,
                         headers={"Content-Type": "application/x-www-form-urlencoded"})
        if status in (202, 204):  # hub accepted; it will GET-verify our callback
            until = (datetime.now(timezone.utc) + timedelta(seconds=LEASE_S)
                     ).strftime("%Y-%m-%dT%H:%M:%SZ")
            sb_patch(env, "radar_sources", f"id=eq.{s['id']}", {"websub_lease_until": until})
            renewed += 1
        else:
            errors.append(f"{s.get('url','?')[-40:]}: HTTP {status}")

    record_run(env, "websub-renew", items_seen=len(due), items_new=renewed, errors=errors[:20])
    log(f"websub-renew: {renewed}/{len(due)} of {len(srcs)} channels renewed, {len(errors)} errors")


if __name__ == "__main__":
    main()
