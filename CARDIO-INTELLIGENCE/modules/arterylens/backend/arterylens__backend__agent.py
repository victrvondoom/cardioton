"""
Clinical AI Explainer Agent for Cardiovascular Risk Prediction.
Provides tool-grounded clinical interpretations, what-if sensitivity simulations,
and safety-guarded diagnostic disclaimer enforcement.
"""
import os
import json
import re
from typing import Dict, Any, List, Optional

DISCLAIMER_TEXT = (
    "Disclaimer: These predictions and explanations are strictly for clinical decision support "
    "and educational purposes only. They are not a substitute for formal diagnostic imaging (e.g., coronary "
    "angiography, CCTA) or clinical judgment by a licensed physician."
)

class ClinicalExplainerAgent:
    def __init__(self, predict_fn, explain_fn, metrics_data):
        self.predict_fn = predict_fn
        self.explain_fn = explain_fn
        self.metrics_data = metrics_data

    def tool_predict_risk(self, patient_dict: dict) -> dict:
        """Runs the 4 calibrated ML models to get probabilities."""
        return self.predict_fn(patient_dict)

    def tool_get_explanation(self, patient_dict: dict, target: str = "CAD") -> dict:
        """Retrieves exact SHAP positive and negative feature impacts for a target."""
        return self.explain_fn(patient_dict, target)

    def tool_what_if(self, patient_dict: dict, changes: dict) -> dict:
        """
        Simulates counterfactual clinical interventions (e.g., smoking cessation,
        LDL reduction, blood pressure normalization) and returns delta in probabilities.
        """
        baseline = self.predict_fn(patient_dict)
        modified = dict(patient_dict)
        modified.update(changes)
        counterfactual = self.predict_fn(modified)
        
        diffs = {}
        for vessel in ["CAD", "LAD", "LCX", "RCA"]:
            base_p = baseline["probabilities"][vessel]
            mod_p = counterfactual["probabilities"][vessel]
            diffs[vessel] = {
                "baseline_prob": round(base_p, 3),
                "modified_prob": round(mod_p, 3),
                "absolute_risk_reduction": round(base_p - mod_p, 3),
                "relative_percent_change": round(((mod_p - base_p) / base_p) * 100, 1) if base_p > 0 else 0.0
            }
        return {
            "changes_applied": changes,
            "risk_comparison": diffs,
            "modified_risk_tier": counterfactual["risk_tier"]
        }

    def tool_get_model_metrics(self) -> dict:
        """Returns verified cross-validation performance benchmarks."""
        return {
            "best_models": self.metrics_data.get("best_models", {}),
            "cv_summary": self.metrics_data.get("cv_best", []),
            "vessel_reliability_notes": {
                "CAD": "High reliability (LogReg ROC-AUC 0.933, F1 0.903)",
                "LAD": "Strong reliability (RandomForest ROC-AUC 0.861, F1 0.833)",
                "LCX": "Moderate/Weak discrimination (XGBoost ROC-AUC 0.733, F1 0.580) - clinical features do not cleanly separate LCX lesions",
                "RCA": "Moderate/Weak discrimination (LogReg ROC-AUC 0.719, F1 0.604) - clinical markers exhibit overlap with non-stenotic RCA cases"
            }
        }

    def generate_clinical_explanation(self, patient_data: dict, selected_target: str = "CAD") -> dict:
        """
        Generates structured, verifiable clinical explanation using grounded tool outputs.
        Ensures:
        1. Plain language reasoning
        2. Exact probability citations matching tool outputs
        3. Clear caveat regarding LCX/RCA model discrimination
        4. Strict avoidance of definitive diagnosis or treatment prescribing
        5. Prominent decision-support disclaimer
        """
        preds = self.tool_predict_risk(patient_data)
        shaps = self.tool_get_explanation(patient_data, selected_target)
        metrics = self.tool_get_model_metrics()

        cad_p = preds["probabilities"]["CAD"]
        lad_p = preds["probabilities"]["LAD"]
        lcx_p = preds["probabilities"]["LCX"]
        rca_p = preds["probabilities"]["RCA"]

        # Top drivers for selected target
        pos_drivers = shaps.get("positive_features", [])[:4]
        neg_drivers = shaps.get("negative_features", [])[:3]

        pos_text = ", ".join([f"{item['feature']} (value: {item['value']})" for item in pos_drivers]) if pos_drivers else "none prominent"
        neg_text = ", ".join([f"{item['feature']} (value: {item['value']})" for item in neg_drivers]) if neg_drivers else "none prominent"

        # Determine overall interpretation
        if cad_p >= 0.70:
            cad_summary = f"High estimated CAD risk ({round(cad_p * 100, 1)}%). The calibrated predictive model indicates high likelihood of clinically significant coronary artery disease."
        elif cad_p >= 0.40:
            cad_summary = f"Intermediate/Borderline CAD risk ({round(cad_p * 100, 1)}%). Clinical presentation warrants further evaluation and risk-factor control."
        else:
            cad_summary = f"Low estimated CAD risk ({round(cad_p * 100, 1)}%). The clinical indicators suggest low acute probability of significant CAD."

        # Vessel specific summaries
        vessel_details = []
        vessel_details.append(f"• **LAD (Left Anterior Descending)**: Estimated risk **{round(lad_p * 100, 1)}%** ({preds['vessel_status']['LAD']}). Evaluated via Random Forest (AUC 0.86). Primary territory for anterior myocardium.")
        vessel_details.append(f"• **LCX (Left Circumflex)**: Estimated risk **{round(lcx_p * 100, 1)}%** ({preds['vessel_status']['LCX']}). *Model note: XGBoost ROC-AUC is 0.73; clinical data exhibits limited vessel-specific discrimination for LCX.*")
        vessel_details.append(f"• **RCA (Right Coronary Artery)**: Estimated risk **{round(rca_p * 100, 1)}%** ({preds['vessel_status']['RCA']}). *Model note: Logistic Regression ROC-AUC is 0.72; interpretations should be considered tentative.*")

        explanation_narrative = (
            f"### Clinical Case Interpretation ({selected_target} Focus)\n\n"
            f"**Overall Assessment**: {cad_summary}\n\n"
            f"**Coronary Artery Status (3D Vessel Mapping)**:\n"
            + "\n".join(vessel_details) + "\n\n"
            f"**Key Risk Drivers (SHAP Analysis for {selected_target})**:\n"
            f"- **Factors Increasing Risk**: {pos_text}\n"
            f"- **Protective / Mitigating Factors**: {neg_text}\n\n"
            f"**Reliability & Methodological Context**:\n"
            f"Overall CAD (AUC 0.93) and LAD (AUC 0.86) models exhibit strong discriminative power on repeated stratified 5-fold cross-validation. "
            f"In contrast, LCX (AUC 0.73) and RCA (AUC 0.72) models have moderate accuracy because non-invasive clinical symptoms and standard labs "
            f"often lack precise anatomical localization to circumflex or right coronary territories.\n\n"
            f"> **Safety Notice**: {DISCLAIMER_TEXT}"
        )

        return {
            "target": selected_target,
            "probabilities": preds["probabilities"],
            "risk_tier": preds["risk_tier"],
            "vessel_status": preds["vessel_status"],
            "top_risk_drivers": pos_drivers,
            "top_protective_drivers": neg_drivers,
            "narrative": explanation_narrative,
            "disclaimer": DISCLAIMER_TEXT
        }

    def answer_query(self, query: str, patient_data: dict, selected_target: str = "CAD") -> str:
        """Processes clinician conversational queries with grounded facts and safety rails."""
        q = query.lower().strip()
        preds = self.tool_predict_risk(patient_data)
        
        # Check if query is about what-if simulations
        if "what if" in q or "reduce" in q or "stop smoking" in q or "statins" in q or "cholesterol" in q:
            changes = {}
            if "smok" in q:
                changes["Current Smoker"] = 0.0
            if "ldl" in q or "cholesterol" in q or "statin" in q:
                changes["LDL"] = max(70.0, patient_data.get("LDL", 140.0) * 0.6)
            if "bp" in q or "blood pressure" in q or "hypertension" in q:
                changes["BP"] = 120.0
                changes["HTN"] = 0.0
            if not changes:
                # Default beneficial counterfactual
                changes = {"Current Smoker": 0.0, "LDL": 90.0, "BP": 120.0}

            sim = self.tool_what_if(patient_data, changes)
            applied_str = ", ".join([f"{k} -> {v}" for k, v in changes.items()])
            lines = [f"**Counterfactual Intervention Simulation ({applied_str})**:"]
            for v, diff in sim["risk_comparison"].items():
                lines.append(f"- **{v}**: {round(diff['baseline_prob']*100, 1)}% ➔ {round(diff['modified_prob']*100, 1)}% (ARR: -{round(diff['absolute_risk_reduction']*100, 1)}%)")
            lines.append(f"\n*Projected Risk Tier*: {sim['modified_risk_tier']}")
            lines.append(f"\n{DISCLAIMER_TEXT}")
            return "\n".join(lines)

        # Check if query is about metrics or model performance
        if "metric" in q or "auc" in q or "accuracy" in q or "reliable" in q or "reliability" in q:
            m = self.tool_get_model_metrics()
            notes = m["vessel_reliability_notes"]
            return (
                "**Cross-Validation Performance & Model Reliability Summary**:\n\n"
                f"- **CAD**: {notes['CAD']}\n"
                f"- **LAD**: {notes['LAD']}\n"
                f"- **LCX**: {notes['LCX']}\n"
                f"- **RCA**: {notes['RCA']}\n\n"
                "**Clinical Context**: Standard clinical lab data (lipids, ECG, echo) reliably predict overall disease "
                "and LAD involvement, but circumflex and RCA stenoses frequently occur with non-specific presentation, "
                "which accounts for lower AUC scores.\n\n"
                + DISCLAIMER_TEXT
            )

        # Standard explanation
        explanation = self.generate_clinical_explanation(patient_data, selected_target)
        return explanation["narrative"]
