"""Pure recommendation logic (no network) — TF-IDF film affinity.

film_meta: dict film_id -> set(meta_take_id)
Returns: dict film_id -> list[(related_film_id, score, [shared_meta_take_id...])]
weighted so that sharing a RARE meta take counts more than a common one.
"""
import math
from collections import defaultdict

def affinities(film_meta, top_n=20):
    N = max(len(film_meta), 1)
    df = defaultdict(int)                      # meta_take -> #films
    for mts in film_meta.values():
        for m in mts: df[m] += 1
    idf = {m: math.log(1 + N / c) for m, c in df.items()}
    # invert: meta_take -> films
    mt_films = defaultdict(list)
    for f, mts in film_meta.items():
        for m in mts: mt_films[m].append(f)
    pair_score = defaultdict(float)
    pair_shared = defaultdict(list)
    for m, films in mt_films.items():
        if len(films) < 2: continue
        w = idf[m]
        for i in range(len(films)):
            for j in range(i+1, len(films)):
                a, b = films[i], films[j]
                key = (a, b) if a < b else (b, a)
                pair_score[key] += w
                pair_shared[key].append(m)
    out = defaultdict(list)
    for (a, b), s in pair_score.items():
        shared = pair_shared[(a, b)]
        out[a].append((b, round(s, 4), shared))
        out[b].append((a, round(s, 4), shared))
    for f in out:
        out[f].sort(key=lambda x: -x[1])
        out[f] = out[f][:top_n]
    return out
