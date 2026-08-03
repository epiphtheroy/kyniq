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
# Wave 2 (0120, owner 2026-08-03): zh + hi joined the projection so the app's
# content-language axis covers en·ko·es·ja·zh·fr·hi.
LOCALE_TMDB={"ko":"ko-KR","ja":"ja-JP","fr":"fr-FR","es":"es-ES","zh":"zh-CN","hi":"hi-IN"}
# Re-fetch a row this old (TMDB adds localized titles over time; a NULL today is
# not NULL forever). Matches the work order's 90-day cursor.
STALE_DAYS=90
# TMDB tolerates ~40 req/s; we run at half that. One call per film.
# Override with I18N_THROTTLE when the DB is already under load — a wave-2 style
# multi-language run is ~35k PATCHes, and an unthrottled backfill is exactly what
# saturated the database once before (HANDOFF-DB성능-인시던트.md).
THROTTLE=float(os.environ.get("I18N_THROTTLE","0.05"))

args=sys.argv[1:]
PERSIST="--persist" in args
if "--dry" in args: PERSIST=False   # explicit dry wins; DRY is already the default
LIMIT=int(args[args.index("--limit")+1]) if "--limit" in args else 100000
MISSING="--missing" in args
# --repair: one language-agnostic pass that NULLs any title_<loc>/overview_<loc>
# already poisoned by the pre-fix fallback bug. Cheap by design — the original
# title is the same for every locale, so this costs ONE call per film total, not
# one per film per language.
REPAIR="--repair" in args
# --jobs N: run N films concurrently. The loop is latency-bound, not rate-bound —
# one TMDB read plus one PATCH is ~2s of round trip per film, so a 7k-film cohort
# takes ~4 HOURS sequentially. Default stays 1 (byte-identical to the old
# behaviour); the wave-2 multi-language run uses 8, which is still well under
# TMDB's ceiling and gentle on the DB (only films with something new are written).
JOBS=max(1, int(args[args.index("--jobs")+1])) if "--jobs" in args else 1
# --refill: re-fetch every film that still LACKS a localized title, regardless of
# when it was last fetched. The default cohort skips rows fetched <90d ago, so
# after a full run the ~5k title-NULL rows would never be retried; --refill + the
# /translations fallback below is how they get a second chance.
REFILL="--refill" in args
# --films a,b (work order §3.2) and --film x --film y (repo convention) both work.
FILMS=[a for i,x in enumerate(args) if x=="--films" and i+1<len(args) for a in args[i+1].split(",") if a]
FILMS+=[args[i+1] for i,a in enumerate(args) if a=="--film" and i+1<len(args)]
LOC=args[args.index("--locale")+1] if "--locale" in args else None
if not REPAIR and LOC not in LOCALE_TMDB:
    print(f"--locale is required and must be one of: {', '.join(LOCALE_TMDB)}  (got: {LOC!r})"); sys.exit(2)
LANG=LOCALE_TMDB.get(LOC or "ko", "ko-KR")
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
def tmdb(path, tries=3):
    """One TMDB read, retried on transient transport failures.

    Without this a single `[Errno 54] Connection reset by peer` — routine over a
    7,000-call run — propagates out of the worker pool and kills the ENTIRE pass
    (that is how the French title backfill and the first repair run both died on
    2026-08-03). http() already swallows HTTP errors; this covers the socket.
    """
    base="https://api.themoviedb.org/3"
    if len(TMDB)>40:  # v4 read access token
        url=base+path; headers={"Authorization":f"Bearer {TMDB}","accept":"application/json"}
    else:             # v3 api key
        sep="&" if "?" in path else "?"; url=f"{base}{path}{sep}api_key={TMDB}"; headers={"accept":"application/json"}
    for a in range(tries):
        try:
            st,tx=http("GET",url,headers)
        except Exception as e:
            if a==tries-1:
                print(f"    ! tmdb net {type(e).__name__} {path[:50]}")
                return None
            time.sleep(1.5*(a+1)); continue
        if st==429:                       # rate limited — back off and retry
            time.sleep(2*(a+1)); continue
        if st!=200:
            print(f"    ! tmdb {st} {path[:60]}"); return None
        try: return json.loads(tx)
        except Exception: return None
    return None
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
    sel=f"id,tmdb_id,slug,title,{T_COL},{O_COL},{F_COL}"
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

def process(f):
    """One film. Returns a stats dict; safe to run concurrently (no shared state
    beyond the HTTP helpers, which are stateless)."""
    n=t_hit=o_hit=t_same=miss=skipped=0
    if True:
        # append_to_response=translations → one call carries both the primary
        # localized fields AND the full translations list (no extra request).
        d=tmdb(f"/movie/{f['tmdb_id']}?language={LANG}&append_to_response=translations")
        if d is None:
            time.sleep(THROTTLE)
            return {"miss":1}
        en=(f["title"] or "").strip()
        loc_title=(d.get("title") or "").strip()
        # TMDB does not 404 a missing translation — it FALLS BACK, and not to
        # English: ?language=hi-IN on a Hong Kong film returns 花樣年華, the
        # ORIGINAL title. The old guard only rejected an English echo, so those
        # fallbacks were stored as if they were Hindi (2026-08-03: 602 Han / 306
        # Hangul / 271 Kana strings sitting in title_hi). Reject the original
        # title too — when the film's original language genuinely IS this locale,
        # the explicit original_language branch below still fills it.
        orig=(d.get("original_title") or "").strip()
        if loc_title and orig and loc_title==orig and (d.get("original_language") or "")!=LOC:
            loc_title=""
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
            # One iso_639_1 can carry several regional translations — 'zh' has CN
            # (Simplified) alongside TW/HK (Traditional). Take the region we asked
            # TMDB for when it is there, else the first entry for the language.
            region=LANG.split("-")[1] if "-" in LANG else None
            cands=[tr for tr in (d.get("translations") or {}).get("translations", [])
                   if tr.get("iso_639_1")==LOC]
            cands.sort(key=lambda tr: 0 if region and tr.get("iso_3166_1")==region else 1)
            for tr in cands:
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
        # Partial update: only write fields we actually found. Writing NULLs
        # back would erase values stored by an earlier run, and PATCHing rows
        # where nothing was found churns the hot films table for no gain
        # (2026-07-17 incident: thousands of no-op PATCHes during peak).
        upd={F_COL:"now()"}
        if title: upd[T_COL]=title
        if overview: upd[O_COL]=overview
        if title: t_hit+=1
        elif loc_title: t_same+=1
        if overview: o_hit+=1
        print(f"  · {f['slug']}: title={title or '-'}{f' [{src}]' if src else ''} overview={'Y' if overview else '-'}")
        if PERSIST:
            if len(upd)==1 and f.get(F_COL):
                skipped+=1   # nothing new + already marked fetched → no write
            else:
                st,tx=sb("PATCH",f"films?id=eq.{f['id']}",upd,prefer="return=minimal")
                if st>=300: print(f"    ! write {st} {tx[:120]}")
                else: n+=1
        time.sleep(THROTTLE)
    return {"n":n,"t_hit":t_hit,"o_hit":o_hit,"t_same":t_same,"miss":miss,"skipped":skipped}

def repair():
    """Undo the original-title fallback poisoning across every projected locale.

    The bug wrote TMDB's fallback (the film's ORIGINAL title) into title_<loc>
    whenever that locale had no translation. Detect it by fetching the original
    title once per film and NULLing every locale column that merely echoes it —
    except the locale that genuinely IS the film's original language, where the
    original title is the right answer.
    """
    locs=list(LOCALE_TMDB)
    cols=",".join(f"title_{l},overview_{l}" for l in locs)
    films=fetch_all(f"films?select=id,slug,tmdb_id,title,{cols}&tmdb_id=not.is.null&order=slug")[:LIMIT]
    print(f"[repair] {len(films)} films × {len(locs)} locales (jobs={JOBS})"
          f"{'' if PERSIST else '  [DRY]'}", flush=True)

    def one(f):
        try:
            d=tmdb(f"/movie/{f['tmdb_id']}")
        except Exception:
            return 0
        if d is None: return 0
        orig=(d.get("original_title") or "").strip()
        olang=(d.get("original_language") or "")
        if not orig: return 0
        upd={}
        for l in locs:
            if l==olang: continue          # the original title IS this locale's title
            cur=(f.get(f"title_{l}") or "").strip()
            if cur and cur==orig:
                upd[f"title_{l}"]=None
                upd[f"overview_{l}"]=None  # the overview came from the same bad response
        if not upd: return 0
        print(f"   · {f['slug']}: clearing {', '.join(k for k in upd if k.startswith('title'))} (orig={orig[:24]})")
        if PERSIST:
            st,tx=sb("PATCH",f"films?id=eq.{f['id']}",upd,prefer="return=minimal")
            if st>=300: print(f"    ! write {st} {tx[:100]}"); return 0
        return 1

    n=0
    if JOBS==1:
        for f in films: n+=one(f)
    else:
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=JOBS) as ex:
            for i,r in enumerate(ex.map(one, films)):
                n+=r
                if (i+1)%1000==0: print(f"  … {i+1}/{len(films)}  repaired {n}", flush=True)
    print(f"[repair] {'' if PERSIST else 'DRY '}done: {n} films cleaned")


def main():
    if REPAIR:
        repair(); return
    films=cohort()
    print(f"[i18n:{LOC}] {len(films)} films (lang={LANG}, jobs={JOBS})"
          f"{'' if PERSIST else '  [DRY — fetch+print, no DB writes]'}", flush=True)
    if not films: print("  nothing to do"); return
    tot={"n":0,"t_hit":0,"o_hit":0,"t_same":0,"miss":0,"skipped":0}
    def add(r):
        for k,v in (r or {}).items(): tot[k]=tot.get(k,0)+v
    if JOBS==1:
        for f in films: add(process(f))
    else:
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=JOBS) as ex:
            for i,r in enumerate(ex.map(process, films)):
                add(r)
                if (i+1)%500==0: print(f"    … {i+1}/{len(films)}", flush=True)
    print(f"[i18n:{LOC}] {len(films)} seen · localized title {tot['t_hit']} · title==EN (stored NULL) {tot['t_same']} · "
          f"overview {tot['o_hit']} · TMDB miss {tot['miss']}")
    print(f"[i18n:{LOC}] {'PERSIST done: '+str(tot['n'])+' rows written, '+str(tot['skipped'])+' no-op skips.' if PERSIST else 'DRY done — re-run with --persist to write.'}")

if __name__=="__main__": main()
