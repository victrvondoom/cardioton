"""Editable six-page Track A report. Rendering only; no inference/training imports.

Run with a document environment containing reportlab and Pillow:
    python docs/submission/report_source.py
Numbers come from CLAIMS.json, copied from saved aggregate V1 evidence.
"""
from pathlib import Path
import hashlib
import json
from xml.sax.saxutils import escape
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parents[2]
DIR = ROOT / 'docs/submission'
CLAIMS = json.loads((DIR / 'CLAIMS.json').read_text())
SOURCE = ROOT / CLAIMS['v1']['source']
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == CLAIMS['v1']['source_sha256']
# Validate real capture provenance and exact integer crops; never alter screenshot content.
PROVENANCE = json.loads((DIR / 'SCREENSHOT_PROVENANCE.json').read_text())
for record in PROVENANCE['screenshots']:
    assert hashlib.sha256((ROOT / record['path']).read_bytes()).hexdigest() == record['sha256']
for record in PROVENANCE.get('derived_crops', []):
    source = ROOT / record['source_path']
    output = ROOT / record['path']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == record['source_sha256']
    assert hashlib.sha256(output.read_bytes()).hexdigest() == record['sha256']
    with Image.open(source) as original, Image.open(output) as crop:
        expected = original.crop(record['crop_box_ltrb'])
        assert crop.size == expected.size and crop.mode == expected.mode
        assert crop.tobytes() == expected.tobytes()
OUT = ROOT / 'output/pdf/CardioScope-Track-A-Report.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
W, H = A4
M = 36
CW = W - 2 * M
INK = colors.HexColor('#102C39')
TEAL = colors.HexColor('#007F83')
MUTED = colors.HexColor('#526570')
LIGHT = colors.HexColor('#EDF5F5')
AMBER = colors.HexColor('#996000')
C = canvas.Canvas(str(OUT), pagesize=A4, invariant=1)
C.setTitle('CardioScope | Track A final report')
C.setAuthor('CardioScope team')
C.setSubject('Frozen V1, once-only same-source holdout; research and educational prototype')
C.setCreator('CardioScope editable report source')


def para(text, y, x=M, width=CW, size=10, color=INK, max_height=None):
    p = Paragraph(text, ParagraphStyle('body', fontName='Helvetica', fontSize=size,
                  leading=size*1.42, textColor=color, spaceAfter=0))
    _, height = p.wrap(width, H)
    if max_height is not None:
        assert height <= max_height, (text[:60], height, max_height)
    assert y - height >= 50, (text[:60], y, height)
    p.drawOn(C, x, y-height)
    return y-height


def title(page, eyebrow, headline, subtitle):
    C.setFillColor(TEAL)
    C.rect(0, H-11, W, 11, fill=1, stroke=0)
    C.setFont('Helvetica-Bold', 9)
    C.drawString(M, H-38, 'CARDIOSCOPE  /  TRACK A')
    C.setFillColor(MUTED)
    C.setFont('Helvetica', 8)
    C.drawRightString(W-M, H-38, eyebrow.upper())
    C.setFillColor(INK)
    C.setFont('Helvetica-Bold', 25)
    C.drawString(M, H-77, headline)
    para(subtitle, H-95, size=10.3, max_height=44)
    C.setStrokeColor(colors.HexColor('#D5E3E7'))
    C.line(M, 43, W-M, 43)
    C.setFont('Helvetica', 7.5)
    C.setFillColor(MUTED)
    C.drawString(M, 28, 'Frozen V1  |  Research / educational prototype  |  4 October 2026')
    C.drawRightString(W-M, 28, f'{page} / 6')


def heading(text, y):
    C.setFillColor(TEAL)
    C.setFont('Helvetica-Bold', 12)
    C.drawString(M, y-12, text)
    return y-24


def image(name, y, height=None):
    reader = ImageReader(str(DIR / 'assets' / name))
    iw, ih = reader.getSize()
    height = height or CW*ih/iw
    width = height*iw/ih
    assert width <= CW+0.01
    x = M+(CW-width)/2
    C.setStrokeColor(colors.HexColor('#D5E3E7'))
    C.roundRect(x-1, y-height-1, width+2, height+2, 3, fill=0, stroke=1)
    C.drawImage(reader, x, y-height, width, height, mask='auto')
    return y-height


def callout(text, y, height=60, warning=False):
    assert y-height >= 52, ('callout bottom', y-height)
    C.setFillColor(colors.HexColor('#FFF4E1') if warning else LIGHT)
    C.roundRect(M, y-height, CW, height, 7, fill=1, stroke=0)
    para(text, y-11, x=M+12, width=CW-24, size=10,
         color=AMBER if warning else INK, max_height=height-20)
    return y-height


def flow(labels, y, width=CW, x=M):
    gap=12
    bw=(width-gap*(len(labels)-1))/len(labels)
    for i, label in enumerate(labels):
        bx=x+i*(bw+gap)
        C.setFillColor(LIGHT)
        C.roundRect(bx, y-43, bw, 43, 5, fill=1, stroke=0)
        para(label, y-8, x=bx+7, width=bw-14, size=8.2, max_height=29)
        if i < len(labels)-1:
            C.setStrokeColor(TEAL)
            C.line(bx+bw+2, y-21, bx+bw+gap-2, y-21)
            C.line(bx+bw+gap-2, y-21, bx+bw+gap-5, y-18)
            C.line(bx+bw+gap-2, y-21, bx+bw+gap-5, y-24)
    return y-43


# PAGE 1: solution
title(1, 'Problem + solution', 'Prediction with anatomical context',
      'CardioScope connects a structured clinical profile to four frozen classifiers, real interactive coronary anatomy, model explanations and transparent evidence.')
y=H-152
y=para('Clinical models can produce numbers that are difficult to interpret spatially. CardioScope makes the relationship between a vessel output and reference anatomy visible, while keeping the evidence and limitations beside the prediction.', y, size=11)
y=flow(['<b>55-feature</b><br/>profile', '<b>Four frozen</b><br/>predictions', '<b>Reference 3D</b><br/>heart / vessels', '<b>SHAP +</b><br/>evidence'], y-18)
y=image('product-hero.png', y-20, height=285)
y=para('<b>Real V1 interface.</b> The public development example is loaded; LAD is selected. Vessel colors reflect model-estimated probabilities. The anatomy is a reference model, not this person\'s heart.', y-10, size=8.8, color=MUTED)
y=heading('Four outputs, one inspectable workflow', y-20)
y=para('<b>CAD</b> describes the overall dataset CAD target. <b>LAD, LCX and RCA</b> describe the three source vessel targets. These are separate classifier outputs, not a joint probability distribution. A judge can move from numerical outputs to the corresponding vessel, then inspect the explanation and saved evaluation.', y)
callout('<b>Educational / research decision-support prototype.</b> Not a diagnostic replacement, treatment recommendation or clinically validated risk estimate.', y-16, height=54)
C.showPage()

# PAGE 2: method
title(2, 'Data + methodology', 'A frozen, auditable evaluation',
      'A shared prespecified split separates development decisions from the once-only final test. Preprocessing and selection stay inside development folds.')
y=H-158
for i,(big,small) in enumerate([('303','source records'),('55','allowed predictors'),('242','development'),('61','final holdout')]):
    x=M+i*(CW/4)
    C.setFillColor(LIGHT); C.roundRect(x, y-72, CW/4-8,72,5,fill=1,stroke=0)
    C.setFillColor(TEAL); C.setFont('Helvetica-Bold',26); C.drawString(x+12,y-33,big)
    para(small,y-43,x=x+12,width=CW/4-23,size=8.5)
y-=92
y=heading('UCI Extension of Z-Alizadeh Sani',y)
y=para('The published table has 59 columns: 55 predictors and four targets. <b>Cath (CAD), LAD, LCX and RCA are excluded from all model inputs.</b> CAD and Stenotic are the positive classes. Input validation preserves the existing source schema and category contract; no hidden default clinical profile or missing-value imputation is supplied.',y)
y=flow(['<b>242 only</b><br/>development', '<b>5 outer / 3 inner</b><br/>locked folds', '<b>Select + freeze</b><br/>four pipelines', '<b>61 once</b><br/>final test'],y-18)
y=heading('Leakage controls and selection', y-21)
y=para('The 242/61 development-holdout split is shared across targets; each target uses its own locked nested-CV folds. Duplicate predictor groups stay together; true patient IDs are unavailable. Scaling and categorical vocabularies fit each training fold. Outer validation reports the nested selection procedure; it does not select configurations.', y)
y=para('The final development-only selection rule uses the mean of the locked inner ROC-AUC scores, then Brier score and predeclared simplicity tie-breaks. Frozen pipelines are fitted on all 242 development records before the 61-record final evaluation. The threshold remains <b>0.5 for every target</b>; probabilities are uncalibrated.', y-11)
y=heading('V1 configurations used in the application',y-20)
configs=[('CAD + LAD','Balanced logistic regression, C = 0.1, L2; fold-fitted scaling.'),('LCX','Random forest: 100 trees, depth 3, minimum leaf 10, unweighted.'),('RCA','Random forest: 100 trees, depth 5, minimum leaf 10, unweighted.')]
for label,text in configs:
    y=para(f'<b>{label}</b>  {text}',y,size=10)-11
y=para('Forests use sqrt feature sampling and bootstrap; random state 42. Encoded categorical predictors use training-fitted one-hot encoding with unknown categories ignored. Model/schema/split/search/membership fingerprints and saved receipts connect the frozen artifacts.',y,size=8.7,color=MUTED)
callout('<b>Scope of independence:</b> the final test is a prespecified, same-source holdout. It is not an external cohort or clinical deployment validation.',y-16,height=54,warning=True)
C.showPage()

# PAGE 3: performance
title(3,'Predictive performance','The final V1 results, including limits',
      'Primary evidence: the once-only 61-record holdout, with models and threshold frozen beforehand. Every target is shown; higher AUC does not guarantee useful sensitivity.')
y=H-145
# native vector comparison, common scale
C.setFont('Helvetica-Bold',9); C.setFillColor(TEAL); C.drawString(M,y,'ROC-AUC'); C.setFillColor(AMBER); C.drawString(M+90,y,'Recall at 0.5')
y-=22
for target in ['CAD','LAD','LCX','RCA']:
    m=CLAIMS['v1']['metrics'][target]
    C.setFillColor(INK); C.setFont('Helvetica-Bold',10); C.drawString(M,y-11,target)
    bx=M+54; bw=CW-104
    for k,offset,color in [('roc_auc',0,TEAL),('recall',15,AMBER)]:
        C.setFillColor(LIGHT); C.rect(bx,y-offset-12,bw,9,fill=1,stroke=0)
        C.setFillColor(color); C.rect(bx,y-offset-12,bw*m[k],9,fill=1,stroke=0)
        C.setFont('Helvetica',9); C.drawRightString(W-M,y-offset-12,f'{m[k]:.3f}')
    y-=32
y=para('Bars use a common 0-1 scale. Recall is sensitivity for CAD / Stenotic.',y-3,size=8,color=MUTED)
y=heading('All saved point estimates', y-16)
rows=[('Accuracy','accuracy'),('Balanced accuracy','balanced_accuracy'),('Precision','precision'),('Recall / sensitivity','recall'),('F1','f1'),('ROC-AUC','roc_auc'),('PR-AUC (trapezoidal)','pr_auc'),('Average precision','average_precision'),('Brier (lower better)','brier_score')]
first=M+185; col=(CW-185)/4
C.setFillColor(INK); C.setFont('Helvetica-Bold',9)
for i,t in enumerate(['CAD','LAD','LCX','RCA']): C.drawCentredString(first+col*(i+.5),y-10,t)
y-=22
for j,(label,k) in enumerate(rows):
    if j%2==0:
        C.setFillColor(LIGHT); C.rect(M,y-20,CW,22,fill=1,stroke=0)
    C.setFillColor(INK); C.setFont('Helvetica',9); C.drawString(M+7,y-12,label)
    for i,t in enumerate(['CAD','LAD','LCX','RCA']):
        C.drawCentredString(first+col*(i+.5),y-12,f"{CLAIMS['v1']['metrics'][t][k]:.4f}")
    y-=22
y=heading('Confusion matrices',y-14)
for i,t in enumerate(['CAD','LAD','LCX','RCA']):
    a=CLAIMS['v1']['metrics'][t]['confusion_matrix']; x=M+i*CW/4
    para(f'<b>{t}</b><br/>TN {a[0][0]} &nbsp; FP {a[0][1]}<br/>FN {a[1][0]} &nbsp; TP {a[1][1]}',y,x=x+4,width=CW/4-8,size=8.5,max_height=37)
y-=39
y=para('TN/FP: true negative / false positive; FN/TP: false negative / true positive. Positive counts: CAD 43, LAD 33, LCX 24, RCA 21. PR-AUC and AP are distinct summaries, not interchangeable.',y,size=8.3,color=MUTED)
y=callout('<b>LCX and RCA are a material weakness.</b> Moderate ranking ability did not translate to strong sensitivity at 0.5: 19/24 LCX positives and 15/21 RCA positives were missed. This is not a validated screening tool.',y-14,height=58,warning=True)
para('Small-test uncertainty matters: saved 95% ROC-AUC intervals are CAD 0.819-0.978, LAD 0.745-0.929, LCX 0.537-0.802 and RCA 0.563-0.820 (stratified percentile bootstrap, no refitting). These intervals condition on empirical class counts; independence and external generalization are unverified.',y-10,size=8.4,color=MUTED)
C.showPage()

# PAGE 4: anatomy
title(4,'3D + integration','Real anatomy, clearly bounded',
      'BodyParts3D supplies verified reference geometry. A vessel card and its 3D group share one selection state; the model output remains numerical and inspectable.')
y=image('anatomy-posterior-LCX-crop.png',H-151,height=285)
y=para('<b>Real application crop:</b> posterior preset, LCX selected, heart and all vessels shown. Named controls, renderer-ready status and the LCX label remain visible. No screenshot content was altered.',y-10,size=8.8,color=MUTED)
y=heading('83 mesh leaves, one coordinate system',y-17)
y=para('<b>Heart base 30 / LAD 18 / LCX 6 / RCA 29.</b> Verified source mappings define the groups. All leaves retain one source coordinate system and one assembly center/scale transform. Coronary leaves are excluded from the heart base; no artery is individually repositioned.',y)
y=heading('Interaction connected to frozen inference',y-17)
y=para('React + TypeScript renders the Three.js / React Three Fiber viewer. FastAPI validates all 55 inputs and returns frozen-pipeline probabilities. Mesh selection updates the output card; card selection highlights the same group. Orbit, zoom, reset, anterior/posterior presets, isolation and show-all support inspection.',y)
y=para('Blue-to-red color follows whole-vessel model probability; selection is a separate highlight. Without predictions, styling is neutral. Loading, partial mesh and WebGL failures are explicit. Numerical predictions and Evidence remain available if 3D fails.',y-10)
y=callout('<b>Reference anatomy only.</b> No patient reconstruction, lesion localization, vessel-diameter estimation, stenosis geometry or exact narrowing percentage is inferred.',y-15,height=55,warning=True)
para('Source credit: BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International (current archive license). Mapping/subtraction and the shared display transform are documented adaptations; source OBJ leaves remain unchanged.',y-5,size=8.5,color=MUTED)
C.showPage()

# PAGE 5: explanation
title(5,'Explainability','Explain the model, preserve the units',
      'SHAP connects entered values to positive and negative contributions. The explanation is checked against the actual frozen output, rather than used as a clinical narrative.')
y=image('explanation-CAD-higher-crop.png',H-151)
y=image('explanation-CAD-lower-crop.png',y-10)
y=para('<b>Two crops from one real CAD explanation:</b> the public development example gives a 17.1% model output. The first two factors in each direction are enlarged here; entered values and signed log-odds contributions are unchanged. The application retains all 55 factors, their sum and reconstruction check.',y-10,size=8.8,color=MUTED)
y=heading('Two methods, two explicit contribution spaces',y-17)
for i,(head,text) in enumerate([('CAD + LAD','Linear SHAP<br/><b>Positive-class log-odds</b><br/>Baseline + contributions reconstruct the decision score; sigmoid returns probability.'),('LCX + RCA','TreeSHAP<br/><b>Positive-class probability space</b><br/>Baseline + contributions reconstruct the forest probability directly.')]):
    x=M+i*(CW+12)/2; bw=(CW-12)/2
    C.setFillColor(LIGHT); C.roundRect(x,y-103,bw,103,6,fill=1,stroke=0)
    para(f'<b>{head}</b><br/>{text}',y-10,x=x+12,width=bw-24,size=9.5,max_height=84)
y-=122
y=para('A deterministic <b>100-record development-only reference/background</b> is frozen. All <b>55 source variables</b> are retained; one-hot encoded category blocks are aggregated back to their source feature. The visible top factors do not discard the remaining contribution mass.',y)
y=para('Reconstruction uses unrounded values: tolerance <b>1e-10 in log-odds</b> and <b>1e-6 in probability space</b>. The probability tree adapter preserves float32 tree routing. Explanation failure is contained: the valid prediction remains available with an explicit explanation failure state.',y-10)
callout('<b>SHAP explains model behavior.</b> Feature associations do not establish causality, clinical mechanism or a treatment recommendation. The background defines the reference, not a healthy control cohort.',y-16,height=57,warning=True)
C.showPage()

# PAGE 6: integrity
title(6,'Integrity + limitations','Reproducible, with honest boundaries',
      'The scientific V1 product remains frozen. Engineering checks and separately bounded research do not turn a small same-source evaluation into clinical validation.')
y=H-135
y=heading('Engineering evidence',y)
y=para('<b>Historical hardened V1:</b> 134 Python tests and 75 frontend tests passed on macOS and clean Ubuntu ARM64. Docker execution, deterministic scientific checks and desktop Chromium / Firefox / Safari workflows were verified. GitHub Actions is configured and equivalent Ubuntu checks passed locally; <b>hosted CI has not run</b>.',y)
y=para('<b>256 protected scientific files</b> are checksum verified. Model, schema, split, receipt, SHAP and anatomy assets remain fixed. Initial JavaScript fell from 1,216,295 to 266,391 bytes (about <b>78%</b>) through lazy loading; the viewer chunk still loads when needed. Local viewer measurements were around 59-60 FPS, not a universal hardware guarantee.',y-11)
y=heading('What we learned after final evaluation',y-14)
y=para('After weak LCX/RCA sensitivity, we preregistered separate <b>post-holdout, development-only</b> studies. Threshold/model and multi-task approaches failed their predefined <b>joint gates</b>. V1, evaluated once on the prespecified 61-record same-source holdout, remained unchanged.',y)
y=para('V2 tested thresholds, elastic-net, forests/cost sensitivity and XGBoost. V2.1 tested a small four-task network: RCA\'s mean scores were higher on paired development folds, but LCX and CAD preservation failed. No final all-development neural candidate was fitted. <b>Neither study is deployed or independently validated.</b>',y-11)
y=heading('Limits that govern interpretation',y-14)
y=para('Only 303 source records; just 61 final-test records. Same-source holdout; no independent external cohort. True patient IDs are unverified despite duplicate-group protection. Uncalibrated probabilities. Weak LCX/RCA sensitivity at the frozen threshold. Separate outputs are not a joint probability model. Reference anatomy only; no lesion localization. No clinical deployment validation.',y)
y=heading('Reproduce the product',y-14)
y=para('<font name="Courier">make install<br/>make prepare<br/>make build<br/>make run PORT=8000</font><br/>Open the printed localhost URL and load the public development example. Dependencies need network for installation; the prepared local product can run offline. The repository includes frozen pipelines, sources/provenance, deterministic locks, Docker instructions and integrity checks.',y,size=9.5)
y=heading('Sources and accompanying evidence',y-17)
y=para('Dataset: UCI Extension of Z-Alizadeh Sani, DOI <link href="https://doi.org/10.24432/C5461K" color="#007F83">10.24432/C5461K</link>, CC BY 4.0.<br/>Anatomy: <link href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html" color="#007F83">current BodyParts3D archive license</link>, CC BY 4.0.<br/>Repository: README; docs/MODELING.md, FINAL_EVALUATION.md, EXPLANATIONS.md, HARDENING.md, V2_LCX_RCA.md and V21_MULTITASK.md. Report numbers are copied from saved aggregate evidence; no evaluation or training is invoked by this source.',y,size=8.8,color=MUTED)
callout('Educational / research prototype. Inspect the saved evidence alongside every output. All upstream dataset, anatomy and dependency attribution must be retained.',y-15,height=50)
C.showPage()
C.save()
print(f'Created {OUT.relative_to(ROOT)} (6 explicit pages)')
