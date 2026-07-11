#!/usr/bin/env python3
"""director-facts-gen — "The Life": Opus 4.8 writes ~30 interesting person-facts FREELY, then each
fact is VERIFIED against a real Brave web search (English + the director's NATIVE language). Kept facts
carry a real, live, reputable corroborating link.

Flow per director (the user's spec — free writing, Brave verification, native too):
  1) native_meta  — small Anthropic call → native-script name + language.
  2) GENERATE     — Opus claude-opus-4-8, full knowledge, ~30 rich facts (numbers + proper nouns +
                    name etymology). No source constraint → richness/interestingness restored.
  3) VERIFY       — for EACH fact: Brave search in English (+ native language for non-English directors)
                    → candidate pages. A judge model (Sonnet) decides, per fact, whether the candidates
                    corroborate the specific claim and picks the best corroborating URL.
  4) KEEP facts that are corroborated AND whose chosen URL is alive AND on a trusted domain.

Output: {name_meaning, intro, facts:[{n,text,source}]}. English prose; sources may be native pages.

Usage:
  python3 director-facts-gen.py                              # DRY pilot (3) → director-facts-dry.md/.json
  python3 director-facts-gen.py --dirs bong-joon-ho,akira-kurosawa
  python3 director-facts-gen.py --all --min-films 3 --out worker/director-facts-all   # sync, resumable
"""
import os, sys, json, re, time, urllib.request, urllib.error, urllib.parse
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
def load_env(p):
    if not os.path.exists(p): return
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("="); os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load_env(os.path.join(ROOT, ".env.local"))
URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL"); KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
ANT = os.environ.get("ANTHROPIC_API_KEY"); BRAVE = os.environ.get("BRAVE_API_KEY")
GEM = os.environ.get("GEMINI_API_KEY")
args = sys.argv[1:]
GEN_MODELS = ["gemini-3.1-pro-preview"]   # writer — only the 3.1 preview exists; GA "gemini-3.1-pro" 404s
GEN_FALLBACK = args[args.index("--gen-fallback") + 1] if "--gen-fallback" in args else "claude-opus-4-8"  # writer fallback when Gemini is rate-limited
JUDGE_MODEL = args[args.index("--judge-model") + 1] if "--judge-model" in args else "claude-sonnet-4-6"  # verifier
OUT = args[args.index("--out") + 1] if "--out" in args else "director-facts-dry"
ALLRUN = "--all" in args
MIN_FILMS = int(args[args.index("--min-films") + 1]) if "--min-films" in args else 3
DIRS_ARG = (args[args.index("--dirs") + 1].split(",")) if "--dirs" in args else None
N_FACTS = 30
if not (URL and KEY and ANT and GEM): sys.exit("Missing env (SUPABASE + ANTHROPIC_API_KEY + GEMINI_API_KEY)")
if not BRAVE: sys.exit("Missing BRAVE_API_KEY (required for verification)")

PILOT = ["bong-joon-ho", "hayao-miyazaki", "christopher-nolan"]
BLOCK_DOMAINS = ("quora.com", "reddit.com", "diy.org", "quizlet.com", "pinterest.", "facebook.com",
                 "twitter.com", "x.com", "tiktok.com", "instagram.com", "medium.com", "weebly.com",
                 "posfie.com", "blogspot.", "wordpress.com", "tistory.com", "naver.me", "blog.naver",
                 "wayokai.com", "youtube.com", "gradesaver.com", "studocu.com", "coursehero.com",
                 "kiddle.co", "brunch.co.kr", "chinesepod.com", "ebsco.com", "kyobobook", "grokipedia",
                 "etnownews.com", "answers.com", "famousbirthdays.com", "imdb.com/name", "fandom.com")
LANG_CODE = {"korean": "ko", "japanese": "jp", "french": "fr", "spanish": "es", "german": "de",
             "italian": "it", "chinese": "zh-hans", "mandarin": "zh-hans", "cantonese": "zh-hant",
             "russian": "ru", "portuguese": "pt-pt", "swedish": "sv", "danish": "da", "polish": "pl",
             "hindi": "hi", "persian": "fa", "farsi": "fa", "turkish": "tr", "english": "en"}

def http(method, url, headers=None, body=None, timeout=180):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, method=method, data=data)
    if body is not None: req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items(): req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:500]
    except Exception as e: return 0, str(e)
def sb(path):
    st, tx = http("GET", f"{URL}/rest/v1/{path}", {"apikey": KEY, "Authorization": f"Bearer {KEY}"})
    if st != 200: raise RuntimeError(f"sb {st}: {tx[:160]}")
    return json.loads(tx)
def anthropic(model, system, user, max_tokens=4000):
    body = {"model": model, "max_tokens": max_tokens, "system": system, "messages": [{"role": "user", "content": user}]}
    for a in range(6):
        st, tx = http("POST", "https://api.anthropic.com/v1/messages",
                      {"x-api-key": ANT, "anthropic-version": "2023-06-01"}, body, timeout=300)
        if st == 200:
            o = json.loads(tx); return "".join(p.get("text", "") for p in o.get("content", []) if p.get("type") == "text")
        if st in (429, 500, 502, 503, 520, 529) and a < 5: time.sleep(min(60, 5 * (a + 1))); continue
        raise RuntimeError(f"anthropic {model} {st}: {tx[:200]}")
def gemini_text(system, user, max_tokens=22000):
    """Gemini 3.1 writer (no tools). Excludes 'thought' parts; high token budget so JSON isn't truncated.
    Resilient: on 429/5xx retries with exponential backoff; if a model stays rate-limited (or is missing),
    falls through to the next model in GEN_MODELS (preview → GA) instead of aborting the director."""
    last = None
    for m in GEN_MODELS:
        body = {"contents": [{"role": "user", "parts": [{"text": user}]}],
                "systemInstruction": {"parts": [{"text": system}]},
                "generationConfig": {"temperature": 0.7, "maxOutputTokens": max_tokens}}
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={GEM}"
        for a in range(2):
            st, tx = http("POST", url, body=body, timeout=300)
            if st == 200:
                cand = (json.loads(tx).get("candidates") or [{}])[0]
                return "".join(p.get("text", "") for p in cand.get("content", {}).get("parts", []) if "text" in p and not p.get("thought"))
            last = (m, st, tx)
            if st == 404: break                      # model unavailable → next model
            if st in (429, 500, 502, 503, 520, 529) and a < 1:
                time.sleep(4)                        # one short retry for a transient blip, then fall back fast
                continue
            break                                    # rate-limited / non-retryable → fall back to Claude
    # Gemini preview exhausted (rate limit / unavailable) → fall back to Claude as the writer.
    # Facts are still fact-checked by the Sonnet judge downstream, so quality is unchanged.
    m, st, tx = last if last else ("?", "?", "")
    print(f"    ↳ gemini unavailable ({m} {st}); writing with {GEN_FALLBACK}")
    return anthropic(GEN_FALLBACK, system, user, max_tokens=8000)
def parse_json(s):
    s = s.strip()
    if s.startswith("```"): s = re.sub(r"^```[a-z]*\n?", "", s); s = re.sub(r"\n?```$", "", s)
    start = s.find("{")
    if start < 0: return json.loads(s)
    depth = 0; instr = False; esc = False
    for k in range(start, len(s)):
        ch = s[k]
        if instr:
            if esc: esc = False
            elif ch == "\\": esc = True
            elif ch == '"': instr = False
        elif ch == '"': instr = True
        elif ch == "{": depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0: return json.loads(s[start:k + 1])
    return json.loads(s[start:])
_S = r'((?:[^"\\]|\\.)*)'
def _u(s):
    try: return json.loads('"' + s + '"')
    except Exception: return s
def salvage_facts(text):
    nm = re.search(r'"name_meaning"\s*:\s*"' + _S + '"', text, re.S)
    it = re.search(r'"intro"\s*:\s*"' + _S + '"', text, re.S)
    facts = [{"text": _u(t)} for t in re.findall(r'"text"\s*:\s*"' + _S + '"', text, re.S)]
    return {"name_meaning": _u(nm.group(1)) if nm else "", "intro": _u(it.group(1)) if it else "", "facts": facts}

def native_meta(name):
    try:
        d = parse_json(anthropic(JUDGE_MODEL,
            "Return only JSON.",
            f'For the film director "{name}", return ONLY {{"native_name":"...","lang":"..."}}: native_name in the '
            f'director\'s native script (봉준호, 宮崎駿; if Latin, repeat the Latin name); lang = English name of that language.',
            max_tokens=300))
        return (d.get("native_name") or name).strip(), (d.get("lang") or "English").strip()
    except Exception:
        return name, "English"

def bad_domain(url):
    u = (url or "").lower(); return any(d in u for d in BLOCK_DOMAINS)
LINK_UA = {"User-Agent": "Mozilla/5.0 (compatible; MetatakeBot/1.0; +https://metatake.net/bot)"}
def link_alive(url):
    if not url or not str(url).startswith("http"): return False
    try:
        with urllib.request.urlopen(urllib.request.Request(url, method="GET", headers=LINK_UA), timeout=15) as r:
            return 200 <= r.status < 400
    except urllib.error.HTTPError as e: return e.code in (401, 403, 405, 429)
    except Exception: return False

def brave(query, lang=None, count=5):
    p = {"q": query, "count": count}
    if lang and lang in LANG_CODE and LANG_CODE[lang] != "en": p["search_lang"] = LANG_CODE[lang]
    st, tx = http("GET", "https://api.search.brave.com/res/v1/web/search?" + urllib.parse.urlencode(p),
                  {"X-Subscription-Token": BRAVE, "Accept": "application/json"})
    out = []
    if st == 200:
        try:
            for r in (json.loads(tx).get("web", {}).get("results", []) or []):
                u = r.get("url")
                if u and not bad_domain(u):
                    out.append({"url": u, "title": (r.get("title") or "").strip(), "desc": (r.get("description") or "").strip()})
        except Exception: pass
    time.sleep(1.1)
    return out

def salient(fact):
    nums = re.findall(r"\b\d[\d,\.]*\b", fact)
    caps = re.findall(r"\b([A-Z][\w'’.-]+(?:\s+[A-Z][\w'’.-]+){0,3})\b", fact)
    terms = []
    for c in caps:
        if c.lower() not in ("he", "his", "the", "in", "a", "an", "born"): terms.append(c)
    return " ".join((terms[:5] + nums[:3]))[:120]

# ---------- stage 2: generate (free) ----------
SYS_GEN = (
 "You compile 'The Life' — a dossier of the most genuinely INTERESTING, TRUE facts about the PERSON of a film director "
 "(never plot summaries of films). Draw on your full knowledge as if you researched ~100 candidates and kept the most "
 f"fascinating {N_FACTS}. INTERESTINGNESS IS THE TOP CRITERION: favour the surprising, vivid, revealing, little-known "
 "anecdote — the formative wound, the strange habit, the chance encounter, the feud, the obsession, the contradiction — "
 "over a résumé of titles and prizes. Focus on the PERSON and what shaped the work (childhood, family, birthplace, "
 "schooling, formative places, mentors, career turns, beliefs, working habits, controversies, honours, death).\n"
 "STYLE: one English sentence per fact; be as SPECIFIC as possible and use concrete PROPER NOUNS abundantly (cities, "
 "neighbourhoods, schools, studios, festivals, named people, works, awards). Include specific dates/numbers WHERE THEY "
 "ADD PRECISION — but do NOT force a number into every sentence, and NEVER trade away a vivid, surprising fact for the "
 "sake of a statistic. Only assert facts you are genuinely confident are true (each is web-verified afterward).\n"
 "Also give 'name_meaning' (literal/etymological meaning of the name in its ORIGINAL script — kanji/hanja/Hangul/"
 "etymology, 1-3 sentences) and 'intro' (<=40 words).\n"
 f'Output ONLY JSON: {{"name_meaning":"...","intro":"...","facts":[{{"text":"..."}}, ...]}} with up to {N_FACTS} facts.'
)
def build_gen_user(ctx):
    born = []
    if ctx.get("year"): born.append(str(ctx["year"]))
    if ctx.get("place"): born.append(ctx["place"])
    return f"DIRECTOR: {ctx['name']}\nBorn: {', '.join(born) if born else '—'}\n\nWrite name_meaning, intro, and up to {N_FACTS} facts."

# ---------- stage 3: verify (judge over Brave candidates) ----------
SYS_JUDGE = (
 "You are a fact-checker keeping interesting facts honest. For each numbered CLAIM about a film director you are given "
 "CANDIDATE web results (title + snippet + url) from real searches (English and the director's native language).\n"
 "KEEP a claim (supported=true) if AT LEAST ONE reputable candidate is clearly about the SAME person and the SAME "
 "topic/event AND does not contradict the claim. You do NOT need every detail (exact dates, numbers, side facts) spelled "
 "out in the snippet — an on-topic, non-contradicting reputable page is sufficient, because snippets are short. Output "
 "the URL of the best such candidate.\n"
 "Set supported=false ONLY when: no candidate is on-topic for that claim, OR a candidate plainly CONTRADICTS the claim's "
 "core. Prefer reputable sources (encyclopedias, major outlets, official sites) when choosing the URL.\n"
 'Output ONLY JSON: {"results":[{"n":1,"supported":true,"url":"<one candidate url or null>"}, ...]} for ALL claims.'
)
def build_judge_user(name, items):
    blocks = []
    for it in items:
        cand = "\n".join(f'    - {c["url"]}\n      {c["title"]} — {c["desc"][:160]}' for c in it["cands"][:5]) or "    (no candidates)"
        blocks.append(f'CLAIM {it["n"]}: {it["text"]}\n  candidates:\n{cand}')
    return f"DIRECTOR: {name}\n\n" + "\n\n".join(blocks) + f"\n\nReturn verdicts for all {len(items)} claims."

def context(slug):
    drow = sb(f"directors?slug=eq.{urllib.parse.quote(slug)}&select=name,birthday,place_of_birth")
    films = sb(f"films?director_slug=eq.{urllib.parse.quote(slug)}&visible=eq.true&select=slug&limit=1")
    if not films: return None
    d = drow[0] if drow else {}
    name = d.get("name") or slug.replace("-", " ").title()
    year = None
    if d.get("birthday"):
        mm = re.match(r"(\d{4})", str(d["birthday"]))
        if mm: year = int(mm.group(1))
    return {"slug": slug, "name": name, "year": year, "place": d.get("place_of_birth")}

def emit_record(ctx):
    native_name, lang = native_meta(ctx["name"])
    gtext = gemini_text(SYS_GEN, build_gen_user(ctx))
    try:
        gdata = parse_json(gtext)
        if not gdata.get("facts"): raise ValueError("empty")
    except Exception:
        gdata = salvage_facts(gtext)
    facts = [{"n": i + 1, "text": (f.get("text") or "").strip()} for i, f in enumerate(gdata.get("facts", [])) if (f.get("text") or "").strip()]
    # per-fact Brave candidates (English + native for non-English)
    items = []
    for f in facts:
        terms = salient(f["text"])
        cands = brave(f'{ctx["name"]} {terms}', None)
        if native_name != ctx["name"]:
            cands += brave(f'{native_name} {terms}', lang)
        seen = set(); uniq = []
        for c in cands:
            if c["url"] not in seen: seen.add(c["url"]); uniq.append(c)
        items.append({"n": f["n"], "text": f["text"], "cands": uniq[:6]})
    verdicts = {}
    try:
        for r in parse_json(anthropic(JUDGE_MODEL, SYS_JUDGE, build_judge_user(ctx["name"], items), max_tokens=4000)).get("results", []):
            verdicts[r.get("n")] = r
    except Exception as e:
        print(f"    ! {ctx['slug']}: judge parse {e}")
    keep = []; alivecache = {}
    for f in facts:
        v = verdicts.get(f["n"], {}); url = (v.get("url") or "").strip()
        if not v.get("supported") or not url or bad_domain(url): continue
        if url not in alivecache: alivecache[url] = link_alive(url); time.sleep(0.1)
        if alivecache[url]: keep.append({"text": f["text"], "source": url})
    return {"slug": ctx["slug"], "name": ctx["name"], "name_meaning": gdata.get("name_meaning", ""),
            "intro": gdata.get("intro", ""), "native": native_name, "lang": lang,
            "facts": [{"n": i + 1, "text": k["text"], "source": k["source"]} for i, k in enumerate(keep)],
            "kept": len(keep), "total": len(facts)}

def all_directors():
    films, off, page = [], 0, 1000
    while True:
        b = sb(f"films?select=director_slug,visible&order=director_slug&limit={page}&offset={off}")
        films += b
        if len(b) < page: break
        off += page
    cnt = defaultdict(int)
    for f in films:
        if f.get("director_slug") and f.get("visible"): cnt[f["director_slug"]] += 1
    return sorted([s for s, n in cnt.items() if n >= MIN_FILMS])

def run_all():
    done = set(); full = f"{OUT}.jsonl"
    if os.path.exists(full):
        for l in open(full, encoding="utf-8"):
            try: done.add(json.loads(l).get("slug"))
            except Exception: pass
    todo = [s for s in all_directors() if s not in done]
    print(f"[all] directors >= {MIN_FILMS} films: {len(todo)+len(done)} · done {len(done)} · to do {len(todo)}")
    fh = open(full, "a", encoding="utf-8"); n = 0
    for slug in todo:
        try:
            ctx = context(slug)
            if not ctx: continue
            rec = emit_record(ctx)
        except Exception as e:
            print(f"  ! {slug}: {e}"); continue
        fh.write(json.dumps(rec, ensure_ascii=False) + "\n"); fh.flush(); n += 1
        print(f"  ✓ {slug}: kept {rec['kept']}/{rec['total']} · {rec['lang']}")
    fh.close(); print(f"✅ wrote {n} → {full}\n   load: python3 director-facts-load.py --out {OUT}")

def dry():
    slugs = DIRS_ARG or PILOT
    print(f"[director-facts] gen={GEN_MODELS[0]} · verify={JUDGE_MODEL} · numbers=optional/interest-first")
    md = [f"# The Life — DRY ({len(slugs)}) · gen {GEN_MODELS[0]} + Brave verify (EN+native) · interest-first\n"]
    out = []
    for slug in slugs:
        try:
            ctx = context(slug)
            if not ctx: print(f"  ! {slug}: no films/director"); continue
            rec = emit_record(ctx)
        except Exception as e:
            print(f"  ! {slug}: {e}"); continue
        out.append(rec)
        md.append(f"## {rec['name']}  ·  kept {rec['kept']}/{rec['total']} · native «{rec['native']}» ({rec['lang']})")
        md.append(f"\n**The name** — {rec['name_meaning']}\n")
        if rec["intro"]: md.append(f"*{rec['intro']}*\n")
        for f in rec["facts"]:
            md.append(f"{f['n']}. {f['text']}\n   ↳ {f['source']}")
        md.append("")
        print(f"  ✓ {slug}: kept {rec['kept']}/{rec['total']} · {rec['lang']}")
    open(f"{OUT}.json", "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=2))
    open(f"{OUT}.md", "w", encoding="utf-8").write("\n".join(md))
    print(f"\n→ {OUT}.md / {OUT}.json")

if __name__ == "__main__":
    if ALLRUN: run_all()
    else: dry()
