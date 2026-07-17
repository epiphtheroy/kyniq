#!/usr/bin/env python3
"""TMDB locale backfill (migration 0105) — films.title_<loc> / overview_<loc>.

정본: HANDOFF-KO프로젝션-한국어사이트.md §3.2

Fills the locale-projection columns from TMDB's own localized metadata. This is
a DATA JOIN, not a translation: film titles must be the official release title
in that market ("In the Mood for Love" -> "화양연화"), which no translator should
be inventing. When TMDB has no localized value we write NULL and the site falls
back to English (lib/i18n/values.ts locVal).

One TMDB call per film. Free. ~5,000 films ≈ 5 minutes at the throttle below.

Locale-generic by design (work order §-2.2 step 5): a new language is
  python3 tmdb-i18n-backfill.py --locale ja --persist
and needs no code change here beyond the LOCALE_TMDB entry, which mirrors
lib/i18n/locales.ts.

SAFETY: default DRY (fetches + prints, NO DB writes). --persist to write.
Usage:
  python3 tmdb-i18n-backfill.py --locale ko                      # DRY, full cohort
  python3 tmdb-i18n-backfill.py --locale ko --persist            # write
  python3 tmdb-i18n-backfill.py --locale ko --missing --persist  # only never-fetched rows (new intake)
  python3 tmdb-i18n-backfill.py --locale ko --refill --persist   # retry every title-NULL film via /translations (fills 화양연화·기생충 …)
  python3 tmdb-i18n-backfill.py --locale ko --films alien-1979,parasite-2019 --persist
  python3 tmdb-i18n-backfill.py --locale ko --limit 50 --persist
"""
import os, sys, json, time, datetime, urllib.request, urllib.error, urllib.parse

HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p,encoding="utf-8"):
        line=line.strip()
        if line and not line.startswith("#") and "=" in line:
            k,_,v=line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT,".env.local"))
URL=os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
TMDB=os.environ.get("TMDB_READ_TOKEN")
if not (URL and KEY and TMDB): print("Missing env (SUPABASE url/service key + TMDB_READ_TOKEN)"); sys.exit(1)

# Mirrors lib/i18n/locales.ts. 'en' is the source language — never a backfill target.
LOCALE_TMDB={"ko":"ko-KR","ja":"ja-JP","fr":"fr-FR","es":"es-ES"}
# Re-fetch a row this old (TMDB adds localized titles over time; a NULL today is
# not NULL forever). Matches the work order's 90-day cursor.
STALE_DAYS=90
# TMDB tolerates ~40 req/s; we run at half that. One call per film.
THROTTLE=0.05

args=sys.argv[1:]
PERSIST="--persist" in args
if "--dry" in args: PERSIST=False   # explicit dry wins; DRY is already the default
LIMIT=int(args[args.index("--limit")+1]) if "--limit" in args else 100000
MISSING="--missing" in args
# --refill: re-fetch every film that still LACKS a localized title, regardless of
# when it was last fetched. The default cohort skips rows fetched <90d ago, so
# after a full run the ~5k title-NULL rows would never be retried; --refill + the
# /translations fallback below is how they get a second chance.
REFILL="--refill" in args
# --films a,b (work order §3.2) and --film x --film y (repo convention) both work.
FILMS=[a for i,x in enumerate(args) if x=="--films" and i+1<len(args) for a in args[i+1].split(",") if a]
FILMS+=[args[i+1] for i,a in enumerate(args) if a=="--film" and i+1<len(args)]
LOC=args[args.index("--locale")+1] if "--locale" in args else None
if LOC not in LOCALE_TMDB:
    print(f"--locale is required and must be one of: {', '.join(LOCALE_TMDB)}  (got: {LOC!r})"); sys.exit(2)
LANG=LOCALE_TMDB[LOC]
T_COL=f"title_{LOC}"; O_COL=f"overview_{LOC}"; F_COL=f"{LOC}_fetched_at"

def http(method,url,headers=None,body=None,timeout=60):
    req=urllib.request.Request(url,method=method,data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type","application/json")
    for k,v in (headers or {}).items(): req.add_header(k,v)
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:300]
def sb(method,path,body=None,prefer=None):
    h={"apikey":KEY,"Authorization":f"Bearer {KEY}"}
    if prefer: h["Prefer"]=prefer
    return http(method,f"{URL}/rest/v1/{path}",h,body)
def tmdb(path):
    base="https://api.themoviedb.org/3"
    if len(TMDB)>40:  # v4 read access token
        url=base+path; headers={"Authorization":f"Bearer {TMDB}","accept":"application/json"}
    else:             # v3 api key
        sep="&" if "?" in path else "?"; url=f"{base}{path}{sep}api_key={TMDB}"; headers={"accept":"application/json"}
    st,tx=http("GET",url,headers)
    if st!=200: print(f"    ! tmdb {st} {path[:60]}"); return None
    try: return json.loads(tx)
    except Exception: return None
def fetch_all(path):
    """PostgREST caps every response at 1000 rows — page through it."""
    rows=[]; off=0
    while True:
        st,tx=sb("GET",f"{path}{'&' if '?' in path else '?'}limit=1000&offset={off}")
        if st!=200: raise RuntimeError(f"{st}: {tx[:200]}")
        b=json.loads(tx); rows+=b
        if len(b)<1000: break
        off+=1000
    return rows

def cohort():
    sel=f"id,tmdb_id,slug,title,{T_COL},{O_COL}"
    q=f"films?select={sel}&tmdb_id=not.is.null"
    if FILMS:
        q+="&slug=in.("+",".join(urllib.parse.quote(s) for s in FILMS)+")"
    elif MISSING:
        q+=f"&{T_COL}=is.null&{F_COL}=is.null"   # never fetched: brand-new intake only
    elif REFILL:
        q+=f"&{T_COL}=is.null"                    # any film still lacking a localized title (retry via /translations)
    else:
        cutoff=(datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(days=STALE_DAYS)).isoformat()
        q+=f"&or=({F_COL}.is.null,{F_COL}.lt.{urllib.parse.quote(cutoff)})"
    q+="&order=slug"
    return fetch_all(q)[:LIMIT]

def main():
    films=cohort()
    print(f"[i18n:{LOC}] {len(films)} films (lang={LANG}){'' if PERSIST else '  [DRY — fetch+print, no DB writes]'}")
    if not films: print("  nothing to do"); return
    n=t_hit=o_hit=t_same=miss=0
    for f in films:
        # append_to_response=translations → one call carries both the primary
        # localized fields AND the full translations list (no extra request).
        d=tmdb(f"/movie/{f['tmdb_id']}?language={LANG}&append_to_response=translations")
        if d is None:
            miss+=1; time.sleep(THROTTLE); continue
        en=(f["title"] or "").strip()
        loc_title=(d.get("title") or "").strip()
        # The primary title/overview echo English when TMDB has no *primary*
        # localized value set — even for films that DO carry an explicit
        # translation (화양연화, 기생충). So resolve in order: primary field →
        # /translations entry for this locale → original_title when the film's
        # original language IS this locale (e.g. Parasite's original is ko). A
        # localized title identical to English carries no info → stays NULL.
        title=loc_title if loc_title and loc_title!=en else None
        overview=(d.get("overview") or "").strip() or None
        src="lang" if title else None
        if not title or not overview:
            for tr in (d.get("translations") or {}).get("translations", []):
                if tr.get("iso_639_1")!=LOC: continue
                data=tr.get("data") or {}
                cand=(data.get("title") or "").strip()
                if not title and cand and cand!=en: title=cand; src="trans"
                if not overview:
                    ov=(data.get("overview") or "").strip()
                    if ov: overview=ov
                break
        if not title and (d.get("original_language") or "")==LOC:
            cand=(d.get("original_title") or "").strip()
            if cand and cand!=en: title=cand; src="orig"
        upd={T_COL:title, O_COL:overview, F_COL:"now()"}
        if title: t_hit+=1
        elif loc_title: t_same+=1
        if overview: o_hit+=1
        print(f"  · {f['slug']}: title={title or '-'}{f' [{src}]' if src else ''} overview={'Y' if overview else '-'}")
        if PERSIST:
            st,tx=sb("PATCH",f"films?id=eq.{f['id']}",upd,prefer="return=minimal")
            if st>=300: print(f"    ! write {st} {tx[:120]}")
            else: n+=1
        time.sleep(THROTTLE)
    print(f"[i18n:{LOC}] {len(films)} seen · localized title {t_hit} · title==EN (stored NULL) {t_same} · "
          f"overview {o_hit} · TMDB miss {miss}")
    print(f"[i18n:{LOC}] {'PERSIST done: '+str(n)+' rows written.' if PERSIST else 'DRY done — re-run with --persist to write.'}")

if __name__=="__main__": main()
