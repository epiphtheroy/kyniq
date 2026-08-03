#!/usr/bin/env python3
"""film-clips — collect CLIP/SCENE videos per film (not trailers) into media.

For each film it searches the YouTube Data API for scene/clip videos, drops
trailers/teasers/reactions/spoilery results, keeps the top N embeddable clips,
and upserts them into `media` (kind='video', source='youtube', meta.type='clip').
The film hero reel already orders clips before the trailer, so these surface first.

Resumable: by default skips films that already have >= --max clip-like videos.
DRY by default (no writes); writes a preview to worker/film-clips-dry.md.

Env (repo-root .env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_SERVER_API_KEY
Usage:
  python3 film-clips.py                       # DRY: sample 8 visible films, no writes
  python3 film-clips.py --limit 8             # DRY on N films
  python3 film-clips.py --persist             # write; all visible films missing clips
  python3 film-clips.py --persist --limit 200 # cap a run (quota: ~100-200 units/film)
  python3 film-clips.py --persist --max 3     # clips per film (default 3)
  python3 film-clips.py --persist --refresh   # re-evaluate even films that already have clips
"""
import os, sys, json, time, re, html, urllib.request, urllib.parse, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT, ".env.local"))
URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
# YOUTUBE_SERVER_API_KEY first: this runs server-side and sends no HTTP referer,
# so a key restricted to "Websites (HTTP referrers)" is rejected with
# 403 "Requests from referer <empty> are blocked". Both older keys carry that
# restriction — which is why this worker had never written a single row. The
# server key is unrestricted by application but limited to YouTube Data API v3.
YT = (os.environ.get("YOUTUBE_SERVER_API_KEY")
      or os.environ.get("YOUTUBE_API_KEY")
      or os.environ.get("YOUTUBE_DATA_API_KEY"))

args = sys.argv[1:]
PERSIST = "--persist" in args
REFRESH = "--refresh" in args
SCOPE = args[args.index("--scope") + 1] if "--scope" in args else "visible"  # visible | all
MAX = int(args[args.index("--max") + 1]) if "--max" in args else 3
LIMIT = int(args[args.index("--limit") + 1]) if "--limit" in args else (8 if not PERSIST else 100000)

if not (URL and KEY):
    sys.exit("Missing NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local")
if not YT:
    sys.exit("Missing YOUTUBE_SERVER_API_KEY (or YOUTUBE_API_KEY / YOUTUBE_DATA_API_KEY) in .env.local — required for clip search.")

# ── filters / scoring (mirrors the existing curator) ───────────────
TRAILERISH = re.compile(r"\btrailer\b|\bteaser\b", re.I)
SPOILER = ["ending explained", "ending scene", "death scene", "dies", "final scene",
           "twist ending", "shocking ending", "who killed", "full movie", "all deaths",
           "reaction", "first time watching", "reacting to", "explained", "recap", "review",
           "behind the scenes", "bloopers", "interview", "press", "spoiler"]

# Titles that are technically "scenes" but are not what a film page should show:
# titillation cuts, compilations, and fan re-edits. Observed on 2026-08-03 —
# "Thelma(2017) Lesbian movie/kiss scene" scored 0.7 purely on the word "scene".
JUNK_PHRASES = ["kiss scene", "kissing scene", "sex scene", "love scene", "hot scene",
                "bed scene", "shower scene", "romantic scene", "seduction",
                "best moments", "best scenes", "all scenes", "every scene", "funniest",
                "top 10", "top 5", "compilation", "fan edit", "fan made", "fanmade",
                "whatsapp status", "full hd movie", "watch online", "movie in hindi",
                # Commentary about a film is not a clip from it. Both observed in
                # the first --persist run: a "How to Shoot a Film Scene" essay and
                # a viewer's own "all time fave scenes" cut.
                "video essay", "how to shoot", "analysis", "breakdown", "deconstruct",
                "cinematography of", "favorite scenes", "fave scenes", "my all time",
                "parallels"]
# Single words too risky as substrings ("edit" sits inside "edition"/"editor"),
# so they need word boundaries. Deliberately NOT here: "hot" and "uncut" — they
# would swallow every clip from Hot Fuzz and Uncut Gems. The salacious sense is
# already caught by the phrase list above.
JUNK_WORDS = re.compile(r"\b(?:edit|edits|amv|tribute|slowed|reverb|shorts|tiktok|"
                        r"status|nude|nudity)\b", re.I)
# Channels that repost other people's clips or farm engagement. Matched as
# substrings on the channel name, so each entry must be distinctive — a bare
# "fan" would also hit "Fandango".
JUNK_CHANNELS = ["kissing", "kiss mood", "romance", "hot scenes", "status", "shorts",
                 "edits", "fan edit", "fanmade", "tribute", "movie world", "cinema world"]

CLIP_CHANNELS = ["movieclips", "binge society", "rotten tomatoes clips", "screen bites",
                 "movieclips classic trailers",  # classic trailers excluded by TRAILERISH on title
                 "joblo movie clips", "scene city"]
# Distributors and arthouse labels post their own clips; prefer them over a
# re-upload of the same file by an aggregator (observed: Bleecker Street's
# "Hard Truths | Official Clip" mirrored by "HeadsUp Trailers").
DISTRIBUTORS = ["mubi", "a24", "criterion", "neon", "bleecker street", "focus features",
                "searchlight", "studiocanal", "ifc films", "sony pictures classics",
                "janus films", "kino lorber", "magnolia pictures", "curzon", "park circus",
                "lionsgate", "1091 pictures", "altitude", "vertigo releasing"]

MIN_SCORE = 0.6  # base 0.5 + at least one positive signal; junk channels fall below

def norm(s): return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()

def title_matches(film_title, vid_title):
    ft = norm(film_title); vt = norm(vid_title)
    if not ft: return True
    if ft in vt: return True
    words = [w for w in ft.split() if len(w) > 3]
    if not words: words = ft.split()
    hit = sum(1 for w in words if w in vt)
    return hit >= max(1, len(words) // 2)

PAREN_YEAR = re.compile(r"\((\d{4})\)")


def year_conflicts(film_title, film_year, vid_title):
    """True when the video announces a release year that is not this film's.

    Remakes share a title, so title matching alone put "The Color Purple (2023)"
    on the 1985 film's page (observed 2026-08-03). Only parenthesised years count
    as a release-year claim — a bare 4-digit run is usually part of the title
    itself (Blade Runner 2049, 1917, 2001: A Space Odyssey), and reading those as
    years would reject every legitimate clip for those films.
    """
    if not film_year:
        return False
    claimed = {int(y) for y in PAREN_YEAR.findall(vid_title or "")}
    claimed -= {int(y) for y in re.findall(r"\d{4}", film_title or "")}
    if not claimed:
        return False
    return not any(abs(y - int(film_year)) <= 1 for y in claimed)


def score_clip(title, channel):
    t = title.lower(); ch = (channel or "").lower(); s = 0.5
    if any(c in ch for c in CLIP_CHANNELS): s += 0.3
    if any(c in ch for c in DISTRIBUTORS): s += 0.3
    if "scene" in t or "clip" in t: s += 0.2
    if "official" in t and ("clip" in t or "scene" in t): s += 0.1
    if len(title) < 10: s -= 0.2
    # A repost farm cancels out the "scene"/"clip" bonus and drops below MIN_SCORE,
    # so junk cannot ride in on the one word it shares with a real clip.
    if any(c in ch for c in JUNK_CHANNELS): s -= 0.4
    return max(0.0, min(1.0, s))


def dedupe_title(title):
    """Collapse a title to its identity so re-uploads of one clip cluster together.

    Two hits with the same normalised title are the same clip in practice —
    either a duplicate upload or an aggregator mirroring a distributor's file.
    Keeping the higher-scored one means the official channel wins.
    """
    return re.sub(r"\b(hd|4k|1080p|720p|official|now streaming|movie|film)\b", " ",
                  norm(title)).strip()

def iso_to_sec(iso):
    m = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso or "")
    if not m: return 0
    h, mn, sc = (int(x) if x else 0 for x in m.groups())
    return h * 3600 + mn * 60 + sc

# ── http ───────────────────────────────────────────────────────────
def http(method, url, headers=None, body=None, timeout=60):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data)
    if data is not None: req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items(): req.add_header(k, v)
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.status, json.loads(r.read().decode() or "null")
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and attempt < 4:
                time.sleep(2 ** attempt); continue
            return e.code, json.loads(e.read().decode() or "null")
        except Exception:
            if attempt < 4: time.sleep(2 ** attempt); continue
            raise
    return 0, None

SB = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
def sb_get(path):
    st, j = http("GET", f"{URL}/rest/v1/{path}", headers=SB)
    return j if st < 300 and isinstance(j, list) else []
def sb_upsert(rows):
    st, j = http("POST", f"{URL}/rest/v1/media?on_conflict=entity_type,entity_id,source,external_id",
                 headers={**SB, "Prefer": "resolution=merge-duplicates,return=minimal"}, body=rows)
    return st < 300, (j if st >= 300 else None)

YT_UNITS = 0
def yt_search(q):
    global YT_UNITS
    qs = urllib.parse.urlencode({"part": "snippet", "q": q, "type": "video", "videoEmbeddable": "true",
                                 "maxResults": "12", "safeSearch": "none", "order": "relevance", "key": YT})
    st, j = http("GET", f"https://www.googleapis.com/youtube/v3/search?{qs}")
    YT_UNITS += 100
    if st >= 300: return [], (j or {}).get("error", {}).get("message", f"http {st}")
    items = []
    for it in (j or {}).get("items", []):
        vid = (it.get("id") or {}).get("videoId"); sn = it.get("snippet") or {}
        if vid: items.append({"id": vid, "title": html.unescape(sn.get("title", "")), "channel": html.unescape(sn.get("channelTitle", "")),
                              "thumb": (((sn.get("thumbnails") or {}).get("high") or {}).get("url"))})
    return items, None
def yt_details(ids):
    global YT_UNITS
    if not ids: return {}
    qs = urllib.parse.urlencode({"part": "contentDetails,status", "id": ",".join(ids), "key": YT})
    st, j = http("GET", f"https://www.googleapis.com/youtube/v3/videos?{qs}")
    YT_UNITS += 1
    out = {}
    for it in (j or {}).get("items", []):
        out[it["id"]] = {"sec": iso_to_sec((it.get("contentDetails") or {}).get("duration", "")),
                         "embeddable": (it.get("status") or {}).get("embeddable", False)}
    return out

def pick_clips(film):
    title, year = film["title"], film.get("year")
    queries = [f"{title} {year} scene".strip(), f"{title} movie clip"]
    cand, seen = [], set()
    for q in queries:
        items, err = yt_search(q)
        if err: return [], err
        for v in items:
            if v["id"] in seen: continue
            if TRAILERISH.search(v["title"]): continue
            low = v["title"].lower()
            if any(k in low for k in SPOILER): continue
            if any(k in low for k in JUNK_PHRASES): continue
            if JUNK_WORDS.search(v["title"]): continue
            if not title_matches(title, v["title"]): continue
            if year_conflicts(title, year, v["title"]): continue
            score = score_clip(v["title"], v["channel"])
            if score < MIN_SCORE: continue
            seen.add(v["id"]); v["score"] = score; cand.append(v)
        if len(cand) >= MAX * 2: break  # enough; save quota
    # verify embeddable + sane duration
    det = yt_details([v["id"] for v in cand])
    good = []
    for v in cand:
        d = det.get(v["id"]) or {}
        if not d.get("embeddable"): continue
        if not (15 <= d["sec"] <= 600): continue
        good.append(v)
    # Sort BEFORE collapsing duplicates so the best copy of a re-uploaded clip
    # is the one that survives.
    good.sort(key=lambda v: v["score"], reverse=True)
    out, titles = [], set()
    for v in good:
        key = dedupe_title(v["title"])
        if key in titles: continue
        titles.add(key); out.append(v)
    return out[:MAX], None

# ── films ──────────────────────────────────────────────────────────
scope = "&visible=eq.true" if SCOPE == "visible" else ""
films = sb_get(f"films?select=id,slug,title,year{scope}&order=id&limit={LIMIT*3 if not PERSIST else 100000}")
print(f"▶ film-clips {'PERSIST' if PERSIST else 'DRY'} — scope={SCOPE} max={MAX} candidates={len(films)}")

processed = 0; written = 0; preview = []
for f in films:
    if processed >= LIMIT: break
    # existing videos for this film
    existing = sb_get(f"media?select=external_id,title,position&entity_type=eq.film&entity_id=eq.{f['id']}&kind=eq.video")
    have_ids = {m["external_id"] for m in existing}
    clip_count = sum(1 for m in existing if m.get("title") and not TRAILERISH.search(m["title"]))
    if clip_count >= MAX and not REFRESH:
        continue
    clips, err = pick_clips(f)
    if err:
        print(f"  ! {f['slug']}: {err}")
        if "quota" in (err or "").lower(): print("  ⚠ quota exhausted — stop and resume tomorrow / raise quota."); break
        processed += 1; continue
    new = [c for c in clips if c["id"] not in have_ids]
    processed += 1
    if not new:
        continue
    base_pos = (max([m.get("position") or 0 for m in existing], default=0) + 1)
    preview.append({"film": f["slug"], "title": f["title"], "clips": [{"t": c["title"], "id": c["id"], "ch": c["channel"], "score": round(c["score"], 2)} for c in new]})
    print(f"  ✓ {f['slug']}: +{len(new)} clip(s)" + "".join(f"\n      · {c['title']}  [{c['channel']}]  {round(c['score'],2)}" for c in new))
    if PERSIST:
        rows = [{
            "entity_type": "film", "entity_id": f["id"], "kind": "video", "source": "youtube",
            "external_id": c["id"], "url": f"https://www.youtube.com/watch?v={c['id']}",
            "thumbnail_url": c.get("thumb"), "title": c["title"], "channel_name": c["channel"],
            "position": base_pos + i, "added_by": "ai", "confidence": c["score"],
            "status": "published", "meta": {"query": "clip", "score": c["score"], "type": "clip", "by": "clip-worker"},
        } for i, c in enumerate(new)]
        ok, e = sb_upsert(rows)
        if ok: written += len(rows)
        else:
            print(f"      ✗ upsert failed: {e}")
            sys.exit("⛔ Aborting immediately so YouTube quota isn't wasted on a systemic write error. Fix and rerun.")
    time.sleep(0.2)

print(f"\n— processed {processed} film(s) · clips {'written' if PERSIST else 'found'}: {written if PERSIST else sum(len(p['clips']) for p in preview)} · YouTube units used: {YT_UNITS}")
if not PERSIST:
    est_per_film = YT_UNITS / max(processed, 1)
    print(f"— est. ~{est_per_film:.0f} units/film → ~{est_per_film*1900:.0f} units for ~1,900 films (default daily quota 10,000 ≈ {10000/max(est_per_film,1):.0f} films/day).")
    with open(os.path.join(HERE, "film-clips-dry.md"), "w", encoding="utf-8") as fh:
        fh.write(f"# film-clips DRY — {len(preview)} films with new clips\n\n")
        for p in preview:
            fh.write(f"## {p['title']} (`{p['film']}`)\n")
            for c in p["clips"]:
                fh.write(f"- **{c['t']}** — {c['ch']} · score {c['score']} · `{c['id']}`\n")
            fh.write("\n")
    print(f"— preview written: worker/film-clips-dry.md")
print("✅ done.")
