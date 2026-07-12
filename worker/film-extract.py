#!/usr/bin/env python3
"""Film figure EXTRACTION (big-bang step for brand-new films).

figure-enrich.py adds takes to films that ALREADY have figures. This script is its
sibling for films that have NONE yet: for each film with zero figures it makes ONE
model call that INVENTS the film's figures (concrete on-screen elements) and writes
3 register-distinct takes per figure, each converging on a META TAKE (an existing
published reading, or a NEW candidate that mt-consolidate will later dedup/merge).

Same house voice / register palette / anti-monoculture / evidence-first rules as
figure-enrich (figure-page-design §6). Two hard safety rules for new content:
  • NO fabricated scholarship — never invent a citation, DOI, or real critic's name.
    These AI takes are uncited house readings (source='ai'); real sources come later.
  • Ground in the film's own TMDB overview + cast (passed in) so figures are real.

Pipeline position:  resolve → tmdb-fetch (gives overview/genres/cast) → THIS →
  mt-embed → mt-consolidate → mt-author → mt-rank → mt-recommend → trope-* → theory-*.

SAFETY: DRY by default (writes bundle JSON, NO DB writes). --persist writes:
  figures(status=approved, source=ai) + takes(status=published, source=ai) and
  candidate meta_takes for new hub proposals. Idempotent: films that already have
  ANY figure are skipped, so re-running continues where it stopped.

Usage:
  python3 film-extract.py --limit 3                 # DRY pilot on 3 figure-less films
  python3 film-extract.py --film sunrise-1927       # DRY on one specific film
  python3 film-extract.py --persist                 # extract ALL figure-less films
  python3 film-extract.py --persist --limit 50      # in batches
  python3 film-extract.py --model claude-opus-4-8   # (default)
"""
import os, sys, json, re, time, urllib.request, urllib.error, urllib.parse
from collections import Counter, defaultdict
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)

def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT, ".env.local"))
URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
ANT = os.environ.get("ANTHROPIC_API_KEY"); GEM = os.environ.get("GEMINI_API_KEY")
if not (URL and KEY): print("Missing env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)"); sys.exit(1)

args = sys.argv[1:]
PERSIST = "--persist" in args
RESET = "--reset" in args   # redo named films: delete their AI figures (cascade takes) then re-extract
LIMIT = int(args[args.index("--limit") + 1]) if "--limit" in args else 100000
OUT = args[args.index("--out") + 1] if "--out" in args else os.path.join(HERE, "film-extract.bundle.json")
FILMS = [args[i + 1] for i, a in enumerate(args) if a == "--film"]
MODELS = [args[args.index("--model") + 1]] if "--model" in args else ["claude-opus-4-8"]
USE_CLAUDE = MODELS[0].startswith("claude")
if USE_CLAUDE and not ANT: print("Missing ANTHROPIC_API_KEY"); sys.exit(1)
if not USE_CLAUDE and not GEM: print("Missing GEMINI_API_KEY"); sys.exit(1)
NFIG_MIN, NFIG_MAX, TAKES = 6, 8, 3

REGISTERS = {
 "formal": "how it is MADE — framing, cut, sound, colour, blocking, performance, rhythm",
 "semiotic": "what it STANDS FOR — motif, metaphor, sign systems",
 "psychoanalytic": "desire, the unconscious, the gaze, fantasy (only when the figure truly earns it)",
 "ideological": "power, representation, whose view is centred, what is made to seem natural",
 "politico_economic": "class, labour, capital, institutions, material/social structure",
 "philosophical": "being, perception, ethics — the moral/ontological situation",
 "existential": "the FELT human situation — mortality, freedom, mood",
 "mythic": "myth, ritual, fairy-tale structure, archetype",
 "genealogical": "film history — lineage, influence, intertext, place in a genre's evolution",
 # NOTE: 'reception' (cited criticism) is intentionally EXCLUDED from extraction — these AI takes
 # are uncited house readings, and reception requires a real source. Cited takes come later/by humans.
}
PALETTE = "\n".join(f"  - {k}: {v}" for k, v in REGISTERS.items())

# figures.kind is CHECK-constrained to exactly these. Map the model's looser kinds in.
KIND_ALLOWED = {"character", "object", "location", "form", "trope"}
KIND_MAP = {"sound": "form", "music": "form", "score": "form", "audio": "form", "voice": "form",
            "motif": "trope", "symbol": "trope", "image": "trope", "theme": "trope", "device": "trope", "pattern": "trope"}
def norm_kind(k):
    k = (k or "").strip().lower(); k = KIND_MAP.get(k, k)
    return k if k in KIND_ALLOWED else "form"

def http(method, url, headers=None, body=None, timeout=240):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:500]
def sb(method, path, body=None, prefer=None):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    if prefer: h["Prefer"] = prefer
    return http(method, f"{URL}/rest/v1/{path}", h, body)
def claude(system, prompt):
    st, tx = http("POST", "https://api.anthropic.com/v1/messages",
        headers={"x-api-key": ANT, "anthropic-version": "2023-06-01"},
        body={"model": MODELS[0], "max_tokens": 20000, "system": system,   # Opus 4.8 rejects `temperature`
              "messages": [{"role": "user", "content": prompt + "\n\nReturn ONLY the raw JSON object — no markdown fences, no prose."}]})
    if st == 200:
        d = json.loads(tx); return "".join(p.get("text", "") for p in (d.get("content") or []) if p.get("type") == "text")
    raise RuntimeError(f"claude {MODELS[0]} {st}: {tx[:200]}")
def gemini(system, prompt):
    gc = {"maxOutputTokens": 32768, "responseMimeType": "application/json"}
    st, tx = http("POST", f"https://generativelanguage.googleapis.com/v1beta/models/{MODELS[0]}:generateContent?key={GEM}",
        body={"contents": [{"role": "user", "parts": [{"text": system}]}, {"role": "user", "parts": [{"text": prompt}]}], "generationConfig": gc})
    if st == 200:
        d = json.loads(tx); return (d.get("candidates") or [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    raise RuntimeError(f"gemini {MODELS[0]} {st}: {tx[:200]}")
def model_call(system, prompt):
    return claude(system, prompt) if USE_CLAUDE else gemini(system, prompt)
def _repair_json(s):
    """Re-escape stray double-quotes / raw control chars inside string values (common LLM
    JSON defect: unescaped inner quotes like  "meaning "the swamp"..." )."""
    out = []; in_str = False; esc = False; n = len(s)
    for i, ch in enumerate(s):
        if esc: out.append(ch); esc = False; continue
        if ch == "\\": out.append(ch); esc = True; continue
        if ch == '"':
            if not in_str: in_str = True; out.append(ch); continue
            j = i + 1
            while j < n and s[j] in " \t\r\n": j += 1
            nxt = s[j] if j < n else ""
            if nxt in ",:}]" or nxt == "": in_str = False; out.append(ch)
            else: out.append('\\"')
            continue
        if in_str and ch in "\n\r\t": out.append({"\n": "\\n", "\r": "\\r", "\t": "\\t"}[ch]); continue
        out.append(ch)
    return "".join(out)

def parse(t):
    s = (t or "").strip()
    if s.startswith("```"): s = re.sub(r"^```[a-z]*\n?", "", s); s = re.sub(r"\n?```$", "", s)
    i = s.find("{"); e = s.rfind("}")
    if i >= 0 and e > i: s = s[i:e + 1]
    try: return json.loads(s)
    except Exception:
        try: return json.loads(_repair_json(s))
        except Exception: return None
def fetch_all(path):
    rows = []; off = 0
    while True:
        st, tx = sb("GET", f"{path}{'&' if '?' in path else '?'}limit=1000&offset={off}")
        if st != 200: raise RuntimeError(f"{st}: {tx[:200]}")
        b = json.loads(tx); rows += b
        if len(b) < 1000: break
        off += 1000
    return rows
def slugify(s):
    s = re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-"); return s[:60] or "x"

SYSTEM = (
"You are Metatake's resident film critic. Given ONE film, you IDENTIFY its most reading-worthy FIGURES and "
"write criticism on each. A FIGURE is a CONCRETE on-screen element — a character, an object, a location, a "
"recurring image or sound, or a formal device (a kind of shot, a cut, a colour). For each figure you write "
"critical readings ('takes'), each entered through a different CRITICAL REGISTER (the MODE of attention = the "
"ROUTE in) and converging on a META TAKE (a shared, reusable concept = the DESTINATION).\n\n"
"START FRESH: reason ONLY from the film and the details I give you below (overview, cast). Build every reading "
"from the movie itself.\n\n"
"REGISTERS (use only ones a figure genuinely rewards):\n" + PALETTE + "\n\n"
"HARD RULES:\n"
f"1. PICK {NFIG_MIN}-{NFIG_MAX} figures that genuinely reward attention — the elements a thoughtful viewer would "
"   stop on. Mix kinds — use ONLY these five: character, object, location, form (ANY formal/sonic device — a kind "
"   of shot, cut, score, sound, colour, camera move), trope (a recurring motif, image, or device). A sound or a "
"   score is kind 'form'; a recurring motif is kind 'trope'. Avoid plot-summary; pick ELEMENTS.\n"
f"2. PER FIGURE: exactly {TAKES} takes, all in DISTINCT registers and DISTINCT meta takes.\n"
"3. ACROSS THE FILM: SPREAD the registers — no single register should lead more than ~2 figures, and VARY which "
"   register leads. Do NOT default to `psychoanalytic` or `ideological`; for a political film, ideology is one "
"   route among ten, not the lead for everything.\n"
"4. EVIDENCE-FIRST: every take names something specific on screen (a shot, cut, line, gesture, sound, colour) "
"   before any abstraction. No screen anchor -> no take.\n"
"5. CONVERGENCE: metatake.ref MUST be EXACTLY one of the slugs in the EXISTING META TAKES list I give you below — "
"   copy it verbatim. If none fits, use metatake.new instead — NEVER invent or transliterate a ref slug. "
"   metatake.new = a CONCRETE, memorable phenomenon with a twist (TV-Tropes-like, e.g. 'Extractive Empathy'), "
"   NEVER a dry abstraction, with a <=14-word laconic, reusable across films. Prefer linking to provided hubs; "
"   at most ~1 new per figure.\n"
"6. VOICE (house): rationale = ONE paragraph, ~70-90 words, present tense, conversational — a sharp friend who "
"   just noticed something, not a seminar. SHOW the idea; do NOT name the theory. BANNED in rationale text: "
"   'ideological','naturalize(s)','signifier','semiotic','politico-economic','hegemon','discourse','the gaze',"
"   'problematize','lens','trope','archetype','monomyth'. The register name lives ONLY in the register field.\n"
"7. NO FABRICATED SCHOLARSHIP: never invent a citation, DOI, book, journal, or attribute a claim to a real named "
"   critic or theorist. No first person. These are uncited readings.\n"
"8. DESCRIPTION: dry and OBSERVATIONAL — only what is on screen. NAME the film once inside the description so the "
"   figure is self-identifying when read alone.\n\n"
"Return ONLY JSON:\n"
'{"film_intro":"<=40 words, what makes this film reward close attention>,'
'"figures":[{"label":"<short noun phrase>","kind":"<character|object|location|form|trope>",'
'"description":"<dry observational, names the film once, ~1-2 sentences>",'
'"character_names":"<comma list if a character, else empty>",'
'"image_query":"<google-image search that would surface this figure>",'
'"youtube_query":"<youtube search for the relevant scene/clip>",'
'"register_fit":["<registers this figure rewards, ranked>"],'
'"takes":[{"register":"<one>","angle":"<short sub-angle, becomes the concept name>","evidence":"<on-screen>",'
'"rationale":"<70-90 words>","metatake":{"ref":"<slug>"}|{"new":{"title":"<Noun Phrase>","laconic":"<line>"}},'
'"confidence":<0..1>}]}]}'
)

def build_user(film, pool, avoid):
    extra = film.get("tmdb_extra") or {}
    cast = ", ".join([c.get("name", "") for c in (extra.get("cast") or [])][:8]) if isinstance(extra, dict) else ""
    genres = ", ".join(film.get("genres") or []) if isinstance(film.get("genres"), list) else (film.get("genres") or "")
    pool_lines = [f'  - {m["slug"]}: {m["title"]} — {m.get("laconic") or ""}' for m in pool]
    return (
      f'FILM: {film["title"]} ({film.get("year") or "?"}), dir. {film.get("director") or "?"}\n'
      f'Genres: {genres or "—"}\nCast: {cast or "—"}\n'
      f'Overview: {(film.get("overview") or "—")[:900]}\n\n'
      f'Identify {NFIG_MIN}-{NFIG_MAX} figures and write {TAKES} register-distinct takes each, spreading registers across the film.\n\n'
      f'Registers to AVOID over-using (already heavy across this run): {avoid or "—"}.\n\n'
      f'EXISTING meta takes you may link to (prefer these; propose new only if none fits):\n'
      + ("\n".join(pool_lines) or "  (none)") + "\n\nJSON only."
    )

def main():
    if RESET and not FILMS:
        print("--reset requires explicit --film slugs (safety: it deletes those films' AI figures)."); sys.exit(1)
    # films with a tmdb_id and ZERO figures (or, under --reset, the named films regardless)
    fig_film_ids = {r["film_id"] for r in fetch_all("figures?select=film_id")}
    sel = "id,slug,title,year,director,overview,genres,tmdb_extra"
    films_all = fetch_all(f"films?select={urllib.parse.quote(sel, safe=',')}&tmdb_id=not.is.null")
    targets = films_all if RESET else [f for f in films_all if f["id"] not in fig_film_ids]
    if FILMS: targets = [f for f in targets if f["slug"] in FILMS]
    targets = targets[:LIMIT]
    miss_meta = sum(1 for f in targets if not (f.get("overview")))
    print(f"[extract] figure-less films: {len([f for f in films_all if f['id'] not in fig_film_ids])} | processing {len(targets)} "
          f"(model {MODELS[0]}){'' if PERSIST else '  [DRY — bundle JSON, no DB]'}")
    if miss_meta: print(f"  ⚠ {miss_meta} of these have NO overview yet — run tmdb-fetch first for best grounding.")
    if not targets: print("  nothing to do (all films have figures)."); return

    pool = fetch_all("meta_takes?select=slug,title,laconic&status=eq.published&kind=eq.reading")
    pool_slugs = {m["slug"] for m in pool}
    print(f"  reading hub pool: {len(pool)} published")

    bundle = []; corpus = Counter(); nfig = ntake = ncand = 0
    for film in targets:
        avoid = sorted({r for r, c in corpus.items() if c >= max(3, len(targets) // 3)})
        try:
            out = parse(model_call(SYSTEM, build_user(film, pool, avoid))) or {}
        except Exception as e:
            print(f"  ! {film['slug']}: {e}"); continue
        figs_out = out.get("figures", []) or []
        rec = {"film": film["slug"], "title": film["title"], "film_intro": out.get("film_intro", ""), "figures": []}
        if PERSIST and RESET:   # clean redo: drop this film's prior AI figures (takes cascade), keep human/seed data
            sb("DELETE", f"figures?film_id=eq.{film['id']}&source=eq.ai", prefer="return=minimal")
        fseen = set(); film_regs = Counter()
        for fo in figs_out:
            label = (fo.get("label") or "").strip()
            if not label: continue
            fslug = slugify(label)
            if fslug in fseen: continue
            fseen.add(fslug)
            seen_reg = set(); seen_mt = set(); clean = []
            for t in fo.get("takes", []):
                reg = t.get("register")
                if reg not in REGISTERS or reg in seen_reg: continue
                if not (t.get("evidence") and t.get("rationale")): continue
                mt = t.get("metatake") or {}
                if mt.get("ref") and mt["ref"] not in pool_slugs:  # invented ref -> treat as new candidate
                    mt = {"new": {"title": mt["ref"].replace("-", " ").title(), "laconic": ""}}; t["metatake"] = mt
                key = mt.get("ref") or json.dumps(mt.get("new") or {}, sort_keys=True)
                if not key or key in seen_mt: continue
                seen_reg.add(reg); seen_mt.add(key); clean.append(t)
            if not clean: continue
            for t in clean: film_regs[t["register"]] += 1; corpus[t["register"]] += 1
            rec["figures"].append({**fo, "slug": fslug, "takes": clean})
            nfig += 1; ntake += len(clean)
            if PERSIST: ncand += persist(film, fo, fslug, clean, pool_slugs)
        print(f"  · {film['slug']}: {len(rec['figures'])} figures, {sum(len(x['takes']) for x in rec['figures'])} takes, spread {dict(film_regs)}")
        bundle.append(rec)
        time.sleep(0.3)

    if not PERSIST:
        json.dump({"model": MODELS[0], "films": bundle}, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print(f"\n[extract] DRY done: {nfig} figures / {ntake} takes across {len(bundle)} films → {OUT}")
        print("  Review: are the figures real & concrete? register spread (no monoculture)? evidence-first? no invented citations? hubs linked vs new?")
    else:
        print(f"\n[extract] PERSIST done: {nfig} figures, {ntake} takes ({ncand} new hub candidates).")
        print("  Next: mt-embed → mt-consolidate → mt-author → mt-rank → mt-recommend → trope-* → theory-*.")

def persist(film, fo, fslug, takes, pool_slugs):
    """Insert one figure + its takes. New hub proposals -> candidate meta_takes."""
    new_cands = 0
    body = {"film_id": film["id"], "label": fo["label"].strip(), "slug": fslug,
            "kind": norm_kind(fo.get("kind")), "description": (fo.get("description") or "").strip() or None,
            "character_names": (fo.get("character_names") or "").strip() or None,
            "image_query": (fo.get("image_query") or "").strip() or None,
            "youtube_query": (fo.get("youtube_query") or "").strip() or None,
            "status": "approved", "source": "ai", "generated_by": MODELS[0]}
    st, tx = sb("POST", "figures", body, prefer="return=representation")
    if st >= 300 or not json.loads(tx): print(f"    ! figure insert {st}: {tx[:160]}"); return 0
    fig_id = json.loads(tx)[0]["id"]
    for t in takes:
        mt = t.get("metatake") or {}; meta_id = None
        if mt.get("ref"):
            st, tx = sb("GET", f"meta_takes?select=id&slug=eq.{urllib.parse.quote(mt['ref'])}&limit=1")
            if st == 200 and json.loads(tx): meta_id = json.loads(tx)[0]["id"]
        if not meta_id and mt.get("new"):
            title = (mt["new"].get("title") or t.get("angle") or "Untitled")[:200]; s = slugify(title)
            st, tx = sb("POST", "meta_takes?on_conflict=slug", {"slug": s, "title": title, "laconic": mt["new"].get("laconic"),
                        "kind": "reading", "status": "candidate", "source": "ai"}, prefer="return=representation,resolution=merge-duplicates")
            if st < 300 and json.loads(tx): meta_id = json.loads(tx)[0]["id"]; new_cands += 1
        if not meta_id: continue
        sb("POST", "takes", {"figure_id": fig_id, "meta_take_id": meta_id,
            "rationale": (t.get("rationale") or "").strip(), "register": t["register"], "angle": t.get("angle"),
            "raw_concept": t.get("angle"), "confidence": t.get("confidence"),
            "source": "ai", "status": "published"}, prefer="return=minimal")
    return new_cands

if __name__ == "__main__": main()
