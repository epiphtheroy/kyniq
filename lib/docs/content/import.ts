const body = `
# Importing your films

Everything personal on Metatake — [My Room](/methodology/my-room), the [My Films lens](/methodology/my-films), taste-based recommendations — runs on knowing what you have watched. Rather than make you rebuild years of viewing by hand, we let you bring it in from wherever you already keep it.

## Why it exists

A viewing history is one of the more valuable things a film lover owns, and it is usually trapped in one service. The importer exists so that history can move — so that a decade of Letterboxd logging, an IMDb ratings export, or a spreadsheet you have kept for years can light up the whole personal layer in a single step, instead of being retyped a film at a time.

## How it works

The importer accepts the common formats — a Letterboxd export, an IMDb CSV, a Watcha history, a plain spreadsheet, even a loose list of titles — and detects which one you have given it. Each row is matched to a film's identity, and where a title is ambiguous you are shown the match to confirm before anything is saved. Two records are kept: a lossless log of exactly what you imported, and an aggregated view of what you have seen and rated that the rest of the site reads from. Nothing is published; an import feeds only your own private surfaces.

## How to use it

The importer lives under your account. Point it at a file, review the matches it is unsure about, and confirm — the Room and the lens fill in immediately afterward.

## Limits

Matching is careful but not magic: an obscure title, a re-release under a different name, or a film not yet in the catalogue may not resolve, and the importer shows you those rather than guessing. The lossless log means a bad import can always be reconciled, and re-importing an updated export adds what is new without duplicating what is already there.

---

> Imports sit under the same [corrections](/methodology#corrections) loop as everything else: if the importer mismatches a film, tell us and we will look into it.
`;
export default body;
