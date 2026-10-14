from pathlib import Path
import json
import pandas as pd
R=Path(__file__).resolve().parents[1]
df=pd.read_csv(R/'data/source.csv'); spec=json.loads((R/'artifacts/features.json').read_text())
feature_groups={f:g for g,fs in spec['groups'].items() for f in fs}
labels={"Age":"Age","Weight":"Weight","Length":"Height / length","Sex":"Sex","BMI":"Body mass index","BP":"Blood pressure (source field BP)","PR":"Pulse rate (source field PR)","CR":"Creatinine","TG":"Triglycerides","LDL":"LDL cholesterol","HDL":"HDL cholesterol","BUN":"Blood urea nitrogen","HB":"Hemoglobin","K":"Potassium","Na":"Sodium","WBC":"White blood cell count","PLT":"Platelet count","EF-TTE":"Ejection fraction (TTE)","Region RWMA":"Regional wall-motion abnormality code","VHD":"Valvular heart disease finding","Function Class":"Functional class","FBS":"Fasting blood sugar","ESR":"Erythrocyte sedimentation rate","DM":"Diabetes mellitus (DM)","HTN":"Hypertension (HTN)","FH":"Family history (FH)","CRF":"Chronic renal failure (CRF)","CVA":"Cerebrovascular accident (CVA)","CHF":"Congestive heart failure (CHF)","DLP":"Dyslipidemia (DLP)","EX-Smoker":"Former smoker (EX-Smoker)","LVH":"Left ventricular hypertrophy (LVH)","BBB":"Bundle branch block (BBB)","Tinversion":"T-wave inversion (Tinversion)","Neut":"Neutrophils (Neut)","Lymph":"Lymphocytes (Lymph)"}
fields=[]
for c in spec['features']:
 s=df[c].dropna(); vals=s.unique().tolist()
 numeric=pd.api.types.is_numeric_dtype(s)
 field={"name":c,"label":labels.get(c,c),"group":feature_groups.get(c,"Clinical inputs"),"type":"number" if numeric else "select","required":False}
 if numeric:
  field.update({"min":float(s.min()),"max":float(s.max()),"median":float(s.median()),"step":1 if pd.api.types.is_integer_dtype(s) else "any","observed_values":sorted(map(float,vals)) if len(vals)<=8 else None,"unit":"As recorded in the source; UCI does not specify units for this field."})
  # Mark binary/low-cardinality coded values as a choice while retaining the numeric API type.
  if len(vals)<=8 and len(vals)>1 and set(vals).issubset({0,1,2,3,4,5}):
   field['type']='coded_select';field['options']=[{"value":str(v),"label":str(v)} for v in sorted(vals)]
 else:
  field["options"]=[{"value":str(v),"label":"Female (source: Fmale)" if c=="Sex" and str(v)=="Female" else str(v)} for v in sorted(map(str,vals))]
 fields.append(field)
(R/'artifacts/ui_schema.json').write_text(json.dumps({"fields":fields,"targets":["CAD","LAD","LCX","RCA"],"missing_policy":"Blank values are accepted and imputed by training-fitted pipeline medians or modes."},indent=2))
print(f'Wrote schema for {len(fields)} predictors')
