const body = `
# The gravity of Cannes

The first time I laid all the honours lists end to end — some 398 of them, 10,545 film-to-list memberships across 70 countries — I expected a map of world cinema. What I got was a photograph of a solar system with two suns. Nearly everything with a high prestige standing orbited either [Cannes](/lineage/cannes-palme-dor) or [Hollywood](/lineage/oscar-best-picture). I had built the scale to be fair, and it had faithfully reproduced the field's own centre of gravity, which is not the same thing at all.

## The number was right and the picture was wrong

I want to be exact about the failure, because it was not a bug. The [prestige score](/methodology/lineage-standing) does what the page says it does: it sorts a film's honours strongest-to-weakest and sums them with a decay of about 0.6 per step, so **one great honour defines a film** and the rest add depth. The [Palme d'Or](/lineage/cannes-palme-dor) and Best Picture sit in the top authority band, .90 to 1.00, because — honestly — they should. A jury at Cannes shapes film culture; pretending otherwise to flatter my sense of balance would just be a lie with better manners.

So the mechanism was innocent. The problem was that if I shipped **only** prestige, I would be telling a viewer in Taipei or Tehran that their cinema mattered in proportion to how much Western hardware it had accumulated. [Yi Yi](/film/yi-yi-2000) won Best Director at Cannes and is safe on that count. But [Edward Yang](/director/edward-yang) is not, in the prestige tables, meaningfully near [Ozu](/director/yasujiro-ozu), and a film that never crossed the Croisette at all would read as thinner still. The gravity was doing its job. Its job was the problem.

## The counterweight I had to build on purpose

The fix was not to fudge the Palme's weight downward — that would corrupt the one thing prestige is honest about. It was to keep a **second axis** and refuse to blend the two. **Discovery** rewards a film for the rarity and distance of its recognition: a prize from a small, fiercely selective national body counts *for* something precisely because it sits far from the centre, not against something for lacking an Oscar. The two axes are meant to pull against each other. Averaging them into one tidy figure would hide both, which is the sort of tidiness I have learned to distrust.

Concretely, this is why I went out of my way to admit national canons that restate nothing the global circuit already carries: Iran's [Crystal Simorgh](/lineage/national-ir-crystal-simorgh-best-film), Taiwan's [Golden Horse 100](/lineage/national-tw-golden-horse-100), and their kind across the twenty-three countries whose national canons we admit. A country's own highest award tells you something the Cannes-and-Oscars circuit structurally never will — the reasoning behind admitting them is set out in [how a list earns its place](/methodology/lineage-selection). [A Separation](/film/a-separation-2011) reads differently when its home honours are weighed beside its Berlin bear rather than swallowed by it.

## The named cost

I should name the trap I was walking toward, because our own readings have a term for it: [*The Award As Society's Absolution Ritual*](/trope/the-award-as-society-s-absolution-ritual) — the ceremony that lets a culture feel it has recognised something by handing it a statue. A prestige-only map is that ritual rebuilt as software. It would let me feel I had honoured world cinema while quietly re-centring the same two cities. Building the discovery axis was, in part, me refusing to let my own database perform that absolution on my behalf.

And I am not sure it is enough. Discovery corrects the tilt; it does not abolish the fact that I chose which national bodies clear the bar, using tests I wrote. [Yeelen](/film/yeelen-1987) still depends on my having found, enumerated and trusted its canon — and on my judgement that it *is* one. The counterweight is real, but it hangs from a bracket I bolted to the wall myself.

The honest question is whether a discovery score genuinely measures a film's distance from the centre, or only my distance from it — the reach of one editor's atlas, mistaken for the shape of the world. Cannes has real gravity. So, it turns out, do I, and mine is the one I cannot see from the inside.
`;
export default body;
