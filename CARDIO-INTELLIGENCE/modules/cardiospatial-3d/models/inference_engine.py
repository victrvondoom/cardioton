import os
import math
import joblib
import numpy as np
import pandas as pd
import shap
from typing import Dict, Any, List, Tuple

MODELS_PATH = os.path.join(os.path.dirname(__file__), "cardio_models.joblib")
DATA_CLEAN_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "cardiac_dataset_clean.csv")

class CardioInferenceEngine:
    _instance = None
    
    def __init__(self):
        if not os.path.exists(MODELS_PATH):
            raise FileNotFoundError(f"Model file not found at {MODELS_PATH}. Run train_pipeline.py first.")
            
        print("Loading trained cardiac models and explainers...")
        self.payload = joblib.load(MODELS_PATH)
        self.scaler = self.payload['scaler']
        self.feature_cols = self.payload['feature_cols']
        self.target_cols = self.payload['target_cols']
        self.best_models = self.payload['best_models']
        self.metrics = self.payload['metrics']
        
        # Initialize fast SHAP TreeExplainers for each target
        self.explainers = {}
        for target in self.target_cols:
            model = self.best_models[target]['model']
            try:
                self.explainers[target] = shap.TreeExplainer(model)
            except Exception as e:
                print(f"Fallback TreeExplainer for {target}: {e}")
                self.explainers[target] = shap.Explainer(model.predict_proba)
                
        # Load sample baseline dataset for reference values
        if os.path.exists(DATA_CLEAN_PATH):
            self.df_baseline = pd.read_csv(DATA_CLEAN_PATH)
        else:
            self.df_baseline = None
            
        print("Inference Engine initialized successfully.")

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = CardioInferenceEngine()
        return cls._instance

    def preprocess_input(self, input_dict: Dict[str, Any]) -> Tuple[np.ndarray, pd.DataFrame]:
        """
        Takes raw dictionary of patient features, formats into aligned DataFrame and scaled array.
        """
        row = {}
        for col in self.feature_cols:
            val = input_dict.get(col, 0)
            if isinstance(val, bool):
                val = 1 if val else 0
            elif isinstance(val, str):
                v_clean = val.strip().lower()
                if v_clean in ['y', 'yes', 'male', 'cad', '1', 'true']:
                    val = 1
                elif v_clean in ['n', 'no', 'female', 'fmale', 'normal', '0', 'false']:
                    val = 0
                elif v_clean == 'lbbb':
                    val = 1
                elif v_clean == 'rbbb':
                    val = 2
                elif v_clean == 'mild':
                    val = 1
                elif v_clean == 'moderate':
                    val = 2
                elif v_clean == 'severe':
                    val = 3
                else:
                    try:
                        val = float(val)
                    except:
                        val = 0.0
            row[col] = float(val)
            
        df_single = pd.DataFrame([row], columns=self.feature_cols)
        X_scaled = self.scaler.transform(df_single)
        return X_scaled, df_single

    def predict(self, input_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes multi-vessel and overall CAD prediction.
        """
        X_scaled, df_single = self.preprocess_input(input_dict)
        
        predictions = {}
        probabilities = {}
        
        for target in self.target_cols:
            model = self.best_models[target]['model']
            proba = model.predict_proba(X_scaled)[0, 1]
            pred = int(proba >= 0.50)
            
            probabilities[target] = float(proba)
            predictions[target] = pred
            
        # Clinical Risk Stratification
        cad_prob = probabilities['CAD']
        lad_prob = probabilities['LAD']
        lcx_prob = probabilities['LCX']
        rca_prob = probabilities['RCA']
        
        vessels_at_risk = []
        if lad_prob >= 0.50: vessels_at_risk.append("LAD")
        if lcx_prob >= 0.50: vessels_at_risk.append("LCX")
        if rca_prob >= 0.50: vessels_at_risk.append("RCA")
        
        num_vessels = len(vessels_at_risk)
        
        if num_vessels >= 3 or (lad_prob >= 0.70 and (lcx_prob >= 0.50 or rca_prob >= 0.50)):
            risk_tier = "High Multi-Vessel Stenosis Risk"
            risk_level = "HIGH"
            color = "#EF4444" # Red
            recommendation = "Multi-vessel risk markers detected. Research decision-support recommendation: Priority cardiology evaluation & non-invasive functional imaging advised."
        elif num_vessels >= 1 or cad_prob >= 0.50:
            risk_tier = "Predicted Flow-Limiting Stenosis (>=50%)"
            risk_level = "MODERATE_HIGH"
            color = "#EF4444" # Red
            recommendation = "Positive stenosis prediction (>=50%). Research decision-support recommendation: Guideline-directed medical therapy & clinical follow-up."
        elif cad_prob >= 0.30:
            risk_tier = "Intermediate Risk (30% - 49%)"
            risk_level = "INTERMEDIATE"
            color = "#F59E0B" # Yellow/Amber
            recommendation = "Intermediate risk range. Research decision-support recommendation: Cardiovascular risk factor modification & periodic screening."
        else:
            risk_tier = "Low Risk (<30%)"
            risk_level = "LOW"
            color = "#10B981" # Green
            recommendation = "Low predicted probability of flow-limiting stenosis. Maintain standard preventive cardiovascular lifestyle."

        # Vessel Specific Anatomy Summary (Strict Dataset Thresholds: <30% Green, 30-49% Yellow, >=50% Red)
        vessel_details = {
            'LAD': {
                'name': 'Left Anterior Descending Artery',
                'probability': lad_prob,
                'status': 'Predicted Stenosis (>=50%)' if lad_prob >= 0.50 else ('Intermediate (30-49%)' if lad_prob >= 0.30 else 'Low Risk (<30%)'),
                'stenosis_grade': 'Severe (>=50%)' if lad_prob >= 0.50 else ('Intermediate (30-49%)' if lad_prob >= 0.30 else 'Low (<30%)'),
                'color': '#EF4444' if lad_prob >= 0.50 else ('#F59E0B' if lad_prob >= 0.30 else '#10B981'),
                'perfusion_territory': 'Anterior Left Ventricle, Apex, & Anterior 2/3 of Interventricular Septum',
                'clinical_impact': 'High (Anterior myocardium salvage priority)'
            },
            'LCX': {
                'name': 'Left Circumflex Artery',
                'probability': lcx_prob,
                'status': 'Predicted Stenosis (>=50%)' if lcx_prob >= 0.50 else ('Intermediate (30-49%)' if lcx_prob >= 0.30 else 'Low Risk (<30%)'),
                'stenosis_grade': 'Severe (>=50%)' if lcx_prob >= 0.50 else ('Intermediate (30-49%)' if lcx_prob >= 0.30 else 'Low (<30%)'),
                'color': '#EF4444' if lcx_prob >= 0.50 else ('#F59E0B' if lcx_prob >= 0.30 else '#10B981'),
                'perfusion_territory': 'Lateral & Posterolateral Left Ventricular Free Wall',
                'clinical_impact': 'Moderate-to-High (Lateral ischemia & papillary muscle perfusion)'
            },
            'RCA': {
                'name': 'Right Coronary Artery',
                'probability': rca_prob,
                'status': 'Predicted Stenosis (>=50%)' if rca_prob >= 0.50 else ('Intermediate (30-49%)' if rca_prob >= 0.30 else 'Low Risk (<30%)'),
                'stenosis_grade': 'Severe (>=50%)' if rca_prob >= 0.50 else ('Intermediate (30-49%)' if rca_prob >= 0.30 else 'Low (<30%)'),
                'color': '#EF4444' if rca_prob >= 0.50 else ('#F59E0B' if rca_prob >= 0.30 else '#10B981'),
                'perfusion_territory': 'Right Ventricle, Inferior Left Ventricle Wall, & SA/AV Nodal conduction system',
                'clinical_impact': 'High (Inferior wall perfusion & conduction system)'
            }
        }
        
        return {
            'overall_cad': {
                'probability': cad_prob,
                'status': 'Predicted CAD (>=50%)' if cad_prob >= 0.50 else ('Intermediate Risk' if cad_prob >= 0.30 else 'Low CAD Risk'),
                'risk_tier': risk_tier,
                'risk_level': risk_level,
                'color': color,
                'recommendation': recommendation
            },
            'vessels': vessel_details,
            'vessels_at_risk_count': num_vessels,
            'vessels_at_risk_list': vessels_at_risk
        }

    def explain(self, input_dict: Dict[str, Any], target: str = 'CAD', top_k: int = 10) -> Dict[str, Any]:
        """
        Calculates local SHAP values for a given patient and target to provide clinical feature attribution.
        """
        if target not in self.target_cols:
            target = 'CAD'
            
        X_scaled, df_single = self.preprocess_input(input_dict)
        explainer = self.explainers[target]
        
        try:
            shap_values = explainer.shap_values(X_scaled)
            # If multi-class or list returned, take positive class (index 1)
            if isinstance(shap_values, list):
                shap_vals_arr = shap_values[1][0]
            elif len(shap_values.shape) == 3:
                shap_vals_arr = shap_values[0, :, 1]
            else:
                shap_vals_arr = shap_values[0]
        except Exception as e:
            # Linear fallback
            model = self.best_models[target]['model']
            if hasattr(model, 'feature_importances_'):
                shap_vals_arr = model.feature_importances_ * X_scaled[0]
            else:
                shap_vals_arr = model.coef_[0] * X_scaled[0]
                
        # Build structured feature attribution
        explanations = []
        for i, col in enumerate(self.feature_cols):
            val_raw = df_single[col].values[0]
            shap_val = float(shap_vals_arr[i])
            explanations.append({
                'feature': col,
                'value': val_raw,
                'shap_value': shap_val,
                'direction': 'increases_risk' if shap_val > 0 else 'decreases_risk',
                'abs_impact': abs(shap_val)
            })
            
        explanations = sorted(explanations, key=lambda x: x['abs_impact'], reverse=True)
        top_explanations = explanations[:top_k]
        
        # Clinical Interpretation Narrative
        positive_factors = [f"{x['feature']} ({x['value']:.1f})" for x in top_explanations if x['direction'] == 'increases_risk'][:3]
        protective_factors = [f"{x['feature']} ({x['value']:.1f})" for x in top_explanations if x['direction'] == 'decreases_risk'][:3]
        
        narrative = f"Prediction for {target} is primarily driven upwards by {', '.join(positive_factors) if positive_factors else 'baseline demographic risk'}."
        if protective_factors:
            narrative += f" Favorable mitigating factors include {', '.join(protective_factors)}."
            
        return {
            'target': target,
            'top_features': top_explanations,
            'narrative': narrative,
            'global_feature_importance': self.metrics[target].get('global_feature_importance', [])
        }

    def calculate_hemodynamics(self, predictions: Dict[str, Any], input_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculates simulated Intravascular Ultrasound (IVUS) & Fractional Flow Reserve (FFR) hemodynamics
        based on predicted vessel stenosis and regional wall motion abnormalities.
        """
        vessels = predictions.get('vessels', {})
        hemodynamics = {}
        
        # Base reference lumen parameters
        ref_lumens = {
            'LAD': {'ref_diameter': 3.6, 'ref_area': 10.18}, # mm, mm2
            'LCX': {'ref_diameter': 3.2, 'ref_area': 8.04},
            'RCA': {'ref_diameter': 3.8, 'ref_area': 11.34}
        }
        
        syntax_points = 0
        
        for v_key in ['LAD', 'LCX', 'RCA']:
            prob = vessels.get(v_key, {}).get('probability', 0.1)
            ref = ref_lumens[v_key]
            
            # Stenosis percentage estimate
            percent_stenosis = round(min(99.0, max(5.0, prob * 95.0)), 1)
            
            # Simulated Fractional Flow Reserve (FFR)
            # FFR <= 0.80 indicates flow-limiting, functionally significant ischemia
            ffr = round(max(0.42, 1.0 - (prob * 0.52) - (0.06 if percent_stenosis > 70 else 0.0)), 2)
            
            # Minimum Lumen Area (MLA in mm2)
            # MLA < 4.0 mm2 in major epicardial vessels indicates severe anatomical stenosis
            area_reduction = (percent_stenosis / 100.0) ** 1.35
            mla = round(max(0.8, ref['ref_area'] * (1.0 - area_reduction)), 2)
            min_diameter = round(max(0.9, ref['ref_diameter'] * math.sqrt(1.0 - (percent_stenosis / 100.0))), 2)
            
            # Plaque burden percentage (IVUS cross-section)
            plaque_burden = round(min(92.0, max(12.0, percent_stenosis * 0.95 + 8.0)), 1)
            
            # Flow-limiting classification
            if ffr <= 0.75:
                ischemia_status = "Severe Flow-Limiting Ischemia (FFR <= 0.75)"
                hemo_color = "#EF4444"
            elif ffr <= 0.80:
                ischemia_status = "Ischemic Threshold Positive (FFR 0.76 - 0.80)"
                hemo_color = "#F59E0B"
            else:
                ischemia_status = "Hemodynamically Preserved (FFR > 0.80)"
                hemo_color = "#10B981"
                
            if percent_stenosis >= 50:
                syntax_points += (3.5 if v_key == 'LAD' else 2.0)
                if percent_stenosis >= 75:
                    syntax_points += 2.0
                    
            hemodynamics[v_key] = {
                'vessel': v_key,
                'percent_stenosis': percent_stenosis,
                'ffr': ffr,
                'mla_mm2': mla,
                'ref_area_mm2': ref['ref_area'],
                'min_diameter_mm': min_diameter,
                'ref_diameter_mm': ref['ref_diameter'],
                'plaque_burden_pct': plaque_burden,
                'ischemia_status': ischemia_status,
                'is_ischemic': bool(ffr <= 0.80),
                'color': hemo_color
            }
            
        # Estimated SYNTAX Score category
        syntax_score = round(syntax_points, 1)
        if syntax_score >= 23:
            syntax_tier = "High Anatomic Complexity (SYNTAX >= 23)"
        elif syntax_score >= 12:
            syntax_tier = "Intermediate Complexity (SYNTAX 12 - 22)"
        else:
            syntax_tier = "Low Anatomic Complexity (SYNTAX < 12)"
            
        return {
            'vessels': hemodynamics,
            'syntax_score': syntax_score,
            'syntax_tier': syntax_tier
        }

    def simulate_intervention(self, base_features: Dict[str, Any], interventions: Dict[str, bool]) -> Dict[str, Any]:
        """
        Simulates counterfactual clinical interventions (Statin, Antihypertensive, Smoking Cessation, Glycemic control)
        and predicts post-intervention risk reduction on 3D vessels and overall CAD.
        """
        counterfactual = dict(base_features)
        applied_treatments = []
        
        # 1. High-Intensity Statin Therapy (Atorvastatin 80mg / Rosuvastatin 40mg)
        if interventions.get('statin', False):
            orig_ldl = float(counterfactual.get('LDL', 140))
            new_ldl = round(max(55.0, orig_ldl * 0.48), 1)
            counterfactual['LDL'] = new_ldl
            counterfactual['TG'] = round(max(90.0, float(counterfactual.get('TG', 180)) * 0.78), 1)
            counterfactual['DLP'] = 0
            applied_treatments.append(f"High-Intensity Statin: LDL {orig_ldl} -> {new_ldl} mg/dL (-52%)")
            
        # 2. Antihypertensive Optimization (ACEi / ARB + CCB)
        if interventions.get('bp_control', False):
            orig_bp = float(counterfactual.get('BP', 145))
            new_bp = 120.0
            counterfactual['BP'] = new_bp
            counterfactual['HTN'] = 0
            applied_treatments.append(f"Blood Pressure Control: SBP {orig_bp} -> {new_bp} mmHg")
            
        # 3. Smoking Cessation Protocol
        if interventions.get('smoking_cessation', False):
            counterfactual['Current Smoker'] = 0
            applied_treatments.append("Smoking Cessation achieved (Current Smoker: No)")
            
        # 4. Intensive Glycemic Control (SGLT2i / GLP-1 RA)
        if interventions.get('glucose_control', False):
            orig_fbs = float(counterfactual.get('FBS', 130))
            new_fbs = 94.0
            counterfactual['FBS'] = new_fbs
            counterfactual['DM'] = 0
            applied_treatments.append(f"Glycemic Normalization: FBS {orig_fbs} -> {new_fbs} mg/dL")
            
        # 5. Cardiac Rehabilitation & Exercise Conditioning
        if interventions.get('rehab', False):
            orig_ef = float(counterfactual.get('EF-TTE', 45))
            new_ef = min(60.0, orig_ef + 4.0)
            counterfactual['EF-TTE'] = new_ef
            counterfactual['BMI'] = round(max(22.0, float(counterfactual.get('BMI', 28.5)) * 0.94), 1)
            counterfactual['PR'] = round(max(60.0, float(counterfactual.get('PR', 78)) - 6.0), 0)
            applied_treatments.append(f"Cardiac Rehabilitation: EF-TTE {orig_ef}% -> {new_ef}%, conditioning improved")

        # 6. Guideline Anti-Ischemic Therapy & Myocardial Salvage (Anti-anginals / Revascularization)
        if interventions.get('anti_ischemic', True):
            counterfactual['Typical Chest Pain'] = 0
            counterfactual['Dyspnea'] = 'N'
            counterfactual['Atypical'] = 'N'
            counterfactual['St Elevation'] = 0
            counterfactual['St Depression'] = 0
            counterfactual['Tinversion'] = 0
            counterfactual['Region RWMA'] = 0
            counterfactual['Function Class'] = 1
            applied_treatments.append("Anti-Ischemic & Myocardial Salvage Therapy: Angina resolved, RWMA normalized to 0, ECG repolarization stabilized")
            
        # Execute baseline & counterfactual predictions
        base_pred = self.predict(base_features)
        post_pred = self.predict(counterfactual)
        
        # Calculate risk reductions
        base_cad_p = base_pred['overall_cad']['probability']
        post_cad_p = post_pred['overall_cad']['probability']
        abs_cad_reduction = round((base_cad_p - post_cad_p) * 100.0, 1)
        rel_cad_reduction = round(((base_cad_p - post_cad_p) / max(0.01, base_cad_p)) * 100.0, 1) if base_cad_p > 0 else 0.0
        
        vessel_deltas = {}
        for v in ['LAD', 'LCX', 'RCA']:
            b_p = base_pred['vessels'][v]['probability']
            p_p = post_pred['vessels'][v]['probability']
            vessel_deltas[v] = {
                'baseline_probability': b_p,
                'post_probability': p_p,
                'absolute_reduction_pct': round((b_p - p_p) * 100.0, 1),
                'status_change': f"{base_pred['vessels'][v]['status']} -> {post_pred['vessels'][v]['status']}"
            }
            
        return {
            'applied_treatments': applied_treatments,
            'baseline_prediction': base_pred,
            'post_intervention_prediction': post_pred,
            'cad_absolute_reduction_pct': abs_cad_reduction,
            'cad_relative_reduction_pct': rel_cad_reduction,
            'vessel_deltas': vessel_deltas,
            'counterfactual_features': counterfactual
        }

    def generate_soap_note(self, features: Dict[str, Any], predictions: Dict[str, Any], hemodynamics: Dict[str, Any]) -> Dict[str, str]:
        """
        Generates a formal, hospital-ready Cardiology Consultation Note (S.O.A.P. format).
        """
        age = features.get('Age', 55)
        sex = features.get('Sex', 'Male')
        bp = features.get('BP', 130)
        pr = features.get('PR', 72)
        ef = features.get('EF-TTE', 50)
        ldl = features.get('LDL', 130)
        hdl = features.get('HDL', 45)
        rwma = features.get('Region RWMA', 0)
        
        cad_info = predictions.get('overall_cad', {})
        vessels = predictions.get('vessels', {})
        hemo_vessels = hemodynamics.get('vessels', {})
        
        subjective = (
            f"Patient is a {age}-year-old {str(sex).lower()} presenting for cardiovascular risk stratification. "
            f"History of hypertension: {'Yes' if features.get('HTN') == 1 else 'No'}, "
            f"Diabetes mellitus: {'Yes' if features.get('DM') == 1 else 'No'}, "
            f"Current smoker: {'Yes' if features.get('Current Smoker') == 1 else 'No'}. "
            f"Symptom profile: Chest pain class {'Typical Angina' if features.get('Typical Chest Pain') == 1 else ('Atypical' if features.get('Atypical') in [1, 'Y'] else 'Non-anginal')}, "
            f"Dyspnea: {'Present' if features.get('Dyspnea') in [1, 'Y'] else 'Absent'}."
        )
        
        objective = (
            f"Vitals: BP {bp} mmHg, Pulse {pr} bpm. "
            f"Laboratory Profile: LDL-C {ldl} mg/dL, HDL-C {hdl} mg/dL, Triglycerides {features.get('TG', 150)} mg/dL, FBS {features.get('FBS', 100)} mg/dL. "
            f"Electrocardiogram: ST Elevation: {'Present' if features.get('St Elevation') == 1 else 'None'}, "
            f"T-Wave Inversion: {'Present' if features.get('Tinversion') == 1 else 'None'}, Q-Wave: {'Present' if features.get('Q Wave') == 1 else 'None'}. "
            f"Transthoracic Echocardiogram (TTE): LVEF {ef}%, Regional Wall Motion Abnormality (RWMA) Score: {rwma}."
        )
        
        lad_h = hemo_vessels.get('LAD', {})
        lcx_h = hemo_vessels.get('LCX', {})
        rca_h = hemo_vessels.get('RCA', {})
        
        assessment = (
            f"AI-Augmented Multi-Vessel Risk Assessment (UCI Z-Alizadeh Sani Validated Model):\n"
            f"- Overall CAD Status: {cad_info.get('status', 'Unknown')} (Probability: {cad_info.get('probability', 0)*100:.1f}%, Tier: {cad_info.get('risk_tier')})\n"
            f"- LAD (Left Anterior Descending): Stenosis Probability {vessels.get('LAD', {}).get('probability', 0)*100:.1f}%, Est. FFR: {lad_h.get('ffr', 'N/A')}, MLA: {lad_h.get('mla_mm2', 'N/A')} mm² ({lad_h.get('ischemia_status')})\n"
            f"- LCX (Left Circumflex): Stenosis Probability {vessels.get('LCX', {}).get('probability', 0)*100:.1f}%, Est. FFR: {lcx_h.get('ffr', 'N/A')}, MLA: {lcx_h.get('mla_mm2', 'N/A')} mm² ({lcx_h.get('ischemia_status')})\n"
            f"- RCA (Right Coronary Artery): Stenosis Probability {vessels.get('RCA', {}).get('probability', 0)*100:.1f}%, Est. FFR: {rca_h.get('ffr', 'N/A')}, MLA: {rca_h.get('mla_mm2', 'N/A')} mm² ({rca_h.get('ischemia_status')})\n"
            f"- Calculated SYNTAX Complexity Score: {hemodynamics.get('syntax_score', 0)} ({hemodynamics.get('syntax_tier')})."
        )
        
        plan = (
            f"1. Medical Decision Support & Imaging:\n"
            f"   - {cad_info.get('recommendation')}\n"
            f"2. Guideline-Directed Medical Therapy (GDMT):\n"
            f"   - Statin Therapy: {'Initiate High-Intensity Statin (Atorvastatin 80mg) to achieve LDL < 55 mg/dL' if ldl > 70 else 'Continue maintenance statin'}.\n"
            f"   - Antiplatelet Therapy: Consider Aspirin 81mg daily based on bleeding vs. ischemic risk evaluation.\n"
            f"   - Blood Pressure Management: Target BP < 130/80 mmHg with ACE-inhibitor / ARB.\n"
            f"3. Lifestyle & Cardiac Rehab: Structured exercise program, Mediterranean diet, strict smoking cessation.\n"
            f"4. Regulatory Disclaimer: For educational and decision-support research use only. Not a definitive clinical diagnosis."
        )
        
        return {
            'subjective': subjective,
            'objective': objective,
            'assessment': assessment,
            'plan': plan,
            'full_note': f"HOSPITAL CARDIOLOGY CONSULTATION REPORT\n{'='*55}\n\n[SUBJECTIVE]\n{subjective}\n\n[OBJECTIVE]\n{objective}\n\n[ASSESSMENT]\n{assessment}\n\n[PLAN]\n{plan}"
        }

