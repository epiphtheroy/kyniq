#!/usr/bin/env python3
"""Backfill an existing /now piece with the enrichment fields (image, archive
links, any new data modules, cutting-room floor) added after it was published.

Structural only — does NOT rewrite the prose. New pieces get everything from
produce.py; this upgrades a row published under an older pipeline.

Usage: python3 pipeline/backfill_now.py <slug> [signals/XXXX.json]
"""
from __future__ import annotations

import glob
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from pipeline.common import HOURLY, load_env, log, sb_get, sb_update  # noqa: E402
from pipeline.datapack import build_pack  # noqa: E402
from pipeline.produce import build_cut_floor  # noqa: E402

# module types the writer may not have had; append if the pack now has them
APPEND_TYPES = {"locations", "misreadings", "essays"}


def main() -> None:
    env = load_env()
    slug = sys.argv[1]
    rows = sb_get(env, f"now_articles?select=slug,keyword,anchor_type,anchor_slug,modules&slug=eq.{slug}", service=True)
    if not rows:
        log(f"no such piece: {slug}")
        return
    row = rows[0]

    pack = build_pack(env, {"type": row["anchor_type"], "slug": row.get("anchor_slug"), "label": ""})

    # Rebuild the data layer from the current pipeline so an older row gets the
    # linked cells (reception URLs, Wikidata honors, real TakeScore) and any
    # new module types. Order: the types the writer already chose, then the rest.
    fresh = {m["type"]: {k: v for k, v in m.items() if k not in ("id", "more_href")} for m in pack["modules"]}
    prior_order = [m.get("type") for m in (row.get("modules") or [])]
    ordered_types = [t for t in prior_order if t in fresh] + [t for t in fresh if t not in prior_order]
    existing = [fresh[t] for t in ordered_types]
    added = [t for t in fresh if t not in prior_order]

    snap_path = sys.argv[2] if len(sys.argv) > 2 else None
    if not snap_path:
        snaps = sorted(glob.glob(str(HOURLY / "signals" / "*.json")))
        snap_path = snaps[-1] if snaps else None
    cut_floor = []
    if snap_path:
        cut_floor = build_cut_floor(env, json.loads(Path(snap_path).read_text()), row.get("keyword") or "")

    img = pack.get("image") or {}
    patch = {
        "image_path": img.get("path"), "image_alt": img.get("alt"),
        "archive_links": pack.get("archive_links") or [],
        "modules": existing,
    }
    if cut_floor:
        patch["cut_floor"] = cut_floor

    ok, info = sb_update(env, "now_articles", f"slug=eq.{slug}", patch)
    log(f"backfill {slug}: ok={ok} added_modules={added} cut_floor={len(cut_floor)} · {info}")


if __name__ == "__main__":
    main()
