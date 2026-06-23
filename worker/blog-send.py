#!/usr/bin/env python3
"""Blog newsletter sender — "Between Film and the World" via Resend.

Renders a published edition (posts row) to email-safe HTML and sends it to the
active newsletter_subscribers. Same house design as /blog: one red, hairlines,
colour film backdrops, "retrieved, not remembered."

SECRETS via env (loaded from ../.env.local — never commit it):
  NEXT_PUBLIC_SUPABASE_URL , SUPABASE_SERVICE_ROLE_KEY  (read posts + private subscriber list)
  RESEND_API_KEY                                        (send; from a verified metatake.net domain)

SAFETY: DRY by default — renders a preview file + prints who WOULD receive it, sends to NO ONE.
  python3 blog-send.py                      # DRY: preview latest edition + recipient count
  python3 blog-send.py --slug 2026-06-18    # DRY for a specific edition
  python3 blog-send.py --test you@you.com   # send ONE real test to you
  python3 blog-send.py --send               # REAL blast to all active subscribers
  python3 blog-send.py --send --force       # resend an edition already marked sent_at
  python3 blog-send.py --send --slug 2026-06-18
Sender domain must be verified in Resend first (DNS), or sends 403.
"""
import os, sys, json, re, time, datetime, urllib.request, urllib.error
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)

def load_env(p):
    if not os.path.exists(p): return
    for raw in open(p, encoding="utf-8-sig"):   # utf-8-sig strips a BOM on line 1
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line: continue
        if line.lower().startswith("export "): line = line[7:].lstrip()
        k, _, v = line.partition("=")
        k = k.strip(); v = v.strip().strip('"').strip("'")
        if k: os.environ.setdefault(k, v)
load_env(os.path.join(ROOT, ".env.local"))
load_env(os.path.join(ROOT, ".env"))            # fallback if keys live in .env
URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
RESEND = os.environ.get("RESEND_API_KEY")
if not (URL and KEY): print("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); sys.exit(1)

args = sys.argv[1:]
SEND = "--send" in args
FORCE = "--force" in args
TEST = args[args.index("--test") + 1] if "--test" in args else None
SLUG = args[args.index("--slug") + 1] if "--slug" in args else None
SITE = "https://metatake.net"
FROM = os.environ.get("BLOG_FROM", "Metatake <wonwoo@metatake.net>")
REPLYTO = "wonwoo@metatake.net"

def http(method, url, headers=None, body=None, timeout=60):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:600]
def sb(method, path, body=None, prefer=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    if prefer: h["Prefer"] = prefer
    return http(method, f"{URL}/rest/v1/{path}", h, body)

def esc(s):
    return (str(s or "")).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
def absln(html):  # make /relative links absolute for email clients
    return re.sub(r'href="/', f'href="{SITE}/', html or "")
def stars(n):
    n = max(0, min(5, int(n or 0)))
    return "★" * n + "☆" * (5 - n)
def pretty(d):
    try: return datetime.date.fromisoformat(d).strftime("%A, %B %-d, %Y")
    except Exception: return d

IMG = "https://image.tmdb.org/t/p/w500"

def render(post):
    e_html = []
    for e in (post.get("entries") or []):
        bd = e.get("bd")
        thumb = (f'<tr><td style="padding:0 0 12px"><img src="{IMG}{bd}" width="552" alt="{esc(e.get("film_title"))}"'
                 f' style="display:block;width:100%;max-width:552px;height:auto;border:1px solid #D8D8D8"></td></tr>') if bd else ""
        e_html.append(f"""
        <tr><td style="padding:22px 0 0;border-top:1px solid #D8D8D8">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tbody>
            {thumb}
            <tr><td style="font-family:Georgia,serif;font-size:21px;font-weight:700;line-height:1.25;color:#0D0D0D;padding:0 0 8px">
              {e.get('rank')}. {esc(e.get('ehead'))}</td></tr>
            <tr><td style="font-family:Arial,sans-serif;font-size:12.5px;color:#6B6B6B;padding:0 0 12px">
              <b style="color:#0D0D0D">{esc(e.get('event'))}</b> &rarr;
              <a href="{SITE}/film/{esc(e.get('film_slug'))}" style="color:#E3120B;font-weight:700;text-decoration:none">{esc(e.get('film_title'))}</a>
              <span style="color:#E3120B;letter-spacing:1px">{stars(e.get('stars'))}</span></td></tr>
            <tr><td style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#2A2A2A;padding:0 0 12px">{absln(e.get('news'))}</td></tr>
            <tr><td style="padding:0 0 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tbody><tr>
              <td style="width:3px;background:#E3120B"></td>
              <td style="padding:0 0 0 14px;font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#0D0D0D">{absln(e.get('read'))}</td>
            </tr></tbody></table></td></tr>
            <tr><td style="background:#FBFAF7;border-left:3px solid #E3120B;padding:10px 14px;font-family:Arial,sans-serif;font-size:13px;line-height:1.5;color:#2A2A2A">
              <span style="color:#E3120B;font-weight:700">&rarr; </span>{absln(e.get('deposit'))}</td></tr>
          </tbody></table>
        </td></tr>""")
    floor = post.get("floor") or []
    floor_html = ""
    if floor:
        lis = "".join(f'<li style="padding:7px 0;border-bottom:1px dashed #D8D8D8;font-size:14px;color:#6B6B6B">{absln(f.get("html"))} <span style="color:#E3120B;font-weight:700;font-size:11px;text-transform:uppercase">Cut</span></li>' for f in floor)
        floor_html = (f'<tr><td style="padding:24px 0 0"><div style="font-family:Arial,sans-serif;font-size:12px;font-weight:700;'
                      f'letter-spacing:.1em;text-transform:uppercase;color:#0D0D0D;padding:0 0 6px">On the cutting-room floor</div>'
                      f'<ul style="margin:0;padding:0;list-style:none">{lis}</ul></td></tr>')
    return f"""<!doctype html><html><body style="margin:0;background:#f2f1ec;padding:24px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tbody><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid #D8D8D8">
<tbody>
  <tr><td style="padding:26px 24px 0">
    <div style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#E3120B">Metatake&apos;s daily · the wire, read as a film</div>
    <h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.1;letter-spacing:-.02em;margin:8px 0 6px;color:#0D0D0D">Between Film and the World</h1>
    <div style="font-family:Georgia,serif;font-style:italic;font-size:16px;color:#2A2A2A;margin:0 0 6px">{esc(post.get('dek'))}</div>
    <div style="font-family:Arial,sans-serif;font-size:12px;color:#6B6B6B;border-top:1px solid #D8D8D8;border-bottom:1px solid #D8D8D8;padding:10px 0;margin:8px 0 0">{pretty(post.get('edition_date'))} · {post.get('read_min',6)} min read · The Metatake desk</div>
  </td></tr>
  <tr><td style="padding:18px 24px 0;font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#2A2A2A">{absln(post.get('intro'))}</td></tr>
  <tr><td style="padding:6px 24px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tbody>{''.join(e_html)}{floor_html}</tbody></table></td></tr>
  <tr><td style="padding:22px 24px 0;font-family:Arial,sans-serif;font-size:12.5px;line-height:1.6;color:#6B6B6B;border-top:1px solid #0D0D0D;margin-top:10px">
    Each event was reduced to a figure, then matched against the live Metatake corpus — every film and reading was confirmed before linking. <b style="color:#E3120B">Retrieved, not remembered.</b></td></tr>
  <tr><td style="padding:20px 24px 30px;font-family:Arial,sans-serif;font-size:12px;color:#9A9A9A">
    <a href="{SITE}/blog/{esc(post.get('slug'))}" style="color:#E3120B;font-weight:600;text-decoration:none">Read this edition online →</a><br><br>
    You&apos;re getting this because you subscribed at metatake.net. To unsubscribe, reply with &ldquo;unsubscribe&rdquo;.<br>
    © 2026 Metatake · Seoul, Republic of Korea</td></tr>
</tbody></table></td></tr></tbody></table></body></html>"""

RESEND_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"
def resend_send(items):
    # Resend's edge (Cloudflare) 403/1010-bans the default python-urllib UA — send a browser-like one.
    st, tx = http("POST", "https://api.resend.com/emails/batch",
                  headers={"Authorization": f"Bearer {RESEND}", "User-Agent": RESEND_UA, "Accept": "application/json"},
                  body=items)
    return st, tx

def main():
    print(f"env: SUPABASE_URL={'set' if URL else 'MISSING'} · SERVICE_KEY={'set' if KEY else 'MISSING'} · "
          f"RESEND_API_KEY={('set(len '+str(len(RESEND))+', starts '+RESEND[:3]+'…)') if RESEND else 'MISSING'}")
    q = f"posts?status=eq.published&select=*&order=edition_date.desc&limit=1"
    if SLUG: q = f"posts?slug=eq.{SLUG}&status=eq.published&select=*&limit=1"
    st, tx = sb("GET", q)
    rows = json.loads(tx) if st == 200 else []
    if not rows: print(f"No published edition found ({'slug '+SLUG if SLUG else 'latest'})."); sys.exit(1)
    post = rows[0]
    subject = f"Between Film and the World — {pretty(post['edition_date'])}"
    html = render(post)
    preview = os.path.join(HERE, "blog-email-preview.html")
    open(preview, "w", encoding="utf-8").write(html)

    st, tx = sb("GET", "newsletter_subscribers?status=eq.active&select=email&limit=20000")
    subs = [r["email"] for r in (json.loads(tx) if st == 200 else []) if r.get("email")]

    print(f"Edition : {post['slug']}  ({pretty(post['edition_date'])})")
    print(f"Subject : {subject}")
    print(f"Entries : {len(post.get('entries') or [])}   Subscribers (active): {len(subs)}")
    print(f"Preview : {preview}")
    if post.get("sent_at"): print(f"NOTE    : already sent at {post['sent_at']} (count {post.get('sent_count')})")

    if not (SEND or TEST):
        print("\nDRY run — no email sent. Open the preview, then:")
        print("  • test one:  python3 blog-send.py --test you@you.com")
        print("  • send all:  python3 blog-send.py --send")
        return
    if not RESEND: print("\nMissing RESEND_API_KEY in .env.local — cannot send."); sys.exit(1)

    if TEST:
        st, tx = resend_send([{ "from": FROM, "to": [TEST], "subject": "[TEST] " + subject, "html": html, "reply_to": REPLYTO }])
        print(f"\nTest → {TEST}: {st} {tx[:200]}")
        return

    # --send
    if post.get("sent_at") and not FORCE:
        print("\nThis edition is already marked sent. Re-run with --force to send again."); sys.exit(1)
    if not subs: print("\nNo active subscribers."); return
    hdr = {"List-Unsubscribe": f"<mailto:{REPLYTO}?subject=unsubscribe>"}
    ok = 0; fail = 0
    for i in range(0, len(subs), 100):
        chunk = subs[i:i+100]
        items = [{ "from": FROM, "to": [a], "subject": subject, "html": html, "reply_to": REPLYTO, "headers": hdr } for a in chunk]
        st, tx = resend_send(items)
        if st in (200, 201): ok += len(chunk); print(f"  batch {i//100+1}: sent {len(chunk)} ✓")
        else: fail += len(chunk); print(f"  batch {i//100+1}: FAILED {st} {tx[:200]}")
        time.sleep(0.6)
    print(f"\nSent {ok}/{len(subs)} (failed {fail}).")
    if ok and not fail:
        sb("PATCH", f"posts?slug=eq.{post['slug']}", {"sent_at": datetime.datetime.utcnow().isoformat() + "Z", "sent_count": ok}, prefer="return=minimal")
        print("Marked edition sent_at.")

if __name__ == "__main__":
    main()
