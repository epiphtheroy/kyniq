const body = `
# The My Films lens

Turn on the **My Films** lens and the entire site re-centres on the films you have actually seen. It is a single switch in the navigation, and it changes how everything else reads.

## Why it exists

A catalogue of nearly seven thousand films is a lot to take in at once. The My Films lens is the answer to a simple wish: *show me this, but through what I know.* Suddenly a director's page, a trope, a map of filming locations, a ranked list — all of it can be read against your own history, so the vast archive becomes legible as your archive. It is the same instinct as [My Room](/methodology/my-room), turned outward onto the whole public site rather than kept to a private terminal.

## How it works

The lens has three settings. **Off** is the ordinary public site. **Highlight** accents the films you have seen everywhere they appear — every poster, every galaxy dot, every map pin, every inline link gets a quiet mark — so your history lights up inside the larger map without hiding anything. **Only** goes further: it ghosts what you have not seen, filters the maps and graphs to your films, and rebuilds indexes, rankings and even the strong-misreading feed around your own viewing.

Two design rules make it trustworthy. The lens is a **pure client-side overlay** for everything that can be done in the browser — the public, cached pages everyone else sees never change, which keeps the site fast and its search-engine version stable. And where a personalised view genuinely needs to read your history from the database — a ranked list rebuilt around your films — it runs only through **private, session-verified endpoints** that are never cached across users, so one person's viewing record can never leak into another's page.

## How to turn it on

The lens lives as a toggle in the top navigation once you are signed in and have logged at least one film; there is a short introduction at [/my-films](/my-films). Off is always the default, and the site works exactly as before until you choose otherwise.

## Limits

The lens can only reflect what it has been told. If your seen-list is thin or out of date, "Only" mode will feel sparse — so the fastest way to fill it in is to [import your history](/methodology/import). And "Only" is a way of *reading* the site, not a verdict on it: a film you have not seen is ghosted, not judged, and the full public site is always one switch away.

---

> The My Films lens sits under the same [corrections](/methodology#corrections) loop as everything else: if it mismatches a film you have logged, tell us and we will look into it.
`;
export default body;
