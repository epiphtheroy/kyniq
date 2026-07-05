-- trope_members_ranked — the members of one trope (kind='figure_type'),
-- ranked by how centrally each film's reading sits in the trope's meaning-space:
-- cosine(take.embedding, trope.embedding). Live-derived (no baked ranks), so a
-- trope rebuild or new members re-rank automatically. Deterministic order
-- (match desc, film title, take id) — cache-safe, no random().
-- Membership link is takes.trope_id (NEVER takes.meta_take_id — legacy, unpublished hubs).
-- Applied live 2026-07-05 (migration trope_members_ranked). Repo copy is canonical.
-- NOTE: figure↔trope embedding cosine is NOT usable for this ranking — figure
-- embeddings are the surface axis (they cluster by film, ~0.3–0.5 vs the trope),
-- while take (rationale) embeddings are the meaning axis (~0.8+ for members).
create or replace function public.trope_members_ranked(p_slug text, p_limit integer default 200)
returns table(
  take_id uuid, take_title text, framework text, rationale text, strength integer,
  figure_label text, figure_slug text,
  film_title text, film_slug text, film_year integer, poster text,
  match real
)
language sql stable as $$
  select t.id, t.take_title, t.framework, t.rationale, t.strength,
         fig.label, fig.slug,
         f.title, f.slug, nullif(f.year, 0), f.poster_path,
         case when t.embedding is not null and mt.embedding is not null
              then (1 - (t.embedding <=> mt.embedding))::real end as match
  from meta_takes mt
  join takes t   on t.trope_id = mt.id and t.status = 'published'
  join figures fig on fig.id = t.figure_id
  join films f   on f.id = fig.film_id
  where mt.slug = p_slug and mt.kind = 'figure_type' and mt.status = 'published'
  order by match desc nulls last, f.title asc, t.id asc
  limit p_limit;
$$;
