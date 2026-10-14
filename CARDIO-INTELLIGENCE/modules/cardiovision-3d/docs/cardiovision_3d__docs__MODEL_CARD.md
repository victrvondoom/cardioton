# CardioVision AI: Official Model Card
**Research & Educational AI-Assisted Cardiovascular Decision-Support Prototype**

---

## Compact Summary
- **Cohort Size (N):** 303 patient records
- **Candidate Clinical Inputs:** 55 raw pre-catheterization clinical variables
- **Transformed Features:** 60 model features (0 engineered features)
- **Prediction Targets:** 4 targets (Overall CAD, LAD Stenosis, LCX Stenosis, RCA Stenosis)
- **Cross-Validation:** 5-fold Stratified Cross-Validation on training split
- **Holdout Evaluation:** Untouched 20% holdout partition (N = 61)
- **External Validation:** No external validation has been performed

---

## 1. Model Purpose
CardioVision AI is a:
> **"Research & Educational AI-Assisted Cardiovascular Decision-Support Prototype"**

### Primary System Objectives:
1. Estimate overall CAD probability from clinical inputs.
2. Estimate LAD (Left Anterior Descending artery) stenosis probability.
3. Estimate LCX (Left Circumflex artery) stenosis probability.
4. Estimate RCA (Right Coronary artery) stenosis probability.
5. Provide model-level explanations using TreeSHAP.
6. Map vessel-level prediction probabilities to corresponding coronary anatomy in the 3D visualization.

### Anatomical & Plaque Boundaries:
- **The system does NOT directly observe plaque.**
- **The system does NOT determine exact plaque coordinates.**
- **The 3D visualization represents vessel-level model predictions mapped to anatomical vessels.**

---

## 2. Dataset
- **Source:** UCI Machine Learning Repository — Extension of Z-Alizadeh Sani Dataset (Dataset ID: 411)
- **Sample Size (N):** 303 patient records
- **Raw CSV Columns:** 59 columns
- **Angiographic Target Columns:** 4 columns (`LAD`, `LCX`, `RCA`, `Cath`)
- **Candidate Clinical Input Columns:** 55 candidate clinical features
- **Transformed Model Features:** 60 features
- **Engineered Features:** 0 engineered features

### Feature Count Reconciliation (59 → 55 → 60):
The raw CSV contains 59 columns. Catheterization targets LAD, LCX, RCA, and Cath account for 4 columns, leaving exactly 55 candidate clinical input features (CAD is a clinical target synonym for Cath == 'CAD', not a 5th CSV column). After ColumnTransformer, the 53 numeric/binary features remain 53 standardized columns, while the 2 categorical features (BBB with 3 levels, VHD with 4 levels) expand via one-hot encoding into 7 binary indicator columns (53 + 7 = 60 transformed features). Zero features are engineered or derived from post-catheterization outcomes.

---

## 3. Target Definitions
The system models four discrete binary prediction targets, each defined by invasive coronary angiography (ground truth):

| Target | Clinical Meaning | Definition / Derivation | Type |
| :--- | :--- | :--- | :--- |
| **CAD** | Overall Coronary Artery Disease | Derived from `Cath == "CAD"` (stenosis ≥ 50% in ≥ 1 major epicardial coronary vessel) | Binary Target |
| **LAD** | Left Anterior Descending Artery | Angiographically confirmed ≥50% luminal narrowing | Binary Target |
| **LCX** | Left Circumflex Artery Branch | Angiographically confirmed ≥50% luminal narrowing | Binary Target |
| **RCA** | Right Coronary Artery Branch | Angiographically confirmed ≥50% luminal narrowing | Binary Target |

*Target labels represent invasive post-catheterization outcomes and are strictly isolated from candidate clinical inputs.*

---

## 4. Target Leakage Control
> **"Target leakage audit: LAD, LCX, RCA, Cath, and CAD are excluded from model inputs. Feature construction was audited for direct and indirect target leakage."**

- **Direct Exclusions:** `LAD`, `LCX`, `RCA`, and `Cath` are removed before model input construction. `CAD` is derived from `Cath` and is also excluded from `X`.
- **Runtime Assertion Checks:** Programmatic assertions in the training pipeline and prediction endpoint verify that none of these columns enter:
  - `X` (raw feature matrix)
  - `X_train` (training fold matrix)
  - `X_test` (held-out test matrix)
  - `numeric_columns`
  - `categorical_columns`
  - `transformed_feature_names`

---

## 5. Feature Processing
Transformations are encapsulated inside a scikit-learn `ColumnTransformer`:

- **Numeric & Binary Features (53 features):**
  - Imputation: `SimpleImputer(strategy='median')`
  - Scaling: `StandardScaler()`
- **Categorical Features (2 features: `BBB`, `VHD`):**
  - Imputation: `SimpleImputer(strategy='most_frequent')`
  - Encoding: `OneHotEncoder(handle_unknown='ignore', sparse_output=False)` (generates 7 binary indicator features)
- **Final Transformed Dimensionality:** 60 features (53 numeric/binary + 7 one-hot levels).
- **Engineered Features:** **There are 0 engineered features.** Zero polynomial terms, ratios, or interaction features.

---

## 6. Model Architecture
Two tree-based ensemble algorithms were benchmarked across all four prediction targets:

- **RandomForestClassifier:**
  - 180 estimators, `max_depth=6`, `min_samples_split=4`, `class_weight='balanced'`
- **XGBClassifier:**
  - 120 estimators, `max_depth=4`, `learning_rate=0.04`, `subsample=0.85`, `colsample_bytree=0.85`, dynamic `scale_pos_weight` based on training class distribution (`neg_count / pos_count`)

### Final Algorithm Selection:
Algorithm selection for each target was determined strictly by the **highest mean 5-fold training ROC-AUC**:

| Target | Selected Algorithm | Training 5-Fold CV ROC-AUC | Selection Criterion |
| :--- | :--- | :--- | :--- |
| **CAD** | **Random Forest** | 0.926 ± 0.040 (vs XGB: 0.919 ± 0.039) | Highest mean 5-fold training ROC-AUC |
| **LAD** | **Random Forest** | 0.850 ± 0.050 (vs XGB: 0.823 ± 0.048) | Highest mean 5-fold training ROC-AUC |
| **LCX** | **XGBoost** | 0.752 ± 0.027 (vs RF: 0.751 ± 0.041) | Highest mean 5-fold training ROC-AUC |
| **RCA** | **XGBoost** | 0.714 ± 0.038 (vs RF: 0.686 ± 0.057) | Highest mean 5-fold training ROC-AUC |

*The held-out test set was not used for algorithm selection.*

---

## 7. Validation Methodology
- **Split Scheme:** Stratified 80/20 holdout split (`random_state=42`)
  - Training Partition: N = 242 records (80%)
  - Held-out Test Partition: N = 61 records (20%)
- **Cross-Validation:** 5-fold `StratifiedKFold` (`shuffle=True`, `random_state=42`) strictly executed on `(X_train, y_train)`.
- **Pipeline Encapsulation:** Preprocessing (`ColumnTransformer`) is encapsulated inside the scikit-learn `Pipeline` and fitted independently within each training CV fold, preventing data leakage across folds.
- **Strict Holdout Isolation:**
  > **"The held-out test set was not used for preprocessing fitting, model training, feature selection, threshold selection, or algorithm selection."**

---

## 8. Performance

### 5-fold training cross-validation ROC-AUC vs Untouched holdout test-set performance:

| Target | Selected Algorithm | 5-fold training cross-validation ROC-AUC | Untouched holdout Accuracy | Untouched holdout Precision | Untouched holdout Recall | Untouched holdout F1-Score | Untouched holdout ROC-AUC |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **CAD** | **Random Forest** | **0.926 ± 0.040** | **83.6%** | **88.4%** | **88.4%** | **88.4%** | **0.866** |
| **LAD** | **Random Forest** | **0.850 ± 0.050** | **63.9%** | **65.0%** | **76.5%** | **70.3%** | **0.767** |
| **LCX** | **XGBoost** | **0.752 ± 0.027** | **65.6%** | **61.9%** | **50.0%** | **55.3%** | **0.686** |
| **RCA** | **XGBoost** | **0.714 ± 0.038** | **67.2%** | **50.0%** | **60.0%** | **54.5%** | **0.702** |

*Note: All holdout metrics evaluated at standard decision threshold p ≥ 0.50 on the isolated test partition (N = 61).*

---

## 9. Class Distribution & Imbalance Handling
- **Prevalence in Total Cohort (N = 303):**
  - **CAD:** 216 / 303 = **71.3%**
  - **LAD:** 177 / 303 = **58.4%**
  - **LCX:** 119 / 303 = **39.3%**
  - **RCA:** 114 / 303 = **37.6%**

- **Class Imbalance Mitigation:**
  - **Random Forest:** Managed via `class_weight='balanced'`, which inversely weights classes proportional to fold frequencies.
  - **XGBoost:** Managed via dynamic `scale_pos_weight = neg_count / pos_count`, calculated directly from the training split.

---

## 10. Explainability
CardioVision AI incorporates TreeSHAP (Tree-based SHapley Additive exPlanations) for local feature attributions:
> **"SHAP values describe the contribution of input features to the model's prediction for a given patient."**
> **"SHAP contribution is not clinical causation."**

- **Attribution Scope:** Explanations communicate how features shifted the model's numerical log-odds or probability relative to the training base rate.
- **Language Boundaries:** SHAP explanations do not assert that a feature caused, proves, is biologically responsible for, or determines disease. They reflect model behavior, not biological pathophysiology.

---

## 11. 3D Anatomical Mapping
The decision-support pipeline connects patient data to visual anatomy through four sequential steps:
$$\text{Patient Inputs} \longrightarrow \text{Model Probability} \longrightarrow \text{Target Vessel} \longrightarrow \text{Anatomical 3D Visualization}$$

- **Vessel Mappings:**
  - LAD probability $\rightarrow$ Left Anterior Descending anatomical vessel
  - LCX probability $\rightarrow$ Left Circumflex anatomical vessel
  - RCA probability $\rightarrow$ Right Coronary anatomical vessel
- **Core Visual Caveat:**
  > **"This mapping does not represent measured plaque location, lesion coordinates, or direct anatomical imaging."**
  Vessel highlights visually convey model-estimated risk tiers across arterial territories, not intravascular imaging coordinates.

---

## 12. Limitations
1. **Dataset size is 303 patients.**
2. **Evaluation is internal to the supplied dataset.**
3. **No external validation has been performed.**
4. **Generalization to other populations, institutions, devices, or clinical workflows is not established.**
5. **Vessel-level performance is lower than overall CAD performance for some targets.**
6. **Model probabilities are estimates, not direct anatomical measurements.**
7. **3D mapping is vessel-level visualization, not plaque localization.**
8. **SHAP explains model behavior, not biological causation.**
9. **The system has not been validated for diagnosis or treatment decisions.**

---

## 13. Clinical Status & Persistent Disclaimer
- **Classification:** **"Research & Educational Decision-Support Prototype"**
- **Persistent Mandatory Disclaimer:**
  > **"Model outputs are estimates for demonstration purposes only and are not medical diagnoses or substitutes for professional evaluation or formal diagnostic imaging."**
