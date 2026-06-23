# Between Film and the World — daily production

A weekday newsletter that reads the day's news through the **Metatake** film corpus, for film-lovers easing into current affairs. Two roles:

- **Deposit job** (scheduled in the Cowork app, weekdays 17:00 KST): researches, verifies against the live site, and writes a *draft* to `drafts/YYYY-MM-DD.md`. Does **not** publish.
- **Publisher AI** (separate): reads the newest draft and posts it to Substack after the review gate.

---

## The editorial recipe — the 4 levers (never drop one)

1. **Figure-anchor.** Reduce each event to a *figure* — a concrete recurring element or structure (the enclosed commons, the figurehead, the body that performs past its hour). Then attach a film to the figure. Never "this reminds me of a movie."
2. **Live-verified nodes only — HARD RULE.** Every film, reading, and trope you link **must exist on the live site**. Think first, then verify against the live DB, and keep only what is confirmed. Never invent, guess, or transliterate a slug, reading, or trope. A 404 kills the whole premise.
3. **Voice.** Anthony Lane wit carried on Axios "Smart Brevity" discipline: a **bold signpost header** + front-loaded takeaway per item, one earned **"aha"** each, ~90–130 words. Criticism targets **structures, not private individuals**. No fabricated engagement, no invented quotes.
4. **Rank by rhyme strength.** Keep up to **7** events that *genuinely* rhyme; never force one. Put 1–2 big-news/weak-rhyme items in a short **"On the cutting-room floor"** with the reason. Fewer than 4 strong rhymes on a given day → ship fewer.

---

## Daily steps

1. Decide today's **ET issue date** (the issue is a US-morning briefing covering the prior ~24h; on Mondays, cover the weekend).
2. Read the **last 3 files in `drafts/`** to avoid repeating films/figures.
3. **WebSearch** the day's major news across politics, world, business, tech, culture, sport.
4. For each promising event: name the **figure**, then propose the film(s) / reading / trope that share it.
5. **Verify against the live Metatake DB** (Supabase MCP, `execute_sql`, project_id `jvgarcqrtsmgfimdcwgo`):
   - Films: `select slug,title,year from films where title ilike '<title>%';` → use the exact returned slug. If absent, swap to a film that exists or drop the item.
   - Readings (link **published only**): `select slug,title from meta_takes where status='published' and kind='reading' and title ilike '%<concept>%';`
   - Tropes (link **published only**): `select slug,title from meta_takes where status='published' and kind='figure_type' and title ilike '%<concept>%';`
   - **Never** link a `candidate` (unpublished) reading — those have no page.
6. Curate the top ≤7 by rhyme strength + the cutting-room-floor note.
7. Write `drafts/YYYY-MM-DD.md`: the front-matter contract (below) + the body in the shape of `../Metatake_Substack_샘플_2026-06-18.md`. Every news line carries a **source link**; every film/reading/trope is a live `metatake.net` link; end each item with a `→ In Metatake:` line naming the connection (the edge this issue deposits).
8. Append one line to `ledger.md`: `YYYY-MM-DD · films: … · figures: …`.

## Link shapes
- Film: `https://metatake.net/film/<slug>`
- Reading: `https://metatake.net/take/<slug>`
- Trope: `https://metatake.net/trope/<slug>`

---

## File contract (front-matter of every draft) — for the publisher AI

```yaml
---
title: "Between Film and the World"
issue_date: "YYYY-MM-DD"          # ET date
status: pending_review            # pending_review | hold | approved
deposited_at: "<ISO8601 +09:00>"
auto_approve_at: "<deposited_at + 30 minutes>"
send_target_et: "06:00"           # publisher sends ~6:00am America/New_York
items:
  - event: "..."
    source_url: "https://..."
    film: "Bacurau"
    film_url: "https://metatake.net/film/bacurau-2019"
    figure: "the enclosed commons"
    rhyme: 5
---
```

## Publisher rules (the separate posting AI)
1. Read the newest `drafts/*.md`.
2. If `status == hold` → do nothing (the editor pulled it).
3. Else once `now >= auto_approve_at` → treat as **approved**: post to Substack scheduled for `send_target_et` (06:00 America/New_York), then set `status: approved` and add `published_url:`.
4. The editor (Wonwoo) may, within 30 minutes of `deposited_at`, edit the file or set `status: hold`. **Silence = approval.**
5. Never post anything whose links don't resolve. Spot-check 2–3 links first.

---

*Tune the recipe here; the scheduled deposit job reads this file at the start of every run.*
