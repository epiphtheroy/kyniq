# The Hourly — ledger

One line per hour slot. Format:

`YYYY-MM-DD HH:00 UTC · PUBLISHED|PASS|KILLED · keyword: … · cluster: … · film: <slug> · figure: … · verdict-type: … · (reason if PASS/KILLED)`

The 48h story-cluster dedupe and the 7-day film-reuse check read this file. Keep it append-only.

---
2026-07-08T10:35:07+00:00 · PASS-CAND · Marie Antoinette · selector: api-fail
2026-07-08T10:35:07+00:00 · PASS · candidates tried, none survived selection/gate
