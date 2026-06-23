#!/usr/bin/env python3
"""bold-take-gen v13.3 — per film: ONE spoiler-free Cinematic Invitation (intro) +
BOLD intent-independent takes across 14 frameworks, with theory metadata. The framework
(14-way) is THE classification of a take (replaces the old 10 registers).

v13.3 vs v13.2:
  • Added the INVITATION (Asset Protocol): a spoiler-free, third-person, fact-dense single
    paragraph that persuades a hesitant cinephile — the film's lead/intro "take". Strict
    5-part sequence ending in a Hwadu (화두). Generated alongside the takes (same context),
    but firewalled: takes MAY spoil; the invitation MUST NOT.
v13.2 legacy:
  • No figure augmentation (handled by figure-extract / figure-alias).
  • FULL run: --all (bold_take_films RPC), resumable JSONL, --limit/--offset, --max-cost.

Frameworks (take classification): PHENOMENON→NOUMENON, NOUMENON, SIGNIFIER→SIGNIFIED, CONTEXT,
PROCESS, LOCATION, METACRITIC, PSYCHOANALYTIC, ETHICAL-PHILOSOPHICAL, ETHICO-POLITICAL, ENIGMA,
PERSONA-PARALLEL, JUXTAPOSITION, TITLE. 0–3 per framework (skip weak; 12 & 14 emit 0 or 1).

Usage:
  python3 bold-take-gen.py                              # DRY: 8-film pilot → .md + .json
  python3 bold-take-gen.py --films a,b,c --out X        # DRY on specific films
  python3 bold-take-gen.py --all --out bold-take-full   # FULL: all eligible → .jsonl (resumable)
  python3 bold-take-gen.py --all --out bold-take-full --limit 500 --offset 0   # one batch
  python3 bold-take-gen.py --all --out bold-take-full --max-cost 120           # stop at $120
"""
import os, sys, json, re, time, urllib.request, urllib.error
from collections import defaultdict

HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line=line.strip()
        if line and not line.startswith("#") and "=" in line:
            k,_,v=line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT,".env.local"))
URL=os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
ANT=os.environ.get("ANTHROPIC_API_KEY")
args=sys.argv[1:]
MODEL=args[args.index("--model")+1] if "--model" in args else "claude-opus-4-8"
OUT=args[args.index("--out")+1] if "--out" in args else "bold-take-dry-v13"
def argf(f,d): return type(d)(args[args.index(f)+1]) if f in args else d
MIN_STRENGTH=argf("--min-strength",1)
ALL="--all" in args; EMIT="--emit-requests" in args
LIMIT=argf("--limit",0); OFFSET=argf("--offset",0); MAXCOST=argf("--max-cost",0.0)
MAXTOK=8192
PILOT=["black-swan-2010","claire-s-knee-1970","drive-my-car-2021","parasite-2019",
       "mad-max-fury-road-2015","spirited-away-2001","no-country-for-old-men-2007","in-the-mood-for-love-2000"]
FILMS_ARG=(args[args.index("--films")+1].split(",")) if "--films" in args else None
if not (URL and KEY and ANT): sys.exit("Missing env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + ANTHROPIC_API_KEY)")

PRICE_IN, PRICE_OUT = 5.0, 25.0   # Opus 4.8 USD / 1M tokens

def http(method,url,headers=None,body=None,timeout=300):
    data=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(url,method=method,data=data); req.add_header("Content-Type","application/json")
    for k,v in (headers or {}).items(): req.add_header(k,v)
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:600]
def sb(path):
    st,tx=http("GET",f"{URL}/rest/v1/{path}",{"apikey":KEY,"Authorization":f"Bearer {KEY}"})
    if st!=200: raise RuntimeError(f"sb {st}: {tx[:160]}")
    return json.loads(tx)
def rpc(name,body=None):
    st,tx=http("POST",f"{URL}/rest/v1/rpc/{name}",{"apikey":KEY,"Authorization":f"Bearer {KEY}"},body or {})
    if st>=300: raise RuntimeError(f"rpc {name} {st}: {tx[:160]}")
    return json.loads(tx) if tx.strip() else []
def call_llm(system,user,max_tokens=7500):
    body={"model":MODEL,"max_tokens":max_tokens,"system":system,"messages":[{"role":"user","content":user}]}
    for a in range(7):
        st,tx=http("POST","https://api.anthropic.com/v1/messages",
                   {"x-api-key":ANT,"anthropic-version":"2023-06-01"},body)
        if st==200:
            o=json.loads(tx)
            text="".join(p.get("text","") for p in o.get("content",[]) if p.get("type")=="text")
            u=o.get("usage",{}); return text,(u.get("input_tokens",0),u.get("output_tokens",0))
        if st in (429,500,502,503,520,529) and a<6: time.sleep(min(60,5*(a+1))); continue
        raise RuntimeError(f"llm {st}: {tx[:200]}")
def parse_json(s):
    s=s.strip()
    if s.startswith("```"): s=re.sub(r"^```[a-z]*\n?","",s); s=re.sub(r"\n?```$","",s)
    i=s.find("{"); j=s.rfind("}")
    if i>=0 and j>i: s=s[i:j+1]
    return json.loads(s)
def person_name(s):
    if not s: return None
    return re.split(r"\s*[\(（]", str(s).strip())[0].strip() or None

FRAMEWORKS=(
 "1. PHENOMENON→NOUMENON — take the film's most inexplicable scene/object/development and explain it with a rigorous theoretical or philosophical concept that definitively accounts for it (the noumenon behind the phenomenon).\n"
 "2. NOUMENON (thing-in-itself) — name the hidden ontology the WHOLE film secretly rests on (its underlying reality), beyond any single scene.\n"
 "3. SIGNIFIER→SIGNIFIED — read a central signifier (character/object/structure/motif) as an unexpected but defensible signified: a historical event, a social system, or a philosophical concept. Allegory.\n"
 "4. CONTEXT — connect a core text element (form/theme/style) to the CONCRETE production environment that shaped it, and NAME specifics: the historical/social moment, the economic or industry conditions, the technological state of filmmaking, or the director's biography. No vague 'zeitgeist' — cite the actual circumstance.\n"
 "5. PROCESS — link the film's most decisive achievement to the unexpected making/process that caused it (a directorial strategy, a constraint, a technique, a production fact).\n"
 "6. LOCATION — read the tension between the diegetic space (the fiction's place) and the extradiegetic reality of where/how it was actually shot; NAME at least one specific real place (a city, region, studio, or named landscape) explicitly.\n"
 "7. METACRITIC — treat the film's dominant CRITICAL RECEPTION as a cultural symptom: what does the way critics/audiences framed it reveal about the context of that criticism?\n"
 "8. PSYCHOANALYTIC — read a symptomatic behaviour as the eruption of repressed desire or trauma through a psychoanalytic lens.\n"
 "9. ETHICAL-PHILOSOPHICAL — take a pivotal action as a site of moral dilemma and interpret it through a precise ethical theory or concept.\n"
 "10. ETHICO-POLITICAL — read an ethically charged action for how it reinforces or subverts power/ideology; make the precise political STAKE explicit — name the concrete contested issue (who holds power over whom, which right or harm is in dispute) — and set it in its historical context.\n"
 "11. ENIGMA — identify the single most perplexing surface element and the core truth beneath it that resolves it AND ripples out to solve other mysteries in the film.\n"
 "12. PERSONA-PARALLEL — draw ONE profound, counter-intuitive parallel between a central CHARACTER and a specific real-world person. You MUST name exactly one real individual (a person with a name, field, nationality, lifespan) — NEVER a phenomenon, group, movement, or place. Anchor to the character figure; use the parallel to illuminate a truth about both. Emit 0 or 1.\n"
 "13. JUXTAPOSITION — place the FILM's essence (a theme, the central character's crisis, or its aesthetic texture) in dialogue with the life/work of ONE named real individual by the Principle of Exquisite Dissonance: surprising yet inevitable once explained. Name the person precisely (field, nationality, lifespan) and their key works; make the nexus explicit. Not a phenomenon or trend — a single person. Favour someone connected to the film's nationality/setting where it fits. 0–3 strongest.\n"
 "14. TITLE — interpret the film's TITLE itself as the key to what the film is ULTIMATELY about — its single most essential aesthetic message. Quote the English title (and, if the film is non-English, the original-language title too) inside the thesis. Anchor this take to the figure 'title'. This is the deepest possible reading of why the work bears this name. Emit 0 or 1.\n")

INVITATION_RULES=(
 "ALSO write ONE 'Cinematic Invitation' — a spoiler-free introduction that persuades a hesitant cinephile of the "
 "film's depth and significance (it will be the film's intro/landing take). STRICT rules:\n"
 "- A single, seamlessly connected paragraph, THIRD PERSON, ~150–220 words, journalistic and FACT-DENSE (proper "
 "nouns, dates, movements, specific terms). Authoritative and magnetic.\n"
 "- ABSOLUTELY SPOILER-FREE: reveal no plot points, arcs, or twists. (The takes may spoil freely; NEVER let their "
 "spoilers leak into the invitation.)\n"
 "- Follow this 5-part sequence IN ORDER inside the one paragraph: (1) DIRECTOR — name (b. YYYY), stylistic "
 "reputation, position within their oeuvre/lineage; (2) SYMBOLIC LANDSCAPE — two specific place/proper nouns "
 "converging into a symbolic or psychological space; (3) PROTAGONIST — role and name, likened to a canonical "
 "archetype they then transcend or subvert; (4) THE TITLE — the nuance of the original-language title, concluding "
 "in a Hwadu (화두): one profound, lingering question; (5) CINEPHILIC IMPERATIVE — name the specific film "
 "movement/subgenre and how this work advances it.\n"
 "- Use ONLY facts you are confident are accurate (director's birth year, movement, etc.); if unsure of a specific, "
 "write around it rather than inventing.\n")

SYS=("You are FilmCurio's master critic. A 'bold take' is an INTERPRETATION — a revelatory critical reading that "
 "makes a real LEAP, strictly INDEPENDENT of the director's stated intentions (death of the author). It is NOT a "
 "plot summary, not a description of what recurs (that is a 'trope'), and not a safe restatement of a famous theory. "
 "It asserts a claim the surface does not announce, and earns it from concrete evidence in the film's figures.\n\n"
 "You will receive a film and its FIGURES (the concrete things critics single out). Apply these 14 frameworks:\n"
 +FRAMEWORKS+
 "\nFOR EACH framework, internally brainstorm candidates, then OUTPUT ONLY the genuinely potent ones — 0 to 3 per "
 "framework (frameworks 12 and 14 emit 0 or 1). Skip a framework entirely if the film does not strongly support it "
 "(do NOT pad).\n"
 "VARY YOUR VOCABULARY: do not default to the same concept or theorist out of habit — choose the idea the FILM "
 "demands, and range widely across thinkers and traditions rather than reaching for the same few names.\n\n"
 "ANCHORING: each take is anchored to ONE specific FIGURE (use its exact label), or 'film' (genuinely film-wide), "
 "or 'title' (framework 14). Prefer the existing figures; use a fitting new label only if a strong reading truly has "
 "no anchor among them.\n\n"
 "REAL PEOPLE (frameworks 12 & 13): you MUST name exactly one real, specific individual — never a phenomenon, group, "
 "trend, or place. Use only people and facts you are confident are accurate (correct field, nationality, lifespan, and "
 "the real titles of their key works). Do NOT fabricate people, dates, or works, and do NOT attribute invented "
 "quotations. NEVER pair a living person with a criminal, villain, or any defamatory comparison; if the only fit would "
 "defame a living person, skip it. A list of real people ALREADY USED for other films may be provided — avoid reusing "
 "them; pick a fresh, distinct person unless one is uniquely irreplaceable.\n\n"
 "METADATA: for EVERY take also fill: theorist (the named thinker the reading rests on, else null), concept (the named "
 "idea, e.g. 'death drive (Todestrieb)', else null), real_person (frameworks 12/13: the named individual with brief "
 "identity, e.g. 'Glenn Gould (Canadian pianist, 1932–1982)'; else null). Fill theorist/concept ONLY when the reading "
 "genuinely rests on a named thinker/idea — never force or invent an attribution; leave null otherwise.\n\n"
 +INVITATION_RULES+
 "\nReturn ONLY JSON: {\"invitation\":\"<the single spoiler-free invitation paragraph>\",\"takes\":[{\"framework\":\"<one of the 14 names>\","
 "\"figure\":\"<exact figure label, 'film', or 'title'>\",\"title\":\"<bold Title Case interpretive claim>\","
 "\"thesis\":\"<2-3 sentences making the leap>\",\"leap\":\"<one line: what the surface/intent does NOT say but this reading asserts>\","
 "\"strength\":<1-5>,\"theorist\":\"<name or null>\",\"concept\":\"<named idea or null>\",\"real_person\":\"<name (identity) or null>\"}]}")

FW_ORDER=["PHENOMENON→NOUMENON","NOUMENON","SIGNIFIER→SIGNIFIED","CONTEXT","PROCESS","LOCATION",
          "METACRITIC","PSYCHOANALYTIC","ETHICAL-PHILOSOPHICAL","ETHICO-POLITICAL","ENIGMA",
          "PERSONA-PARALLEL","JUXTAPOSITION","TITLE"]

def build_user(film, avoid_persons=None):
    figs="\n".join(f"- {g['label']}: {(g.get('description') or '')[:240]}" for g in film["figs"])
    avoid=""
    if avoid_persons:
        avoid=("\nREAL PEOPLE ALREADY USED for other films — do NOT reuse these (choose someone else): "
               + ", ".join(sorted(avoid_persons)[:250]) + "\n")
    return (f"FILM: {film['title']} ({film.get('year','')}) — dir. {film.get('director','?')}\n"
            f"{('Synopsis: '+film['overview'][:400]) if film.get('overview') else ''}\n"
            f"{avoid}\n"
            f"FIGURES (anchor each take to one of these by exact label):\n{figs}\n\n"
            "Produce the Cinematic Invitation AND the bold takes now (takes: 0–3 per framework across all 14, potent "
            "only, intent-independent, each with theorist/concept/real_person metadata).")

def gen(film, avoid_persons):
    last=None
    for _attempt in range(3):
        text,usage=call_llm(SYS, build_user(film, avoid_persons), max_tokens=MAXTOK)
        try:
            o=parse_json(text)
            return o.get("invitation",""), o.get("takes",[]), usage
        except Exception as e:
            last=e; time.sleep(2)   # malformed/truncated JSON — retry the whole call
    raise RuntimeError(f"parse failed after 3 tries: {last}")

def fetch_film(slug):
    frow=sb(f"films?select=id,slug,title,year,director,overview&slug=eq.{slug}")
    if not frow: return None
    f=frow[0]
    f["figs"]=sb(f"figures?select=label,description&film_id=eq.{f['id']}&status=eq.approved&limit=40")
    return f

def eligible_films():
    # PostgREST caps RPC results (~1000 rows); paginate with limit/offset to get them all.
    # Dedup + break-on-no-new guards against an env where limit/offset is ignored (avoids a loop).
    out=[]; seen=set(); off=0
    while True:
        st,tx=http("POST",f"{URL}/rest/v1/rpc/bold_take_films?limit=1000&offset={off}",
                   {"apikey":KEY,"Authorization":f"Bearer {KEY}"},{})
        if st>=300: raise RuntimeError(f"eligible_films {st}: {tx[:160]}")
        rows=json.loads(tx)
        new=[r["slug"] for r in rows if r.get("slug") and r["slug"] not in seen]
        for s in new: seen.add(s); out.append(s)
        if len(rows)<1000 or not new: break
        off+=1000
    return out

# ---------------- FULL run (resumable JSONL) ----------------
def run_full(films):
    path=f"{OUT}.jsonl"
    done=set(); used=set()
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line=line.strip()
            if not line: continue
            try: o=json.loads(line)
            except Exception: continue
            if o.get("slug"): done.add(o["slug"])
            for t in o.get("takes",[]):
                if t.get("framework") in ("PERSONA-PARALLEL","JUXTAPOSITION"):
                    nm=person_name(t.get("real_person"))
                    if nm: used.add(nm)
    todo=[s for s in films if s not in done]
    print(f"[bold-take v13.3 FULL] model={MODEL}  selection={len(films)}  already-done={len(films)-len(todo)}  todo={len(todo)}  out={path}")
    tin=tout=0; n=0
    fh=open(path,"a",encoding="utf-8")
    for slug in todo:
        try:
            fm=fetch_film(slug)
            if not fm: print(f"  ! {slug}: not found"); continue
            inv,takes,(i,o)=gen(fm, used); tin+=i; tout+=o
            takes=[t for t in takes if int(t.get("strength",0) or 0)>=MIN_STRENGTH]
            for t in takes:
                if t.get("framework") in ("PERSONA-PARALLEL","JUXTAPOSITION"):
                    nm=person_name(t.get("real_person"))
                    if nm: used.add(nm)
            fh.write(json.dumps({"slug":slug,"invitation":inv,"takes":takes},ensure_ascii=False)+"\n"); fh.flush()
            n+=1
            cost=tin/1e6*PRICE_IN+tout/1e6*PRICE_OUT
            if n==1 or n%10==0:
                print(f"  [{n}/{len(todo)}] {slug}: {len(takes)} takes{' +inv' if inv else ' (NO INV!)'} · running ${cost:,.2f}")
            if MAXCOST and cost>=MAXCOST:
                print(f"  ⛔ max-cost ${MAXCOST} reached after {n} films (${cost:,.2f}). Re-run to resume."); break
        except Exception as e:
            print(f"  ! {slug}: {e}")
        time.sleep(1)
    fh.close()
    cost=tin/1e6*PRICE_IN+tout/1e6*PRICE_OUT
    print(f"\n✅ this run: {n} films · ${cost:,.2f} · tokens in {tin:,}/out {tout:,}")
    print(f"   total completed in {path}: {len(done)+n}")
    print(f"   distinct real people used: {len(used)}")

# ---------------- DRY run (readable .md + .json) ----------------
def run_dry(films):
    print(f"[bold-take v13.3] model={MODEL}  films={len(films)}  frameworks=14 + invitation  (DRY — no DB writes)")
    md=[f"# Bold Take v13.3 — Production Worker DRY\n_model {MODEL} · {len(films)} films · Cinematic Invitation + 14 frameworks · +theory metadata_\n"]
    alljson={}; tin=tout=0; total=0; used=set()
    for slug in films:
        try:
            fm=fetch_film(slug)
            if not fm: print(f"  ! {slug}: not found"); continue
            inv,takes,(i,o)=gen(fm, used); tin+=i; tout+=o
            takes=[t for t in takes if int(t.get("strength",0) or 0)>=MIN_STRENGTH]
            for t in takes:
                if t.get("framework") in ("PERSONA-PARALLEL","JUXTAPOSITION"):
                    nm=person_name(t.get("real_person"))
                    if nm: used.add(nm)
            total+=len(takes); alljson[slug]={"invitation":inv,"takes":takes}
            by=defaultdict(list)
            for t in takes: by[t.get("framework","?")].append(t)
            md.append(f"\n## {fm['title']} ({fm.get('year','')}) — {len(takes)} takes · {len(fm['figs'])} figures\n")
            if inv: md.append(f"**The Cinematic Invitation** _(spoiler-free intro)_  \n> {inv.strip()}\n")
            for fw in FW_ORDER:
                for t in by.get(fw,[]):
                    md.append(f"- **{t.get('title','?')}**  ·  *{fw}* · ★{t.get('strength','?')} · via *{t.get('figure','film')}*  \n"
                              f"  {t.get('thesis','').strip()}  \n  ↪ *leap:* {t.get('leap','').strip()}")
                    meta=[]
                    if t.get("theorist"): meta.append(f"theorist: {t['theorist']}")
                    if t.get("concept"): meta.append(f"concept: {t['concept']}")
                    if t.get("real_person"): meta.append(f"person: {t['real_person']}")
                    if meta: md.append(f"  ·  _{' · '.join(meta)}_")
            print(f"  ✓ {slug}: {len(takes)} takes{' +inv' if inv else ' (NO INV!)'} (in {i}/out {o} tok)")
        except Exception as e:
            print(f"  ! {slug}: {e}")
        time.sleep(1)
    cost=tin/1e6*PRICE_IN+tout/1e6*PRICE_OUT; nfilms=max(1,len(alljson)); per=cost/nfilms
    summary=(f"\n---\n## Cost / scale\n- tokens: in {tin:,} · out {tout:,}\n"
             f"- est. cost this run: **${cost:,.2f}** (~${per:.3f}/film @ Opus 4.8 ${PRICE_IN}/${PRICE_OUT} per M)\n"
             f"- extrapolated to 1,934 films: **~${per*1934:,.0f}**\n"
             f"- avg takes/film: {total/nfilms:.1f} · distinct real people: {len(used)}\n")
    md.append(summary); print(summary)
    open(f"{OUT}.md","w",encoding="utf-8").write("\n".join(md))
    open(f"{OUT}.json","w",encoding="utf-8").write(json.dumps(alljson,ensure_ascii=False,indent=2))
    print(f"✅ wrote {OUT}.md and {OUT}.json")

# ---------------- EMIT requests for the Batch API (50% cheaper) ----------------
def run_emit(films):
    out=f"{OUT}.requests.jsonl"
    done=set()
    full=f"{OUT}.jsonl"
    if os.path.exists(full):
        for line in open(full, encoding="utf-8"):
            try: done.add(json.loads(line).get("slug"))
            except Exception: pass
    sub=f"{OUT}.submitted.txt"   # already-submitted (in-flight) films — don't resubmit
    if os.path.exists(sub):
        for line in open(sub, encoding="utf-8"):
            s=line.strip()
            if s: done.add(s)
    todo=[s for s in films if s not in done]
    n=0; skipped=[]
    fh=open(out,"w",encoding="utf-8")
    for slug in todo:
        if not re.match(r"^[A-Za-z0-9_-]{1,64}$", slug or ""):
            skipped.append(slug); continue   # custom_id rule; do these few via the sync runner
        try:
            fm=fetch_film(slug)
            if not fm: print(f"  ! {slug}: not found"); continue
            req={"custom_id":slug,"params":{"model":MODEL,"max_tokens":MAXTOK,"system":SYS,
                 "messages":[{"role":"user","content":build_user(fm)}]}}
            fh.write(json.dumps(req,ensure_ascii=False)+"\n"); n+=1
            if n%100==0: print(f"  emitted {n}/{len(todo)}")
        except Exception as e:
            print(f"  ! {slug}: {e}")
    fh.close()
    print(f"✅ wrote {out}: {n} requests  (already-done {len(films)-len(todo)}, skipped-bad-slug {len(skipped)})")
    if skipped: print("   skipped slugs (run via sync --films):", ", ".join(skipped[:20]))

def main():
    if ALL or EMIT:
        films=eligible_films()
    elif FILMS_ARG:
        films=FILMS_ARG
    else:
        films=PILOT
    if OFFSET: films=films[OFFSET:]
    if LIMIT: films=films[:LIMIT]
    if EMIT: run_emit(films)
    elif ALL: run_full(films)
    else: run_dry(films)

if __name__=="__main__": main()
