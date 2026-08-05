#!/usr/bin/env python3
"""i18n-reconcile — find Korean rows that are missing or have gone stale.

정본: HANDOFF-한국어화-구독번역-실행.md §3 · master doc §6.4

This is the piece the 2026-07-17 corpus never had. That run wrote 21,561 rows
with source_sha256 left NULL, so when the English behind a row was edited nothing
could tell — the Korean silently described an older text. Every row this pipeline
writes carries the hash of the English it was made from, which makes the question
answerable with one comparison:

    missing  — no ko row for a source row that should have one   (new content)
    stale    — sha256(current English) != stored source_sha256   (English edited)

Read-only. Writes work lists to data/i18n/requeue/<corpus>.stale.json, which
`scripts/i18n-translate-run.mjs --corpus <c> --requeue` consumes.

    python3 worker/i18n-reconcile.py                  # report every corpus
    python3 worker/i18n-reconcile.py --corpus tow     # one
    python3 worker/i18n-reconcile.py --write          # also emit requeue files
"""
import os, sys, json, hashlib, argparse, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
# The extractor owns the DB helper; import it by path since the filename has a dash.
import importlib.util
_spec = importlib.util.spec_from_file_location("i18n_extract", os.path.join(HERE, "i18n-extract.py"))
_ex = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_ex)

REQUEUE = os.path.join(ROOT, "data", "i18n", "requeue")
LANG = "ko"

# corpus -> (entity_type, field). tow is special: the reader-facing rows are the
# assembled comments, so reconciliation is done on the assembled key, not segments.
TARGETS = {
    "tow":                 ("tow_comment", "rationale"),
    "portrait":            ("director_portrait", "body"),
    "dfacts_items":        ("director_fact", "fact"),
    "dfacts_intro":        ("director_fact", "intro"),
    "dfacts_meaning":      ("director_fact", "name_meaning"),
    "repolish_invitation": ("invitation", "rationale"),
    "repolish_laconic":    ("trope", "laconic"),
    "repolish_trope_title":("trope", "title"),
}


def stored(entity_type, field):
    """entity_key -> source_sha256 (may be None) for every ko row of this group."""
    out, offset, page = {}, 0, 1000
    while True:
        rows = _ex.q(f"""
            select entity_key, source_sha256
            from public.content_i18n
            where entity_type = {sql_lit(entity_type)} and field = {sql_lit(field)}
              and lang = {sql_lit(LANG)}
            order by entity_key
            limit {page} offset {offset}""")
        for r in rows:
            out[r["entity_key"]] = r.get("source_sha256")
        if len(rows) < page:
            return out
        offset += page


def sql_lit(s):
    return "'" + str(s).replace("'", "''") + "'"


def reconcile(name, write=False):
    entity_type, field = TARGETS[name]
    src_path = os.path.join(ROOT, "data", "i18n", "src2", f"{name}.json")
    if not os.path.exists(src_path):
        print(f"{name:22s} — no extract on disk (run i18n-extract.py first)")
        return None
    items = json.load(open(src_path, encoding="utf-8"))
    have = stored(entity_type, field)

    missing, stale, nosha = [], [], 0
    for it in items:
        key = it["entity_key"]
        if key not in have:
            missing.append(it)
            continue
        s = have[key]
        if s is None:
            nosha += 1          # legacy row: cannot be judged, not counted stale
        elif s != it["sha256"]:
            stale.append(it)

    work = missing + stale
    flag = "⚠️ " if work else "✓ "
    print(f"{flag}{name:22s} src={len(items):6d} ko={len(have):6d} "
          f"missing={len(missing):5d} stale={len(stale):4d} sha없음={nosha:5d}")
    if write and work:
        os.makedirs(REQUEUE, exist_ok=True)
        path = os.path.join(REQUEUE, f"{name}.stale.json")
        json.dump([{"entity_key": w["entity_key"]} for w in work],
                  open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"   → {os.path.relpath(path, ROOT)} ({len(work)} items)")
    return {"corpus": name, "missing": len(missing), "stale": len(stale), "nosha": nosha}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", default="all")
    ap.add_argument("--write", action="store_true", help="emit requeue work lists")
    a = ap.parse_args()
    names = list(TARGETS) if a.corpus == "all" else a.corpus.split(",")
    results = [r for r in (reconcile(n, a.write) for n in names) if r]
    total = sum(r["missing"] + r["stale"] for r in results)
    legacy = sum(r["nosha"] for r in results)
    print(f"\n작업 대상 {total}건" + (f" · sha 없는 레거시 {legacy}건(판정 불가)" if legacy else ""))
    if legacy:
        print("레거시 행은 다음 번역 시 sha가 채워지면서 자동으로 판정 가능해진다.")
