#!/usr/bin/env python3
"""Turn scan output (state/candidates.jsonl) into a publishable digest draft.

Applies the auto-toggle gate (HANDOFF-발견피드.md §5-1) and emits a TS snippet
for lib/discoveries/digests.ts. The OBSERVED list is fully automatic (nofollow);
FEATURED starts empty — the owner promotes entries and writes editorial notes by
hand (dofollow, the human curation signal).

Usage:
  python3 build_digest.py --id 2026-07-18-wk29 --label "Week of Jul 10–16, 2026" \
      --scanned 490000 > state/digest-draft.txt
Then paste the block into lib/discoveries/digests.ts (newest first).
"""
import argparse
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
STATE = HERE / "state"

LEGIT = {"criticism", "journal", "news", "festival", "venue",
         "archive", "podcast", "education", "database", "curation"}
GATE_MIN = 55  # decent bar; thin/empty do not debut a curator brand


def gate(rows):
    """Candidates that MAY be published — after a human opens each one.
    Never auto-trust: would_embarrass / suspect status / non-decent are out."""
    seen, out = set(), []
    for r in sorted(rows, key=lambda x: -x["score"]):
        d = r["domain"]
        if d in seen:
            continue
        if (r["category"] in LEGIT and r["score"] >= GATE_MIN
                and r["status"] == "ok" and not r.get("name_only")
                and not r.get("would_embarrass")
                and r.get("quality") in ("strong", "decent")):
            seen.add(d)
            out.append(r)
    return out


def esc(s):
    return (s or "").replace("\\", "\\\\").replace('"', '\\"')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--id", required=True)
    ap.add_argument("--label", required=True)
    ap.add_argument("--scanned", type=int, default=0)
    ap.add_argument("--date", default="")
    args = ap.parse_args()

    rows = [json.loads(l) for l in open(STATE / "candidates.jsonl")]
    picked = gate(rows)
    date = args.date or args.id[:10]

    observed = ",\n".join(
        f'      {{ domain: "{esc(r["domain"])}", category: "{r["category"]}", '
        f'lang: "{r["lang"]}" }}'
        for r in picked
    )
    block = f'''  {{
    id: "{args.id}",
    date: "{date}",
    rangeLabel: "{esc(args.label)}",
    scanned: {args.scanned},
    // Prose lead — factual, owner may rewrite. Names are not links; links live
    // in the observation log below (nofollow) and in featured (dofollow).
    intro:
      "EDIT ME — one factual paragraph on what surfaced this week.",
    featured: [
      // Owner promotes here + writes a real 1–2 sentence note. dofollow.
      // {{ domain: "example.com", title: "Site name", note: "Why it is worth a look.", category: "criticism", lang: "en" }},
    ],
    observed: [
{observed}
    ],
  }},'''
    print(f"// {len(picked)} candidates cleared the triage gate "
          f"(legit category, score>={GATE_MIN}, decent+, not flagged).\n"
          f"// ⚠️ NOT publish-ready. OPEN each one before it goes in observed[] —\n"
          f"//    the classifier cannot see a phishing clone or a piracy player that\n"
          f"//    dresses as a cinema (HANDOFF §14). Delete any that fail on sight.\n")
    print(block)


if __name__ == "__main__":
    main()
