# EntityGraph — 통합 가이드 (영화 / figure 페이지)

옵시디안식 force 그래프를 **그대로** 붙이는 3단계. 외부 라이브러리 0. 데이터는 RPC 한 콜.

## 1. 마이그레이션 적용

`supabase/migrations/0024_graph_seeds.sql` 적용:

```bash
supabase db push        # 또는 Supabase SQL 에디터에 0024 내용 붙여넣기
```

생기는 RPC (둘 다 `{nodes, links}` jsonb를 한 번에 반환, anon 실행 허용):

- `graph_film_seed(p_slug text, p_figs int default 6, p_hub_films int default 4)`
- `graph_figure_seed(p_film_slug text, p_figure_slug text, p_kin int default 6)`

> 링크 규칙: 영화·figure 페이지는 항상 링크. **reading 허브는 `status='published'`(현재 274개)만 `/take` 링크**, candidate 허브는 노드로는 보이되 링크 없음. 트롭은 전부 published → 항상 `/trope` 링크. takes는 `status='published'` 게이트(현재 전수라 무해).

## 2. 영화 페이지 — 이미지 바로 밑, 본문 넓이

`app/film/[slug]/page.tsx` (서버 컴포넌트)에서 seed를 서버 fetch 후, 이미지 hero 바로 아래에 삽입:

```tsx
import EntityGraph from "@/components/EntityGraph";

// ...page 본문, supabase 클라이언트는 기존 패턴 그대로...
const { data: graph } = await supabase.rpc("graph_film_seed", { p_slug: slug });

// 이미지(backdrop/hero) 바로 다음 위치에:
{graph?.nodes?.length ? (
  <section style={{ margin: "1.5rem 0 2rem" }}>
    <h2 className="mt-h2" style={{ marginBottom: 10 }}>이 영화의 연결망</h2>
    <EntityGraph data={graph} height={520} />
  </section>
) : null}
```

`<EntityGraph>`는 `width:100%`라 본문 컨테이너 폭을 그대로 채웁니다. 페이지가 열릴 때마다 노드가 중앙에서 퍼지며 **동적으로 자리를 잡습니다**(force settle).

## 3. figure 페이지 — take 정의 바로 밑, 크게

`app/film/[slug]/figure/[figureSlug]/page.tsx`에서, 형상 정의/설명 바로 아래에:

```tsx
import EntityGraph from "@/components/EntityGraph";

const { data: graph } = await supabase.rpc("graph_figure_seed", {
  p_film_slug: slug,
  p_figure_slug: figureSlug,
});

// 형상 label + 영화적 묘사(정의) 다음:
{graph?.nodes?.length ? (
  <section style={{ margin: "1.25rem 0 2rem" }}>
    <EntityGraph data={graph} height={580} />
  </section>
) : null}
```

## 인터랙션 (이미 구현됨)

- **드래그-중력**: 노드를 끌면 연결된 노드가 스프링으로 따라옵니다(드래그 중 alpha 재가열). 놓으면 다시 안착(center 노드는 고정).
- **호버 = 포커스**: 이웃만 남기고 dim.
- **클릭 = 이동**: `href`가 있는 노드는 `router.push()`로 그 페이지로. (드래그와 클릭은 이동량 4px로 구분.)
- **빈 캔버스 드래그 = 패닝**, **휠 = 줌**.
- 노드 색 = 타입(영화/figure/reading/trope), 점 크기 = 연결 수(degree). 여러 허브에 걸린 노드는 자동 수렴(더 큰 점).

## 튜닝 / 운영 노트

- 그래프 크기: `graph_film_seed(slug, p_figs => 8, p_hub_films => 5)` 등 파라미터로 밀도 조절.
- **SEO/접근성**: 이 그래프는 *점진적 향상*입니다. 기존 읽기·kin **링크 리스트(HTML `<a>`)는 그대로 두세요**(크롤·무JS용). 그래프는 그 위에 얹는 시각 레이어.
- **성능**: ego-network는 수십~백 노드라 O(n²) 물리도 가볍습니다. reading 메타테이크는 ANN 인덱스 불필요(허브는 조인). 표면 kin(닮은 형상)을 추가하려면 `figures.embedding`에 HNSW 인덱스 + `graph_figure_surface_neighbors` RPC를 더하면 됩니다(선택).
- **모바일**: 좁은 화면에선 `height`를 420~460으로 낮추거나, 기존 breadcrumb `NodeGraph`를 모바일 폴백으로 토글하세요(데이터층 공유).
- `useRouter`는 `next/navigation`(App Router) 기준입니다. Pages Router면 `next/router`로 교체.
