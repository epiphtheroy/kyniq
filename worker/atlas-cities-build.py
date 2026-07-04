#!/usr/bin/env python3
"""Build lib/atlas_cities.json — the frozen roster of city/region hub pages
(docs/PLAN-atlas-seo.md Phase 3).

Candidates come from the atlas_city_candidates_json RPC (locality terms from
pin-name segments; >=3 visible films; p90 spread <= 150 km). This script only
does the parts SQL is bad at: collapsing name variants ("New York" / "New York
City"), fusing same-place synonyms by film-set overlap, slugging, and capping.

Rebuild: python3 worker/atlas-cities-build.py   (then the watcher deploys lib/)
The artifact is append-friendly: slugs are stable (name-derived); a rebuild
after new location data only adds/annotates entries.
"""
import json, math, pathlib, re, sys, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "lib" / "atlas_cities.json"

MERGE_KM = 50.0     # variant collapse radius
CAP = 1000          # hard page cap (user directive 2026-07-04)


def env():
    vals = {}
    for line in (ROOT / ".env.local").read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            vals[k.strip()] = v.strip().strip('"')
    return vals["NEXT_PUBLIC_SUPABASE_URL"], vals["NEXT_PUBLIC_SUPABASE_ANON_KEY"]


def fetch_candidates():
    url, key = env()
    req = urllib.request.Request(
        f"{url}/rest/v1/rpc/atlas_city_candidates_json",
        data=b"{}",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def km(a_lat, a_lng, b_lat, b_lng):
    return math.sqrt(((a_lat - b_lat) * 111.0) ** 2 + ((a_lng - b_lng) * 111.0 * math.cos(math.radians(a_lat))) ** 2)


def slugify(s):
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", s.lower()))


def country_slug(s):
    return slugify(s)


def main():
    cands = fetch_candidates()
    print(f"candidates: {len(cands)}")
    cands.sort(key=lambda c: (-c["films"], c["term"]))

    kept = []
    for c in cands:
        c["film_set"] = set(c["film_slugs"])
        c["terms"] = [c["term"]]
        merged = False
        for k in kept:
            if k["country"] != c["country"]:
                continue
            close = km(k["clat"], k["clng"], c["clat"], c["clng"]) <= MERGE_KM
            if not close:
                continue
            variant = c["term"] in k["term"] or k["term"] in c["term"]
            inter = len(k["film_set"] & c["film_set"])
            same_place = inter >= 0.9 * len(c["film_set"]) and inter >= 0.9 * len(k["film_set"])
            if variant or same_place:
                k["film_set"] |= c["film_set"]
                k["terms"].append(c["term"])
                k["pins"] += c["pins"]
                merged = True
                break
        if not merged:
            kept.append(c)

    kept.sort(key=lambda c: (-len(c["film_set"]), c["term"]))
    kept = kept[:CAP]

    cities, used = [], set()
    for c in kept:
        base = slugify(c["display"])
        cslug = country_slug(c["country"])
        slug, n = base, 2
        while (cslug, slug) in used:
            slug = f"{base}-{n}"
            n += 1
        used.add((cslug, slug))
        cities.append({
            "slug": slug,
            "name": c["display"],
            "country": c["country"],
            "countrySlug": cslug,
            "terms": sorted(set(c["terms"])),
            "lat": round(c["clat"], 4),
            "lng": round(c["clng"], 4),
            "films": len(c["film_set"]),
            "pins": c["pins"],
            "scale": "city" if c["p90km"] <= 40 else "region",
        })

    OUT.write_text(json.dumps({"count": len(cities), "cities": cities}, ensure_ascii=False, indent=1) + "\n")
    print(f"wrote {OUT} — {len(cities)} entries "
          f"({sum(1 for c in cities if c['scale']=='city')} city / {sum(1 for c in cities if c['scale']=='region')} region)")
    for c in cities[:12]:
        print(f"  {c['country']} / {c['name']} — {c['films']} films ({c['scale']})")


if __name__ == "__main__":
    sys.exit(main())
