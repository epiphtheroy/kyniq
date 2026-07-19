# Privacy labels — App Privacy (Apple) & Data safety (Google Play)

Answers derived from the actual code paths, not from intentions:

- `mobile/src/lib/api.ts` — `registerPushToken()` upserts `{token, user_id, country_code, locale, platform, last_seen_at}` into `push_tokens`; `syncPrefs()` upserts `{country_code, locale, provider_ids, push_enabled}` into `user_prefs`; watchlist/seen/rating writes go to `user_movies` (own-row RLS). Requests carry no custom identifying headers (the `x-metatake-app` header was removed; versioning travels in the user-agent).
- `mobile/src/lib/push.ts` — push token is requested only after the OS permission is granted; nothing is sent for anonymous users (`user_id` is NOT NULL by migration 0106).
- `mobile/app.json` — location is when-in-use only ("Used only to show filming locations near you"); no ad or analytics SDKs are present in the plugin list or `package.json`.
- Server metering (The Meter, `guardAndLog`) ledgers endpoint + user-agent per request — it is not keyed to user identity.
- No third-party ads, no third-party analytics/tracking SDKs, no data sold or shared. **Tracking (ATT sense): No.**

⚠️ If any SDK is ever added (analytics, crash reporting, ads), these labels must be redone before the next submission.

---

## Apple — App Privacy ("nutrition label")

Top-level answer: **Data is collected. Data is NOT used to track you.**

| Data type (Apple taxonomy) | Collected? | Linked to identity? | Used for tracking? | Purpose | Source of truth |
|---|---|---|---|---|---|
| Contact Info → Email Address | Yes | Yes | No | App Functionality (account sign-in: email OTP / Sign in with Apple) | Supabase Auth |
| User Content → Other User Content (watchlist, seen, ratings) | Yes | Yes | No | App Functionality (the user's own queue and judgments) | `user_movies` own-row RLS |
| Identifiers → User ID (account UUID) | Yes | Yes | No | App Functionality | Supabase Auth |
| Identifiers → Device ID (Expo push token) — **only if the user enables notifications** | Yes | Yes | No | App Functionality (availability alerts) | `push_tokens` (api.ts:151) |
| Other Data → edition settings (country, language, chosen streaming services) | Yes | Yes (when signed in) | No | App Functionality (availability scope, push join key) | `user_prefs` (api.ts:175) |
| Usage Data → Product Interaction (server request log: endpoint + user-agent) | Yes | **No** | No | Analytics (first-party request metering only) | guardAndLog ledger |
| Location (Precise or Coarse) | **No** | — | — | "Near me" runs on-device; coordinates are never transmitted or stored server-side | app.json + map code |
| Browsing History, Search History, Contacts, Photos, Health, Financial, Messages, Diagnostics | No | — | — | Not collected | — |

Notes for the form:
- Declare each "Yes" row under **Data Linked to You** except the Usage Data row, which goes under **Data Not Linked to You**.
- Location: answer "No" to collection. Apple's definition of "collect" is transmission off-device — the Near me feature never transmits location (verified: the map centers locally; no location field exists in any API call).
- Anonymous users: nothing account-linked is collected at all (no account row, no push token, prefs stay on-device).
- Sign in with Apple users may relay a private email address; it is still "Email Address, linked, App Functionality".

## Google Play — Data safety

Top-level: collects data; does **not** share data with third parties; data encrypted in transit; users can request deletion (in-app account deletion, plus `/api/v1/app/account-delete`).

| Play category → type | Collected? | Shared? | Optional? | Purpose |
|---|---|---|---|---|
| Personal info → Email address | Yes | No | **Optional** (browsing needs no account) | Account management |
| Personal info → User IDs | Yes | No | Optional | Account management, App functionality |
| App activity → Other actions (watchlist, seen, ratings) | Yes | No | Optional | App functionality |
| App activity → App interactions (server request log, not identity-keyed) | Yes | No | No (automatic) | Analytics |
| Device or other IDs (push token) | Yes | No | **Optional** (only if notifications enabled) | App functionality |
| Location (Approximate / Precise) | **No** | — | — | On-device only, never transmitted |
| Financial info, Health, Contacts, Photos/Videos, Audio, Files, Calendar, Messages, Web browsing, Installed apps | No | — | — | Not collected |

Security-practices section:
- Data encrypted in transit: **Yes** (HTTPS everywhere).
- Users can request data deletion: **Yes** — in-app account deletion removes the account and its data; no email round-trip required.
- Independent security review: No.
- Data collected is **not** sold; nothing goes to third parties (TMDB/JustWatch are content sources we fetch — no user data flows to them; images load from the TMDB CDN, which sees a standard image request only).

⚠️ One honest edge to keep in mind if Play reviewers probe: film images load directly from the TMDB CDN, so TMDB's CDN sees the device IP for image requests (same as any image CDN). This is not "data sharing" in Play's taxonomy (no user data is transferred by us), but it is why the label above still declares no sharing with a clear conscience only while no tracking parameters are attached — which the code confirms (plain image URLs).
