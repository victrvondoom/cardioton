"""Generate free-text referral notes from the 61 held-out patients' real records for evaluating intake.

The notes are synthetic (template-based with randomised phrasing, omissions, negations and distractor
numbers such as drug doses, dates and follow-up intervals); the ground truth is the patient's record.

    python scripts/make_eval_notes.py 7    # development notes (used while designing the questions)
    python scripts/make_eval_notes.py 11   # fresh test notes (only used for the final number)
"""

import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
import sys

SEED = int(sys.argv[1]) if len(sys.argv) > 1 else 11
rng = random.Random(SEED)

NUM_PHRASES = {
    "BP": ["BP {v}/{d} mmHg", "blood pressure {v}/{d}", "BP was {v}/{d}"],
    "PR": ["pulse {v} bpm", "HR {v}/min", "heart rate of {v}"],
    "FBS": ["FBS {v} mg/dL", "fasting glucose {v}", "fasting sugar {v} mg/dl"],
    "CR": ["creatinine {v} mg/dL", "Cr {v}", "serum creatinine {v}"],
    "TG": ["TG {v}", "triglycerides {v} mg/dL"],
    "LDL": ["LDL {v}", "LDL-C {v} mg/dL"],
    "HDL": ["HDL {v}", "HDL-C {v} mg/dL"],
    "BUN": ["BUN {v}", "urea nitrogen {v} mg/dL"],
    "ESR": ["ESR {v} mm/h", "ESR {v}"],
    "HB": ["Hb {v} g/dL", "haemoglobin {v}"],
    "K": ["K {v}", "potassium {v} mEq/L"],
    "Na": ["Na {v}", "sodium {v} mEq/L"],
    "WBC": ["WBC {v}/uL", "WBC {k} x10^3/uL", "total leucocyte count {v}"],
    "Lymph": ["lymphocytes {v}%", "lymph {v}%"],
    "Neut": ["neutrophils {v}%", "neut {v}%"],
    "PLT": ["platelets {v}k", "PLT {big}/uL", "platelet count {v} x10^3/uL"],
    "EF-TTE": ["EF {v}%", "LVEF {v} percent", "ejection fraction of {v}%"],
}
POS = {
    "DM": ["type 2 diabetic", "known diabetes mellitus", "on metformin for diabetes"],
    "HTN": ["hypertensive", "known case of hypertension"],
    "Current Smoker": ["current smoker (10 cigarettes/day)", "smokes daily"],
    "EX-Smoker": ["ex-smoker, quit in 2015", "former smoker"],
    "FH": ["father had an MI at 52", "family history of premature CAD"],
    "Obesity": ["obese"],
    "CRF": ["chronic kidney disease"],
    "CVA": ["prior stroke in 2019"],
    "Airway disease": ["asthmatic", "COPD on inhalers"],
    "Thyroid Disease": ["hypothyroid on levothyroxine 50 mcg"],
    "CHF": ["history of congestive heart failure"],
    "DLP": ["dyslipidaemic", "known dyslipidemia on atorvastatin 40 mg"],
    "Edema": ["bilateral pedal oedema"],
    "Weak Peripheral Pulse": ["weak peripheral pulses"],
    "Lung rales": ["basal crackles"],
    "Systolic Murmur": ["a systolic murmur at the apex"],
    "Diastolic Murmur": ["an early diastolic murmur"],
    "Typical Chest Pain": ["typical exertional angina relieved by rest", "classic anginal chest pain on exertion"],
    "Dyspnea": ["shortness of breath on exertion", "dyspnoea"],
    "Atypical": ["atypical chest pain"],
    "Nonanginal": ["non-anginal chest discomfort"],
    "LowTH Ang": ["angina at minimal exertion (low threshold)"],
    "Q Wave": ["Q waves in II, III, aVF"],
    "St Elevation": ["ST elevation in V1-V3"],
    "St Depression": ["ST depression in V4-V6", "horizontal ST depression laterally"],
    "Tinversion": ["T inversion in the lateral leads", "inverted T waves"],
    "LVH": ["LVH by voltage criteria"],
    "Poor R Progression": ["poor R wave progression"],
}
NEG = {
    "Current Smoker": "non-smoker", "DM": "not diabetic", "HTN": "normotensive", "Q Wave": "no Q waves",
    "St Elevation": "no ST elevation", "LVH": "no LVH", "Edema": "no oedema", "Dyspnea": "denies breathlessness",
    "CHF": "no heart failure", "Typical Chest Pain": "no exertional angina",
}
DISTRACTORS = ["aspirin 75 mg OD", "seen on 12/08", "review in 2 weeks", "ward 4, bed 17", "clopidogrel 75 mg",
               "admitted 3 days ago", "TMT booked for day 10"]
ROMAN = {1: "I", 2: "II", 3: "III", 4: "IV"}


def yes(rec, f):
    return str(rec[f]).upper() in ("Y", "1")


def note_for(rec):
    mentioned = {}
    sex = "man" if rec["Sex"] == "Male" else "woman"
    parts = [f"{rec['Age']}-year-old {sex}"]
    mentioned.update(Age=rec["Age"], Sex=rec["Sex"])
    if rng.random() < 0.7:
        parts.append(f"weight {rec['Weight']} kg, height {rec['Length']} cm")
        mentioned.update(Weight=rec["Weight"], Length=rec["Length"])
    history = [rng.choice(POS[f]) for f in POS if f in ("DM", "HTN", "Current Smoker", "EX-Smoker", "FH", "Obesity",
               "CRF", "CVA", "Airway disease", "Thyroid Disease", "CHF", "DLP") and yes(rec, f)]
    history += [NEG[f] for f in NEG if f in ("DM", "HTN", "Current Smoker", "CHF") and not yes(rec, f) and rng.random() < 0.3]
    symptoms = [rng.choice(POS[f]) for f in ("Typical Chest Pain", "Dyspnea", "Atypical", "Nonanginal", "LowTH Ang") if yes(rec, f)]
    if rec["Function Class"]:
        symptoms.append(f"NYHA class {ROMAN[int(rec['Function Class'])]}")
        mentioned["Function Class"] = int(rec["Function Class"])
    exam, labs, ecg = [], [], []
    for f in ("BP", "PR"):
        if rng.random() < 0.9:
            exam.append(rng.choice(NUM_PHRASES[f]).format(v=rec[f], d=rng.choice([70, 80, 85, 90])))
            mentioned[f] = rec[f]
    exam += [rng.choice(POS[f]) for f in ("Edema", "Weak Peripheral Pulse", "Lung rales", "Systolic Murmur", "Diastolic Murmur") if yes(rec, f)]
    for f in ("FBS", "CR", "TG", "LDL", "HDL", "BUN", "ESR", "HB", "K", "Na", "WBC", "Lymph", "Neut", "PLT"):
        if rng.random() < 0.8:
            v = rec[f]
            labs.append(rng.choice(NUM_PHRASES[f]).format(v=v, k=round(v / 1000, 1) if f == "WBC" else v,
                                                          big=f"{int(v) * 1000:,}" if f == "PLT" else v))
            mentioned[f] = v
    ecg += [rng.choice(POS[f]) for f in ("Q Wave", "St Elevation", "St Depression", "Tinversion", "LVH", "Poor R Progression") if yes(rec, f)]
    ecg += [NEG[f] for f in ("Q Wave", "St Elevation", "LVH") if not yes(rec, f) and rng.random() < 0.3]
    if rec["BBB"] != "N":
        ecg.append(rec["BBB"])
    echo = []
    if rng.random() < 0.9:
        echo.append(rng.choice(NUM_PHRASES["EF-TTE"]).format(v=rec["EF-TTE"]))
        mentioned["EF-TTE"] = rec["EF-TTE"]
    if rec["Region RWMA"]:
        echo.append(f"RWMA in {int(rec['Region RWMA'])} region{'s' if rec['Region RWMA'] > 1 else ''}")
    if rec["VHD"] != "N":
        echo.append(f"{rec['VHD'].lower()} valvular disease")
    lines = [", ".join(parts) + "."]
    if history:
        rng.shuffle(history)
        lines.append("History: " + "; ".join(history) + ".")
    if symptoms:
        lines.append("Presents with " + ", ".join(symptoms) + ".")
    if exam:
        lines.append("Exam: " + ", ".join(exam) + ".")
    if labs:
        rng.shuffle(labs)
        lines.append("Labs: " + ", ".join(labs) + ".")
    lines.append("ECG: " + (", ".join(ecg) if ecg else "unremarkable") + ".")
    if echo:
        lines.append("Echo: " + ", ".join(echo) + ".")
    lines.append("Plan: " + ", ".join(rng.sample(DISTRACTORS, 2)) + ".")
    return "\n".join(lines), mentioned


def main():
    patients = json.loads((ROOT / "web" / "model" / "heldout_patients.json").read_text())
    out = []
    for p in patients:
        note, mentioned = note_for(p["record"])
        out.append({"id": p["id"], "note": note, "record": p["record"], "mentioned_numeric_or_choice": mentioned})
    d = ROOT / "results" / "intake_eval"
    d.mkdir(parents=True, exist_ok=True)
    name = "notes_dev_seed7.json" if SEED == 7 else f"notes_test_seed{SEED}.json"
    (d / name).write_text(json.dumps(out, indent=1))
    print(f"wrote {len(out)} notes; example:\n\n{out[0]['note']}")


if __name__ == "__main__":
    main()
