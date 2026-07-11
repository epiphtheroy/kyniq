# SAMPLE — Methodology Docs 표준 템플릿: "Kinship"

> **지위**: 방법론 독스 37편 전체의 **표준 템플릿**. 형식·보이스·공개 수위(HANDOFF-방법론-독스.md §8 티어 2 준수)의 기준.
> 구현 시 이 본문을 `lib/docs/content/kinship.ts`의 마크다운 문자열로 이식한다(카테고리 The Connections, slug `kinship`).
> 템플릿 규칙: H1+standfirst → In numbers(해당 시) → 방법 서술 → What we decided, and why → Limits → corrections 각주 → Updated 스탬프. 성장 수치는 라이브 렌더 표시, 방법 상수는 티어 판정 후만 명기.
> 소스 추적: `docs/PLAN-connections-overhaul.md` · `HANDOFF-연결엔진-커넥션.md` · `HANDOFF-임베딩판타지아-문장층.md` · `app/methodology/page.tsx` #connections. 이 아래부터가 실제 게재 본문.

---

# Kinship — how film-to-film connections are computed

Every "films most connected" list on Metatake is computed, not curated. This page explains what goes into a connection, what the kinship number means, and what we deliberately leave out.

## In numbers

> **27,000+**
> kinship pairs
> film-to-film edges, each carrying the evidence it was computed from

> **46,000+**
> affinity rankings
> the strongest connections kept per film, recomputed as the corpus grows

> **top ~24**
> kin per film
> we keep the strongest two dozen, never the full noise floor

*(Counts are read live from the database — they grow as the corpus does.)*

## Two signals, fused

A connection between two films is built from two independent signals.

**Shared tropes.** When two films' figures belong to the same [trope](/tropes) — the same coded, recurring pattern of reading — that is a connection, and rarer tropes count for more than common ones. Two films that both stage "rain" share almost nothing; two films that both stage a trope only five films on the site carry share something real. The weighting follows the standard rarity logic of information retrieval: the fewer films a trope touches, the more it says when two of them meet there.

**Taste distance.** Separately, each film's published readings are averaged into a single vector — a position in meaning-space built from what the readings actually say, not from genre or decade tags. Films whose vectors sit close are neighbours even when they share no trope at all. This is what lets a connection cross genre lines: a horror film and a chamber drama can be kin because their readings think about the same thing.

The two rankings are then fused — neither signal is allowed to dominate — and the strongest connections are kept per film. Both underlying quantities are stored with every edge, so a connection can always be audited back to its parts.

## The kinship index

Each pair also carries a single **kin index from 0 to 100** — the number you see weighting the lines on the [Network](/network) graph. It combines three components: how close the two films sit in meaning-space, how much trope ground they share, and **how rare the things they share are**. Sharing something scarce moves the needle more than sharing something everywhere. The exact blend is ours; the components are not — every edge shows the shared tropes it was computed from, so the claim is checkable, not just believable.

## Evidence, always

A kinship claim on Metatake never appears alone. The shared tropes are shown with the connection, and each one links to its own page, where you can read every film that carries it. If a connection looks wrong, the evidence for it is one click away — and if the evidence doesn't hold, [tell us](/methodology#corrections).

## What we decided, and why

A few calls weren't obvious, so here is how we settled them. We compute connections **from the readings, not from viewing behaviour** — there is no "people who liked X" signal anywhere in the system, because likeness of audience is not likeness of thought. We **fuse two signals instead of trusting one**: tropes alone miss films that think alike without sharing a named pattern; distance alone produces neighbours nobody can explain. Requiring both to have a voice keeps the lists explainable. We keep **the strongest two dozen kin per film, not a full ranking of the corpus** — beyond that depth the numbers stop meaning anything and the list becomes noise wearing a percentage. And everything **recomputes as the corpus grows**: a list you see today can legitimately change next month, because a new film's readings moved the space. Same input, same output; nothing is shuffled, nothing is promoted by hand.

## Limits

Kinship measures how films *read*, not how they were made — it will not tell you two films shared a cinematographer (the [credits](/credits) layer does that), and it can only see films that have readings, so a film new to the corpus starts with thin connections and earns denser ones as its readings publish. The index is deterministic but not eternal: it is rebuilt as the corpus grows, and we treat that movement as a feature, not a flaw.

---

*Kinship sits under the same [corrections](/methodology#corrections) loop as everything else on the site: if a connection is factually mislabelled — a wrong film, a wrong trope — tell us and we'll fix the row. Interpretive distance is not a correctable fact.*

*Related: [Counterpoints](/methodology/counterpoints) · [The numbers on ranked lists](/methodology/rankings) · [The embedding map](/methodology/embedding-map)*

*Updated July 2026.*
