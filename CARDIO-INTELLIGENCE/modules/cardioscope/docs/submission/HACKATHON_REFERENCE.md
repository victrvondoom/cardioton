# Historical organizer-material summary

This is the original participant reference, retained as historical context. The root README is now the CardioScope judge landing page. Organizer PDFs are preserved only in the private archival repository. This public snapshot omits all seven documents; links below point to the organizer-hosted originals.

# Multimodal AI Hackathon 2026

A participant reference covering the four problem tracks, submission requirements, judging criteria, datasets, and prizes.

**Our project decision:** Track A, **CardioScope**. See the [build and submission plan](../../PLAN.md) for the rationale, scope, architecture, evaluation, schedule, and team responsibilities.

**Implementation:** Complete valid profiles now drive the four frozen models, numerical outputs and synchronized whole-vessel coloring on the real interactive anatomy. The single final evaluation on all 61 locked holdout records is complete, with unchanged models and preserved results. See [application integration and browser verification](../../docs/INTEGRATION.md), [final holdout results, uncertainty and limitations](../../docs/FINAL_EVALUATION.md), [setup and checks](../../docs/DEVELOPMENT.md), [development-only nested-CV results and reproducibility](../../docs/MODELING.md), [verified source notes](../../docs/SOURCE_NOTES.md), and [Phase 2 anatomy verification](../../docs/anatomy/VERIFICATION.md). LCX/RCA detection remains weak at threshold 0.5; calibration is unverified. Verified positive-class SHAP explanations for CAD/LAD/LCX/RCA are now implemented; see [methods, reconstruction, latency and browser verification](../../docs/EXPLANATIONS.md). The finished Evidence page shows the saved final results, uncertainty, confusion matrices and limitations.

**Prepared on 1 October 2026** from all **7 PDFs (17 pages)** in this folder and the participant-provided announcement email screenshot. Source documents and their online links are listed at the end. Requirements below summarize those materials; resource links and external claims have not been independently checked online.

## Run the finished application

```sh
make install prepare verify build
make run
```

Open `http://127.0.0.1:8000`. Python 3.12.14 exactly, uv, supported Node/npm and make are required. See [portable setup, CI and container instructions](../../docs/REPRODUCIBILITY.md), [the engineering hardening report](../../docs/HARDENING.md), and [the immutable v1 boundary](../../docs/EXPERIMENT_BOUNDARY.md). Setup verifies bundled frozen sources; it never retrains or repeats the consumed holdout evaluation.

## At a glance

| Item | Details |
| --- | --- |
| Event | Multimodal AI Hackathon 2026 |
| Tracks | A: cardiovascular risk; B: flood damage mapping; C: speech analytics; D: adaptive tutoring |
| Submission deadline | **15 October 2026, 12:15 AM IST (UTC+05:30)**, according to the announcement email |
| Deadline clarification | This is **15 minutes after midnight at the start of 15 October**, on the night of **14 October** |
| Team size | **1-4 people**; solo participation is allowed |
| Submission platform | **Devpost**, according to the submission guidelines |
| Source code | **Public GitHub repository**, with documentation and setup/run instructions |
| Demo | **YouTube, 3-10 minutes** generally; **Track B specifically requests 3 minutes** |
| Demo language/access | English audio or English subtitles; public or unlisted video, **not private** |
| Cash prizes | **INR 15,000 first place + INR 10,000 second place per track** |
| Total listed cash prizes | **INR 1,00,000**, calculated as four tracks x INR 25,000 |
| Participation certificate | For every participant who submits successfully; teammates must be added to the Devpost submission |
| Questions/support | The email directs participants to the **Discord help-desk channel**; no invite URL is visible in the supplied materials |

The email is titled **"Problem Statements Are Live! | Multimodal AI Hackathon 2026"**, is dated **30 September 2026**, was sent by **Unstop Events**, and is signed **Team MAH**. It says all four problem statements have been released. The PDFs do not provide the submission deadline themselves.

## Contents

- [Submission requirements](#submission-requirements)
- [Track comparison](#track-comparison)
- [Track A: Cardiovascular Risk Visualization & Prediction](#track-a-cardiovascular-risk-visualization--prediction)
- [Track B: Mapping Flood Damage from Space](#track-b-mapping-flood-damage-from-space)
- [Track C: Contrastive Speech Analytics & Temporal Flaw Grounding](#track-c-contrastive-speech-analytics--temporal-flaw-grounding)
- [Track D: Personalized Tutoring & Adaptive Learning](#track-d-personalized-tutoring--adaptive-learning)
- [Prizes and certificates](#prizes-and-certificates)
- [Final submission checklist](#final-submission-checklist)
- [Unspecified details and points to clarify](#unspecified-details-and-points-to-clarify)
- [Source documents](#source-documents)

## Submission requirements

Your Devpost submission must contain **all four components before the deadline**:

1. **Project description:** Explain what you built, which problem it solves, and how the solution works on your Devpost project page.
2. **Source code and documentation:** Link a **public GitHub repository** containing the code and documentation. Its README must describe setup, prerequisites/dependencies, and how to run the project.
3. **Demo video:** Provide a **3-10 minute YouTube video** showing the project running and explaining your approach. Unlisted is acceptable; private is not. Include English audio or English subtitles. For Track B, prepare a **3-minute video** to satisfy both the general range and the track-specific instruction.
4. **Team information:** Use every teammate's **real full name**. Every teammate needs a Devpost account and must be added to the submission. Omitted members will not appear on the project page and may not receive a certificate.

Teams may have **1-4 members**. Track-specific deliverables below are additional requirements to account for when preparing the submission.

**Documentation limits:** Tracks **A, B, and C** specify a maximum **6-page** project/technical report. Track **D** requires project documentation but does **not** state a page limit in its supplied brief.

This README summarizes the event. Once a project is built, its repository README will also need the actual dependencies, setup commands, and run instructions required by the submission guidelines.

*Source: [Submission Guidelines](https://drive.google.com/file/d/1HEy6MBO_BN_aID2Nik2woYLWfuawzwHN/view?usp=sharing), p. 1; track briefs for additional deliverables.*

## Track comparison

| Track | Main inputs | Required core outcome | Important constraint | Largest judging component |
| --- | --- | --- | --- | --- |
| **A: Cardiovascular risk** | Patient clinical/physiological records and anatomical meshes | CAD and vessel stenosis predictions displayed on an interactive 3D heart/torso with explanations | Exclude `LAD`, `LCX`, `RCA`, and `Cath` from prediction inputs | Predictive performance: **30%** |
| **B: Flood mapping** | Before/after Sentinel imagery, pre-event OSM, elevation data, listed training datasets | Flood/debris and infrastructure damage maps, isolated-settlement analysis, situation report, and one AI component | Published damage maps and post-event OSM edits are for checking only; violation leads to disqualification | Flood and damage mapping: **30%** |
| **C: Speech analytics** | Custom paired good/flawed recordings of the same transcripts | Reproducible rubric scores, precise flaw timestamps, acoustic explanations, interactive comparison dashboard | Build and publish the custom contrastive dataset; normalize for speaker differences | Data engineering and stress testing: **30%** |
| **D: Adaptive tutoring** | Lecture videos, textbooks, slides, including images/diagrams | Source-cited tutor, adaptive assessments, per-topic learner model, evaluation results | Preserve exact source locations and decline or flag unsupported answers | Knowledge base/grounding and personalization: **20% each** |

*Sources: [Problem Statements](https://drive.google.com/file/d/1sPrF1CWyJMGk8c3JOwuo08_sboeaAE5xc/view), pp. 1-2, and the four detailed track briefs.*

## Track A: Cardiovascular Risk Visualization & Prediction

**Goal:** Predict coronary artery disease (CAD) and vessel-specific stenosis from patient data, then map those predictions onto an interactive 3D anatomical model.

### Domain context from the brief

The brief describes stenosis as coronary artery narrowing and associates the dataset's CAD classification with at least 50% narrowing in one or more major coronary vessels. The three vessel targets are **LAD (Left Anterior Descending)**, **LCX (Left Circumflex)**, and **RCA (Right Coronary Artery)**. Overall CAD is a separate classification target.

Demographic, clinical examination, laboratory, ECG, and echocardiographic measurements are predictive features. Examples include age, blood pressure, pulse, cholesterol, cardiac enzymes, ST elevation, T inversion, LVH, and regional wall motion abnormality (RWMA). These features are **not anatomical coordinates**; RWMA does not supply a pixel-level or 3D lesion map in this dataset.

### Required functionality

1. **Predictive modeling:** Train classification models for overall CAD and stenosis in each of LAD, LCX, and RCA. Use the available clinical feature groups and evaluate with appropriate metrics such as accuracy, precision, recall, F1-score, and ROC-AUC.
2. **Prevent target leakage:** Exclude **`LAD`, `LCX`, `RCA`, and `Cath` from model input features** when predicting CAD or vessel stenosis.
3. **Interactive 3D visualization:** Render a human torso/heart and dynamically color the corresponding coronary artery structures using predicted stenosis probabilities. Support rotation, zoom, and region selection to inspect vessel-specific risk. The brief suggests Three.js, WebGL, React Three Fiber, or VTK.js.
4. **Clinical explanation dashboard:** Show overall CAD status, vessel probabilities, physiological measurements, and their contributions to predictions. SHAP or LIME are suggested explanation methods.
5. **Visible clinical disclaimer:** State in the UI that predictions are for decision support/education and do not replace formal diagnostic imaging.

Keep the 3D view responsive in modern browsers without requiring dedicated GPUs. Maintain consistent mappings between prediction outputs and displayed vessels. The architecture should allow additional features, models, and anatomical structures without a complete redesign.

### Data and starter resources

- **Suggested primary dataset:** [UCI Extension of Z-Alizadeh Sani](https://archive.ics.uci.edu/dataset/411/extention+of+z), also described as available on Kaggle. The brief lists **303 patient records**, clinical features, vessel stenosis labels, and overall CAD labels.
- **Anatomy:** [BodyParts3D](https://lifesciencedb.jp/bp3d); open-source `.gltf`, `.glb`, or `.obj` heart meshes. Other examples in the brief include Sketchfab, Three.js repositories, and NIH 3D Print Exchange.

### Deliverables

- Working **web application** combining the 3D viewer and ML backend.
- Clean prediction pipeline code and **trained model weights** for CAD and multi-vessel stenosis classification.
- Interactive explanation dashboard with prediction metrics, feature importance, and patient measurements.
- **Maximum 6-page documentation** covering preprocessing, model architecture, 3D pipeline setup, usage, and evaluation results.
- **3-10 minute YouTube demo** showing feature entry, the working system, 3D interactions, and technical implementation.

### Judging

| Criterion | Weight | What judges assess |
| --- | --- | --- |
| Predictive Performance | **30%** | Classification, risk estimation, validation methodology |
| 3D Visualization | **25%** | Anatomy, spatial mapping, interaction |
| Clinical Interpretability | **20%** | Feature attribution and clear physiological explanations |
| System Integration | **15%** | Data pipeline, model/dashboard integration, live visualization updates |
| Technical Implementation | **10%** | Architecture, code, reproducibility, public data/anatomical resources |

*Source: [Track A.pdf](https://drive.google.com/file/d/1T9Whog4kWF3mYB7ZMGyihGWpbJBJtsfz/view?usp=sharing), pp. 1-4.*

## Track B: Mapping Flood Damage from Space

**Goal:** Given an area and flood date, help rescue teams identify flooded/debris-covered areas, damaged infrastructure, and settlements cut off from roads using satellite data.

The brief uses a **26 August 2026 glacier-collapse/flood scenario in Nepal's Bhote Koshi-Trishuli corridor** and requires an August 2026 Trishuli case study compared against **Copernicus EMS activation EMSR927**. These event details and the activation identifier are reproduced from the supplied brief.

### Required functionality

1. **Flood/debris mapping:** Compare before/after **Sentinel-1 radar** imagery and **Sentinel-2 optical** imagery when clear conditions permit.
2. **Infrastructure impact:** Overlay **OpenStreetMap buildings, roads, and bridges** and estimate which were affected.
3. **Cut-off settlements:** Use the road network to identify settlements without a road connection to the nearest town or hospital.
4. **AI component - choose one:** A trained flood segmentation model evaluated on unseen Himalayan scenes, **or** a situation-report copilot answering rescue questions and generating short reports in **English and Nepali**. Every number generated by the copilot must come from the system's maps.
5. **Required case study:** Compare your Trishuli results with the EMSR927 reference maps.

**Bonus:** Use elevation data to trace a downstream flood path from an upstream point and list settlements along it.

The system must run **end-to-end from raw satellite data for any area and date the judges choose**. Evaluation is live on judge-selected areas and dates. The brief advises same-orbit-track radar comparisons, describes a same-time-of-day pair 12 days apart, and warns against pixel-by-pixel comparisons across different orbit tracks.

### Data rules

| Allowed as system inputs | Only allowed for checking results |
| --- | --- |
| Sentinel-1, Sentinel-2, Copernicus DEM, **pre-event** OpenStreetMap, and the listed training datasets | Copernicus EMS, UNOSAT, other published damage maps, and **post-event** OpenStreetMap edits |

**Using checking-only sources as inputs leads to disqualification.** For the specified case study, the OSM snapshot must be dated **before 26 August 2026**. The brief mentions **27 July 2026** as the latest snapshot available when it was written; that is a source note, not a live availability check.

### Datasets and license notes from the brief

| Resource | Role | Notes stated in the brief |
| --- | --- | --- |
| [Copernicus Data Space](https://dataspace.copernicus.eu) | Sentinel-1/2 before/after imagery | Free registration; described as covered by the Copernicus free, full, and open data policy |
| Copernicus DEM | Elevation input and optional downstream tracing | Include the WorldDEM attribution below |
| [ohsome API](https://api.ohsome.org/v1) | Historical OSM buildings, roads, bridges | ODbL; a published modified version of the OSM data itself must remain under ODbL |
| [Kuro Siwo](https://github.com/Orion-AI-Lab/KuroSiwo) | **Recommended** training dataset | The brief cites MIT in the NeurIPS 2024 paper and CC BY in the repository README; credit **Bountos et al., 2024** |
| [Sen1Floods11](https://github.com/cloudtostreet/Sen1Floods11) | **Optional** training dataset | The brief says the original repository lacks a license file, mirrors list CC BY 4.0, and describes educational/non-commercial use; cite **Bonafilia et al., CVPR Workshops 2020** |
| [Copernicus EMS / EMSR927](https://mapping.emergency.copernicus.eu) | **Checking only** | Credit **"European Union, Copernicus Emergency Management Service data"** |

The supplied brief contains inconsistent or incomplete license descriptions for Kuro Siwo and Sen1Floods11. Confirm the applicable upstream terms before using or redistributing those datasets.

### Required attribution

Track B requires the following attribution wording in every submission, plus citations for any training datasets used:

> Contains modified Copernicus Sentinel data 2026.

> Produced using Copernicus WorldDEM-30 © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018 provided under COPERNICUS by the European Union and ESA; all rights reserved.

> © OpenStreetMap contributors.

### Deliverables and responsibility requirements

- **Map dashboard** and a **one-page situation report generated by the system**.
- GitHub repository and README explaining how to run the system.
- **Maximum 6-page report**, including a limitations section.
- **3-minute demo video**.
- Data attributions and training-dataset citations.
- Case-study results compared with **EMSR927** maps.

Explain limitations honestly: the brief specifically notes that satellite revisit intervals prevent minute-ahead warnings of sudden glacier collapses. Do **not** use victim images in demos or reports. The brief identifies these systems as educational prototypes rather than operational tools.

### Judging

| Criterion | Weight |
| --- | --- |
| Flood and damage mapping quality | **30%** |
| AI component | **25%** |
| Cut-off settlement analysis | **20%** |
| Report, understanding in Q&A, honesty about limitations | **15%** |
| Dashboard and situation report usability | **10%** |

*Source: [Track B.pdf](https://drive.google.com/file/d/18rhTH_WCBxvttSmp8s40JmPfgL-PhDtx/view?usp=sharing), pp. 1-3.*

## Track C: Contrastive Speech Analytics & Temporal Flaw Grounding

**Goal:** Build a speech evaluation system with a custom contrastive dataset of ideal and flawed deliveries, reproducible rubric-based scores, precise flaw timestamps, and actionable acoustic explanations.

### Required functionality

1. **Build the custom dataset:** Source and transcribe effective public speeches, such as speeches by prominent politicians, champion debaters, or TED speakers. Create flawed recordings of the **exact same transcripts** by synthesis, self-recording, or audio modification. Cover a spectrum from very poor pacing/tone to nearly perfect delivery.
2. **Label the pairs:** Accurately label the good/flawed recordings and temporally bound the relevant regions for training and testing.
3. **Forced alignment:** Map transcript text precisely to audio timestamps.
4. **Acoustic analysis:** Extract features such as FFT, MFCCs, pitch/F0 contours, speech rate, pause intervals, vocal clarity, stress points, and energy contours.
5. **Temporal and causal feedback:** Identify exact start/end times of flaws and translate measured acoustic deviations into structured, understandable explanations.
6. **Interactive dashboard:** Accept audio and transcript uploads. Overlay baseline and participant time-series features, highlighting flaw regions and their explanations.

Prioritize **dataset quality over quantity**. Keep comparison **speaker-agnostic** by normalizing pitch and energy for natural differences between speakers. Results must be reproducible across repeated runs and deployment environments, with timestamps precise enough to support the explanations.

### Deliverables

- GitHub codebase and documentation.
- **Published custom dataset** containing good/flawed audio pairs, transcripts, and alignment labels. Place it in GitHub, or include a **public Google Drive link in the README**.
- Working web/app dashboard demonstrating upload, extraction, and visual/textual feedback.
- **Maximum 6-page technical documentation** describing dataset construction, evaluation rubrics, model architecture, and scoring methodology.
- **3-10 minute YouTube demo** showing dataset collection, stress tests across delivery qualities, and the dashboard detecting specific deviations.

### Judging

| Criterion | Weight | What judges assess |
| --- | --- | --- |
| Data Engineering & Stress Testing | **30%** | Baseline sourcing, temporal labels, robustness of the flawed-delivery spectrum |
| Causal Explainability & Temporal Grounding | **25%** | Flaw timestamps and mathematical explanations tied to context |
| Feature Extraction | **20%** | Acoustic rigor, stress-point and energy-contour detection |
| Visualization & Dashboard | **15%** | Usability and clarity of time-series/explanations |
| Reproducibility & Code Quality | **10%** | Execution, deployment instructions, architecture |

*Source: [Track C.pdf](https://drive.google.com/file/d/1ewVNqeGBcg76GUUvoj0buPWueQrgDf_6/view?usp=sharing), pp. 1-3. The prize sheet abbreviates this track's name to "Contrastive Speech Analytics."*

## Track D: Personalized Tutoring & Adaptive Learning

**Goal:** Build an AI study companion that unifies course videos, textbooks, and slides into a cited knowledge base, then provides adaptive assessments and personalized tutoring.

### Required functionality

1. **Multimodal ingestion:** Ingest lecture videos, textbooks, and slide decks **without manual preprocessing**. Extract and use images, diagrams, and figures, not just text.
2. **Knowledge organization:** Identify topics, subtopics, concepts, and prerequisites. Tag every content unit and preserve its exact source page, slide number, or video timestamp.
3. **Grounded tutoring:** Answer and explain using cited excerpts that open the exact source location. Decline or clearly flag queries outside the material; distinguish outside knowledge from source-backed content.
4. **Adaptive assessments:** Generate quizzes/mock exams with **MCQs, short answers, and numerical problems** on student-selected scope. Tag each question with topic, source location, and difficulty. Verify correctness, for example through answer verification or cross-model validation, and avoid repeated questions across assessments.
5. **Feedback and diagnosis:** Give cited feedback on each answer and a post-assessment report identifying weak topics and likely misconceptions.
6. **Learner model:** Maintain per-topic mastery estimates updated after **every quiz and conversation**. Suggested approaches include Bayesian knowledge tracing, IRT-style estimation, or spaced repetition. Handle new learners using a diagnostic quiz or intake conversation.
7. **System evaluation:** Use **RAGAS, DeepEval, TruLens, or a similar evaluation framework**. Report faithfulness, answer relevancy, context precision, and context recall on a team-built test set containing questions with known source locations and off-material queries.
8. **Personalization evaluation:** Run simulated student profiles over multiple sessions and report **mastery gains** and **question repetition rate**.

Accurate question tags and answer keys must support a reliable learner model. Personalization should improve measurably as more student data becomes available.

### Course material and optional enhancements

There is **no fixed required dataset**. The brief permits suitable material such as MIT OpenCourseWare, NPTEL, public textbooks, or self-created content.

Optional enhancements listed in the brief:

- Visual topic/prerequisite course map.
- Revision material focused on weak topics: flashcards, slides, or audio briefs.
- Study schedule based on weak topics, forgetting curves, and time until an exam.
- Mixed-language content or Indian-language interaction, such as English lectures with Hindi explanations.
- Audio tutoring sessions.

### Deliverables

- Working web/app prototype with multimodal upload/ingestion, grounded tutor chat, adaptive assessments, and dashboard.
- Documentation of architecture, grounding method, and learner-model approach. **No page limit is specified in this brief.**
- Framework-based evaluation metrics and simulated-student results on team-chosen course material.
- **3-10 minute YouTube demo** showing source uploading, grounded chat, assessment pipeline, and technical architecture.
- The public GitHub repository required by the general submission guidelines.

### Judging

| Criterion | Weight | What judges assess |
| --- | --- | --- |
| Knowledge Base & Grounding | **20%** | Multimodal extraction, preserved source links, citations, unsupported-query handling |
| Personalization Effectiveness | **20%** | Learner model, simulated gains, responsiveness to student state |
| Assessment Quality | **15%** | Correctness, novelty, tags, feedback, analysis |
| User Experience & Demo Video | **15%** | Dashboard, workflow, usability, optional features |
| System Evaluation | **15%** | Framework, metrics, test set, rigorous and honest results |
| Technical Implementation | **15%** | Code quality and architecture |

*Source: [Track D.pdf](https://drive.google.com/file/d/1KlbSV3-WFrd3Cs9J59qpWtiWrAkb-DMM/view?usp=drive_link), pp. 1-3; general submission guidelines for GitHub requirements.*

## Prizes and certificates

| Track | First prize | Second prize | Track total |
| --- | --- | --- | --- |
| A: Cardiovascular Risk Visualization & Prediction | INR 15,000 | INR 10,000 | INR 25,000 |
| B: Mapping Flood Damage from Space | INR 15,000 | INR 10,000 | INR 25,000 |
| C: Contrastive Speech Analytics | INR 15,000 | INR 10,000 | INR 25,000 |
| D: Personalized Tutoring & Adaptive Learning | INR 15,000 | INR 10,000 | INR 25,000 |
| **Total (calculated)** | **INR 60,000** | **INR 40,000** | **INR 1,00,000** |

The prize sheet promises a **Certificate of Participation to every participant who submits successfully**. Ensure every teammate is added to Devpost, because the submission guidelines warn that omitted members may not receive certificates.

*Sources: [Prize Pool](https://drive.google.com/file/d/1GfOmWL6A4Q0KSNdwtpqRmaxneMbDMRAe/view?usp=sharing), p. 1; [Submission Guidelines](https://drive.google.com/file/d/1HEy6MBO_BN_aID2Nik2woYLWfuawzwHN/view?usp=sharing), p. 1.*

## Final submission checklist

- [ ] Complete the selected track's required prototype, data/model artifacts, documentation, and evaluation.
- [ ] Publish the source code and documentation in a **public GitHub repository**.
- [ ] Include prerequisites/dependencies, setup instructions, and run instructions in the project README.
- [ ] Keep the A/B/C technical report within **6 pages**, if applicable.
- [ ] Upload the working demo to YouTube: **3-10 minutes**, or **3 minutes for Track B**.
- [ ] Ensure the video is public/unlisted and has English audio or English subtitles.
- [ ] Write the Devpost description explaining the problem, solution, and approach.
- [ ] Add repository, demo, and relevant dataset/documentation links to the submission.
- [ ] Add **all 1-4 teammates** with real full names and Devpost accounts.
- [ ] For **A**, check excluded target columns, model weights, anatomical mapping, explanations, and the visible clinical disclaimer.
- [ ] For **B**, check pre-event OSM, input restrictions, raw-data execution, the one-page situation report, EMSR927 comparison, attributions, and limitations.
- [ ] For **C**, make the custom paired dataset publicly accessible with transcripts and alignment labels.
- [ ] For **D**, verify exact source links, unsupported-query handling, question validation, mastery updates, and multi-session evaluation results.
- [ ] Finish the submission **before 12:15 AM IST on 15 October 2026**.

## Unspecified details and points to clarify

These details are **not established by the supplied PDFs/email screenshot**:

- Registration dates, eligibility restrictions, entry fees, event start date, and full round schedule.
- Whether the event is online, in person, or hybrid, and any venue details.
- The exact Devpost event/submission URL and Discord invitation URL.
- Whether teams may submit to multiple tracks or make multiple submissions.
- Rules on pre-existing code, prior projects, paid APIs/cloud services, and intellectual property ownership.
- Final presentation dates, winner announcement, and prize payment conditions.

Specific source differences or uncertainties:

| Point | What the supplied materials say | Planning implication |
| --- | --- | --- |
| Video duration | General guidelines and A/C/D: **3-10 minutes**; B: **3 minutes** | A 3-minute B demo satisfies both wordings |
| Report length | A/B/C: **maximum 6 pages**; D: no stated limit | Do not assume a universal 6-page rule for D |
| Deadline provenance | Deadline appears in the email screenshot, not the PDFs | Preserve the exact time and date; it is at the start of 15 October |
| Track B online document | The problem index and Track B brief contain different Drive PDF links | Both links are recorded below; the local Track B PDF is the source summarized here |
| Track B dataset licensing | Brief reports conflicting/incomplete license information | Confirm upstream dataset terms before use/distribution |
| Track B reference data | Brief names EMSR927 and a historical OSM snapshot | Confirm the specified case-study resources when obtaining data |

The email directs clarification questions to the **Discord help-desk channel**.

## Source documents

All seven source PDFs were reviewed in the archival repository; no organizer PDF is redistributed in this export.

| Local file | Pages | Coverage | Online link embedded in the problem index |
| --- | --- | --- | --- |
| [Problem Statements.pdf](https://drive.google.com/file/d/1sPrF1CWyJMGk8c3JOwuo08_sboeaAE5xc/view) | 2 | Overview of all tracks and links to detailed documents | Not provided as an embedded self-link |
| [Track A.pdf](https://drive.google.com/file/d/1T9Whog4kWF3mYB7ZMGyihGWpbJBJtsfz/view?usp=sharing) | 4 | CAD modeling, 3D anatomy, explanations, judging, resources | [Track A on Google Drive](https://drive.google.com/file/d/1T9Whog4kWF3mYB7ZMGyihGWpbJBJtsfz/view?usp=sharing) |
| [Track B.pdf](https://drive.google.com/file/d/18rhTH_WCBxvttSmp8s40JmPfgL-PhDtx/view?usp=sharing) | 3 | Flood mapping, data restrictions, attribution, live evaluation | [Track B on Google Drive](https://drive.google.com/file/d/18rhTH_WCBxvttSmp8s40JmPfgL-PhDtx/view?usp=sharing) |
| [Track C.pdf](https://drive.google.com/file/d/1ewVNqeGBcg76GUUvoj0buPWueQrgDf_6/view?usp=sharing) | 3 | Custom speech dataset, acoustic analysis, grounding, judging | [Track C on Google Drive](https://drive.google.com/file/d/1ewVNqeGBcg76GUUvoj0buPWueQrgDf_6/view?usp=sharing) |
| [Track D.pdf](https://drive.google.com/file/d/1KlbSV3-WFrd3Cs9J59qpWtiWrAkb-DMM/view?usp=drive_link) | 3 | Multimodal tutoring, assessment, learner model, evaluation | [Track D on Google Drive](https://drive.google.com/file/d/1KlbSV3-WFrd3Cs9J59qpWtiWrAkb-DMM/view?usp=drive_link) |
| [Submission Guidelines.pdf](https://drive.google.com/file/d/1HEy6MBO_BN_aID2Nik2woYLWfuawzwHN/view?usp=sharing) | 1 | Devpost components, GitHub, video, team membership | [Guidelines on Google Drive](https://drive.google.com/file/d/1HEy6MBO_BN_aID2Nik2woYLWfuawzwHN/view?usp=sharing) |
| [Prize Pool.pdf](https://drive.google.com/file/d/1GfOmWL6A4Q0KSNdwtpqRmaxneMbDMRAe/view?usp=sharing) | 1 | Track prizes and participation certificates | [Prize pool on Google Drive](https://drive.google.com/file/d/1GfOmWL6A4Q0KSNdwtpqRmaxneMbDMRAe/view?usp=sharing) |

**Additional source:** The supplied Unstop Events email screenshot, dated 30 September 2026, provides the deadline, confirms the release of all four tracks, and points to Discord help-desk support.

**Additional link printed inside Track B.pdf:** [Track B linked PDF](https://drive.google.com/file/d/1u1ayqUuG0W18uP_7GOptQtnV4BNNGqAB/view).

### CardioScope Phase 7 product

The implemented app now joins real predictions, interactive reference anatomy, verified positive-class explanations and an Evidence page displaying the frozen final holdout results, uncertainty, confusion matrices, methodology and limitations. See [product documentation and browser screenshots](../../docs/PRODUCT.md). Models, thresholds, evaluation artifacts, anatomy assets and SHAP mathematics/reference/configuration remain unchanged.
