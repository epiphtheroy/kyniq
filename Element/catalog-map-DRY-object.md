# Catalog mapping — DRY comparison

Sample: **20** `object` figures · candidates 8 archetypes + 6 themes · models claude-haiku-4-5, claude-sonnet-4-6

## Cost (measured on this sample, real-time)

| Model | uncached in | cache write | cache read | output | sample $ | $/figure |
|---|--:|--:|--:|--:|--:|--:|
| claude-haiku-4-5 | 30,680 | 0 | 0 | 2,156 | $0.0415 | $0.00207 |
| claude-sonnet-4-6 | 30,700 | 0 | 0 | 1,630 | $0.1166 | $0.00582 |

_$/figure = steady-state (cached prefix + variable input + output), the cost that scales._

## Full-run projection (steady-state $/figure × population)

Batch API = 50% off. Caching already folded into $/figure.

| Scope | figures | haiku real-time | sonnet real-time | haiku batch | sonnet batch |
|---|--:|--:|--:|--:|--:|
| Objects | 1,777 | $3.68 | $10.34 | $1.84 | $5.17 |
| Characters | 3,100 | $6.41 | $18.04 | $3.21 | $9.02 |
| Locations | 1,849 | $3.83 | $10.76 | $1.91 | $5.38 |
| Objects+Characters+Locations | 6,726 | $13.92 | $39.15 | $6.96 | $19.57 |
| + Film themes | 8,660 | $17.92 | $50.40 | $8.96 | $25.20 |
| Everything (all kinds) | 18,168 | $37.59 | $105.74 | $18.79 | $52.87 |

## Results — 13/20 divergent (★)

### The skateboard
*Paranoid Park · 2007*  

> Alex's skateboard in Paranoid Park, ridden in slow-motion grainy footage at the park and used as the weapon he swings at the guard before the death.

kNN archetypes — The Executioner's Axe(0.40), The Illegally Filmed Video(0.39), The Haunted Videotape(0.35), The Abandoned Playground(0.35), The Vengeance Blade(0.35)
  · themes — Paranoia(0.36), The Gaze (Panoptic/Surveillance)(0.34), The Spectacle(0.31), The Psychological Landscape(0.31)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| type **T09** · function **VII**<br>archetype: double-edged-sword (0.72)<br>themes: externalization-objective-correlative, rage, paranoia<br>_Skateboard as weapon that destroys wielder's life; embodies internal violence externalized_ | type **T08** · function **IV**<br>archetype: double-edged-sword (0.62)<br>themes: externalization-objective-correlative, psychological-landscape, paranoia<br>_Skateboard as identity symbol becomes accidental murder weapon_ |

### Archival propaganda footage ★
*The Sorrow and the Pity · 1971*  

> The Sorrow and the Pity intercuts present-day interviews with period newsreels — Vichy ceremonies, Pétain's speeches, German military footage, anti-Semitic posters — presented without softening narration.

kNN archetypes — The Crime Scene Photo(0.34), The Vietnam Flashback(0.34), The Phantom Pain(0.32), The Audiotape of an Argument(0.32), The Courtroom Sketch(0.32)
  · themes — Witnessing (Impotent)(0.36), Pastiche(0.35), The Body in Pain(0.35), Pessimism(0.35)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| **abstain**<br>themes: witnessing-impotent, pessimism, war<br>_Archival footage is documentary material, not a touchable prop or single perceptible object._ | type **T07** · function **V**<br>archetype: crime-scene-photo (0.52)<br>themes: witnessing-impotent, war, pessimism<br>_Archival footage is screen/recording documenting trauma as evidence_ |

### Santosh's inherited uniform
*Santosh · 2024*  

> In Santosh, the constable's khaki passes from a dead husband to his widow under a compassionate-appointment scheme. She wears the same shirt, carries the same authority, and slowly grows into the violence it permits.

kNN archetypes — The Hand-Me-Down (Worn With Pride)(0.39), The Inherited Suit(0.37), The Lipstick of Indifference(0.35), The Vestige of Authority (e.g., Uniform)(0.35), The Inconvenient Witness(0.35)
  · themes — Banal Enforcement(0.35), Self-Sacrifice(0.35), Complicit Survival(0.34), Sentimentality(0.33)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| type **T03** · function **II**<br>archetype: vestige-of-authority-e-g-uniform (0.78)<br>themes: complicit-survival, banal-enforcement<br>_Uniform as inherited authority structure; woman assumes institutional power and grows into its violence._ | type **T03** · function **III**<br>archetype: vestige-of-authority-e-g-uniform (0.72)<br>themes: banal-enforcement, complicit-survival<br>_Inherited uniform externalizes authority and moral corruption absorbed over time_ |

### Yuta's cursed ring and engagement promise ★
*Jujutsu Kaisen 0 · 2021*  

> In Jujutsu Kaisen 0, a childhood promise to marry Rika anchors her to Yuta; the vow itself functions as the binding that keeps her curse attached to him.

kNN archetypes — The Shattered Vow(0.45), The Blood Pact(0.43), The Blood Oath(0.41), The Wedding Ring(0.41), The Judas Kiss(0.39)
  · themes — Betrayal(0.32), Friendship(0.31), Prophecy (Self-Fulfilling)(0.31), Symbiosis(0.30)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| type **T02** · function **IV**<br>archetype: blood-pact (0.72)<br>themes: childhood-corrupted-innocence, symbiosis, prophecy-self-fulfilling<br>_Childhood vow binds curse; sealed bond creates inescapable fate._ | type **T02** · function **IV**<br>archetype: tether (0.72)<br>themes: symbiosis, childhood-corrupted-innocence<br>_Ring/vow physically binds Rika's curse to Yuta as tether_ |

### Shaun's chalkboard plan ★
*Shaun of the Dead · 2004*  

> In Shaun of the Dead, a small pub specials board Shaun grabs to sketch his survival strategy, which the film replays nearly identically twice with different details.

kNN archetypes — The Canteen of Water(0.35), The Safe House(0.35), The Microfilm(0.33), The Hangover's Regret(0.33), The Underground Bunker(0.33)
  · themes — The Double (Doppelgänger)(0.31), The Everyday (The Quotidian)(0.29), Parody(0.28), Simulacra and Simulation(0.28)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| type **T04** · function **IV**<br>archetype: safe-house (0.62)<br>themes: survival, defense-mechanism, everyday-the-quotidian<br>_Plan sketch externalizes survival strategy; refuge through organized thought._ | type **T04** · function **VII**<br>archetype: _(tiers only)_<br>themes: survival, parody, everyday-the-quotidian<br>_A physical chalkboard used as comic survival-plan prop_ |

### The katana / drawn blade ★
*Samurai Rebellion · 1967*  

> In Samurai Rebellion, the sword shown early only as a tested, sheathed tool of ceremony, withheld through the long talky middle, and finally unleashed in the explosive final acts.

kNN archetypes — The Peasant's Scythe(0.51), The Coming-of-Age Blade(0.50), The Ancestral Sword(0.49), The Final Bullet(0.48), The Vengeance Blade(0.47)
  · themes — Rebellion(0.38), Rage(0.35), Revolution (Failed)(0.33), Confession(0.32)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| type **T08** · function **IV**<br>archetype: ancestral-sword (0.72)<br>themes: rebellion, rage, resistance<br>_Inherited duty made lethal. Withheld then unleashed as fate._ | type **T08** · function **VII**<br>archetype: vengeance-blade (0.62)<br>themes: rebellion, resistance, rage<br>_Withheld blade finally unleashed in defiant last-act uprising_ |

### The hard-boiled egg ★
*In the Realm of the Senses · 1976*  

> In In the Realm of the Senses, in a notorious scene the lovers use a hard-boiled egg and food as sexual implements, treating the kitchen and the body as a single continuous appetite.

kNN archetypes — The Homemade Meal (Love Made Edible)(0.48), The Glass of Milk(0.46), The Corrupted Meal(0.46), The Primal Ham (Jamón)(0.45), The Shared Meal as Interrogation(0.45)
  · themes — Eroticism(0.44), Sensoriality(0.43), Objectification(0.41), The Family Meal (Ritual/Conflict)(0.39)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| type **T13** · function **I**<br>archetype: homemade-meal-love-made-edible (0.38)<br>themes: eroticism, sensoriality, embodiment-the-lived-body<br>_Food as intimate tool; appetite made visible. Low archetype confidence._ | type **T13** · function **I**<br>archetype: _(tiers only)_<br>themes: eroticism, sensoriality, embodiment-the-lived-body<br>_Food used as erotic implement; desire and bodily appetite merged_ |

### The latex catsuit ★
*Irma Vep · 1996*  

> In Irma Vep, the shiny black bodysuit ordered for Maggie Cheung is fetishised, fitted, and finally worn on midnight prowls through hotel corridors. It exists more as costume-history quotation than as character clothing.

kNN archetypes — The Red Dress(0.46), The Misfit's Uniform(0.45), The Stolen Fur Coat(0.42), The Femme Fatale's Lipstick(0.42), The Impostor's Suit(0.42)
  · themes — Hysteria(0.36), Fetishization (Objectification)(0.35), Objectification(0.34), The Abject(0.34)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| type **T03** · function **III**<br>archetype: impostor-s-suit (0.68)<br>themes: fetishization-objectification, objectification<br>_Borrowed identity worn as citation. The suit externalizes performative self, not genuine character._ | type **T03** · function **III**<br>archetype: misfit-s-uniform (0.52)<br>themes: fetishization-objectification, eroticism<br>_Costume-history quotation worn as performed identity, fetishised on screen_ |

### The Grimmerie
*Wicked · 2024*  

> In Wicked, the ancient spellbook of lost Ozian magic that only Elphaba can read, which Madame Morrible and the Wizard need her to wield. A book whose language excludes almost everyone.

kNN archetypes — The Cursed Grimoire(0.49), The Eldritch Tome(0.49), The Forbidden Key(0.41), The Banned Book(0.39), The Forbidden Room(0.37)
  · themes — Disenchantment(0.39), Knowledge (Forbidden/Hidden)(0.37), Blindness (Willful)(0.34), Enchantment (The Re-enchanted World)(0.33)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| type **T16** · function **II**<br>archetype: eldritch-tome (0.72)<br>themes: knowledge-forbidden-hidden, blindness-willful<br>_Ancient magic book; language exclusion = power & control mechanism_ | type **T16** · function **II**<br>archetype: eldritch-tome (0.72)<br>themes: knowledge-forbidden-hidden, exceptionalism, disenchantment<br>_Ancient spellbook grants power but serves as instrument of control_ |

### The chalk-letters and the bookstore study ★
*The Boy and the Beast · 2015*  

> In The Boy and the Beast, the teenage Kyuta secretly learns to read and study in the human world, scrawling and cramming toward exams while training as a beast-fighter.

kNN archetypes — The Animal Transformation as Punishment(0.38), The Prize Racehorse(0.35), The Coming-of-Age Blade(0.34), The Animal as a Mirror (e.g., Richard Parker)(0.33), The Cursed Grimoire(0.31)
  · themes — The Animalistic (Non-Human Perspective)(0.36), Youth(0.29), Coming of Age(0.28), Stoicism(0.28)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| type **T04** · function **I**<br>archetype: _(tiers only)_<br>themes: coming-of-age, knowledge-forbidden-hidden<br>_Chalk letters & study as aspiration. Kyuta's secret learning embodies forbidden knowledge & growth._ | **abstain**<br>themes: coming-of-age, youth<br>_Activity/practice (studying), not a tangible prop object_ |

### The kimono and appearances ★
*When a Woman Ascends the Stairs · 1960*  

> In When a Woman Ascends the Stairs, the fine clothes, well-kept apartment, and air of prosperity Keiko must maintain at cost to herself in order to keep working.

kNN archetypes — The Red Dress(0.40), The Glass Slipper(0.40), The Dancer's Pointe Shoes(0.38), The Borrowed Ladder(0.38), The Hand-Me-Down (Worn With Pride)(0.38)
  · themes — Social Climbing(0.42), Anxiety of Status(0.38), Bourgeois Anxiety/Hypocrisy(0.37), Aspiration(0.36)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| type **T03** · function **III**<br>archetype: stolen-fur-coat (0.72)<br>themes: anxiety-of-status, social-climbing, emotional-labor<br>_Kimono as borrowed status; beauty masking exhaustion and debt._ | type **T03** · function **III**<br>archetype: dancer-s-pointe-shoes (0.62)<br>themes: anxiety-of-status, emotional-labor, social-climbing<br>_Kimono as costly performance of status Keiko must maintain_ |

### The Telephone Network
*Spies · 1928*  

> Throughout Spies, telephones, telegraph keys, and radio sets connect characters across rooms and cities. Orders, betrayals, and warnings travel down wires while bodies stay separated.

kNN archetypes — The Misplaced Phone(0.49), The Bridge of Spies(0.46), The Informant's Whisper(0.44), The Informant's Whisper(0.44), The Coded Message(0.42)
  · themes — Secrecy(0.40), Technological Isolation(0.35), The Screen (Mediated Life)(0.35), Treachery(0.34)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| **abstain**<br>themes: secrecy, conspiracy, treachery<br>_System/infrastructure, not singular touchable prop. Thematic only._ | **abstain**<br>themes: secrecy, treachery, conspiracy<br>_Telephone network is a motif/system, not a single touchable prop_ |

### Extremis (the glowing soldiers) ★
*Iron Man 3 · 2013*  

> In Iron Man 3, Killian's bio-tech makes wounded veterans regenerate limbs and superheat their bodies to molten orange, but unstable subjects overload and explode, mistaken for terrorist bombings.

kNN archetypes — The Body as a Weapon(0.34), The Hitman's Code(0.33), The Villain's Scar(0.33), The Charred Remains(0.32), The Human Shield(0.32)
  · themes — Rage(0.32), Irony (Ironic Reversal)(0.31), Dramatic Irony(0.31), The Catalyst (Inciting Force)(0.31)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| **abstain**<br>themes: —<br>_Extremis soldiers are transformed people/creatures, not touchable props_ | type **T14** · function **IV**<br>archetype: body-as-a-weapon (0.72)<br>themes: cyborg-condition, irony-ironic-reversal, catalyst-inciting-force<br>_Bio-modified bodies weaponized, exploding—flesh as fate/consequence_ |

### The spinning house
*Long Day's Journey Into Night · 2018*  

> In Long Day's Journey Into Night's dream half, Luo and Kaizhen sit inside a small house that begins to rotate and lift, spinning gently as if airborne while they remain still inside.

kNN archetypes — The Shared Dreamscape(0.41), The Childhood Nightlight(0.39), The Microcosm of Existence (e.g., Lifeboat)(0.38), The Empty Swing Set(0.38), The Architectural Paradox(0.37)
  · themes — Dream Logic (Oneiric)(0.37), Longing(0.35), Confinement(0.34), The Imaginary(0.34)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| type **T18** · function **VI**<br>archetype: shared-dreamscape (0.72)<br>themes: dream-logic-oneiric, longing, duration-aesthetics-of-slow-cinema<br>_Rotating house externalizes intimate dreamspace; defies physics; couples suspended in weightless communion_ | type **T18** · function **VI**<br>archetype: shared-dreamscape (0.72)<br>themes: dream-logic-oneiric, longing, imaginary<br>_Spinning house is a physical dreamspace enabling impossible shared intimacy_ |

### The pink letter ★
*Broken Flowers · 2005*  

> In Broken Flowers, an unsigned pink envelope announces Don has a grown son who may be searching for him. Its color becomes the clue Don chases through every house he visits.

kNN archetypes — The Orphan's Locket(0.39), The Unsent Letter(0.39), Rosebud(0.39), The Message in a Bottle(0.38), The Father's Watch(0.37)
  · themes — Paternity(0.33), Coming of Age(0.31), Longing(0.30), The Family Secret(0.30)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| type **T05** · function **IV**<br>archetype: unsent-letter (0.72)<br>themes: paternity, family-secret, abandonment<br>_Unsigned letter triggers Don's quest; sealed past, undelivered confession._ | type **T05** · function **IV**<br>archetype: message-in-a-bottle (0.55)<br>themes: paternity, family-secret, longing<br>_Anonymous pink letter triggers Don's quest for unknown son_ |

### The Zoltar Speaks arcade machine ★
*Big · 1988*  

> In Big, the Zoltar Speaks machine is a fortune-telling arcade cabinet with an animatronic turbaned figure behind glass. Josh inserts a coin, wishes to be big, and the unplugged machine lights up and dispenses a card granting the wish.

kNN archetypes — The Cursed Amulet(0.41), The Gambler's Last Chip(0.38), The Winning Lottery(0.37), The Loaded Dice(0.36), The Blank Check(0.36)
  · themes — Speculation(0.32), The Trickster Energy(0.30), The Synthetic Mind (Artificial Intelligence)(0.30), The Mask (Persona)(0.29)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| type **T07** · function **IV**<br>archetype: winning-lottery (0.72)<br>themes: speculation, superstition, synthetic-mind-artificial-intelligence<br>_Machine dispenses wish-granting card; externalized fate via chance. Supernatural leverage._ | type **T00** · function **IV**<br>archetype: cursed-amulet (0.62)<br>themes: trickster-energy, superstition<br>_Wish-granting machine that supernaturally alters Josh's fate_ |

### The empty desk and the unfinished page ★
*Look Back · 2024*  

> Late in Look Back, after the tragedy, Fujino sits at her desk unable to draw, and the film stages an imagined alternate timeline through a four-panel strip slid under a door that never opens to grief.

kNN archetypes — The Courtroom Sketch(0.46), The Broken Clock(0.44), The Cold Case File(0.43), The Suicide Note(0.43), The Frame of Observation (Window)(0.43)
  · themes — Grief(0.45), Closure (Lack of)(0.42), Externalization (Objective Correlative)(0.39), Alternate Realities/Timelines(0.38)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| **abstain**<br>themes: grief, closure-lack-of, alternate-realities-timelines<br>_Desk & page are setting/absence, not perceptible dramatic object._ | type **T04** · function **V**<br>archetype: broken-clock (0.52)<br>themes: grief, closure-lack-of, externalization-objective-correlative<br>_Empty desk/unfinished page externalizes frozen grief after loss_ |

### The Bruegel paintings in the library ★
*Solaris · 1972*  

> In Solaris, the station's library holds reproductions of Bruegel's seasonal landscapes, including Hunters in the Snow. The camera drifts across their wintry detail while Hari watches.

kNN archetypes — The Haunted Painting(0.32), The Stalker's Photograph(0.31), The Obsessive Surveillance Camera(0.31), The Frame of Observation (Window)(0.30), The Faded Photograph(0.29)
  · themes — Solastalgia (Climate Grief)(0.30), Simulacra and Simulation(0.29), The Psychological Landscape(0.28), The Spectacle(0.26)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| type **T06** · function **V**<br>archetype: frame-of-observation-window (0.72)<br>themes: psychological-landscape, simulastalgia-climate-grief<br>_Bruegel's wintry landscapes function as windows into a vanished Earth—watched by Hari with longing and loss._ | type **T06** · function **V**<br>archetype: haunted-painting (0.52)<br>themes: psychological-landscape, simulacra-and-simulation, solastalgia-climate-grief<br>_Paintings anchor Earth memory and longing aboard alien station_ |

### Bruno's glockenspiel and accordion
*Stroszek · 1977*  

> In Stroszek, Bruno earns coins as a street musician, lugging a glockenspiel and accordion; the instruments accompany him from a Berlin courtyard to America and surface in his final wanderings.

kNN archetypes — The Safe-Cracker's Tools(0.32), The Unfinished Symphony(0.32), The Smuggler's Bribe(0.32), The Banjo as a Weapon of Torment(0.32), The Watch as a Bargaining Chip(0.30)
  · themes — Artistic Struggle (Ego/Integrity)(0.27), Bourgeois Anxiety/Hypocrisy(0.25), Stigma(0.25), Instrumentalization(0.25)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| type **T22** · function **V**<br>archetype: _(tiers only)_<br>themes: artistic-struggle-ego-integrity, artifice-vs-authenticity<br>_Street musician's instruments; memory & trauma of wandering displacement across continents_ | type **T22** · function **III**<br>archetype: _(tiers only)_<br>themes: artistic-struggle-ego-integrity, stigma<br>_Instruments mark Bruno's identity as marginal street musician throughout_ |

### The microphone
*The King's Speech · 2010*  

> In The King's Speech the broadcast microphone recurs as a dreaded instrument — a black-meshed BBC apparatus the camera frames in cold close-up before each public ordeal, beginning at Wembley.

kNN archetypes — The Charismatic Leader's Microphone(0.45), The Hidden Microphone(0.43), The Clandestine Radio Broadcast(0.39), The Confessional's Screen(0.38), The Obsessive Surveillance Camera(0.38)
  · themes — Exposure(0.31), Remediation(0.30), The Screen (Mediated Life)(0.29), Silence (As Oppression/Substance)(0.29)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| type **T07** · function **II**<br>archetype: charismatic-leader-s-microphone (0.62)<br>themes: exposure, communication-breakdown, silence-as-oppression-substance<br>_Microphone amplifies the King's voice but becomes instrument of public exposure and control. His stammer resists amplification._ | type **T17** · function **IV**<br>archetype: charismatic-leader-s-microphone (0.52)<br>themes: exposure, silence-as-oppression-substance, communication-breakdown<br>_BBC mic is the dreaded instrument of public ordeal and fate_ |
