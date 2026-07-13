#!/usr/bin/env python3
"""Render Chrome Web Store assets for the Metatake extension via headless Chrome."""
import os, subprocess, base64

ROOT = "/Users/jerryje/Documents/MetaTake"
OUT = os.path.join(ROOT, "extension", "store")
SRC = "/Users/jerryje/.claude/jobs/0753993c/tmp/store_src"
os.makedirs(OUT, exist_ok=True); os.makedirs(SRC, exist_ok=True)
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

logo_b64 = base64.b64encode(open(os.path.join(ROOT, "public/icon-512.png"), "rb").read()).decode()
LOGO = f"data:image/png;base64,{logo_b64}"

CSS = """
*{margin:0;padding:0;box-sizing:border-box;-webkit-font-smoothing:antialiased}
html,body{width:%(w)dpx;height:%(h)dpx;overflow:hidden}
body{background:#0b0d12;background:radial-gradient(1200px 700px at 82%% 88%%,rgba(15,118,110,.28),transparent 60%%),linear-gradient(135deg,#0c0e13,#15171d 70%%);
  font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#e8eaed;position:relative}
.wm{display:flex;align-items:center;gap:12px}
.wm img{width:%(logo)dpx;height:%(logo)dpx;border-radius:%(lr)dpx}
.wm b{font-family:Georgia,'Times New Roman',serif;font-weight:700;letter-spacing:.2px}
.badge{display:inline-flex;align-items:center;gap:.6em;text-decoration:none;background:#16181d;border:1px solid rgba(255,255,255,.16);
  border-radius:14px;box-shadow:0 10px 34px rgba(0,0,0,.5)}
.badge .n{font-weight:800;color:#2dd4bf}
.badge .b{display:flex;flex-direction:column;gap:3px;line-height:1.15}
.badge .b .t{color:#f1f5f9;font-weight:700}
.badge .b .s{color:#9aa2af;font-weight:500}
.wmk{color:#df1b1b;font-weight:800}
.muted{color:#9aa2af}
"""

def badge(scale=1.0, score=52):
    fs = 13*scale
    return f"""<div class="badge" style="gap:.6em;padding:{.7*scale}em {1*scale}em;font-size:{fs}px">
      <span class="n" style="font-size:{26*scale}px">{score}</span>
      <span class="b"><span class="t" style="font-size:{fs}px">TakeScore</span>
      <span class="s" style="font-size:{fs-1.5}px">on <span class="wmk">Metatake</span> — read the criticism &rarr;</span></span></div>"""

def page(w, h, logo, lr, inner, extra=""):
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{CSS % dict(w=w,h=h,logo=logo,lr=lr)}{extra}</style></head><body>{inner}</body></html>"""

# ---- Screenshot 1: hero (1280x800) ----
hero = page(1280,800,64,14, f"""
<div style="position:absolute;inset:0;padding:74px 80px;display:flex;flex-direction:column">
  <div class="wm"><img src="{LOGO}"><b style="font-size:26px">Metatake</b></div>
  <div style="margin:auto 0;max-width:820px">
    <h1 style="font-family:Georgia,serif;font-size:60px;line-height:1.08;font-weight:700;letter-spacing:-.5px">The critical read<br>on every film.</h1>
    <p class="muted" style="font-size:23px;margin-top:22px;line-height:1.5;max-width:680px">Metatake&rsquo;s TakeScore and human-curated criticism, right on the film pages you already browse.</p>
    <div style="margin-top:40px;transform-origin:left">{badge(1.5,52)}</div>
  </div>
  <div class="muted" style="font-size:16px;letter-spacing:.3px">Works on&nbsp;&nbsp;Letterboxd&nbsp;&middot;&nbsp;IMDb&nbsp;&middot;&nbsp;TMDB&nbsp;&middot;&nbsp;Rotten Tomatoes&nbsp;&middot;&nbsp;Wikipedia</div>
</div>""")

# ---- Screenshot 2: in-context demo (1280x800) ----
insitu = page(1280,800,44,10, f"""
<div style="position:absolute;top:26px;left:0;right:0;text-align:center" class="muted">
  <span style="font-size:16px;background:rgba(255,255,255,.06);padding:8px 16px;border-radius:999px">The badge appears automatically on the film page you&rsquo;re viewing</span></div>
<div style="position:absolute;inset:96px 90px 90px;display:flex;gap:44px;align-items:flex-start">
  <div style="width:300px;height:450px;border-radius:12px;flex:0 0 auto;
    background:linear-gradient(160deg,#3a2f3f,#20222b);border:1px solid rgba(255,255,255,.08);
    display:flex;align-items:center;justify-content:center"><span class="muted" style="font-size:15px">poster</span></div>
  <div style="padding-top:10px">
    <div class="wm" style="margin-bottom:26px"><img src="{LOGO}"><b style="font-size:19px">Metatake</b></div>
    <h1 style="font-family:Georgia,serif;font-size:46px;font-weight:700">Mulholland Drive <span class="muted" style="font-weight:400">(2001)</span></h1>
    <p class="muted" style="font-size:20px;margin-top:10px">directed by David&nbsp;Lynch</p>
    <p style="color:#c4c8d0;font-size:18px;line-height:1.6;margin-top:26px;max-width:520px">An actress longing to be a star. A woman searching for herself. Both worlds will collide on Mulholland Drive&hellip;</p>
  </div>
</div>
<div style="position:absolute;right:34px;bottom:34px;transform:scale(1.25);transform-origin:bottom right">{badge(1,52)}</div>""")

# ---- Small promo tile (440x280) ----
small = page(440,280,46,10, f"""
<div style="position:absolute;inset:0;padding:30px 32px;display:flex;flex-direction:column;justify-content:space-between">
  <div class="wm"><img src="{LOGO}"><b style="font-size:20px">Metatake</b></div>
  <div>
    <div style="font-family:Georgia,serif;font-size:27px;font-weight:700;line-height:1.15">TakeScore on<br>every film page</div>
    <div class="muted" style="font-size:13.5px;margin-top:10px">Letterboxd &middot; IMDb &middot; TMDB &middot; RT</div>
  </div>
  <div style="align-self:flex-start;transform:scale(.92);transform-origin:left bottom">{badge(1,52)}</div>
</div>""")

# ---- Marquee promo tile (1400x560) ----
marquee = page(1400,560,80,18, f"""
<div style="position:absolute;inset:0;padding:70px 88px;display:flex;align-items:center;justify-content:space-between;gap:60px">
  <div style="max-width:720px">
    <div class="wm" style="margin-bottom:34px"><img src="{LOGO}"><b style="font-size:30px">Metatake</b></div>
    <h1 style="font-family:Georgia,serif;font-size:62px;line-height:1.06;font-weight:700;letter-spacing:-.5px">The critical read<br>on every film.</h1>
    <p class="muted" style="font-size:22px;margin-top:22px;line-height:1.5">TakeScore &amp; human-curated criticism, right where you browse.</p>
  </div>
  <div style="transform:scale(1.7);transform-origin:center right;flex:0 0 auto">{badge(1,52)}</div>
</div>""")

jobs = [("screenshot-1-hero", 1280, 800, hero),
        ("screenshot-2-in-context", 1280, 800, insitu),
        ("promo-small-440x280", 440, 280, small),
        ("promo-marquee-1400x560", 1400, 560, marquee)]

for name, w, h, html in jobs:
    src = os.path.join(SRC, name + ".html"); open(src, "w").write(html)
    png = os.path.join(SRC, name + ".png")
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--force-device-scale-factor=1", "--allow-file-access-from-files",
        f"--window-size={w},{h}", f"--screenshot={png}", "file://" + src],
        capture_output=True, timeout=60)
    # exact size + flatten to opaque JPEG (store requires no alpha)
    subprocess.run(["sips", "-z", str(h), str(w), png], capture_output=True)
    jpg = os.path.join(OUT, name + ".jpg")
    subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "92", png, "--out", jpg], capture_output=True)
    dim = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", jpg], capture_output=True, text=True).stdout
    print(name, "->", os.path.basename(jpg), "|", " ".join(x.split(":")[-1].strip() for x in dim.strip().splitlines()[1:]))
