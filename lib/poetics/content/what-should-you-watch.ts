const body = `
# What should you watch? An honest decomposition

The first version of the homepage had a single button and a single promise: press it, get the film you should watch tonight. I got as far as writing the query before I stopped. To answer "what should you watch" with one number, I had to decide what the number *meant*, and every honest attempt collapsed into the same embarrassment. The films I most wanted to hand a stranger were the films the number ranked lowest.

## The score I nearly shipped

The tempting thing is to multiply everything into one column and sort descending. I built that column. It leaned, without my asking, towards prestige and reception — towards [The Godfather](/film/the-godfather-1972) and [Moonlight](/film/moonlight-2016), which is fine, and towards a long tail of Oscar-season competence, which is not the same as fine. When I looked at what fell off the bottom of a popularity cut, it was not the weak films. It was [Chantal Akerman](/director/chantal-akerman). It was [Jeanne Dielman](/film/jeanne-dielman-23-quai-du-commerce-1976), a film about a woman peeling potatoes in near real time at [23 quai du Commerce](/film/jeanne-dielman-23-quai-du-commerce-1976), which topped the [Sight and Sound critics' poll](/lineage/sight-and-sound-critics) and which almost nobody searches for. It was [Agnès Varda](/director/agnes-varda). A cut by demand throws away exactly the deep cuts a site like this exists to defend.

## Authority times demand, kept apart

So I refused to multiply. The recommendation decomposes into two questions that a single score jams together, and the whole discipline is in keeping them apart.

**Whether a film belongs at all** is decided by *authority* — is it carried by a canon, an auteur's body of work, or a national tradition that archives and critics recognise. That gate is set out under [how films are chosen](/methodology/film-selection), and it is deliberately not a threshold on the score. [Come and See](/film/come-and-see-1985) and [Sans Soleil](/film/sans-soleil-1983) are in for the same reason [Parasite](/film/parasite-2019) is: someone whose judgement I trust chose to show them.

**What order I get to a film in** is decided by *demand* — how many people are actually looking for it. Demand is real; I am not pretending nobody wants [Get Out](/film/get-out-2017) more than they want [Mouchette](/film/mouchette-1967). But demand only sequences the work. It never buys a place and it never blocks one. Picture a grid with authority up one side and demand along the other: high authority earns entry from anywhere on the demand axis, and a beloved, low-traffic film like [Late Spring](/film/late-spring-1949) stays a keeper no matter how quiet its search line.

## What the gate lets in that a cut would bin

This is not abstract. The catalogue runs to about 6,975 films, and 10,545 lineage memberships across roughly 398 lists in 70 countries are the machinery that lets non-Western canons argue for entry on their own terms rather than waiting for a Western festival to notice them — the [Kinema Junpo all-time list](/lineage/national-jp-kinema-junpo-alltime), the [KOFA 100 Korean films](/lineage/national-kr-kofa-100-korean-films), the [BFI 100 British](/lineage/national-gb-bfi-100-british). Left to its own gravity, authority pulls hard towards [Cannes](/lineage/cannes-palme-dor) and [Best Picture](/lineage/oscar-best-picture). The national lists are the counterweight I have to add by hand.

## What it costs

The honest cost is that "you should watch this" and "you can find this" are now different sentences, and I have made the site say the first while quietly meaning something closer to *this is worth your attention and it earned its place by a route other than being popular*. That is a lot of hedging to fold into one button.

There is a trope our own readings keep naming, [*The Box-Office Verdict As Cultural Diagnosis*](/trope/the-box-office-verdict-as-cultural-diagnosis) — the habit of reading what a crowd chose as a statement about what is good. I built the demand axis precisely so it could never become a verdict. And yet a recommendation is, structurally, a verdict wearing a friendly face. I have separated authority from demand cleanly on the back end. I am less sure I have separated them in the mind of whoever presses the button, who came here asking a simple question and got, instead of a film, a small essay about why the question is two questions.

So the thing I still cannot resolve: when someone asks what they should watch tonight, do they want my authority axis, or do they just want the film everyone else is already watching — and have I any right to answer with the first when they plainly asked for the second?
`;
export default body;
