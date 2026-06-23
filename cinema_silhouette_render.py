#!/usr/bin/env python3
"""
Photorealistic 'back silhouette in a cinema' renderer.
A person seen from behind (head + shoulders), silhouetted against a glowing,
out-of-focus movie screen in a dark theater. Portrait orientation.

Realism techniques: out-of-focus screen content, screen light spill / bloom,
projector haze + dust motes, foreground seat rows (out of focus), rim light on
the subject, lens vignette, chromatic aberration, film grain, cinematic tone curve.
"""

import sys
import numpy as np
from scipy.ndimage import gaussian_filter, map_coordinates
from PIL import Image

seed = int(sys.argv[1]) if len(sys.argv) > 1 else 7
rng = np.random.default_rng(seed)

# ---------- canvas ----------
W, H = 1600, 2000          # 4:5 portrait
ss = 2                      # supersample for the silhouette mask
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

img = np.zeros((H, W, 3), np.float32)

def blur(a, sigma):
    if a.ndim == 3:
        return gaussian_filter(a, sigma=(sigma, sigma, 0))
    return gaussian_filter(a, sigma=sigma)

def norm(a):
    return (a - a.min()) / (a.max() - a.min() + 1e-9)

# ---------- 1. dark theater background ----------
# very dark, slightly cool, darker toward bottom & edges
base = np.array([0.015, 0.018, 0.028], np.float32)
img[:] = base
grad = norm(-(yy / H))            # brighter near top
img += (grad[..., None] * np.array([0.01, 0.012, 0.02]))

# ---------- 2. the screen (slight perspective trapezoid) ----------
sx0, sx1 = 0.10 * W, 0.90 * W
sy0, sy1 = 0.085 * H, 0.66 * H
top_inset = 26
# polygon corners (TL, TR, BR, BL)
poly = np.array([[sx0 + top_inset, sy0],
                 [sx1 - top_inset, sy0],
                 [sx1, sy1],
                 [sx0, sy1]], np.float32)

def polygon_mask(poly, W, H, ss=2):
    from PIL import ImageDraw
    m = Image.new("L", (W * ss, H * ss), 0)
    d = ImageDraw.Draw(m)
    d.polygon([(p[0] * ss, p[1] * ss) for p in poly], fill=255)
    m = m.resize((W, H), Image.LANCZOS)
    return np.asarray(m, np.float32) / 255.0

screen_mask = polygon_mask(poly, W, H, ss)

# out-of-focus cinematic movie content: a defocused colored frame (a scene, not white)
small_h, small_w = 44, 40
gy0, gx0 = np.mgrid[0:small_h, 0:small_w].astype(np.float32)
fy = gy0 / small_h                                  # 0=top, 1=bottom of screen
field = np.zeros((small_h, small_w, 3), np.float32)
# layered scene by vertical fraction: warm sky -> teal mid -> warm key band -> dim base
sky   = np.array([1.00, 0.82, 0.52])
midc  = np.array([0.34, 0.55, 0.78])
keyc  = np.array([1.00, 0.90, 0.72])
basec = np.array([0.30, 0.26, 0.30])
w_sky = np.exp(-((fy - 0.16) ** 2) / (2 * 0.16 ** 2))
w_mid = np.exp(-((fy - 0.48) ** 2) / (2 * 0.14 ** 2))
w_key = np.exp(-((fy - 0.72) ** 2) / (2 * 0.13 ** 2))   # bright band behind the head
w_base = np.clip(fy - 0.6, 0, 1)
field += (w_sky[..., None] * sky * 0.95 + w_mid[..., None] * midc * 0.70 +
          w_key[..., None] * keyc * 0.85 + w_base[..., None] * basec * 0.5)
# horizontal warmth drift
field += (0.12 * np.sin(gx0 / small_w * 2.4 + 0.5))[..., None] * np.array([0.08, 0.03, -0.02])
# scattered bokeh highlights (defocused points of light)
for _ in range(10):
    cy = rng.uniform(2, small_h - 2); cx = rng.uniform(2, small_w - 2)
    r = rng.uniform(1.6, 3.2)
    g = np.exp(-(((gy0 - cy) ** 2 + (gx0 - cx) ** 2) / (2 * r * r)))
    tint = np.array([1.0, 0.92, 0.78]) if rng.random() < 0.6 else np.array([0.7, 0.85, 1.0])
    field += g[..., None] * tint * rng.uniform(0.4, 0.9)
# a defined bright key right behind the head center (image-center, lower-middle of screen)
ky, kx = small_h * 0.70, small_w * 0.50
gc = np.exp(-(((gy0 - ky) ** 2) / (2 * 6.0 ** 2) + ((gx0 - kx) ** 2) / (2 * 9.0 ** 2)))
field += gc[..., None] * np.array([1.0, 0.95, 0.84]) * 0.7

content = np.asarray(Image.fromarray((np.clip(field, 0, 1) * 255).astype(np.uint8))
                     .resize((W, H), Image.BICUBIC), np.float32) / 255.0
content = blur(content, 13)                          # defocused but shapes & color survive
content = np.clip(content * 1.02, 0, 1.2)
# a touch more color so it clearly reads as a movie, not a blank panel
cmean = content.mean(axis=2, keepdims=True)
content = np.clip(cmean + (content - cmean) * 1.28, 0, 1.2)

img = img * (1 - screen_mask[..., None]) + content * screen_mask[..., None]

# thin dark screen frame
frame = polygon_mask(poly, W, H, ss) - polygon_mask(
    np.array([[sx0 + top_inset + 8, sy0 + 8], [sx1 - top_inset - 8, sy0 + 8],
              [sx1 - 8, sy1 - 8], [sx0 + 8, sy1 - 8]], np.float32), W, H, ss)
frame = np.clip(frame, 0, 1)
img = img * (1 - frame[..., None] * 0.9)

# ---------- 3. screen light spill into the room (bloom / ambient) ----------
bright = (content.mean(axis=2) * screen_mask)
glow = blur(bright, 70)
glow = norm(glow)
spill_color = np.array([0.62, 0.62, 0.66], np.float32)   # near-neutral, faint cool
img += glow[..., None] * spill_color * 0.30
# wide soft halo around screen (subtle)
halo = blur(screen_mask, 130)
img += halo[..., None] * np.array([0.09, 0.11, 0.16]) * 0.55

# faint projector haze cone from top toward screen
cone = np.exp(-((xx - W * 0.5) ** 2) / (2 * (W * 0.33) ** 2))
cone *= np.clip(1 - yy / (0.7 * H), 0, 1)
img += (blur(cone, 40)[..., None]) * np.array([0.06, 0.07, 0.10]) * 0.6

# ---------- 4. subject silhouette (head + shoulders, from behind) ----------
from PIL import ImageDraw
MW, MH = W * ss, H * ss
sm = Image.new("L", (MW, MH), 0)
d = ImageDraw.Draw(sm)

cx = 0.5 * W * ss
# shoulders built from a smooth top-boundary so they slope naturally to the frame edges
sh_top = 0.75 * H * ss          # shoulder line height at the outer sides
trap_peak = 0.10 * H * ss       # how much the trapezius rises toward the neck
neck_half = 0.066 * W * ss
xs = (np.arange(MW) - cx)
# top boundary: rises (in image) near the neck, slopes gently away to the sides
top_bound = sh_top - trap_peak * np.exp(-(xs ** 2) / (2 * (0.26 * W * ss) ** 2))
# fill the body region under that boundary
body = Image.new("L", (MW, MH), 0)
bd = ImageDraw.Draw(body)
pts = [(int(x), int(top_bound[x])) for x in range(0, MW, 4)]
pts = [(0, MH)] + pts + [(MW, MH)]
bd.polygon(pts, fill=255)
sm = body
d = ImageDraw.Draw(sm)
# neck: simple near-vertical column from shoulders up under the head
d.polygon([(cx - neck_half, 0.545 * H * ss), (cx + neck_half, 0.545 * H * ss),
           (cx + neck_half * 1.05, 0.70 * H * ss), (cx - neck_half * 1.05, 0.70 * H * ss)],
          fill=255)
# head: clean back-of-head oval (rounded, slight natural hair volume)
hrx, hry = 0.100 * W * ss, 0.123 * H * ss
hcy = 0.462 * H * ss
d.ellipse([cx - hrx, hcy - hry, cx + hrx, hcy + hry], fill=255)

sil = np.asarray(sm.resize((W, H), Image.LANCZOS), np.float32) / 255.0
# add a faint fuzz to the hairline edge for realism, then soften
hair_band = np.clip(blur(sil, 2.5) - sil, 0, 1)
fuzz = (rng.random((H, W)).astype(np.float32) > 0.5).astype(np.float32)
sil = np.clip(sil + hair_band * fuzz * 0.25, 0, 1)
sil = blur(sil, 1.1)        # soften edge (lens / hair fringe)

# apply silhouette: near-black, with a faint amount of the room's darkness
sil_color = np.array([0.006, 0.008, 0.014], np.float32)
img = img * (1 - sil[..., None]) + sil_color * sil[..., None]

# rim light: screen light wrapping the top/edges of head & shoulders
edge = np.clip(blur(sil, 3) - sil, 0, 1)          # outer edge band
edge = norm(edge) * (yy < 0.86 * H)               # only upper edges
rim = blur(edge, 1.5)
img += rim[..., None] * np.array([0.55, 0.66, 0.85]) * 0.5

# ---------- 5. foreground seats (out of focus, near bottom corners) ----------
seat = Image.new("L", (W, H), 0)
ds = ImageDraw.Draw(seat)
for sxc in [0.16 * W, 0.84 * W]:
    ds.rounded_rectangle([sxc - 0.16 * W, 0.84 * H, sxc + 0.16 * W, H],
                         radius=40, fill=255)
seatm = blur(np.asarray(seat, np.float32) / 255.0, 16)   # defocused
seatm = np.clip(seatm * 1.3, 0, 1)
img = img * (1 - seatm[..., None] * 0.92)
# tiny rim on seat tops
sedge = np.clip(blur(seatm, 4) - seatm, 0, 1)
img += norm(sedge)[..., None] * np.array([0.4, 0.5, 0.7]) * 0.18

# ---------- 6. dust motes in the light ----------
for _ in range(40):
    mx = rng.uniform(0.2 * W, 0.8 * W)
    my = rng.uniform(0.15 * H, 0.62 * H)
    rr = rng.uniform(0.6, 2.2)
    g = np.exp(-(((xx - mx) ** 2 + (yy - my) ** 2) / (2 * rr * rr)))
    img += g[..., None] * np.array([0.9, 0.92, 1.0]) * rng.uniform(0.05, 0.16)

# ---------- 7. photographic finishing ----------
img = np.clip(img, 0, None)

# bloom: bright areas bleed
lum = img.mean(axis=2)
hot = np.clip(lum - 0.74, 0, None)
bloom = blur(hot[..., None] * img, 16) + blur(hot[..., None] * img, 40)
img += bloom * 0.38

# cinematic tone: lift blacks slightly + soft S-curve + teal/orange grade
img = img / (1.0 + img * 0.18)                    # gentle highlight rolloff
img = np.clip(img, 0, 1)
img = img ** 0.92                                  # raise mids a touch
# split tone
shadows = (1 - img)
img += shadows * np.array([0.00, 0.015, 0.04]) * 0.6    # teal shadows
img += img * np.array([0.04, 0.015, -0.02]) * 0.5       # warm highlights
img = np.clip(img, 0, 1)

# chromatic aberration (scale R out, B in) — grows toward edges
def shift_scale(channel, s):
    cy2, cx2 = H / 2, W / 2
    ys = (yy - cy2) * s + cy2
    xs = (xx - cx2) * s + cx2
    return map_coordinates(channel, [ys, xs], order=1, mode="nearest")
R = shift_scale(img[..., 0], 1.0009)
B = shift_scale(img[..., 2], 0.9991)
img = np.stack([R, img[..., 1], B], axis=-1)

# vignette
vig = 1 - 0.55 * norm(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
img *= vig[..., None]

# film grain (luminance-dependent, slightly chunky)
g_fine = rng.normal(0, 1, (H, W, 1)).astype(np.float32)
g_coarse = blur(rng.normal(0, 1, (H, W, 1)).astype(np.float32), 1.3)
grain = (g_fine * 0.6 + g_coarse * 1.2)
amt = 0.028 * (0.5 + img.mean(axis=2, keepdims=True))   # more grain in mids/lows
img = np.clip(img + grain * amt, 0, 1)

# final micro-softness (lens)
img = blur(img, 0.5)
img = np.clip(img, 0, 1)

out = (img * 255).astype(np.uint8)
fn = f"/sessions/clever-determined-clarke/mnt/outputs/metatake_silhouette_4x5_v{seed}.jpg"
Image.fromarray(out).save(fn, quality=92, subsampling=1)
print("saved", fn, out.shape)
