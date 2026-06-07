# Pre-launch checklist — FilmCurio

Work through this **after the core build (Missions 0–10) verifies green** and before making
the site public. Most of this is *not coding* — it's legal, ops, and trust hardening.

**Legend:** `(blocker)` = do not go public without it · `(approval)` = run in Antigravity
approval mode (auth/secrets/migrations/robots/deploy) · refs point to `SPEC.md`.

---

## 1. Legal & company  (the biggest blockers)
- [ ] **(blocker)** Terms of Service reviewed by a real lawyer — especially the **contribution
      content license** (canonical answers merge others' work), eligibility/age, moderation,
      liability, governing law (§6.9).
- [ ] **(blocker)** Privacy Policy reviewed — data collected, third parties (Supabase, TMDB,
      analytics, ad network later), cookies, **AI-crawler disclosure**, GDPR/CCPA rights tied
      to account deletion (§6.9).
- [ ] Legal entity / business registration sorted; replace the placeholder footer address with
      the real registered address (§6.6).
- [ ] Switch contact to a domain email `contact@filmcurio.com` (from the gmail placeholder).
- [ ] Confirm the AI-assisted / human-reviewed **disclosure** is live on `/about` + per page
      (§3.2) — and that no fake personas/engagement exist anywhere (§3.2 hard rule).

## 2. Domain & infrastructure
- [ ] **(approval)** Connect `filmcurio.com` to Vercel (DNS + SSL); confirm `NEXT_PUBLIC_SITE_URL`
      = `https://filmcurio.com` in production.
- [ ] Decide www vs apex + 301 redirect to the canonical host.
- [ ] **(approval)** Production env vars set in Vercel (Supabase keys, `TMDB_READ_TOKEN`); none
      in the client bundle; `.env*` gitignored.
- [ ] Cost guardrails noted: TMDB rate limits, Supabase usage tier, Vercel, and **AI generation
      cost** for the pipeline.

## 3. Email deliverability
- [ ] **(approval)** Replace Supabase's default SMTP with a transactional email provider
      (Resend / Postmark / SES) for verification + password-reset mail.
- [ ] Add **SPF + DKIM + DMARC** records on `filmcurio.com`; send a test and confirm it lands in the
      inbox, not spam. (Broken auth email = broken signups.)

## 4. Indexing & GEO submission  (the point of the project)
- [ ] **(blocker for the goal)** Verify the site in **Google Search Console** and submit
      `/sitemap.xml`.
- [ ] **(blocker for the goal)** Verify in **Bing Webmaster Tools** and submit the sitemap (Bing
      powers ChatGPT search).
- [ ] Confirm `/robots.txt` allows the AI bots and the host/CDN (e.g. Cloudflare) isn't blocking
      them (§8.3).
- [ ] Validate `QAPage` / `Movie` / `ItemList` / `BreadcrumbList` JSON-LD in the Rich Results
      test (§8.8); confirm `sameAs` IMDb/Wikidata on film pages.
- [ ] Confirm only `status='published'` URLs appear in the sitemap (no drafts) (§3.2/§8.5).

## 5. Analytics & consent
- [ ] Install privacy-friendly analytics (Plausible / Umami / GA4) — to measure traffic and
      decide when ads (M11) are justified.
- [ ] Wire analytics + any non-essential cookies to the **consent banner** (M8); nothing
      non-essential fires before consent.

## 6. Security & reliability
- [ ] **Re-audit RLS** end-to-end: anon sees only published; no policy leaks; admin/service
      elevation works as intended (§4).
- [ ] Security headers / CSP; HTTPS enforced.
- [ ] Rate-limit auth + posting + public routes; basic bot/abuse protection (but keep AI
      crawlers allowed).
- [ ] Dependency audit + secret scan clean.
- [ ] **DB backups / point-in-time recovery** enabled (Supabase); do a test restore.
- [ ] Error monitoring (Sentry-style) + uptime monitoring.
- [ ] Confirm the **first admin** was set via a secure manual step, not a public path (§6.13).

## 7. Accessibility & performance
- [ ] Core Web Vitals green under **real seeded data** (not just the placeholder home).
- [ ] A11y pass: color contrast (navy/ivory + marigold/teal), keyboard nav, focus states, alt text,
      semantic headings (one H1/page, §8.8).

## 8. Content & editorial readiness  (light gate — the rest is ongoing, §B of the plan)
- [ ] Seed batch (M10) reviewed: each seeded film has ≥3 published questions with real,
      non-thin canonical answers; spot-checked for factual accuracy and genuine critical voice.
- [ ] The **verify confidence threshold** is set conservatively; low-confidence items sit in the
      admin queue, not public (§3.2).
- [ ] Publish **rate limit** on (scaled-content guardrail); a plan exists for the editorial
      review cadence going forward.

## 9. Go / no-go
- [ ] All `(blocker)` items above are checked.
- [ ] A real first-time user can: land → read a question → sign up (verified email arrives) →
      post a reading → see it published.
- [ ] Rollback plan ready (revert deploy + DB restore) if something breaks on launch day.

---

*Not on this list (deliberately deferred until a real signal):* ads (M11), @-mentions / actor
pages (M12), pgvector semantic relatedness (v2), co-engagement (v3), notifications, type hubs.
Add only when an observed problem demands it (§3.1 guardrail).
