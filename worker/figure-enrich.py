#!/usr/bin/env python3
"""Figure enrichment v2 (figure-page-design.md §8) — ONE call per FILM.

The seed imported ONE take per figure. This pass takes ALL of a film's figures
that need enrichment and sends them in a SINGLE model call, so the model can
SPREAD critical registers ACROSS the figures (killing the per-figure monoculture
the v1 one-call-per-figure version produced) and write a short film intro for
context. Each figure ends with >=3 takes in distinct registers, each converging
on a (shared) meta take. Output follows the v2 contract (figure-page-design §6.6).

What it also generates now (the genuine setup gaps): a deterministic figure.slug,
and a register classification for the existing seed take (existing_take_register).

Anti-repetition (§6.3): handled by (a) one-call cross-figure spread instruction,
(b) banned default reflexes (psychoanalytic AND ideological), (c) evidence-first,
(d) post-checks here. why-this/why-now is a gentle steer, woven into prose.

NOT done here (by design — downstream, see figure-page-KEPT.md A): clustering /
dedup of new hub candidates (mt-consolidate, OpenAI embeddings), hub authoring
(mt-author), ranking (mt-rank), recommendations (mt-recommend), Crossref sources.

SAFETY: default DRY (writes bundle JSON, NO DB writes). --persist needs 0014.

Usage:
  python3 figure-enrich.py --film forrest-gump-1994 [--model gemini-3.1-pro] [--out f.json]
  python3 figure-enrich.py --film forrest-gump-1994 --persist
"""
import os, sys, json, re, time, random, urllib.request, urllib.error, urllib.parse
from collections import Counter, defaultdict
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)

def load_env(p):
    if not os.path.exists(p): return
    for line in open(p,encoding="utf-8"):
        line=line.strip()
        if line and not line.startswith("#") and "=" in line:
            k,_,v=line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT,".env.local"))
URL=os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY=os.environ.get("SUPABASE_SERVICE_ROLE_KEY"); GEM=os.environ.get("GEMINI_API_KEY")
if not (URL and KEY and GEM): print("Missing env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / GEMINI_API_KEY)"); sys.exit(1)

args=sys.argv[1:]
PERSIST="--persist" in args
LIMIT=int(args[args.index("--limit")+1]) if "--limit" in args else 100000          # max FILMS to process
OUT=args[args.index("--out")+1] if "--out" in args else os.path.join(HERE,"figure-enrich.bundle.json")
FILMS=[args[i+1] for i,a in enumerate(args) if a=="--film"]
FILM_LIKE=args[args.index("--film-like")+1] if "--film-like" in args else None  # resolve slug by title
TARGET=3
# Gemini 3.1 Pro for quality + reasoning. Confirm the exact API string for your key;
# falls back if the first is rejected (404). Override with --model.
MODELS=[args[args.index("--model")+1]] if "--model" in args else ["gemini-3.1-pro-preview","gemini-3.1-pro"]  # 3.1 only — fail loud, no silent downgrade

REGISTERS={
 "formal":"how it is MADE — framing, cut, sound, colour, blocking, performance, rhythm",
 "semiotic":"what it STANDS FOR — motif, metaphor, sign systems",
 "psychoanalytic":"desire, the unconscious, the gaze, fantasy (use only when the figure truly earns it)",
 "ideological":"power, representation, whose view is centred, what is made to seem natural",
 "politico_economic":"class, labour, capital, institutions, material/social structure",
 "philosophical":"being, perception, ethics — the moral/ontological situation",
 "existential":"the FELT human situation — mortality, freedom, mood",
 "mythic":"myth, ritual, fairy-tale structure, archetype",
 "genealogical":"film history — lineage, influence, intertext, place in a genre's evolution",
 "reception":"what real critics/scholars have actually argued (cited; needs a source before publish)",
}

def http(method,url,headers=None,body=None,timeout=240):
    req=urllib.request.Request(url,method=method,data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type","application/json")
    for k,v in (headers or {}).items(): req.add_header(k,v)
    try:
        with urllib.request.urlopen(req,timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:500]
def sb(method,path,body=None,prefer=None):
    h={"apikey":KEY,"Authorization":f"Bearer {KEY}"}
    if prefer: h["Prefer"]=prefer
    return http(method,f"{URL}/rest/v1/{path}",h,body)
def gemini(system,prompt,temp=0.7):
    """Quality call: allow the model to think (Pro), big output budget, JSON out.
    Tries each model; on 400 retries with a smaller budget; on 404 next model."""
    last=""
    for m in MODELS:
        for toks in (32768, 8192):
            gc={"temperature":temp,"maxOutputTokens":toks,"responseMimeType":"application/json"}
            st,tx=http("POST",f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={GEM}",
                body={"contents":[{"role":"user","parts":[{"text":system}]},{"role":"model","parts":[{"text":"Understood. I will start fresh from only what you give me."}]},
                      {"role":"user","parts":[{"text":prompt}]}],"generationConfig":gc})
            if st==200:
                d=json.loads(tx); cand=(d.get("candidates") or [{}])[0]
                return cand.get("content",{}).get("parts",[{}])[0].get("text","")
            last=f"{m} {st}: {tx[:160]}"
            if st==404: break          # model absent -> next model
            if st==400: continue       # budget/config rejected -> smaller budget
            raise RuntimeError(f"gemini {last}")
    raise RuntimeError(f"no model ({last})")
def parse(t):
    try: return json.loads(t)
    except Exception:
        s=t.find("{"); e=t.rfind("}")
        if s>=0 and e>s:
            try: return json.loads(t[s:e+1])
            except Exception: return None
    return None
def fetch_all(path):
    rows=[]; off=0
    while True:
        st,tx=sb("GET",f"{path}{'&' if '?' in path else '?'}limit=1000&offset={off}")
        if st!=200: raise RuntimeError(f"{st}: {tx[:200]}")
        b=json.loads(tx); rows+=b
        if len(b)<1000: break
        off+=1000
    return rows
def slugify(s):
    s=re.sub(r"[^a-z0-9]+","-",(s or "").lower()).strip("-"); return s[:60] or "x"
def norm_label(s): return re.sub(r"[^a-z0-9]+"," ",(s or "").lower()).strip()
def chunked(seq,n):
    for i in range(0,len(seq),n): yield seq[i:i+n]

PALETTE="\n".join(f"  - {k}: {v}" for k,v in REGISTERS.items())
SYSTEM=(
"You are FilmCurio's critic. You ENRICH every figure of ONE film in a SINGLE pass. A figure is a "
"concrete on-screen element. For each you write extra critical readings ('takes'), each entered through a "
"different CRITICAL REGISTER (the MODE of attention = the ROUTE in) and converging on a META TAKE (the "
"shared concept = the DESTINATION). Diversify routes; let destinations be shareable across films.\n\n"
"START FRESH: reason ONLY from the film and the figures I give you below. Assume NO prior conversation, no "
"earlier drafts, no outside context about this task. Build the reading from the movie itself.\n\n"
"REGISTERS (use only ones a figure genuinely rewards):\n"+PALETTE+"\n\n"
"WHY THIS / WHY NOW: prefer the figures and readings that actually reward attention — what makes this "
"element worth stopping on, and why the reading still matters to a viewer today. Weave that pull INTO the "
"prose; never label it.\n\n"
"HARD RULES:\n"
"1. PER FIGURE: >=3 NEW takes, all in DISTINCT registers and DISTINCT meta takes. Do not reuse a register "
"   already on that figure (including the register you assign to its existing seed take).\n"
"2. ACROSS THE FILM (you see all figures at once — use that): SPREAD the registers. No single register "
"   should sit on more than ~2 of the film's figures unless each truly earns it, and VARY which register "
"   LEADS each figure. Do NOT default to `psychoanalytic` or `ideological` — for a political film, ideology "
"   is one route among ten, not the lead for everything.\n"
"3. EVIDENCE-FIRST: every take names something specific on screen (a shot, cut, line, gesture, sound, "
"   colour) before any abstraction. No screen anchor -> no take.\n"
"4. CONVERGENCE: metatake.ref MUST be EXACTLY one of the slugs in the EXISTING META TAKES list I give you "
"   below — copy the slug verbatim. If the concept you want is NOT in that list, you MUST use metatake.new "
"   instead — NEVER invent, guess, or transliterate a ref slug. metatake.new = a CONCRETE, memorable "
"   phenomenon with a twist (TV-Tropes-like, e.g. 'Extractive Empathy'), NEVER a dry abstraction, with a "
"   <=14-word laconic, reusable across films. Prefer linking to the provided hubs; at most ~1 new per figure.\n"
"5. VOICE (house): rationale = ONE paragraph, ~70-90 words, present tense, conversational — a sharp friend "
"   who just noticed something, not a seminar. SHOW the idea; do NOT name the theory. BANNED in rationale "
"   text: 'ideological','naturalize(s)','signifier','semiotic','politico-economic','hegemon','discourse', "
"   'the gaze','problematize','lens','trope','archetype','monomyth'. The register name lives ONLY in the "
"   register field. No first person, no named real critics in the prose.\n"
"6. DESCRIPTION: dry and OBSERVATIONAL — only what is on screen (rewrite the given one only if it slips "
"   into interpretation). NAME the film once inside the description (open with the title or weave it in "
"   naturally) so the figure is self-identifying when read on its own. CLASSIFY the seed take into one "
"   register (existing_take_register).\n\n"
"Return ONLY JSON:\n"
'{"figures":[{"figure_id":"<echo exactly>","label":"<echo the figure label>","description":"<dry observational, names the film once>",'
'"register_fit":["<registers this figure rewards, ranked>"],'
'"existing_take_register":"<one register for the seed take>",'
'"new_takes":[{"register":"<one>","angle":"<short sub-angle>","evidence":"<on-screen>",'
'"rationale":"<70-90 words>","metatake":{"ref":"<slug>"}|{"new":{"title":"<Noun Phrase>","laconic":"<line>"}},'
'"confidence":<0..1>}]}]}'
)

def build_user(film, figs, pool, avoid):
    lines=[]
    for i,f in enumerate(figs,1):
        ex=f.get("takes") or []
        exl=" / ".join((t.get("rationale") or "")[:150] for t in ex) or "(none)"
        exmt=", ".join(((t.get("meta_take") or {}).get("slug") or "—") for t in ex) or "—"
        lines.append(f'FIGURE {i}  id={f["id"]}  "{f["label"]}"  (kind: {f.get("kind") or "?"})\n'
                     f'   current description: {(f.get("description") or "—")[:300]}\n'
                     f'   existing seed take: {exl}\n   existing hub link: {exmt}')
    pool_lines=[f'  - {m["slug"]}: {m["title"]} — {m.get("laconic") or ""}' for m in pool]  # inject ALL hubs (ref must come from here)
    return (
      f'FILM: {film["title"]} ({film.get("year") or "?"}), dir. {film.get("director") or "?"}\n'
      f'Enrich ALL {len(figs)} figures below IN ONE PASS, spreading registers across them.\n\n'
      +"\n\n".join(lines)+"\n\n"
      f'Registers to AVOID over-using (already heavy elsewhere): {avoid or "—"}.\n\n'
      f'EXISTING meta takes you may link to (prefer these; propose new only if none fits):\n'
      +("\n".join(pool_lines) or "  (none)")+"\n\n"
      f'Echo each figure_id exactly so I can match. JSON only.'
    )

def need_enrich(f):
    takes=f.get("takes") or []; regs={t.get("register") for t in takes if t.get("register")}
    return (len(regs) < TARGET) and (len(takes) < TARGET or len(regs) < TARGET)

def main():
    if FILM_LIKE:                                   # resolve film slug(s) by title search
        pat="*"+"*".join(FILM_LIKE.split())+"*"
        st,tx=sb("GET","films?select=slug,title,year&title=ilike."+urllib.parse.quote(pat))
        matched=json.loads(tx) if st==200 else []
        if not matched:
            print(f"  NO FILM matching title '{FILM_LIKE}' in the DB — it is likely NOT seeded.")
            print(f"  (enrichment only works on films that already have figures; a brand-new film needs the extraction pass.)")
            return
        print("  matched film(s):", ", ".join(f"{m['title']} ({m.get('year')}) [{m['slug']}]" for m in matched))
        FILMS.extend(m["slug"] for m in matched)
    def figures_query(with_register=True):
        tk=("takes(id,rationale,register,meta_take:meta_takes(slug,title))" if with_register
            else "takes(id,rationale,meta_take:meta_takes(slug,title))")
        sel="id,label,kind,description,status,film:films!inner(title,year,director,slug),"+tk
        q="figures?select="+urllib.parse.quote(sel,safe='!,():*')+"&status=eq.approved"
        if FILMS: q+="&film.slug=in.("+",".join(FILMS)+")"
        return q
    figs=None
    for wr in (True, False):
        try: figs=fetch_all(figures_query(wr)); break
        except RuntimeError as e:
            if wr and "register" in str(e).lower(): print("  (pre-0014: takes.register absent, falling back)"); continue
            raise
    todo=[f for f in figs if need_enrich(f)]
    by_film=defaultdict(list)
    for f in todo: by_film[f["film"]["slug"]].append(f)
    films=list(by_film.items())[:LIMIT]
    print(f"[enrich v2] {sum(len(v) for _,v in films)} figures across {len(films)} films "
          f"(model {MODELS[0]}){'' if PERSIST else '  [DRY — bundle JSON, no DB]'}")
    if not films: print("  nothing to do"); return

    pool=fetch_all("meta_takes?select=slug,title,laconic&status=eq.published")
    pool_slugs={m["slug"] for m in pool}                 # valid ref targets (the ONLY allowed refs)
    print(f"  meta-take pool: {len(pool)} published")
    corpus=Counter()  # registers used so far across films this run (anti-monoculture, cross-film)

    bundle=[]; made=0; invented_refs=0; CHUNK=6   # ≤6 figures/call → avoids 16K output truncation
    for slug,group in films:
        film=group[0]["film"]
        film_mts={(t.get("meta_take") or {}).get("slug") for f in group for t in (f.get("takes") or []) if t.get("meta_take")}
        relevant=[m for m in pool if m["slug"] in film_mts]
        sample=relevant+[m for m in pool if m["slug"] not in film_mts]   # inject the FULL hub list, relevant first
        film_rec={"film":slug,"figures":[]}; film_regs=Counter(); matched=0
        for chunk in chunked(group, CHUNK):
            avoid=sorted({r for r,c in corpus.items() if c>=max(2,len(group))})
            try:
                out=parse(gemini(SYSTEM, build_user(film, chunk, sample, avoid))) or {}
            except Exception as e:
                print(f"  ! {slug} chunk: {e}"); continue
            byid={f["id"]:f for f in chunk}
            bylabel={norm_label(f["label"]):f for f in chunk}
            for fo in out.get("figures",[]):
                fig=byid.get(fo.get("figure_id")) or bylabel.get(norm_label(fo.get("label","")))   # id → label fallback
                if not fig: continue
                seen_reg=set(); seen_mt=set(); clean=[]
                for t in fo.get("new_takes",[]):
                    reg=t.get("register")
                    if reg not in REGISTERS or reg in seen_reg: continue
                    if not (t.get("evidence") and t.get("rationale")): continue
                    mt=t.get("metatake") or {}
                    if mt.get("ref") and mt["ref"] not in pool_slugs:   # invented ref -> new candidate (don't drop)
                        mt={"new":{"title":mt["ref"].replace("-"," ").title(),"laconic":""}}; t["metatake"]=mt; invented_refs+=1
                    key=mt.get("ref") or json.dumps(mt.get("new") or {},sort_keys=True)
                    if not key or key in seen_mt: continue
                    seen_reg.add(reg); seen_mt.add(key); clean.append(t)
                for t in clean: film_regs[t["register"]]+=1; corpus[t["register"]]+=1
                film_rec["figures"].append({
                    "figure_id":fig["id"],"label":fig["label"],"slug":slugify(fig["label"]),
                    "kind":fig.get("kind"),"description":fo.get("description") or fig.get("description"),
                    "register_fit":fo.get("register_fit"),
                    "existing_take_register":fo.get("existing_take_register"),
                    "existing_takes":len(fig.get("takes") or []),"new_takes":clean})
                made+=len(clean); matched+=1
                if PERSIST: persist(fig, fo, clean)
            time.sleep(0.4)
        if matched < len(group):
            print(f"  ⚠ {slug}: {matched}/{len(group)} figures matched — re-run (idempotent) to fill the rest.")
        print(f"  · {slug}: {len(film_rec['figures'])} figures, register spread {dict(film_regs)}")
        bundle.append(film_rec)

    if not PERSIST:
        json.dump({"target":TARGET,"model":MODELS[0],"films":bundle}, open(OUT,"w",encoding="utf-8"), ensure_ascii=False, indent=2)
        print(f"[enrich v2] DRY done: {made} new takes ({invented_refs} invented refs -> new candidates) → {OUT}")
        print("  Inspect: register spread across the film (no monoculture), evidence-first, refs vs new, voice.")
    else:
        print(f"[enrich v2] PERSIST done: {made} takes. Next (downstream): mt-consolidate, mt-author, mt-rank, mt-recommend.")

def persist(fig, fo, takes):
    """Set figure slug + dry description, classify the seed take's register, insert new AI takes.
    New hub proposals -> candidate meta_takes (mt-consolidate dedups later). Requires 0014."""
    upd={}
    if fo.get("description"): upd["description"]=fo["description"].strip()
    upd["slug"]=slugify(fig["label"])
    sb("PATCH",f"figures?id=eq.{fig['id']}",upd,prefer="return=minimal")
    ex=(fig.get("takes") or [])
    if ex and fo.get("existing_take_register") in REGISTERS:
        sb("PATCH",f"takes?id=eq.{ex[0]['id']}",{"register":fo["existing_take_register"]},prefer="return=minimal")
    for t in takes:
        mt=t.get("metatake") or {}; meta_id=None
        if mt.get("ref"):
            st,tx=sb("GET",f"meta_takes?select=id&slug=eq.{urllib.parse.quote(mt['ref'])}&limit=1")
            if st==200 and json.loads(tx): meta_id=json.loads(tx)[0]["id"]
        if mt.get("ref") and not meta_id:        # ref still unresolved -> create candidate, never drop the take
            title=mt["ref"].replace("-"," ").title()[:200]
            st,tx=sb("POST","meta_takes",{"slug":slugify(title),"title":title,"status":"candidate","source":"ai"},prefer="return=representation")
            if st<300 and json.loads(tx): meta_id=json.loads(tx)[0]["id"]
        if not meta_id and mt.get("new"):
            title=(mt["new"].get("title") or "Untitled")[:200]; s=slugify(title)
            st,tx=sb("POST","meta_takes",{"slug":s,"title":title,"laconic":mt["new"].get("laconic"),
                     "status":"candidate","source":"ai"},prefer="return=representation")
            if st<300 and json.loads(tx): meta_id=json.loads(tx)[0]["id"]
        if not meta_id: continue
        st,_=sb("POST","takes",{"figure_id":fig["id"],"meta_take_id":meta_id,
              "rationale":(t.get("rationale") or "").strip(),"register":t["register"],"angle":t.get("angle"),
              "confidence":t.get("confidence"),"source":"ai","status":"published"},prefer="return=minimal")
        if st<300:
            sb("POST","content_events",{"entity_type":"take","entity_id":fig["id"],
               "event":"take_enriched","actor_kind":"ai","meta":{"register":t["register"]}},prefer="return=minimal")

if __name__=="__main__": main()
