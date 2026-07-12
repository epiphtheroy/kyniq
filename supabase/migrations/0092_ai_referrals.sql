-- 0092_ai_referrals.sql — measure traffic that arrives FROM AI assistants (2026-07-13)
--
-- The strategy behind the context packs + Copy-for-AI is a hypothesis: if AI
-- assistants know Metatake, they will cite it and send readers back. This RPC
-- turns that hypothesis into a number. It groups first-party pageviews (mt_events)
-- whose referrer host is a known AI product, so /admin/metrics can show, over any
-- range, how much traffic ChatGPT / Perplexity / Claude / Gemini / … actually
-- refer — the real ROI signal for "answer-time citation" (channel ②), as opposed
-- to opaque model-training ingestion (channel ①, which sends nothing back).
--
-- Search engines (google.com, bing.com, duckduckgo.com) are deliberately NOT
-- counted here even though they now have AI modes — their referrer host is
-- indistinguishable from ordinary search, and they already show up under the
-- normal "Referrers" panel. We only count hosts that are unambiguously an AI
-- assistant surface.

create or replace function public.mt_ai_referrals_json(
  p_from timestamptz,
  p_to   timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  with ai as (
    select
      visitor,
      path,
      case
        when ref_domain ~* '(^|\.)chatgpt\.com$|(^|\.)openai\.com$' then 'ChatGPT'
        when ref_domain ~* '(^|\.)perplexity\.ai$'                  then 'Perplexity'
        when ref_domain ~* '(^|\.)claude\.ai$'                      then 'Claude'
        when ref_domain ~* '(^|\.)gemini\.google\.com$|(^|\.)bard\.google\.com$' then 'Gemini'
        when ref_domain ~* '(^|\.)copilot\.microsoft\.com$'         then 'Copilot'
        when ref_domain ~* '(^|\.)you\.com$'                        then 'You'
        when ref_domain ~* '(^|\.)poe\.com$'                        then 'Poe'
        when ref_domain ~* '(^|\.)phind\.com$'                      then 'Phind'
        when ref_domain ~* '(^|\.)meta\.ai$'                        then 'Meta AI'
        when ref_domain ~* '(^|\.)(chat\.)?mistral\.ai$'            then 'Mistral'
        when ref_domain ~* '(^|\.)grok\.com$|(^|\.)x\.ai$'          then 'Grok'
        else null
      end as source
    from mt_events
    where type = 'pageview'
      and ts >= p_from and ts < p_to
      and ref_domain is not null
      and ref_domain ~* '(chatgpt|openai|perplexity|claude|gemini\.google|bard\.google|copilot\.microsoft|you|poe|phind|meta\.ai|mistral|grok|x)\.'
  ),
  hit as (select * from ai where source is not null)
  select jsonb_build_object(
    'total_visits',   (select count(*)             from hit),
    'total_visitors', (select count(distinct visitor) from hit),
    'sources', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.n desc)
      from (
        select source as source, count(*) as n, count(distinct visitor) as visitors
        from hit group by source
      ) s), '[]'::jsonb),
    'landings', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.n desc)
      from (
        select path as path, count(*) as n
        from hit group by path order by n desc limit 15
      ) l), '[]'::jsonb)
  );
$$;

revoke execute on function public.mt_ai_referrals_json(timestamptz, timestamptz) from anon, authenticated, public;
grant  execute on function public.mt_ai_referrals_json(timestamptz, timestamptz) to service_role;
