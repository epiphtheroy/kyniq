# -*- coding: utf-8 -*-
import csv, os

IN = "/sessions/affectionate-pensive-euler/mnt/outputs/unified/concepts/dbchunks/db_4.csv"
OUT = "/sessions/affectionate-pensive-euler/mnt/outputs/unified/concepts/dbout/db_4_concepts.csv"

rows_in = {}
order = []
with open(IN, newline="", encoding="utf-8") as f:
    r = csv.DictReader(f)
    for row in r:
        t = row["theorist"].strip()
        order.append(t)
        existing = [c.strip() for c in row["existing"].split("|") if c.strip()]
        rows_in[t] = {
            "part": row["part"].strip(),
            "major": row["major"].strip(),
            "sub": row["sub"].strip(),
            "existing": existing,
        }

CUR = {
"Simon Schaffer": [
    ("Leviathan and the Air-Pump","","Boyle vs Hobbes: how experimental fact-making became authoritative knowledge","Modern","Knowledge","high"),
    ("Experimental Life","","The social and material practices that constitute scientific experiment","Modern","Knowledge","high"),
    ("Calibration","","How instruments and observers are tuned to produce trustworthy measurement","Modern","Knowledge","high"),
    ("Self-Evidence","","Critique of how scientific facts come to seem naturally obvious","Modern","Knowledge","med"),
    ("Machine Philosophy","","Study of automata and instruments as actors in knowledge production","Modern","Knowledge","med"),
],
"Steven Shapin": [
    ("A Social History of Truth","","Trust and gentlemanly credibility underwriting early modern scientific knowledge","Modern","Knowledge","high"),
    ("Leviathan and the Air-Pump","","Boyle vs Hobbes debate over experiment as basis of knowledge","Modern","Knowledge","high"),
    ("The Scientific Revolution","","Argues there was no single coherent 'Scientific Revolution' event","Modern","Knowledge","high"),
    ("Truth-Telling and Gentility","","Social standing as the guarantor of credible factual testimony","Modern","Knowledge","high"),
    ("Invisible Technicians","","The unnamed laborers whose work underpins celebrated scientific discovery","Modern","Knowledge","med"),
],
"Frederick Cooper": [
    ("Colonialism in Question","","Critique of loose, anachronistic uses of colonialism and modernity","Contemporary","Knowledge","high"),
    ("Gatekeeper State","","Postcolonial African states controlling resources at the colonial-era border","Contemporary","Knowledge","high"),
    ("Tensions of Empire","","Colonizer and colonized mutually shaped within imperial bourgeois projects","Contemporary","Knowledge","high"),
    ("Citizenship between Empire and Nation","","African demands reshaping French imperial citizenship after WWII","Contemporary","Knowledge","high"),
    ("Lumping and Splitting","","Methodological caution against over-generalizing or over-fragmenting historical categories","Contemporary","Knowledge","med"),
],
"Georges Vigarello": [
    ("Concepts of Cleanliness","","History of hygiene, washing and bodily purity since the Middle Ages","Modern","Knowledge","high"),
    ("History of the Body","","Long-term cultural transformation of how bodies are perceived and disciplined","Modern","Knowledge","high"),
    ("History of Rape","","Changing legal and moral understandings of sexual violence over centuries","Modern","Knowledge","high"),
    ("The Healthy Body","","Historical shifts in ideals of fitness, vigor and bodily care","Modern","Knowledge","med"),
    ("History of Beauty","","Evolving Western standards and practices of physical beauty","Modern","Knowledge","med"),
],
"Lynn Hunt": [
    ("Inventing Human Rights","","Empathy fostered by novels enabled the modern idea of human rights","Modern","Knowledge","high"),
    ("The New Cultural History","","Turn toward meaning, representation and culture in historical practice","Modern","Knowledge","high"),
    ("The Family Romance of the French Revolution","","Revolution narrated through familial and psychic models of authority","Modern","Knowledge","high"),
    ("Politics, Culture, and Class in the French Revolution","","Revolutionary politics analyzed through symbols, rhetoric and culture","Modern","Knowledge","high"),
    ("Imagined Empathy","","Reading and imagination cultivating recognition of others' rights","Modern","Knowledge","med"),
],
"Douglass North": [
    ("Institutions","","Rules of the game structuring economic and social interaction","Modern","Knowledge","high"),
    ("Institutional Change","","How formal and informal constraints evolve to shape economic performance","Modern","Knowledge","high"),
    ("Transaction Costs","","Costs of exchange shaping the emergence of economic institutions","Modern","Knowledge","high"),
    ("Path Dependence","","Past institutional choices constraining present economic trajectories","Modern","Knowledge","high"),
    ("Adaptive Efficiency","","Institutions enabling societies to learn and adjust over time","Modern","Knowledge","med"),
    ("New Institutional Economics","","Framework integrating institutions, property rights and transaction costs","Modern","Knowledge","high"),
],
"Alfred Crosby": [
    ("Ecological Imperialism","","Europe's biological allies enabling conquest of temperate lands","Modern","Knowledge","high"),
    ("The Columbian Exchange","","Transatlantic transfer of crops, animals and diseases after 1492","Modern","Knowledge","high"),
    ("Virgin Soil Epidemics","","Indigenous populations devastated by diseases to which they lacked immunity","Modern","Knowledge","high"),
    ("Portmanteau Biota","","The bundle of organisms Europeans carried that remade ecosystems","Modern","Knowledge","med"),
    ("The Measure of Reality","","Quantification and visualization underpinning Western expansion","Modern","Knowledge","med"),
],
"Sebastian Conrad": [
    ("Global History","","Writing history through connections, circulation and global integration","Contemporary","Knowledge","high"),
    ("Connected Histories","","Past understood via entanglements across regions rather than isolated units","Contemporary","Knowledge","high"),
    ("What Is Global History?","","Programmatic definition of global history as method and perspective","Contemporary","Knowledge","high"),
    ("Globality","","The condition of worldwide interconnection shaping historical processes","Contemporary","Knowledge","med"),
    ("Multiple Modernities Critique","","Reassessing Enlightenment and modernity in genuinely global terms","Contemporary","Knowledge","med"),
],
"Mike Davis": [
    ("Late Victorian Holocausts","","Imperial policy and El Nino famines killing millions in the periphery","Contemporary","Knowledge","high"),
    ("Planet of Slums","","Explosive growth of informal urban poverty across the global South","Contemporary","Knowledge","high"),
    ("City of Quartz","","Los Angeles as fortress of class fear and spatial control","Contemporary","Knowledge","high"),
    ("Ecology of Fear","","Disaster, catastrophe and the political ecology of Los Angeles","Contemporary","Knowledge","high"),
    ("The Monster at Our Door","","Avian flu and capitalism's manufacture of pandemic risk","Contemporary","Knowledge","med"),
],
"Thomas Kuhn": [
    ("Paradigm","","Shared framework of assumptions and exemplars guiding normal science","Modern","Knowledge","high"),
    ("Paradigm Shift","","Revolutionary replacement of one scientific framework by another","Modern","Knowledge","high"),
    ("Normal Science","","Puzzle-solving research conducted within an accepted paradigm","Modern","Knowledge","high"),
    ("Incommensurability","","Rival paradigms lacking a common standard for comparison","Modern","Knowledge","high"),
    ("Scientific Revolution","","Crisis-driven rupture transforming a scientific discipline's worldview","Modern","Knowledge","high"),
    ("Anomaly and Crisis","","Accumulating puzzles destabilizing a paradigm before revolution","Modern","Knowledge","high"),
],
"Elizabeth Eisenstein": [
    ("Print Culture","","Printing press as an agent of cultural and intellectual change","Modern","Knowledge","high"),
    ("The Printing Press as an Agent of Change","","Print fixity and dissemination transforming Renaissance, Reformation, science","Modern","Knowledge","high"),
    ("Typographical Fixity","","Print standardizing and preserving texts across copies and time","Modern","Knowledge","high"),
    ("Communications Revolution","","Shift from script to print reorganizing knowledge production","Modern","Knowledge","high"),
    ("Standardization of Knowledge","","Print enabling reliable, comparable editions of texts","Modern","Knowledge","med"),
],
"E.A. Wrigley": [
    ("Historical Demography","","Reconstructing past populations from parish and vital records","Modern","Knowledge","high"),
    ("Family Reconstitution","","Linking parish records to reconstruct demographic life histories","Modern","Knowledge","high"),
    ("Organic vs Mineral Economy","","Transition from land-based to fossil-fuel energy driving industrialization","Modern","Knowledge","high"),
    ("Population and History","","Long-run interplay of fertility, mortality and economic change","Modern","Knowledge","high"),
    ("Energy and the Industrial Revolution","","Coal as the precondition for escaping the organic economy","Modern","Knowledge","med"),
],
"Roy Porter": [
    ("Social History of Medicine","","Medicine understood through patients, society and everyday experience","Modern","Knowledge","high"),
    ("The Patient's View","","Writing medical history from the sufferer's perspective, not the doctor's","Modern","Knowledge","high"),
    ("History of Madness","","Cultural and institutional history of insanity and psychiatry","Modern","Knowledge","high"),
    ("The Greatest Benefit to Mankind","","Sweeping narrative history of medicine from antiquity to modernity","Modern","Knowledge","high"),
    ("Enlightenment and the Body","","Eighteenth-century reimagining of health, flesh and self","Modern","Knowledge","med"),
],
"David R. Roediger": [
    ("The Wages of Whiteness","","White workers' psychological wage of racial status over solidarity","Contemporary","Knowledge","high"),
    ("Whiteness Studies","","Critical analysis of whiteness as a constructed racial category","Contemporary","Knowledge","high"),
    ("Working Toward Whiteness","","How European immigrants became racially 'white' in America","Contemporary","Knowledge","high"),
    ("Racial Wage","","Symbolic compensation of white identity substituting for class gains","Contemporary","Knowledge","high"),
    ("Inbetween Peoples","","Immigrants positioned ambiguously between Black and white categories","Contemporary","Knowledge","med"),
],
"Mary Ainsworth": [
    ("Attachment Theory","","Infant-caregiver bond shaping emotional security and development","Modern","Knowledge","high"),
    ("Strange Situation","","Laboratory procedure classifying infant attachment patterns","Modern","Knowledge","high"),
    ("Secure Base","","Caregiver as safe base from which a child explores the world","Modern","Knowledge","high"),
    ("Attachment Styles","","Secure, anxious-ambivalent and avoidant patterns of infant attachment","Modern","Knowledge","high"),
    ("Maternal Sensitivity","","Responsive caregiving fostering secure infant attachment","Modern","Knowledge","high"),
],
"Judith Stacey": [
    ("The Myth of the Traditional Family","","Nostalgic 'traditional family' as ideological fiction, not historical reality","Contemporary","Knowledge","high"),
    ("Postmodern Family","","Diverse, fluid family forms replacing the modern nuclear ideal","Contemporary","Knowledge","high"),
    ("Brave New Families","","Ethnography of recombinant working-class family arrangements","Contemporary","Knowledge","high"),
    ("Queer Family","","Chosen and same-sex families challenging heteronormative kinship","Contemporary","Knowledge","high"),
    ("In the Name of the Family","","Critique of family-values politics and its assumptions","Contemporary","Knowledge","med"),
],
"Rhacel Salazar Parrenas": [
    ("Global Care Chains","","Transnational chains of paid and unpaid reproductive labor","Contemporary","Knowledge","high"),
    ("Transnational Motherhood","","Migrant women mothering children across national borders","Contemporary","Knowledge","high"),
    ("Servants of Globalization","","Filipina domestic workers within global migration and care economies","Contemporary","Knowledge","high"),
    ("Care Crisis","","Wealthy nations importing care labor at the South's expense","Contemporary","Knowledge","high"),
    ("Contradictory Class Mobility","","Migrant domestics gaining income while losing social status","Contemporary","Knowledge","med"),
],
"David H. Olson": [
    ("Circumplex Model","","Mapping families on cohesion, flexibility and communication dimensions","Modern","Knowledge","high"),
    ("Family Cohesion","","Emotional bonding among family members along a balance continuum","Modern","Knowledge","high"),
    ("Family Adaptability","","Family's capacity to change roles and rules under stress","Modern","Knowledge","high"),
    ("FACES Assessment","","Self-report instrument measuring family cohesion and adaptability","Modern","Knowledge","med"),
    ("Balanced Family Functioning","","Healthy families occupying moderate levels of cohesion and flexibility","Modern","Knowledge","high"),
],
"Glen Elder Jr.": [
    ("Life Course Theory","","Lives shaped by historical time, timing and linked social roles","Modern","Knowledge","high"),
    ("Children of the Great Depression","","Cohort study linking economic hardship to lifelong development","Modern","Knowledge","high"),
    ("Linked Lives","","Individual lives interdependent through shared social relationships","Modern","Knowledge","high"),
    ("Timing of Lives","","Developmental impact depending on when events occur in a life","Modern","Knowledge","high"),
    ("Human Agency","","Individuals constructing lives within historical constraints","Modern","Knowledge","high"),
    ("Cohort Effects","","Birth cohorts shaped by the historical conditions they encounter","Modern","Knowledge","med"),
],
"Froma Walsh": [
    ("Family Resilience","","Family's capacity to rebound and grow stronger through adversity","Contemporary","Knowledge","high"),
    ("Family Belief Systems","","Shared meanings and outlook enabling families to cope with crisis","Contemporary","Knowledge","high"),
    ("Family Meaning-Making","","Constructing coherent narratives that give adversity significance","Contemporary","Knowledge","high"),
    ("Organizational Patterns","","Flexibility, connectedness and resources sustaining resilient families","Contemporary","Knowledge","med"),
    ("Spirituality and Resilience","","Faith and transcendence as resources in family coping","Contemporary","Knowledge","med"),
],
"Mara Selvini Palazzoli": [
    ("Milan Systemic Family Therapy","","Whole-family systemic approach treating symptoms as relational games","Modern","Knowledge","high"),
    ("Circular Questioning","","Interview technique eliciting differences and relational patterns","Modern","Knowledge","high"),
    ("Hypothesizing","","Therapist's tentative systemic explanation guiding the session","Modern","Knowledge","high"),
    ("Neutrality","","Therapist allied with the whole system, not any single member","Modern","Knowledge","high"),
    ("Positive Connotation","","Reframing symptoms as serving a positive family function","Modern","Knowledge","high"),
    ("Family Games","","Covert relational power maneuvers sustaining a symptom","Modern","Knowledge","med"),
],
"Rollo May": [
    ("Existential Psychology","","Psychology grounded in anxiety, freedom, meaning and being","Modern","Knowledge","high"),
    ("The Meaning of Anxiety","","Anxiety as a normal response to threats against one's existence","Modern","Knowledge","high"),
    ("The Daimonic","","Natural urges that can become creative or destructive when possessing us","Modern","Knowledge","high"),
    ("Love and Will","","Integration of love and will against modern emotional apathy","Modern","Knowledge","high"),
    ("The Courage to Create","","Creativity as courageous encounter with one's world","Modern","Knowledge","med"),
],
"Frederic Bartlett": [
    ("Schema Theory","","Memory organized by mental frameworks that reshape recall","Modern","Knowledge","high"),
    ("Reconstructive Memory","","Remembering as active reconstruction, not faithful reproduction","Modern","Knowledge","high"),
    ("War of the Ghosts","","Classic study showing culturally driven distortion in recall","Modern","Knowledge","high"),
    ("Effort After Meaning","","People reshape memories to make material sensible and familiar","Modern","Knowledge","high"),
    ("Conventionalization","","Recalled material drifting toward familiar cultural forms","Modern","Knowledge","med"),
],
"Aaron Beck": [
    ("Cognitive Therapy","","Treating disorders by correcting distorted thoughts and beliefs","Modern","Knowledge","high"),
    ("Cognitive Distortions","","Systematic errors in thinking maintaining depression and anxiety","Modern","Knowledge","high"),
    ("Negative Cognitive Triad","","Negative views of self, world and future in depression","Modern","Knowledge","high"),
    ("Automatic Thoughts","","Spontaneous appraisals shaping emotional reactions","Modern","Knowledge","high"),
    ("Schema (Cognitive)","","Core beliefs filtering interpretation of experience","Modern","Knowledge","high"),
    ("Beck Depression Inventory","","Widely used self-report scale measuring depression severity","Modern","Knowledge","med"),
],
"Fritz Heider": [
    ("Attribution Theory","","How people infer causes of behavior and events","Modern","Knowledge","high"),
    ("Balance Theory","","Drive toward consistency among attitudes and relationships","Modern","Knowledge","high"),
    ("Naive Psychology","","Ordinary people's commonsense theories of behavior","Modern","Knowledge","high"),
    ("Person vs Situation Causation","","Distinguishing dispositional from situational causes of action","Modern","Knowledge","high"),
    ("Phenomenal Causality","","Perceived causality among objects, as in animated shapes","Modern","Knowledge","med"),
],
"Jean Piaget": [
    ("Cognitive Development Stages","","Children's thinking unfolding through sensorimotor to formal-operational stages","Modern","Knowledge","high"),
    ("Schema (Assimilation/Accommodation)","","Mental structures adjusting through assimilation and accommodation","Modern","Knowledge","high"),
    ("Object Permanence","","Infant's understanding that hidden objects continue to exist","Modern","Knowledge","high"),
    ("Conservation","","Grasping that quantity persists despite changes in appearance","Modern","Knowledge","high"),
    ("Egocentrism","","Young child's inability to take another's perspective","Modern","Knowledge","high"),
    ("Genetic Epistemology","","Study of how knowledge develops in the child","Modern","Knowledge","high"),
],
"Irwin Altman": [
    ("Social Penetration Theory","","Relationships deepening through gradual self-disclosure","Modern","Knowledge","high"),
    ("Privacy Regulation","","Dialectical control over openness and closedness to others","Modern","Knowledge","high"),
    ("Place Attachment","","Emotional bonds between people and meaningful physical settings","Modern","Knowledge","high"),
    ("Territoriality","","Human regulation of space to manage social interaction","Modern","Knowledge","high"),
    ("Onion Model","","Self-disclosure peeling personality layers from surface to core","Modern","Knowledge","med"),
],
"Bibb Latane": [
    ("Bystander Effect","","Presence of others reducing likelihood of individual helping","Modern","Knowledge","high"),
    ("Diffusion of Responsibility","","Responsibility to act dispersing across a group of witnesses","Modern","Knowledge","high"),
    ("Social Impact Theory","","Social influence scaling with strength, immediacy and number","Modern","Knowledge","high"),
    ("Social Loafing","","Individuals exerting less effort within a group","Modern","Knowledge","high"),
    ("Unresponsive Bystander","","Classic studies on why witnesses fail to intervene","Modern","Knowledge","med"),
],
"Gordon Allport": [
    ("Trait Theory","","Personality described by stable, measurable individual traits","Modern","Knowledge","high"),
    ("Contact Hypothesis","","Intergroup contact under conditions reducing prejudice","Modern","Knowledge","high"),
    ("The Nature of Prejudice","","Landmark analysis of the psychology of prejudice","Modern","Knowledge","high"),
    ("Cardinal, Central, Secondary Traits","","Hierarchy of traits from dominant to peripheral","Modern","Knowledge","high"),
    ("Functional Autonomy","","Motives becoming independent of their original origins","Modern","Knowledge","med"),
],
"D.W. Winnicott": [
    ("Transitional Object","","Comfort object bridging inner and outer reality for the infant","Modern","Knowledge","high"),
    ("Good-Enough Mother","","Adequate, imperfect caregiving fostering healthy development","Modern","Knowledge","high"),
    ("True Self / False Self","","Authentic self versus compliant facade protecting it","Modern","Knowledge","high"),
    ("Holding Environment","","Safe psychological space enabling the child's development","Modern","Knowledge","high"),
    ("Transitional Space","","Intermediate area of play and culture between self and world","Modern","Knowledge","high"),
    ("Object Relations","","Internalized relationships structuring the developing psyche","Modern","Knowledge","med"),
],
"Albert Ellis": [
    ("Rational Emotive Behavior Therapy","","Disputing irrational beliefs to change emotion and behavior","Modern","Knowledge","high"),
    ("ABC Model","","Activating event, belief and consequence framing emotional reactions","Modern","Knowledge","high"),
    ("Irrational Beliefs","","Rigid demands and catastrophizing producing emotional disturbance","Modern","Knowledge","high"),
    ("Musturbation","","Tyranny of absolutist 'musts' and 'shoulds' driving distress","Modern","Knowledge","high"),
    ("Unconditional Self-Acceptance","","Accepting oneself independent of performance or approval","Modern","Knowledge","med"),
],
"Marsha M. Linehan": [
    ("Dialectical Behavior Therapy","","Balancing acceptance and change to treat emotional dysregulation","Contemporary","Knowledge","high"),
    ("Biosocial Theory","","Borderline traits from biological vulnerability plus invalidating environment","Contemporary","Knowledge","high"),
    ("Emotion Dysregulation","","Heightened, slow-to-recover emotional reactivity central to BPD","Contemporary","Knowledge","high"),
    ("Radical Acceptance","","Fully accepting reality as it is to reduce suffering","Contemporary","Knowledge","high"),
    ("Dialectics","","Holding opposing truths in synthesis within therapy","Contemporary","Knowledge","high"),
    ("Distress Tolerance","","Skills for surviving crises without making them worse","Contemporary","Knowledge","med"),
],
"Simon Baron-Cohen": [
    ("Theory of Mind","","Capacity to attribute mental states to oneself and others","Contemporary","Knowledge","high"),
    ("Mindblindness","","Autism as impairment in attributing others' mental states","Contemporary","Knowledge","high"),
    ("Empathizing-Systemizing Theory","","Cognition along empathizing versus systemizing dimensions","Contemporary","Knowledge","high"),
    ("Extreme Male Brain Theory","","Autism as exaggeration of male-typical systemizing cognition","Contemporary","Knowledge","high"),
    ("Sally-Anne Test","","False-belief task probing children's theory of mind","Contemporary","Knowledge","med"),
],
"Godfrey Hochbaum": [
    ("Health Belief Model","","Beliefs about threat and benefit predicting health behavior","Modern","Knowledge","high"),
    ("Perceived Susceptibility","","Belief about one's own risk of contracting a condition","Modern","Knowledge","high"),
    ("Cues to Action","","Triggers prompting individuals to take health-protective behavior","Modern","Knowledge","high"),
    ("TB Screening Studies","","Founding HBM research on tuberculosis X-ray uptake","Modern","Web","high"),
],
"Stephen Kegels": [
    ("Health Belief Model","","Beliefs about threat and benefit predicting health behavior","Modern","Web","high"),
    ("Perceived Barriers","","Perceived costs and obstacles deterring health action","Modern","Knowledge","high"),
    ("Dental Health Behavior","","Kegeles's HBM research on preventive dental care decisions","Modern","Web","med"),
],
"Gary Berntson": [
    ("Social Neuroscience","","Neural and biological bases of social behavior and cognition","Contemporary","Knowledge","high"),
    ("Doctrine of Autonomic Space","","Sympathetic and parasympathetic systems as independent dimensions","Contemporary","Web","high"),
    ("Bivariate Autonomic Control","","Cardiac control modeled along two separable autonomic axes","Contemporary","Web","med"),
    ("Neurovisceral Integration","","Brain-body integration linking emotion, cognition and physiology","Contemporary","Knowledge","med"),
],
"Edward L. Deci": [
    ("Self-Determination Theory","","Motivation driven by autonomy, competence and relatedness needs","Contemporary","Knowledge","high"),
    ("Intrinsic Motivation","","Acting from inherent interest rather than external reward","Contemporary","Knowledge","high"),
    ("Cognitive Evaluation Theory","","How rewards and feedback affect intrinsic motivation","Contemporary","Knowledge","high"),
    ("Overjustification Effect","","Extrinsic rewards undermining preexisting intrinsic interest","Contemporary","Knowledge","high"),
    ("Basic Psychological Needs","","Autonomy, competence and relatedness as universal needs","Contemporary","Knowledge","high"),
],
"Richard M. Ryan": [
    ("Self-Determination Theory","","Motivation driven by autonomy, competence and relatedness needs","Contemporary","Knowledge","high"),
    ("Organismic Integration Theory","","Continuum of extrinsic motivation from controlled to autonomous","Contemporary","Knowledge","high"),
    ("Autonomy Support","","Social contexts nurturing volition and self-endorsed action","Contemporary","Knowledge","high"),
    ("Eudaimonic Well-Being","","Wellness from need satisfaction and authentic living","Contemporary","Knowledge","med"),
    ("Intrinsic vs Extrinsic Goals","","Aspirations toward growth versus wealth, fame and image","Contemporary","Knowledge","med"),
],
"Insoo Kim Berg": [
    ("Solution-Focused Brief Therapy","","Brief therapy building on client strengths and desired futures","Contemporary","Knowledge","high"),
    ("Miracle Question","","Imagining a future where the problem has vanished overnight","Contemporary","Knowledge","high"),
    ("Scaling Questions","","Rating progress to mobilize change toward goals","Contemporary","Knowledge","high"),
    ("Exception Finding","","Identifying times the problem was absent or lessened","Contemporary","Knowledge","high"),
    ("Solution-Building","","Constructing solutions rather than analyzing problems","Contemporary","Knowledge","med"),
],
"Shinobu Kitayama": [
    ("Independent vs Interdependent Self","","Cultures cultivating separate versus relational self-construals","Contemporary","Knowledge","high"),
    ("Cultural Psychology","","Mind and culture as mutually constituting one another","Contemporary","Knowledge","high"),
    ("Culture and the Self","","Self-concept shaped by cultural models of personhood","Contemporary","Knowledge","high"),
    ("Cultural Task Analysis","","Everyday cultural practices reproducing psychological tendencies","Contemporary","Knowledge","med"),
    ("Culture-Gene Coevolution (Psychology)","","Genetic predispositions interacting with cultural environments","Contemporary","Web","med"),
],
"Rachel Kaplan": [
    ("Attention Restoration Theory","","Natural environments restoring depleted directed attention","Contemporary","Knowledge","high"),
    ("Restorative Environments","","Settings fostering recovery from mental fatigue","Contemporary","Knowledge","high"),
    ("The Experience of Nature","","Psychological benefits of contact with natural settings","Contemporary","Knowledge","high"),
    ("Preference Matrix","","Coherence, legibility, complexity and mystery shaping landscape preference","Contemporary","Knowledge","med"),
    ("Fascination","","Effortless attention nature draws, freeing directed attention","Contemporary","Knowledge","high"),
],
"Stephen Kaplan": [
    ("Attention Restoration Theory","","Natural environments restoring depleted directed attention","Contemporary","Knowledge","high"),
    ("Directed Attention Fatigue","","Depletion of voluntary attention from sustained mental effort","Contemporary","Knowledge","high"),
    ("Soft Fascination","","Gentle, undemanding stimuli allowing attentional recovery","Contemporary","Knowledge","high"),
    ("Reasonable Person Model","","Environments supporting understanding, exploration and meaningful action","Contemporary","Knowledge","med"),
    ("Being Away","","Psychological distance from demands as a restorative component","Contemporary","Knowledge","med"),
],
"Stephen Porges": [
    ("Polyvagal Theory","","Vagus nerve branches governing safety, defense and social engagement","Contemporary","Knowledge","high"),
    ("Neuroception","","Subconscious detection of safety or threat in the environment","Contemporary","Knowledge","high"),
    ("Social Engagement System","","Vagal-facial circuit enabling calm social connection","Contemporary","Knowledge","high"),
    ("Vagal Tone","","Parasympathetic regulation indexing emotional and physiological flexibility","Contemporary","Knowledge","high"),
    ("Dorsal Vagal Shutdown","","Immobilization defense underlying freeze and collapse responses","Contemporary","Knowledge","med"),
],
"Shelley E. Taylor": [
    ("Tend-and-Befriend","","Female stress response of nurturing and seeking social bonds","Contemporary","Knowledge","high"),
    ("Social Support Theory","","Relationships buffering stress and promoting health","Contemporary","Knowledge","high"),
    ("Positive Illusions","","Self-enhancing beliefs supporting mental health and coping","Contemporary","Knowledge","high"),
    ("Cognitive Adaptation Theory","","Maintaining meaning, mastery and esteem after threatening events","Contemporary","Knowledge","high"),
    ("Health Psychology","","Psychological factors shaping illness, coping and recovery","Contemporary","Knowledge","med"),
],
"Anthony Greenwald": [
    ("Implicit Association Test","","Reaction-time measure of automatic attitudes and stereotypes","Contemporary","Knowledge","high"),
    ("Implicit Social Cognition","","Attitudes and beliefs operating outside conscious awareness","Contemporary","Knowledge","high"),
    ("Implicit Bias","","Unconscious associations influencing judgment and behavior","Contemporary","Knowledge","high"),
    ("Totalitarian Ego","","Self-serving biases reconstructing memory and self-image","Contemporary","Knowledge","med"),
    ("Self-Esteem (Implicit)","","Automatic, nonconscious evaluations of the self","Contemporary","Knowledge","med"),
],
"Carlo C. DiClemente": [
    ("Transtheoretical Model","","Behavior change unfolding through identifiable stages","Contemporary","Knowledge","high"),
    ("Stages of Change","","Precontemplation through maintenance in changing behavior","Contemporary","Knowledge","high"),
    ("Processes of Change","","Cognitive and behavioral activities driving stage progression","Contemporary","Knowledge","high"),
    ("Decisional Balance","","Weighing pros and cons in deciding to change","Contemporary","Knowledge","high"),
    ("Self-Efficacy (Change)","","Confidence in sustaining behavior change across situations","Contemporary","Knowledge","med"),
],
"Cohen": [
    ("Stress-Buffering Hypothesis","","Social support shielding people from the harm of stress","Modern","Web","high"),
    ("Main-Effect Model of Support","","Support benefiting well-being regardless of stress levels","Modern","Web","high"),
    ("Perceived Social Support","","Belief that support is available driving health benefits","Modern","Web","high"),
    ("Common Cold Studies","","Cohen's research linking social ties to infection resistance","Modern","Knowledge","med"),
],
"Wills": [
    ("Stress-Buffering Hypothesis","","Social support shielding people from the harm of stress","Modern","Web","high"),
    ("Functional Social Support","","Support functions matched to stress-elicited needs","Modern","Web","high"),
    ("Substance Use and Coping","","Wills's work on adolescent coping and substance use","Modern","Knowledge","med"),
],
"Ann Masten": [
    ("Resilience Theory","","Positive adaptation despite serious adversity or risk","Contemporary","Knowledge","high"),
    ("Ordinary Magic","","Resilience arising from common, everyday adaptive systems","Contemporary","Knowledge","high"),
    ("Protective Factors","","Resources and assets reducing the impact of risk","Contemporary","Knowledge","high"),
    ("Developmental Cascades","","Effects spreading across domains and time in development","Contemporary","Knowledge","high"),
    ("Competence Under Adversity","","Achieving developmental tasks despite difficult circumstances","Contemporary","Knowledge","med"),
],
"Sue Johnson": [
    ("Emotionally Focused Therapy","","Attachment-based couples therapy reshaping emotional bonds","Contemporary","Knowledge","high"),
    ("Adult Attachment","","Adult love understood through attachment needs and bonds","Contemporary","Knowledge","high"),
    ("Hold Me Tight","","Strengthening couples through accessibility and responsiveness","Contemporary","Knowledge","high"),
    ("Attachment Injury","","Relationship wound from abandonment at a moment of need","Contemporary","Knowledge","high"),
    ("Negative Interaction Cycles","","Self-reinforcing distress patterns trapping distressed couples","Contemporary","Knowledge","med"),
],
"Roman Jakobson": [
    ("Functions of Language","","Six communicative functions structuring any verbal message","Modern","Knowledge","high"),
    ("Poetic Function","","Language foregrounding its own form and palpability","Modern","Knowledge","high"),
    ("Metaphor and Metonymy","","Two axes of language: substitution and combination","Modern","Knowledge","high"),
    ("Russian Formalism","","Literary study focused on form, device and literariness","Modern","Knowledge","high"),
    ("Literariness","","The quality making a verbal message a work of art","Modern","Knowledge","high"),
    ("Markedness","","Asymmetry between marked and unmarked linguistic terms","Modern","Knowledge","med"),
],
"I.A. Richards": [
    ("Practical Criticism","","Close reading of poems stripped of author and context","Modern","Knowledge","high"),
    ("New Criticism","","Interpretation grounded in the text's internal structure","Modern","Knowledge","high"),
    ("Tenor and Vehicle","","Two components of metaphor: idea and its figurative carrier","Modern","Knowledge","high"),
    ("Emotive vs Referential Language","","Distinguishing scientific reference from emotive expression","Modern","Knowledge","high"),
    ("Stock Responses","","Conventional, habitual reactions obstructing genuine reading","Modern","Knowledge","med"),
],
"Gerard Genette": [
    ("Narratology","","Systematic theory of narrative structure and discourse","Modern","Knowledge","high"),
    ("Transtextuality","","Relations linking a text to other texts","Modern","Knowledge","high"),
    ("Paratext","","Thresholds like titles and prefaces framing a text","Modern","Knowledge","high"),
    ("Focalization","","Perspective regulating the information a narrative reveals","Modern","Knowledge","high"),
    ("Order, Duration, Frequency","","Temporal relations between story and narrative discourse","Modern","Knowledge","high"),
    ("Hypertextuality","","A later text transforming or imitating an earlier one","Modern","Knowledge","med"),
],
"Vladimir Propp": [
    ("Morphology of the Folktale","","Folktales reducible to a fixed sequence of functions","Modern","Knowledge","high"),
    ("Narrative Functions","","Thirty-one recurring actions structuring fairy tales","Modern","Knowledge","high"),
    ("Dramatis Personae","","Seven character roles recurring across folktales","Modern","Knowledge","high"),
    ("Spheres of Action","","Character roles defined by the functions they perform","Modern","Knowledge","high"),
    ("The Quest Structure","","Lack and its liquidation driving the folktale plot","Modern","Knowledge","med"),
],
"David T. Mitchell": [
    ("Narrative Prosthesis","","Disability as ubiquitous narrative crutch and metaphor in literature","Contemporary","Knowledge","high"),
    ("Cultural Locations of Disability","","Sites that materially manage and represent disabled bodies","Contemporary","Knowledge","high"),
    ("The Materiality of Metaphor","","Disability supplying meaning while its lived reality is erased","Contemporary","Knowledge","high"),
    ("Disability as Masquerade","","Representations using disability to signify deeper truths","Contemporary","Knowledge","med"),
],
"Sharon L. Snyder": [
    ("Narrative Prosthesis","","Disability as ubiquitous narrative crutch and metaphor in literature","Contemporary","Knowledge","high"),
    ("Cultural Model of Disability","","Disability as cultural and aesthetic, not merely medical or social","Contemporary","Knowledge","high"),
    ("Cultural Locations of Disability","","Sites that materially manage and represent disabled bodies","Contemporary","Knowledge","high"),
    ("Disability Aesthetics","","Disability's role in shaping artistic representation and value","Contemporary","Knowledge","med"),
],
"Terry Eagleton": [
    ("Ideology","","Beliefs and representations legitimating dominant social power","Contemporary","Knowledge","high"),
    ("Marxist Literary Criticism","","Reading literature through class, production and ideology","Contemporary","Knowledge","high"),
    ("Literary Theory: An Introduction","","Influential survey demystifying modern literary theory","Contemporary","Knowledge","high"),
    ("The Ideology of the Aesthetic","","Aesthetics as a discourse entangled with bourgeois ideology","Contemporary","Knowledge","high"),
    ("Criticism and Ideology","","Materialist account of literature's relation to ideology","Contemporary","Knowledge","med"),
],
"Pascale Casanova": [
    ("The World Republic of Letters","","Global literary space structured by unequal symbolic capital","Contemporary","Knowledge","high"),
    ("Literary Capital","","Prestige and recognition accumulated by languages and authors","Contemporary","Knowledge","high"),
    ("Greenwich Meridian of Literature","","A consecrating center setting literary modernity's standard","Contemporary","Knowledge","high"),
    ("Litterisation","","Translation into a dominant language conferring literary value","Contemporary","Knowledge","med"),
    ("World Literary Space","","Competitive transnational field of literary recognition","Contemporary","Knowledge","high"),
],
"Lisa Zunshine": [
    ("Cognitive Literary Studies","","Reading literature through cognitive science of mind","Contemporary","Knowledge","high"),
    ("Theory of Mind (Literary)","","Fiction exercising our capacity to attribute mental states","Contemporary","Knowledge","high"),
    ("Mind-Reading in Fiction","","Readers tracking characters' nested intentions and beliefs","Contemporary","Knowledge","high"),
    ("Embedded Mental States","","Layered representations of who thinks what about whom","Contemporary","Knowledge","high"),
    ("Why We Read Fiction","","Fiction's appeal rooted in cognitive mind-reading pleasure","Contemporary","Knowledge","med"),
],
"Patrick Colm Hogan": [
    ("Cognitive Literary Studies","","Reading literature through cognitive science of mind","Contemporary","Knowledge","high"),
    ("Affective Narratology","","Emotion as the organizing principle of narrative structure","Contemporary","Knowledge","high"),
    ("Cross-Cultural Story Prototypes","","Recurring emotion-based plot patterns across world literatures","Contemporary","Knowledge","high"),
    ("Romantic, Heroic, Sacrificial Prototypes","","Universal narrative prototypes organized by target emotions","Contemporary","Knowledge","med"),
    ("Poetics of Emotion","","How literary structure elicits and shapes feeling","Contemporary","Knowledge","high"),
],
"Joseph Carroll": [
    ("Literary Darwinism","","Interpreting literature through evolutionary human nature","Contemporary","Knowledge","high"),
    ("Evolutionary Literary Theory","","Literature explained by adaptive cognitive and social functions","Contemporary","Knowledge","high"),
    ("Human Nature in Literature","","Universal evolved dispositions shaping literary representation","Contemporary","Knowledge","high"),
    ("Adaptationist Criticism","","Reading texts as expressions of evolved motives","Contemporary","Knowledge","med"),
    ("Agonistic Structure","","Conflict reflecting evolved status and reproductive interests","Contemporary","Knowledge","med"),
],
"Graham Harman": [
    ("Object-Oriented Ontology","","All objects equally real, withdrawing from full relation","Contemporary","Knowledge","high"),
    ("Withdrawal","","Objects always exceeding any relation or access to them","Contemporary","Knowledge","high"),
    ("Vicarious Causation","","Objects interacting only indirectly through sensual qualities","Contemporary","Knowledge","high"),
    ("Real vs Sensual Objects","","Distinction between objects in themselves and as encountered","Contemporary","Knowledge","high"),
    ("Allure","","Aesthetic split between an object and its sensual qualities","Contemporary","Knowledge","med"),
],
"Erin Manning": [
    ("Aesthetics of Affect","","Art and movement as generative fields of affective intensity","Contemporary","Knowledge","high"),
    ("The Minor Gesture","","Small, neurodivergent variations opening new modes of experience","Contemporary","Knowledge","high"),
    ("Movement and Relation","","Thought emerging through bodily movement and relation","Contemporary","Knowledge","high"),
    ("Research-Creation","","Practice fusing artistic making with conceptual inquiry","Contemporary","Knowledge","med"),
    ("Preacceleration","","The incipient movement before movement actualizes","Contemporary","Knowledge","med"),
],
"Glenn Albrecht": [
    ("Solastalgia","","Distress from environmental change to one's home place","Contemporary","Knowledge","high"),
    ("Psychoterratic","","Mental states arising from the human-earth relationship","Contemporary","Knowledge","high"),
    ("Symbiocene","","Proposed era of human-nature symbiosis after the Anthropocene","Contemporary","Knowledge","high"),
    ("Earth Emotions","","Vocabulary for emotions tied to ecological loss and connection","Contemporary","Knowledge","med"),
    ("Tierratrauma","","Acute trauma from witnessing environmental destruction","Contemporary","Knowledge","med"),
],
"Edouard Glissant": [
    ("Creolization","","Unpredictable cultural mixing producing new, hybrid identities","Contemporary","Knowledge","high"),
    ("Poetics of Relation","","Identity formed through openness and relation, not roots","Contemporary","Knowledge","high"),
    ("Opacity","","The right to remain irreducible and not fully understood","Contemporary","Knowledge","high"),
    ("Tout-Monde","","The whole-world as chaotic, interconnected totality","Contemporary","Knowledge","high"),
    ("Antillanite","","Caribbean cultural identity rooted in archipelagic relation","Contemporary","Knowledge","med"),
    ("Rhizomatic Identity","","Identity spreading laterally rather than from a single root","Contemporary","Knowledge","med"),
],
"Katherine Hayles": [
    ("Posthuman","","Reconceiving the human as entangled with information and machines","Contemporary","Knowledge","high"),
    ("How We Became Posthuman","","History of cybernetics displacing the liberal human subject","Contemporary","Knowledge","high"),
    ("Electronic Literature","","Literature born digital and inseparable from computation","Contemporary","Knowledge","high"),
    ("Hyper vs Deep Attention","","Cognitive shift between rapid scanning and sustained focus","Contemporary","Knowledge","high"),
    ("Technogenesis","","Co-evolution of humans and technologies over time","Contemporary","Knowledge","med"),
    ("Distributed Cognition","","Thinking spread across bodies, tools and environments","Contemporary","Knowledge","med"),
],
"W.D. Hamilton": [
    ("Inclusive Fitness","","Reproductive success counting effects on relatives' genes","Modern","Knowledge","high"),
    ("Kin Selection","","Altruism evolving among genetic relatives","Modern","Knowledge","high"),
    ("Hamilton's Rule","","Altruism favored when relatedness times benefit exceeds cost","Modern","Knowledge","high"),
    ("Selfish Gene Logic","","Evolution viewed from the gene's-eye perspective","Modern","Knowledge","high"),
    ("Parasite Theory of Sex","","Sexual reproduction maintained by coevolving parasites","Modern","Knowledge","med"),
],
"L.L. Cavalli-Sforza": [
    ("Gene-Culture Coevolution","","Genes and culture jointly shaping human evolution","Modern","Knowledge","high"),
    ("Cultural Transmission","","Modeling how culture spreads like genetic inheritance","Modern","Knowledge","high"),
    ("Human Genetic Diversity","","Mapping global genetic variation across populations","Modern","Knowledge","high"),
    ("Demic Diffusion","","Population movement spreading genes and culture together","Modern","Knowledge","high"),
    ("History and Geography of Human Genes","","Synthesis correlating genetics with language and migration","Modern","Knowledge","med"),
],
"Sanfey et al.": [
    ("Neuroeconomics of Fairness","","Brain imaging of how people respond to unfair offers","Contemporary","Web","high"),
    ("Ultimatum Game (Neural Basis)","","Anterior insula activity driving rejection of unfair offers","Contemporary","Web","high"),
    ("Emotion in Economic Decision","","Affect, not just reason, shaping economic choices","Contemporary","Web","high"),
    ("Insula and Unfairness","","Disgust-related insula response to inequitable proposals","Contemporary","Web","med"),
],
"Robert Sapolsky": [
    ("Cortisol and Stress Response","","Glucocorticoid release and its costs to body and brain","Contemporary","Knowledge","high"),
    ("Why Zebras Don't Get Ulcers","","Chronic psychological stress harming human health","Contemporary","Knowledge","high"),
    ("Stress and the Brain","","Prolonged stress damaging hippocampal and prefrontal function","Contemporary","Knowledge","high"),
    ("Behave / Biology of Behavior","","Layered biological causes of human good and bad behavior","Contemporary","Knowledge","high"),
    ("Social Rank and Health (Baboons)","","Dominance hierarchy stress shaping primate physiology","Contemporary","Knowledge","med"),
],
"Sue Carter": [
    ("Oxytocin Theory of Bonding","","Oxytocin underpinning social attachment and pair bonding","Contemporary","Knowledge","high"),
    ("Pair Bonding (Prairie Voles)","","Monogamous voles revealing the neurochemistry of bonding","Contemporary","Knowledge","high"),
    ("Oxytocin and Vasopressin","","Neuropeptides regulating social behavior and stress","Contemporary","Knowledge","high"),
    ("Neurobiology of Love","","Hormonal basis of attachment, trust and partnership","Contemporary","Knowledge","high"),
    ("Sociality and Health","","Social bonds buffering stress and supporting physiology","Contemporary","Knowledge","med"),
],
"Randolph Nesse": [
    ("Evolutionary Medicine","","Explaining disease vulnerability through evolutionary trade-offs","Contemporary","Knowledge","high"),
    ("Mismatch Theory","","Modern environments mismatched with evolved bodies causing disease","Contemporary","Knowledge","high"),
    ("Why We Get Sick","","Darwinian framework reframing symptoms and vulnerability","Contemporary","Knowledge","high"),
    ("Smoke Detector Principle","","Defenses over-triggered because false alarms are cheaper","Contemporary","Knowledge","high"),
    ("Evolutionary Psychiatry","","Mental disorders understood via evolved emotional functions","Contemporary","Knowledge","med"),
],
"Helen Fisher": [
    ("Three Brain Systems of Love","","Lust, attraction and attachment as distinct neural systems","Contemporary","Knowledge","high"),
    ("Neurochemistry of Romantic Love","","Dopamine-driven attraction underlying intense romantic passion","Contemporary","Knowledge","high"),
    ("Anatomy of Love","","Evolutionary account of human mating, marriage and divorce","Contemporary","Knowledge","high"),
    ("Four Temperament Types","","Personality styles linked to dominant neurochemical systems","Contemporary","Knowledge","med"),
    ("Serial Monogamy","","Human pair-bonding evolved for sequential, not lifelong, mating","Contemporary","Knowledge","med"),
],
"Marco Iacoboni": [
    ("Mirror Neurons","","Neurons firing both when acting and watching others act","Contemporary","Knowledge","high"),
    ("Mirroring and Empathy","","Mirror systems grounding understanding of others' emotions","Contemporary","Knowledge","high"),
    ("Imitation and Learning","","Neural imitation mechanisms underpinning social learning","Contemporary","Knowledge","high"),
    ("Embodied Simulation","","Understanding others by inwardly simulating their actions","Contemporary","Knowledge","high"),
    ("Mirroring People","","Popular synthesis of mirror-neuron social neuroscience","Contemporary","Knowledge","med"),
],
"Antonio Damasio": [
    ("Somatic Marker Hypothesis","","Bodily emotional signals guiding rational decision-making","Contemporary","Knowledge","high"),
    ("Descartes' Error","","Emotion as essential to, not opposed to, reason","Contemporary","Knowledge","high"),
    ("Core vs Extended Consciousness","","Layered consciousness from momentary self to autobiographical self","Contemporary","Knowledge","high"),
    ("Feeling of What Happens","","Consciousness arising from the body's representation in the brain","Contemporary","Knowledge","high"),
    ("Homeostasis and Feeling","","Feelings as mental expressions of bodily life-regulation","Contemporary","Knowledge","med"),
],
"Till Roenneberg": [
    ("Social Jetlag","","Mismatch between internal clock and social schedule","Contemporary","Knowledge","high"),
    ("Chronotype","","Individual's biological timing of sleep and wakefulness","Contemporary","Knowledge","high"),
    ("Internal Time","","Body clock often misaligned with imposed clock time","Contemporary","Knowledge","high"),
    ("Munich Chronotype Questionnaire","","Tool measuring chronotype from sleep timing","Contemporary","Knowledge","med"),
    ("Chronotype and Health","","Circadian misalignment raising risks to health","Contemporary","Knowledge","med"),
],
"Amotz Zahavi": [
    ("Handicap Principle","","Costly signals are honest because only the fit can afford them","Modern","Knowledge","high"),
    ("Costly Signaling","","Reliable communication guaranteed by signal expense","Modern","Knowledge","high"),
    ("Honest Signaling","","Signals kept truthful by their burdensome cost","Modern","Knowledge","high"),
    ("Peacock's Tail","","Extravagant ornament as proof of underlying quality","Modern","Knowledge","high"),
    ("Altruism as Signal","","Generosity advertising status and quality to observers","Modern","Knowledge","med"),
],
"Larry Squire": [
    ("Declarative vs Non-Declarative Memory","","Conscious facts versus unconscious skills and habits","Contemporary","Knowledge","high"),
    ("Memory Consolidation","","Stabilizing new memories over time into long-term storage","Contemporary","Knowledge","high"),
    ("Medial Temporal Lobe Memory System","","Hippocampal circuitry essential for forming new memories","Contemporary","Knowledge","high"),
    ("Patient H.M. Studies","","Amnesia case revealing distinct memory systems","Contemporary","Knowledge","high"),
    ("Systems Consolidation","","Memories gradually becoming independent of the hippocampus","Contemporary","Knowledge","med"),
],
"Richard Alexander": [
    ("Indirect Reciprocity","","Cooperation rewarded through reputation, not direct return","Modern","Knowledge","high"),
    ("The Biology of Moral Systems","","Morality evolving from reciprocity and reputation management","Modern","Knowledge","high"),
    ("Reputation and Status","","Social standing as the currency of indirect reciprocity","Modern","Knowledge","high"),
    ("Eusociality and Conflict","","Evolution of cooperation amid genetic conflicts of interest","Modern","Knowledge","med"),
    ("Ecological Dominance Hypothesis","","Human evolution driven by intra-species social competition","Modern","Knowledge","med"),
],
"Abdel R. Omran": [
    ("Epidemiological Transition","","Shift from infectious to chronic disease as societies modernize","Modern","Knowledge","high"),
    ("Age of Pestilence and Famine","","Earliest mortality stage dominated by epidemics and hunger","Modern","Knowledge","high"),
    ("Age of Receding Pandemics","","Transitional stage of declining epidemic mortality","Modern","Knowledge","high"),
    ("Age of Degenerative Diseases","","Modern stage dominated by chronic and man-made diseases","Modern","Knowledge","high"),
    ("Mortality Transition","","Long-term changes in causes and patterns of death","Modern","Knowledge","med"),
],
"Brian Wynne": [
    ("Lay Expertise","","Non-scientists' situated knowledge as valid expertise","Contemporary","Knowledge","high"),
    ("Public Understanding of Science","","Critique of the deficit model of public scientific ignorance","Contemporary","Knowledge","high"),
    ("Sheep Farmers and Chernobyl","","Case showing experts ignoring valid local knowledge","Contemporary","Knowledge","high"),
    ("Reflexive Scientisation","","Public questioning the framing assumptions of expert science","Contemporary","Knowledge","med"),
    ("Trust and Risk","","Public risk judgments shaped by institutional trust","Contemporary","Knowledge","med"),
],
"George Ainslie": [
    ("Hyperbolic Discounting","","Steeply devaluing rewards as their delay increases","Contemporary","Knowledge","high"),
    ("Present Bias","","Overweighting immediate rewards over future ones","Contemporary","Knowledge","high"),
    ("Picoeconomics","","Bargaining among successive transient interests within a person","Contemporary","Knowledge","high"),
    ("Preference Reversal","","Switching choices as a tempting reward draws near","Contemporary","Knowledge","high"),
    ("Will and Bundling","","Self-control through bundling choices into broader patterns","Contemporary","Knowledge","med"),
],
"Matthew Rabin": [
    ("Fairness Equilibrium","","Game theory incorporating reciprocal fairness motives","Contemporary","Knowledge","high"),
    ("Reference-Dependent Preferences","","Utility judged against expectations or reference points","Contemporary","Knowledge","high"),
    ("Projection Bias","","Mispredicting future tastes from current states","Contemporary","Knowledge","high"),
    ("Asymmetric Paternalism","","Policies helping the irrational while barely costing the rational","Contemporary","Knowledge","med"),
    ("Law of Small Numbers","","Over-inferring patterns from tiny, random samples","Contemporary","Knowledge","med"),
],
"Klaus Schmidt": [
    ("Inequality Aversion","","Disliking unequal payoffs even at personal cost","Contemporary","Web","high"),
    ("Fehr-Schmidt Model","","Utility penalizing both advantageous and disadvantageous inequality","Contemporary","Web","high"),
    ("Theory of Fairness","","Fairness preferences explaining cooperation and competition","Contemporary","Web","high"),
    ("Other-Regarding Preferences","","Caring about others' payoffs alongside one's own","Contemporary","Web","med"),
],
"Armin Falk": [
    ("Reciprocity","","Rewarding kindness and punishing unkindness in others","Contemporary","Knowledge","high"),
    ("Intentions-Based Reciprocity","","Responses depending on perceived intentions, not just outcomes","Contemporary","Knowledge","high"),
    ("Preference Measurement","","Large-scale measurement of economic preferences across people","Contemporary","Knowledge","high"),
    ("Global Preferences Survey","","Worldwide mapping of patience, risk and social preferences","Contemporary","Web","med"),
    ("Morals and Markets","","How market interaction can erode moral concern","Contemporary","Knowledge","med"),
],
"James Andreoni": [
    ("Warm-Glow Giving","","Donating for the good feeling of giving itself","Contemporary","Knowledge","high"),
    ("Impure Altruism","","Giving mixing genuine altruism with personal satisfaction","Contemporary","Knowledge","high"),
    ("Crowding Out","","Public provision partly displacing private charitable giving","Contemporary","Knowledge","high"),
    ("Cooperation in Public Goods","","Patterns of contribution and decay in public-goods games","Contemporary","Knowledge","med"),
    ("Giving and Social Image","","Generosity motivated by how one appears to others","Contemporary","Knowledge","med"),
],
"Paul Zak": [
    ("Neuroeconomics of Trust","","Oxytocin underlying trust and trustworthiness in exchange","Contemporary","Knowledge","high"),
    ("Oxytocin and Economic Behavior","","Hormone shaping generosity, trust and cooperation","Contemporary","Knowledge","high"),
    ("The Moral Molecule","","Oxytocin framed as a biological basis for morality","Contemporary","Knowledge","high"),
    ("Trust and Prosperity","","Interpersonal trust as an engine of economic growth","Contemporary","Knowledge","med"),
],
"Robert Axelrod": [
    ("The Evolution of Cooperation","","How cooperation emerges among self-interested agents","Modern","Knowledge","high"),
    ("Tit-for-Tat","","Cooperate first, then mirror the opponent's last move","Modern","Knowledge","high"),
    ("Iterated Prisoner's Dilemma","","Repeated games making cooperation rationally sustainable","Modern","Knowledge","high"),
    ("Shadow of the Future","","Expected future interaction promoting present cooperation","Modern","Knowledge","high"),
    ("Evolutionary Game Theory","","Strategy success modeled through evolutionary dynamics","Modern","Knowledge","high"),
    ("Social Norms (Evolution)","","Computational accounts of how norms emerge and persist","Modern","Knowledge","med"),
],
"Harvey Leibenstein": [
    ("X-Efficiency","","Inefficiency from slack effort within non-competitive firms","Modern","Knowledge","high"),
    ("Bandwagon Effect","","Demand rising because others are consuming a good","Modern","Knowledge","high"),
    ("Snob Effect","","Demand falling as a good becomes more widely consumed","Modern","Knowledge","high"),
    ("Veblen Effect","","Demand rising with price for conspicuous status goods","Modern","Knowledge","high"),
    ("Critical Minimum Effort","","Development requiring a threshold push to escape stagnation","Modern","Knowledge","med"),
],
"Janet Yellen": [
    ("Fair Wage-Effort Hypothesis","","Workers reducing effort when pay falls below a fair wage","Contemporary","Knowledge","high"),
    ("Efficiency Wage Theory","","Above-market wages raising productivity and reducing turnover","Contemporary","Knowledge","high"),
    ("Wage Stickiness","","Fairness norms keeping wages from falling in downturns","Contemporary","Knowledge","high"),
    ("Near-Rational Behavior","","Small individual deviations producing large macro effects","Contemporary","Knowledge","med"),
],
"Edward Deci": [
    ("Intrinsic Motivation (Labor)","","Acting from inherent interest rather than external reward","Contemporary","Knowledge","high"),
    ("Self-Determination Theory","","Motivation driven by autonomy, competence and relatedness","Contemporary","Knowledge","high"),
    ("Overjustification Effect","","Rewards undermining preexisting intrinsic motivation at work","Contemporary","Knowledge","high"),
    ("Crowding Out of Motivation","","Incentives displacing internal drive to perform","Contemporary","Knowledge","high"),
    ("Autonomy at Work","","Self-endorsed action enhancing engagement and performance","Contemporary","Knowledge","med"),
],
}

# Map curated keys (ascii) to actual theorist names with diacritics
ALIASES = {
    "Rhacel Salazar Parrenas": "Rhacel Salazar Parreñas",
    "Bibb Latane": "Bibb Latané",
    "Gerard Genette": "Gérard Genette",
    "Edouard Glissant": "Édouard Glissant",
}
for ascii_k, real_k in ALIASES.items():
    if ascii_k in CUR and real_k not in CUR:
        CUR[real_k] = CUR.pop(ascii_k)

out_rows = []
n_theorists = 0
n_db = 0
n_web = 0
under3 = []

for t in order:
    info = rows_in[t]
    part, major, sub = info["part"], info["major"], info["sub"]
    n_theorists += 1
    seen = set()
    theorist_rows = []

    for c in info["existing"]:
        key = c.strip().lower()
        if key in seen:
            continue
        seen.add(key)
        theorist_rows.append([t, c.strip(), "", "", part, major, sub, "", "DB", "high"])
        n_db += 1

    for (concept, native, one_liner, era, source, conf) in CUR.get(t, []):
        key = concept.strip().lower()
        if key in seen:
            continue
        seen.add(key)
        theorist_rows.append([t, concept, native, one_liner, part, major, sub, era, source, conf])
        if source == "Web":
            n_web += 1

    eras = [r[7] for r in theorist_rows if r[7]]
    modal_era = max(set(eras), key=eras.count) if eras else "Contemporary"
    for r in theorist_rows:
        if r[7] == "":
            r[7] = modal_era

    out_rows.extend(theorist_rows)
    if len(theorist_rows) < 3:
        under3.append(t)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
    w.writerow(["theorist","concept","native","one_liner","part","major","sub","era","source","confidence"])
    for r in out_rows:
        w.writerow(r)

print("theorists:", n_theorists)
print("concept rows:", len(out_rows))
print("web-verified rows:", n_web)
print("under-3 theorists:", len(under3), under3)
longs = [r for r in out_rows if len(r[3].split()) > 15]
print("one_liners over 15 words:", len(longs))
for r in longs[:10]:
    print("   ", r[0], "|", r[3])
missing_cur = [t for t in order if t not in CUR]
print("theorists with no curated concepts:", len(missing_cur), missing_cur)
