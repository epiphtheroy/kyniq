# App Review notes — Metatake

Paste-ready notes for the App Store Connect "App Review Information" notes field
(and the equivalent Play pre-launch notes). Written for a reviewer who has never
seen the product. Facts verified against the code at `mobile/` (Expo SDK 54,
bundle `net.metatake.app`) and `HANDOFF-모바일앱-프리워치.md` §2/§4/§5/§12-2.

---

## What the app does

Metatake helps people judge a film before they watch it. For each film it shows
TakeScore (an original 13-dimension critical score by Metatake Editorial), a
spoiler-free critical lead called An Invitation, and where the film streams on
the user's own services in their country. Users keep a watchlist ("queue"),
mark films seen, and rate them; a map shows 17,000 real filming locations. The
app is free, with no ads and no in-app purchases. It is the mobile companion to
our website, metatake.net.

## No account needed to review most of the app

Browsing is fully open: the Tonight deck, Explore (search + curated lists),
every film and director page, and each film's Locations map all work without
signing in. An account is required only
to SAVE judgments (watchlist / seen / ratings) and to enable notifications.

**Demo path (2 minutes):**

1. First launch → onboarding: the account step comes first — choose "skip".
   Then keep country United States and tap a couple of streaming services
   (e.g. Netflix); the taste step can be skipped too.
2. Tonight tab → tap any film card.
3. On the film screen: TakeScore donut, the Invitation lead, "Where to watch"
   for the selected services, filming locations, the director row — all native.
4. Tap the judgment bar (want / seen). This is the one action that prompts
   sign-in.

**Reviewer account** — ready to use, no email round-trip required:

```
Username:  appstore.review@metatake.net
Password:  Review-IEsheX0CHD47
```

Tap "Continue with email", enter the two values above, tap Continue. The account
already exists, so this signs straight in.

Three other ways in are offered, all real, none required for review: Sign in with
Apple, Google, and an emailed 8-digit one-time code ("Email me a code instead").

Account deletion is available in-app under the You tab → account section
(Guideline 5.1.1(v)).

## Why the app requests location (when-in-use)

Used only for the "Near me" toggle on the Locations map, to center the map on
nearby filming locations. Location is processed on-device and never uploaded
or stored on our servers. The permission is requested in context (first use of
"Near me", not at onboarding), and every feature works if it is denied — the
map simply stays at the default view.

## Why the app requests notifications

One notification type: "a film on your watchlist just arrived on one of your
streaming services" (computed per user country). Strictly opt-in via a switch
in the You tab; off by default; no marketing pushes. The push token is stored
with the user's account and country only for this purpose.

## Web views (Guideline 4.2 note)

The app's value is native: the judgment screen (score, spoiler-free lead,
judgment bar), the availability-aware queue, the situation picks, the Locations
map on each film, director filmographies with per-service availability dots,
and availability push. Web views appear only in the supplementary "Read more on
Metatake" rows, which open long-form criticism articles from our own site
(metatake.net) inside a native-headed reader — the mobile equivalent of a
footnote. No third-party web content is loaded; taps on film/director links
inside the reader are intercepted back into native screens.

## Content and licensing

- Film metadata and images come from TMDB (attributed in-app and in the
  listing; the app uses the TMDB API but is not endorsed or certified by TMDB).
- Streaming availability is powered by JustWatch (attributed on every
  "Where to watch" surface).
- Editorial content (scores, leads, articles) is our own, by Metatake
  Editorial at metatake.net.
- Age rating: the app displays film posters/stills and critical prose about
  films, including mature ones — rated accordingly (see the questionnaire
  answers in `listing-en.md`).

## Technical notes

- Encryption: standard HTTPS only (`ITSAppUsesNonExemptEncryption = false` is
  set in the build).
- Universal links: `metatake.net/film/*`, `/director/*`, `/what-to-watch` open
  natively; the AASA file is served at
  `https://metatake.net/.well-known/apple-app-site-association`.
- Auth backend is Supabase (email OTP + Sign in with Apple). User content is
  the user's watchlist/seen/ratings, deletable with the in-app account
  deletion.
