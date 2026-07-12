const body = `
# Weights and decay

A film's lineage standing is a number, and like every number on Metatake it is computed, not asserted. This page explains how that standing is built: what each honour is worth, how the honours are added up, and why we keep three separate scores instead of collapsing everything into one. The standing is always shown with its parts, so the number is never a black box.

## In numbers

> **~5,975**
> films with a standing
> each carrying at least one award, canon or national honour, resolved to the same film identity the rest of the site uses

> **{{n:lineage}}**
> list memberships
> every list enumerated whole and weighed, not sampled — see [Lineage](/lineage)

> **70**
> countries
> national honours weighed beside the global-prestige lists, on purpose

## What a single honour is worth

A film's standing is the weighted sum of what it actually holds. Not every list weighs the same, and we do not pretend they do. Each list carries an **authority weight** that sits in one of four bands: **T1 .90–1.00** for the Palme d'Or, Best Picture, the *Sight & Sound* poll; **T2 .70–.88**; **T3 .50–.68**; and **T4 .30–.45** for minor and regional prizes.

That weight is then multiplied by what the film did with the list. A **win** counts **×1.0**, a **nomination ×0.45**, a **listing ×0.45**, and a **bare festival selection ×0.30** — being merely selected for a festival is treated as the lighter fact it is, not confused with winning it. On a ranked canon there is a further scaling: a **ranked place scales from 1.0 at the top of a canon to about 0.5 at its tail**, so first place counts for more than nine-hundredth without the tail counting for nothing.

The director adds a fifth, gentler signal, a band running **from 0.92 for a first-rank auteur down to 0.40**. It is deliberately damped so that a master lifts a slighter film's floor without eclipsing the film's own record. We publish the bands, but not the individual director-to-band mappings — a living filmmaker's placement is a judgement we keep to ourselves.

## Why one great honour defines a film

Having weighed each honour, we have to add them up, and the shape of that sum matters. If we simply totalled every signal, a film with a shelf of minor citations could out-score a film with a single towering one — which is backwards. So the signals are sorted from strongest to weakest and summed with a **geometric decay of about 0.6 per step**: the top honour lands at full weight, the next at roughly 0.6, the third at roughly 0.36, and so on.

The effect is that **one great honour defines a film and each further honour adds depth**. A Palme d'Or alone outweighs a stack of small prizes; a Palme *and* a Best Picture *and* a canon place outweighs the Palme alone. Depth is rewarded, but it can never manufacture prestige out of volume.

The spread that results is wide and deliberately lopsided. The median film with any standing sits near **33**, most cluster well below the halfway mark, and only a small elite — the films that won at the top *and* were canonised *and* kept — climb into the 90s, up toward a ceiling near 99. The scale is built so that its summit stays thinly populated; a standing everyone could reach would rank nothing.

## Three scores, not one

The most important decision here is that we do not roll everything into a single number. We keep three separate scores.

| Score | What it measures |
|---|---|
| **Prestige** | What a film won — the weighted, decayed sum described above |
| **Discovery** | How rare and far from the centre its recognition is |
| **Similarity** | Which movements and styles a film shares, used to find kin |

Prestige tilts hard toward Cannes and Hollywood by its nature, so **discovery** is a deliberate counterweight, not an afterthought: a film found at a small, fiercely selective festival is rewarded for the rarity of its recognition rather than penalised for not carrying Western hardware. The two axes are meant to pull against each other, not to be blended into one figure that hides both.

## What we decided, and why

A few calls were not obvious, so here is how we settled them. **Movements and styles are kept out of the headline score.** A film is not *better* for being slow cinema or surrealist — that is likeness, not quality, and treating the two as the same is a category error. So style lives only in the similarity score, where it helps find kin, and never touches prestige. Which lists are admitted in the first place — and why full nominee slates and vast, low-discrimination catalogues are kept out — is covered in [How a list earns its place](/methodology/lineage-selection).

## Limits

A standing measures a film's place in the public record, not its worth to you. It rises as new ceremonies are held, which means a living director's recent film can score low simply because its record is unfinished — the honours have not been awarded yet. The bands and multipliers above are fixed and published; the tuning that calibrates the top of the scale is ours, and we hold it back so the numbers stay honest rather than gameable. Every standing is shown broken into its parts, so the number can be weighed against your own judgement rather than taken on trust.

---

> Lineage standing sits under the same [corrections](/methodology#corrections) loop as everything else: if a film is filed under the wrong award, or missing an honour it plainly holds, tell us and we will fix the row.
`;
export default body;
