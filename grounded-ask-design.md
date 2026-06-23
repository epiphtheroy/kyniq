# Grounded Ask — 최소 구현 설계 (1페이지)

> 자연어 개념 질문 → 당신의 18,004개 읽기에서 검색 → 근거·인용 있는 답. **자체 모델 학습 0.**
> 전제: takes/figures/meta_takes 임베딩 100% 완료(이미 됨), pgvector, `search_site`·`graph_*_neighbors`·`bulk_set_embeddings` RPC, `lib/providers/openai.ts`, `lib/model-router.ts`, `/ask` 라우트 셸 — 전부 존재. KEPT §I(하이브리드=FTS+pgvector RRF)의 실행판.

## 새로 쓸 것 — 딱 5개

1. **`ask_retrieve()` RPC** — 벡터 + 키워드(FTS) 검색을 RRF로 융합, 출처까지 조인해 반환.
2. **인덱스 마이그레이션** — `takes.embedding` ANN(hnsw) + `rationale` FTS.
3. **`/api/ask` 라우트(또는 서버액션)** — 임베딩→RPC→조립→LLM→JSON.
4. **그라운딩 프롬프트** — "주어진 읽기만 근거, 모든 주장에 [n] 인용, 밖의 사실 금지."
5. **인용 렌더** — `/ask` 페이지에 답 + `[n]`→실제 페이지 링크 + 예상 밖 친족.

## 1. 검색 RPC (핵심)

```sql
create or replace function public.ask_retrieve(p_qvec vector(1536), p_q text, p_k int default 12)
returns table(rank int, take_id uuid, rationale text, register text, theorist text,
              film_title text, film_slug text, figure_label text, figure_slug text,
              meta_title text, meta_slug text, rrf real)
language sql stable security definer set search_path = public as $$
  with vec as (   -- 의미 축: 코사인 최근접
    select t.id, row_number() over (order by t.embedding <=> p_qvec) r
    from takes t where t.embedding is not null and t.status='published'
    order by t.embedding <=> p_qvec limit 60),
  fts as (        -- 키워드 축: 읽기 본문 FTS
    select t.id, row_number() over (order by ts_rank(to_tsvector('english',t.rationale),
             websearch_to_tsquery('english',p_q)) desc) r
    from takes t where t.status='published'
      and to_tsvector('english',t.rationale) @@ websearch_to_tsquery('english',p_q) limit 60),
  fused as (      -- RRF 융합 (k=60)
    select coalesce(v.id,f.id) id,
           coalesce(1.0/(60+v.r),0)+coalesce(1.0/(60+f.r),0) rrf
    from vec v full outer join fts f on f.id=v.id
    order by rrf desc limit p_k)
  select row_number() over (order by x.rrf desc)::int, t.id, t.rationale, t.register, t.theorist,
         fl.title, fl.slug, fg.label, fg.slug, m.title, m.slug, x.rrf
  from fused x
  join takes t on t.id=x.id
  join figures fg on fg.id=t.figure_id
  join films fl on fl.id=fg.film_id
  left join meta_takes m on m.id=t.meta_take_id
  order by x.rrf desc;
$$;
grant execute on function public.ask_retrieve(vector,text,int) to anon, authenticated;
```

## 2. 인덱스

```sql
create index if not exists idx_takes_emb_hnsw on takes using hnsw (embedding vector_cosine_ops);
create index if not exists idx_takes_rationale_fts on takes
  using gin (to_tsvector('english', rationale));
```
ANN 없으면 18K(→2천 편 시 ~6만)에서 전수 스캔 = 느림. 필수.

## 3. API 라우트 흐름 (`/api/ask`)

```
질문 q
 → embed(q)                      // OpenAI text-embedding-3-small, lib/providers/openai.ts 재사용, ~$0.000005
 → supabase.rpc('ask_retrieve', { p_qvec, p_q: q, p_k: 12 })
 → assemble(rows)                // [1..12] 번호 + (영화·형상·레지스터·이론가) 메타 동봉
 → llm(systemPrompt, context)    // model-router로 Claude/Gemini 1콜
 → kin = rpc('graph_meta_take_neighbors', { p_slug: rows[0].meta_slug })  // 선택, 이미 있음
 → return { answer, citations: rows, kin }
```

## 4. 그라운딩 프롬프트 계약 (시스템)

- 아래 번호 매긴 읽기 **안에서만** 답한다. 모든 주장 뒤에 `[n]`.
- 목록에 없는 영화·사실·인용을 **추가하지 않는다**. 없으면 "코퍼스에 없음"이라고 말한다.
- 유용하면 **레지스터별로** 묶고, 끝에 **예상 밖 친족 1–2** 언급.
- 출력: `[n]` 인라인 산문 + `used:[n…]`(렌더가 링크 검증용).

컨텍스트 행 형식: `"[3] (Carol · 형식) 카메라가 끊기를 거부하는 마지막 눈맞춤…"`

## 5. 렌더 (`/ask`)

답 본문의 `[n]` → `rows[n]`의 `/film/{film_slug}/figure/{figure_slug}`(또는 `/take/{meta_slug}`) 링크로 치환. 하단에 "예상 밖 친족" 칩(kin). → 모든 문장이 **클릭 가능한 실제 읽기**에 묶임 = 환각 0, 검증 가능.

## 비용·지연 (질의당)

임베딩 ~$0.000005 · 검색 로컬(ANN, <50ms) · 생성 LLM 1콜(~$0.003–0.02). **합계 ~1–2초, 수원~수십원.** 학습·GPU 0.

## 재사용(새로 안 만듦)

임베딩(완료) · pgvector · `openai` provider · `model-router` · `/ask` 셸 · figure/take 페이지(링크 타깃) · `graph_*_neighbors`(친족). → 신규 코드 표면이 작아 **며칠치 작업**으로 v1 가능.

## 다음(v1 이후, 선택)

figure(표면)·meta_take(개념) 축도 검색에 합류 → "표면-멂·의미-가까움" 놀라움 랭킹 · 질의 의도 분류로 레지스터 가중 · 인용 Crossref 검증 후 노출(§KEPT A/L).
