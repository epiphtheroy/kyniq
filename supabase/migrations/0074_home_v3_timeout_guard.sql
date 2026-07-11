-- 0074 — Home v8 hardening after the 2026-07-11 DB restart.
-- Under aggregate load home_v2_bundle_v3 ballooned 1.2s → 15-23s and stacked;
-- a home-page RPC must fail fast, not queue. 8s is 6x its healthy runtime.
alter function public.home_v2_bundle_v3(text) set statement_timeout = '8s';
alter function public.home_daily_exhibits(text) set statement_timeout = '6s';
