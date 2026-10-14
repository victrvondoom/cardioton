# CardioInspection

## System Architecture — v1.0

**Project:** Multimodal AI Hackathon 2026 — Track A
**Track:** Cardiovascular Risk Visualization & Prediction
**Status:** Architecture Draft / v1.0

---

# 1. Project Overview

CardioInspection is an interactive web-based clinical decision-support and educational system for estimating cardiovascular risk from patient physiological and clinical information and presenting the predictions through an interactive 3D coronary anatomy visualization.

The system is designed around three core capabilities:

1. **Predictive Modeling**

   * Predict overall Coronary Artery Disease (CAD) status.
   * Predict vessel-specific stenosis-associated risk for the LAD, LCX, and RCA.
   * Use demographic, clinical examination, laboratory, ECG, and echocardiographic features.
   * Evaluate predictions using appropriate classification metrics.

2. **Clinical Explainability**

   * Explain the factors contributing to a prediction.
   * Display physiological measurements alongside their contribution to model predictions.
   * Use SHAP or an equivalent feature-attribution method.

3. **Interactive 3D Visualization**

   * Render a 3D representation of the human heart/coronary anatomy.
   * Represent predicted vessel-specific risk for LAD, LCX, and RCA visually.
   * Allow rotation, zooming, and anatomical inspection.

The system is intended for **decision-support / educational purposes only** and is not a substitute for formal diagnostic imaging or clinical diagnosis.

---

# 2. Problem Definition

The hackathon requires a system that maps patient physiological and clinical information to:

* Overall CAD prediction.
* LAD stenosis prediction.
* LCX stenosis prediction.
* RCA stenosis prediction.
* Interpretable explanations of the predictions.
* Interactive anatomical visualization of the predicted vessel-level risk.

The central challenge is that the available public datasets do not necessarily contain all required modalities and labels within the same patient cohort.

Therefore, the architecture explicitly separates:

* **prediction data**
* **ECG resources**
* **angiography/imaging resources**
* **3D anatomical resources**

when their labels or patient populations are not directly compatible.

The system must not imply that a model trained only on clinical/tabular data has identified an actual physical lesion in a patient's coronary anatomy.

---

# 3. Design Principles

The architecture follows these principles.

## 3.1 Evidence-driven design

Architectural decisions should be based on:

* Hackathon requirements.
* SOTA literature.
* Public dataset availability.
* Dataset label compatibility.
* Experimental validation.

Models and datasets should not be selected solely because they produce high scores on a single small dataset.

## 3.2 Prevent target leakage

Features that directly encode or derive from the prediction target must not be used as model inputs.

For example, when predicting CAD or vessel-specific stenosis, LAD/LCX/RCA/Cath-derived target information must not inadvertently enter the input feature set.

## 3.3 Patient-level separation

Whenever multiple records belong to the same patient, train/validation/test splitting must occur at the patient level rather than at the individual-record level.

This is particularly important for ECG and imaging data.

## 3.4 Reproducibility

Experiments must record:

* dataset version/source
* preprocessing configuration
* feature selection
* random seeds
* model hyperparameters
* train/validation/test split
* evaluation metrics

## 3.5 Modularity

The architecture should allow additional:

* clinical features
* prediction models
* datasets
* anatomical resources
* visualization components

without requiring a complete redesign.

---

# 4. Research Findings Influencing the Architecture

The SOTA review identified several important patterns.

## 4.1 Clinical/tabular CAD prediction

Clinical datasets such as Z-Alizadeh Sani have been used for CAD classification using machine-learning models including tree-based methods.

The literature demonstrates that models such as XGBoost can perform strongly on small clinical datasets, particularly when combined with feature-attribution methods such as SHAP.

However, small datasets can produce optimistic results, making robust validation important.

## 4.2 ECG-based CAD prediction

Recent work demonstrates the possibility of predicting coronary stenosis-associated outcomes from ECG signals, including vessel-specific targets involving:

* LAD
* LCX
* RCA

The reviewed literature also demonstrates the usefulness of ECG representation learning and transfer learning.

However, large ECG datasets such as PTB-XL do not provide direct angiographic LAD/LCX/RCA stenosis labels and therefore cannot simply be treated as vessel-stenosis training data.

## 4.3 Coronary angiography

ARCADE provides annotated coronary angiography imagery involving coronary vessels and stenosis localization.

This makes it potentially useful for the imaging/anatomical component of the system.

## 4.4 3D coronary anatomy

Datasets/resources such as ImageCAS and Coronary Atlas provide 3D coronary anatomical information and segmentation resources.

These are useful for anatomical visualization and potentially future segmentation experiments, but they should not automatically be treated as patient-level CAD prediction datasets.

## 4.5 External validation

The literature demonstrates that strong performance on a small internal dataset does not necessarily translate to other cohorts.

Consequently, external validation is considered an important part of the experimental design where a genuinely compatible external dataset can be obtained.

---

# 5. Dataset Strategy

The project will use a **modular dataset strategy**.

## 5.1 Core supervised prediction dataset

### Extended Z-Alizadeh dataset

Primary candidate for the initial clinical/tabular prediction pipeline.

Expected role:

```text
Clinical + demographic + laboratory +
ECG/echo-derived features
                |
                v
        Supervised ML models
                |
        +-------+-------+
        |       |       |
        v       v       v
       CAD     LAD     LCX/RCA
```

The extended version is particularly relevant because it contains vessel-specific outcomes.

### Important constraint

The dataset is relatively small.

Therefore:

* complex deep learning should not be assumed to be superior;
* patient-level validation is required;
* preprocessing must be performed correctly within validation folds;
* performance must not be interpreted as clinical deployment performance.

---

# 5.2 External validation candidate

### ICADD

ICADD is a candidate for external validation because the research indicates the presence of multimodal cardiovascular information including:

* clinical information
* CCTA
* invasive angiography
* FFR
* echocardiography
* laboratory/hematology information

However, before incorporation into the core pipeline, the following must be verified:

1. Dataset accessibility.
2. Patient-level data availability.
3. Exact target definitions.
4. Compatibility with the prediction labels used for training.
5. Availability of the required input features.
6. Licensing/data-use restrictions.

Until these are verified, ICADD is classified as:

**Candidate external-validation dataset — not yet guaranteed.**

---

# 5.3 ECG datasets

## PTB-XL

Potential roles:

* ECG experimentation.
* ECG representation learning.
* Potential pretraining/transfer-learning experiments.

PTB-XL should **not** be treated as direct ground truth for LAD/LCX/RCA stenosis.

## MIMIC-IV-ECG

Potential role:

* large-scale ECG representation learning.
* auxiliary ECG experiments.

Limitations include access requirements and the fact that its diagnostic labels are not equivalent to direct angiographic vessel-level stenosis labels.

For the initial hackathon implementation, these datasets are therefore considered optional extensions rather than dependencies of the core prediction pipeline.

---

# 5.4 Imaging dataset

## ARCADE

Potential role:

* coronary angiography visualization.
* vessel segmentation.
* stenosis localization.
* investigation of vessel-specific anatomical representation.

ARCADE should remain a distinct imaging pipeline unless a valid method is established for connecting its outputs to the patient-level clinical prediction model.

---

# 5.5 3D anatomical resources

## ImageCAS

Potential role:

* coronary 3D anatomy.
* vessel segmentation research.
* anatomical visualization research.

## Coronary Atlas

Potential role:

* reference anatomical structures.
* 3D coronary visualization.
* anatomical mesh development.

These resources are primarily treated as **anatomical/visualization resources**, not as the core supervised CAD classifier dataset.

---

# 6. High-Level System Architecture

The system is divided into five major layers.

```text
+-------------------------------------------------------+
|                    FRONTEND                           |
|                                                       |
| Patient Input | Risk Dashboard | Explainability | 3D |
+----------------------------+--------------------------+
                             |
                             v
+-------------------------------------------------------+
|                    BACKEND API                        |
|                                                       |
| Validation | Inference | Explanation | Results       |
+----------------------------+--------------------------+
                             |
                             v
+-------------------------------------------------------+
|                  ML / INFERENCE LAYER                 |
|                                                       |
| Preprocessing | CAD Model | Vessel Models | SHAP      |
+----------------------------+--------------------------+
                             |
                             v
+-------------------------------------------------------+
|                    DATA LAYER                         |
|                                                       |
| Z-Alizadeh | ECG resources | Imaging | Anatomy        |
+-------------------------------------------------------+
```

The system is intentionally modular so that the prediction engine and visualization engine can evolve independently.

---

# 7. Prediction Pipeline

The initial prediction pipeline is:

```text
Patient Input
     |
     v
Input Validation
     |
     v
Feature Preprocessing
     |
     v
Feature Selection
     |
     v
Trained ML Model
     |
     +----------------------+
     |                      |
     v                      v
Overall CAD           Vessel Predictions
                          |
                    +-----+-----+
                    |     |     |
                    v     v     v
                   LAD   LCX   RCA
     |
     v
Probability Calibration
     |
     v
SHAP Explanation
     |
     v
Prediction Response
```

---

# 8. Feature Processing

The preprocessing pipeline will distinguish between:

* numerical features
* categorical features
* binary features
* missing values
* ECG-derived variables
* echocardiographic variables

Target-derived variables must be explicitly excluded.

The preprocessing pipeline must be fitted only on the training data during cross-validation.

Conceptually:

```text
Training fold
     |
     +--> fit preprocessing
     |
     +--> transform training data
     |
     +--> train model

Validation fold
     |
     +--> transform using training preprocessing
     |
     +--> evaluate model
```

The validation/test data must never be used to fit preprocessing transformations.

---

# 9. Model Strategy

## 9.1 Baseline

The project should first implement a simple baseline model.

Candidate:

**Logistic Regression**

Purpose:

* establish a transparent baseline;
* verify the data pipeline;
* provide a reference against more complex models.

## 9.2 Primary tabular model

Candidate:

**XGBoost**

Rationale:

* strong performance on structured/tabular data;
* suitable for relatively small datasets;
* fast experimentation;
* supports feature importance;
* compatible with SHAP explanations.

The final model should be selected empirically rather than assumed in advance.

## 9.3 Model comparison

Where feasible, compare:

```text
Logistic Regression
        |
        +---- baseline

Random Forest
        |
        +---- nonlinear baseline

XGBoost
        |
        +---- primary candidate
```

Model selection should consider both predictive performance and calibration, not accuracy alone.

---

# 10. Overall CAD Prediction

The first supervised target is:

```text
Overall CAD
    |
    +--> 0: CAD absent according to dataset definition
    |
    +--> 1: CAD present according to dataset definition
```

The model should output a probability:

```text
P(CAD = 1 | patient features)
```

The UI should represent this as a model-estimated risk/probability rather than a definitive diagnosis.

---

# 11. Vessel-Specific Prediction

The system must support predictions for:

* LAD
* LCX
* RCA

The preferred initial formulation is a set of binary vessel-specific prediction tasks.

Conceptually:

```text
                    Patient Features
                           |
             +-------------+-------------+
             |             |             |
             v             v             v
        LAD Model      LCX Model      RCA Model
             |             |             |
             v             v             v
       P(LAD=1)       P(LCX=1)       P(RCA=1)
```

The exact model-sharing strategy remains an implementation decision.

Two possibilities are:

### Independent models

One classifier per vessel.

Advantages:

* simple;
* easy to debug;
* independent target handling.

### Multi-output architecture

A shared representation with three prediction heads.

Advantages:

* potentially captures relationships between vessel targets;
* closer to multi-task learning approaches found in the literature.

The initial implementation should favor the approach that is most robust given the available dataset size.

---

# 12. Prediction Output Contract

The backend should return a structured prediction object approximately equivalent to:

```json
{
  "overall_cad": {
    "probability": 0.82,
    "prediction": 1
  },
  "vessels": {
    "LAD": {
      "probability": 0.71,
      "prediction": 1
    },
    "LCX": {
      "probability": 0.43,
      "prediction": 0
    },
    "RCA": {
      "probability": 0.67,
      "prediction": 1
    }
  },
  "explanation": {
    "features": []
  },
  "metadata": {}
}
```

The actual response schema will be finalized during backend implementation.

---

# 13. Explainability Layer

The system must provide an interpretable breakdown of the prediction.

SHAP is the primary candidate for tree-based models.

The explanation pipeline is:

```text
Patient Features
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
       +-----------------------+
       |                       |
       v                       v
Feature contributions     Feature ranking
       |                       |
       +-----------+-----------+
                   |
                   v
             Dashboard
```

Example UI information:

```text
Overall CAD Risk: 82%

Major contributing features:

ST Depression       +0.XX
Exercise Angina     +0.XX
Age                 +0.XX
Cholesterol         +0.XX
Maximum HR          -0.XX
```

The actual values will be generated from the trained model and must never be manually fabricated for the demonstration.

---

# 14. 3D Visualization Architecture

The visualization layer is responsible for representing coronary anatomy and model outputs.

Candidate technologies from the hackathon specification include:

* Three.js
* WebGL
* React Three Fiber
* VTK.js

The initial implementation will favor a browser-native 3D stack compatible with the frontend architecture.

The 3D system should support:

* rotation;
* zoom;
* anatomical inspection;
* vessel selection;
* vessel-specific risk visualization.

Conceptually:

```text
                   3D Heart
                      |
          +-----------+-----------+
          |           |           |
         LAD         LCX         RCA
          |           |           |
          v           v           v
       Risk %       Risk %      Risk %
          |           |           |
          +-----------+-----------+
                      |
                      v
              Visual encoding
```

---

# 15. Critical Anatomical Interpretation Constraint

The system must distinguish between:

### Model-estimated vessel risk

```text
"Model estimates elevated LAD-associated risk."
```

and:

### Patient-specific anatomical stenosis

```text
"Patient has a 72% stenosis at this physical location."
```

The latter requires appropriate patient-specific anatomical imaging/ground truth.

A clinical/tabular classifier alone cannot establish the physical location of a patient's lesion.

Therefore, the 3D visualization in the core system should be understood as a **visual representation of model output mapped onto the corresponding coronary vessel**, unless patient-specific imaging is explicitly incorporated.

This distinction must be reflected in both the UI and documentation.

---

# 16. Frontend Architecture

The frontend will contain four major areas.

## 16.1 Patient Input

Input form for:

* demographic information;
* clinical measurements;
* laboratory values;
* ECG-derived features;
* echocardiographic features.

## 16.2 Overall Risk

Display:

* predicted CAD probability;
* classification;
* model confidence/probability information where appropriate.

## 16.3 Vessel Risk

Display:

```text
LAD    XX%
LCX    XX%
RCA    XX%
```

alongside the 3D visualization.

## 16.4 Explainability

Display:

* important contributing features;
* positive/negative contribution;
* physiological measurement;
* relative contribution to the prediction.

---

# 17. Backend Architecture

The backend provides a controlled interface between the frontend and ML pipeline.

Conceptually:

```text
Frontend
    |
    | POST patient data
    v
API
    |
    v
Input validation
    |
    v
Preprocessing
    |
    v
Model inference
    |
    v
SHAP explanation
    |
    v
Structured JSON
    |
    v
Frontend
```

The backend should not contain model-training logic during normal inference.

Training and inference should remain separate.

---

# 18. Training vs Inference

## Training

```text
Raw Dataset
     |
     v
Validation
     |
     v
Preprocessing
     |
     v
Cross-validation
     |
     v
Model Training
     |
     v
Evaluation
     |
     v
Calibration
     |
     v
Model Artifact
```

## Inference

```text
Patient Input
     |
     v
Validation
     |
     v
Saved Preprocessor
     |
     v
Saved Model
     |
     v
Prediction
     |
     v
SHAP
     |
     v
API Response
```

The production application should load previously trained model artifacts rather than retraining models for every request.

---

# 19. Evaluation Strategy

The hackathon requires evaluation using classification metrics including:

* accuracy;
* precision;
* recall;
* F1-score;
* ROC-AUC.

Where appropriate, additional metrics such as:

* PR-AUC;
* calibration;
* confusion matrix;

may be included.

For each prediction task, results should be reported separately.

Example:

```text
                 CAD       LAD       LCX       RCA

Accuracy         ...       ...       ...       ...
Precision        ...       ...       ...       ...
Recall           ...       ...       ...       ...
F1               ...       ...       ...       ...
ROC-AUC          ...       ...       ...       ...
```

Metrics should be calculated on held-out data.

---

# 20. Validation Strategy

The validation strategy should prioritize patient-level separation and avoidance of leakage.

Initial experimental strategy:

```text
Dataset
   |
   v
Patient-level split
   |
   +----------------+
   |                |
Training         Held-out test
   |
   v
Cross-validation
   |
   v
Model selection
   |
   v
Final evaluation
```

If a genuinely compatible external dataset becomes available:

```text
Training Dataset
       |
       v
Model
       |
       v
Internal evaluation

       +

External Dataset
       |
       v
Independent evaluation
```

External validation should only be claimed when the target definition and patient-level data are genuinely compatible.

---

# 21. Data Leakage Risks

The following risks must be actively checked.

## Target leakage

Target variables or target-derived variables must not be model inputs.

## Patient leakage

Records belonging to the same patient must not be split across training and test sets.

## Preprocessing leakage

Scalers, imputers, feature selectors, and other transformations must be fitted only on training data.

## Imaging leakage

Frames from the same patient/study must not be distributed across training and test sets.

## Label mismatch

A dataset with a general CAD/ICD label must not be presented as equivalent to angiographically confirmed vessel stenosis without evidence supporting that equivalence.

---

# 22. Imaging and Multimodal Extension

The architecture is intentionally capable of supporting future multimodal inputs.

Potential future pipeline:

```text
                    Patient
                       |
       +---------------+---------------+
       |               |               |
       v               v               v
   Clinical          ECG          CCTA/Angio
       |               |               |
       v               v               v
 Tabular Model     ECG Model      Imaging Model
       |               |               |
       +---------------+---------------+
                       |
                       v
                Multimodal Fusion
                       |
                       v
              CAD + Vessel Risk
                       |
                       v
                  3D Output
```

However, this is **not automatically part of the initial implementation**.

A multimodal fusion model requires compatible patient-level paired modalities.

Separate datasets cannot simply be concatenated as if they represent the same patients.

---

# 23. Model Artifact Management

Trained models should be saved separately from source code.

Expected structure:

```text
models/
├── cad/
│   ├── model.*
│   └── metadata.json
│
├── lad/
│   ├── model.*
│   └── metadata.json
│
├── lcx/
│   ├── model.*
│   └── metadata.json
│
└── rca/
    ├── model.*
    └── metadata.json
```

Metadata should record:

* dataset version;
* features;
* preprocessing version;
* model type;
* hyperparameters;
* training date;
* evaluation metrics;
* random seed.

Actual model binaries should not be committed to Git if they are large.

---

# 24. Proposed Repository Structure

```text
CardioInspection/
│
├── backend/
│   ├── app/
│   ├── api/
│   └── services/
│
├── data/
│   └── .gitkeep
│
├── docs/
│   ├── cardio_inspection__docs__ARCHITECTURE.md
│   ├── cardio_inspection__docs__EXPERIMENTS.md
│   ├── SOTA.md
│   └── research/
│
├── frontend/
│
├── ml/
│   ├── preprocessing/
│   ├── models/
│   ├── evaluation/
│   └── explainability/
│
├── models/
│   └── .gitkeep
│
├── notebooks/
│
├── tests/
│
├── configs/
│
├── cardio_inspection__README.md
└── .gitignore
```

The exact internal structure may evolve during implementation.

---

# 25. Implementation Phases

Implementation should proceed incrementally.

## Phase 0 — Research and Architecture

Status:

**In progress / largely complete**

Deliverables:

* SOTA matrix
* dataset research
* architecture document

---

## Phase 1 — Dataset Verification

Tasks:

* obtain the selected dataset;
* verify schema;
* verify labels;
* identify target columns;
* identify leakage candidates;
* determine missing-value structure;
* establish patient identifiers where available.

No model training should occur until this is complete.

---

## Phase 2 — Baseline ML Pipeline

Implement:

```text
Load data
   ↓
Validate schema
   ↓
Clean/preprocess
   ↓
Patient-level split
   ↓
Logistic Regression
   ↓
Evaluation
```

Purpose:

**prove that the complete pipeline works before optimizing it.**

---

## Phase 3 — Primary ML Models

Implement candidate models:

* Logistic Regression
* Random Forest
* XGBoost

Compare:

* ROC-AUC
* F1
* precision
* recall
* calibration

---

## Phase 4 — Vessel Models

Implement:

* LAD prediction
* LCX prediction
* RCA prediction

Verify each target independently.

---

## Phase 5 — Explainability

Integrate SHAP.

Produce:

* global feature importance;
* patient-level feature contributions;
* dashboard-ready explanation objects.

---

## Phase 6 — Backend

Implement inference API.

Primary endpoint concept:

```text
POST /predict
```

Input:

```text
Patient features
```

Output:

```text
CAD prediction
LAD prediction
LCX prediction
RCA prediction
SHAP explanations
```

---

## Phase 7 — Frontend

Build:

* patient input form;
* risk dashboard;
* vessel risk cards;
* explanation panel;
* safety disclaimer.

---

## Phase 8 — 3D Visualization

Integrate:

* anatomical model;
* LAD;
* LCX;
* RCA;
* interaction controls;
* risk visualization.

---

## Phase 9 — Integration

Connect:

```text
Frontend
    ↓
Backend
    ↓
ML
    ↓
SHAP
    ↓
Backend response
    ↓
Frontend + 3D visualization
```

---

## Phase 10 — Validation and Demonstration

Final checks:

* prediction reproducibility;
* leakage checks;
* API testing;
* frontend testing;
* 3D interaction;
* explanation correctness;
* safety disclaimer;
* documentation;
* demonstration workflow.

---

# 26. Clinical Safety

The application must visibly state that predictions are intended for:

* educational purposes;
* research;
* decision-support demonstration.

The system is not a substitute for:

* formal diagnostic imaging;
* physician evaluation;
* clinical diagnosis.

The UI must not present model probabilities as definitive diagnoses.

---

# 27. Current Scope vs Future Scope

## Core hackathon scope

```text
Clinical/tabular patient input
        ↓
CAD prediction
        ↓
LAD / LCX / RCA prediction
        ↓
SHAP explanation
        ↓
Interactive dashboard
        ↓
3D coronary visualization
```

## Optional extensions

```text
PTB-XL / MIMIC ECG pretraining
        ↓
ECG representation model
```

and:

```text
ARCADE
        ↓
Angiography / stenosis localization
```

and:

```text
CCTA / ImageCAS
        ↓
3D coronary segmentation
```

These extensions should only be implemented if they can be integrated without compromising the reliability of the core system.

---

# 28. Open Questions

The following decisions remain deliberately open.

### Dataset

* Can the extended Z-Alizadeh dataset be obtained in the required form?
* What exactly are the vessel-level target definitions?
* Can ICADD be accessed at patient level?
* Are ICADD labels compatible with our targets?
* Is MultiD4CAD practically usable within the hackathon timeline?

### Modeling

* Independent vessel classifiers vs multi-task model?
* XGBoost vs another tabular model as the primary model?
* Is probability calibration required for the final interface?
* Can an ECG model improve performance sufficiently to justify its complexity?

### Visualization

* Which 3D anatomical asset will be used?
* Three.js vs React Three Fiber vs VTK.js?
* How will vessel-specific risk be encoded visually?
* How much anatomical detail is necessary for the demonstration?

### Multimodal learning

* Do we have paired patient-level modalities?
* If not, should multimodal learning remain future work?
* Can ECG pretraining be justified without introducing label mismatch?

---

# 29. Architectural Decision Summary

The current v1 architecture therefore follows this strategy:

```text
                    CARDIOINSPECTION
                           |
                           v
                  Clinical Patient Data
                           |
                           v
                  Preprocessing Layer
                           |
                           v
                 Tabular ML Prediction
                           |
              +------------+------------+
              |            |            |
              v            v            v
             CAD          LAD          LCX/RCA
              |            |            |
              +------------+------------+
                           |
                           v
                    SHAP Explainability
                           |
                           v
                      Backend API
                           |
                           v
                  Interactive Dashboard
                           |
                    +------+------+
                    |             |
                    v             v
              Risk / XAI       3D Anatomy
```

Additional datasets and modalities are treated as modular extensions rather than forcibly merged.

The architecture prioritizes:

1. **Correctness**
2. **Leakage prevention**
3. **Interpretability**
4. **Reproducibility**
5. **Modularity**
6. **Hackathon feasibility**
7. **Clear distinction between predicted risk and actual anatomical disease**

---

# 30. Status

**Architecture Version:** v1.0

**Current state:** Research-informed draft.

The architecture should be updated after final verification of:

* available datasets;
* target definitions;
* data access;
* anatomical resources;
* model experiments.

# 31. Dataset

### Primary Dataset

The initial development dataset is the **Extended Z-Alizadeh Sani dataset**, obtained from the UCI Machine Learning Repository.

The populated worksheet contains:

- **303 patient records**
- **59 columns**
- Clinical, demographic, laboratory, ECG, and echocardiographic variables
- Vessel-specific labels for:
  - **LAD** — Left Anterior Descending artery
  - **LCX** — Left Circumflex artery
  - **RCA** — Right Coronary Artery
- An overall CAD label represented by the `Cath` column

The dataset contains no missing values and no exact duplicate rows according to the initial forensic inspection.

### Prediction Targets

The system will initially investigate four binary prediction tasks:

| Target | Positive class | Negative class |
|---|---|---|
| CAD (`Cath`) | CAD | Normal |
| LAD | Stenotic | Normal |
| LCX | Stenotic | Normal |
| RCA | Stenotic | Normal |

Observed class distributions in the 303-patient dataset:

| Target | Positive | Negative |
|---|---:|---:|
| CAD (`Cath`) | 216 | 87 |
| LAD | 177 | 126 |
| LCX | 119 | 184 |
| RCA | 114 | 189 |

These distributions will be considered when designing the validation and evaluation strategy.

### Feature Handling

The raw dataset will remain unchanged. All cleaning and transformation will be performed in the preprocessing pipeline.

Known preprocessing considerations include:

- `Exertional CP` is constant across all 303 observations and therefore provides no predictive information.
- `Sex` contains the values `Male` and `Fmale`; the latter will be normalized to the intended categorical representation during preprocessing rather than modifying the raw dataset.
- Several categorical clinical variables are represented using string values such as `Y/N`, severity categories, and diagnostic categories and will require explicit encoding.
- Near-constant clinical variables will not automatically be removed solely because of their low frequency. Their usefulness and methodological validity will be investigated before exclusion.

### Target Leakage Prevention

The target columns (`LAD`, `LCX`, `RCA`, and `Cath`) will never be used as input features for their corresponding prediction tasks.

Additional leakage analysis is required before finalizing the feature set. In particular, some variables represent echocardiographic or other diagnostic findings, and the available dataset documentation alone does not establish whether every feature would have been available at the intended prediction time.

Therefore, the initial architecture will distinguish between:

1. **Core clinical/ECG features** that are plausibly available before advanced diagnostic assessment.
2. **Extended diagnostic features**, such as echocardiographic variables, whose inclusion will be evaluated after establishing their temporal and methodological appropriateness.

The project will not describe the resulting model as a pre-diagnostic prediction system until this issue has been verified.

### Validation Strategy

Because the dataset contains only 303 patients, evaluation must account for the limited sample size.

The project will avoid relying on a single arbitrary train/test split as the sole evidence of model performance. The initial experiments will investigate stratified cross-validation and leakage-safe preprocessing so that transformations are learned only from the relevant training folds.

Final model selection and evaluation methodology will be documented in `cardio_inspection__docs__EXPERIMENTS.md` as experiments are conducted.

### Dataset Limitations

The primary dataset is relatively small for machine-learning development. Consequently:

- Reported performance may have substantial uncertainty.
- Model performance must not be interpreted as clinical validation.
- Cross-validation results should be accompanied by appropriate metrics rather than accuracy alone.
- External datasets will be investigated for additional validation once the initial pipeline is established.

The workbook also contains a second worksheet with additional vessel-location fields (including proximal, mid, and distal LAD/LCX/RCA fields), but that worksheet contains zero patient records in the downloaded copy. These fields are therefore not part of the current training dataset.

Implementation should begin with **dataset verification and a minimal reproducible baseline**, not with the frontend or 3D visualization.
