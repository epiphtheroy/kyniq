#!/usr/bin/env python3
"""
Cinecodex cross-vendor panel harness  (run OUTSIDE the sandbox — open egress required)
---------------------------------------------------------------------------------------
Scores the 50 anchor films with a PANEL of LLMs from DIFFERENT vendors
(OpenAI + Anthropic + Google), N runs each, using the identical frozen prompt.
Then reports inter-vendor agreement so you can prove the index is not a
single-model artifact.

WHY THIS IS A SEPARATE SCRIPT: the Cowork sandbox egress proxy blocks OpenAI &
Gemini (and even user-key Anthropic) calls. Run this on your own machine / server
where those endpoints are reachable.

USAGE:
  1) put your keys in env (or it auto-reads ../.env.local style KEY=VALUE):
       OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY
  2) ensure PROMPT_v1.1.txt sits next to this file (or pass --prompt PATH)
  3) python3 cinecodex_panel_harness.py --runs 3 --temp 0.6
  4) outputs: ./panel_out/<vendor>_<model>_run<k>.json  + agreement_report.txt

Only Python stdlib is used (urllib) — no pip installs needed.
Model IDs below are EDITABLE — update to whatever is current for your account.
"""
import os, sys, json, time, argparse, statistics as st, math, itertools, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))

# -------- EDIT THESE to current model IDs available on your accounts --------
PANEL = {
    "openai":    ["gpt-4o-2024-11-20"],                 # add "gpt-4o-mini" to test a cheaper tier
    "anthropic": ["claude-sonnet-4-6"],                 # flagship/mid; add "claude-opus-4-8"
    "google":    ["gemini-2.0-flash"],                  # add "gemini-1.5-pro"
}
# ---------------------------------------------------------------------------

def load_env():
    # env vars win; otherwise scan a few likely .env locations
    for p in [os.path.join(HERE, "../.env.local"), os.path.join(HERE, ".env.local"),
              os.path.join(HERE, "../MetaTake/.env.local")]:
        if os.path.exists(p):
            for line in open(p, encoding="utf-8"):
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

def http_json(url, headers, payload, timeout=120):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())

# ---- vendor callers: each returns the raw text the model produced ----
def call_openai(model, prompt, temp):
    out = http_json("https://api.openai.com/v1/chat/completions",
        {"Authorization": "Bearer "+os.environ["OPENAI_API_KEY"], "Content-Type": "application/json"},
        {"model": model, "temperature": temp, "max_tokens": 8000,
         "messages": [{"role": "user", "content": prompt}]})
    return out["choices"][0]["message"]["content"]

def call_anthropic(model, prompt, temp):
    out = http_json("https://api.anthropic.com/v1/messages",
        {"x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01",
         "Content-Type": "application/json"},
        {"model": model, "max_tokens": 8000, "temperature": temp,
         "messages": [{"role": "user", "content": prompt}]})
    return out["content"][0]["text"]

def call_google(model, prompt, temp):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key="+os.environ["GEMINI_API_KEY"]
    out = http_json(url, {"Content-Type": "application/json"},
        {"contents": [{"parts": [{"text": prompt}]}],
         "generationConfig": {"temperature": temp, "maxOutputTokens": 8000}})
    return out["candidates"][0]["content"]["parts"][0]["text"]

CALLERS = {"openai": call_openai, "anthropic": call_anthropic, "google": call_google}

def parse_scores(text):
    t = text.strip()
    if t.startswith("```"):
        t = t.split("```")[1]
        if t.startswith("json"): t = t[4:]
    a, b = t.find("["), t.rfind("]")
    return json.loads(t[a:b+1])

# ---- agreement stats ----
def Vf(o): return (o["COG"]+o["AFF"]+o["FORM"]+o["MORAL"]+o["DUR"])/5
def Rf(o): return 0.6*((o["BANK"]+o["INSINCERE"]+o["COWARD"])/3)+0.4*o["POLAR"]
def pearson(a, b):
    ma, mb = st.mean(a), st.mean(b)
    num = sum((x-ma)*(y-mb) for x, y in zip(a, b))
    den = math.sqrt(sum((x-ma)**2 for x in a)*sum((y-mb)**2 for y in b))
    return num/den if den else float("nan")
def kripp_interval(mat):
    vals = [x for row in mat for x in row]
    Do = st.mean((a-b)**2 for row in mat for a, b in itertools.permutations(row, 2))
    De = st.mean((a-b)**2 for a in vals for b in vals)
    return 1 - Do/De if De else float("nan")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt", default=os.path.join(HERE, "PROMPT_v1.1.txt"))
    ap.add_argument("--runs", type=int, default=3)
    ap.add_argument("--temp", type=float, default=0.6)
    ap.add_argument("--out", default=os.path.join(HERE, "panel_out"))
    args = ap.parse_args()
    load_env()
    os.makedirs(args.out, exist_ok=True)
    prompt = open(args.prompt, encoding="utf-8").read()

    model_means = {}  # (vendor,model) -> list of per-film mean V
    for vendor, models in PANEL.items():
        keyname = {"openai": "OPENAI_API_KEY", "anthropic": "ANTHROPIC_API_KEY", "google": "GEMINI_API_KEY"}[vendor]
        if not os.environ.get(keyname):
            print(f"[skip] {vendor}: {keyname} not set"); continue
        for model in models:
            runs_V = []
            for k in range(1, args.runs+1):
                tag = f"{vendor}_{model.replace('/','-')}_run{k}"
                try:
                    txt = CALLERS[vendor](model, prompt, args.temp)
                    scores = parse_scores(txt)
                    json.dump(scores, open(os.path.join(args.out, tag+".json"), "w"), ensure_ascii=False, indent=1)
                    runs_V.append([Vf(o) for o in scores])
                    print(f"[ok] {tag}: {len(scores)} films")
                except Exception as e:
                    print(f"[ERR] {tag}: {e}")
                time.sleep(1)
            if runs_V:
                nmin = min(len(r) for r in runs_V)
                model_means[(vendor, model)] = [st.mean(r[i] for r in runs_V) for i in range(nmin)]

    # cross-model agreement on V
    rep = ["=== Cinecodex cross-vendor panel — agreement on V ===\n"]
    keys = list(model_means)
    if len(keys) >= 2:
        nmin = min(len(v) for v in model_means.values())
        mat = [[model_means[k][i] for k in keys] for i in range(nmin)]
        rep.append(f"models: {[f'{a}:{b}' for a,b in keys]}\n")
        rep.append(f"Krippendorff alpha (interval, V): {kripp_interval(mat):.3f}\n")
        rep.append("pairwise Pearson r (V):\n")
        for a, b in itertools.combinations(keys, 2):
            rep.append(f"  {a[1]} vs {b[1]}: {pearson(model_means[a], model_means[b]):.3f}\n")
    else:
        rep.append("Need >=2 models with keys to compute agreement.\n")
    open(os.path.join(args.out, "agreement_report.txt"), "w").write("".join(rep))
    print("\n".join(rep))

if __name__ == "__main__":
    main()
