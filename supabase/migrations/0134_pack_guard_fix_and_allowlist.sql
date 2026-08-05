-- 0134_pack_guard_fix_and_allowlist.sql — repair the harvest guard, raise the
-- daily thresholds, and add an owner-editable allowlist (2026-08-05)
--
-- ── WHY (the bug) ───────────────────────────────────────────────────────────
-- 0091 shipped three anti-harvest signals. Signal 2 (VOLUME) and signal 1 (RATE)
-- built their reason string with plain %s. Signal 3 (PERSIST — the slow-drip
-- detector, the one the migration was explicitly written for) used `%.1f`:
--
--   format('persistent drain — %s pulls over %.1fh from %s', ...)
--
-- Postgres format() only knows %s / %I / %L / %%. `%.1f` raises
--   ERROR 22023: unrecognized format() type specifier "."
-- every single time the branch is reached. Consequences, in order of nastiness:
--
--   1. The function aborts → the route's try/catch fails open → no block.
--   2. The abort ROLLS BACK the whole call, including this hit's counter
--      increment → pack_hits_daily pins at p_pvol and can never grow past it.
--   3. Pinned at p_pvol, the VOLUME signal (> p_vol/day) becomes unreachable.
--   4. PERSIST is evaluated before RATE, so once a prefix has p_pvol hits with a
--      >= p_hours span, RATE never fires either.
--   ⇒ any caller spread over 3h+ was permanently exempt from all three signals
--     for the rest of the day. Exactly the "patient scraper" 0091 set out to stop.
--
-- Evidence (mcp_calls, 2026-08-05): 35.186.14.0/24 ran 377 / 432 / 493 guarded
-- calls/day over 20-23h spans on 07-31..08-02 — every day past the 300 threshold,
-- never blocked, no bot_blocks row. In 24 days the pack guard fired exactly once
-- (2026-07-19), via RATE — the one branch whose format string was valid.
--
-- ── WHAT CHANGES ────────────────────────────────────────────────────────────
--   · %.1f → %s + round()  (the fix)
--   · p_pvol 300 → 1000, p_vol 600 → 2000 (owner call 2026-08-05). The old 300/day
--     sat below normal AI-agent traffic; the observed legitimate caller peaked at
--     493/day. VOLUME must stay ABOVE PERSIST or it would fire first and make the
--     slow-drip tier meaningless.
--   · pack_allowlist — never block these prefixes. Two layers by design: code
--     (lib/apiGuard.ts TRUSTED_EGRESS, skips the round trip for Anthropic) and
--     this table (owner-editable without a deploy, covers everyone else).
--   · the bot_blocks / mt_insights writes now sit in their own exception block,
--     so a future failure there can never again silently roll back the counters.
--
-- Fail-open is retained deliberately (a DB hiccup must not break a free public
-- read path) — but the callers now report guard failures to Sentry instead of
-- swallowing them, so the next silent break surfaces in hours, not 3 weeks.

-- ── allowlist ───────────────────────────────────────────────────────────────
create table if not exists public.pack_allowlist (
  cidr     cidr        primary key,
  label    text        not null,
  note     text,
  added_at timestamptz not null default now()
);
alter table public.pack_allowlist enable row level security;
-- No policies on purpose: anon/authenticated get nothing; service_role and the
-- SECURITY DEFINER function below bypass RLS.

comment on table public.pack_allowlist is
  'Prefixes the pack/MCP/v1 harvest guard must never block. Matched with <<= so a /21 covers its /24s. Add: insert into pack_allowlist (cidr, label, note) values (''1.2.3.0/24'', ''who'', ''why'');';

insert into public.pack_allowlist (cidr, label, note) values
  ('160.79.104.0/21', 'Anthropic egress',
   'claude.ai / Claude Code — many users behind few /24s; also short-circuited in lib/apiGuard.ts TRUSTED_EGRESS'),
  ('180.70.243.0/24', 'Owner home network',
   'Internal QA agents tripped the guard here on 2026-07-19 and blocked the owner (incl. phone) for 30 days — never again')
on conflict (cidr) do nothing;

-- ── the guard ───────────────────────────────────────────────────────────────
create or replace function public.pack_note_hit(
  p_prefix  text,
  p_rate    int default 150,    -- signal 1: hits / 10 min
  p_vol     int default 2000,   -- signal 2: hits / day (any pattern)      [was 600]
  p_hours   int default 3,      -- signal 3: min active span (hours)
  p_pvol    int default 1000    -- signal 3: hits / day while persistent   [was 300]
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
  v_cidr   cidr        := null;
  v_allow  boolean     := false;
begin
  if p_prefix is null or p_prefix = '' then
    return jsonb_build_object('n', 0, 'blocked', false);
  end if;

  -- opportunistic GC
  delete from pack_hits       where bucket < now() - interval '15 minutes';
  delete from pack_hits_daily where day    < current_date - 2;

  -- record the hit in both counters (allowlisted callers are counted too — we
  -- want them visible in the counters, we just never act on them)
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

  -- allowlist. ipToPrefix() can emit a malformed IPv6 prefix (e.g. "2001:db8:::/48"
  -- from an abbreviated address), and an uncaught cast error here would abort the
  -- function exactly the way the %.1f bug did — so the cast is contained.
  begin
    v_cidr := p_prefix::cidr;
  exception when others then
    v_cidr := null;
  end;
  if v_cidr is not null then
    select exists (select 1 from pack_allowlist a where v_cidr <<= a.cidr) into v_allow;
  end if;
  if v_allow then
    return jsonb_build_object('n', v_rate10, 'day', v_dhits, 'span_h', round(v_span_h, 2),
                              'blocked', false, 'allowlisted', true);
  end if;

  -- decide (most-severe → longest block)
  if v_dhits > p_vol then
    v_reason := format('volume — %s pack pulls today from %s', v_dhits, p_prefix);
    v_ttl := interval '7 days';
  elsif v_span_h >= p_hours and v_dhits > p_pvol then
    -- format() has no %f — round() first, then %s. This is the line that broke.
    v_reason := format('persistent drain — %s pulls over %sh from %s',
                       v_dhits, round(v_span_h, 1), p_prefix);
    v_ttl := interval '7 days';
  elsif v_rate10 > p_rate then
    v_reason := format('rate — %s hits/10min from %s', v_rate10, p_prefix);
    v_ttl := interval '24 hours';
  end if;

  if v_reason is null then
    return jsonb_build_object('n', v_rate10, 'day', v_dhits, 'span_h', round(v_span_h, 2), 'blocked', false);
  end if;

  -- Auto-block the /24 (or /48). Same shape + strike-escalation as mt_detect_bots();
  -- never SHORTEN an existing block (greatest of strike-TTL and this signal's TTL).
  -- Wrapped: if these writes ever fail, we still return blocked=true and we still
  -- keep the counter increments above — the 0091 failure mode does not repeat.
  begin
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
  exception when others then
    null;  -- the decision stands even if the ledger write does not
  end;

  return jsonb_build_object('n', v_rate10, 'day', v_dhits, 'span_h', round(v_span_h, 2), 'blocked', true, 'reason', v_reason);
end;
$fn$;

revoke execute on function public.pack_note_hit(text, int, int, int, int) from public, anon, authenticated;
grant  execute on function public.pack_note_hit(text, int, int, int, int) to service_role;
