-- 0147 — a ceiling on HOW MUCH OF THE CORPUS one /24 holds, not how fast it asks.
--
-- WHY
-- ───
-- Every existing signal on the public read APIs counts CALLS: rate (150/10min),
-- volume (2000/day), persistent drain (1000/day over 3h+). None of them answers
-- the only question that matters commercially — "how much of our writing does
-- this network now have a copy of?"
--
-- The arithmetic is unkind. 900 pack pulls a day trips nothing at all, and after
-- eight quiet days the caller holds all 6,956 film bodies. The 2026-08-08 sweep
-- was noticed because it took four hours; the same theft spread over a fortnight
-- is invisible to every counter we own. Measured 2026-08-27, one /24 was already
-- walking that path: 35.186.14.0/24 (python-httpx on GCP) took 276 distinct film
-- bodies in 30 days — 209 of them in a single week — and never came within a
-- fifth of any threshold.
--
-- 🔑 The unit of theft is the DISTINCT SLUG, so that is what we meter. Re-reading
-- one film a hundred times is a busy reader; reading a thousand films once each
-- is a copy. Only the second shape moves this counter.
--
-- ⚠️ NOT ON SEARCH. The obvious reflex after seeing an A-to-Z sweep of
-- films_search (2026-08-26, 76.14.115.0/24, curl then Python-urllib) is to gate
-- search. That would be theatre: every slug is already published in
-- sitemaps/films.xml and catalog.xml, so enumerating titles costs an attacker
-- nothing they cannot get for free. Search is reconnaissance. The body is the
-- asset, and the body is what this counts.
--
-- ⚠️ NOT ON /api/v1/app/*. The mobile BFF is our own client. Its users sit behind
-- carrier NAT, so a per-/24 corpus ceiling would eventually punish one busy
-- mobile network for our app succeeding. First-party clients are not data
-- consumers and are not metered here.
--
-- THRESHOLDS (measured, not guessed)
-- Heaviest real caller observed in a 7-day window: 209 distinct slugs.
--   warn  200  → an insight line only, once per prefix per ISO week. No block.
--   block 500  → 7% of the corpus in a week. At that rate a full copy takes
--                fourteen weeks instead of the four hours it took in August.
-- The warn tier exists because where the block belongs is a business call — a
-- paying data partner and a scraper look identical from here. 500 leaves ~2.4x
-- headroom over anything we have ever actually served; lower it once the feed
-- shows who lives between 200 and 500.

create table if not exists public.pack_slug_seen (
  prefix text not null,
  slug   text not null,
  day    date not null default current_date,
  primary key (prefix, slug)
);
-- The only two access patterns: count a prefix's window, and GC a prefix's tail.
create index if not exists pack_slug_seen_prefix_day on public.pack_slug_seen (prefix, day);
-- No policies, like pack_hits / pack_allowlist: service_role reaches it, nobody else.
alter table public.pack_slug_seen enable row level security;

-- 🚨 DROP before CREATE, deliberately. `create or replace` with a different
-- argument list does not replace — it OVERLOADS, and two candidates make
-- PostgREST answer 300 Multiple Choices to every caller (the trap 0135 hit with
-- films_basic_search). Callers pass named args and only ever set p_prefix, so a
-- single function carrying the new defaults resolves exactly as before.
drop function if exists public.pack_note_hit(text, integer, integer, integer, integer);

create or replace function public.pack_note_hit(
  p_prefix      text,
  p_rate        integer default 150,
  p_vol         integer default 2000,
  p_hours       integer default 3,
  p_pvol        integer default 1000,
  p_slug        text    default null,
  p_corpus      integer default 500,
  p_corpus_warn integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  v_slug   text        := nullif(btrim(coalesce(p_slug, '')), '');
  v_corpus int         := 0;
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

  -- The corpus meter. Only callers that pass a slug reach it, so search and the
  -- app BFF contribute nothing by construction. `day` holds LAST seen, not first:
  -- re-fetching an old body means the caller is still working from it, and the
  -- window should follow the work rather than expire underneath it.
  --
  -- GC is scoped to this prefix and runs off the same index as the count, so it
  -- costs one narrow range delete rather than a table sweep. Prefixes that stop
  -- calling keep a few dead rows; the window filter ignores them and they cost
  -- nothing worth a scheduled job.
  if v_slug is not null then
    delete from pack_slug_seen where prefix = p_prefix and day <= current_date - 7;
    insert into pack_slug_seen (prefix, slug, day)
      values (p_prefix, left(v_slug, 200), v_day)
      on conflict (prefix, slug) do update set day = excluded.day;
    select count(*) into v_corpus
      from pack_slug_seen where prefix = p_prefix and day > current_date - 7;
  end if;

  -- read back the three call-rate signals
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
                              'corpus_7d', v_corpus, 'blocked', false, 'allowlisted', true);
  end if;

  -- Watch tier — visible, not punitive. Own exception block: a ledger write must
  -- never cost us the decision below, and must never roll back the counters above.
  if v_corpus >= p_corpus_warn and v_corpus <= p_corpus then
    begin
      insert into mt_insights (kind, key, line, data)
      values (
        'bot_watch',
        'packcorpus:' || p_prefix || ':' || to_char(now(), 'IYYY-IW'),
        format('👀 코퍼스 감시: %s 대역이 7일간 서로 다른 영화 본문 %s편을 받아갔습니다 (차단 임계 %s편)',
               p_prefix, v_corpus, p_corpus),
        jsonb_build_object('prefix', p_prefix, 'distinct_slugs', v_corpus, 'detector', 'pack_corpus')
      )
      on conflict (key) do nothing;
    exception when others then
      null;
    end;
  end if;

  -- decide (most-severe → longest block). Corpus leads: rate and volume describe
  -- how rudely someone asked, corpus describes what they now hold.
  if v_corpus > p_corpus then
    v_reason := format('corpus — %s distinct film bodies from %s in 7 days', v_corpus, p_prefix);
    v_ttl := interval '7 days';
  elsif v_dhits > p_vol then
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
    return jsonb_build_object('n', v_rate10, 'day', v_dhits, 'span_h', round(v_span_h, 2),
                              'corpus_7d', v_corpus, 'blocked', false);
  end if;

  -- Auto-block the /24 (or /48). Same shape + strike-escalation as mt_detect_bots();
  -- never SHORTEN an existing block (greatest of strike-TTL and this signal's TTL).
  -- Wrapped: if these writes ever fail, we still return blocked=true and we still
  -- keep the counter increments above — the 0091 failure mode does not repeat.
  begin
    insert into bot_blocks (kind, value, reason, confidence, evidence, source, expires_at, hits)
    values (
      'ip_prefix', p_prefix, 'Auto: pack-API ' || v_reason, 'high',
      jsonb_build_object('detector', 'pack_guard', 'rate10', v_rate10, 'day_hits', v_dhits,
                         'span_h', round(v_span_h, 2), 'corpus_7d', v_corpus),
      'auto', now() + v_ttl, v_dhits
    )
    on conflict (kind, value) do update
       set last_seen  = now(),
           active     = true,
           hits       = excluded.hits,
           strikes    = bot_blocks.strikes + bot_strike_inc(bot_blocks.last_seen),
           evidence   = excluded.evidence,
           reason     = excluded.reason,
           -- Same daily strike rule as mt_detect_bots (helpers defined in 0146).
           -- It matters more here: this function runs per REQUEST, not per cron
           -- tick, so the old `+ 1` handed a prefix four strikes in four calls —
           -- and greatest() means the resulting thirty days could never come back
           -- down. Seconds of traffic bought a month of blocking.
           expires_at = greatest(
             bot_blocks.expires_at,
             now() + bot_block_ttl(bot_blocks.strikes + bot_strike_inc(bot_blocks.last_seen)),
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

  return jsonb_build_object('n', v_rate10, 'day', v_dhits, 'span_h', round(v_span_h, 2),
                            'corpus_7d', v_corpus, 'blocked', true, 'reason', v_reason);
end;
$function$;

-- 🚨🚨 THE DROP ABOVE TOOK THE GRANTS WITH IT.
-- 0091 and 0134 both end with these two lines for the five-argument signature.
-- `drop function` discards a function's ACL, and a freshly created function
-- defaults to EXECUTE for PUBLIC — which for a SECURITY DEFINER function reachable
-- through PostgREST means any anonymous caller could invoke it with an arbitrary
-- p_prefix and write rows into bot_blocks. That is a stranger being able to have
-- us 403 any network they name, our own visitors included. Re-state them for the
-- new signature, and never let a signature change ship without them.
-- Verify after applying:
--   select proacl from pg_proc where proname = 'pack_note_hit';
--   -- expect {postgres=X/postgres,service_role=X/postgres} — no =X/ entry for PUBLIC
revoke execute on function public.pack_note_hit(text, int, int, int, int, text, int, int)
  from public, anon, authenticated;
grant  execute on function public.pack_note_hit(text, int, int, int, int, text, int, int)
  to service_role;

-- pack_slug_seen needs no explicit table revokes: RLS is on with zero policies,
-- which is how pack_hits, pack_hits_daily and pack_allowlist are already sealed —
-- service_role bypasses RLS, everyone else gets nothing regardless of grants.
