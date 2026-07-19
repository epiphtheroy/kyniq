# Metatake — store listing (EN, US storefront)

Ready-to-paste values for App Store Connect and Google Play Console.
Character counts were measured, not estimated. Limits are in parentheses.

Canon: `HANDOFF-모바일앱-프리워치.md` §1 (positioning), §13 (invariants, incl. §13-8 attributions).
Rule inherited from HANDOFF-AI집필크레딧: this copy never claims "human-curated" or "not AI"
anywhere; TakeScore and Invitations are credited to "Metatake Editorial" with no authorship
claim in either direction.

---

## App Store Connect

### Name (30 max)

```
Metatake
```
8 chars. Recommended (owner decision §10.3 already leans "Metatake" alone).

Alternates if the plain name is taken or ASO demands a suffix:
- `Metatake: Film Judgment` — 23 chars
- `Metatake - Judge Films` — 22 chars

### Subtitle (30 max)

```
Judge films before you watch
```
28 chars. This is the product's one line; it also indexes for ASO, which is why
"films" and "watch" are deliberately absent from the keyword field below.

### Promotional Text (170 max)

```
Know if a film is worth your evening: TakeScore, a spoiler-free critical lead, and where it streams on your services - one screen before you press play.
```
152 chars. Promotional text can be changed without a review pass — use it later
for seasonal angles (awards season, a big streaming arrival).

### Description (4000 max)

1,923 chars. Short paragraphs + bullets, sentence case, no emoji, no
competitor names, no hype words.

```
Every night ends the same way: thirty minutes of scrolling, then a rerun. Metatake is built for the five minutes before you press play - it helps you judge a film before you watch it, not log it after.

Open a film and you get a judgment brief:

- TakeScore, an original 13-dimension critical score by Metatake Editorial, built from each film's critical and scholarly record. Not an average of user stars.
- An Invitation, a spoiler-free critical lead that tells you what kind of film this is and why it might deserve your evening.
- One judgment bar: want, pass, or seen. After you watch, rate it, and Metatake tells you how the score held up for you - a Find, Aligned, or a Letdown.

Then it helps you actually watch:

- A living queue: your watchlist crossed with the streaming services you pay for. Queues age honestly here - films are marked Fresh, Aging, or Stale, so the list stays a plan instead of a graveyard.
- Situation picks: Safe bet, Hidden gems, 90 in 90 min, Bold pick. Chips for the evening you are actually having.
- Where to watch, on your services, in your country. Editions for multiple countries: switch country and availability follows.
- 17,000 filming locations on a map, including "Near me" when you are out walking.
- Director cards: a filmography with availability dots, so "watch everything by her" becomes a plan.

The catalog is a curated body of about 7,000 films with full critical treatment - chosen, not scraped. If a film is not in it yet, search still finds it and points you to the wider record.

Metatake is free. No ads, no third-party trackers. Browsing needs no account; an account exists only to keep your queue and judgments, and you can delete it inside the app. Criticism and scores are by Metatake Editorial at metatake.net.

Streaming availability powered by JustWatch. Film metadata and images from TMDB. This app uses the TMDB API but is not endorsed or certified by TMDB.
```

### Keywords (100 max, comma-separated, no spaces)

```
movies,streaming,watchlist,critic,scores,reviews,cinephile,arthouse,locations,tonight,queue,director
```
Exactly 100 chars.

ASO reasoning:
- Name ("metatake") and subtitle words ("judge", "films", "watch") are already
  indexed — repeating them wastes characters, so the field uses "movies" for the
  singular/plural pair and skips "watch"/"film" entirely.
- "tonight" and "queue" match the decision-moment queries the app answers;
  "cinephile"/"arthouse"/"criterion-adjacent" tastes are the actual audience.
- "locations" covers the map pillar (nobody else has it; low competition).
- No competitor or platform brand names (Netflix, Letterboxd…) — Apple rejects
  third-party trademarks in keywords, and we do not need the risk.

### Categories

- Primary: **Entertainment**
- Secondary: **Reference** (the app fronts a critical archive; Reference fits
  better than Lifestyle and avoids the brutal Photo & Video pool)

### Age rating questionnaire (Apple)

The app shows film posters/stills and critical prose about films, including
mature ones. Answer the content descriptions as "infrequent/mild" wherever film
artwork or quoted criticism could surface the theme:

| Question | Answer |
|---|---|
| Cartoon or fantasy violence | None |
| Realistic violence | Infrequent/Mild (film stills and posters) |
| Prolonged graphic violence | None |
| Sexual content or nudity | Infrequent/Mild (film artwork, synopses) |
| Graphic sexual content | None |
| Profanity or crude humor | Infrequent/Mild (quoted critical text) |
| Mature/suggestive themes | Infrequent/Mild |
| Horror/fear themes | Infrequent/Mild (horror-film artwork) |
| Alcohol, tobacco, drug use or references | Infrequent/Mild (as depicted in films) |
| Simulated gambling | None |
| Real gambling / contests | No |
| Medical/treatment information | None |
| Unrestricted web access | **No** (in-app reader opens metatake.net pages only; film/director links are intercepted back into the app) |

Expected result: **12+**. ⚠️ Owner to confirm the final rating Apple computes —
if the questionnaire lands on 17+, revisit the two "Infrequent/Mild" sexual
content/themes answers before accepting.

### URLs and copyright

| Field | Value |
|---|---|
| Support URL | `https://metatake.net/about` |
| Marketing URL | `https://metatake.net/app` |
| Privacy Policy URL | `https://metatake.net/privacy` |
| Copyright | `© 2026 Metatake` |

---

## Google Play Console

### App name (30 max)

```
Metatake
```

### Short description (80 max)

```
Judge films before you watch: TakeScore, spoiler-free leads, your services.
```
75 chars.

### Full description (4000 max)

Reuse the App Store description above verbatim, with one adaptation: Play allows
minimal formatting, so keep the same plain-text bullets. Append nothing — the
JustWatch/TMDB attribution stays as the last paragraph.

### Play specifics

- Category: **Entertainment**
- Content rating (IARC questionnaire): answer as in the Apple table above
  (media references to violence/sexuality/profanity in an editorial context,
  no user-to-user content, no gambling). Expected: **Teen**. ⚠️ Owner confirms.
- Contains ads: **No**. In-app purchases: **None**.
- Data safety: see `PRIVACY-LABELS.md`.
- Feature graphic: render `feature-graphic.html` (see `ASSETS.md`).
