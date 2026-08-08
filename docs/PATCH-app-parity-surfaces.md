# PATCH — app-parity surfaces (BFF + web Tier-2 block)

정본: `HANDOFF-앱패리티-공장.md` · 작성 2026-08-06 · 상태 **미적용(의도적)**

이 문서의 변경은 **일부러 적용하지 않고 남겨둔 것**이다. `app/`·`components/`·`lib/`는
자동배포 워처가 스테이징으로 밀어 올리는 경로이므로, 오너가 자리를 비운 사이 에이전트가
그 파일을 만지면 그대로 배포가 된다. 그래서 코드는 여기 완성된 형태로 두고, 적용은
오너의 판단으로 한다.

**선행조건 (이 순서를 지킬 것)**
1. 마이그 `0136_film_leads.sql` 적용 — 테이블 없이 코드가 먼저 나가면 BFF가 매 요청마다
   존재하지 않는 릴레이션을 조회한다. (기존 불변식: 마이그 먼저, 코드 나중)
2. `node scripts/load-film-leads.mjs --gentle` 로 행 적재.
3. 그 다음에 아래 P1~P3 적용.

세 패치 모두 **캐시 키 범프가 필수**다. payload의 출처가 바뀌었는데 키가 그대로면
"생성했는데 안 보인다"는 오진을 하게 된다. 이 프로젝트는 그 함정을 이미 두 번 밟았다.

---

## P1 — 앱 필름 브리프 BFF

`app/api/v1/app/film/[slug]/route.ts`

**(a) 65행 `Promise.all` 배열 끝에 한 줄 추가** — 직렬 왕복을 만들지 않기 위해 조건 없이
병렬로 함께 가져오고, 쓸지 말지는 나중에 정한다. PK 단건 조회라 비용은 무시할 만하다.

```ts
    const [tsRes, figRes, availRes, linRes, geoRes, cardRes, affRes, tvRes, leadRes] = await Promise.all([
      // …기존 8개 그대로…
      db.from("film_leads").select("lead").eq("film_id", film.id).limit(1),
    ]);
```

**(b) 119행, invitation 조회 직후 / Fantasia 폴백 직전에 삽입**

```ts
    // App-parity lead — 초대문이 없는 영화를 위해 쓰인 산문. 가산 레이어(0136)이며,
    // 그 영화가 나중에 Tier-1으로 승격되어 진짜 invitation take를 얻으면 이 줄은
    // 자동으로 그늘에 들어간다. 삭제·정리 불필요. HANDOFF-앱패리티-공장.md §3.1
    if (!invitation) {
      invitation = ((leadRes.data ?? []) as { lead: string }[])[0]?.lead ?? null;
    }
```

이 위치가 중요하다. **Fantasia 폴백보다 위**여야 한다 — 문장층은 EN 전용이고 조각을
이어 붙인 것이라, 쓰기 위해 쓴 산문이 있으면 그쪽이 언제나 낫다.

**(c) 캐시 키 범프** — 이 라우트의 `unstable_cache` 키 끝 숫자를 +1.

---

## P2 — Tonight 덱 BFF

`app/api/v1/app/tonight/route.ts`

**358행 `}` 직후(leadMap 빌드 블록 바로 아래)에 삽입.** `idMap`(slug→id)이 이미 위에서
만들어져 있으므로 추가 조회는 한 번뿐이다.

```ts
    // 초대문이 없는 카드는 여기서 채운다. Tier-2가 리드 없이 덱에 서던 자리다.
    const need = slugs.filter((s) => !leadMap.has(s) && idMap.has(s));
    if (need.length) {
      try {
        const { data: leadRows } = await db
          .from("film_leads")
          .select("film_id, lead")
          .in("film_id", need.map((s) => idMap.get(s)!));
        const slugByIdAll = new Map([...idMap].map(([s, id]) => [id, s]));
        for (const r of (leadRows ?? []) as { film_id: string; lead: string | null }[]) {
          const slug = slugByIdAll.get(r.film_id);
          if (slug && r.lead) leadMap.set(slug, firstSentence(r.lead));
        }
      } catch {
        /* leads are optional decoration — never fail the feed for them */
      }
    }
```

`firstSentence()`를 그대로 통과시키는 것이 핵심이다. 헌장이 첫 문장을 홀로 서게 쓰라고
요구한 이유가 바로 이 한 줄이다.

**캐시 키 범프** 동일.

---

## P3 — 웹 Tier-2 블록 (오너 결정 D1 채택 시에만)

`app/film/[slug]/_shared.tsx` — Tier-2 렌더 블록(대략 1077행 Editor's digest 위).

```tsx
{lead ? (
  <section id="df-invitation" className="…Tier-1의 df-invitation과 동일 크롬…">
    <h2>An Invitation</h2>
    <p className="lead-prose">{lead}</p>
    <p className="byline">Metatake AI Editorial</p>
  </section>
) : null}
```

지켜야 할 것 셋:

- **바이라인은 "Metatake AI Editorial".** AI 집필 크레딧 규칙상 "인간 검토" 표기는 금지다.
  쓰지 않은 검토를 표기하는 것은 이 프로젝트가 가장 싫어하는 종류의 거짓이다.
- **로더 캐시 키 `film-load8` → `film-load9`.**
- **robots·사이트맵·`INDEX_COHORT_FILMS_T2` 캡은 한 글자도 건드리지 않는다.** 이 레인은
  색인 레인이 아니다. 적용 후 `filmIndexBar`/`directorIndexBar` 통과 수와 사이트맵
  엔트리 수가 **변동 0**임을 스냅샷으로 대조하는 것이 수용 기준이다.

---

## 적용 후 검증

1. 스테이징에서 Tier-2 영화 임의 5편 — Invitation 섹션 노출, 문장이 포스터 밑 카드에서
   홀로 읽히는지.
2. Tonight 덱에서 Tier-2 카드에 세리프 리드가 붙는지(실기기).
3. `curl -s <staging>/film/<t2-slug> | grep -c 'noindex'` — 적용 전후 동일.
4. 사이트맵 엔트리 수 적용 전후 동일.
5. 라이브 감사는 **캐시버스터를 붙여서**. 배포 직후 구캐시를 읽고 "안 나온다"고 오진한
   전례가 있다.
