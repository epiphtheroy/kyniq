# External sources — W7: academic "further reading"

Additive scaffolding for ASK. This layer fetches **scholarly metadata** (title,
authors, year, venue, DOI, abstract snippet, citation count) from free academic
APIs and surfaces it as a **separate, clearly-labeled "Further reading" list**.
It is *link-out only*. It is **not** part of the grounded answer.

> Lane C (외부 소스) of the master plan (`ASK-mainservice-작업계획.md` → W7). Lowest
> legal risk of the external layers — public metadata + link-outs, no full-text.

## ⛔ Grounding-integrity invariant (the whole point)

Academic results are **scaffolding / "further reading" only**. They are
**NEVER**:

- injected into the LLM generation prompt or context,
- merged into the grounded `citations` array, or
- cited with `[n]` in the answer.

The grounded answer stays **100% corpus-only**. Academic items are returned in a
**separate top-level `further_reading` field** and rendered under their own
visually-distinct heading. This mirrors master-plan rule #4: *"코퍼스 답변과 외부
결과는 인용 스트림을 절대 섞지 않는다 — 시각·의미적으로 라벨 분리."*

How the invariant is enforced in code:

- `app/api/ask/v2/route.ts` calls `findFurtherReading()` **after** generation,
  so the academic data physically cannot enter the prompt (the prompt was
  already built and sent).
- The result is spread into its own `further_reading` key — never pushed into
  `citations`, `readings`, or the numbered context.
- The UI (`components/FurtherReading.tsx`) renders it under a teal, dashed,
  "beyond the corpus" heading distinct from the red corpus sources, with a note
  ("Scholarly links, not part of the grounded answer").

## Files

| File | Role |
|---|---|
| `academic.ts` | `AcademicRef` type + `findFurtherReading(query, opts?)`. Queries OpenAlex (primary) + Crossref (secondary) in parallel; Semantic Scholar only when `S2_API_KEY` is set. Dedupes by DOI/title, ranks by citation count, caps to top 5. Per-request ~4s timeout. **Always resolves — returns `[]` on any failure.** |
| `../../components/FurtherReading.tsx` | Client component rendering `further_reading`. No-ops when the field is absent/empty. |

## Sources

| Source | Key? | Endpoint | Notes |
|---|---|---|---|
| **OpenAlex** | none | `GET https://api.openalex.org/works?search=<q>&per_page=N&mailto=<email>` | Primary. Abstract arrives as `abstract_inverted_index` (`{word:[positions]}`) and is reconstructed into a short snippet. `mailto` joins the polite pool. |
| **Crossref** | none | `GET https://api.crossref.org/works?query=<q>&rows=N&mailto=<email>` | Secondary/supplement. `abstract` (when present) is JATS XML — tags are stripped for the snippet. |
| **Semantic Scholar** | `S2_API_KEY` | `GET https://api.semanticscholar.org/graph/v1/paper/search?query=<q>&limit=N&fields=...` | **Opt-in.** Self-disables (returns `[]`) without a key, since unkeyed rate limits are harsh. |

## Environment variables

| Var | Default | Effect |
|---|---|---|
| `ACADEMIC_FURTHER_READING` | unset (OFF) | **Master flag.** When falsy, `/api/ask/v2` never calls this layer and never emits `further_reading`. When truthy, the layer runs after generation. |
| `ACADEMIC_MAILTO` | `research@example.com` (placeholder) | Contact email appended to OpenAlex/Crossref for the polite pool. Set to a real address in production. |
| `S2_API_KEY` | unset | When set, Semantic Scholar is added as a third source. Without it, S2 is skipped. |

Nothing here touches v1 (`app/api/ask/route.ts`), the worker, the DB, embeddings,
indexes, or `ask_retrieve`. With the flag off, `/api/ask/v2` is byte-for-byte
unchanged.

## How to enable

1. Set the flag (and ideally a real contact email):
   ```bash
   ACADEMIC_FURTHER_READING=1
   ACADEMIC_MAILTO=you@yourdomain.com
   # optional, opt-in third source:
   # S2_API_KEY=...
   ```
2. Restart the dev server. `POST /api/ask/v2 { "q": "..." }` now returns a
   `further_reading: AcademicRef[]` field alongside the unchanged
   `{ answer, citations, readings, meta }`.
3. The component is wired to render wherever `further_reading` is present. (The
   live `/ask` page currently calls **v1**, which has no such field, so it
   simply won't show the section until/unless that page is pointed at v2.)

## How to test on a networked dev machine

> This sandbox has **no outbound network**, so OpenAlex/Crossref/S2 are
> unreachable here and were not live-tested. Parsing is written defensively
> against the documented schemas; verify against live responses on a networked
> machine:

- **Unit-ish, no UI:**
  ```bash
  ACADEMIC_FURTHER_READING=1 ACADEMIC_MAILTO=you@x.com \
    node --experimental-strip-types -e '
      import("./lib/sources/academic.ts").then(async (m) => {
        const r = await m.findFurtherReading("cinema surveillance panopticon");
        console.log(JSON.stringify(r, null, 2));
      });'
  ```
  Expect up to 5 `AcademicRef` objects; empty `[]` is a valid result (e.g. an
  obscure film-studies query — coverage is partial; see caveats).

- **Through the route:**
  ```bash
  ACADEMIC_FURTHER_READING=1 ACADEMIC_MAILTO=you@x.com npm run dev
  curl -s localhost:3000/api/ask/v2 -H 'content-type: application/json' \
    -d '{"q":"how does cinema portray surveillance?"}' | jq '.further_reading'
  ```
  Confirm `further_reading` appears **only** with the flag on, and that
  `answer` / `citations` are identical with the flag on vs. off.

- **Parse check (works offline):**
  ```bash
  node --experimental-strip-types --check lib/sources/academic.ts   # → exit 0
  ```

## Relevance caveats

- Academic APIs skew **scientific/STEM**; **film-studies coverage is partial**.
  Crossref/OpenAlex index many humanities journals, but a niche close-reading
  query may return tangential or empty results. The empty-array path is normal
  and is handled gracefully (the section just doesn't render).
- Ranking favors citation count, which biases toward older, broadly-cited works.
  This is acceptable for a "further reading" rail; it is **not** a relevance
  guarantee, and — by the invariant above — never influences the grounded answer.
- DOIs/abstracts are sometimes missing; the UI degrades (plain title, no
  snippet) rather than dropping the item.
