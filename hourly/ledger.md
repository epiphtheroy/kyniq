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
2026-07-09T01:00:00+00:00 · PASS · no beat candidate above threshold (20 raw)
2026-07-09T02:00:00+00:00 · PASS · no beat candidate above threshold (20 raw)
2026-07-09T03:00:00+00:00 · PASS · no beat candidate above threshold (20 raw)
2026-07-09T05:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-09T06:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 1 recorded
2026-07-09T07:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 1 recorded
2026-07-09T08:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-09T09:00:00+00:00 · PUBLISHED · kw: Hong Sang-soo · anchor: hong-sang-soo · lane: direct · modules: filmography,takescore-walk-up-2022 · /now/hong-sang-soo-locarno-2026-lineup-competition · dist: revalidate,indexnow:200,bluesky:200
2026-07-09T10:00:00+00:00 · PUBLISHED · kw: little house on the prairie netflix · anchor: house-1977 · lane: direct · modules: takescore,locations · /now/little-house-on-the-prairie-netflix-reboot-simpler-world · dist: revalidate,indexnow:200,bluesky:200
2026-07-09T11:00:01+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-09T12:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-09T13:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-09T14:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 1 recorded
2026-07-09T15:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-09T21:40:04+00:00 · PUBLISHED · kw: Alien · anchor: alien-1979 · lane: direct · modules: locations,takescore · /now/alien-earth-season-2-cast-london-pinewood · dist: revalidate,indexnow:200,bluesky:200
2026-07-09T22:00:00+00:00 · KILLED · Her · gate x2: source unreachable (0): https://www.itv.com/news/2026-07-09/singer-bonnie-tyler-dies-aged-75
2026-07-09T22:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 2 reviewed
2026-07-09T23:00:00+00:00 · PUBLISHED · kw: Big · anchor: big-1988 · lane: direct · modules: canon,locations · /now/big-brother-28-premiere-big-1988-search-spike · dist: revalidate,indexnow:200,bluesky:200
2026-07-10T00:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-10T01:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 1 recorded
2026-07-10T02:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-10T03:00:00+00:00 · PASS-CAND · Big · archive links 0<4
2026-07-10T03:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-10T04:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-10T05:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-10T06:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-10T07:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-10T08:00:01+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-10T09:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-10T10:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-10T11:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-10T12:00:01+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 1 recorded
2026-07-10T13:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-10T14:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-10T15:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-10T16:00:00+00:00 · PUBLISHED · kw: Boy · anchor: boy-1969 · lane: direct · modules: canon,reception · /now/micheal-ward-not-guilty-boy-search-oshima-1969 · dist: revalidate,indexnow:200,bluesky:200
2026-07-10T18:35:33+00:00 · PASS · candidates tried, none survived selection/gate · wire: 2 reviewed
2026-07-10T20:13:41+00:00 · PASS · candidates tried, none survived selection/gate · wire: 2 reviewed
2026-07-10T21:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 2 reviewed
2026-07-10T22:05:56+00:00 · PUBLISHED · kw: christopher nolan · anchor: christopher-nolan · lane: direct · modules: filmography,takescore-oppenheimer-2023 · /now/christopher-nolan-odyssey-backlash-irrelevant-telegraph · dist: revalidate,indexnow:200,bluesky:200
2026-07-11T00:48:56+00:00 · PUBLISHED · kw: Play · anchor: play-2011 · lane: direct · modules: takescore,honors · /now/morgan-spector-robert-langdon-play-ostlund-2011 · dist: revalidate,indexnow:200,bluesky:200
2026-07-11T01:00:00+00:00 · PUBLISHED · kw: Why · anchor: why-1972 · lane: direct · modules: canon,takescore · /now/why-1972-nanni-loy-sordi-explainer-headlines · dist: revalidate,indexnow:200,bluesky:200
2026-07-11T02:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-11T03:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-11T04:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 1 recorded
2026-07-11T05:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-11T06:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 2 recorded
2026-07-11T07:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 1 recorded
2026-07-11T08:00:17+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-11T09:00:01+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-11T10:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-11T11:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-11T12:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-11T13:00:01+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-11T14:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 1 recorded
2026-07-11T15:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-11T16:26:52+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-11T17:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-11T18:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-11T19:04:23+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-11T20:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-11T21:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-11T22:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-11T23:00:00+00:00 · KILLED · Moana · insert fail 401 {"message":"Forbidden use of secret API key in browser","hint":"Secret API keys can only be used in a protected envi
2026-07-12T00:00:00+00:00 · KILLED · Moana · insert fail 401 {"message":"Forbidden use of secret API key in browser","hint":"Secret API keys can only be used in a protected envi
2026-07-12T01:00:01+00:00 · KILLED · Moana · insert fail 401 {"message":"Forbidden use of secret API key in browser","hint":"Secret API keys can only be used in a protected envi
2026-07-12T02:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-12T03:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-12T04:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-12T05:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-12T06:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-12T07:00:01+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-12T08:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-12T09:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-12T10:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-12T11:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-12T12:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-12T13:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-12T14:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-12T15:00:01+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-12T16:00:00+00:00 · KILLED · Moana · insert fail 401 {"message":"Forbidden use of secret API key in browser","hint":"Secret API keys can only be used in a protected envi
2026-07-12T17:00:01+00:00 · KILLED · Moana · insert fail 401 {"message":"Forbidden use of secret API key in browser","hint":"Secret API keys can only be used in a protected envi
2026-07-12T18:00:01+00:00 · KILLED · Moana · insert fail 401 {"message":"Forbidden use of secret API key in browser","hint":"Secret API keys can only be used in a protected envi
2026-07-12T19:00:01+00:00 · KILLED · Moana · insert fail 401 {"message":"Forbidden use of secret API key in browser","hint":"Secret API keys can only be used in a protected envi
2026-07-12T20:00:00+00:00 · KILLED · Moana · insert fail 401 {"message":"Forbidden use of secret API key in browser","hint":"Secret API keys can only be used in a protected envi
2026-07-13T12:31:13+00:00 · PUBLISHED · kw: Jurassic Park · anchor: jurassic-park-1993 · lane: direct · modules: takescore,canon · /now/sam-neill-death-jurassic-park-alan-grant-1993 · dist: revalidate,indexnow:200,bluesky:200
2026-07-13T12:33:07+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-13T13:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-13T14:00:00+00:00 · PUBLISHED · kw: digger · anchor: alejandro-gonzalez-inarritu · lane: direct · modules: takescore-the-revenant-2015,takescore-bardo-2022 · /now/digger-tom-cruise-inarritu-trailer-comedy · dist: revalidate,indexnow:200,bluesky:200
2026-07-13T20:21:23+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-13T21:40:54+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-13T22:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-13T23:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-14T00:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-14T01:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-14T02:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-14T03:00:01+00:00 · PUBLISHED · kw: David · anchor: david-1979 · lane: direct · modules: takescore,canon · /now/david-search-spike-ellison-zaslav-vs-david-1979 · dist: revalidate,indexnow:200,bluesky:200
2026-07-14T04:00:01+00:00 · PASS · candidates tried, none survived selection/gate · wire: 2 reviewed
2026-07-14T05:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 2 reviewed
2026-07-14T06:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 2 reviewed
2026-07-14T07:00:00+00:00 · PUBLISHED · kw: andy serkis · anchor: the-hunt-2012 · lane: direct · modules: takescore,canon · /now/andy-serkis-animal-farm-gollum-ai-motion-capture · dist: revalidate,indexnow:200,bluesky:200
2026-07-14T08:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-14T09:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-14T10:00:00+00:00 · PUBLISHED · kw: 5 · anchor: custody-2018 · lane: direct · modules: takescore,canon · /now/under-suspicion-tracie-andrews-pulled-custody-consent · dist: revalidate,indexnow:200,bluesky:200
2026-07-14T11:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 1 recorded
2026-07-14T12:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-14T13:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-14T14:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-14T15:00:00+00:00 · PUBLISHED · kw: behemoth movie · anchor: tony-gilroy · lane: direct · modules: takescore-michael-clayton-2007,filmography · /now/behemoth-tony-gilroy-pedro-pascal-trailer · dist: revalidate,indexnow:200,bluesky:200
2026-07-14T16:00:00+00:00 · PASS · daily cap 4/4 · wire: 4 reviewed
2026-07-14T17:00:01+00:00 · PASS · daily cap 4/4 · wire: 4 reviewed
2026-07-14T18:00:01+00:00 · PASS · daily cap 4/4 · wire: 1 reviewed
2026-07-14T19:00:00+00:00 · PASS · daily cap 4/4 · wire: 1 reviewed
2026-07-14T21:20:09+00:00 · PASS · daily cap 4/4 · wire: 2 reviewed
2026-07-14T23:30:02+00:00 · PASS · daily cap 4/4 · wire: 3 reviewed
2026-07-15T00:00:00+00:00 · PUBLISHED · kw: jennifer hudson · anchor: the-world-2004 · lane: direct · modules: takescore,locations · /now/jennifer-hudson-world-cup-final-the-world-2004 · dist: revalidate,indexnow:200,bluesky:200
2026-07-15T01:00:00+00:00 · PUBLISHED · kw: Boys · anchor: boys-1977 · lane: direct · modules: takescore,canon · /now/boys-for-life-tyler-falbo-paramount-primal-vs-malmros-boys-1977 · dist: revalidate,indexnow:200,bluesky:200
2026-07-15T02:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-15T03:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-15T04:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-15T05:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-15T06:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-15T07:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-15T08:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-15T09:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-15T10:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-15T11:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 1 recorded
2026-07-15T12:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-15T13:00:01+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-15T14:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-25T07:37:55+00:00 · PUBLISHED · kw: House · anchor: house-1977 · lane: direct · modules: takescore,reception · /now/house-search-spike-whcda-obayashi-1977 · dist: revalidate,indexnow:200,bluesky:200
2026-07-25T08:00:01+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-25T09:00:01+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-25T10:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-25T11:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-25T12:39:57+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-25T16:02:40+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-25T23:36:21+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 1 recorded
2026-07-26T00:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-26T01:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-26T02:00:00+00:00 · PUBLISHED · kw: david jonsson · anchor: black-panther-2018 · lane: direct · modules: takescore,canon · /now/david-jonsson-black-panther-3-tchalla-son-casting · dist: revalidate,indexnow:200,bluesky:200
2026-07-26T03:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 2 reviewed
2026-07-26T04:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-26T05:00:00+00:00 · PUBLISHED · kw: Ghost · anchor: ghost-1990 · lane: direct · modules: takescore,honors · /now/ghost-1990-not-gosling-ghost-rider-marvel · dist: revalidate,indexnow:200,bluesky:200
2026-07-26T06:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 2 reviewed
2026-07-26T07:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 2 reviewed
2026-07-26T08:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 2 reviewed
2026-07-26T09:00:01+00:00 · PASS · candidates tried, none survived selection/gate · wire: 2 reviewed
2026-07-26T10:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 2 reviewed
2026-07-26T11:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 2 reviewed
2026-07-26T12:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 2 reviewed
2026-07-26T13:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 2 reviewed
2026-07-26T14:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 1 recorded
2026-07-26T15:00:00+00:00 · PUBLISHED · kw: cody john · anchor: weekend-2011 · lane: direct · modules: takescore,honors · /now/cody-john-emma-roberts-wedding-weekend-2011 · dist: revalidate,indexnow:200,bluesky:200
2026-07-26T16:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-26T17:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-26T18:00:01+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-26T19:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-26T20:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 1 recorded
2026-07-26T21:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-26T22:00:01+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-26T23:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-27T00:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-27T01:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-27T02:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-27T03:00:01+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-27T04:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-27T05:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-27T06:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-27T07:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 1 recorded
2026-07-27T08:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-27T09:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-27T10:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 1 recorded
2026-07-27T11:00:00+00:00 · PUBLISHED · kw: Christopher Nolan · anchor: christopher-nolan · lane: direct · modules: takescore-oppenheimer-2023,filmography · /now/christopher-nolan-odyssey-circe-leak · dist: revalidate,indexnow:200,bluesky:200
2026-07-27T12:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 1 recorded
2026-07-27T13:00:00+00:00 · PUBLISHED · kw: armie hammer · anchor: big-1988 · lane: direct · modules: takescore,canon · /now/armie-hammer-citizen-vigilante-musk-uk · dist: revalidate,indexnow:200,bluesky:200
2026-07-27T14:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-27T15:00:01+00:00 · PUBLISHED · kw: Living · anchor: living-2022 · lane: direct · modules: takescore,honors · /now/carly-simon-parkinsons-and-the-film-living-2022 · dist: revalidate,indexnow:200,bluesky:200
2026-07-27T16:00:00+00:00 · PUBLISHED · kw: Peacock · anchor: peacock-2005 · lane: direct · modules: canon,takescore · /now/peacock-youtube-premium-bundle-2027-vs-gu-changwei-film · dist: revalidate,indexnow:200,bluesky:200
2026-07-27T17:00:00+00:00 · PASS · daily cap 4/4 · wire: 5 reviewed
2026-07-27T18:00:00+00:00 · PASS · daily cap 4/4 · wire: 6 reviewed
2026-07-27T19:00:00+00:00 · PASS · daily cap 4/4 · wire: 0 reviewed
2026-07-27T20:00:00+00:00 · PASS · daily cap 4/4 · wire: 5 reviewed
2026-07-27T21:00:00+00:00 · PASS · daily cap 4/4 · wire: 3 reviewed
2026-07-27T22:00:00+00:00 · PASS · daily cap 4/4 · wire: 4 reviewed
2026-07-27T23:00:00+00:00 · PASS · daily cap 4/4 · wire: 4 reviewed
2026-07-28T00:00:00+00:00 · PUBLISHED · kw: la la land · anchor: festival-1996 · lane: direct · modules: takescore,canon · /now/la-la-land-venice-concert-10th-anniversary · dist: revalidate,indexnow:200,bluesky:200
2026-07-28T01:00:00+00:00 · PUBLISHED · kw: Obsession · anchor: obsession-1976 · lane: direct · modules: takescore,canon · /now/obsession-1976-de-palma-vs-mummy-4-michael-johnston · dist: revalidate,indexnow:200,bluesky:200
2026-07-28T02:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 2 reviewed
2026-07-28T03:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-28T04:00:00+00:00 · PUBLISHED · kw: 3 · anchor: custody-2018 · lane: direct · modules: takescore,canon · /now/custody-search-seattle-shooting-legrand-2018 · dist: revalidate,indexnow:200,bluesky:200
2026-07-28T05:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-28T06:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-28T07:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-28T08:00:00+00:00 · PUBLISHED · kw: Spider · anchor: spider-2002 · lane: direct · modules: honors,locations · /now/spider-cronenberg-2002-brand-new-day-grounded · dist: revalidate,indexnow:200,bluesky:200
2026-07-28T09:00:00+00:00 · PASS · daily cap 4/4 · wire: 3 reviewed
2026-07-28T10:00:00+00:00 · PASS · daily cap 4/4 · wire: 4 reviewed
2026-07-28T11:00:00+00:00 · PASS · daily cap 4/4 · wire: 3 reviewed
2026-07-28T12:00:00+00:00 · PASS · daily cap 4/4 · wire: 3 reviewed
2026-07-28T13:00:00+00:00 · PASS · daily cap 4/4 · wire: 2 reviewed
2026-07-28T14:00:00+00:00 · PASS · daily cap 4/4 · wire: 4 reviewed
2026-07-28T15:00:00+00:00 · PASS · daily cap 4/4 · wire: 2 reviewed
2026-07-28T16:00:00+00:00 · PASS · daily cap 4/4 · wire: 4 reviewed
2026-07-28T17:00:00+00:00 · PASS · daily cap 4/4 · wire: 2 reviewed
2026-07-28T18:00:00+00:00 · PASS · daily cap 4/4 · wire: 5 reviewed
2026-07-28T19:00:00+00:00 · PASS · daily cap 4/4 · wire: 3 reviewed
2026-07-28T20:00:01+00:00 · PASS · daily cap 4/4 · wire: 6 reviewed
2026-07-28T21:00:00+00:00 · PASS · daily cap 4/4 · wire: 4 reviewed
2026-07-28T22:00:00+00:00 · PASS · daily cap 4/4 · wire: 5 reviewed
2026-07-28T23:00:00+00:00 · PASS · daily cap 4/4 · wire: 6 reviewed
2026-07-29T00:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-07-29T01:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-29T02:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-29T06:00:00+00:00 · PASS · no beat candidate above threshold (10 raw) · wire: 1 recorded
2026-07-29T07:00:00+00:00 · PUBLISHED · kw: jumanji open world · anchor: black-2005 · lane: direct · modules: takescore,canon · /now/jumanji-open-world-trailer-black-2005 · dist: revalidate,indexnow:200,bluesky:200
2026-07-29T08:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-07-29T09:00:00+00:00 · PUBLISHED · kw: Accused · anchor: accused-1964 · lane: direct · modules: takescore,canon · /now/accused-1964-search-spike-jared-leto-bbc-doc · dist: revalidate,indexnow:200,bluesky:200
2026-07-29T10:00:00+00:00 · PASS-CAND · kavinsky · archive links 1<4
2026-07-29T10:00:00+00:00 · PASS-CAND · Accused · archive links 0<4
2026-07-29T10:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 2 reviewed
2026-08-03T05:18:45+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-08-03T05:20:28+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 1 recorded
2026-08-03T06:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 1 recorded
2026-08-03T07:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-08-03T08:00:00+00:00 · PASS-CAND · Spider · archive links 0<4
2026-08-03T08:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-08-03T09:00:01+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-08-03T10:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-08-03T11:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-08-03T12:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-08-03T13:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-08-03T14:00:01+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 1 recorded
2026-08-03T15:00:01+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-08-03T16:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-08-03T17:00:00+00:00 · PUBLISHED · kw: Police · anchor: police-1985 · lane: direct · modules: takescore,canon · /now/police-1985-pialat-cw-police-24-7-renewal · dist: revalidate,indexnow:200,bluesky:200
2026-08-03T18:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-08-03T19:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-08-03T20:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-08-03T21:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-08-03T22:00:00+00:00 · PASS · candidates tried, none survived selection/gate · wire: 1 reviewed
2026-08-03T23:00:00+00:00 · PUBLISHED · kw: deadpool and wolverine · anchor: the-devil-wears-prada-2006 · lane: direct · modules: takescore,honors · /now/devil-wears-prada-2-vs-deadpool-wolverine-streaming · dist: revalidate,indexnow:200,bluesky:200
2026-08-04T00:00:00+00:00 · PUBLISHED · kw: huw edwards · anchor: poetry-2010 · lane: direct · modules: takescore,reception · /now/huw-edwards-gelyn-eisteddfod-poem-poetry-2010 · dist: revalidate,indexnow:200,bluesky:200
2026-08-04T01:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 1 recorded
2026-08-04T02:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-08-04T03:00:00+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-08-04T04:00:00+00:00 · PUBLISHED · kw: m · anchor: avengers-endgame-2019 · lane: direct · modules: takescore,locations · /now/avengers-endgame-opening-record-spider-man-brand-new-day · dist: revalidate,indexnow:200,bluesky:200
2026-08-04T05:00:01+00:00 · PASS · no beat candidate above threshold (20 raw) · wire: 0 recorded
2026-08-04T06:00:00+00:00 · PUBLISHED · kw: very · anchor: christopher-nolan · lane: direct · modules: filmography,takescore-oppenheimer-2023 · /now/very-modern-odyssey-vs-nolan-odyssey-homer · dist: revalidate,indexnow:200,bluesky:200
