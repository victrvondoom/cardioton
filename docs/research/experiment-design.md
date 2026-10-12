# Experiment Design - CardioTwin Evidence Continuity Engine

**Project:** CardioTwin - Cardiovascular Intelligence Workspace
**Phase:** 13 - Scientific Evaluation
**Document:** Experiment Design
**Date:** 2026-10-11
**Status:** DRAFT

---

## Executive Summary

This document outlines the experimental design for validating the CardioTwin Evidence Continuity Engine's effectiveness in detecting and managing inconsistent cardiovascular evidence. The experiments are designed to test the hypothesis that explicit evidence continuity validation improves upon simple timestamp-based approaches.

---

## 1. Research Questions

### 1.1 Primary Research Questions

1. **Q1: Effectiveness** - Does the Evidence Continuity Engine detect a higher proportion of true inconsistencies compared to baseline approaches?
2. **Q2: Precision** - Does the Evidence Continuity Engine maintain acceptable precision (low false positive rate)?
3. **Q3: Efficiency** - What is the computational overhead of the Evidence Continuity Engine?
4. **Q4: Clinical Relevance** - Are the detected inconsistencies clinically meaningful?

### 1.2 Secondary Research Questions

5. **Q5: Modality Specificity** - Which cardiovascular modalities benefit most from evidence continuity validation?
6. **Q6: Temporal Patterns** - What temporal patterns in cardiovascular data are most prone to inconsistencies?
7. **Q7: Uncertainty Impact** - How does uncertainty propagation affect detection performance?
8. **Q8: Integration Impact** - Does evidence continuity validation improve downstream digital twin accuracy?

---

## 2. Experimental Methodology

### 2.1 Study Design

**Design Type**: Comparative experimental study with synthetic and real-world data

**Approach**:
1. Create synthetic datasets with known ground truth inconsistencies
2. Run baseline and proposed methods on same datasets
3. Compare detection performance using standard metrics
4. Validate on real-world data where possible

### 2.2 Independent Variables

| Variable | Description | Levels |
|----------|-------------|--------|
| Detection Method | Approach used for inconsistency detection | Baseline (timestamp), Proposed (Evidence Continuity Engine) |
| Inconsistency Type | Category of inconsistency injected | Temporal, Modality, Version, Provenance |
| Inconsistency Severity | Clinical significance of inconsistency | Low, Medium, High |
| Data Completeness | Amount of data available | Complete, Partial, Sparse |
| Temporal Gap | Time difference between modalities | 0-1h, 1-6h, 6-24h, 1-7d, 7-30d |
| Modality Combination | Which modalities are present | ECG-only, Echo-only, Both, Multiple |

### 2.3 Dependent Variables

| Variable | Description | Measurement |
|----------|-------------|------------|
| Detection Rate | Proportion of true inconsistencies detected | Recall (0-1) |
| False Positive Rate | Proportion of detections that are false | Precision complement (0-1) |
| F1 Score | Harmonic mean of precision and recall | F1 = 2 * (precision * recall) / (precision + recall) |
| Detection Latency | Time to detect inconsistencies | Milliseconds |
| Computational Overhead | Additional processing time | % increase over baseline |
| Memory Usage | Additional memory required | MB increase |
| Clinical Utility Score | Clinician-rated usefulness | Likert scale (1-5) |

---

## 3. Experimental Setup

### 3.1 Datasets

#### 3.1.1 Synthetic Dataset

**Purpose**: Controlled environment with known ground truth

**Generation Method**:
- Start with realistic cardiovascular case templates
- Inject known inconsistencies using predefined patterns
- Ensure balance across inconsistency types and severities

**Dataset Characteristics**:

| Characteristic | Value |
|----------------|-------|
| Number of Cases | 1,000 |
| Modalities per Case | 2-4 (ECG, Echo, Clinical Notes, Labs) |
| Inconsistency Rate | 30% (300 cases with inconsistencies) |
| Inconsistency Types | Temporal (40%), Modality (30%), Version (20%), Provenance (10%) |
| Severity Distribution | Low (40%), Medium (40%), High (20%) |
| Temporal Coverage | 0-30 days |

**Case Generation Process**:

```
1. Select base cardiovascular case template
2. Generate consistent baseline data for all modalities
3. Randomly select inconsistency type and severity
4. Apply inconsistency transformation:
   - Temporal: Shift timestamp of one modality
   - Modality: Modify finding in one modality to contradict another
   - Version: Create multiple versions with conflicting changes
   - Provenance: Remove or obfuscate data source information
5. Add realistic noise and variations
6. Store ground truth for evaluation
```

**Ground Truth Storage**:
```json
{
  "case_id": "case_001",
  "inconsistencies": [
    {
      "type": "temporal",
      "severity": "high",
      "modality": "ecg",
      "inconsistent_with": "echo",
      "description": "ECG timestamp 48h after Echo timestamp",
      "detection_difficulty": "medium"
    }
  ],
  "evidence": {
    "ecg": {"timestamp": "2026-01-01T10:00:00Z", "version": "v1"},
    "echo": {"timestamp": "2026-01-01T08:00:00Z", "version": "v1"}
  }
}
```

#### 3.1.2 Real-World Dataset

**Purpose**: Validate performance on actual clinical data

**Source**: De-identified retrospective cardiovascular cases

**Inclusion Criteria**:
- Cases with multiple modalities collected within 30 days
- Cases with documented clinical timeline
- Cases with available outcomes for validation

**Exclusion Criteria**:
- Cases with incomplete data
- Cases without temporal information
- Cases with data quality issues

**Dataset Characteristics**:

| Characteristic | Target Value |
|----------------|--------------|
| Number of Cases | 200-500 |
| Modalities per Case | 2-4 |
| Time Coverage | 2020-2025 |
| Institutions | Multiple (for generalization) |

**Annotation Process**:
1. De-identify all patient information
2. Review cases for actual inconsistencies (gold standard)
3. Classify inconsistencies by type and severity
4. Create evaluation dataset with known ground truth

#### 3.1.3 Dataset Split

| Dataset | Purpose | Size | Notes |
|---------|---------|------|-------|
| Training | Method development and tuning | 400 | Synthetic only |
| Validation | Hyperparameter tuning | 200 | Synthetic only |
| Test | Final evaluation | 400 | Synthetic + Real-world |
| Holdout | Unbiased evaluation | 100 | Real-world only |

### 3.2 Baseline Methods

#### 3.2.1 Timestamp Baseline (TS-Base)

**Description**: Current industry standard using simple timestamp comparison

**Implementation**:
```python
class TimestampBaseline:
    def detect_inconsistencies(self, evidence_items):
        # Check if any evidence is older than threshold
        threshold = timedelta(days=7)
        now = datetime.utcnow()

        inconsistencies = []
        for item in evidence_items:
            if now - item.timestamp > threshold:
                inconsistencies.append({
                    "type": "temporal",
                    "item": item.id,
                    "reason": f"Data older than {threshold.days} days"
                })

        return inconsistencies
```

**Characteristics**:
- Simple timestamp thresholding
- No semantic understanding of data
- No cross-modality validation
- No uncertainty tracking

#### 3.2.2 Version Baseline (Ver-Base)

**Description**: Basic version tracking without semantic relationships

**Implementation**:
```python
class VersionBaseline:
    def detect_inconsistencies(self, evidence_items):
        inconsistencies = []

        # Check for multiple versions of same evidence type
        versions = {}
        for item in evidence_items:
            if item.evidence_type not in versions:
                versions[item.evidence_type] = []
            versions[item.evidence_type].append(item)

        for evidence_type, items in versions.items():
            if len(items) > 1:
                # Multiple versions exist
                for item in items[1:]:
                    inconsistencies.append({
                        "type": "version",
                        "item": item.id,
                        "reason": f"Multiple versions of {evidence_type}"
                    })

        return inconsistencies
```

**Characteristics**:
- Tracks versions within evidence types
- No semantic version comparison
- No temporal consideration
- No cross-modality understanding

#### 3.2.3 Hybrid Baseline (TS+Ver)

**Description**: Combination of timestamp and version baselines

**Implementation**: Run both baselines and combine results

**Characteristics**:
- Detects both temporal and version issues
- Still lacks semantic understanding
- Simple combination without intelligence

### 3.3 Proposed Method

**Description**: CardioTwin Evidence Continuity Engine

**Implementation**: See `backend/app/cardiotwin/services/evidence_continuity.py`

**Characteristics**:
- Versioned evidence graph
- Temporal alignment engine
- Constraint checking engine
- Provenance tracking
- Uncertainty propagation
- Digital twin synchronization validation

---

## 4. Evaluation Metrics

### 4.1 Primary Metrics

#### 4.1.1 Detection Performance

**Recall (Sensitivity)**:
```
Recall = True Positives / (True Positives + False Negatives)
```
*Proportion of actual inconsistencies that are detected*

**Precision**:
```
Precision = True Positives / (True Positives + False Positives)
```
*Proportion of detected inconsistencies that are actual inconsistencies*

**F1 Score**:
```
F1 = 2 * (Precision * Recall) / (Precision + Recall)
```
*Harmonic mean of precision and recall*

**False Positive Rate**:
```
FPR = False Positives / (False Positives + True Negatives)
```
*Proportion of consistent cases flagged as inconsistent*

#### 4.1.2 Performance Metrics

**Detection Latency**:
```
Latency = Detection Time - Inconsistency Introduction Time
```
*Time from when inconsistency is introduced to when it's detected*

**Throughput**:
```
Throughput = Number of Cases / Total Processing Time
```
*Cases processed per unit time*

**Computational Overhead**:
```
Overhead = (Proposed Time - Baseline Time) / Baseline Time * 100%
```
*Percentage increase in processing time over baseline*

### 4.2 Secondary Metrics

#### 4.2.1 Clinical Metrics

**Clinical Utility Score**:
- Clinician-rated usefulness of detected inconsistencies
- Scale: 1 (Not useful) to 5 (Highly useful)
- Measured through clinician survey

**Clinical Relevance**:
- Proportion of detected inconsistencies that would impact clinical decisions
- Binary classification by clinical experts

**Actionability**:
- Proportion of detected inconsistencies that can be resolved with available information
- Binary classification by clinical experts

#### 4.2.2 Modality-Specific Metrics

**Modality Recall**:
- Recall calculated separately for each modality type
- Identifies which modalities benefit most from evidence continuity

**Modality Precision**:
- Precision calculated separately for each modality type
- Identifies which modalities have most false positives

**Modality F1**:
- F1 score calculated separately for each modality type
- Overall performance by modality

#### 4.2.3 Inconsistency Type Metrics

**Type Recall**:
- Recall calculated separately for each inconsistency type
- Identifies which inconsistency types are easiest/hardest to detect

**Type Precision**:
- Precision calculated separately for each inconsistency type
- Identifies which inconsistency types have most false positives

### 4.3 Statistical Analysis

#### 4.3.1 Significance Testing

**McNemar's Test**: For comparing paired binary classification results
- Tests if proposed method has significantly different error rate than baseline

**Wilcoxon Signed-Rank Test**: For comparing paired continuous metrics
- Tests if proposed method has significantly different performance metrics than baseline

#### 4.3.2 Confidence Intervals

**95% Confidence Intervals**: Report for all primary metrics
- Calculated using bootstrapping for robustness

**Effect Size**:
- Cohen's d for continuous metrics
- Odds ratio for binary outcomes

#### 4.3.3 Power Analysis

**Sample Size Calculation**:
- Based on pilot study results
- Ensure 80% power to detect clinically meaningful differences

---

## 5. Experiment Execution

### 5.1 Equipment and Environment

**Hardware**:
- Development: Local workstations (16-32GB RAM, multi-core CPUs)
- Evaluation: Standardized cloud instances (consistent across all methods)
- Production: Clinical-grade hardware for real-world validation

**Software**:
- Python 3.10+
- Required libraries: See `requirements.txt`
- CardioTwin application
- Evaluation scripts

### 5.2 Experiment Protocol

#### 5.2.1 Training Phase

**Purpose**: Develop and tune the Evidence Continuity Engine

**Steps**:
1. Run all methods on training dataset
2. Analyze errors and false positives
3. Tune parameters and thresholds
4. Refine detection algorithms
5. Repeat until satisfactory performance on validation dataset

**Stopping Criteria**:
- F1 score > 0.85 on validation dataset
- Precision > 0.90 on validation dataset
- Computational overhead < 10%

#### 5.2.2 Validation Phase

**Purpose**: Final tuning and selection of best configuration

**Steps**:
1. Run all methods on validation dataset with multiple parameter combinations
2. Select best configuration based on F1 score
3. Verify performance on edge cases

**Output**: Final configured Evidence Continuity Engine

#### 5.2.3 Test Phase

**Purpose**: Unbiased evaluation of final performance

**Steps**:
1. Freeze all methods (no further tuning)
2. Run all methods on test dataset
3. Calculate all metrics
4. Perform statistical analysis

**Output**: Performance metrics and statistical significance results

#### 5.2.4 Holdout Phase

**Purpose**: Final validation on completely unseen data

**Steps**:
1. Run final configured method on holdout dataset
2. Calculate all metrics
3. Compare with training/validation/test results

**Output**: Holdout performance metrics

### 5.3 Data Processing Pipeline

```
Input Data
    │
    ▼
┌─────────────────┐
│ Preprocessing    │
│ - De-identify   │
│ - Normalize      │
│ - Validate       │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│                 For Each Method:            │
│ ┌──────────────┐ ┌──────────────┐        │
│ │ Timestamp     │ │ Version       │        │
│ │ Baseline     │ │ Baseline      │        │
│ └──────────────┘ └──────────────┘        │
│ ┌──────────────┐ ┌──────────────┐        │
│ │ Hybrid        │ │ Proposed      │        │
│ │ Baseline     │ │ Method        │        │
│ └──────────────┘ └──────────────┘        │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│                Metric Calculation            │
│ - True Positives                         │
│ - False Positives                        │
│ - False Negatives                        │
│ - True Negatives                         │
│ - Processing Time                        │
│ - Memory Usage                           │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│                Statistical Analysis         │
│ - Significance Testing                    │
│ - Confidence Intervals                   │
│ - Effect Size Calculation                 │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│                Results Reporting            │
│ - Performance Tables                      │
│ - Visualizations                          │
│ - Statistical Summaries                   │
└─────────────────────────────────────────┘
```

---

## 6. Expected Results

### 6.1 Hypotheses

**H0: Null Hypotheses**
- H0.1: There is no difference in recall between the Evidence Continuity Engine and timestamp baseline
- H0.2: There is no difference in precision between the Evidence Continuity Engine and timestamp baseline
- H0.3: There is no difference in F1 score between the Evidence Continuity Engine and timestamp baseline
- H0.4: The computational overhead of the Evidence Continuity Engine is acceptable (<10%)

**H1: Alternative Hypotheses**
- H1.1: The Evidence Continuity Engine has higher recall than timestamp baseline
- H1.2: The Evidence Continuity Engine has higher precision than timestamp baseline
- H1.3: The Evidence Continuity Engine has higher F1 score than timestamp baseline
- H1.4: The computational overhead is acceptable

### 6.2 Expected Outcomes

Based on pilot studies and system design:

| Metric | Timestamp Baseline | Evidence Continuity Engine | Expected Improvement |
|--------|-------------------|---------------------------|----------------------|
| Recall | 0.65 | 0.90 | +0.25 (+38%) |
| Precision | 0.85 | 0.92 | +0.07 (+8%) |
| F1 Score | 0.74 | 0.91 | +0.17 (+23%) |
| FPR | 0.15 | 0.08 | -0.07 (-47%) |
| Detection Latency | 100ms | 150ms | +50ms (+50%) |
| Computational Overhead | N/A | <10% | Acceptable |
| Clinical Utility | 3.5/5 | 4.5/5 | +1.0 (+29%) |

**Modality-Specific Expectations**:
- **ECG**: Highest recall improvement (easy to validate temporally)
- **Imaging**: Highest precision (fewer false positives due to semantic understanding)
- **Clinical Notes**: Highest clinical utility (most impact on decisions)

**Inconsistency Type Expectations**:
- **Temporal**: Highest recall (explicit temporal validation)
- **Modality**: Highest clinical utility (cross-modality contradictions are most clinically relevant)
- **Provenance**: Highest precision (explicit tracking)

### 6.3 Success Criteria

**Technical Success**:
- [ ] F1 score > 0.85
- [ ] Precision > 0.90
- [ ] Recall > 0.85
- [ ] Computational overhead < 10%

**Clinical Success**:
- [ ] Clinical utility score > 4.0/5
- [ ] Clinical relevance > 80%
- [ ] Actionability > 70%

**Statistical Success**:
- [ ] Significant improvement over all baselines (p < 0.05)
- [ ] Medium or large effect sizes (Cohen's d > 0.5)

---

## 7. Risk Management

### 7.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Performance issues | Medium | High | Optimize algorithms, use efficient data structures |
| Memory limitations | Low | High | Implement streaming processing for large graphs |
| Integration problems | Medium | Medium | Comprehensive unit and integration testing |
| Data quality issues | High | Medium | Implement robust data validation and cleaning |

### 7.2 Clinical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| False negatives | Medium | High | Maximize recall while maintaining precision |
| False positives | Medium | Medium | Maximize precision through conservative thresholds |
| Clinical acceptance | Medium | High | Involve clinicians early, demonstrate clear value |

### 7.3 Ethical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Patient data privacy | Low | High | Use only de-identified data, follow HIPAA/GDPR |
| Bias in algorithms | Medium | High | Diverse training data, bias testing, clinical validation |
| Misuse of system | Low | High | Clear documentation, training, usage restrictions |

---

## 8. Timeline

| Phase | Duration | Activities | Deliverables |
|-------|----------|------------|--------------|
| Preparation | 2 weeks | Dataset generation, baseline implementation | Synthetic dataset, baseline code |
| Training | 3 weeks | Method development and tuning | Tuned Evidence Continuity Engine |
| Validation | 1 week | Hyperparameter tuning, edge case testing | Final configuration |
| Testing | 2 weeks | Unbiased evaluation, statistical analysis | Performance metrics, statistical results |
| Reporting | 2 weeks | Documentation, visualization, presentation | Experiment report, presentations |
| **Total** | **10 weeks** | | **Complete experiment** |

---

## 9. Deliverables

### 9.1 Code Deliverables

- [ ] Synthetic dataset generator
- [ ] Baseline method implementations
- [ ] Evaluation scripts
- [ ] Statistical analysis scripts
- [ ] Visualization scripts

### 9.2 Data Deliverables

- [ ] Synthetic training dataset (400 cases)
- [ ] Synthetic validation dataset (200 cases)
- [ ] Synthetic test dataset (200 cases)
- [ ] Real-world test dataset (200 cases)
- [ ] Ground truth annotations for all datasets

### 9.3 Documentation Deliverables

- [ ] This experiment design document
- [ ] Dataset documentation
- [ ] Analysis scripts documentation
- [ ] Results report
- [ ] Statistical analysis report

### 9.4 Presentation Deliverables

- [ ] Internal review presentation
- [ ] Clinical advisory board presentation
- [ ] Conference submission (if applicable)
- [ ] Publication (if applicable)

---

## Appendix A: Evaluation Script Template

```python
"""Experiment Evaluation Script"""

import json
import time
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
from sklearn.metrics import (
    f1_score,
    precision_score,
    recall_score,
    confusion_matrix,
)


class ExperimentEvaluator:
    """Evaluates experiment results."""

    def __init__(self, ground_truth_path: str, results_dir: str):
        self.ground_truth = self._load_ground_truth(ground_truth_path)
        self.results_dir = Path(results_dir)

    def _load_ground_truth(self, path: str) -> Dict[str, Any]:
        """Load ground truth data."""
        with open(path) as f:
            return json.load(f)

    def evaluate_method(
        self,
        method_name: str,
        results_path: str | None = None
    ) -> Dict[str, Any]:
        """Evaluate a single method."""
        start_time = time.time()

        # Load results
        if results_path is None:
            results_path = self.results_dir / f"{method_name}.json"

        with open(results_path) as f:
            results = json.load(f)

        # Calculate metrics
        metrics = self._calculate_metrics(results)

        # Calculate timing
        processing_time = results.get("processing_time", 0)
        metrics["processing_time"] = processing_time
        metrics["evaluation_time"] = time.time() - start_time

        return metrics

    def _calculate_metrics(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate evaluation metrics."""
        # Extract predictions
        predictions = results.get("inconsistencies", [])

        # Get true labels from ground truth
        true_labels = []
        pred_labels = []

        for case_id, case_data in self.ground_truth.items():
            true_inconsistencies = case_data.get("inconsistencies", [])
            true_labels.append(1 if true_inconsistencies else 0)

            # Check if method detected this case as inconsistent
            case_predictions = [p for p in predictions if p.get("case_id") == case_id]
            pred_labels.append(1 if case_predictions else 0)

        # Calculate metrics
        precision = precision_score(true_labels, pred_labels)
        recall = recall_score(true_labels, pred_labels)
        f1 = f1_score(true_labels, pred_labels)
        tn, fp, fn, tp = confusion_matrix(true_labels, pred_labels).ravel()
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0

        return {
            "precision": precision,
            "recall": recall,
            "f1_score": f1,
            "false_positive_rate": fpr,
            "true_positives": int(tp),
            "false_positives": int(fp),
            "false_negatives": int(fn),
            "true_negatives": int(tn),
        }

    def compare_methods(
        self,
        method_names: List[str]
    ) -> Dict[str, Any]:
        """Compare multiple methods."""
        results = {}

        for method_name in method_names:
            results[method_name] = self.evaluate_method(method_name)

        return results


if __name__ == "__main__":
    evaluator = ExperimentEvaluator(
        ground_truth_path="data/test/ground_truth.json",
        results_dir="results/test"
    )

    methods = ["timestamp_baseline", "version_baseline", "hybrid_baseline", "proposed"]
    results = evaluator.compare_methods(methods)

    # Print results
    for method, metrics in results.items():
        print(f"\n{method}:")
        for key, value in metrics.items():
            if isinstance(value, float):
                print(f"  {key}: {value:.4f}")
            else:
                print(f"  {key}: {value}")
```

---

## Appendix B: Statistical Analysis Script Template

```python
"""Statistical Analysis Script"""

import json
import numpy as np
import pandas as pd
import scipy.stats as stats
from pathlib import Path
from typing import Any, Dict


class StatisticalAnalyzer:
    """Performs statistical analysis on experiment results."""

    def __init__(self, results_dir: str):
        self.results_dir = Path(results_dir)

    def load_results(self) -> Dict[str, Any]:
        """Load all results."""
        results = {}

        for result_file in self.results_dir.glob("*.json"):
            method_name = result_file.stem
            with open(result_file) as f:
                results[method_name] = json.load(f)

        return results

    def compare_metrics(
        self,
        metric: str,
        method1: str,
        method2: str,
        paired: bool = True
    ) -> Dict[str, Any]:
        """Compare two methods on a specific metric."""
        results = self.load_results()

        values1 = [r[metric] for r in results[method1].values()]
        values2 = [r[metric] for r in results[method2].values()]

        # Paired t-test
        if paired:
            t_stat, p_value = stats.ttest_rel(values1, values2)
            test_name = "Paired t-test"
        else:
            t_stat, p_value = stats.ttest_ind(values1, values2)
            test_name = "Independent t-test"

        # Effect size
        mean_diff = np.mean(values2) - np.mean(values1)
        std_diff = np.std(values1 - values2) if paired else np.std(values1 + values2)
        cohen_d = mean_diff / std_diff if std_diff > 0 else 0

        # Confidence intervals
        mean1 = np.mean(values1)
        mean2 = np.mean(values2)
        std1 = np.std(values1, ddof=1)
        std2 = np.std(values2, ddof=1)
        n1 = len(values1)
        n2 = len(values2)

        ci1 = stats.t.interval(
            0.95, df=n1-1, loc=mean1, scale=std1/np.sqrt(n1)
        )
        ci2 = stats.t.interval(
            0.95, df=n2-1, loc=mean2, scale=std2/np.sqrt(n2)
        )

        return {
            "test": test_name,
            "t_statistic": t_stat,
            "p_value": p_value,
            "significant": p_value < 0.05,
            "effect_size": {
                "cohen_d": cohen_d,
                "interpretation": self._interpret_cohen_d(cohen_d)
            },
            "confidence_intervals": {
                method1: ci1.tolist(),
                method2: ci2.tolist()
            },
            "means": {
                method1: mean1,
                method2: mean2
            },
            "differences": {
                "mean": mean_diff,
                "std": std_diff
            }
        }

    def _interpret_cohen_d(self, d: float) -> str:
        """Interpret Cohen's d effect size."""
        if abs(d) < 0.2:
            return "Negligible"
        elif abs(d) < 0.5:
            return "Small"
        elif abs(d) < 0.8:
            return "Medium"
        else:
            return "Large"


if __name__ == "__main__":
    analyzer = StatisticalAnalyzer(results_dir="results/test")

    # Compare F1 scores
    results = analyzer.compare_metrics(
        metric="f1_score",
        method1="timestamp_baseline",
        method2="proposed",
        paired=True
    )

    print("F1 Score Comparison:")
    print(json.dumps(results, indent=2))
```

---

*Document Version: 1.0*
*Last Updated: 2026-10-11*
*Author: CardioTwin Development Team*
