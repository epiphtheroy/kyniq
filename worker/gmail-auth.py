#!/usr/bin/env python3
"""worker/gmail-auth.py — one-time Gmail OAuth refresh-token minter (§5-6-A).

Runs on the operator's Mac. Opens a loopback OAuth flow, prints the refresh
token to paste into .env.local (GMAIL_REFRESH_TOKEN) and the Vercel project env.

Prereqs (GCP console, once):
  1. New project → enable Gmail API.
  2. OAuth consent screen: External, add your sending account as a test user,
     then PUBLISH APP → In production (⚠️ Testing status expires refresh tokens
     after 7 days — HANDOFF-CRM §5-6-A / §10-17).
  3. Create an OAuth client of type "Desktop app".
Set env before running (or pass as args):
  GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET

Scopes: gmail.compose (covers drafts create + drafts.send) + gmail.readonly.
stdlib only.
Usage:  python3 worker/gmail-auth.py
"""
from __future__ import annotations

import os
import sys
import json
import http.server
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SCOPES = "https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.readonly"
REDIRECT = "http://localhost:8765/"
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"


def env_val(key: str) -> str | None:
    v = os.environ.get(key)
    if v:
        return v
    f = REPO / ".env.local"
    if f.exists():
        for line in f.read_text().splitlines():
            line = line.strip()
            if line.startswith(key + "="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


_code_holder: dict[str, str] = {}


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        qs = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(qs)
        _code_holder["code"] = params.get("code", [""])[0]
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(b"<h3>Gmail authorized. You can close this tab and return to the terminal.</h3>")

    def log_message(self, *_):  # silence
        pass


def main() -> int:
    client_id = env_val("GMAIL_CLIENT_ID")
    client_secret = env_val("GMAIL_CLIENT_SECRET")
    if not client_id or not client_secret:
        print("Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET (env or .env.local) first.")
        return 1

    auth = AUTH_URL + "?" + urllib.parse.urlencode({
        "client_id": client_id, "redirect_uri": REDIRECT, "response_type": "code",
        "scope": SCOPES, "access_type": "offline", "prompt": "consent",
    })
    print("Opening browser for Google consent…")
    print(auth)
    webbrowser.open(auth)

    srv = http.server.HTTPServer(("localhost", 8765), Handler)
    srv.handle_request()  # serve exactly one request (the redirect)
    code = _code_holder.get("code")
    if not code:
        print("No auth code received.")
        return 1

    body = urllib.parse.urlencode({
        "code": code, "client_id": client_id, "client_secret": client_secret,
        "redirect_uri": REDIRECT, "grant_type": "authorization_code",
    }).encode()
    req = urllib.request.Request(TOKEN_URL, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req) as r:
        tok = json.loads(r.read())

    refresh = tok.get("refresh_token")
    if not refresh:
        print("No refresh_token returned. Ensure prompt=consent and access_type=offline (and revoke prior grant if re-running).")
        print(json.dumps(tok, indent=2))
        return 1

    print("\n✅ Success. Add this to .env.local AND the Vercel project env:\n")
    print(f"GMAIL_REFRESH_TOKEN={refresh}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
