#!/usr/bin/env python3
"""theory-import — load the Theories & Theorists canon CSV into public.theory_canon.

Reads worker/theory_canon.csv (Part, Major Category, Sub Category, Theory Title, Theorist)
and inserts all rows. Idempotent: clears the table first so re-runs are clean.
No embeddings here (tradition backfill tries trigram matching first).

Usage: python3 theory-import.py
"""
import os, sys, csv, json, time, urllib.request, urllib.error

HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p,encoding="utf-8"):
        line=line.strip()
        if line and not line.startswith("#") and "=" in line:
            k,_,v=line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT,".env.local"))
URL=os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not (URL and KEY): print("Missing Supabase env"); sys.exit(1)
CSV=os.path.join(HERE,"theory_canon.csv")
if not os.path.exists(CSV): print(f"Missing {CSV}"); sys.exit(1)

def http(method,url,headers=None,body=None,timeout=120):
    data=json.dumps(body).encode() if body is not None else None
    for a in range(5):
        req=urllib.request.Request(url,method=method,data=data); req.add_header("Content-Type","application/json")
        for k,v in (headers or {}).items(): req.add_header(k,v)
        try:
            with urllib.request.urlopen(req,timeout=timeout) as r: return r.status, r.read().decode()
        except urllib.error.HTTPError as e:
            code=e.code; b=e.read().decode()[:300]
            if code in (500,502,503,504,520,521,522,523,524,525,529) and a<4: time.sleep(2*(a+1)); continue
            return code,b
        except (urllib.error.URLError, OSError):
            if a==4: raise
            time.sleep(2*(a+1))
def sb(method,path,body=None,prefer=None):
    h={"apikey":KEY,"Authorization":f"Bearer {KEY}"}
    if prefer: h["Prefer"]=prefer
    return http(method,f"{URL}/rest/v1/{path}",h,body)

def main():
    rows=[]
    with open(CSV,encoding="utf-8-sig",newline="") as f:
        for r in csv.DictReader(f):
            title=(r.get("Theory Title") or "").strip()
            if not title: continue
            rows.append({"part":(r.get("Part") or "").strip() or None,
                         "major_category":(r.get("Major Category") or "").strip() or None,
                         "sub_category":(r.get("Sub Category") or "").strip() or None,
                         "title":title[:300],
                         "theorist":(r.get("Theorist") or "").strip() or None})
    print(f"[theory-import] {len(rows)} canon rows from CSV")
    sb("DELETE","theory_canon?id=gt.0",prefer="return=minimal")   # clean reload
    wrote=0
    for i in range(0,len(rows),200):
        st,tx=sb("POST","theory_canon",rows[i:i+200],prefer="return=minimal")
        if st<300: wrote+=len(rows[i:i+200])
        else: print(f"  ! insert {st}: {tx[:140]}")
        print(f"  stored {wrote}/{len(rows)}")
    print(f"[theory-import] done: {wrote} rows. Tell Claude to run tradition backfill.")

if __name__=="__main__": main()
