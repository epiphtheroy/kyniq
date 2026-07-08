#!/usr/bin/env python3
"""Publish an already-reviewed dry-run draft through the real publish path.

Used to ship a specific vetted piece (re-runs the deterministic gate to
sanitize, rebuilds the data pack, inserts, revalidates, pings IndexNow, and
posts to any configured social channel). Normal operation uses produce.py;
this is for hand-approving a draft you already read.

Usage: python3 pipeline/publish_draft.py drafts/dry-XXXX.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.common import ledger_append, load_env, log, now_utc  # noqa: E402
from pipeline.datapack import build_pack  # noqa: E402
from pipeline.produce import after_publish, deterministic_gate, publish  # noqa: E402


def main() -> None:
    env = load_env()
    draft = json.loads(Path(sys.argv[1]).read_text())
    cand, piece, scores = draft["cand"], draft["piece"], draft.get("scores", {})
    ent = cand["entity"]

    pack = build_pack(env, {"type": ent["type"], "slug": ent.get("slug"), "label": ent["label"]})
    fails = deterministic_gate(env, piece, pack)  # also sanitizes in place
    if fails:
        log(f"gate fails: {fails}")
        return

    ok, info = publish(env, piece, cand, pack, scores)
    if not ok:
        log(f"insert failed: {info}")
        return
    dist = after_publish(env, piece["slug"], piece["headline"], piece.get("dek"))
    ledger_append(f"{now_utc()} · PUBLISHED · kw: {cand['keyword']} · anchor: {ent.get('slug')} · "
                  f"lane: direct · modules: {','.join(piece['module_ids'])} · /now/{piece['slug']} · dist: {','.join(dist)}")
    log(f"PUBLISHED /now/{piece['slug']} · dist {dist}")


if __name__ == "__main__":
    main()
