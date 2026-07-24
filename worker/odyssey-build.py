#!/usr/bin/env python3
"""Odyssey cartography compiler.

Compiles the extracted Tier-1 corpus (worker/odyssey-extract.py) plus the
editorial overrides file into the static map artifacts served by /odyssey:

  public/odyssey/map.v1.json    stations + lines + bands + era scale
  public/odyssey/avail.v1.json  slug -> streaming providers (KR/US)

The map is a fixed, versioned artifact: same inputs -> same coordinates.
Personalization (seen films, subscriptions) is a client-side overlay.

Usage: python3 worker/odyssey-build.py <data_dir>
"""
import hashlib, json, os, sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "worker", "odyssey_data")
OUT = os.path.join(ROOT, "public", "odyssey")
OVERRIDES = os.path.join(ROOT, "worker", "odyssey_overrides.json")

def load(name):
    with open(os.path.join(DATA, name)) as f:
        return json.load(f)

films = load("films.json")
hubs = load("hubs.json")
film_hub = load("film_hub.json")
codex = load("codex.json")
prestige_rows = load("prestige.json")
avail_rows = load("avail.json")
mapxy_rows = load("mapxy.json") if os.path.exists(os.path.join(DATA, "mapxy.json")) else []
ov = json.load(open(OVERRIDES)) if os.path.exists(OVERRIDES) else {}

by_tmdb = {f["tmdb_id"]: f for f in films}
by_slug = {f["slug"]: f for f in films}
by_id = {f["id"]: f for f in films}

# ---------------------------------------------------------------- membership
htype = {h["hub_slug"]: h["hub_type"] for h in hubs}
country_of = {}
movement_members = defaultdict(list)
for r in film_hub:
    f = by_tmdb.get(r["tmdb_id"])
    if not f:
        continue
    t = htype.get(r["hub_slug"])
    if t in ("country", "region"):
        country_of.setdefault(f["slug"], r["hub_slug"].split("-", 1)[1])
    elif t == "movement":
        movement_members[r["hub_slug"].split("-", 1)[1]].append(f["slug"])
for slug, code in (ov.get("country_overrides") or {}).items():
    country_of[slug] = code  # editorial override wins over the hub-derived country

BANDS = [
    {"id": "anglo", "label": "할리우드 · 영어권", "label_en": "Hollywood & Anglophone",
     "cc": {"us", "gb", "ca", "au", "ie", "nz"}},
    {"id": "europe", "label": "유럽", "label_en": "Europe",
     "cc": {"fr", "de", "it", "es", "be", "nl", "dk", "se", "no", "fi", "pl", "ro", "ru",
            "su", "hu", "cz", "xc", "gr", "tr", "at", "ch", "pt", "ge", "lv", "balkans",
            "nordic-minor"}},
    {"id": "eastasia", "label": "동아시아", "label_en": "East Asia",
     "cc": {"jp", "kr", "cn", "hk", "tw"}},
    {"id": "south", "label": "글로벌 사우스", "label_en": "Global South",
     "cc": {"in", "ir", "br", "mx", "ar", "cl", "th", "il", "eg", "za", "id", "ph", "sn",
            "ml", "tn", "dz", "cu", "gt", "ng", "ps", "sy", "central-asia", "caucasus",
            "west-africa", "southeast-asia", "maghreb"}},
]
band_idx = {}
for i, b in enumerate(BANDS):
    for c in b["cc"]:
        band_idx[c] = i

def band_of(slug):
    c = country_of.get(slug)
    if c in band_idx:
        return band_idx[c]
    return 1  # unmapped -> Europe (art-film festival default); overrides catch the rest

# ---------------------------------------------------------------- scores
# codex rows are keyed by slug (extract does the film_id→slug distinct-on join);
# tolerate a stray film_id-only row rather than KeyError the whole build.
codex_by = {c["slug"]: c for c in codex if c.get("slug") in by_slug}
n_missing_codex = len(by_slug) - len(codex_by)
if n_missing_codex:
    print(f"WARNING: {n_missing_codex} visible films have no codex row → altitude 3 default")
prestige = {}
for r in prestige_rows:
    f = by_id.get(r["film_id"])
    if f and r.get("prestige_score") is not None:
        prestige[f["slug"]] = max(prestige.get(f["slug"], -1e9), float(r["prestige_score"]))

# t-SNE embedding coordinates by slug (the similarity-galaxy layout)
tsne = {}
for r in mapxy_rows:
    f = by_id.get(r["film_id"])
    if f and r.get("x") is not None and r.get("y") is not None:
        tsne[f["slug"]] = (round(float(r["x"]), 3), round(float(r["y"]), 3), r.get("cluster"))

costs = sorted(c["c_cost"] for c in codex_by.values() if c.get("c_cost") is not None)
def cost_band(slug):
    c = codex_by.get(slug, {}).get("c_cost")
    if c is None:
        return 3
    # quintile band 1..5 over the corpus cost distribution
    import bisect
    q = bisect.bisect_right(costs, c) / max(1, len(costs))
    return min(5, 1 + int(q * 5))

# ---------------------------------------------------------------- lines
LINE_META = {
    # movement hub lines (curation.film_hub is the membership authority)
    "iranian-new-wave":        ("이란 뉴웨이브선", "Iranian New Wave Line", "movement", "#b8860b"),
    "japanese-golden-age":     ("일본 황금기선", "Japanese Golden Age Line", "movement", "#d97706"),
    "french-new-wave":         ("누벨바그선", "French New Wave Line", "movement", "#E3120B"),
    "new-hollywood":           ("뉴 할리우드선", "New Hollywood Line", "movement", "#8b3fbf"),
    "new-german-cinema":       ("뉴 저먼 시네마선", "New German Cinema Line", "movement", "#2f6fce"),
    "nuevo-cine-mexicano":     ("누에보 시네 멕시카노선", "Nuevo Cine Mexicano Line", "movement", "#9a6b1f"),
    "chinese-sixth-generation":("중국 6세대선", "Chinese Sixth Generation Line", "movement", "#0e8f6e"),
    "korean-new-wave":         ("코리안 뉴웨이브선", "Korean New Wave Line", "movement", "#12a150"),
    "taiwan-new-cinema":       ("대만 뉴시네마선", "Taiwan New Cinema Line", "movement", "#0f8a3d"),
    "surrealist-film":         ("초현실주의선", "Surrealist Line", "movement", "#7c4dff"),
    "hong-kong-new-wave":      ("홍콩 뉴웨이브선", "Hong Kong New Wave Line", "movement", "#00a3a3"),
    "chinese-fifth-generation":("중국 5세대선", "Chinese Fifth Generation Line", "movement", "#2e9e44"),
    "parallel-cinema":         ("인도 패럴렐 시네마선", "Parallel Cinema Line", "movement", "#c2410c"),
    "elevated-horror":         ("엘리베이티드 호러선", "Elevated Horror Line", "movement", "#6d28d9"),
    "german-expressionism":    ("독일 표현주의선", "German Expressionism Line", "movement", "#1d4ed8"),
    "slow-cinema":             ("슬로우 시네마선", "Slow Cinema Line", "movement", "#1259c3"),
    "berlin-school":           ("베를린파선", "Berlin School Line", "movement", "#3b82c4"),
    "japanese-new-wave":       ("일본 뉴웨이브선", "Japanese New Wave Line", "movement", "#ea8c00"),
    "new-queer-cinema":        ("뉴 퀴어 시네마선", "New Queer Cinema Line", "movement", "#d6336c"),
    "left-bank":               ("레프트 뱅크선", "Left Bank Line", "movement", "#c026d3"),
    "poetic-realism":          ("시적 리얼리즘선", "Poetic Realism Line", "movement", "#5b21b6"),
    "romanian-new-wave":       ("루마니아 뉴웨이브선", "Romanian New Wave Line", "movement", "#4d7c0f"),
    "dogme-95":                ("도그마 95선", "Dogme 95 Line", "movement", "#57534e"),
    "greek-weird-wave":        ("그리스 위어드 웨이브선", "Greek Weird Wave Line", "movement", "#0891b2"),
    "cinema-du-look":          ("시네마 뒤 룩선", "Cinéma du Look Line", "movement", "#e11d8f"),
    "italian-neorealism":      ("네오리얼리즘선", "Italian Neorealism Line", "movement", "#166534"),
    # curated lines (workflow output in odyssey_overrides.json)
    "classical-hollywood":     ("고전 할리우드선", "Classical Hollywood Line", "movement", "#b3261e"),
    "film-noir":               ("필름 누아르선", "Film Noir Line", "movement", "#44403c"),
    "british-new-wave":        ("브리티시 뉴웨이브선", "British New Wave Line", "movement", "#845ef7"),
    "musical":                 ("뮤지컬선", "Musical Line", "theme", "#e8590c"),
    # deterministic genre lines
    "sf":                      ("SF선", "Science Fiction Line", "theme", "#0b7285"),
    "horror":                  ("호러선", "Horror Line", "theme", "#862e9c"),
    "documentary":             ("다큐멘터리선", "Documentary Line", "theme", "#087f5b"),
    "animation":               ("애니메이션선", "Animation Line", "theme", "#e64980"),
    "western":                 ("웨스턴선", "Western Line", "theme", "#a87900"),
    # express
    "canon-express":           ("정전 특급", "Canon Express", "express", "#111111"),
}

def year_of(s):
    return by_slug[s]["year"] or 0

def genre_line(genre, cap):
    pool = [f["slug"] for f in films if genre in (f.get("genres") or [])]
    pool.sort(key=lambda s: (-(prestige.get(s, -1e9)), year_of(s)))
    picked = pool[:cap]
    picked.sort(key=lambda s: (year_of(s), s))
    return picked

lines = {}
for slug_, members in movement_members.items():
    if slug_ in LINE_META and len(members) >= 3:
        lines[slug_] = sorted(set(members), key=lambda s: (year_of(s), s))
for key, cur in (ov.get("curated_lines") or {}).items():
    members = [s for s in cur.get("members", []) if s in by_slug]
    if key == "slow-cinema":
        members = sorted(set(members) | set(lines.get("slow-cinema", [])), key=lambda s: (year_of(s), s))
    if len(members) >= 3:
        lines[key] = sorted(set(members), key=lambda s: (year_of(s), s))
lines["sf"] = genre_line("Science Fiction", 42)
lines["horror"] = genre_line("Horror", 42)
lines["documentary"] = genre_line("Documentary", 80)
lines["animation"] = genre_line("Animation", 42)
lines["western"] = genre_line("Western", 40)
canon = sorted(prestige, key=lambda s: -prestige[s])[:110]
lines["canon-express"] = sorted(canon, key=lambda s: (year_of(s), s))

lines_of = defaultdict(list)
ORDERED_LINE_IDS = [k for k in LINE_META if k in lines]
for lid in ORDERED_LINE_IDS:
    for s in lines[lid]:
        lines_of[s].append(lid)

# ---------------------------------------------------------------- x scale (era density)
X0, XPAD = 60, 120
year_counts = defaultdict(int)
for f in films:
    year_counts[f["year"] or 1900] += 1
years = list(range(1895, 2027))
xw = {y: 4.0 + year_counts.get(y, 0) * 1.05 for y in years}
year_x = {}
acc = X0
for y in years:
    year_x[y] = acc
    acc += xw[y]
W = int(acc + XPAD)

def x_of(slug):
    y = by_slug[slug]["year"] or 1900
    y = max(1895, min(2026, y))
    return round(year_x[y] + xw[y] * 0.5, 1)

# ---------------------------------------------------------------- y layout
# Home band of a line = band holding the majority of its stations ('cross' if <70%).
line_band = {}
for lid in ORDERED_LINE_IDS:
    counts = defaultdict(int)
    for s in lines[lid]:
        counts[band_of(s)] += 1
    total = len(lines[lid])
    if not total:
        line_band[lid] = -1
        continue
    best, n = max(counts.items(), key=lambda kv: kv[1])
    line_band[lid] = best if n / total >= 0.7 and LINE_META[lid][2] != "express" else -1

band_films = defaultdict(list)
for f in films:
    band_films[band_of(f["slug"])].append(f["slug"])

LANE_GAP, ROW_GAP, BAND_PAD = 34, 24, 46
TOP = 56
band_geo = []
station_y = {}

def primary_line(s):
    for lid in lines_of.get(s, []):
        if line_band.get(lid, -1) == band_of(s):
            return lid
    return None

y_cursor = TOP
for bi, b in enumerate(BANDS):
    local_lines = [lid for lid in ORDERED_LINE_IDS if line_band.get(lid) == bi]
    # lane allocation: interval coloring over each line's [minX, maxX]
    # Keep LINE_META (editorial) order rather than sorting by start-x: related
    # lines (classical -> noir -> musical) land on adjacent lanes, which keeps
    # the braid of their shared stations tight instead of map-wide.
    intervals = []
    for lid in local_lines:
        xs = [x_of(s) for s in lines[lid]]
        intervals.append((min(xs), max(xs), lid))
    lane_ends, lane_of_line = [], {}
    for x1, x2, lid in intervals:
        placed = False
        for li, end in enumerate(lane_ends):
            if x1 > end + 60:
                lane_ends[li] = x2
                lane_of_line[lid] = li
                placed = True
                break
        if not placed:
            lane_of_line[lid] = len(lane_ends)
            lane_ends.append(x2)
    n_lanes = len(lane_ends)
    lane_y0 = y_cursor + BAND_PAD
    # residential rows for line-less stations, below the lanes
    n_local = sum(1 for s in band_films[bi] if primary_line(s) is None)
    n_rows = max(2, min(14, round(n_local / 26) + 2))
    rows_y0 = lane_y0 + n_lanes * LANE_GAP + 18
    band_h = BAND_PAD + n_lanes * LANE_GAP + 18 + n_rows * ROW_GAP + BAND_PAD
    band_geo.append({"id": b["id"], "label": b["label"], "label_en": b["label_en"],
                     "y0": y_cursor, "y1": y_cursor + band_h})
    for lid in local_lines:
        ly = lane_y0 + lane_of_line[lid] * LANE_GAP
        for s in lines[lid]:
            if band_of(s) == bi and primary_line(s) == lid and s not in station_y:
                station_y[s] = ly
    for s in band_films[bi]:
        if s not in station_y:
            h = int(hashlib.md5(s.encode()).hexdigest()[:6], 16)
            station_y[s] = rows_y0 + (h % n_rows) * ROW_GAP
    y_cursor += band_h
H = y_cursor + 40

# collision fan-out: same row, x too close -> alternate small vertical offsets
by_row = defaultdict(list)
for s, y in station_y.items():
    by_row[y].append(s)
for y, ss in by_row.items():
    ss.sort(key=x_of)
    prev_x, k = -1e9, 0
    for s in ss:
        x = x_of(s)
        if x - prev_x < 9:
            k += 1
            station_y[s] = y + (8 if k % 2 else -8) * ((k + 1) // 2)
        else:
            k = 0
        prev_x = x

# ---------------------------------------------------------------- emit
stations = []
for f in sorted(films, key=lambda f: f["slug"]):
    s = f["slug"]
    st = {
        "s": s, "t": f["title"], "y": f["year"], "d": f["director"],
        "x": x_of(s), "yy": round(station_y[s], 1), "b": band_of(s),
        "c": cost_band(s),
    }
    if f.get("title_ko") and f["title_ko"] != f["title"]:
        st["tk"] = f["title_ko"]
    if f.get("poster_path"):
        st["p"] = f["poster_path"]
    if s in lines_of:
        st["ln"] = lines_of[s]
        if len(lines_of[s]) > 1:
            st["tf"] = 1
    pr = prestige.get(s)
    if pr is not None:
        st["pr"] = round(pr, 1)
    if s in canon[:100]:
        st["pk"] = 1
    if s in tsne:
        tx, ty, cl = tsne[s]
        st["tx"], st["ty"] = tx, ty
        if cl is not None:
            st["cl"] = cl
    cd = codex_by.get(s)
    if cd and cd.get("v_value") is not None:
        st["v"] = round(float(cd["v_value"]), 1)  # TakeScore value axis
        if cd.get("r_risk") is not None:
            st["u"] = round(float(cd["v_value"]) - float(cd["r_risk"]), 1)  # TakeScore U
    stations.append(st)

line_arr = []
for lid in ORDERED_LINE_IDS:
    ko, en, cls, color = LINE_META[lid]
    cur = (ov.get("curated_lines") or {}).get(lid, {})
    line_arr.append({
        "id": lid, "name": cur.get("name_ko") or ko, "name_en": en, "cls": cls,
        "color": color, "band": line_band.get(lid, -1),
        "desc": cur.get("desc_ko") or "", "desc_en": cur.get("desc_en") or "",
        "stations": lines[lid],
    })

# genre vocabulary + per-station indices (compact; powers the deck's genre filter)
genre_list = sorted({g for f in films for g in (f.get("genres") or [])})
genre_idx = {g: i for i, g in enumerate(genre_list)}
for st in stations:
    f = by_slug.get(st["s"])
    gs = [genre_idx[g] for g in (f.get("genres") or []) if g in genre_idx] if f else []
    if gs:
        st["gi"] = gs

decades = [{"y": y, "x": round(year_x[y], 1)} for y in range(1900, 2030, 10) if y in year_x]
os.makedirs(OUT, exist_ok=True)
map_obj = {"v": 1, "w": W, "h": H, "bands": band_geo, "decades": decades,
           "genres": genre_list, "lines": line_arr, "stations": stations}
with open(os.path.join(OUT, "map.v1.json"), "w") as fp:
    json.dump(map_obj, fp, ensure_ascii=False, separators=(",", ":"))

avail = {"KR": defaultdict(list), "US": defaultdict(list)}
for r in avail_rows:
    f = by_id.get(r["film_id"])
    if f and r["provider_name"] not in avail[r["country_code"]][f["slug"]]:
        avail[r["country_code"]][f["slug"]].append(r["provider_name"])
with open(os.path.join(OUT, "avail.v1.json"), "w") as fp:
    json.dump({k: dict(v) for k, v in avail.items()}, fp, ensure_ascii=False, separators=(",", ":"))

n_on_line = sum(1 for s in by_slug if s in lines_of)
print(f"map.v1.json: {W}x{H}px, {len(stations)} stations, {len(line_arr)} lines, "
      f"{n_on_line} on-line, {sum(1 for s0 in stations if s0.get('tf'))} transfers")
print(f"avail.v1.json: KR {len(avail['KR'])} / US {len(avail['US'])} films")
for la in line_arr:
    print(f"  {la['id']}: {len(la['stations'])} stations, band={la['band']}")
