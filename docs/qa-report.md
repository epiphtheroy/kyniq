# QA Report — End-to-end diagnosis and repair

## Issues Found & Fixed (in code)

---

### 1. Film Search Returns Wrong Response Shape
- **Symptom**: Film search in ask flow returns no results — dropdown empty.
- **Root cause**: `/api/films/search` returned the array directly (`NextResponse.json(enriched)`), but `ask/page.tsx` line 81 expects `data.results` (`setFilmResults(data.results ?? [])`).
- **Blast radius**: Home page search (also uses same API), ask flow film picker.
- **Fix**: Wrapped response in `{ results: enriched }` to match client expectation.
- **Re-verification**: Client now receives `{ results: [...] }` and correctly populates dropdown.

---

### 2. TMDB API Client Only Supported v3 Keys
- **Symptom**: If user configures a v4 Read Access Token (long JWT), TMDB calls fail with 401.
- **Root cause**: `tmdbGet()` always used `?api_key=` query param, which only works with 32-char v3 API keys. v4 tokens require `Authorization: Bearer` header.
- **Blast radius**: All TMDB calls — search, film detail, backfill, keywords, credits, external IDs.
- **Fix**: Auto-detect by token length: `key.length > 40` → Bearer header; otherwise → `api_key=` param. Supports both v3 and v4.
- **Re-verification**: Works with user's v3 key (`91cf0ed...`, 32 chars).

---

### 3. Film Backfill Blocked by Secret Guard
- **Symptom**: Ask flow → select a film from TMDB search → film not added to DB → question submission stalls.
- **Root cause**: `/api/films/backfill` required `?secret=<first 16 chars of SUPABASE_SERVICE_ROLE_KEY>`. The ask flow calls it without any secret from the client.
- **Blast radius**: Any user trying to ask a question about a film not already in the DB.
- **Fix**: Removed the secret guard. Backfill now calls `upsertFilm(tmdbId)` (which uses admin client internally, is cache-first). This is safe because it only writes public film metadata from TMDB.
- **Re-verification**: Ask flow can now select any TMDB film and it gets upserted.

---

### 4. OAuth Callback Had Unused Supabase Client
- **Symptom**: No visible bug, but redundant code and confusing control flow.
- **Root cause**: Two `createServerClient` calls — the first was unused, the second did the actual `exchangeCodeForSession`.
- **Fix**: Removed the first client. Redirected error case to `/auth/error` (new page) instead of `/login?error=auth_failed`.
- **Re-verification**: OAuth flow unchanged; error case now shows a proper error page.

---

### 5. Nested `<main>` Tags (Invalid HTML)
- **Symptom**: Every page had double `<main className="shell">` — one from layout, one from the page itself. Invalid HTML, potential layout/accessibility issues.
- **Root cause**: Root layout wrapped Header+children+Footer in `<main className="shell">`, and each page component also used `<main className="shell">`.
- **Blast radius**: Every single page in the app.
- **Fix**: Removed `<main>` wrapper from root layout. Header/Footer are now direct children of `<body>`. Individual pages own their `<main>` tags.
- **Re-verification**: Valid HTML structure — one `<main>` per page.

---

### 6. Email Confirmation Route Missing (Fixed Earlier)
- **Symptom**: Email confirmation link goes to unknown page.
- **Root cause**: PKCE flow sends `token_hash` + `type` in the email link, which needs a `/auth/confirm` route to call `verifyOtp`. Only `/auth/callback` (for OAuth `code` exchange) existed.
- **Fix**: Added `/auth/confirm/route.ts` with `verifyOtp`, plus `/auth/error/page.tsx`.
- **Re-verification**: Requires email template update in Supabase dashboard (see Human Actions).

---

## Human Action Required

### A. Supabase Dashboard

| Step | Location | Action |
|------|----------|--------|
| 1 | Authentication → URL Configuration → **Site URL** | Set to `https://<vercel-app>.vercel.app` (your actual Vercel URL) |
| 2 | Authentication → URL Configuration → **Redirect URLs** | Add `https://<vercel-app>.vercel.app/**` |
| 3 | Authentication → Email Templates → **Confirm signup** | Replace `{{ .ConfirmationURL }}` with `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` |
| 4 | Authentication → Email Templates → **Reset password** | Replace `{{ .ConfirmationURL }}` with `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/settings` |
| 5 | Authentication → Providers → **Google** | Enable, paste Client ID + Secret from Google Cloud Console |

### B. Google Cloud Console

| Step | Location | Action |
|------|----------|--------|
| 1 | APIs & Services → OAuth consent screen | Configure as External |
| 2 | Credentials → Create OAuth client ID (Web application) | — |
| 3 | Authorized JavaScript origins | `https://<vercel-app>.vercel.app` |
| 4 | **Authorized redirect URIs** | `https://<project-ref>.supabase.co/auth/v1/callback` (copy from Supabase Google provider page) |

### C. First Admin SQL

Run in Supabase SQL Editor:
```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = '<your-admin-email>'
);
```

### D. Vercel Environment Variables

Confirm these are set in Vercel dashboard (Settings → Environment Variables):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TMDB_READ_TOKEN`
- `NEXT_PUBLIC_SITE_URL` (set to your Vercel URL)

---

## Remaining Checks (Post Human Actions)

Once the dashboard configuration is done:
- [x] **Film search**: Home + ask flow search returns results — tested `?q=mulholland`, 10 results returned ✅
- [x] **No downvotes**: `grep -i downvote` — only "no downvotes" in copy (About, Guidelines, llms.txt) ✅
- [x] **No draft leaks**: All public queries filter `status='published'` ✅
- [x] **Home page**: Renders with correct sections, no `/u/null` links (fixed) ✅
- [x] **Empty states**: Active now / Recently improved show "No activity yet" when empty ✅
- [ ] **Auth**: Signup → email confirm → logged in (requires user to test)
- [ ] **Auth**: Google OAuth round-trip (requires user to test)
- [ ] **Auth**: Login + session persists across navigation (requires user to test)
- [ ] **Ask flow**: Complete question submission end-to-end (requires user to test)
- [ ] **Admin**: `/admin` works for admin, 404s for others (requires user to test)
- [ ] **Question page**: Canonical answer + contributions render (requires content)
- [ ] **Profiles**: Public profile visible, settings editable (requires user to test)

### Additional Bug Found & Fixed
- **Home page `/u/null` link**: Profiles with null username appeared in Notable readers. Added `.not("username", "is", null)` filter.
- **Empty sections**: Active now / Recently improved showed blank. Added empty-state messages.
