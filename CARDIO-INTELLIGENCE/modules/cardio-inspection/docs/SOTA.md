# CardioInspection

## State of the Art Review

**Project:** CardioInspection
**Purpose:** Literature review and SOTA analysis for cardiovascular disease prediction, coronary stenosis prediction, ECG-based CAD prediction, coronary angiography, and coronary vessel visualization.

---

# 1. Purpose

This document summarizes the relevant research reviewed for the CardioInspection hackathon project.

The objectives of the literature review were to determine:

1. How coronary artery disease (CAD) is currently predicted using machine learning.
2. How vessel-specific stenosis involving the LAD, LCX, and RCA has been approached.
3. How ECG data has been used for CAD and coronary stenosis prediction.
4. How coronary angiography and CCTA data are used for vessel detection and stenosis analysis.
5. Which machine-learning architectures and explainability methods are relevant.
6. What datasets are available for developing and validating the proposed system.
7. Which approaches are realistically implementable within the hackathon timeframe.

This document records **what was found in the reviewed literature**. Architectural decisions based on these findings are documented separately in `cardio_inspection__docs__ARCHITECTURE.md`.

---

# 2. Research Questions

The literature review focused on the following questions.

### RQ1 — CAD prediction

How effectively can clinical and physiological features be used to predict CAD?

### RQ2 — Vessel-specific prediction

Can machine-learning models distinguish stenosis or disease involving specific coronary vessels such as:

* LAD
* LCX
* RCA

### RQ3 — ECG

Can ECG signals or ECG-derived features be used to identify CAD or vessel-specific coronary disease?

### RQ4 — Imaging

How are coronary angiography and CCTA used for:

* coronary vessel detection;
* segmentation;
* stenosis detection;
* stenosis localization?

### RQ5 — Explainability

Which methods can provide clinically interpretable explanations for machine-learning predictions?

### RQ6 — Datasets

Which publicly available datasets can support the proposed system?

---

# 3. Overall Findings

The reviewed literature suggests that CAD prediction can be approached using several complementary data modalities:

```text
                  Cardiovascular AI
                         |
        +----------------+----------------+
        |                |                |
        v                v                v
     Clinical           ECG             Imaging
     /Tabular                           CCTA/Angio
        |                |                |
        v                v                v
    CAD models       ECG models      Segmentation /
                                    stenosis models
```

Several important observations emerged:

* Structured clinical data can support effective CAD classification.
* Tree-based models are particularly relevant for small tabular datasets.
* ECG-based deep learning is an active research direction.
* Vessel-specific prediction is more challenging than general CAD classification.
* Coronary angiography and CCTA provide direct anatomical information that clinical/tabular models do not.
* 3D coronary segmentation can support anatomical visualization.
* Explainability is important when predictions are intended for clinical decision-support or educational interfaces.
* Dataset size, label definition, and patient-level validation are critical considerations.

---

# 4. SOTA Matrix

The following matrix summarizes the reviewed papers.

| Paper   | Data / Modality              | Target                      | Approach                                | Key Result / Finding                                            | Relevance   |
| ------- | ---------------------------- | --------------------------- | --------------------------------------- | --------------------------------------------------------------- | ----------- |
| Paper 1 | Clinical / tabular           | CAD                         | ML classification                       | Strong CAD classification reported                              | High        |
| Paper 2 | Clinical / physiological     | CAD                         | Tree-based / ML                         | Demonstrates effectiveness of structured clinical features      | High        |
| Paper 3 | ECG                          | CAD / stenosis              | Deep learning / representation learning | ECG contains useful information for coronary disease prediction | High        |
| Paper 4 | ECG                          | Vessel-specific CAD         | Deep learning                           | Demonstrates potential for LAD/LCX/RCA-related prediction       | High        |
| Paper 5 | Coronary angiography         | Coronary vessels / stenosis | Computer vision                         | Demonstrates automated vessel/stenosis analysis                 | High        |
| Paper 6 | CCTA                         | Coronary anatomy / stenosis | Deep learning                           | Demonstrates automated coronary analysis from CT angiography    | High        |
| Paper 7 | 3D coronary imaging          | Vessel segmentation         | Deep learning / segmentation            | Supports 3D anatomical reconstruction                           | High        |
| Paper 8 | Clinical + imaging           | CAD                         | Multimodal ML                           | Demonstrates value of combining cardiovascular information      | Medium–High |
| Paper 9 | Cardiovascular clinical data | CAD                         | Explainable ML                          | Demonstrates interpretable prediction                           | High        |

> **Note:** The detailed paper-specific values, metrics, and methodology should be maintained in the accompanying SOTA matrix / research notes. This summary should not be interpreted as replacing the individual paper analyses.

---

# 5. Clinical / Tabular Machine Learning

A recurring theme in the reviewed literature is the use of structured clinical variables for CAD classification.

Typical variables include combinations of:

* age;
* sex;
* blood pressure;
* cholesterol;
* ECG-derived measurements;
* exercise-related measurements;
* echocardiographic measurements;
* laboratory measurements;
* cardiovascular risk factors.

Tree-based models are particularly relevant when:

* the dataset is relatively small;
* features are heterogeneous;
* nonlinear relationships may exist;
* interpretability is required.

This motivates the use of a strong tabular baseline in CardioInspection.

---

# 6. XGBoost and Tree-Based Models

XGBoost is relevant to the project because it provides:

* strong performance on structured data;
* nonlinear decision boundaries;
* relatively fast training;
* suitability for small-to-medium tabular datasets;
* compatibility with SHAP-based explanations.

However, high performance on a small dataset does not automatically imply generalization to other populations.

Therefore, model performance must be interpreted alongside:

* dataset size;
* class balance;
* validation strategy;
* target definition;
* external validation.

The project should compare XGBoost against simpler baselines rather than assuming it is automatically optimal.

---

# 7. Vessel-Specific Prediction

The reviewed literature indicates that predicting overall CAD and predicting disease associated with individual coronary vessels are distinct tasks.

The principal vessels relevant to the project are:

```text
LAD
LCX
RCA
```

A possible formulation is:

```text
Patient features
      |
      +----> CAD classifier
      |
      +----> LAD classifier
      |
      +----> LCX classifier
      |
      +----> RCA classifier
```

The literature supports investigating vessel-specific prediction, but the availability and definition of appropriate vessel-specific labels remain critical.

A general CAD label should not automatically be treated as equivalent to vessel-specific stenosis.

---

# 8. ECG-Based CAD Prediction

ECG-based cardiovascular prediction is an active research area.

The reviewed work indicates that ECG signals contain information that can be exploited using machine-learning and deep-learning approaches.

Potential approaches include:

* engineered ECG features;
* convolutional neural networks;
* learned ECG representations;
* transfer learning;
* multimodal models.

Large public ECG datasets such as PTB-XL provide substantial ECG data and may therefore be useful for representation-learning experiments.

However:

> **A large ECG dataset does not automatically provide coronary angiography-confirmed LAD/LCX/RCA stenosis labels.**

Therefore, ECG datasets must be matched carefully to the actual prediction target.

---

# 9. Coronary Angiography

Coronary angiography provides direct anatomical information about coronary vessels.

Computer-vision approaches can be used for:

* vessel segmentation;
* vessel detection;
* stenosis localization;
* stenosis quantification.

ARCADE is particularly relevant to this part of the project because it provides annotated coronary angiography data.

Potential future architecture:

```text
Coronary Angiography
        |
        v
Image preprocessing
        |
        v
Vessel segmentation
        |
        v
Stenosis detection
        |
        v
LAD / LCX / RCA localization
```

This is conceptually different from predicting CAD from clinical/tabular features.

---

# 10. CCTA and 3D Coronary Anatomy

CCTA provides three-dimensional anatomical information about coronary arteries.

Deep-learning approaches can be used for:

* coronary artery segmentation;
* centerline extraction;
* anatomical reconstruction;
* stenosis analysis.

Datasets such as ImageCAS are relevant to the anatomical segmentation component.

These resources can potentially support the 3D visualization layer of CardioInspection.

However, an anatomical segmentation dataset should not automatically be treated as a CAD classification dataset.

---

# 11. 3D Visualization

The literature and available datasets suggest that coronary anatomy can be represented as a 3D structure.

This supports the hackathon requirement for an interactive anatomical visualization.

The conceptual mapping is:

```text
Prediction
    |
    +---- LAD probability
    |
    +---- LCX probability
    |
    +---- RCA probability
             |
             v
      3D coronary model
```

The visualization should clearly communicate that a model-estimated probability is being mapped onto an anatomical vessel.

It should not imply patient-specific lesion localization unless patient-specific imaging supports that claim.

---

# 12. Explainable AI

Explainability is important for this project because a numerical prediction alone does not communicate why the model reached its conclusion.

SHAP is particularly relevant for tree-based models.

The conceptual workflow is:

```text
Patient features
      |
      v
    Model
      |
      v
Prediction
      |
      v
    SHAP
      |
      v
Feature contributions
```

This enables the interface to present information such as:

* which features contributed most strongly;
* whether a feature increased or decreased the prediction;
* how the patient's feature values relate to the model output.

SHAP should be treated as a model explanation mechanism rather than as a clinical causal explanation.

---

# 13. Dataset Landscape

The literature review and subsequent dataset investigation identified several potentially useful resources.

| Dataset / Resource  | Primary Modality                                 | Potential Role                                      |
| ------------------- | ------------------------------------------------ | --------------------------------------------------- |
| Extended Z-Alizadeh | Clinical / tabular                               | Core CAD and vessel prediction candidate            |
| ICADD               | Clinical + CCTA + angiography + other modalities | Potential external validation / multimodal research |
| PTB-XL              | ECG                                              | ECG experimentation / representation learning       |
| MIMIC-IV-ECG        | ECG                                              | Large-scale ECG experimentation                     |
| ARCADE              | Coronary angiography                             | Vessel / stenosis computer vision                   |
| ImageCAS            | CCTA / coronary anatomy                          | 3D coronary segmentation                            |
| Coronary Atlas      | Coronary anatomy                                 | Anatomical visualization / reference                |
| MultiD4CAD          | Multimodal cardiovascular data                   | Potential multimodal research                       |

Dataset availability, licensing, label definitions, and patient-level compatibility must be verified before inclusion.

---

# 14. Important Dataset Considerations

The literature review highlights a fundamental problem:

> There is no assumption that one publicly available dataset will provide every modality, target, and annotation required by CardioInspection.

Therefore, datasets should be categorized according to their actual role.

### Prediction datasets

Provide supervised labels for the ML task.

### ECG datasets

Provide ECG signals and associated diagnostic information.

### Imaging datasets

Provide angiography/CCTA images and anatomical/stenosis annotations.

### Visualization datasets

Provide anatomical structures useful for 3D visualization.

These categories should not be conflated.

---

# 15. Multimodal Learning

The reviewed literature suggests that combining multiple cardiovascular modalities may provide additional information.

Conceptually:

```text
Clinical ──────┐
               |
ECG ───────────┼──> Multimodal model ──> Prediction
               |
CCTA/Angio ────┘
```

However, true multimodal supervised learning requires compatible patient-level data.

For example:

```text
Patient A
 ├── clinical
 ├── ECG
 └── CCTA
```

is substantially different from:

```text
Dataset A → clinical
Dataset B → ECG
Dataset C → CCTA
```

The latter datasets cannot simply be concatenated into a multimodal patient record.

Therefore, multimodal fusion remains an extension unless compatible paired data are verified.

---

# 16. Validation Lessons from the Literature

The reviewed research demonstrates the importance of robust evaluation.

Important considerations include:

### Patient-level splitting

The same patient's records must not appear in both training and test sets.

### External validation

Where possible, models should be evaluated on a separate cohort.

### Class imbalance

Accuracy alone can be misleading when positive and negative classes are imbalanced.

### Multiple metrics

Relevant metrics include:

* ROC-AUC;
* precision;
* recall;
* F1-score;
* accuracy;
* PR-AUC where appropriate.

### Calibration

A probability output should not automatically be interpreted as a clinically calibrated probability.

---

# 17. Research Gaps Relevant to CardioInspection

The literature review suggests several opportunities for the proposed system.

## Gap 1 — Combining prediction with visualization

Many ML systems focus on prediction without providing an interactive anatomical interface.

CardioInspection aims to connect model predictions to an interactive coronary representation.

## Gap 2 — Vessel-specific interpretability

General CAD prediction does not necessarily communicate which coronary vessel is associated with the predicted risk.

CardioInspection explicitly separates:

* CAD;
* LAD;
* LCX;
* RCA.

## Gap 3 — Explainability

The project incorporates feature-level explanations rather than exposing only a final classification.

## Gap 4 — Multimodal extensibility

The architecture is designed so ECG and imaging modalities can be incorporated later when compatible data are available.

---

# 18. Implications for CardioInspection

The SOTA review leads to the following design implications.

### Decision 1

Begin with a **tabular ML baseline** rather than immediately building a large deep-learning architecture.

### Decision 2

Use **XGBoost as a primary candidate** for structured clinical data, while retaining simpler baselines.

### Decision 3

Treat **LAD, LCX, and RCA prediction as distinct targets**.

### Decision 4

Use **SHAP** to provide model-level and patient-level explanations.

### Decision 5

Keep **ECG and imaging pipelines modular** rather than assuming that unrelated public datasets can be directly fused.

### Decision 6

Use coronary anatomy resources to build the visualization layer while maintaining a clear distinction between predicted risk and actual patient-specific anatomical stenosis.

### Decision 7

Prioritize robust validation and leakage prevention over maximizing a single benchmark score.

---

# 19. SOTA → Architecture Mapping

The literature review directly informs the system architecture:

```text
SOTA Finding
     |
     v
Structured clinical ML works
     |
     +----> Tabular baseline + XGBoost

SOTA Finding
     |
     v
Vessel-specific prediction is possible
     |
     +----> LAD / LCX / RCA targets

SOTA Finding
     |
     v
ECG contains useful cardiovascular information
     |
     +----> ECG extension

SOTA Finding
     |
     v
Angiography enables anatomical analysis
     |
     +----> Imaging extension

SOTA Finding
     |
     v
3D coronary segmentation is possible
     |
     +----> 3D visualization

SOTA Finding
     |
     v
Models require interpretability
     |
     +----> SHAP
```

---

# 20. Limitations of the Literature Review

The reviewed literature should not be interpreted as a direct benchmark of all existing cardiovascular AI systems.

Limitations include:

* limited number of full-text papers available during the initial review;
* heterogeneous datasets;
* different definitions of CAD and stenosis;
* different patient populations;
* different evaluation protocols;
* differences in preprocessing;
* differences in target definitions.

Reported performance metrics therefore should not be compared as if they were obtained under identical experimental conditions.

---

# 21. Relationship to Other Project Documents

| Document          | Purpose                                            |
| ----------------- | -------------------------------------------------- |
| `SOTA.md`         | Literature and research findings                   |
| `cardio_inspection__docs__ARCHITECTURE.md` | System design derived from research + requirements |
| `cardio_inspection__docs__EXPERIMENTS.md`  | Actual experiments, results, and decisions         |
| `cardio_inspection__README.md`       | Project overview and setup                         |

The intended flow is:

```text
Research Papers
      |
      v
   SOTA.md
      |
      v
cardio_inspection__docs__ARCHITECTURE.md
      |
      v
Implementation
      |
      v
cardio_inspection__docs__EXPERIMENTS.md
      |
      v
Final System
```

---

# 22. Conclusion

The reviewed literature supports a modular cardiovascular AI architecture combining:

* structured clinical machine learning;
* vessel-specific prediction;
* ECG-based extensions;
* coronary angiography/CCTA research;
* explainable AI;
* interactive 3D coronary visualization.

The most practical initial implementation is a robust tabular prediction pipeline using a small number of well-validated models, followed by explainability and visualization.

More computationally demanding multimodal and imaging approaches should be treated as extensions unless compatible datasets and sufficient implementation time are available.

The SOTA review therefore supports a **modular, evidence-driven architecture rather than a single monolithic multimodal model**.
