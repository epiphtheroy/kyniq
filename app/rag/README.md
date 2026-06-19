# app/rag — RAG (v2) self-contained surface

Everything for the upgraded grounded-RAG experience lives in this folder, so it
can be developed and shipped without touching the rest of the site.

## Layout
```
app/rag/
  page.tsx              # /rag page (calls /api/rag), Answer/Readings toggle,
                        #   academic rail, diagnostic strip (intent·lang·rerank·model)
  layout.tsx            # imports rag.css (keeps globals.css untouched)
  rag.css               # RAG-only styles (.ak-mode / .ak-reads / .ak-card / .ak-fr)
  _components/
    AskReadings.tsx     # Readings-mode cards (+ shared Cite/REG/AskMode/toggle)
    FurtherReading.tsx  # "Further reading — beyond the corpus" academic rail
  _lib/
    queryUnderstanding.ts  # language detect + intent classify + English FTS query
    rerank.ts              # reranker adapter (Cohere/Voyage) + no-key fallback
    diversify.ts           # intent-driven diversity (broad=cap2 / specific-film=cap5)
    prompt.ts              # SYS_V2 grounding prompt (+ quotation-rules placeholder)
    academic.ts            # OpenAlex/Crossref/S2 further-reading (separate field)
```

## The only two files OUTSIDE this folder (framework constraints)
- `app/api/rag/route.ts` — the API endpoint. Next.js requires API routes under
  `app/api/`, so it cannot live inside `app/rag/`. It imports this folder's `_lib/*`.
- `components/MetatakeNav.tsx` — one added line for the "RAG" nav link.

## Grounding integrity
The grounded answer is built ONLY from the corpus close-readings. Academic
`further_reading` is a SEPARATE response field, never merged into `citations`
and never fed into the generation prompt.

## Env (server)
- Required: `OPENAI_API_KEY` (reused from v1 /ask).
- Optional: `ASK_MODEL` (default gpt-4o-mini) · `RERANK_PROVIDER` (default fallback;
  set cohere|voyage + `COHERE_API_KEY`/`VOYAGE_API_KEY`) ·
  `ACADEMIC_FURTHER_READING=1` + `ACADEMIC_MAILTO=you@domain`.

## Verify
Deploy with `deploy-rag.command`, then open `/rag`: ask a question and confirm the
answer carries `[n]` citations, the Answer/Readings toggle works, and the
diagnostic strip shows intent · lang · reranker · model.
