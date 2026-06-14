"""Pure consolidation logic (no network) — unit-testable.

normalize_concept: collapse case/article/punctuation/tag variants.
components: connected-components clustering over a cosine-sim threshold.
choose_title: pick the most common original concept label in a cluster.
These are imported by mt-consolidate.py (which adds Supabase + embeddings).
"""
import re
from collections import Counter

_TAG = re.compile(r"<[^>]+>")
_PAREN = re.compile(r"\([^)]*\)")
_ART = re.compile(r"^(the|a|an)\s+")
_NONALNUM = re.compile(r"[^\w ]+", re.UNICODE)
_WS = re.compile(r"\s+")

def normalize_concept(s: str) -> str:
    s = _TAG.sub("", s or "").lower()
    s = _PAREN.sub("", s)
    s = _NONALNUM.sub(" ", s)
    s = _WS.sub(" ", s).strip()
    s = _ART.sub("", s)
    return s.strip()

def cosine(a, b):
    return sum(x*y for x, y in zip(a, b))

def normalize_vec(v):
    import math
    n = math.sqrt(sum(x*x for x in v)) or 1.0
    return [x/n for x in v]

def components(keys, vecs, threshold):
    """Union-find connected components: edge iff cosine >= threshold.
    keys[i] is the id of node i; vecs[i] its (normalized) embedding."""
    n = len(keys)
    parent = list(range(n))
    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]; x = parent[x]
        return x
    for i in range(n):
        for j in range(i+1, n):
            if cosine(vecs[i], vecs[j]) >= threshold:
                parent[find(i)] = find(j)
    groups = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(keys[i])
    return list(groups.values())

def choose_title(original_labels):
    """Most common original (un-normalized) label; ties → shortest."""
    c = Counter(original_labels)
    best = max(c.items(), key=lambda kv: (kv[1], -len(kv[0])))
    return best[0]
