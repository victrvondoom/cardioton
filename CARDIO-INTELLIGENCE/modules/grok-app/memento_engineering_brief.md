# Memento — Engineering Brief
*Hackathon build doc for engineers. One-page reference. Full overview doc has all context.*

---

## What We Are Building

A personalized daily voice agent for dementia patients. Grok Voice calls Mary every morning, has a warm natural conversation, extracts clinical speech signals from the transcript, and surfaces a longitudinal dashboard to the patient, caregiver, and clinician. The patient controls what gets shared and with whom.

**Core loop:** Grok Voice call → transcript → KPI extraction (xAI API) → score vs personal baseline → patient sees trends first → patient approves alerts → caregiver / clinician dashboard

**Key framing:** Not diagnosis. Continuous monitoring. Not population norms. Personal baseline. Patient is not a passive subject. She co-authors her own care record.

---

## Stack

| Tool | What It Does |
|---|---|
| Grok Voice (xAI) | Runs the daily patient call. Bidirectional audio over WebSocket. Personalized script generated from patient profile. |
| xAI API (post-call) | Takes the transcript. Extracts all KPIs. Returns structured JSON. Also powers the patient-facing chat (ask Memento about your week). |
| Vercel + Next.js | All UI: patient view, caregiver dashboard, clinician dashboard, onboarding. Live URL required for submission. |
| Inngest | Scheduled daily call trigger. Post-call analysis event. Caregiver alert event. Show these in the demo even if not fully wired. |

---

## Screens to Build

### 1. Patient Onboarding
- Name, age, diagnosis stage, language, daily routine, medication name, care circle contacts
- Interest and anchor fields: things the call references naturally (garden club, grandkids, favourite TV show)
- Consent tier settings: patient chooses what each person in their care circle can see
- Baseline mode toggle: first 5–7 calls are baseline-building. No alerts fire. Show this state in demo.

### 2. Live Call Interface (Grok Voice)
- Display patient name and friendly avatar during the call
- Show transcript appearing in real time on the clinician/caregiver layer
- Patient-facing side shows only avatar + end call button. No scores, no transcript shown to patient.
- Post-call: patient agency chat opens automatically

### 3. Patient Dashboard (Empowered but Protected)
- Weekly summary in warm plain language: *'You had 4 strong mornings this week. Tuesday was your best.'*
- Ask Memento chat: patient types a question, xAI API responds with reframed encouraging language. No scores, no decline framing.
- Self mood check-in: simple daily input the patient can fill in themselves
- Add a note: patient can dictate or type context for their record (*'I was tired because of the storm'*)
- Consent controls: patient manages who sees what from this screen
- Alert approval: if a medium alert is ready to go to Sarah, Mary sees it here first and approves or adds context

### 4. Caregiver Dashboard
- Today's call summary in plain English
- Alert banner + recommended action (only fires after patient approves or patient has set auto-approve)
- KPI snapshot: fluency, recall, naming, medication, mood — each shown as today vs personal baseline with the personal baseline line visible
- 14-day trend charts (hardcode seeded data for demo). Show baseline line on each chart.
- Expandable transcript

### 5. Clinician Dashboard
- Same KPI history as caregiver but with clinical labels (semantic fluency, delayed recall, etc.)
- Baseline deviation view: which calls were meaningfully different from personal baseline
- Pre-visit summary: 3–5 sentence auto-generated digest. Pull from xAI API. Include patient's own notes.
- Alert log with reasons

---

## The Call: Full Conversation Flow with KPI Map

The call is built to feel like a warm check-in from someone who knows Mary well. Every clinical task is embedded invisibly inside natural conversation. The voice agent uses memory from the patient profile and from previous calls to make every question feel personal and continuous.

**Critical ordering rule:** The story must be planted in the first third of the call and recalled in the final third. The verbal fluency task goes in the middle — it fills time between plant and recall, which is exactly how the WMS delayed recall protocol works.

---

### Complete Script (Mary Chen, 76, early MCI, Tuesday morning)

---

**[OPENING]**

> **Cora:** Good morning Mary, it's Cora. How are you doing today?

*[Mary responds]*

> **Cora:** I'm so glad to hear that. How did you sleep last night? Were you comfortable?

| KPI | How extracted |
|---|---|
| Mood classification | Sentiment + affect of Mary's response. Cheerful / Neutral / Flat / Anxious / Agitated. |
| Sleep quality | Self-report classification from response content. |

---

> **Cora:** That's good. Last time we talked you mentioned you were going to watch that nature documentary with Sarah on the weekend. Did you end up watching it together?

| KPI | How extracted |
|---|---|
| Cross-session episodic recall | Does Mary remember telling Cora about this? If she has no recollection of mentioning it, that is a recall signal. Correct recall is a positive signal. |

---

**[STORY PLANT — must happen in first third of call]**

> **Cora:** Before I forget — I heard the sweetest little story this morning and it made me think of you. Can I share it?

*[Mary responds yes]*

> **Cora:** So there was a woman named Anna Thompson. She was on the bus in London on a rainy Tuesday, and when she got off she realized she'd left her handbag on the seat. Inside it she had fifteen dollars, her house keys, and a little photo of her grandchildren. Anyway, a young man found the bag and handed it in to the bus driver, and Anna got it back the same afternoon. Wasn't that lovely?

| KPI | How extracted |
|---|---|
| Story plant confirmed | No scoring yet. 10 details seeded: [Anna Thompson] [bus] [London] [rainy Tuesday] [handbag] [fifteen dollars] [house keys] [photo of grandchildren] [young man] [bus driver / got it back same afternoon]. |

---

**[ROUTINE AND ORIENTATION]**

> **Cora:** Now, I know Tuesdays are usually your garden club days. Are you planning to go today?

| KPI | How extracted |
|---|---|
| Temporal orientation (implicit) | If she says yes and it is Tuesday, implicit confirmation. If she says "oh is it Tuesday?" — partial disorientation signal. |

---

> **Cora:** Oh lovely. And what day do you think it is today actually — I always lose track of myself!

| KPI | How extracted |
|---|---|
| Temporal orientation (explicit) | Phrased as shared confusion to reduce anxiety. 1 point for correct day of week. |

---

> **Cora:** And did you get a chance to take your blue pill this morning after breakfast, like you usually do?

| KPI | How extracted |
|---|---|
| Medication adherence | Response classified as: Confirmed / Uncertain (I think so, maybe) / Missed. |

---

**[VERBAL FLUENCY TASK — top Amini et al. predictor]**

> **Cora:** I've got a little game I love doing with you. Name as many animals as you can think of — any animals at all, big or small, wild or tame. You've got about a minute. Ready? Off you go.

*[60-second window]*

> **Cora:** That's wonderful, well done. You always do well at that one.

| KPI | How extracted |
|---|---|
| Semantic verbal fluency count | System counts unique valid animal names from transcript during 60-second window. Excludes repetitions. |
| Stop word fraction | Computed across this segment and the full call: (stop/filler words) / (total words spoken). |
| Speaking time — fluency task | Seconds of patient speech during this window. |

---

**[OBJECT NAMING — BNT analog]**

> **Cora:** I've got another little one for you. I'm going to describe something and you tell me what it is. Ready?

> **Cora:** First: you wear it on your wrist, it has numbers on it, and it tells you what time it is.

*[Answer: watch]*

> **Cora:** Good. Next: you use it to cut paper. It has two holes for your fingers and two blades that close together.

*[Answer: scissors]*

> **Cora:** Last one: you plant it in the garden, it grows toward the sun, and it turns yellow when it blooms.

*[Answer: sunflower — chosen because it connects to Mary's interest in gardening]*

| KPI | How extracted |
|---|---|
| Naming accuracy | Correct responses / total prompts. Expressed as percentage. |
| Word-finding failures | System flags: "um", "the thing that", "you know what I mean", semantic substitutions ("the cutting thing"), extended pauses before answering. Count per call. |

---

**[CONVERSATIONAL RECALL — episodic memory, coherence]**

> **Cora:** How is your garden doing at this time of year? You mentioned last week the roses were giving you trouble.

> **Cora:** And how about your grandson — the one who plays soccer? Did his team win their game last weekend?

| KPI | How extracted |
|---|---|
| Episodic recall (cross-session) | Does she remember telling Cora about the roses / the grandson's game? Correct recall = positive signal. No recollection = recall flag. |
| Coherence / topic tracking | Does her response stay on topic? Drift or sudden topic change is a coherence signal. |
| Repetition count | Running count of any questions or phrases she repeats within the call that she has already said. |

---

**[IMMEDIATE WORD RECALL]**

> **Cora:** I'm going to say three words to you, and I'd like you to try to remember them. Here they are: apple, river, chair. Can you say those back to me?

*[Mary repeats]*

> **Cora:** Perfect. I'll ask you about those again in a little while.

| KPI | How extracted |
|---|---|
| Immediate word recall | Count of words correctly repeated back (0–3). |

---

**[DELAYED STORY RECALL — top Amini et al. predictor, must happen in final third of call]**

> **Cora:** Do you remember that story I told you earlier — about the woman who lost her handbag?

*[Mary responds]*

> **Cora:** Lovely. What do you remember about it? Tell me as much as you can.

| KPI | How extracted |
|---|---|
| Delayed story recall — detail count | Count of correctly recalled details from fixed list of 10 (0–10 integer). |
| Delayed story recall — speaking time | Seconds of patient speech during recall window. Per Tavabi et al., dementia patients recall fewer details and speak significantly less during this segment. |

---

**[DELAYED WORD RECALL]**

> **Cora:** And those three words I gave you — apple, river, chair — do you remember any of them?

| KPI | How extracted |
|---|---|
| Delayed word recall | Count of words recalled (0–3). Compared against personal baseline. Decline over 3 consecutive calls → medium alert. |

---

**[MOOD DIRECT CHECK]**

> **Cora:** How are you feeling in yourself today Mary? Not just physically — your mood, your spirit. Has it been a good week?

| KPI | How extracted |
|---|---|
| Mood classification (confirmed) | Direct self-report used alongside transcript sentiment analysis. Both signals combined. |

---

**[PATIENT AGENCY MOMENT — safety flag monitor]**

> **Cora:** Before I let you go — is there anything on your mind that you'd like me to make sure Sarah or Dr. Lee hears about? Anything at all, big or small. This is your time.

| KPI | How extracted |
|---|---|
| Patient-directed communication | Content of Mary's response logged as her own note in her care record. |
| Safety flag | Semantic monitoring for: mentions of falls, wandering, confusion, explicit distress, requests for help. Any detection → immediate high-priority alert. |

---

**[REASSURING CLOSE]**

> **Cora:** Thank you Mary, it's always so lovely talking with you. I'll have a little summary ready for you whenever you want to check in. And your notes stay private — nothing goes to Sarah or Dr. Lee unless you say so. Have a wonderful Tuesday. Talk tomorrow.

| KPI | How extracted |
|---|---|
| Call completion | System confirms call reached the close. |
| Consent reinforcement | Phrased as a reminder, not a legal disclaimer. Patient reminded of their control every single call. |

---

### Master KPI-to-Call Moment Map

| # | Call Moment | Natural Framing | KPI(s) |
|---|---|---|---|
| 1 | Opening | "How are you doing? How did you sleep?" | Mood classification, sleep self-report |
| 2 | Prior call memory | "You mentioned watching that documentary with Sarah..." | Cross-session episodic recall |
| 3 | Story plant | "I heard a lovely story this morning, can I share it?" | Story encoding (10 details seeded) |
| 4 | Garden club / day | "Are you planning to go to garden club today?" | Temporal orientation (implicit) |
| 5 | Day check | "What day is it actually — I always lose track!" | Temporal orientation (explicit, 0–4 score) |
| 6 | Medication | "Did you take your blue pill after breakfast?" | Medication adherence (Confirmed / Uncertain / Missed) |
| 7 | Verbal fluency | "Name as many animals as you can in a minute" | Semantic fluency count, stop word fraction, speaking time |
| 8 | Object naming | "I'll describe something, you tell me what it is" ×3 | Naming accuracy %, word-finding failure count |
| 9 | Garden / grandson chat | "How's the garden? How did your grandson's game go?" | Cross-session episodic recall, coherence, repetition count |
| 10 | Immediate word recall | "Three words: apple, river, chair. Can you repeat them?" | Immediate word recall (0–3) |
| 11 | Delayed story recall | "Do you remember that story about the woman on the bus?" | Story detail count (0–10), speaking time (seconds) |
| 12 | Delayed word recall | "Those three words — do you remember them?" | Delayed word recall (0–3) |
| 13 | Mood direct check | "How are you feeling in yourself today?" | Mood classification (confirmed via self-report) |
| 14 | Patient agency moment | "Anything you'd like Sarah or Dr. Lee to hear about?" | Patient-directed communication, safety flag |
| 15 | Close | "Your notes stay private unless you say so. Talk tomorrow." | Call completion, consent reinforcement |

---

## KPI Extraction: What the xAI API Must Return

Send the full call transcript to the xAI API post-call with a structured extraction prompt. The API returns a JSON object with all fields below. Hardcode Mary's baseline values for the demo and compute deviation live.

| Field | Type / Units | What It Measures | Alert Logic |
|---|---|---|---|
| `fluency_count` | Integer | Unique valid animal names produced in 60 seconds | >20% below personal baseline for 2 consecutive calls → medium alert |
| `story_recall_count` | Integer (0–10) | Correct story details recalled in delayed recall task | >20% below personal baseline for 2 consecutive calls → medium alert |
| `story_recall_speaking_time` | Seconds | Patient speaking time during story recall segment | <50% of personal baseline → review flag |
| `naming_accuracy` | Percentage (0–100) | Correct object identifications out of 3 prompts | Compare to baseline. Track word-finding failure count separately. |
| `word_finding_failures` | Integer | Hedges, substitutions, self-corrections in naming task | Track as trend. Increase over time is the signal. |
| `immediate_recall` | Integer (0–3) | Words correctly repeated immediately after introduction | 0 on 2 consecutive calls → flag |
| `delayed_recall_words` | Integer (0–3) | Same 3 words recalled later in the call | Compare to baseline. Decline over 3 consecutive calls → medium alert |
| `orientation_score` | Integer (0–4) | Correct day / date within 2 days / month / year | 0 on 2 consecutive calls → high alert |
| `stop_word_fraction` | Float (0–1) | Fraction of patient speech that is stop/filler words | >15 percentage points above personal baseline on 2 consecutive calls → review flag |
| `repetition_count` | Integer | Repeated questions or phrases within the call | 3 or more in a single call → flagged |
| `medication_status` | Confirmed / Uncertain / Missed | Patient's reported medication adherence | Uncertain or Missed on 2 consecutive days → caregiver notification |
| `mood_classification` | Cheerful / Neutral / Flat / Anxious / Agitated | Primary emotional tone of the call | 3+ Flat or Anxious in a week → caregiver note. Any Agitated → same-day alert |
| `safety_flag` | Boolean + type string | Any mention of falls, wandering, distress, request for help | Any flag → immediate high-priority alert. No trend needed. |
| `call_completed` | Boolean | Did the call reach the closing moment | <60% completion rate over 7 days → caregiver notification |
| `cross_session_recall` | Boolean | Did patient remember what they shared on last call | Track as trend. Declining cross-session recall over 5+ calls is a longitudinal signal. |

---

## Personalization Logic

**Do not use population norms. Use each patient's own rolling baseline.**

- **Baseline period:** First 5–7 calls. Store all KPI values. Compute mean and standard deviation per KPI. No alerts fire during this period.
- **After baseline:** Every call computes deviation from personal mean. Alert thresholds expressed as % deviation from patient's own average, not absolute cutoffs.
- **Demo shortcut:** Hardcode Mary's baseline values in the DB. Simulate a call result that shows deviation. Show the alert firing because of deviation, not because the raw score is clinically low.
- **Key demo example:** Mary's fluency baseline is 14. Today she scores 8. Raw score looks like normal MCI range. But 8 is 43% below her personal norm. Alert fires. This is what population tests would miss.

---

## Alert Flow: Patient Sees It First

Medium alerts do not go directly to caregivers. They route through the patient.

| Level | Trigger | What Happens |
|---|---|---|
| Low | KPI within 10% of personal baseline | No alert. Logged to dashboard. |
| Medium | KPI 15–30% below baseline on 2 consecutive calls, or multiple soft flags same call | Alert queued. Patient sees it on their dashboard first. Patient approves, adds context, or dismisses. Then sent to caregiver. |
| High | KPI >30% below baseline, safety flag, 3+ consecutive declined calls, full disorientation | Immediate alert to full care circle. Patient is notified simultaneously, not blocked. |

**Patient consent options:**
1. **Auto-approve:** Alerts go to Sarah immediately, patient gets a copy.
2. **Review first:** Patient sees alert and approves before it sends.
3. **Private:** Patient can mark something as not shareable.

High alerts always go through regardless of consent setting.

---

## Demo Checklist (6 beats, 3 minutes)

| # | Beat | What to Show |
|---|---|---|
| 1 | Show Mary's onboarding profile | Name, routine, garden club, Sarah, consent on review-first mode. Baseline mode shown as active (first 5–7 calls, no alerts). |
| 2 | Run or replay the call | Story planted early. Verbal fluency game in the middle. Story recalled naturally near the end. Naming prompts. Transcript visible on clinician view in real time. |
| 3 | Show KPI extraction JSON | `fluency_count: 8` (baseline 14, −43%). `story_recall_count: 3` (baseline 7). `medication_status: "Uncertain"`. `stop_word_fraction: 0.58` (baseline 0.41). `mood_classification: "Flat"`. |
| 4 | Medium alert queued for Mary | Mary sees it on her dashboard. She adds: *'I was tired from the storm last night.'* Approves. Alert goes to Sarah. |
| 5 | Mary asks Memento a question | *'How have I been doing this week?'* Warm reframed response grounded in her personal bests. No scores, no decline language. Her storm note is incorporated. |
| 6 | Clinician view | 14-day charts with Mary's personal baseline line on each. Two consecutive below-baseline days clearly visible. Pre-visit summary includes her own note. Dr. Lee sees the full picture. |

---

**Submission due 6:00 PM.** Deliverables: live Vercel URL + public GitHub repo + team name + one-line pitch. Synthetic data only.
