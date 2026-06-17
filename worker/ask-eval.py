#!/usr/bin/env python3
"""ask-eval — fire a fixed question set at the live /api/ask and report quality + cost.

Usage:
  python3 ask-eval.py                      # hits https://metatake.net/api/ask
  ASK_URL=http://localhost:3000/api/ask python3 ask-eval.py
For each question prints: #citations, distinct films, whether the answer is
cited ([n] present), a snippet to eyeball, and tokens/cost (from the response meta).
Out-of-corpus questions should produce a short "nothing in the corpus" answer.
"""
import os, json, time, re, urllib.request, urllib.error

URL = os.environ.get("ASK_URL", "https://metatake.net/api/ask")

# conceptual (should answer well) … then deliberately out-of-corpus (should decline)
QUESTIONS = [
    "How does cinema portray surveillance?",
    "What does the colour red tend to mean on screen?",
    "How do films show grief without dialogue?",
    "What is the meaning of mirrors in film?",
    "How is capitalism critiqued through objects?",
    "What role does silence play in cinema?",
    "How do films depict memory and the past?",
    "How is masculinity questioned on screen?",
    "What does water symbolise in film?",
    "How does a staircase work as a figure?",
    "Who won the Academy Award for Best Picture in 2031?",   # out-of-corpus
    "What is the capital of France?",                          # irrelevant / out-of-corpus
]

def ask(q):
    body = json.dumps({"q": q}).encode()
    for attempt in range(4):
        req = urllib.request.Request(URL, method="POST", data=body)
        req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.status, json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            code = e.code
            txt = e.read().decode()[:200]
            if code == 429 and attempt < 3:
                time.sleep(6); continue
            return code, {"error": txt}
        except Exception as e:
            if attempt < 3:
                time.sleep(4); continue
            return 0, {"error": str(e)}

def main():
    print(f"▶ ask-eval against {URL}\n")
    total_cost = 0.0; total_in = 0; total_out = 0; n_ok = 0
    for q in QUESTIONS:
        st, d = ask(q)
        if st != 200:
            print(f"✗ [{st}] {q}\n    {d.get('error','')}\n"); time.sleep(5); continue
        ans = d.get("answer", "") or ""
        cites = d.get("citations", []) or []
        films = sorted({c.get("film_title") for c in cites if c.get("film_title")})
        cited = bool(re.search(r"\[\d+\]", ans))
        meta = d.get("meta", {}) or {}
        ci = meta.get("inTokens"); co = meta.get("outTokens"); cc = meta.get("costUsd")
        if isinstance(cc, (int, float)): total_cost += cc
        if isinstance(ci, int): total_in += ci
        if isinstance(co, int): total_out += co
        n_ok += 1
        print(f"• {q}")
        print(f"    citations={len(cites)}  distinct_films={len(films)}  cited[n]={'yes' if cited else 'NO'}"
              + (f"  in={ci} out={co} cost=${cc:.5f}" if cc is not None else ""))
        print(f"    {ans[:200].replace(chr(10),' ')}…\n")
        time.sleep(5)   # stay under the per-minute rate limit
    print("─" * 60)
    print(f"answered {n_ok}/{len(QUESTIONS)}   tokens in/out: {total_in}/{total_out}   total cost: ${total_cost:.4f}")
    print("Check by eye: are claims grounded + cited? do the OOD questions decline gracefully?")

if __name__ == "__main__":
    main()
