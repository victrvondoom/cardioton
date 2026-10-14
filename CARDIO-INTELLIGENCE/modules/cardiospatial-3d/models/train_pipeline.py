import os
import json
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple, List

from sklearn.model_selection import StratifiedKFold
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score, confusion_matrix,
    roc_curve, precision_recall_curve, brier_score_loss
)
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier
from sklearn.linear_model import LogisticRegression
import xgboost as xgb
import shap

import sys
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from data.dataset_builder import get_feature_and_target_columns, PROCESSED_DATA_PATH

MODELS_DIR = os.path.dirname(__file__)

def train_and_evaluate_all():
    print("==========================================================", flush=True)
    print("   CARDIOVASCULAR MULTI-TARGET PREDICTION PIPELINE        ", flush=True)
    print("==========================================================", flush=True)
    
    # 1. Load Clean Dataset
    df = pd.read_csv(PROCESSED_DATA_PATH)
    feature_cols, target_cols = get_feature_and_target_columns()
    
    X = df[feature_cols].copy()
    print(f"Features: {len(feature_cols)} (Leakage variables excluded)", flush=True)
    print(f"Targets: {target_cols}", flush=True)
    print(f"Total Cohort Size: {len(X)} patients\n", flush=True)
    
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    results = {}
    best_models = {}
    
    for target in target_cols:
        y = df[target].values
        print(f"\n----------------------------------------------------------", flush=True)
        print(f" Training Models for Target: {target} (Positive: {y.sum()}/{len(y)} - {y.mean()*100:.1f}%)", flush=True)
        print(f"----------------------------------------------------------", flush=True)
        
        pos_weight = float((len(y) - y.sum()) / max(y.sum(), 1))
        
        xgb_clf = xgb.XGBClassifier(
            n_estimators=100,
            max_depth=3,
            learning_rate=0.06,
            subsample=0.85,
            colsample_bytree=0.85,
            scale_pos_weight=pos_weight,
            random_state=42,
            eval_metric='logloss'
        )
        
        rf_clf = RandomForestClassifier(
            n_estimators=120,
            max_depth=5,
            min_samples_split=4,
            class_weight='balanced',
            random_state=42
        )
        
        gb_clf = GradientBoostingClassifier(
            n_estimators=90,
            max_depth=3,
            learning_rate=0.05,
            subsample=0.85,
            random_state=42
        )
        
        lr_clf = LogisticRegression(
            C=0.5,
            penalty='l2',
            class_weight='balanced',
            max_iter=1000,
            random_state=42
        )
        
        candidate_models = {
            'XGBoost': xgb_clf,
            'RandomForest': rf_clf,
            'GradientBoosting': gb_clf,
            'LogisticRegression': lr_clf
        }
        
        target_results = {}
        best_f1 = -1.0
        best_name = None
        
        for name, model in candidate_models.items():
            y_pred_cv = np.zeros(len(y))
            y_proba_cv = np.zeros(len(y))
            
            for train_idx, val_idx in cv.split(X_scaled, y):
                X_tr, X_val = X_scaled[train_idx], X_scaled[val_idx]
                y_tr, y_val = y[train_idx], y[val_idx]
                
                model.fit(X_tr, y_tr)
                y_pred_cv[val_idx] = model.predict(X_val)
                y_proba_cv[val_idx] = model.predict_proba(X_val)[:, 1]
                
            acc = accuracy_score(y, y_pred_cv)
            prec = precision_score(y, y_pred_cv, zero_division=0)
            rec = recall_score(y, y_pred_cv, zero_division=0)
            f1 = f1_score(y, y_pred_cv, zero_division=0)
            auc = roc_auc_score(y, y_proba_cv)
            pr_auc = average_precision_score(y, y_proba_cv)
            brier = brier_score_loss(y, y_proba_cv)
            cm = confusion_matrix(y, y_pred_cv).tolist()
            
            fpr, tpr, _ = roc_curve(y, y_proba_cv)
            precision_curve, recall_curve_pts, _ = precision_recall_curve(y, y_proba_cv)
            
            target_results[name] = {
                'accuracy': float(acc),
                'precision': float(prec),
                'recall': float(rec),
                'f1_score': float(f1),
                'roc_auc': float(auc),
                'pr_auc': float(pr_auc),
                'brier_score': float(brier),
                'confusion_matrix': cm,
                'roc_curve': {'fpr': fpr.tolist(), 'tpr': tpr.tolist()},
                'pr_curve': {'precision': precision_curve.tolist(), 'recall': recall_curve_pts.tolist()}
            }
            
            print(f"  [{name:18s}] Acc: {acc*100:.2f}% | Prec: {prec*100:.2f}% | Rec: {rec*100:.2f}% | F1: {f1:.4f} | ROC-AUC: {auc:.4f}", flush=True)
            
            composite_score = f1 * 0.5 + auc * 0.5
            if composite_score > best_f1:
                best_f1 = composite_score
                best_name = name
                
        print(f"  >>> Selected Best Model for {target}: {best_name} (Composite Score: {best_f1:.4f})", flush=True)
        
        # Fit final best model on full dataset
        final_best_model = candidate_models[best_name]
        final_best_model.fit(X_scaled, y)
        best_models[target] = {
            'model_name': best_name,
            'model': final_best_model
        }
        
        # Calculate global feature importance
        if hasattr(final_best_model, 'feature_importances_'):
            feat_imp = final_best_model.feature_importances_
        else:
            feat_imp = np.abs(final_best_model.coef_[0])
            
        top_indices = np.argsort(feat_imp)[::-1][:15]
        target_results['global_feature_importance'] = [
            {'feature': feature_cols[i], 'importance': float(feat_imp[i])}
            for i in top_indices
        ]
        target_results['best_model'] = best_name
        
        results[target] = target_results

    # 4. Save Artifacts
    pipeline_payload = {
        'scaler': scaler,
        'feature_cols': feature_cols,
        'target_cols': target_cols,
        'best_models': best_models,
        'metrics': results
    }
    
    model_save_path = os.path.join(MODELS_DIR, "cardio_models.joblib")
    joblib.dump(pipeline_payload, model_save_path)
    print(f"\nModel pipeline saved to {model_save_path}", flush=True)
    
    json_metrics = {}
    for target, target_data in results.items():
        json_metrics[target] = {}
        for m_name, m_data in target_data.items():
            if m_name in ['global_feature_importance', 'best_model']:
                json_metrics[target][m_name] = m_data
            else:
                json_metrics[target][m_name] = {
                    k: v for k, v in m_data.items()
                }
                
    metrics_json_path = os.path.join(MODELS_DIR, "cardiospatial_3d__models__validation_metrics.json")
    with open(metrics_json_path, "w") as f:
        json.dump(json_metrics, f, indent=2)
    print(f"Validation metrics exported to {metrics_json_path}", flush=True)
    
    feature_meta = {}
    for col in feature_cols:
        col_data = df[col]
        feature_meta[col] = {
            'min': float(col_data.min()),
            'max': float(col_data.max()),
            'mean': float(col_data.mean()),
            'median': float(col_data.median()),
            'std': float(col_data.std()),
            'type': 'binary' if set(col_data.unique()).issubset({0, 1}) else ('multiclass' if len(col_data.unique()) <= 5 else 'continuous')
        }
        
    meta_path = os.path.join(MODELS_DIR, "cardiospatial_3d__models__feature_metadata.json")
    with open(meta_path, "w") as f:
        json.dump(feature_meta, f, indent=2)
    print(f"Feature metadata exported to {meta_path}", flush=True)

    print("\n==========================================================", flush=True)
    print("   MODEL TRAINING & CROSS-VALIDATION COMPLETED            ", flush=True)
    print("==========================================================", flush=True)

if __name__ == "__main__":
    train_and_evaluate_all()
