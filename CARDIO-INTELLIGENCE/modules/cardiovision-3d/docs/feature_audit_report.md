# CardioVision AI: Complete Feature Audit & Target Leakage Verification Report

## Target Leakage Audit Statement
> **"Target leakage audit: LAD, LCX, RCA, Cath, and CAD are excluded from model inputs. Feature construction was audited for direct and indirect target leakage."**

---

## 1. Feature Count Reconciliation (Resolving 59 vs 55 vs 60 Discrepancy)

| Stage / Scope | Exact Count | Description & Columns |
| :--- | :---: | :--- |
| **A. Raw CSV Columns** | **59** | Full column count of `cardiovision_3d__backend_data__z_alizadeh_sani_extension.csv` |
| **B. Target Columns in Raw CSV** | **4** | `LAD`, `LCX`, `RCA`, `Cath` (invasive angiography outcomes) |
| **C. Target-Derived Clinical Concept** | **1** | `CAD` (derived clinical target from `Cath == 'CAD'`; not a separate 5th CSV column) |
| **D. Candidate Clinical Inputs (Pre-Cath)** | **55** | 59 raw columns - 4 raw target columns = 55 clinical predictors |
| **E. Cleaned / Mapped Features** | **55** | 53 numeric/binary features + 2 categorical string variables (`BBB`, `VHD`) |
| **F. Features Before One-Hot Encoding** | **55** | Exact columns provided to `ColumnTransformer` |
| **G. Final Transformed Features** | **60** | 53 standardized numeric/binary + 7 one-hot levels (3 `BBB` + 4 `VHD`) |
| **H. Engineered Features** | **0** | **Zero (0)** synthetic polynomial, interaction, or ratio features created |

### Discrepancy Resolution
The raw CSV contains 59 columns. Catheterization targets LAD, LCX, RCA, and Cath account for 4 columns, leaving exactly 55 candidate clinical input features (CAD is a clinical target synonym for Cath == 'CAD', not a 5th CSV column). After ColumnTransformer, the 53 numeric/binary features remain 53 standardized columns, while the 2 categorical features (BBB with 3 levels, VHD with 4 levels) expand via one-hot encoding into 7 binary indicator columns (53 + 7 = 60 transformed features). Zero features are engineered or derived from post-catheterization outcomes.

---

## 2. Target Variables Audit

| Column Name | Meaning in Data / Clinical Angiography | Target For | Leakage Exclusion Verification |
| :--- | :--- | :--- | :--- |
| **Cath** | Catheterization diagnosis (`CAD` vs `Normal`). >= 50% diameter stenosis in >= 1 major epicardial coronary vessel. | CAD Model | Strictly dropped before feature matrix X formation. Verified via runtime assertions. |
| **CAD** | Binary target variable (1: CAD, 0: Normal) derived from `Cath == 'CAD'`. Does NOT exist as a separate raw column. | CAD Model | Enforced in `LEAKAGE_COLUMNS`. Verified excluded from X. |
| **LAD** | Left Anterior Descending artery stenosis (>= 50% narrowing; `Stenotic` vs `Normal`). | LAD Model | Strictly dropped before feature matrix X formation. Verified via runtime assertions. |
| **LCX** | Left Circumflex artery branch stenosis (>= 50% narrowing; `Stenotic` vs `Normal`). | LCX Model | Strictly dropped before feature matrix X formation. Verified via runtime assertions. |
| **RCA** | Right Coronary artery branch stenosis (>= 50% narrowing; `Stenotic` vs `Normal`). | RCA Model | Strictly dropped before feature matrix X formation. Verified via runtime assertions. |

---

## 3. Engineered Feature Audit

- **Engineered Features Count:** **0**
- **Formula / Transformation:** None. No engineered polynomial terms, non-linear interaction features, or ratio proxies are constructed in the pipeline.
- **Source Columns:** None.
- **Target Independence:** Programmatically verified that no input feature is derived from `LAD`, `LCX`, `RCA`, `Cath`, `CAD`, or any post-catheterization outcome.
- **Transformer Operations:** Transformations applied by `ColumnTransformer` are strictly:
  1. `SimpleImputer(strategy='median')` + `StandardScaler()` for continuous/binary clinical features.
  2. `SimpleImputer(strategy='most_frequent')` + `OneHotEncoder(handle_unknown='ignore', sparse_output=False)` for multi-category clinical variables (`BBB`, `VHD`).

---

## 4. Complete Final Feature Inventory (60 Features)

| # | Category | Raw Column | Final Feature | Transformation | Used by CAD | Used by LAD | Used by LCX | Used by RCA | Leakage Status |
| :---: | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| 1 | Demographics | `Age` | `Age` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 2 | Demographics | `Weight` | `Weight` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 3 | Demographics | `Length` | `Length` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 4 | Demographics | `Sex` | `Sex` | Binary string mapping (Male:1, Female:0) -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 5 | Demographics | `BMI` | `BMI` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 6 | Medical History | `DM` | `DM` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 7 | Medical History | `HTN` | `HTN` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 8 | Medical History | `Current Smoker` | `Current Smoker` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 9 | Medical History | `EX-Smoker` | `EX-Smoker` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 10 | Medical History | `FH` | `FH` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 11 | Medical History | `Obesity` | `Obesity` | Binary string mapping (Y:1, N:0) -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 12 | Medical History | `CRF` | `CRF` | Binary string mapping (Y:1, N:0) -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 13 | Medical History | `CVA` | `CVA` | Binary string mapping (Y:1, N:0) -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 14 | Medical History | `Airway disease` | `Airway disease` | Binary string mapping (Y:1, N:0) -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 15 | Medical History | `Thyroid Disease` | `Thyroid Disease` | Binary string mapping (Y:1, N:0) -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 16 | Medical History | `CHF` | `CHF` | Binary string mapping (Y:1, N:0) -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 17 | Medical History | `DLP` | `DLP` | Binary string mapping (Y:1, N:0) -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 18 | Physical Examination / Vitals | `BP` | `BP` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 19 | Physical Examination / Vitals | `PR` | `PR` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 20 | Physical Examination / Vitals | `Edema` | `Edema` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 21 | Physical Examination / Vitals | `Weak Peripheral Pulse` | `Weak Peripheral Pulse` | Binary string mapping (Y:1, N:0) -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 22 | Physical Examination / Vitals | `Lung rales` | `Lung rales` | Binary string mapping (Y:1, N:0) -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 23 | Physical Examination / Vitals | `Systolic Murmur` | `Systolic Murmur` | Binary string mapping (Y:1, N:0) -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 24 | Physical Examination / Vitals | `Diastolic Murmur` | `Diastolic Murmur` | Binary string mapping (Y:1, N:0) -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 25 | Symptoms | `Typical Chest Pain` | `Typical Chest Pain` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 26 | Symptoms | `Dyspnea` | `Dyspnea` | Binary string mapping (Y:1, N:0) -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 27 | Symptoms | `Function Class` | `Function Class` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 28 | Symptoms | `Atypical` | `Atypical` | Binary string mapping (Y:1, N:0) -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 29 | Symptoms | `Nonanginal` | `Nonanginal` | Binary string mapping (Y:1, N:0) -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 30 | Symptoms | `Exertional CP` | `Exertional CP` | Binary string mapping (Y:1, N:0) -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 31 | Symptoms | `LowTH Ang` | `LowTH Ang` | Binary string mapping (Y:1, N:0) -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 32 | ECG | `Q Wave` | `Q Wave` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 33 | ECG | `St Elevation` | `St Elevation` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 34 | ECG | `St Depression` | `St Depression` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 35 | ECG | `Tinversion` | `Tinversion` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 36 | ECG | `LVH` | `LVH` | Binary string mapping (Y:1, N:0) -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 37 | ECG | `Poor R Progression` | `Poor R Progression` | Binary string mapping (Y:1, N:0) -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 38 | Laboratory | `FBS` | `FBS` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 39 | Laboratory | `CR` | `CR` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 40 | Laboratory | `TG` | `TG` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 41 | Laboratory | `LDL` | `LDL` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 42 | Laboratory | `HDL` | `HDL` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 43 | Laboratory | `BUN` | `BUN` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 44 | Laboratory | `ESR` | `ESR` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 45 | Laboratory | `HB` | `HB` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 46 | Laboratory | `K` | `K` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 47 | Laboratory | `Na` | `Na` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 48 | Laboratory | `WBC` | `WBC` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 49 | Laboratory | `Lymph` | `Lymph` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 50 | Laboratory | `Neut` | `Neut` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 51 | Laboratory | `PLT` | `PLT` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 52 | Echocardiography | `EF-TTE` | `EF-TTE` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 53 | Echocardiography | `Region RWMA` | `Region RWMA` | Numeric coercion -> SimpleImputer(median) -> StandardScaler | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 54 | ECG | `BBB` | `BBB_LBBB` | Categorical SimpleImputer(most_frequent) -> OneHotEncoder(level: LBBB) | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 55 | ECG | `BBB` | `BBB_N` | Categorical SimpleImputer(most_frequent) -> OneHotEncoder(level: N) | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 56 | ECG | `BBB` | `BBB_RBBB` | Categorical SimpleImputer(most_frequent) -> OneHotEncoder(level: RBBB) | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 57 | Echocardiography | `VHD` | `VHD_Moderate` | Categorical SimpleImputer(most_frequent) -> OneHotEncoder(level: Moderate) | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 58 | Echocardiography | `VHD` | `VHD_N` | Categorical SimpleImputer(most_frequent) -> OneHotEncoder(level: N) | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 59 | Echocardiography | `VHD` | `VHD_Severe` | Categorical SimpleImputer(most_frequent) -> OneHotEncoder(level: Severe) | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |
| 60 | Echocardiography | `VHD` | `VHD_mild` | Categorical SimpleImputer(most_frequent) -> OneHotEncoder(level: mild) | Yes | Yes | Yes | Yes | Clean (Non-Target / Pre-Cath) |

---

## 5. Train / Inference Schema Consistency Verification

| Verification Dimension | Training Pipeline (`train_models.py`) | Inference API (`cardiovision_3d__backend__main.py` / `build_raw_feature_vector`) | Status |
| :--- | :--- | :--- | :---: |
| **Candidate Input Columns** | 55 features (`X_clean.columns`) | 55 features (`ordered_row`) | **MATCH** |
| **Input Feature Names** | Exact match with UCI schema | Exact match with UCI schema | **MATCH** |
| **One-Hot Dummy Handling** | Performed by encapsulated `ColumnTransformer` | Performed by serialized `cad_model.named_steps['preprocessor']` | **MATCH** |
| **Transformed Vector Length** | 60 columns | 60 columns | **MATCH** |
| **Out-of-Vocabulary Protection** | `handle_unknown='ignore'` | `handle_unknown='ignore'` | **MATCH** |
| **Target Exclusion Enforcement** | Runtime assertion checks in `clean_feature_matrix` | Hardcoded absence of target fields in `build_raw_feature_vector` + assertion | **MATCH** |

---

## 6. Runtime Leakage Assertions Executed

```python
for leak in ['LAD', 'LCX', 'RCA', 'Cath', 'CAD']:
    assert leak not in X_train.columns
    assert leak not in X_test.columns
    assert leak not in num_cols
    assert leak not in cat_cols
    for tf in transformed_feature_names:
        assert tf != leak and not tf.startswith(leak + '_')
```

**Result: All assertions passed with 0 violations.**
