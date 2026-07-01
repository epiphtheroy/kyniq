# Catalog mapping — DRY comparison

Sample: **16** `location` figures · candidates 8 archetypes + 6 themes · models claude-haiku-4-5, claude-sonnet-4-6

## Cost (measured on this sample, real-time)

| Model | uncached in | cache write | cache read | output | sample $ | $/figure |
|---|--:|--:|--:|--:|--:|--:|
| claude-haiku-4-5 | 28,230 | 0 | 0 | 1,802 | $0.0372 | $0.00232 |
| claude-sonnet-4-6 | 28,246 | 0 | 0 | 1,326 | $0.1046 | $0.00653 |

_$/figure = steady-state (cached prefix + variable input + output), the cost that scales._

## Full-run projection (steady-state $/figure × population)

Batch API = 50% off. Caching already folded into $/figure.

| Scope | figures | haiku real-time | sonnet real-time | haiku batch | sonnet batch |
|---|--:|--:|--:|--:|--:|
| Objects | 1,777 | $4.13 | $11.59 | $2.06 | $5.80 |
| Characters | 3,100 | $7.20 | $20.23 | $3.60 | $10.11 |
| Locations | 1,849 | $4.30 | $12.06 | $2.15 | $6.03 |
| Objects+Characters+Locations | 6,726 | $15.63 | $43.89 | $7.82 | $21.94 |
| + Film themes | 8,660 | $20.13 | $56.51 | $10.06 | $28.25 |
| Everything (all kinds) | 18,168 | $42.22 | $118.55 | $21.11 | $59.27 |

## Results — 1/16 divergent (★)

### Madame Tellier's brothel and the country church
*Le Plaisir · 1952*  

> In Le Plaisir's central tale, the closed brothel of Madame Tellier and the rural church where her girls weep at a First Communion are cut against each other as two houses of feeling.

kNN archetypes — The Small-Town Church/Chapel(0.41), The Gossipy Courtyard(0.38), The Gingerbread House(0.37), The Strip Club(0.36), The Bartender's Station(0.36)
  · themes — Domestic Entrapment(0.42), Bourgeois Anxiety/Hypocrisy(0.40), Pleasure(0.38), Temptation(0.38)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| category **III** · type **11**<br>archetype: small-town-church-chapel (0.52)<br>themes: bourgeois-anxiety-hypocrisy, pleasure<br>_Dual spaces—brothel and church—mirror each other as sites of feeling, emotion, and moral contradiction._ | category **VI** · type **33**<br>archetype: small-town-church-chapel (0.52)<br>themes: bourgeois-anxiety-hypocrisy, pleasure, jouissance-painful-pleasure<br>_Two contrasting sacred/profane houses of feeling and ritual_ |

### The taiga
*Dersu Uzala · 1975*  

> The vast Siberian forest and frozen plain of Dersu Uzala, photographed in long horizontal shots where human figures shrink to dots beneath an enormous indifferent sky and endless trees.

kNN archetypes — The Taiga / Boreal Forest(0.52), The Winter Forest(0.50), The Primal Forest(0.47), The Salt Flats(0.43), The Petrified Forest(0.42)
  · themes — The Wilderness(0.42), The Psychological Landscape(0.38), Drift (Aimlessness)(0.33), Duration (Aesthetics of/Slow Cinema)(0.33)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| category **II** · type **6**<br>archetype: taiga-boreal-forest (0.92)<br>themes: wilderness, psychological-landscape, duration-aesthetics-of-slow-cinema<br>_The taiga is the film's central spatial protagonist—indifferent, vast, filmed in long horizontals dwarfing humans._ | category **II** · type **6**<br>archetype: taiga-boreal-forest (0.93)<br>themes: wilderness, psychological-landscape, duration-aesthetics-of-slow-cinema<br>_Vast Siberian boreal forest as sublime, indifferent natural world_ |

### The bus station and ticket counter
*The Circle · 2000*  

> In The Circle, the crowded Tehran bus terminal is where women try and fail to buy passage, blocked by demands for a male guardian's identification before they can travel.

kNN archetypes — The Refugee Transit Center(0.39), The Security Checkpoint(0.38), The Crowded Departures Board(0.38), The Bustling International Airport(0.37), The Grimy Bus Depot(0.36)
  · themes — Intimacy (Barriers to)(0.29), Social Climbing(0.28), Border Crossing(0.28), The Gaze (Male/Patriarchal)(0.27)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| category **V** · type **24**<br>archetype: grimy-bus-depot (0.72)<br>themes: gaze-male-patriarchal, border-crossing, sisterhood<br>_Transit hub where state/patriarchy blocks women's movement. Institutional control over passage._ | category **V** · type **24**<br>archetype: grimy-bus-depot (0.82)<br>themes: border-crossing, gaze-male-patriarchal, sisterhood<br>_Bus terminal as site of gendered gatekeeping and blocked movement_ |

### The blasphemous finale at the chateau
*L'Age d'Or · 1930*  

> L'Age d'Or closes at the Chateau de Selliny, where survivors of a 120-day orgy emerge; the lead libertine is unmistakably styled as Jesus Christ, who escorts a girl back inside before her offscreen scream.

kNN archetypes — The Grand Old Movie Palace(0.36), The Isolated Grand Hotel(0.32), The Vampire's Lair(0.32), The Wellness Retreat / Spa(0.31), The Decadent/Cruel Garden(0.31)
  · themes — Eroticism(0.35), Decadence(0.35), The Carnivalesque (The Grotesque)(0.32), Obscenity(0.31)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| category **III** · type **13**<br>archetype: decadent-cruel-garden (0.62)<br>themes: eroticism, obscenity, carnivalesque-the-grotesque<br>_Chateau as site of libertine excess; blasphemous ritual space; appetite without limit._ | category **XIII** · type **13**<br>archetype: decadent-cruel-garden (0.55)<br>themes: eroticism, decadence, obscenity<br>_Chateau de Selliny: site of libertine orgy, blasphemous excess_ |

### The Yule Ball
*Harry Potter and the Goblet of Fire · 2005*  

> In Harry Potter and the Goblet of Fire, a candlelit winter dance at Hogwarts where students pair off in formal robes; the trio's anxieties about partners erupt into the film's first real romantic friction.

kNN archetypes — The Dance Floor(0.36), The Grand Ballroom(0.36), The Winter Forest(0.34), The Magical School(0.34), The Magical Glade / Clearing(0.31)
  · themes — Love (Reciprocal)(0.32), Sibling Rivalry(0.32), Friendship(0.31), Love (Transactional)(0.31)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| category **VI** · type **27**<br>archetype: grand-ballroom (0.72)<br>themes: love-reciprocal, friendship<br>_Formal dance event; society performance; romantic tension among peers._ | category **VI** · type **33**<br>archetype: grand-ballroom (0.72)<br>themes: love-reciprocal, friendship<br>_Formal dance event; ritual space of romance and social tension_ |

### The Monastery
*The Color of Pomegranates · 1969*  

> In The Color of Pomegranates the poet withdraws to a monastery, its courtyards and stone arches the setting for chapters of liturgy, books drying in the sun, and ritual labor.

kNN archetypes — The Monastery/Convent(0.56), The Grand Cathedral/Temple(0.42), The Graveyard/Cemetery(0.38), The Zen Garden(0.38), The Farmhouse(0.37)
  · themes — Mourning(0.34), Ritual (Dysfunctional/Empty)(0.33), Poverty (Aesthetics of)(0.32), Catharsis(0.32)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| category **IV** · type **33**<br>archetype: monastery-convent (0.92)<br>themes: sacred-and-the-profane, artistic-obsession, catharsis<br>_Stone courtyards, liturgy, ritual labor. Parajanov's visual poem on withdrawal and spiritual discipline._ | category **VI** · type **33**<br>archetype: monastery-convent (0.95)<br>themes: sacred-and-the-profane, ritual-dysfunctional-empty<br>_Stone cloisters, liturgy, ritual labor — classic monastery setting_ |

### The setting of the suburban home on Revolutionary Road
*Revolutionary Road · 2008*  

> In Revolutionary Road, the Wheelers' white clapboard house sits on a quiet tree-lined street of the same name. Interiors are clean, well-furnished and frequently shot in symmetrical, doorway-framed compositions; the picture window looks ont…

kNN archetypes — The Picture Window(0.45), The Crossroads(0.40), The Main Street of a Small Town(0.40), The Idyllic Country House(0.40), The Rideshare Car Interior(0.39)
  · themes — Revolution (Failed)(0.34), Gentrification(0.33), The Everyday (The Quotidian)(0.33), Bourgeois Anxiety/Hypocrisy(0.33)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| category **III** · type **5**<br>archetype: perfect-cul-de-sac (0.72)<br>themes: bourgeois-anxiety-hypocrisy, domestic-entrapment, revolution-failed<br>_Suburban home embodying aspiration and control; archetype captures safety-zoned perfection concealing dysfunction._ | category **III** · type **11**<br>archetype: perfect-cul-de-sac (0.72)<br>themes: domestic-entrapment, bourgeois-anxiety-hypocrisy, revolution-failed<br>_Suburban home as gilded cage trapping the Wheelers' aspirations_ |

### The Thunderdome
*Mad Max Beyond Thunderdome · 1985*  

> A domed cage of welded steel where disputes in Mad Max Beyond Thunderdome are settled by combat. Fighters are harnessed on bungee cords; the crowd chants the rules. "Two men enter, one man leaves."

kNN archetypes — The Gladiator Prison(0.52), The Secret Deathmatch Arena(0.51), The Roman Colosseum / Gladiator Arena(0.50), The E-sports Arena(0.45), The Modern Sports Stadium(0.45)
  · themes — Rationalization (The Iron Cage)(0.36), Chaos vs. Order(0.36), Rage(0.33), Primal Conflict(0.32)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| category **VI** · type **28**<br>archetype: roman-colosseum-gladiator-arena (0.92)<br>themes: primal-conflict, mob-mentality, chaos-vs-order<br>_Domed gladiatorial combat arena; spectacle and ritual bloodsport under tribal law._ | category **VI** · type **28**<br>archetype: roman-colosseum-gladiator-arena (0.82)<br>themes: primal-conflict, mob-mentality, chaos-vs-order<br>_Iconic combat arena; crowd-ruled spectacle in post-apocalyptic setting_ |

### The 'Night Owls' studio set
*Late Night with the Devil · 2024*  

> In Late Night with the Devil, the warm-toned talk-show stage with its desk, guest couch, painted city-skyline backdrop, and applause signs — a manufactured intimacy that becomes a sealed arena once the doors are figuratively locked.

kNN archetypes — The Empty Auditorium(0.51), The Stage(0.50), The Backstage/Dressing Rooms(0.48), The Strip Club(0.47), The Vaudeville/Burlesque House(0.46)
  · themes — Intimacy (Toxic)(0.39), Theatricality(0.38), Domestic Entrapment(0.37), Home (The Unhomely)(0.37)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| category **VI** · type **27**<br>archetype: stage (0.92)<br>themes: theatricality, intimacy-toxic<br>_Talk-show studio as performative stage; manufactured warmth masks sealed arena and danger._ | category **VI** · type **27**<br>archetype: stage (0.82)<br>themes: theatricality, home-the-unhomely, intimacy-toxic<br>_Talk-show stage: manufactured performance space turned horror arena_ |

### the Lyme Regis shoreline
*Ammonite · 2020*  

> The cold, grey, wind-scoured beach and cliffs of Ammonite, where Mary works in mud and surf, shot in muted slate tones with constant offscreen sound of waves and gulls.

kNN archetypes — The Rocky Coastline(0.48), The Beach House(0.45), The Foggy Harbor(0.43), The Stormy Seas(0.42), The Shifting Sand Dunes(0.41)
  · themes — Sensoriality(0.33), Externalization (Objective Correlative)(0.33), Maternal Ambivalence(0.32), Objectification(0.31)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| category **II** · type **8**<br>archetype: rocky-coastline (0.92)<br>themes: sensoriality, externalization-objective-correlative, psychological-landscape<br>_Cold shoreline embodies collision; visceral sensory register; mirrors Mary's internal isolation._ | category **II** · type **8**<br>archetype: rocky-coastline (0.82)<br>themes: externalization-objective-correlative, sensoriality, psychological-landscape<br>_Cold scoured shoreline externalizes Mary's isolation and repressed longing_ |

### Oozma Kappa house
*Monsters University · 2013*  

> The fraternity of misfits in Monsters University — older students, oddballs, and rejects who take in Mike and Sulley when no other house will, run out of a cozy domestic home with a den mother.

kNN archetypes — The Sinister Orphanage(0.43), The Locker Room(0.39), The Secret Society Clubhouse(0.38), The Gang's Crash Pad(0.36), The Cabin in the Woods(0.36)
  · themes — Home (The Unhomely)(0.37), Outsiderhood(0.33), The Uncanny (Das Unheimliche)(0.33), Found Kinship(0.32)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| category **III** · type **11**<br>archetype: gang-s-crash-pad (0.72)<br>themes: found-kinship, outsiderhood, belonging<br>_Makeshift fraternity home; misfits as family; loyalty and refuge._ | category **III** · type **11**<br>archetype: gang-s-crash-pad (0.72)<br>themes: outsiderhood, found-kinship, belonging<br>_Domestic home housing misfit fraternity; found-family crash pad_ |

### The carnival sharpshooting act ★
*Gun Crazy · 1950*  

> In Gun Crazy the traveling carnival is where Bart meets Annie performing as a trick-shooter; the owner Packett lusts after her, and the act stages their courtship as public spectacle before they flee.

kNN archetypes — The Midway/Carnival Games(0.48), The Shoddy/Dangerous Carnival(0.45), The Sinister Circus/Freak Show(0.44), The Bustling Casino Floor(0.38), The Sin City(0.36)
  · themes — Camp Sensibility(0.31), Domestic Entrapment(0.29), Impulse(0.28), Borderlands (Hybrid Spaces)(0.28)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| category **VI** · type **29**<br>archetype: midway-carnival-games (0.62)<br>themes: impulse, cruel-optimism<br>_Carnival sharpshooting act: spectacle-stage for desire, courtship as public con._ | category **VI** · type **29**<br>archetype: shoddy-dangerous-carnival (0.55)<br>themes: impulse, borderlands-hybrid-spaces<br>_Traveling carnival act as public spectacle masking dangerous desire._ |

### The final swamp
*Gun Crazy · 1950*  

> Gun Crazy ends in fog-bound marshland where Bart and Annie, cornered by pursuers including Bart's childhood friends, make their last stand and die together in the mist.

kNN archetypes — The Last Outpost / Fort(0.35), The Oasis(0.35), The Secret Bunker / Fallout Shelter(0.35), The Post-Apocalyptic Shelter(0.34), The Grimy Dive Bar(0.34)
  · themes — Suicide(0.33), Martyrdom(0.31), Self-Destruction(0.30), Survival(0.30)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| category **II** · type **7**<br>archetype: _(tiers only)_<br>themes: self-destruction, martyrdom, survival<br>_Wasteland final stand; no archetype fits the swamp's role as natural death-trap._ | category **II** · type **6**<br>archetype: _(tiers only)_<br>themes: self-destruction, martyrdom<br>_Fog-bound marshland as doomed lovers' final resting place_ |

### The mass grave
*20 Days in Mariupol · 2023*  

> In 20 Days in Mariupol, a long trench where black body bags are tipped in by workers, numbers scrawled on the plastic, becomes the city's improvised cemetery.

kNN archetypes — The Graveyard/Cemetery(0.40), The Catacombs / Crypts(0.39), The Boneyard / Graveyard(0.38), The Political Gulag / Labor Camp(0.38), The Refugee Camp(0.37)
  · themes — Mourning(0.29), Waste(0.28), Urban Alienation(0.27), Grief(0.25)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| category **IV** · type **33**<br>archetype: graveyard-cemetery (0.92)<br>themes: mourning, grief, waste<br>_Mass grave is a place of ritual death-processing; improvised cemetery despite war context._ | category **VI** · type **33**<br>archetype: graveyard-cemetery (0.72)<br>themes: mourning, grief<br>_Improvised mass grave: wartime cemetery, mourning and grief central_ |

### The transition from the structured life on the yacht to the lawless state on the island
*Triangle of Sadness · 2022*  

> In Triangle of Sadness, the rigid yacht order — uniformed crew, paying guests, strict hierarchy — collapses into pirate attack and shipwreck, after which the survivors wash up on an island with no roles, no money, and no rules.

kNN archetypes — The Private Island(0.45), The Luxury Cruise Ship(0.45), The Migrant Boat / Dinghy(0.44), The Zone of Anomalies(0.44), The Shipwreck Graveyard(0.43)
  · themes — Tyranny(0.41), Chaos vs. Order(0.38), Absent Authority(0.38), Irony (Ironic Reversal)(0.38)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| **abstain**<br>themes: chaos-vs-order, inversion, absent-authority<br>_Figure is a narrative arc/transition, not a physical location. Themes apply to film's thematic content._ | **abstain**<br>themes: chaos-vs-order, inversion, irony-ironic-reversal<br>_Describes a narrative transition/event, not a physical place_ |

### The Pool Hall (1966)
*Three Times · 2005*  

> In Three Times, the first segment unfolds largely in a small-town billiard parlour where a hostess (Shu Qi) works and a soldier (Chang Chen) returns to find her. Pop ballads play on the jukebox.

kNN archetypes — The Karaoke Room / Noraebang(0.36), The Hotel Bar(0.36), The Small-Town Cinema(0.35), The Internet Cafe / PC Bang(0.35), The All-Night Convenience Store(0.33)
  · themes — Transience(0.31), The Everyday (The Quotidian)(0.30), Love (Reciprocal)(0.29), The Screen (Mediated Life)(0.28)

| haiku-4-5 | sonnet-4-6 |
|---|---|
| category **VI** · type **31**<br>archetype: _(tiers only)_<br>themes: transience, homecoming, love-reciprocal<br>_Pool hall is a public gathering space; none of the candidates perfectly capture it._ | category **VI** · type **31**<br>archetype: _(tiers only)_<br>themes: transience, love-reciprocal, homecoming<br>_Small-town billiard hall bar; soldier returns seeking hostess_ |
