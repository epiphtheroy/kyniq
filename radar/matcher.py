#!/usr/bin/env python3
"""Keyword Radar — the matcher (정본: HANDOFF-키워드레이더.md §5).

Pure-Python Aho-Corasick over space-padded, normalized keyword phrases (word
boundaries come from the padding), plus the context gate that stops short /
generic film titles ("Her", "Jaws", "Burning") from false-positiving on world
news — the exact failure the Now Playing poller was hardened against.

Cost is independent of keyword count: a 10k-pattern automaton builds in <1s and
matches at tens of MB/s, so 100→10,000 keywords adds ~zero marginal cost. That
is the whole reason the radar scales.

Run directly (`python3 matcher.py`) to execute the self-test.
"""
from __future__ import annotations

import re
from collections import deque

# Unicode-preserving normalization so Korean/accented aliases survive
# (poller.py strips to ASCII; radar keeps Unicode letters/digits for 화양연화 etc.).
# [\W_]+ collapses every run of non-alphanumeric (punctuation, whitespace, AND
# underscore) to a single space — MUST stay byte-equivalent to matcher.mjs's
# /[^\p{L}\p{N}]+/gu so the Python pollers and JS streamers match identically.
_NON_ALNUM = re.compile(r"[\W_]+", re.UNICODE)

# Film-context words: a short/generic title only counts when one of these is
# present (or the source is a film-beat feed). Extends poller.CONTEXT_WORDS with
# cinephile-platform tells and Korean film vocabulary (metatake serves a Korean
# audience — 영화/감독/개봉 are as load-bearing as "film"/"director").
CONTEXT_WORDS = re.compile(
    r"(?i)\b(film|movie|movies|cinema|cinematic|director|directed|actor|actress|cast|"
    r"casting|screenplay|screening|trailer|box office|sequel|remake|reboot|oscar|"
    r"academy award|festival|cannes|venice|berlinale|sundance|premiere|review|"
    r"criterion|letterboxd|mubi|a24|neon|screen|studio|blu-ray|4k restoration|"
    r"filmmaker|filmmaking|auteur|cinephile|watched|rewatch)\b"
    r"|영화|감독|배우|개봉|극장|시네마|재감상|감상평|후기|평론|스포일러")


def norm(s: str) -> str:
    """Lowercase; collapse every non-alphanumeric run (incl. '_') to one space."""
    if not s:
        return ""
    return _NON_ALNUM.sub(" ", s.lower()).strip()


class Matcher:
    """Aho-Corasick automaton over ` {norm(keyword)} ` phrases → keyword ids."""

    def __init__(self, keywords: list[dict]):
        # keyword dict: {id, keyword, match_text, norm, aliases, require_context}
        self.kw: dict[int, dict] = {}
        patterns: dict[str, set[int]] = {}
        for k in keywords:
            kid = k["id"]
            self.kw[kid] = k
            forms = [k.get("norm") or norm(k.get("match_text") or k.get("keyword") or "")]
            for a in (k.get("aliases") or []):
                forms.append(norm(a))
            for f in forms:
                if len(f) < 2:
                    continue
                patterns.setdefault(f" {f} ", set()).add(kid)
        self._build(patterns)

    # ── automaton construction ───────────────────────────────────────────────
    def _build(self, patterns: dict[str, set[int]]) -> None:
        # goto: list of dict(char->state); out: state->set(kw_id); fail: list[int]
        self.goto: list[dict] = [{}]
        self.out: list[set] = [set()]
        for pat, kids in patterns.items():
            s = 0
            for ch in pat:
                nxt = self.goto[s].get(ch)
                if nxt is None:
                    nxt = len(self.goto)
                    self.goto.append({})
                    self.out.append(set())
                    self.goto[s][ch] = nxt
                s = nxt
            self.out[s] |= kids
        # fail links via BFS
        self.fail = [0] * len(self.goto)
        q: deque[int] = deque()
        for ch, s in self.goto[0].items():
            self.fail[s] = 0
            q.append(s)
        while q:
            r = q.popleft()
            for ch, s in self.goto[r].items():
                q.append(s)
                f = self.fail[r]
                while f and ch not in self.goto[f]:
                    f = self.fail[f]
                self.fail[s] = self.goto[f].get(ch, 0) if f or ch in self.goto[0] else 0
                self.out[s] |= self.out[self.fail[s]]

    # ── matching ─────────────────────────────────────────────────────────────
    def find(self, text: str) -> set[int]:
        """Raw keyword ids whose phrase occurs in text (pre context-gate)."""
        if not text:
            return set()
        padded = f" {norm(text)} "
        hits: set[int] = set()
        s = 0
        goto, fail, out = self.goto, self.fail, self.out
        for ch in padded:
            while s and ch not in goto[s]:
                s = fail[s]
            s = goto[s].get(ch, 0)
            if out[s]:
                hits |= out[s]
        return hits

    def match(self, text: str, *, source_beat: str | None = None) -> set[int]:
        """Keyword ids that pass the context gate. Short/generic titles
        (require_context=True) only count when text has a film-context word or
        the source is a film-beat feed."""
        raw = self.find(text)
        if not raw:
            return set()
        has_ctx = source_beat == "film" or bool(CONTEXT_WORDS.search(text))
        out: set[int] = set()
        for kid in raw:
            if self.kw[kid].get("require_context") and not has_ctx:
                continue
            out.add(kid)
        return out


# ── self-test ────────────────────────────────────────────────────────────────
def _selftest() -> None:
    kws = [
        {"id": 1, "keyword": "Mulholland Drive (2001)", "match_text": "Mulholland Drive",
         "norm": norm("Mulholland Drive"), "aliases": [], "require_context": False},
        {"id": 2, "keyword": "Burning (2018)", "match_text": "Burning",
         "norm": norm("Burning"), "aliases": [], "require_context": True},
        {"id": 3, "keyword": "Bong Joon-ho", "match_text": "Bong Joon-ho",
         "norm": norm("Bong Joon-ho"), "aliases": ["봉준호"], "require_context": False},
        {"id": 4, "keyword": "Parasite (2019)", "match_text": "Parasite",
         "norm": norm("Parasite"), "aliases": ["기생충"], "require_context": True},
    ]
    m = Matcher(kws)
    cases = [
        ("Just watched Mulholland Drive again, what a film", {1}),          # plain title
        ("MULHOLLAND DRIVE is playing downtown", {1}),                      # case-insensitive
        ("The forest fire warning: burning across the hills", set()),       # 'burning' no film ctx → gated
        ("Burning (2018) is Lee Chang-dong's best film", {2}),              # 'burning' + film ctx
        ("New interview with Bong Joon-ho about his next project", {3}),    # director, no ctx needed
        ("봉준호 감독의 신작 소식", {3}),                                    # Korean alias (no ctx needed)
        ("기생충 재감상 후기", {4}),                                          # Korean alias + Korean ctx (재감상/후기)
        ("기생충 같은 벌레가 퍼졌다", set()),                                 # Korean alias but no film ctx → gated
        ("A parasite infection spread in the region", set()),               # 'parasite' no film ctx → gated
        ("Parasite won the Palme d'Or at Cannes", {4}),                     # 'parasite' + festival ctx
        ("mulhollanddrive with no spaces should NOT match", set()),         # word boundary
        ("beat gate: film feed lets Burning through", {2}),                 # (beat handled below)
    ]
    ok = 0
    for text, expect in cases[:-1]:
        got = m.match(text)
        if got == expect:
            ok += 1
        else:
            print(f"  FAIL: {text!r}\n       expected {expect} got {got}")
    # source_beat='film' bypasses the context gate for require_context keywords:
    if m.match("Burning is a slow burn", source_beat="film") == {2}:
        ok += 1
    else:
        print(f"  FAIL: beat gate did not let require_context through on film beat")
    assert 2 not in m.match("Burning is a slow burn"), "beat gate leaked without film beat"
    assert 4 in m.find("기생충 재감상"), "Korean alias find() failed"
    total = len(cases)
    print(f"matcher self-test: {ok}/{total} cases pass"
          + ("" if ok == total else "  ← FAILURES ABOVE"))


if __name__ == "__main__":
    _selftest()
