-- 0091_pack_harvest_guard.sql — durable multi-signal guard for the free pack copy API (2026-07-13)
--
-- The free copy backend (/api/pack/[slug]) serves the whole context pack with no
-- login — it is the one /api surface a scraper can bulk-harvest. Its only prior
-- defense was an in-memory per-isolate rate limit, near-useless on serverless.
--
-- A pure rate limit is not enough: a patient scraper that STAYS UNDER the rate
-- cap can still drain the whole corpus with a slow drip over hours or days. So we
-- watch THREE signals per /24 (v4) / /48 (v6) prefix and block on any of them:
--
--   1) RATE      — > p_rate hits in 10 min           (a burst)               → 24h block
--   2) VOLUME    — > p_vol  hits in one day          (too much, total)       → 7-day block
--   3) PERSIST   — active ≥ p_hours span AND > p_pvol hits/day (slow drain)  → 7-day block
--
-- Because the route sets a 24h CDN cache, only cache-MISSES reach the function —
-- and a miss is (almost always) a NEW slug. So "hits that reach the function"
-- ≈ "distinct film packs pulled". The daily VOLUME cap is therefore effectively
-- a "distinct films harvested / day" cap.
--
-- The block unit is the /24 (or /48) prefix — i.e. "beyond a single IP", so IP
-- rotation within a subnet doesn't dodge it. We deliberately do NOT escalate to
-- /16 or whole-ASN (that over-blocks legitimate/citation traffic — see the memo
-- on OVH/Amazon ASNs). Repeat offenders instead escalate in TIME (24h→3d→7d→30d)
-- via bot_blocks strikes, so a persistent harvester ends up blocked for a month.
--
-- Blocks land in bot_blocks, the same table the edge middleware enforces
-- (0078_bot_sentinel.sql) — now extended to cover /api/pack. Auto rows self-
-- release when the prefix goes quiet (expires_at + mt_detect_bots auto-release).
-- Thresholds sit far above any human clicking "Copy for AI", even a large office
-- behind one NAT, but are trivially tripped by enumeration.

-- ── counters ────────────────────────────────────────────────────────────────
-- short window: per-minute buckets, for the 10-min RATE signal (15-min retention)
create table if not exists public.pack_hits (
  prefix text        not null,
  bucket timestamptz not null,          -- date_trunc('minute', now())
  n      int         not null default 0,
  primary key (prefix, bucket)
);
create index if not exists pack_hits_bucket_idx on public.pack_hits (bucket);
alter table public.pack_hits enable row level security;

-- daily rollup: for the VOLUME + PERSIST signals (3-day retention)
create table if not exists public.pack_hits_daily (
  prefix   text        not null,
  day      date        not null,
  hits     int         not null default 0,
  first_ts timestamptz not null default now(),
  last_ts  timestamptz not null default now(),
  primary key (prefix, day)
);
create index if not exists pack_hits_daily_day_idx on public.pack_hits_daily (day);
alter table public.pack_hits_daily enable row level security;

-- ── note-a-hit + maybe-auto-block ───────────────────────────────────────────
-- Returns { n, day, span_h, blocked, reason }. Fail-open by design: the route
-- wraps this in try/catch and ignores errors, so a DB hiccup can never break the
-- (free, public) copy path.
create or replace function public.pack_note_hit(
  p_prefix  text,
  p_rate    int default 150,   -- signal 1: hits / 10 min
  p_vol     int default 600,   -- signal 2: hits / day  (≈ distinct films / day)
  p_hours   int default 3,     -- signal 3: min active span (hours) to count as "persistent"
  p_pvol    int default 300    -- signal 3: hits / day while persistent
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_bucket timestamptz := date_trunc('minute', now());
  v_day    date        := current_date;
  v_rate10 int;
  v_dhits  int;
  v_first  timestamptz;
  v_last   timestamptz;
  v_span_h numeric;
  v_reason text := null;
  v_ttl    interval;
begin
  if p_prefix is null or p_prefix = '' then
    return jsonb_build_object('n', 0, 'blocked', false);
  end if;

  -- opportunistic GC
  delete from pack_hits       where bucket < now() - interval '15 minutes';
  delete from pack_hits_daily where day    < current_date - 2;

  -- record the hit in both counters
  insert into pack_hits (prefix, bucket, n) values (p_prefix, v_bucket, 1)
    on conflict (prefix, bucket) do update set n = pack_hits.n + 1;
  insert into pack_hits_daily (prefix, day, hits) values (p_prefix, v_day, 1)
    on conflict (prefix, day) do update set hits = pack_hits_daily.hits + 1, last_ts = now();

  -- read back the three signals
  select coalesce(sum(n), 0) into v_rate10
    from pack_hits where prefix = p_prefix and bucket > now() - interval '10 minutes';
  select hits, first_ts, last_ts into v_dhits, v_first, v_last
    from pack_hits_daily where prefix = p_prefix and day = v_day;
  v_span_h := extract(epoch from (v_last - v_first)) / 3600.0;

  -- decide (most-severe → longest block)
  if v_dhits > p_vol then
    v_reason := format('volume — %s pack pulls today from %s', v_dhits, p_prefix);
    v_ttl := interval '7 days';
  elsif v_span_h >= p_hours and v_dhits > p_pvol then
    v_reason := format('persistent drain — %s pulls over %.1fh from %s', v_dhits, v_span_h, p_prefix);
    v_ttl := interval '7 days';
  elsif v_rate10 > p_rate then
    v_reason := format('rate — %s hits/10min from %s', v_rate10, p_prefix);
    v_ttl := interval '24 hours';
  end if;

  if v_reason is null then
    return jsonb_build_object('n', v_rate10, 'day', v_dhits, 'span_h', round(v_span_h, 2), 'blocked', false);
  end if;

  -- auto-block the /24 (or /48). Same shape + strike-escalation as mt_detect_bots();
  -- never SHORTEN an existing block (greatest of strike-TTL and this signal's TTL).
  insert into bot_blocks (kind, value, reason, confidence, evidence, source, expires_at, hits)
  values (
    'ip_prefix', p_prefix, 'Auto: pack-API ' || v_reason, 'high',
    jsonb_build_object('detector', 'pack_guard', 'rate10', v_rate10, 'day_hits', v_dhits, 'span_h', round(v_span_h, 2)),
    'auto', now() + v_ttl, v_dhits
  )
  on conflict (kind, value) do update
     set last_seen  = now(),
         active     = true,
         hits       = excluded.hits,
         strikes    = bot_blocks.strikes + 1,
         evidence   = excluded.evidence,
         reason     = excluded.reason,
         expires_at = greatest(
           bot_blocks.expires_at,
           now() + (case
             when bot_blocks.strikes + 1 >= 4 then interval '30 days'
             when bot_blocks.strikes + 1 = 3 then interval '7 days'
             when bot_blocks.strikes + 1 = 2 then interval '3 days'
             else interval '24 hours' end),
           now() + v_ttl);

  insert into mt_insights (kind, key, line, data)
  values (
    'bot_blocked', 'botblk:' || p_prefix || ':' || to_char(now(), 'YYYY-MM-DD'),
    format('🛡️ 봇 자동 차단: %s (팩 API %s) — 자동 감지·차단', p_prefix, v_reason),
    jsonb_build_object('prefix', p_prefix, 'detector', 'pack_guard')
  )
  on conflict (key) do nothing;

  return jsonb_build_object('n', v_rate10, 'day', v_dhits, 'span_h', round(v_span_h, 2), 'blocked', true, 'reason', v_reason);
end;
$fn$;

revoke execute on function public.pack_note_hit(text, int, int, int, int) from public, anon, authenticated;
grant  execute on function public.pack_note_hit(text, int, int, int, int) to service_role;
