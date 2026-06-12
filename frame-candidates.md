# Frame discovery report (IA §8-1)

Questions analysed: **133** · method: **LLM bottom-up grouping** (primary) + embedding graph components (cross-check)

Pairwise similarity distribution (openai text-embedding-3-small): `{'p10': 0.1489, 'p50': 0.2407, 'p90': 0.3614, 'p95': 0.4025, 'p97': 0.4302, 'p99': 0.4881, 'max': 0.7274}`

## Embedding cross-check (graph components)

| θ | components | multi-member | singletons | largest | covered |
|---|---|---|---|---|---|
| 0.45 | 35 | 8 | 27 | 89 | 106/133 |
| 0.5 | 88 | 18 | 70 | 14 | 63/133 |
| 0.55 | 110 | 12 | 98 | 10 | 35/133 |

## Frame candidates (LLM grouping)

### 1. What is the symbolic meaning of this motif?  —  13 instances
- **dimension:** symbol-or-motif · **slug:** `symbolic-motif`
- **definition:** This frame investigates the thematic significance of recurring objects, sounds, or visual motifs throughout a film. Audiences seek to decode these symbols to uncover the underlying subtext and thematic layers of the narrative.
- **slots:** motif_type (physical object, recurring sound, color palette, sensory detail)
- **members:**
  - [Parasite (2019)] What is the significance of the Jessica, Only Child, Illinois, Chicago jingle?
  - [Pulp Fiction (1994)] What is actually inside Marsellus Wallace's briefcase?
  - [Burning (2018)] Why does the camera focus so intently on the reflection of the N Seoul Tower in Hae-mi's tiny room, and what does that light symbolize?
  - [Whiplash (2014)] What is the significance of the blood on the drums and the ice water?
  - [The Godfather (1972)] What is the significance of the oranges that appear throughout the film?
  - [Stalker (1979)] What is the meaning of all the running water and submerged objects in the Zone?
  - [2001: A Space Odyssey (1968)] What is the meaning of the monolith's perfect 1:4:9 dimensions and its pitch-black color?
  - [The Lord of the Rings: The Fellowship of the Ring (2001)] What is the meaning of the creepy whispering sound that plays whenever the Ring is on screen?
  - [The Green Mile (1999)] What is the symbolic meaning of the wet sponge during the executions?
  - [The Shawshank Redemption (1994)] What is the significance of the rocks Andy polishes and carves?
  - [Fight Club (1999)] What is the significance of the pink soap?
  - [The Green Mile (1999)] What is the thematic significance of the green linoleum floor in the prison?
  - [Forrest Gump (1994)] What is the deeper meaning behind the floating feather that appears at the very beginning and end of the film?

### 2. How does the film's technical style build its atmosphere?  —  12 instances
- **dimension:** craft-choice · **slug:** `technical-style-and-atmosphere`
- **definition:** This frame explores how specific choices in cinematography, editing, sound design, or visual effects create a distinct mood or psychological state. Audiences ask this to connect the technical craft of filmmaking directly to their emotional experience of the movie.
- **slots:** technical_element (cross-cutting, claustrophobic framing, harsh lighting, sound design, extreme wide shots)
- **members:**
  - [The Dark Knight (2008)] Why does the police interrogation scene feel so uniquely intense and claustrophobic?
  - [The Dark Knight (2008)] How does Christopher Nolan's signature cross-cutting technique build narrative momentum in the film's second act?
  - [Burning (2018)] How does the film's atmospheric sound design and music score by Mowg build the movie's unique sense of dread?
  - [Whiplash (2014)] How does the film's editing mimic the rhythm of a jazz performance?
  - [The Godfather (1972)] How does Gordon Willis's cinematography use darkness and shadow to construct the film's moral universe?
  - [Persona (1966)] Why does Sven Nykvist use such harsh, high-contrast lighting on their faces?
  - [2001: A Space Odyssey (1968)] The silence in the space scenes is so striking—is that just scientific accuracy or is Kubrick doing something deeper?
  - [The Lord of the Rings: The Fellowship of the Ring (2001)] Why does Peter Jackson use so many horror-movie techniques in a fantasy epic?
  - [Fight Club (1999)] Why does the camera move through solid objects and kitchen cabinets in those early scenes?
  - [The Shawshank Redemption (1994)] Why does the camera slowly zoom in on Red's face during his final parole hearing compared to his first two?
  - [Forrest Gump (1994)] Why does Zemeckis use CGI to insert Forrest into historical archival footage instead of just using actors to play those historical figures?
  - [2001: A Space Odyssey (1968)] Why does Kubrick use so many extreme wide shots and slow, tracking camera movements instead of close-ups?

### 3. How does the film subvert genre tropes?  —  10 instances
- **dimension:** craft-choice · **slug:** `genre-subversion`
- **definition:** This frame analyzes how a film intentionally deconstructs, reverses, or plays with established conventions of its specific genre. Viewers ask this to appreciate the film's originality and how it challenges audience expectations.
- **slots:** subverted_trope (the evil authority figure, the buddy dynamic, the heroic journey, the traditional home invasion)
- **members:**
  - [Parasite (2019)] How does Parasite subvert the traditional home invasion thriller?
  - [Pulp Fiction (1994)] How does Pulp Fiction subvert the classic hardboiled noir tropes of the 1940s?
  - [Whiplash (2014)] How does Whiplash subvert the classic mentor-student sports movie formula?
  - [Mulholland Drive (2001)] How does the film subvert the traditional tropes of Film Noir?
  - [Stalker (1979)] How does Stalker subvert the traditional science fiction tropes of its era?
  - [Persona (1966)] How does Persona subvert the typical identity theft or psychological double thriller?
  - [The Green Mile (1999)] How does the film subvert the traditional 'evil prison guard' trope?
  - [Fight Club (1999)] How does the film subvert the typical "buddy movie" dynamic?
  - [The Shawshank Redemption (1994)] How does Shawshank subvert the typical prison break movie formula?
  - [Forrest Gump (1994)] How does the film subvert the traditional tropes of the historical epic?

### 4. Why did they make that self-destructive choice?  —  9 instances
- **dimension:** character-motive-or-fate · **slug:** `self-destructive-choice`
- **definition:** This frame explores the psychological motivations behind a character's highly risky, irrational, or self-sabotaging decisions. Audiences ask this to understand the deeper emotional logic or tragic flaws driving a character's actions.
- **slots:** motivation_type (pride, obsession, guilt, loyalty, existential despair)
- **members:**
  - [Pulp Fiction (1994)] Why does Butch go back for his father's gold watch if it's so dangerous?
  - [Whiplash (2014)] Why did Andrew break up with Nicole so coldly?
  - [The Godfather (1972)] Why does Michael take over the family business when he spent his whole life trying to escape it?
  - [The Godfather (1972)] Why did Tessio betray the Corleone family instead of Clemenza, and how did Michael know it was him?
  - [Mulholland Drive (2001)] Why does Diane Selwyn kill herself at the end?
  - [The Green Mile (1999)] Why did John Coffey choose to die when Paul offered him a way out?
  - [Forrest Gump (1994)] Why does Jenny keep running away from Forrest when he is the only person who truly loves her?
  - [The Lord of the Rings: The Fellowship of the Ring (2001)] Why does Frodo decide to go to Mordor alone at the end?
  - [The Shawshank Redemption (1994)] Why does Andy play the Mozart opera over the prison loudspeakers, knowing he will get solitary confinement?

### 5. How does this apparent plot hole make sense?  —  8 instances
- **dimension:** contested-point · **slug:** `plot-hole-explanation`
- **definition:** This frame addresses logical gaps, highly complex schemes, or seemingly impossible events within the narrative. Viewers ask this to reconcile their suspension of disbelief and find logical explanations within the established rules of the film's world.
- **slots:** explanation_type (character oversight, unseen preparation, thematic logic over realism, unreliable narration)
- **members:**
  - [Parasite (2019)] Why didn't the Parks notice that their new servants were all related?
  - [The Dark Knight (2008)] How does the Joker's incredibly complex plan actually work without relying on impossible luck?
  - [Whiplash (2014)] How did Andrew lose the folder of sheet music, and was it a setup?
  - [The Lord of the Rings: The Fellowship of the Ring (2001)] Why didn't they just use the Great Eagles to fly the Ring to Mount Doom?
  - [Fight Club (1999)] How did one guy manage to set up a nationwide terrorist network in his sleep?
  - [The Shawshank Redemption (1994)] Why did Andy wait nineteen years to escape if he had the chisel the whole time?
  - [Forrest Gump (1994)] How does the timeline of Forrest's run across America actually make sense, and what finally makes him stop?
  - [The Shawshank Redemption (1994)] How did Andy put the poster back up over his tunnel after escaping?

### 6. What is the meaning of this surreal or abstract scene?  —  8 instances
- **dimension:** central-ambiguity · **slug:** `surreal-or-abstract-scene`
- **definition:** This frame analyzes highly abstract, bizarre, or dreamlike sequences that disrupt the realistic flow of the narrative. Viewers ask this to decode the psychological, symbolic, or foreshadowing significance of these surreal moments.
- **slots:** scene_function (psychological projection, foreshadowing, metacinematic commentary, thematic abstraction)
- **members:**
  - [Parasite (2019)] How does the ghost story about the basement foreshadow the film's second-half twist?
  - [Mulholland Drive (2001)] Who is the terrifying figure behind Winkie's diner?
  - [Mulholland Drive (2001)] Who is the Cowboy, and why does he show up to threaten Adam Kesher?
  - [Stalker (1979)] What does the final scene with Monkey moving the glasses with her mind actually mean?
  - [Persona (1966)] What is the meaning of the boy touching the giant blurry face at the beginning and end?
  - [Persona (1966)] What is up with the movie screen literally ripping and burning in the middle of the film?
  - [The Lord of the Rings: The Fellowship of the Ring (2001)] Why does Bilbo have that terrifying monster-face reaction in Rivendell?
  - [Persona (1966)] Why does Bergman repeat the exact same monologue about Elisabeth's unwanted pregnancy twice?

### 7. Is this character actually the villain?  —  7 instances
- **dimension:** contested-point · **slug:** `character-morality`
- **definition:** This frame questions the moral alignment of a central character, debating whether they are truly heroic or secretly the antagonist of their own story. Viewers ask this to grapple with complex moral ambiguity and challenge simple hero-versus-villain binaries.
- **slots:** moral_status (secret antagonist, tragic anti-hero, misunderstood victim, ideological extremist)
- **members:**
  - [Parasite (2019)] Is the film arguing that the Kim family are actually the villains of the story?
  - [The Dark Knight (2008)] Is Batman actually the true source of Gotham's misery, rather than its savior?
  - [Burning (2018)] Is it possible that Ben is completely innocent and Jong-su is merely projecting his own class rage and jealousy onto him?
  - [Whiplash (2014)] Is Terence Fletcher actually a fraud whose methods don't work?
  - [The Godfather (1972)] Is Vito Corleone truly a man of honor, or is his paternalistic benevolence just a myth?
  - [The Lord of the Rings: The Fellowship of the Ring (2001)] Is Boromir actually a villain, or is he just a scapegoat for the plot?
  - [The Green Mile (1999)] Is John Coffey just a 'Magical Negro' trope designed to soothe white guilt?

### 8. Is the ending real or a fantasy?  —  6 instances
- **dimension:** ending · **slug:** `is-the-ending-real`
- **definition:** This frame examines whether the final sequence of a film depicts actual narrative events or is merely a dream, hallucination, or projection of a character's desires. Viewers return to this question to resolve the emotional and narrative closure of ambiguous stories.
- **slots:** reality_status (literal reality, dream sequence, post-mortem hallucination, character's written fiction)
- **members:**
  - [Burning (2018)] Is the final scene where Jong-su kills Ben real, or is it just a scene from the novel Jong-su is writing?
  - [Mulholland Drive (2001)] What is the actual timeline of events, and when does the dream end?
  - [Persona (1966)] What actually happened at the end? Did they swap places or what?
  - [2001: A Space Odyssey (1968)] What actually happened at the end? What is the Star Child?
  - [Fight Club (1999)] What actually happened in the final scene when he shoots himself?
  - [The Shawshank Redemption (1994)] Isn't the ending on the beach at Zihuatanejo just a cheap, sentimental fantasy?

### 9. Does the film endorse its controversial message?  —  6 instances
- **dimension:** central-provocation · **slug:** `ideological-message`
- **definition:** This frame debates whether a film's depiction of extreme philosophies, political ethics, or controversial behaviors constitutes an endorsement or a critique. Viewers ask this to unpack the film's ideological stance and its real-world social implications.
- **slots:** ideological_stance (satirical critique, sincere endorsement, neutral exploration, deconstructive warning)
- **members:**
  - [The Dark Knight (2008)] How does the film use the concept of escalation to comment on post-9/11 political ethics?
  - [Whiplash (2014)] Is the film arguing that Fletcher's abusive methods are actually necessary for greatness?
  - [The Godfather (1972)] How does the film critique the post-World War II American Dream?
  - [2001: A Space Odyssey (1968)] How does the film explore the relationship between human evolution and technology?
  - [Fight Club (1999)] Does the film actually support Tyler's philosophy, or is it criticizing him?
  - [Forrest Gump (1994)] Is the movie actually a conservative sermon that punishes Jenny for being a rebel while rewarding Forrest for doing what he is told?

### 10. Why is so much time spent on this slow sequence?  —  5 instances
- **dimension:** craft-choice · **slug:** `pacing-and-focus`
- **definition:** This frame examines the narrative and thematic purpose of extended, slow-paced, or seemingly mundane sequences that delay the main plot. Viewers ask this to understand how deliberate pacing builds atmosphere, character depth, or thematic resonance.
- **slots:** sequence_purpose (world-building, character bonding, thematic meditation, tension building)
- **members:**
  - [The Shawshank Redemption (1994)] Why does the movie spend so much time on the library and the taxes?
  - [2001: A Space Odyssey (1968)] Do I really need to sit through the first 25 minutes of apes screaming at each other?
  - [Fight Club (1999)] Why does the movie spend so much time on support groups and IKEA furniture before any fighting actually starts?
  - [Forrest Gump (1994)] Why does the movie spend so much time on Forrest's shrimp boating business?
  - [Stalker (1979)] Why does the trolley ride to the Zone take so long without anyone talking?

### 11. How does the setting or physical space represent thematic concepts?  —  5 instances
- **dimension:** symbol-or-motif · **slug:** `setting-and-space-symbolism`
- **definition:** This frame analyzes how physical environments, geography, or architectural spaces are used to mirror social hierarchies or psychological states. Viewers ask this to connect the physical world of the film to its abstract social or philosophical critiques.
- **slots:** spatial_metaphor (vertical class divide, geopolitical border, psychological labyrinth, contrasting environments)
- **members:**
  - [Parasite (2019)] How does the film use vertical space to critique capitalism?
  - [Parasite (2019)] Why does the rainstorm affect the Kims and the Parks so differently?
  - [Burning (2018)] What is the historical and social significance of the setting near the North Korean border, and why does the film keep showing propaganda broadcasts?
  - [Stalker (1979)] Why do they have to take such a ridiculously indirect path to get anywhere in the Zone?
  - [Forrest Gump (1994)] How does the film use the contrast between Forrest's home in Alabama and Jenny's various locations to explore the concept of home?

### 12. How does the film use external references or adaptations to build meaning?  —  5 instances
- **dimension:** theme · **slug:** `intertextuality-and-adaptation`
- **definition:** This frame investigates how a film incorporates external texts, literary adaptations, psychological theories, or pop culture references to enrich its narrative. Viewers ask this to decode the intellectual and cultural layers embedded within the film.
- **slots:** external_reference_type (literary adaptation, psychological theory, pop culture pastiche, religious text)
- **members:**
  - [Pulp Fiction (1994)] Is the famous Ezekiel 25:17 speech just cool-sounding nonsense, or does it actually mean something?
  - [Pulp Fiction (1994)] How does the film's use of pop culture references and pastiche elevate it beyond a standard crime thriller?
  - [Burning (2018)] How does the film adapt Haruki Murakami's short story "Barn Burning" to critique contemporary South Korean class dynamics?
  - [Persona (1966)] How does Bergman use Jungian psychology to structure the conflict between Alma and Elisabeth?
  - [The Green Mile (1999)] What is the cinematic purpose of showing John watching 'Top Hat'?

### 13. Why does the ending feel so tragic or ambiguous?  —  4 instances
- **dimension:** ending · **slug:** `tragic-or-ambiguous-ending`
- **definition:** This frame examines the emotional complexity of endings that leave viewers feeling unsettled, tragic, or uncertain despite a seemingly resolved plot. Viewers ask this to process the bittersweet or haunting implications of the final moments.
- **slots:** emotional_tone (bittersweet tragedy, existential dread, unresolved tension, false hope)
- **members:**
  - [Parasite (2019)] Why does the ending feel so tragic if Ki-woo has a plan to buy the house?
  - [Whiplash (2014)] Why did Andrew's dad look so terrified in the final scene?
  - [The Godfather (1972)] Why does Kay believe Michael's lie at the end of the film, and what does the final shot mean?
  - [The Shawshank Redemption (1994)] Why does Red get so angry and hopeless when Andy talks about his dreams of Zihuatanejo?

### 14. Why does the film use a non-linear or unusual narrative structure?  —  4 instances
- **dimension:** craft-choice · **slug:** `unusual-narrative-structure`
- **definition:** This frame explores the artistic and thematic reasons behind non-linear storytelling, sudden shifts in perspective, or extended prologues. Viewers ask this to understand how the ordering of events shapes their emotional journey and thematic understanding.
- **slots:** structural_device (non-linear timeline, framing device, sudden geographical shift, extended prologue)
- **members:**
  - [Pulp Fiction (1994)] Why is the movie told out of order?
  - [Pulp Fiction (1994)] How do Honey Bunny and Pumpkin's opening and closing scenes tie this massive, sprawling movie together?
  - [The Godfather (1972)] Why does the narrative pivot to Sicily in the second act, and how does it change Michael?
  - [The Lord of the Rings: The Fellowship of the Ring (2001)] Is the long prologue at the beginning really necessary, or does it just slow down the start?

### 15. How did this film redefine its genre?  —  4 instances
- **dimension:** craft-choice · **slug:** `genre-redefinition`
- **definition:** This frame examines how a groundbreaking film permanently altered the stylistic, narrative, or thematic boundaries of its genre. Viewers ask this to contextualize the film's historical importance and its lasting influence on subsequent cinema.
- **slots:** genre_impact (introducing gritty realism, elevating production standards, merging disparate genres, deconstructing heroic archetypes)
- **members:**
  - [The Dark Knight (2008)] How did the film's grounding in realistic crime cinema alter the trajectory of the superhero genre?
  - [The Godfather (1972)] How does the famous baptism sequence redefine the narrative climax of the gangster genre?
  - [2001: A Space Odyssey (1968)] How did 2001 completely rewrite the rules of the science fiction genre?
  - [The Lord of the Rings: The Fellowship of the Ring (2001)] How did this film manage to escape the campy reputation of older fantasy movies?

### 16. Is this ambiguous element real or imaginary?  —  3 instances
- **dimension:** central-ambiguity · **slug:** `ambiguous-reality`
- **definition:** This frame questions whether a specific mysterious phenomenon, character, or twist exists within the physical reality of the film or is a psychological projection. Audiences ask this to determine the boundaries of the film's reality and the sanity of its characters.
- **slots:** reality_boundary (supernatural occurrence, psychological delusion, metaphorical device)
- **members:**
  - [Stalker (1979)] Is the Zone actually magical, or is the Stalker just a paranoid guide making up rules?
  - [The Green Mile (1999)] How is Mr. Jingles still alive at the end of the movie?
  - [Fight Club (1999)] Isn't the "it's all in his head" twist just a lazy cop-out to avoid a real ending?

### 17. How do contrasting character reactions highlight their core differences?  —  3 instances
- **dimension:** character-motive-or-fate · **slug:** `contrasting-character-reactions`
- **definition:** This frame compares how different characters react to the same extraordinary event, miracle, or trauma to highlight their contrasting worldviews. Viewers ask this to analyze the philosophical or moral debates played out through character dynamics.
- **slots:** contrasting_reaction (spiritual awakening vs cynicism, acceptance vs resistance, growth vs stagnation)
- **members:**
  - [Pulp Fiction (1994)] Why does Jules decide to walk the earth after the miracle, while Vincent ignores it?
  - [The Green Mile (1999)] Why does John choose to share his power and visions only with Paul?
  - [Forrest Gump (1994)] What is the significance of Lieutenant Dan's legs, and why does his attitude toward Forrest change so drastically after the hurricane?

### 18. Why does the character hesitate or refuse to take the final step?  —  3 instances
- **dimension:** character-motive-or-fate · **slug:** `hesitation-or-refusal`
- **definition:** This frame analyzes moments where a character hesitates, backs away, or refuses to cross a threshold or enter a space of ultimate truth. Viewers ask this to explore the fear, moral realization, or existential dread that halts a character's progress.
- **slots:** reason_for_hesitation (fear of the truth, moral awakening, existential paralysis)
- **members:**
  - [Stalker (1979)] Why does the Writer put on a crown of thorns, and then immediately take it off?
  - [The Lord of the Rings: The Fellowship of the Ring (2001)] Why does Gandalf hesitate so long in the Mines of Moria before choosing a path?
  - [Stalker (1979)] Why didn't they actually go inside the Room at the end?

### 19. What are the subtle clues pointing to a twist or fate?  —  2 instances
- **dimension:** rewatch-detail · **slug:** `foreshadowing-clues`
- **definition:** This frame identifies the hidden visual, auditory, or narrative clues scattered throughout a film that foreshadow its major twists or character fates. Viewers ask this to appreciate the meticulous craftsmanship that rewards repeat viewings.
- **slots:** clue_type (background visual detail, recurring character habit, subtle dialogue hint)
- **members:**
  - [Pulp Fiction (1994)] Why does Vincent Vega spend so much time in the bathroom, and how does it connect to his fate?
  - [Fight Club (1999)] What are the subtle visual clues pointing to the big twist that you only notice on a second viewing?

### 20. Why does this character stay in a toxic relationship?  —  2 instances
- **dimension:** character-motive-or-fate · **slug:** `toxic-relationship-motivation`
- **definition:** This frame investigates the complex psychological and emotional reasons why a character remains in an abusive, codependent, or destructive relationship. Audiences ask this to understand the deep-seated needs, fears, or shared delusions that bind characters together.
- **slots:** relationship_dynamic (codependency, shared trauma, manipulative control, existential loneliness)
- **members:**
  - [Stalker (1979)] Why does the Stalker's wife stay with him when he brings so much misery to their family?
  - [Fight Club (1999)] Why does Marla stick around after all the abuse and weirdness?

### 21. What is the truth behind this character's mystery?  —  2 instances
- **dimension:** character-motive-or-fate · **slug:** `character-mystery`
- **definition:** This frame focuses on unresolved questions regarding a character's background, physical condition, or the truth behind their self-reported stories. Viewers ask this to piece together the factual reality of a character's identity and history.
- **slots:** mystery_type (fabricated backstory, unspecified medical condition, hidden identity)
- **members:**
  - [The Dark Knight (2008)] Why does the Joker tell different stories about his scars, and what is the truth behind them?
  - [Forrest Gump (1994)] What disease does Jenny actually die from at the end of the movie?

### 22. Why does the character accept a tragic burden or punishment?  —  2 instances
- **dimension:** character-motive-or-fate · **slug:** `tragic-burden`
- **definition:** This frame explores why a character willingly accepts blame, suffering, or a lifetime of punishment for the sake of a greater good or moral duty. Viewers ask this to understand the noble or tragic self-sacrifice at the heart of the character's journey.
- **slots:** sacrifice_reason (protecting a legacy, atoning for past sins, preserving social order)
- **members:**
  - [The Dark Knight (2008)] Why does Batman take the fall for Harvey Dent's crimes at the end of the movie?
  - [The Green Mile (1999)] Is Paul's long life at the end meant to be a punishment?

### 23. How does a character's specific trauma or trigger define their fate?  —  2 instances
- **dimension:** character-motive-or-fate · **slug:** `character-trauma-and-fate`
- **definition:** This frame examines how a character's deep-seated psychological trauma, sensory triggers, or institutionalization dictates their ultimate actions and fate. Viewers ask this to understand the tragic inevitability of a character's psychological conditioning.
- **slots:** trauma_manifestation (sensory trigger, inability to adapt to freedom, repressed class rage)
- **members:**
  - [Parasite (2019)] Why is the smell such a destructive trigger for Ki-taek?
  - [The Shawshank Redemption (1994)] How does the film define 'institutionalization' through the character of Brooks Hatlen?

### 24. What is the true nature or cause of an antagonist's behavior?  —  2 instances
- **dimension:** character-motive-or-fate · **slug:** `antagonist-behavior-and-motivation`
- **definition:** This frame explores the underlying causes, glitches, or psychological states behind an antagonist's chillingly calm or erratic behavior. Viewers ask this to understand whether the threat stems from a logical error, systemic programming, or pure malice.
- **slots:** behavioral_cause (conflicting programming, psychological detachment, systemic failure)
- **members:**
  - [2001: A Space Odyssey (1968)] Why does HAL sound so incredibly polite while he is literally killing the crew?
  - [2001: A Space Odyssey (1968)] Why does HAL actually malfunction? Is it just a random glitch or did the crew do something wrong?

### 25. How did real-world production circumstances shape the film's style?  —  2 instances
- **dimension:** director-connection · **slug:** `production-circumstances-and-style`
- **definition:** This frame examines how real-world production constraints, historical contexts, or changes in medium influenced the film's final aesthetic and narrative structure. Viewers ask this to bridge the gap between behind-the-scenes history and on-screen art.
- **slots:** production_factor (failed pilot transition, artistic medium shift, budgetary constraints)
- **members:**
  - [Mulholland Drive (2001)] How did the film's origins as a failed television pilot shape its unique narrative structure?
  - [Stalker (1979)] What is the historical or artistic reason for switching between sepia and color?

### 26. Is this self-indulgent choice actually meaningful?  —  2 instances
- **dimension:** contested-point · **slug:** `artistic-indulgence-vs-meaning`
- **definition:** This frame debates whether highly stylized, exceptionally long, or abstract sequences are self-indulgent excesses or essential thematic components. Viewers ask this to evaluate the artistic merit and narrative necessity of a filmmaker's boldest choices.
- **slots:** artistic_choice (extreme runtime, extended abstract sequence, stylized visual effects)
- **members:**
  - [2001: A Space Odyssey (1968)] Is the final psychedelic light show just 1960s trippy nonsense to hide that the movie ran out of plot?
  - [The Green Mile (1999)] Why is this movie over three hours long? Could it have been shorter?

## Singletons (2) — no frame yet (orphan pool)

- [Whiplash (2014)] How does Whiplash connect to the themes of Damien Chazelle's other movies?
- [The Godfather (1972)] Why does Sonny's death feel so much more visceral and shocking than the other assassinations in the film?