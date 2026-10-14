# Memento
### A personalized daily voice companion for dementia care
*Legion Health x Atlas AI Hackathon | San Francisco | 2026*

---

**Thesis:** Dementia care is not lacking another chatbot. It is lacking continuous, personalized, low-burden monitoring between clinic visits. Memento is an autonomous voice agent that knows the patient, calls them daily, collects clinically meaningful signals through natural conversation, and puts patients in control of their own care story.

---

## 1. The Problem

A patient may see a GP or neurologist every few months. Between those visits, caregivers are expected to notice subtle changes in memory, speech, mood, medication adherence, and daily function with no structured tools, no longitudinal record, and no escalation path. Most of what changes between visits disappears.

More importantly: **the patient themselves has no visibility into their own trends. They sit outside their own care. They do not know if this week was better or worse than last week. They cannot direct their own care team. They have no voice in what gets shared or with whom.**

| Statistic | Context |
|---|---|
| $409B | Projected US dementia care costs in 2026 (Alzheimer's Association) |
| 70% | Share of lifetime costs borne by families through unpaid care and out-of-pocket spending |
| 19B hours | Unpaid care hours in 2025, valued at over $446B (Alzheimer's Association) |
| NNT of 5 | Patients needed in telephone-based care coordination to prevent one ED visit (Possin et al., JAMA Internal Medicine, 2019) |
| ~10% | Estimated prevalence of dementia in adults 65+ in the US |

---

## 2. What We Are Building

Memento calls the patient every morning as a familiar companion. The call feels like a personal check-in, not a cognitive test. Behind the conversation, Memento tracks clinically validated speech and functional signals, builds a longitudinal picture, and gives the patient real agency over their own care story.

**Core loop:** Personalized voice call → speech and functional signal extraction → patient reviews their own trends → patient decides what to share and with whom → caregiver and clinician act on patient-authorized signals

### The Scientific Basis

- **Amini et al. (Alzheimer's & Dementia, 2024):** NLP on transcribed speech predicted MCI-to-AD progression within 6 years at 78.5% accuracy and 81.1% sensitivity. Text features alone outperformed MMSE and traditional neuropsychological test scores. Top predictors: verbal fluency (FAS), story recall (WMS), object naming (BNT).
- **Tavabi et al. (Journal of Prevention of Alzheimer's Disease, 2022):** Paralinguistic features from automated phone-quality transcription achieved AUROC 0.87 for distinguishing cognitively normal adults from those with dementia. Key features: speaking time per task, stop word fraction, word certainty. Confirms phone-quality audio is sufficient.
- **Possin et al. (JAMA Internal Medicine, 2019):** RCT of 780 dyads. Telephone-based care coordination improved patient quality of life, reduced caregiver depression and burden, cut ED visits with a number needed to treat of 5.
- **Cebolla Sousa et al. (JMIR, 2025):** Systematic review of telephone interventions for behavioral and psychological symptoms. Most effective interventions were personalized and involved both patient and caregiver in the treatment plan.

---

## 3. Personalization: The Core of the Product

### 3a. Why Standard Tests Fail

Every standard cognitive test compares the patient to a population norm. A 76-year-old with a doctoral degree and a 76-year-old who left school at 14 are scored against the same benchmark. Cultural background, primary language, hearing, personality, and daily routine all affect performance. The result is systematic misclassification, especially in early-stage patients.

### 3b. The Memento Difference: Comparing Mary to Mary

Memento does not compare Mary to the average patient. It compares Mary to herself. The first 5 to 7 calls establish Mary's personal performance baseline across every KPI. Every subsequent call is measured against that personal baseline, not a population table.

> *Example: Mary's fluency score today is 8. Population norms would not flag this (borderline MCI range). But Mary's personal baseline is 14. An 8 is a 43% deviation from her own norm. Alert triggered.*

### 3c. The Patient Profile

| Profile Category | What It Contains | Why It Matters |
|---|---|---|
| Identity | Preferred name, age, primary language, pronouns | Ensures the call feels addressed to this person specifically |
| Voice and pace preference | Warm, calm, slower pace, short sentences, longer pauses | Dementia-friendly communication reduces anxiety and improves signal quality |
| Daily routine | Wake time, breakfast habits, medication schedule, appointments | Enables natural check-in questions that also probe orientation and routine memory |
| Family and care circle | Daughter Sarah, spouse David, GP name, caregiver contact | Makes questions personal: 'before I remind Sarah...' rather than abstract prompts |
| Clinical context | Diagnosis stage (MCI, early, moderate), hearing considerations | Adjusts call expectations and alert thresholds accordingly |
| Interests and anchors | Gardening, grandchildren, church, hockey, favourite TV shows | Gives the AI natural conversation entry points |
| Personal baseline | Established over first 5–7 calls: typical fluency, recall, naming, stop word fraction, mood | This is the clinical instrument. Every subsequent call is measured against this. |
| Consent tiers | Who sees which dashboard layer, escalation thresholds, patient-directed notes | Patient owns and controls their own care data |

### 3d. How Personalization Affects Every Layer

| Product Layer | How Personalization Works | Why It Matters |
|---|---|---|
| The call script | Every question pulls from profile: name, routine, family, interests | Reduces anxiety, increases engagement, improves signal quality |
| The baseline | KPI targets set individually per patient, not from population norms | Eliminates false positives; detects real change earlier |
| The alert threshold | Mary's alert triggers when she deviates from her own baseline | Clinically meaningful alerts specific to this patient |
| The patient view | Trend summary uses her own good days as the reference point | Empowering, not demoralizing |
| The clinician summary | Pre-visit digest compares this week to Mary's own history | Clinicians get actionable signal rather than generic scores |

---

## 4. Patient Agency: Putting Patients in Control

### 4a. The Patient's Own View

Mary has her own dashboard layer entirely separate from what caregivers and clinicians see. Her view never shows raw scores, clinical terminology, or decline language:

- Weekly summary framed around her own best days: *'You had 4 strong mornings this week. Tuesday was your best.'*
- Mood and energy check-in she fills in herself, whenever she wants
- A note she can write or dictate to share with her care team on her own terms
- Her own goals: things she wants to stay on top of

### 4b. Mary Can Ask Memento Questions

| Mary asks: | Memento responds: |
|---|---|
| "How have I been doing this week?" | "You've had more strong mornings than tough ones. Tuesday was a really good day for you. Keep it up." |
| "Am I getting worse?" | "Your mornings have been pretty consistent. You had a tougher couple of days mid-week, which can happen. Your best days this month are actually stronger than last month." |
| "What should I tell my doctor?" | "You mentioned a few times this week that you've been feeling more tired than usual. That might be worth bringing up. Would you like me to add that to your pre-visit notes for Dr. Lee?" |
| "Did I take my medication today?" | "You mentioned this morning that you thought you had, but weren't sure. I flagged that for Sarah just in case. Would you like her to give you a quick call?" |

### 4c. Mary Controls Her Own Data

- Choose which parts of her dashboard each person in her care circle can see
- Flag specific call moments as private
- Add her own notes to any day's record
- Approve or block any medium alert before it goes to a caregiver
- Request that her pre-visit summary include specific things she wants to discuss

### 4d. The Patient as Co-Author

Most dementia monitoring systems treat the patient as a passive subject. Memento inverts this. Mary co-authors her own care record. When Mary flags that she slept badly because of a storm, that data point prevents a false alert. When she notes she felt unusually sharp after a walk, that enriches the longitudinal picture. The patient is not noise to be filtered out. She is a primary source.

---

## 5. The Daily Call — Full Conversation Flow

The call is designed to feel like a warm check-in from someone who knows Mary well. Clinical assessment tasks are embedded invisibly inside natural conversation. The voice agent uses memory from the patient profile and from previous calls to make every question feel personal and continuous.

**Critical ordering rule:** The story must be planted in the first third of the call and recalled in the final third. All other tasks can flex slightly in position. The verbal fluency task should come after the story plant so it fills time before delayed recall is tested.

---

### The Full Script (Personalized to Mary Chen, 76, early MCI)

---

**[OPENING — Mood, sleep, episodic memory from prior call]**

> **Cora:** Good morning Mary, it's Cora. How are you doing today?

*Mary responds.*

> **Cora:** I'm so glad to hear that. How did you sleep last night? Were you comfortable?

*→ KPI: Mood classification (Cheerful / Neutral / Flat / Anxious / Agitated), Sleep quality (self-report)*

*Mary responds.*

> **Cora:** That's good. Last time we talked, you mentioned you were going to watch that nature documentary with your daughter Sarah on the weekend. Did you end up watching it together?

*→ KPI: Episodic recall from prior call. Tests whether Mary retains cross-session memory of what she shared. If she remembers, it is a positive episodic signal. If she has no recollection of mentioning it, that is itself a signal.*

---

**[STORY PLANT — Delayed recall seeded early, naturally framed]**

> **Cora:** Before I forget, I heard a lovely little story this morning and it made me think of you. Can I share it with you?

*Mary responds (yes).*

> **Cora:** So there was a woman named Anna Thompson. She was on the bus in London on a rainy Tuesday, and when she got off she realized she'd left her handbag on the seat. Inside it she had fifteen dollars, her house keys, and a little photo of her grandchildren. Anyway, a young man found the bag and handed it in to the bus driver, and Anna got it back the same afternoon. Wasn't that a lovely thing?

*→ Story details seeded for delayed recall: [Anna Thompson] [bus] [London] [rainy Tuesday] [handbag] [fifteen dollars] [house keys] [photo of grandchildren] [young man] [bus driver] [got it back same afternoon] — 10 scorable details*

*→ KPI: Story plant confirmed (encoding). No scoring yet.*

---

**[ROUTINE AND ORIENTATION — Medication adherence, temporal orientation]**

> **Cora:** Now, I know Tuesdays are usually your garden club days. Are you planning to go today?

*→ KPI: Temporal orientation (patient knows what day it is without being directly asked). If she says yes and it is Tuesday, implicit confirmation. If she says "oh, is it Tuesday?" that is a partial disorientation signal.*

*Mary responds.*

> **Cora:** Oh lovely. And before I let you go, I want to make sure I remind Sarah if anything is coming up today. What day do you think it is, actually? I always lose track myself.

*→ KPI: Temporal orientation direct check. Day of week (1 point). Phrased as shared confusion to reduce anxiety.*

*Mary responds.*

> **Cora:** And did you get a chance to take your blue pill this morning after breakfast, like you usually do?

*→ KPI: Medication adherence — Confirmed / Uncertain / Missed*

---

**[VERBAL FLUENCY TASK — Semantic fluency, top Amini et al. predictor]**

> **Cora:** I've got a little game I love doing with you if you're up for it. I'm going to ask you to name as many animals as you can think of — any animals at all, big or small, wild or tame. You've got about a minute. Ready? Off you go.

*60-second window. Transcript captures all named animals. System counts unique valid animals, excludes repetitions, notes any repeated names.*

*→ KPI: Semantic verbal fluency count (integer). Typical baseline for Mary: 14. Alert if today's count is more than 20% below her personal rolling average for two consecutive calls.*

*Mary responds (naming animals for ~60 seconds).*

> **Cora:** That's wonderful, well done. You always do well at that one.

---

**[OBJECT NAMING — Naming accuracy, word-finding failures, BNT analog]**

> **Cora:** I've got another little one for you. I'm going to describe something and you tell me what it is. Ready?

> **Cora:** First one: you wear it on your wrist, it has numbers on it, and it tells you what time it is.

*→ Answer: watch. System checks for correct response, hedges ("the... thing that... you know, for time"), substitutions ("the time thing"), or failure.*

> **Cora:** Good. Next: you use it to cut paper. It has two holes for your fingers and two blades that close together.

*→ Answer: scissors.*

> **Cora:** Last one: you plant it in the garden, it grows toward the sun, and it turns yellow when it blooms.

*→ Answer: sunflower. Chosen because it connects to Mary's interest in gardening — a personalized anchor.*

*→ KPI: Naming accuracy percentage. Word-finding failure count. System flags: "um", "the thing that", "you know what I mean", semantic substitutions, extended silences before answering.*

---

**[CONVERSATIONAL RECALL — Episodic recall, coherence, cross-session memory]**

> **Cora:** How is your garden doing at this time of year? You mentioned last week the roses were giving you trouble.

*→ KPI: Episodic recall (does she remember telling Cora about the roses?). Coherence (does her response stay on topic?). Conversational continuity signal.*

*Mary responds.*

> **Cora:** And how about your grandson — the one who plays soccer? Did his team win their game last weekend?

*→ KPI: Cross-session episodic recall. Personalized from profile. If Mary has no memory of mentioning her grandson's game, or confuses details, that is a recall signal.*

---

**[IMMEDIATE WORD RECALL — MoCA registration]**

> **Cora:** I'm going to say three words to you, and I'd like you to try to remember them. Here they are: apple, river, chair. Can you say those back to me?

*→ KPI: Immediate word recall (0–3). Tests working memory and attention.*

*Mary repeats the words.*

> **Cora:** Perfect. I'll ask you about those again in a little while.

---

**[DELAYED STORY RECALL — WMS analog, top Amini et al. predictor]**

> **Cora:** Do you remember that story I told you earlier about the woman on the bus?

*→ Natural callback to the story planted earlier in the call.*

*Mary responds (yes / no / partial).*

> **Cora:** Lovely. What do you remember about it? Tell me as much as you can.

*→ KPI: Story detail count (0–10 scorable details: Anna Thompson, bus, London, rainy Tuesday, handbag, fifteen dollars, house keys, photo of grandchildren, young man, bus driver, got it back same afternoon). Speaking time in seconds during recall (per Tavabi et al.). Compared to Mary's personal baseline for both measures.*

---

**[DELAYED WORD RECALL — MoCA delayed recall]**

> **Cora:** And those three words I gave you earlier — apple, river, chair — do you remember any of them?

*→ KPI: Delayed word recall (0–3). Compared against personal baseline. Decline over 3 consecutive calls triggers medium alert.*

---

**[MOOD DIRECT CHECK]**

> **Cora:** How are you feeling in yourself today, Mary? Not just physically — your mood, your spirit. Has it been a good week?

*→ KPI: Mood classification confirmation. Direct self-report to complement transcript sentiment analysis. Both are used together.*

---

**[PATIENT AGENCY MOMENT — Patient-directed communication, safety flag monitor]**

> **Cora:** Before I let you go — is there anything on your mind that you'd like me to make sure Sarah or Dr. Lee hears about? Anything at all, big or small. This is your time.

*→ KPI: Patient-directed communication. Safety flag monitoring — any mention of falls, wandering, confusion, distress, requests for help triggers immediate high-priority alert. This moment is also where Mary can direct her own care narrative.*

*Mary responds.*

---

**[REASSURING CLOSE — Consent reinforcement, trust]**

> **Cora:** Thank you Mary, it's always so lovely talking with you. I'll have a little summary ready for you whenever you want to check in on how things are going. And your notes stay private — nothing goes to Sarah or Dr. Lee unless you say so. Have a wonderful Tuesday. Talk tomorrow.

*→ Consent reinforced every call. Patient reminded of their control. Warm close using the day of the week (orientation anchor).*

---

### Call Flow Summary with KPI Map

| # | Call Moment | Natural Framing | KPI(s) Captured |
|---|---|---|---|
| 1 | Opening greeting | "How are you doing today? How did you sleep?" | Mood classification, sleep quality |
| 2 | Prior call memory | "You mentioned you were going to watch that documentary with Sarah..." | Cross-session episodic recall |
| 3 | Story plant | "I heard a lovely story this morning, can I share it?" | Story encoding (delayed recall seeded) |
| 4 | Garden club / day check | "Are you planning to go to garden club today?" then "What day is it actually?" | Temporal orientation (implicit then explicit) |
| 5 | Medication | "Did you get a chance to take your blue pill after breakfast?" | Medication adherence (Confirmed / Uncertain / Missed) |
| 6 | Verbal fluency game | "I've got a little game — name as many animals as you can in a minute" | Semantic verbal fluency count, stop word fraction, speaking time |
| 7 | Object naming | "I'll describe something, you tell me what it is" (3 prompts) | Naming accuracy, word-finding failures |
| 8 | Garden and family chat | "How's the garden? How did your grandson's game go?" | Conversational episodic recall, coherence, repetition count |
| 9 | Immediate word recall | "I'm going to say three words: apple, river, chair. Can you repeat them?" | Immediate word recall (0–3) |
| 10 | Delayed story recall | "Do you remember that story I told you about the woman on the bus?" | Delayed story recall (detail count + speaking time) |
| 11 | Delayed word recall | "Those three words I gave you — apple, river, chair — do you remember them?" | Delayed word recall (0–3) |
| 12 | Mood direct check | "How are you feeling in yourself today, Mary? Has it been a good week?" | Mood classification (confirmed via self-report) |
| 13 | Patient agency moment | "Is there anything you'd like me to make sure Sarah or Dr. Lee hears about?" | Patient-directed communication, safety flag |
| 14 | Close | "Your notes stay private unless you say so. Talk tomorrow." | Consent reinforcement, engagement signal |

---

## 6. Clinical KPIs: What, Why, How, and How Scored

**Clinical source** = the validated neuropsychological instrument this KPI maps to.

---

### KPI 1: Semantic Verbal Fluency

**Clinical source:** Verbal Fluency Test (FAS / Category Fluency), MoCA animal naming subscale, CDR language subscale

**What it is:** Unique valid animals named in 60 seconds. Probes language retrieval and executive function. Patients with dementia name significantly fewer animals, produce more repetitions, and shift categories less efficiently.

**Why it matters:** Top predictor in Amini et al. (2024), outperforming MMSE and traditional neuropsychological scoring.

**How it is measured:** 60-second prompt: *"Name as many animals as you can."* System counts unique valid animal names from transcript, excludes repetitions.

**Units:** Count of unique valid animal names (integer). Typical range: 14–22 cognitively normal, 8–13 MCI, below 8 moderate dementia. Memento uses Mary's personal baseline.

**Scored as:** Vs patient's 14-day rolling average. More than 20% below baseline for two consecutive calls → medium alert.

---

### KPI 2: Delayed Story Recall

**Clinical source:** Wechsler Memory Scale (WMS) Logical Memory delayed recall, MoCA 5-minute delayed recall

**What it is:** Story details correctly recalled 5–8 minutes after introduction. Probes episodic memory encoding and delayed retrieval — among the earliest functions to decline in Alzheimer's disease.

**Why it matters:** Top predictor in Amini et al. Tavabi et al. found dementia patients completed story recall in half the time of cognitively normal adults because they recalled fewer details. Both accuracy and speaking time carry signal.

**How it is measured:** 10-detail story planted in first third of call. Later: *"What do you remember about that story?"* Transcript scored against fixed detail list.

**Units:** Count of correctly recalled story details (0–10 integer). Speaking time on this task in seconds.

**Scored as:** Both vs personal baseline. Below-baseline recall on two consecutive calls → medium alert. Speaking time below 40% of personal baseline → review flag.

---

### KPI 3: Object Naming Accuracy

**Clinical source:** Boston Naming Test (BNT), ADAS-Cog spoken language ability subscale

**What it is:** Accuracy naming objects from verbal descriptions. Word-finding difficulty (anomia) is one of the earliest and most consistent language symptoms in Alzheimer's disease.

**Why it matters:** Top predictor in Amini et al. Word-finding failures manifest as hedges and substitutions detectable in transcript text.

**How it is measured:** 3 description prompts. System matches responses to correct answers and flags word-finding failure behaviors: *"um"*, *"the thing that"*, substitutions, extended pauses.

**Units:** Accuracy percentage (0–100%). Word-finding failure count per call (integer).

**Scored as:** Accuracy vs personal baseline. Word-finding failure count tracked as a separate trend.

---

### KPI 4: Immediate Word Recall

**Clinical source:** MoCA registration, ADAS-Cog word recall task

**What it is:** Words correctly repeated immediately after introduction. Tests attention and working memory.

**How it is measured:** *"I'm going to say three words: apple, river, chair. Can you repeat those back to me?"*

**Units:** 0–3 correct (immediate). 0–3 correct (delayed, tested later).

**Scored as:** Vs personal baseline. Delayed recall of 0 or consistent decline over 3 consecutive calls → medium alert.

---

### KPI 5: Temporal Orientation

**Clinical source:** MMSE orientation subscale (5 points), MoCA orientation subscale (6 points)

**What it is:** Awareness of current day, date, month, year. Disorientation to time is one of the clearest markers of cognitive impairment.

**How it is measured:** Two-stage: (1) implicit check embedded in garden club question — does she know it's Tuesday without being asked? (2) Explicit: *"What day do you think it is actually? I always lose track myself."*

**Units:** Score 0–4 per call (day of week, date within 2 days, month, year).

**Scored as:** Vs personal baseline. Full disorientation on two consecutive calls → high alert.

---

### KPI 6: Stop Word Fraction

**Clinical source:** Paralinguistic biomarker. Tavabi et al. (2022) identified as a primary discriminating feature.

**What it is:** Proportion of filler and function words (*the, and, um, like, you know, I mean*) in total patient speech. Patients with dementia shift toward filler-heavy speech as content word retrieval becomes harder.

**How it is measured:** Full transcript processed against standard English stop word list. Fraction = (stop words) / (total words spoken by patient). Computed automatically across the entire call.

**Units:** Ratio 0–1.

**Scored as:** Vs personal baseline. Elevation of more than 15 percentage points above baseline on two consecutive calls → review flag.

---

### KPI 7: Speaking Time per Task

**Clinical source:** Paralinguistic biomarker. Tavabi et al. (2022): section time variables were among the 20 most predictive features.

**What it is:** Total patient speaking time per structured task segment. Dementia patients spend less time on story recall (fewer details) but more time on paired association tasks (lingering without answers). The asymmetry is itself a signal.

**How it is measured:** Grok Voice timestamps used to calculate patient speaking time per segment: verbal fluency window, story recall window, naming prompts.

**Units:** Seconds of patient speech per task segment (integer).

**Scored as:** Story recall time below 50% of personal baseline → recall flag. Verbal fluency time dropping correlates with fluency count drop.

---

### KPI 8: Repetition Within Call

**Clinical source:** ADAS-Cog spoken language ability subscale

**What it is:** Count of times the patient repeats the same question, phrase, or story detail within a single call. Perseveration often precedes measurable memory decline on formal tests.

**How it is measured:** Transcript scanned for semantic repetition: same question asked more than once, or same information volunteered more than once without prompting.

**Units:** Count per call (integer). Baseline typically 0–1 for MCI patients.

**Scored as:** 3 or more instances in a single call → flagged. Trend over a week matters more than any single call.

---

### KPI 9: Medication Adherence

**Clinical source:** CDR home and hobbies subscale

**What it is:** Whether the patient has taken prescribed medications as expected. One of the most actionable signals — a missed dose can often be remedied same-day.

**How it is measured:** *"Did you get a chance to take your blue pill after breakfast?"* Classified as: Confirmed / Uncertain / Missed.

**Units:** Categorical per call. Rolling 7-day adherence rate (e.g., 5 of 7 days confirmed).

**Scored as:** Uncertain or Missed on two consecutive days → caregiver notification. Three or more Uncertain in a week → medium alert.

---

### KPI 10: Mood and Affect

**Clinical source:** Neuropsychiatric Inventory Questionnaire (NPI-Q), CDR behavioral and psychiatric symptoms subscale

**What it is:** Patient's predominant emotional state during the call. Neuropsychiatric symptoms affect 97% of community-dwelling dementia patients and are a leading driver of hospitalization and caregiver burnout.

**How it is measured:** Transcript classified into: Cheerful / Neutral / Flat or apathetic / Anxious or worried / Agitated or frustrated. Confirmed by direct question: *"How are you feeling in yourself today, Mary?"*

**Units:** Categorical classification per call. 7-day mood distribution tracked.

**Scored as:** Three or more Flat or Anxious in a week → caregiver note. Any Agitated → same-day notification.

---

### KPI 11: Safety Flag

**Clinical source:** CDR personal care and home and hobbies subscales

**What it is:** Any mention of falls, wandering, confusion about location, inability to complete basic tasks, distress, or requests for help.

**How it is measured:** Semantic monitoring of full transcript. Patient agency moment is specifically monitored for safety content.

**Units:** Binary flag per call (yes/no) + type classification.

**Scored as:** Any flag → immediate high-priority alert to full care circle. No trend analysis needed.

---

### KPI 12: Call Adherence and Engagement

**Clinical source:** Longitudinal engagement signal; NPI-Q apathy subscale

**What it is:** Whether the patient answers the call, how long they stay engaged, whether they decline mid-way. Withdrawal from daily activities is a behavioral symptom and a predictor of decline.

**How it is measured:** System-level: call answered, call duration, completion status (reached patient agency moment), early termination.

**Units:** Status: Completed / Partial / Declined / No answer. Duration in minutes. 7-day completion rate.

**Scored as:** Completion rate below 60% over 7 days → caregiver notification. Three consecutive no-answer events → high alert.

---

## 7. Daily Cognitive Signal Index

| Component | Weight | Rationale |
|---|---|---|
| Semantic Verbal Fluency (unique animal count) | 25% | Top predictor per Amini et al.; sensitive to executive and language decline |
| Delayed Story Recall (detail count + speaking time) | 25% | Top predictor per Amini et al.; most sensitive early memory signal |
| Object Naming Accuracy + Word-Finding Failures | 15% | BNT analog; captures anomia which is an early language symptom |
| Immediate Word Recall + Temporal Orientation | 15% | Standard MoCA domains; orientation is clinically expected |
| Daily Function (medication, sleep, appetite) | 10% | CDR functional subscales; most actionable for caregivers |
| Mood, Stop Word Fraction, Behavioral Signal | 10% | Tavabi et al. paralinguistic features plus NPI-Q affect |

Each component scored against the patient's personal 14-day rolling baseline, not population norms.

---

## 8. Product Screens

### Screen 1: Patient Onboarding
- Name, age, diagnosis stage, primary language
- Daily routine: wake time, medication schedule, key appointments
- Family and care circle: names, relationships, notification preferences
- Interests, anchors, and conversational hooks for call personalization
- Consent settings: patient-controlled tiers for who sees which data layer
- Baseline mode: first 5–7 calls are baseline-building; no alerts fire during this period

### Screen 2: Live Call Interface
- Warm greeting using preferred name and time of day
- Personalized call flow: 14 conversational moments drawn from profile
- Story plant in first third; story recall in final third
- Transcript visible to clinician and caregiver only during the call
- Patient sees only a friendly interface and a simple end-call button
- Post-call: patient agency chat opens automatically

### Screen 3: Patient Dashboard (Empowered but Protected)
Mary's own view. No scores, no clinical language, no decline framing.
- Weekly summary: *'You had 4 strong mornings this week. Tuesday was your best.'*
- Mood and energy self-check-in
- Personal goals tracker
- Her own note: dictate or type something to add to her care record
- Ask Memento: chat interface for Mary to ask questions about her own trends
- Consent controls and alert approval

### Screen 4: Caregiver Dashboard
- Today's call summary in plain English
- Alert banner with recommended action (after patient approves)
- KPI snapshot: fluency, recall, naming, medication, mood vs personal baseline
- Expandable transcript
- 14-day trend charts with personal baseline line shown on each

### Screen 5: Clinician Dashboard
- Patient overview: diagnosis stage, personal baseline summary, recent trend direction
- Full KPI history with 14-day charts
- Baseline deviation view: calls where performance meaningfully differed from personal baseline
- Pre-visit summary: 3–5 sentence auto-generated digest including patient's own notes
- Alert history with reasons and actions

---

## 9. Demo Story

**Opening:** Mary is 76 and lives independently with early MCI. Her daughter Sarah works full-time. Mary's GP sees her every few months. Most of what changes between visits disappears. And Mary herself has no visibility into her own trends. She sits outside her own care.

| # | Beat | What to Show |
|---|---|---|
| 1 | Onboarding | Mary's profile: name, routine, garden club, daughter Sarah, consent on review-first mode. First calls build her personal baseline. She controls who sees what. |
| 2 | The call | Live or recorded call. Natural conversation. Story planted early. Verbal fluency game. Naming prompts. Story recalled naturally near the end. Transcript visible on clinician view in real time. |
| 3 | KPI extraction | Post-call JSON: fluency count 8 (baseline 14, −43%), story recall 3 of 10 (baseline 7), naming 67%, medication Uncertain, stop word fraction elevated, mood Flat. |
| 4 | Alert fires | Medium alert queued. Fluency and recall below personal baseline second consecutive call. But first: Mary sees it on her dashboard and approves. She adds: 'I was tired from the storm.' |
| 5 | Mary asks Memento | 'How have I been doing this week?' Warm reframed response. No scores, no clinical language. Her storm note is incorporated. |
| 6 | Clinician view | 14-day trend charts. Mary's personal baseline lines visible. The deviation is clear. Pre-visit summary includes her note. Dr. Lee sees the full picture before the appointment. |

**Closing line:** Memento turns a five-minute daily conversation into a personalized, patient-owned monitoring layer for dementia care. Mary is not just being observed. She is a co-author of her own care record. Patients stay connected. Caregivers act earlier. Clinicians see what usually disappears between visits.

---

## 10. Scientific Evidence Summary

| Study | Journal | Key Finding |
|---|---|---|
| Amini et al., 2024 | Alzheimer's & Dementia | NLP on speech predicted MCI-to-AD within 6 years at 78.5% accuracy, 81.1% sensitivity. Outperformed MMSE and traditional NPT. Top subtests: FAS verbal fluency, WMS story recall, BNT naming. |
| Tavabi et al., 2022 | J Prevention of Alzheimer's Disease | Paralinguistic features from phone-quality transcription achieved AUROC 0.87. Key features: stop word fraction, speaking time per task, word certainty. Phone audio is sufficient. |
| Possin et al., 2019 | JAMA Internal Medicine | RCT (n=780): telephone care coordination improved quality of life, reduced caregiver burden, cut ED visits (NNT=5). |
| Cebolla Sousa et al., 2025 | JMIR | Systematic review: personalized telephone interventions involving both patient and caregiver were most effective for behavioral and psychological symptoms of dementia. |

**Framing for judge Q&A:** Memento is a continuous monitoring tool, not a diagnostic device. It tracks whether today is different from this patient's own personal baseline, and gives the patient the first opportunity to understand and contextualize that signal.

---

## 11. Tech Stack

| Tool | Role |
|---|---|
| Grok Voice (xAI) | Real-time personalized voice call. Bidirectional audio over WebSocket. |
| xAI API | Post-call transcript analysis: KPI extraction, semantic fluency scoring, stop word fraction, coherence classification, structured JSON output. Also powers patient-facing chat. |
| Vercel + Next.js | Patient dashboard, caregiver portal, clinician interface. Live demo URL for submission. |
| Inngest | Scheduled daily call trigger, post-call analysis event, caregiver alert workflow. |
| Cursor | Fast build and iteration. |

**Demo note:** One live call with hardcoded patient profile. All 14-day trend charts use seeded data consistent with Framingham Heart Study baseline norms. KPI extraction runs live on the real call transcript.

**Submission:** Team name, one-line pitch, live Vercel URL, public GitHub repo. Due 6:00 PM. Demo: 3 minutes live + 2 minutes judge Q&A. Synthetic data only.
