# Mission 8 — Home, chrome & institutional pages

> Paste **after Mission 7.** Legal pages need lawyer review before launch — ship the structure,
> flag for review.

---

**Context.** Read `AGENTS.md` and `SPEC.md` §6.2 (home), §6.6 (global chrome), §6.9 (legal &
institutional, incl. the **contribution content license** and AI-crawler disclosure), §6.10
(system pages), and match `ref-home.html` + `ref-chrome.html` + `ref-about.html`. Mission 8 from
§13. **Scope = the real home, finalized chrome, institutional/legal pages, consent, and error
pages.**

**Do:**
1. **Home `/`** (replace the M0 placeholder) — matching `ref-home.html` + §6.2: search,
   "Questions needing a reading," "Active now," "Recently improved," notable readers. Real data,
   server-rendered.
2. **Global chrome** — finalize header + footer per `ref-chrome.html` (logged-in avatar menu:
   View profile · My activity · Settings · Sign out). Footer: About/Contact/Guidelines/Terms/
   Privacy, company line (FilmCurio · address · wonwoo@metatake.net), TMDB attribution,
   © 2026 FilmCurio, locale switcher.
3. **Institutional pages** (§6.9), server-rendered (E-E-A-T): `/about` (mission + the film + curio meaning + the AI-assisted/human-reviewed disclosure, per `ref-about.html`);
   `/contact`; `/guidelines`; `/terms` (**must include the contribution content license** —
   CC BY-SA-style — since canonical answers merge others' work; plus eligibility/age, acceptable
   use, moderation, liability, governing law) ; `/privacy` (data collected, third parties,
   cookies, **AI-crawler stance**, GDPR/CCPA rights tied to account deletion). Flag Terms +
   Privacy clearly as **needs legal review**.
4. **Cookie / consent banner** (GDPR/ePrivacy) — block non-essential cookies until consent;
   remember choice. (Required before ads, M11.)
5. **System pages** (§6.10) — styled `404`/error with a route back to search/home; no blank
   pages.

**Verify (all must pass):**
- Lighthouse performance/SEO green; the home renders real data server-side.
- Every footer link resolves to a real page; `/about` carries the etymology + AI disclosure.
- The consent banner gates non-essential cookies and persists the choice.
- A bad URL shows the styled 404.

**Do not:** turn on ads (M11); ship Terms/Privacy as final legal text (mark for review).

---

*Next:* **Mission 8b — Related & discovery + director hub.**
