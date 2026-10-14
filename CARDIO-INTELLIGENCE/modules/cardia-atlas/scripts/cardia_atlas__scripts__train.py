"""Leakage-safe nested CV comparison and final four-model fit."""
from pathlib import Path
import json, warnings
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import ExtraTreesClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, average_precision_score, confusion_matrix, brier_score_loss)
from sklearn.model_selection import RepeatedStratifiedKFold, StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.base import clone
import joblib

ROOT=Path(__file__).resolve().parents[1]
SEED=271828
TARGETS={"CAD":"Cath", "LAD":"LAD", "LCX":"LCX", "RCA":"RCA"}

def make_pipeline(X, model_name):
    categorical=X.select_dtypes(include=["object", "str", "category"]).columns.tolist()
    numeric=[c for c in X.columns if c not in categorical]
    num=Pipeline([("impute",SimpleImputer(strategy="median")),("scale",StandardScaler())])
    cat=Pipeline([("impute",SimpleImputer(strategy="most_frequent")),("encode",OneHotEncoder(handle_unknown="ignore"))])
    prep=ColumnTransformer([("num",num,numeric),("cat",cat,categorical)],remainder="drop")
    if model_name=="LogisticRegression":
        clf=LogisticRegression(C=0.5,class_weight="balanced",max_iter=3000,random_state=SEED)
    elif model_name=="ExtraTrees":
        clf=ExtraTreesClassifier(n_estimators=300,min_samples_leaf=3,max_features="sqrt",class_weight="balanced",random_state=SEED,n_jobs=-1)
    elif model_name=="RandomForest":
        clf=RandomForestClassifier(n_estimators=300,min_samples_leaf=3,max_features="sqrt",class_weight="balanced",random_state=SEED,n_jobs=-1)
    else: raise ValueError(model_name)
    return Pipeline([("prep",prep),("model",clf)])

def metrics(y,p):
    pred=(p>=.5).astype(int); tn,fp,fn,tp=confusion_matrix(y,pred,labels=[0,1]).ravel()
    bins=calibration_bins(y,p)
    ece=sum(b['count']*abs(b['observed_positive_rate']-b['mean_predicted_probability']) for b in bins if b['count'])/len(y)
    return {"accuracy":accuracy_score(y,pred),"precision":precision_score(y,pred,zero_division=0),
      "recall_sensitivity":recall_score(y,pred,zero_division=0),"specificity":tn/(tn+fp) if tn+fp else 0,
      "f1":f1_score(y,pred,zero_division=0),"roc_auc":roc_auc_score(y,p) if len(np.unique(y))==2 else float("nan"),
      "pr_auc_average_precision":average_precision_score(y,p),"brier_score":brier_score_loss(y,p),
      "expected_calibration_error_5_bins":ece,
      "confusion_matrix_tn_fp_fn_tp":[int(tn),int(fp),int(fn),int(tp)]}

def calibration_bins(y,p,n_bins=5):
    y=np.asarray(y);p=np.asarray(p);edges=np.linspace(0,1,n_bins+1);out=[]
    for i in range(n_bins):
        mask=(p>=edges[i]) & ((p<edges[i+1]) if i<n_bins-1 else (p<=edges[i+1]))
        if mask.any():out.append({"lower":float(edges[i]),"upper":float(edges[i+1]),"count":int(mask.sum()),
          "mean_predicted_probability":float(p[mask].mean()),"observed_positive_rate":float(y[mask].mean())})
        else:out.append({"lower":float(edges[i]),"upper":float(edges[i+1]),"count":0,"mean_predicted_probability":None,"observed_positive_rate":None})
    return out

def main():
    data=pd.read_csv(ROOT/"data/source.csv")
    feature_spec=json.loads((ROOT/"artifacts/features.json").read_text())
    X=data[feature_spec["features"]]
    yall={k:data[v].map({"Normal":0,"Stenotic":1,"CAD":1}).astype(int).to_numpy() for k,v in TARGETS.items()}
    outer=RepeatedStratifiedKFold(n_splits=5,n_repeats=2,random_state=SEED)
    candidates=["LogisticRegression","ExtraTrees","RandomForest"]
    summary={"seed":SEED,"validation":"Nested repeated stratified 5-fold CV (2 repeats); inner 3-fold ROC-AUC selects one of three fixed pipelines; operating threshold 0.50 was fixed in advance.","n":len(X),"predictor_count":X.shape[1],"targets":{},"selection_rule":"For each outer fold, inner 3-fold mean ROC-AUC selects among three fixed pipelines; the held-out fold is used for outer evaluation. For the deployed model, 5-fold ROC-AUC over all records selects the final pipeline, then that pipeline is refit on all records. The outer-fold estimates are not the same as the performance of that final refit."}
    chosen={}
    for task,y in yall.items():
        fold_rows=[]; ys=[]; ps=[]; select_counts={c:0 for c in candidates}
        for fold,(tr,te) in enumerate(outer.split(X,y)):
            inner=StratifiedKFold(n_splits=3,shuffle=True,random_state=SEED+fold)
            scores={}
            for candidate in candidates:
                vals=[]
                for itr,iva in inner.split(X.iloc[tr],y[tr]):
                    model=make_pipeline(X,candidate)
                    model.fit(X.iloc[tr[itr]],y[tr[itr]])
                    vals.append(roc_auc_score(y[tr[iva]],model.predict_proba(X.iloc[tr[iva]])[:,1]))
                scores[candidate]=float(np.mean(vals))
            winner=max(candidates,key=lambda c:(scores[c],-candidates.index(c)))
            select_counts[winner]+=1
            fitted=make_pipeline(X,winner); fitted.fit(X.iloc[tr],y[tr]); prob=fitted.predict_proba(X.iloc[te])[:,1]
            ys.extend(y[te].tolist()); ps.extend(prob.tolist())
            row=metrics(y[te],prob); row.update({"outer_fold":fold,"selected_model":winner,"inner_cv_roc_auc":scores[winner]});fold_rows.append(row)
        oof=metrics(np.asarray(ys),np.asarray(ps))
        # fold-level spread summarizes sampling variability; not an independent external-validation interval.
        fold_summary={m:{"mean":float(np.mean([r[m] for r in fold_rows])),"sd":float(np.std([r[m] for r in fold_rows],ddof=1))} for m in ["accuracy","precision","recall_sensitivity","specificity","f1","roc_auc","pr_auc_average_precision","brier_score","expected_calibration_error_5_bins"]}
        final_cv=StratifiedKFold(n_splits=5,shuffle=True,random_state=SEED+10000)
        final_scores={}
        for candidate in candidates:
            vals=[]
            for itr,iva in final_cv.split(X,y):
                fitted=make_pipeline(X,candidate);fitted.fit(X.iloc[itr],y[itr])
                vals.append(roc_auc_score(y[iva],fitted.predict_proba(X.iloc[iva])[:,1]))
            final_scores[candidate]=float(np.mean(vals))
        winner=max(candidates,key=lambda c:(final_scores[c],-candidates.index(c)))
        chosen[task]=winner
        final=make_pipeline(X,winner); final.fit(X,y); joblib.dump(final,ROOT/f"artifacts/{task.lower()}_pipeline.joblib")
        summary["targets"][task]={"label_column":TARGETS[task],"positive_label":"CAD" if task=="CAD" else "Stenotic","selected_final_model":winner,"final_full_data_cv_roc_auc":final_scores,"outer_selection_counts":select_counts,"oof_repeated_predictions":oof,"outer_fold_mean_sd":fold_summary,"reliability_bins_5":calibration_bins(np.asarray(ys),np.asarray(ps)),"outer_folds":fold_rows,"class_counts":{"negative":int((y==0).sum()),"positive":int((y==1).sum())}}
        print(task,winner,{k:round(v,3) for k,v in oof.items() if isinstance(v,float)})
    joblib.dump({"models":{t:joblib.load(ROOT/f"artifacts/{t.lower()}_pipeline.joblib") for t in chosen},"features":list(X.columns),"targets":TARGETS,"model_names":chosen,"threshold":0.5},ROOT/"artifacts/cardia_models.joblib")
    summary["models"]=chosen
    (ROOT/"artifacts/evaluation.json").write_text(json.dumps(summary,indent=2))
    (ROOT/"artifacts/evaluation.csv").write_text(pd.DataFrame([{ "target":t,**v["oof_repeated_predictions"],"model":v["selected_final_model"]} for t,v in summary["targets"].items()]).to_csv(index=False))
    print('Saved final models and nested CV evaluation')
if __name__=="__main__": main()
