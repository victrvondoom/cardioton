from pathlib import Path
import json, math
import numpy as np
import pandas as pd
import joblib
import shap
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

ROOT=Path(__file__).resolve().parents[1]
ARTIFACT_ERROR=None
try:
    SCHEMA=json.loads((ROOT/'artifacts/ui_schema.json').read_text())
    EVAL=json.loads((ROOT/'artifacts/evaluation.json').read_text())
    BUNDLE=joblib.load(ROOT/'artifacts/cardia_models.joblib')
    RAW=pd.read_csv(ROOT/'data/source.csv')
    FEATURES=[f['name'] for f in SCHEMA['fields']]
    FIELD={f['name']:f for f in SCHEMA['fields']}
    MODELS=BUNDLE['models']
    BACKGROUND=RAW[FEATURES].sample(min(24,len(RAW)),random_state=531).copy()
except (OSError,ValueError,KeyError,AttributeError) as exc:
    ARTIFACT_ERROR=f'{type(exc).__name__}: required model or schema artifact is unavailable or invalid.'
    SCHEMA={'fields':[],'targets':['CAD','LAD','LCX','RCA']};EVAL={'targets':{}};BUNDLE={'models':{},'model_names':{}}
    RAW=pd.DataFrame();FEATURES=[];FIELD={};MODELS={};BACKGROUND=pd.DataFrame()

app=FastAPI(title='Cardia Atlas API',version='1.0.0',description='Local educational CAD and vessel stenosis decision-support prototype.')

@app.middleware('http')
async def revalidate_frontend_assets(request, call_next):
    response=await call_next(request)
    path=request.url.path
    if path=='/' or path.endswith(('.js','.mjs','.css')):
        response.headers['Cache-Control']='no-cache'
    return response

class PredictRequest(BaseModel):
    values: dict[str, object]
    # Kept true by default for API compatibility. The browser opts out so it can
    # paint the four predictions immediately and request one explanation only
    # when the user opens it.
    include_explanations: bool = True



def normalize_frame(rows):
    if isinstance(rows,pd.DataFrame): frame=rows.copy()
    else: frame=pd.DataFrame(rows,columns=FEATURES)
    frame=frame.reindex(columns=FEATURES)
    for f in SCHEMA['fields']:
        c=f['name']
        if f['type'] in ('number','coded_select'):
            frame[c]=pd.to_numeric(frame[c],errors='coerce')
        else:
            frame[c]=frame[c].astype('object').replace({None:np.nan})
    if 'Sex' in frame:
        frame['Sex']=frame['Sex'].replace({'Fmale':'Female'})
    return frame


def validate_values(values):
    extras=set(values)-set(FEATURES)
    if extras:
        raise HTTPException(422,detail=f'Unknown predictor field(s): {", ".join(sorted(extras))}')
    normalized={}
    for name in FEATURES:
        f=FIELD[name]; value=values.get(name)
        if value is None or (isinstance(value,str) and not value.strip()):
            normalized[name]=np.nan; continue
        if f['type'] in ('number','coded_select'):
            try: num=float(value)
            except (TypeError,ValueError): raise HTTPException(422,detail=f'{name} must be numeric or blank.')
            if not math.isfinite(num): raise HTTPException(422,detail=f'{name} must be finite or blank.')
            if num < f['min'] or num > f['max']:
                raise HTTPException(422,detail=f'{name} must be within the observed UCI range {f["min"]} to {f["max"]}; unsupported extrapolation is blocked.')
            if f['type']=='coded_select' and num not in [float(x['value']) for x in f['options']]:
                raise HTTPException(422,detail=f'{name} must be one of the source-coded values.')
            normalized[name]=num
        else:
            allowed=[x['value'] for x in f['options']]
            if str(value) not in allowed:
                raise HTTPException(422,detail=f'{name} must be one of: {", ".join(allowed)}.')
            normalized[name]='Female' if name=='Sex' and str(value)=='Fmale' else str(value)
    return normalize_frame([normalized])


def shap_for(model, row):
    # Explain the deployed estimator after its fitted preprocessing, then aggregate
    # one-hot contributions back to source feature names.
    prep=model.named_steps['prep']; estimator=model.named_steps['model']
    background=normalize_frame(BACKGROUND)
    encoded_bg=prep.transform(background); encoded_x=prep.transform(row)
    if hasattr(encoded_bg,'toarray'): encoded_bg=encoded_bg.toarray()
    if hasattr(encoded_x,'toarray'): encoded_x=encoded_x.toarray()
    encoded_names=list(prep.get_feature_names_out())
    source_names=[]
    for encoded in encoded_names:
        stripped=encoded.split('__',1)[-1]
        matches=[f for f in FEATURES if stripped==f or stripped.startswith(f+'_')]
        source_names.append(max(matches,key=len) if matches else stripped)
    def predict_encoded(arr): return estimator.predict_proba(np.asarray(arr,dtype=float))[:,1]
    explainer=shap.PermutationExplainer(predict_encoded,encoded_bg,feature_names=encoded_names,seed=314159)
    explanation=explainer(encoded_x,max_evals=2*len(encoded_names)*6+1)
    encoded_vals=np.asarray(explanation.values).reshape(-1)
    vals_by_feature={f:0.0 for f in FEATURES}
    for name,value in zip(source_names,encoded_vals): vals_by_feature[name]+=float(value)
    vals=np.asarray([vals_by_feature[f] for f in FEATURES])
    baseline=float(np.asarray(explanation.base_values).reshape(-1)[0])
    pred=float(model.predict_proba(row)[:,1][0])
    additivity_error=abs(baseline+float(vals.sum())-pred)
    ranking=np.argsort(np.abs(vals))[::-1][:10]
    return {"output_scale":"positive-class predicted probability","baseline_probability":baseline,
      "prediction_probability":pred,"additivity_error":additivity_error,
      "contributions":[{"feature":FEATURES[i],"value":float(vals[i]),"input":None if pd.isna(row.iloc[0][FEATURES[i]]) else (float(row.iloc[0][FEATURES[i]]) if FIELD[FEATURES[i]]['type'] in ('number','coded_select') else str(row.iloc[0][FEATURES[i]]))} for i in ranking]}

@app.get('/api/health')
def health():
    if ARTIFACT_ERROR: raise HTTPException(503,detail=ARTIFACT_ERROR)
    missing=[t for t in ('CAD','LAD','LCX','RCA') if t not in MODELS]
    if missing: raise HTTPException(503,detail=f'Missing model(s): {missing}')
    return {"status":"ok","models":list(MODELS.keys()),"predictor_count":len(FEATURES)}

@app.get('/api/schema')
def schema():
    if ARTIFACT_ERROR: raise HTTPException(503,detail=ARTIFACT_ERROR)
    return SCHEMA

@app.get('/api/performance')
def performance():
    if ARTIFACT_ERROR: raise HTTPException(503,detail=ARTIFACT_ERROR)
    return EVAL

@app.get('/api/example')
def example():
    if ARTIFACT_ERROR: raise HTTPException(503,detail=ARTIFACT_ERROR)
    # Synthetic feature-wise medians for continuous numeric inputs and modes for
    # categorical or source-coded inputs. Never a real study-patient record.
    vals={}
    for f in SCHEMA['fields']:
        c=f['name']
        if f['type']=='number': vals[c]=float(f['median'])
        else:
            v=RAW[c].mode(dropna=True).iloc[0]
            vals[c]=float(v) if f['type']=='coded_select' else str(v)
    return {"label":"Synthetic demo values (continuous fields at feature-wise medians; categorical and source-coded fields at modes; not a study patient)","values":vals}

@app.post('/api/predict')
def predict(request:PredictRequest):
    if ARTIFACT_ERROR: raise HTTPException(503,detail=ARTIFACT_ERROR)
    row=validate_values(request.values)
    result={"predictions":{},"explanations":{},"caveats":["Educational decision-support prototype; not a diagnosis.","Predicted probabilities are not measured stenosis percentages or lesion locations.","Associations do not establish causation."]}
    for target,model in MODELS.items():
        p=float(model.predict_proba(row)[:,1][0])
        result['predictions'][target]={"probability":p,"threshold":0.5,"predicted_class":"positive" if p>=0.5 else "negative","model":BUNDLE['model_names'][target]}
        if request.include_explanations:
            result['explanations'][target]=shap_for(model,row)
    return result


@app.post('/api/explain/{target}')
def explain(target:str, request:PredictRequest):
    """Return one on-demand explanation for the exact deployed prediction path."""
    if ARTIFACT_ERROR: raise HTTPException(503,detail=ARTIFACT_ERROR)
    if target not in MODELS:
        raise HTTPException(404,detail=f'Unknown outcome: {target}')
    row=validate_values(request.values)
    return shap_for(MODELS[target],row)

app.mount('/',StaticFiles(directory=ROOT/'app/static',html=True),name='static')
