# The Hourly — ledger

One line per hour slot. Format:

`YYYY-MM-DD HH:00 UTC · PUBLISHED|PASS|KILLED · keyword: … · cluster: … · film: <slug> · figure: … · verdict-type: … · (reason if PASS/KILLED)`

The 48h story-cluster dedupe and the 7-day film-reuse check read this file. Keep it append-only.

---
2026-07-08T10:35:07+00:00 · PASS-CAND · Marie Antoinette · selector: api-fail
2026-07-08T10:35:07+00:00 · PASS · candidates tried, none survived selection/gate
2026-07-08T10:37:46+00:00 · KILLED · Marie Antoinette · gate x2: gate api failed
2026-07-08T10:37:46+00:00 · PASS · candidates tried, none survived selection/gate
2026-07-08T11:12:43+00:00 · PUBLISHED · kw: Marie Antoinette · anchor: marie-antoinette-2006 · lane: direct · modules: reception,honors,canon,takescore · /now/making-marie-antoinette-mubi-acquisition · dist: indexnow:200
2026-07-08T12:47:08+00:00 · KILLED · Marie Antoinette · gate x2: previous attempt returned no parseable JSON
2026-07-08T12:47:08+00:00 · PASS · candidates tried, none survived selection/gate
2026-07-08T22:25:06+00:00 · PUBLISHED · kw: Moana · anchor: moana-2016 · lane: direct · modules: takescore,filmography · /now/moana-live-action-reviews-2026-remake-verdict · dist: revalidate,indexnow:200,bluesky:401
2026-07-08T22:48:56+00:00 · PUBLISHED · kw: dakota fanning · anchor: the-notebook-2004 · lane: direct · modules: takescore,locations · /now/dakota-fanning-sun-never-sets-trailer-notebook-comparison · dist: revalidate,indexnow:200,bluesky:401
2026-07-08T23:00:00+00:00 · PUBLISHED · kw: Love · anchor: love-1971 · lane: direct · modules: canon,takescore · /now/love-1971-szerelem-emmy-nominations-search-spike · dist: revalidate,indexnow:200,bluesky:400
2026-07-09T00:00:00+00:00 · PASS · no beat candidate above threshold (20 raw)
