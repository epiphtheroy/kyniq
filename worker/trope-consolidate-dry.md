# Trope Consolidation — DRY
_model claude-opus-4-8 · readings 935 → trope layer 1299_

## Result
- final trope count: **1421** (was 1299; +147 promoted, −25 dup-merges)
- readings folded away: **935** → each /take/[slug] 301 → /trope/[slug]
- reading match bands: auto-merge 0 · LLM 269 · auto-new 27
- reading outcomes: merge→existing 511 · promoted-new(raw) 149 → after dedup 147


## Sample reading → existing trope (merge)

- "The Tenderness Beneath the Performance" (62f) → **The Wound Beneath The Behavior**
- "Unseen Sonic Dread" (65f) → **The Voice From Nowhere**
- "Scarred and Returning Bodies" (56f) → **The Scar That Won't Heal**
- "The Tangible Object's Pull" (63f) → **The Keepsake Of The Dead**
- "Parallel-Timeline Suspense Editing" (46f) → **The Two Clocks Running**
- "Lyrics That Speak For Characters" (51f) → **The Song That Confesses**
- "Recycled Pop-Culture Eras" (58f) → **The Needle-Drop Decade**
- "Compulsory Roles and Staged Spaces" (60f) → **The Office Floor as Theater**
- "Selfhood Dissolved Into a Role" (68f) → **The Role That Bleeds Through**
- "Self-Made Through Costume and Disguise" (60f) → **The Telltale Coat**
- "The Unreliable Narrator" (51f) → **The Lying Storyteller**
- "Sound As Inner Identity" (69f) → **The Self Made Visible**
- "The Emotional Landscape" (125f) → **The Landscape That Mirrors the Soul**
- "Performing Emotional Control" (167f) → **The Mask That Doesn't Crack**
- "Light and Shadow as Survival Currency" (64f) → **The Lit And Shadowed Room**
- "Corrupted Comforts" (64f) → **The Familiar Place Gone Wrong**
- "Diffused Moral Authorship" (108f) → **The Aftermath Without The Act**
- "The Recurring Motif Anchor" (108f) → **The Returning Image**

## Sample promoted NEW tropes (nearest existing trope shown — low sim ⇒ genuinely new)

- **The Displaced Wound** — The real ache hides behind an unacknowledged stand-in.  · ~689 figs · nearest existing: "The Scar That Won't Heal" (0.54)
- **The Indifferent Landscape** — Vast, beautiful terrain dwarfs and ignores the human drama within.  · ~415 figs · nearest existing: "The Breathing Land" (0.58)
- **The Defiant Refusal** — Freedom found only in refusing the ending others demand.  · ~373 figs · nearest existing: "The Last Man Standing" (0.54)
- **The Land Turned To Property** — Ancestral home becomes a commodity seized, developed, or sold off.  · ~326 figs · nearest existing: "The Contested Heirloom" (0.48)
- **The Withheld Arrival** — Desire and anticipation dominate while the awaited fulfillment never materializes.  · ~292 figs · nearest existing: "The Empty Chair At The Table" (0.46)
- **The Quarry That Turns On The Hunter** — The pursued object or goal ends up destroying its pursuer.  · ~281 figs · nearest existing: "The Relentless Pursuer" (0.68)
- **The Demand That Cannot Be Refused** — A claim or call that must be answered or betrayed.  · ~265 figs · nearest existing: "The Suitor Who Won't Leave" (0.46)
- **The Buried Thing Resurfaces** — What was suppressed or hidden returns to disrupt the present.  · ~265 figs · nearest existing: "The Ghost Who Returns For Revenge" (0.52)
- **The Genre Rulebook Read Aloud** — Characters knowingly cite and comment on their own genre's conventions.  · ~231 figs · nearest existing: "The Book That Opens the Film" (0.47)
- **The Past That Returns To Collect** — A buried history resurfaces to demand reckoning.  · ~226 figs · nearest existing: "The Lingering Ghost" (0.64)
- **The Borrowed Frame** — Every shot quotes prior films, art, or its own source material.  · ~224 figs · nearest existing: "The Returning Image" (0.52)
- **The Wealth Written In Objects** — Class and money revealed silently through furnishings, dress, and space.  · ~221 figs · nearest existing: "The Bottomless Purse" (0.50)
- **The Ambiguous Symbol** — One object sustains two opposed readings the film never resolves.  · ~214 figs · nearest existing: "The Two-Panel Story" (0.49)
- **Self-Undermining Verification** — The proof arrives, certifies nothing, and erases the question it answered.  · ~206 figs · nearest existing: "The Forged Signature" (0.44)
- **The One-Way Threshold** — A passage crossed only once, with someone watching the departure.  · ~199 figs · nearest existing: "The Object At The Doorway" (0.62)
- **Commodified Image And Branded Reality** — When the picture of a thing outsells the thing itself.  · ~199 figs · nearest existing: "The Returning Image" (0.45)
- **The Paid Companion** — Affection and closeness purchased as a transactional service.  · ~195 figs · nearest existing: "The Envelope Of Cash" (0.51)
- **The Sacred In The Secular** — Transcendence found in landscape, animals, and indifferent nature without God.  · ~192 figs · nearest existing: "The Object Made Holy" (0.46)
- **The Unrepayable Bond** — Love or obligation that can never be balanced or settled.  · ~191 figs · nearest existing: "The Mounting Debt" (0.59)
- **The Vulnerable Confession** — Speaking a secret aloud surrenders power to the listener.  · ~190 figs · nearest existing: "The Confession Beaten Out" (0.58)
- **The Body Under Control** — Another power owns, manages, or administers a person's body.  · ~182 figs · nearest existing: "The Body Without A Name" (0.54)
- **The Witness Who Carries The Vanished** — A survivor preserves and speaks for the dead and disappeared.  · ~182 figs · nearest existing: "The Road to the Absent Father" (0.56)
- **The Refuge From Judgment** — A place where the world stops keeping score.  · ~180 figs · nearest existing: "The Hidden Refuge" (0.53)
- **The Loaded Frame** — Camera and staging quietly assign cruelty, sympathy, and judgment.  · ~177 figs · nearest existing: "The Killer Who Begs Punishment" (0.48)

## Sample trope ↔ trope merges (dedup of existing layer)

- "The Inseparable Pair" → **The Inseparable Pair**
- "The Found Family" → **The Found Family**
- "The Wide-Eyed Newcomer" → **The Wide-Eyed Newcomer**
- "The Breakdown in Public" → **The Breakdown In Front Of Everyone**
- "The Land That Wants You Dead" → **The Land That Wants You Dead**
- "The Narrow Frame" → **The Squeezed Frame**
- "The Death Beyond The Frame" → **The Scream Beyond The Frame**
- "The Shuffled Timeline" → **The Shuffled Chronology**
- "The Severed Limb" → **The Severed Limb**
- "The Masked Avenger" → **The Masked Avenger**
- "The Frontal Tableau" → **The Frontal Tableau**
- "The Anachronistic Needle-Drop" → **The Anachronistic Needle-Drop**
- "The Body That Turns Monstrous" → **The Flesh Made Monstrous**
- "The Look Into The Lens" → **The Look Into The Lens**
- "The Single Room" → **The Single Room**
- "The Returning Image" → **The Returning Image**
- "The Ticking Clock" → **The Ticking Clock**
- "The Look Into The Lens" → **The Look Into The Lens**

---
## Cost
- tokens in 110,953 · out 13,509
- est. cost this run: **$0.89**
