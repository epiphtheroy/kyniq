-- 0146 — mt_detect_bots(): catch the rotating cloud fleet, and never auto-block an
-- allowlisted network.
--
-- WHY (measured 2026-08-27)
-- ─────────────────────────
-- The two detectors in 0078 both start from _suspect: visitors with EXACTLY ONE
-- pageview in 24h, no referrer, on a deep page. That shape describes the 2026-08
-- scraper (one hit, new visitor hash, move on) and it still works — 116.179.33.0/24
-- has been re-blocked 233 times since 2026-08-20.
--
-- The fleet that arrived this week has the opposite shape and is invisible to both:
--
--   34.122.173.0/24  2026-08-25   1 visitor · 13 pageviews · 15 sessions · 11 deep paths · 0 referrers
--   34.70.129.0/24   2026-08-25   2 visitors · 11 pageviews · 12 sessions ·  6 deep paths · 0 referrers
--   34.46.138.0/24   2026-08-25   2 visitors ·  6 pageviews ·  7 sessions ·  5 deep paths · 0 referrers
--
-- One machine per /24, ten-odd pages each, and a FRESH SESSION PER PAGE. Because
-- every visitor has >1 pageview, _suspect drops them before either detector looks;
-- because each /24 contributes one visitor, the >=6-suspects-per-prefix bar can
-- never be reached no matter how long they stay. On 2026-08-26 there were 16 such
-- /24s in a single day. Widening the existing rule would not help — the signal is
-- not "how many one-shot visitors share a /24", it is the session shape.
--
-- 🔑 THE DISCRIMINATOR IS sessions-vs-pageviews, NOT the IP range.
-- The session id lives in sessionStorage (components/Metrics.tsx), so a person
-- reading five pages in a tab reports FIVE pageviews in ONE session. A crawler
-- that opens a fresh browser context per URL reports one session per pageview.
-- Measured over every prefix with >=3 pageviews in the retention window, the two
-- populations do not overlap: every human prefix had sessions < pageviews, or a
-- referrer, or both. That is why this needs no cloud-CIDR list to maintain — and
-- must not have one. Datacenter ranges change weekly; session arithmetic does not.
--
-- ⚠️ WHY NOT A /16 ROLLUP (tried, rejected on evidence)
-- The fleet's members sit in 34.9, 34.45, 34.46, 34.68, 34.70, 34.96, 34.122, … —
-- a different /16 each. Rolling up by /16 groups nothing. The natural unit is the
-- /8, which is only safe BECAUSE the per-/24 shape filter has already removed
-- humans: at /8, the fleet scored 6 sweeper /24s in a day while the busiest
-- non-fleet /8 scored 2 (and one of those two was the owner's own ISP, which the
-- allowlist now protects outright).
--
-- 🚨 BLAST RADIUS IS UNCHANGED. We never write a /8 or a /16 into bot_blocks. The
-- rollup only decides WHETHER to block; what gets blocked is the individual /24s
-- that took part, on the same 24h TTL and the same strike ladder as before.

create or replace function public.mt_detect_bots()
returns integer
language plpgsql
set search_path to 'public'
as $function$
declare
  new_blocks int := 0; n int := 0;
  deep text := '^/(concept|trope|director|film|figure|theorist|lineage|reception|misreadings|tradition|movements)(/|$)';
begin
  delete from mt_visitor_ip where day < current_date - 3;

  update bot_blocks set active = false
   where active and source = 'auto' and expires_at < now();

  -- ── Detector A/B input: one-shot referrer-less deep hits (0078, unchanged) ──
  create temporary table _suspect on commit drop as
  select e.visitor,
         min(e.path)        as path,
         max(e.country)     as country,
         max(e.screen_w)    as screen_w,
         max(e.browser)     as browser
  from mt_events e
  where e.type = 'pageview' and e.ts > now() - interval '24 hours'
    and e.referrer is null and e.ref_domain is null
    and e.path ~ deep
  group by e.visitor;

  delete from _suspect s
   where (select count(*) from mt_events e2
           where e2.visitor = s.visitor and e2.type = 'pageview'
             and e2.ts > now() - interval '24 hours') <> 1;

  create temporary table _sp on commit drop as
  select s.*, v.prefix
  from _suspect s
  join mt_visitor_ip v on v.visitor = s.visitor
  where v.prefix is not null;

  -- NEW: the allowlist now governs the DETECTOR, not just the harvest guard.
  -- pack_allowlist (0134) already holds the owner's home /24 and Anthropic egress;
  -- 0146 adds the search-engine ranges below. Previously nothing stopped this
  -- function from writing 66.249.x into bot_blocks — middleware exempts GOOD_BOT
  -- before it reads the blocklist so Googlebot would still have got through, but a
  -- block row that looks like "we banned Google" is a trap for whoever reads it
  -- next at 3am. Refuse to write it in the first place.
  delete from _sp s
   where exists (select 1 from pack_allowlist a where s.prefix::inet <<= a.cidr);

  -- ── Detector A — many one-shot visitors behind one /24 (0078, unchanged) ────
  with upsert as (
    insert into bot_blocks (kind, value, reason, confidence, evidence, source, expires_at, hits)
    select 'ip_prefix', p.prefix,
           format('Auto: %s one-shot referrer-less deep hits from %s in 24h', p.suspects, p.prefix),
           'high',
           jsonb_build_object('suspects', p.suspects, 'paths', p.paths, 'detector', 'prefix'),
           'auto', now() + interval '24 hours', p.suspects
    from (
      select prefix, count(*) as suspects, count(distinct path) as paths
      from _sp group by prefix
      having count(*) >= 6 and count(distinct path) >= 5
    ) p
    on conflict (kind, value) do update
       set last_seen  = now(),
           active     = true,
           hits       = excluded.hits,
           strikes    = bot_blocks.strikes + 1,
           evidence   = excluded.evidence,
           expires_at = now() + (case
             when bot_blocks.strikes + 1 >= 4 then interval '30 days'
             when bot_blocks.strikes + 1 = 3 then interval '7 days'
             when bot_blocks.strikes + 1 = 2 then interval '3 days'
             else interval '24 hours' end)
    returning value, (xmax = 0) as is_new
  )
  insert into mt_insights (kind, key, line, data)
  select 'bot_blocked', 'botblk:' || u.value || ':' || to_char(now(), 'YYYY-MM-DD'),
         format('🛡️ 봇 자동 차단: %s (24시간 원샷 딥히트 다수) — 자동 감지·차단', u.value),
         jsonb_build_object('prefix', u.value)
  from upsert u where u.is_new
  on conflict (key) do nothing;
  get diagnostics n = row_count; new_blocks := new_blocks + n;

  -- ── Detector B — one fingerprint spread over rotating IPs (0078, unchanged) ─
  with fp as (
    select country, screen_w, browser, count(*) as suspects
    from _sp where screen_w is not null
    group by country, screen_w, browser
    having count(*) >= 15
  ),
  contrib as (
    select sp.prefix
    from _sp sp
    join fp using (country, screen_w, browser)
    group by sp.prefix
    having count(*) >= 3
  ),
  upsert as (
    insert into bot_blocks (kind, value, reason, confidence, evidence, source, expires_at, hits)
    select 'ip_prefix', c.prefix,
           'Auto: fingerprint-cluster scraper (rotating IPs)', 'high',
           jsonb_build_object('detector', 'fingerprint'),
           'auto', now() + interval '24 hours', 3
    from contrib c
    on conflict (kind, value) do update
       set last_seen  = now(),
           active     = true,
           strikes    = bot_blocks.strikes + 1,
           expires_at = now() + (case
             when bot_blocks.strikes + 1 >= 4 then interval '30 days'
             when bot_blocks.strikes + 1 = 3 then interval '7 days'
             when bot_blocks.strikes + 1 = 2 then interval '3 days'
             else interval '24 hours' end)
    returning value, (xmax = 0) as is_new
  )
  insert into mt_insights (kind, key, line, data)
  select 'bot_blocked', 'botblk:' || u.value || ':' || to_char(now(), 'YYYY-MM-DD'),
         format('🛡️ 봇 자동 차단: %s (동일지문 대량 스크레이핑) — 자동 감지·차단', u.value),
         jsonb_build_object('prefix', u.value)
  from upsert u where u.is_new
  on conflict (key) do nothing;
  get diagnostics n = row_count; new_blocks := new_blocks + n;

  -- ── Detector C (NEW) — session-per-page sweeps ─────────────────────────────
  -- Per /24 over 24h. Deliberately NOT built on _suspect: this is the shape
  -- _suspect throws away.
  create temporary table _sweep on commit drop as
  select v.prefix,
         count(*) filter (where e.type = 'pageview')          as pv,
         count(distinct e.session)                            as sessions,
         count(distinct e.path) filter (
           where e.type = 'pageview' and e.path ~ deep)       as deep_paths,
         count(*) filter (where e.type = 'pageview'
                            and (e.referrer is not null or e.ref_domain is not null)) as referred
  from mt_events e
  join (select distinct visitor, prefix from mt_visitor_ip where prefix is not null) v
    on v.visitor = e.visitor
  where e.ts > now() - interval '24 hours'
  group by v.prefix;

  -- A single referred pageview is enough to spare a prefix. Crawlers arrive with
  -- no referrer by construction; a person who clicked in from anywhere has one.
  -- Cheap, and it fails in the safe direction.
  delete from _sweep s
   where s.referred > 0
      or exists (select 1 from pack_allowlist a where s.prefix::inet <<= a.cidr);

  with solo as (
    -- C1 — one /24 sweeping on its own. sessions >= 0.8*pv rather than sessions
    -- >= pv because a crawler that reuses a context for a couple of pages still
    -- reads as a sweep; the 0.8 slack costs nothing (measured humans sat far
    -- below it — a real 13-pageview reader produced 1-4 sessions, not 11).
    select prefix, 'solo' as via, pv, deep_paths
    from _sweep
    where pv >= 6 and sessions >= pv * 0.8 and deep_paths >= 5
  ),
  member as (
    -- C2 — the thin-spread case: each /24 alone is under every bar, and the fleet
    -- only exists as a pattern across siblings. IPv4 only (an IPv6 prefix is a
    -- /48 and has no dotted octets to group on; v6 fleets, if they come, need
    -- their own rollup rather than a silently wrong one).
    select prefix, split_part(prefix, '.', 1) as net8, pv, deep_paths
    from _sweep
    where pv >= 2 and sessions >= pv and deep_paths >= 1
      and prefix like '%.%' and prefix not like '%:%'
  ),
  fleet as (
    select net8 from member group by net8
    having count(*) >= 4 and sum(pv) >= 10 and max(deep_paths) >= 3
  ),
  caught as (
    select prefix, via, pv, deep_paths from solo
    union all
    select m.prefix, 'fleet', m.pv, m.deep_paths from member m join fleet f using (net8)
  ),
  -- A prefix can qualify both ways; 'solo' is the more specific finding, so it
  -- wins the reason line. distinct on needs the order by to be deterministic.
  ranked as (
    select distinct on (prefix) prefix, via, pv, deep_paths
    from caught order by prefix, (via = 'solo') desc
  ),
  upsert as (
    insert into bot_blocks (kind, value, reason, confidence, evidence, source, expires_at, hits)
    select 'ip_prefix', r.prefix,
           case when r.via = 'solo'
             then format('Auto: session-per-page sweep from %s — %s pageviews over %s deep paths, no referrer, in 24h',
                         r.prefix, r.pv, r.deep_paths)
             else format('Auto: rotating fleet — %s is one of >=4 sweeping /24s in %s.0.0.0/8 in 24h',
                         r.prefix, split_part(r.prefix, '.', 1))
           end,
           'high',
           jsonb_build_object('detector', 'sweep', 'via', r.via,
                              'pv', r.pv, 'deep_paths', r.deep_paths),
           'auto', now() + interval '24 hours', r.pv
    from ranked r
    on conflict (kind, value) do update
       set last_seen  = now(),
           active     = true,
           hits       = excluded.hits,
           strikes    = bot_blocks.strikes + 1,
           evidence   = excluded.evidence,
           expires_at = now() + (case
             when bot_blocks.strikes + 1 >= 4 then interval '30 days'
             when bot_blocks.strikes + 1 = 3 then interval '7 days'
             when bot_blocks.strikes + 1 = 2 then interval '3 days'
             else interval '24 hours' end)
    returning value, (xmax = 0) as is_new
  )
  insert into mt_insights (kind, key, line, data)
  select 'bot_blocked', 'botblk:' || u.value || ':' || to_char(now(), 'YYYY-MM-DD'),
         format('🛡️ 봇 자동 차단: %s (페이지마다 새 세션 — 순회 크롤) — 자동 감지·차단', u.value),
         jsonb_build_object('prefix', u.value)
  from upsert u where u.is_new
  on conflict (key) do nothing;
  get diagnostics n = row_count; new_blocks := new_blocks + n;

  return new_blocks;
end;
$function$;

-- Search-engine crawler ranges. These are the networks the detector must never
-- write into bot_blocks. middleware.ts already exempts them by UA (GOOD_BOT runs
-- before the blocklist lookup), so this changes no request outcome today — it
-- keeps the ledger honest and survives someone editing that regex later.
--
-- Deliberately short. Only ranges observed in our own logs or owned outright by
-- the operator are listed; anything speculative would be a self-inflicted hole.
-- Every other named search/citation bot stays covered by GOOD_BOT.
insert into pack_allowlist (cidr, label, note) values
  ('66.249.64.0/19', 'Googlebot',
   'Google crawl range — observed here as 66.249.89.x and 66.249.92.x (Googlebot + AdsBot)'),
  ('17.0.0.0/8', 'Apple / Applebot',
   'Apple owns 17/8 outright; Applebot crawls from it and is a GOOD_BOT'),
  ('40.77.167.0/24', 'bingbot', 'Classic bingbot crawl range'),
  ('157.55.39.0/24', 'bingbot', 'Classic bingbot crawl range'),
  ('207.46.13.0/24', 'bingbot', 'Classic bingbot crawl range')
on conflict (cidr) do nothing;
