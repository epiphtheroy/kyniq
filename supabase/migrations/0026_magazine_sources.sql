-- ============================================================
-- 0026 — Magazine sources (W8): allow-listed critic outlets + SHORT, fair-use
-- snippets for grounded quotation in /api/rag answers.
--
-- Legal posture (US fair-use quotation in criticism, per counsel): store only
-- short excerpts (never full articles); quotes are length-capped at use time by
-- app/rag/_lib/quotation.ts; every quote is attributed + links out to the source.
--
-- Apply this in the DB-free window (when the embedding import isn't saturating
-- the DB). The HNSW vector index on magazine_passages.embedding is added then too.
-- ============================================================

create table if not exists public.magazines (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  publisher text,
  homepage_url text,
  country text,
  language text,
  trust_tier int,
  ingest_method text check (ingest_method in ('api','rss','none','unknown')) default 'unknown',
  robots_ai_stance text,
  license_status text,
  permissions_contact text,
  active boolean default false,        -- crawl only when explicitly enabled (per-outlet legal/robots gate)
  created_at timestamptz default now()
);

create table if not exists public.magazine_passages (
  id uuid primary key default gen_random_uuid(),
  magazine_id uuid not null references public.magazines(id) on delete cascade,
  article_url text not null,
  article_title text,
  author text,
  published_at date,
  snippet text not null,               -- SHORT excerpt ONLY (fair-use sized) — never the full article
  embedding vector(1536),
  fetched_at timestamptz default now(),
  unique (article_url, snippet)
);
create index if not exists idx_magpass_mag on public.magazine_passages(magazine_id);
create index if not exists idx_magpass_fts on public.magazine_passages
  using gin (to_tsvector('english', coalesce(snippet, '')));
-- NOTE: add the ANN index in the DB-free window (don't build under import load):
--   create index concurrently idx_magpass_hnsw on public.magazine_passages
--     using hnsw (embedding vector_cosine_ops);

-- Retrieval over the SEPARATE critic corpus (vector + FTS, RRF-fused), joined to
-- outlet attribution. Returns short snippets only; the route quotes from these
-- under the quotation guardrails and renders them clearly labelled + linked.
create or replace function public.magazine_retrieve(p_qvec text, p_q text, p_k int default 6)
returns table(passage_id uuid, snippet text, article_url text, article_title text,
              author text, outlet text, published_year int, rrf real)
language plpgsql stable security definer set search_path = public as $$
begin
  set local statement_timeout = '8s';
  return query
  with vec as (
    select mp.id, row_number() over (order by mp.embedding <=> p_qvec::vector(1536)) r
    from magazine_passages mp
    join magazines m on m.id = mp.magazine_id and m.active
    where mp.embedding is not null
    order by mp.embedding <=> p_qvec::vector(1536) limit 40),
  fts as (
    select mp.id, row_number() over (
             order by ts_rank(to_tsvector('english', coalesce(mp.snippet,'')),
                              websearch_to_tsquery('english', p_q)) desc) r
    from magazine_passages mp
    join magazines m on m.id = mp.magazine_id and m.active
    where mp.snippet is not null
      and to_tsvector('english', coalesce(mp.snippet,'')) @@ websearch_to_tsquery('english', p_q)
    limit 40),
  fused as (
    select coalesce(v.id, f.id) id,
           coalesce(1.0/(60+v.r),0) + coalesce(1.0/(60+f.r),0) rrf
    from vec v full outer join fts f on f.id = v.id
    order by rrf desc limit p_k)
  select mp.id, mp.snippet, mp.article_url, mp.article_title, mp.author,
         m.name, extract(year from mp.published_at)::int, x.rrf::real
  from fused x
  join magazine_passages mp on mp.id = x.id
  join magazines m on m.id = mp.magazine_id
  order by x.rrf desc;
end $$;
grant execute on function public.magazine_retrieve(text, text, int) to anon, authenticated;
