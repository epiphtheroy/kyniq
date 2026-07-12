<!--
SAMPLE — For Developers 표준 템플릿 (HANDOFF-개발자-독스.md §7 F군 "the-cache-that-outlived-my-deploy")
지위: 46편 전체의 voice·형식 기준. 구현 시 lib/devdocs/content/the-cache-that-outlived-my-deploy.md로 이식.
규칙 시연: 1인칭 단수 / 실패 먼저 / 숫자 실측 / 대안+버린 이유 / "What I'd do differently" 필수 / 코드 펜스 자유 사용 / 시크릿 0.
-->

# Vercel's data cache outlives your deploy — version your keys

I shipped a copy revision to forty-six documentation pages, watched the deployment go green, and then watched production serve the old text for five straight minutes of polling. The deploy was live. The content wasn't. This is a note about the difference between the two caches involved, the fifteen minutes I spent confused, and the one-character fix.

## The setup

Each doc page renders a markdown body through a cached loader:

```ts
const renderBody = (slug: string, body: string) =>
  unstable_cache(
    async () => renderDocMarkdown(await substituteCounts(body)),
    ["mdocs-render1", slug],
    { revalidate: 3600, tags: ["methodology-docs"] },
  )();
```

I knew Next.js has two caches here — the full-route cache and the data cache — and I knew `revalidate: 3600` meant an hour of staleness in the worst case. What I had not internalised is that on Vercel **the data cache is keyed by your key array, not by your deployment**. A new deploy invalidates routes; it does not invalidate `["mdocs-render1", slug]`. The body string baked into the new bundle was new; the cached *render* of the old string, under the same key, was still perfectly valid as far as the cache was concerned.

## The fifteen confused minutes

My verification loop polled a revised page for the new phrasing and got the old one, twenty times. The unhelpful part is that this failure looks identical to "the build hasn't finished yet," and I burned time on that theory first.

The probe that actually resolved it was separating the two layers. I checked a **fully static page** (our `/about`, no `unstable_cache` anywhere) for a phrase from the same commit — present. So the deployment was live, and the staleness had to be data-cache-shaped:

```
/about                    → new copy   (static, rebuilt on deploy)
/methodology/independence → old copy   (unstable_cache'd body)
```

Two minutes after that, the diagnosis was boring and certain.

## The fix

This codebase already had the convention; I had just failed to apply it to my own code. Our film-page loader key is `["film-load7", slug]` — the trailing integer has been bumped six times, once for every payload change. So:

```diff
- ["mdocs-render1", slug],
+ ["mdocs-render2", slug],
```

New key, cache miss everywhere, fresh renders on the next deploy. Total fix size: one character. I also could have called `revalidateTag("methodology-docs")` — the tag was sitting right there — but that requires an authenticated revalidation endpoint at deploy time, and a key bump is deterministic, reviewable in the diff, and impossible to forget half of. For content that changes rarely and ships through git, I think the dumber mechanism is the better one.

## What I'd do differently

Three things, in honesty order.

First, I wrote the convention into the project handbook *after* stepping on the rake, not before. The `film-load7` precedent was in the codebase the whole time; I treated it as trivia instead of as a rule, and a rule I'd written down would have cost me nothing.

Second, my verification order was backwards. The right first probe when "the deploy looks stale" is a page you *know* bypasses the data cache; it splits the hypothesis space in one request. I now keep that as a fixed habit: static page first, cached page second, panic never.

Third — smaller, but real — the key and the content live in different files, so nothing forces them to move together. A hash of the body in the key would make staleness structurally impossible (`["mdocs", slug, bodyHash]`), at the cost of losing the shared-cache hit across identical deploys. For this site's traffic that trade would have been fine. I kept the manual bump mostly because it matches the rest of the codebase, and consistency has its own value — but I wouldn't defend it as the better design, only as the more consistent one.

## The rule I keep now

If content ships inside the bundle but renders through `unstable_cache`, the cache key must change whenever the content does — by hand, by hash, I don't care, but *in the same commit*. A deploy is not an invalidation. On Vercel, the data cache doesn't know your deploy happened, and it is under no obligation to care.

---

*Corrections welcome — if I've misdescribed the caching layers or you know a sharper pattern, [tell me](mailto:wonwoo@metatake.net). This note describes Next.js App Router on Vercel as of July 2026; both move fast.*
