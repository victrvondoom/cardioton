# Cardiovascular Risk Visualization & Prediction

### Multimodal AI Hackathon 2026

**Track A — Cardiovascular Risk Visualization & Prediction**

## 📌 About

CardioRisk 3D is an AI-powered web application for **cardiovascular risk prediction and coronary artery visualization**.

The system predicts:

* Overall **CAD (Coronary Artery Disease)** probability
* **LAD** stenosis probability
* **LCX** stenosis probability
* **RCA** stenosis probability

The predictions are generated from demographic, clinical, ECG, laboratory, and echocardiographic features.

---

## 🚀 Key Features

### 🧠 Machine Learning

* CAD prediction using SVM
* LAD, LCX and RCA stenosis prediction using Random Forest
* Probability-based predictions
* Data preprocessing and categorical feature encoding
* Target leakage prevention by excluding `Cath`, `LAD`, `LCX`, and `RCA` from input features

### 📊 Clinical Dashboard

* Patient clinical data input
* Overall CAD probability
* Individual coronary vessel probabilities
* Clinical and physiological measurements

### 🫀 3D Cardiovascular Visualization

* Interactive 3D heart/coronary anatomy
* LAD, LCX and RCA visualization
* Probability-based vessel visualization
* Rotate and zoom interaction
* Vessel selection

### 🔍 Explainable AI

* Feature contribution visualization
* SHAP/LIME-based model explanations
* Interpretable clinical prediction results

### ⚕️ Safety

A visible clinical disclaimer is included:

> **For educational and clinical decision-support purposes only. This system is not a substitute for formal diagnostic evaluation or medical imaging.**

---

## 🏗️ System Architecture

```text
              Patient Clinical Data
                       │
                       ▼
              React Frontend
                       │
                       ▼
                FastAPI Backend
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       CAD Model    LAD Model   LCX/RCA Models
          │            │            │
          └────────────┼────────────┘
                       ▼
              Prediction Results
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
       Clinical Dashboard    3D Visualization
             │                   │
             └─────────┬─────────┘
                       ▼
                Explainable AI
```

---

## 🛠️ Technology Stack

**Machine Learning**

* Python
* Pandas
* Scikit-learn
* SVM
* Random Forest
* Joblib

**Backend**

* FastAPI
* Uvicorn

**Frontend**

* React
* Vite
* JavaScript
* CSS

**3D Visualization**

* Three.js
* React Three Fiber
* Drei

**Explainability**

* SHAP / LIME

---

## 📁 Project Structure

```text
cardio-risk-3d/
│
├── data/
│   └── extension of Z-Alizadeh Sani Dataset.xlsx
│
├── ml/
│   ├── check_data.py
│   ├── model_comparison.py
│   ├── cardio_risk_3d__ml__preprocess.py
│   └── train_final_models.py
│
├── models/
│   ├── cad_model.pkl
│   ├── lad_model.pkl
│   ├── lcx_model.pkl
│   ├── rca_model.pkl
│   └── feature_columns.pkl
│
├── backend/
│   └── cardio_risk_3d__backend__app.py
│
├── frontend/
│   ├── src/
│   ├── package.json
│   └── ...
│
└── cardio_risk_3d__README.md
```

---

## 📌 Dataset

The project uses an extension of the **Z-Alizadeh Sani Dataset** containing **303 patient records** with cardiovascular clinical information.

The model uses:

* Demographic features
* Risk factors
* Clinical history
* ECG features
* Laboratory values
* Echocardiographic features

To prevent target leakage, the following columns are excluded from model inputs:

```text
Cath
LAD
LCX
RCA
```

---

## 🤖 Machine Learning Models

| Target | Model         |
| ------ | ------------- |
| CAD    | SVM           |
| LAD    | Random Forest |
| LCX    | Random Forest |
| RCA    | Random Forest |

The models return probability scores between **0 and 1**, which are displayed as percentages in the dashboard.

---

## 📈 Evaluation

The ML pipeline supports evaluation using:

* Accuracy
* Precision
* Recall
* F1 Score
* ROC-AUC

These metrics are used to evaluate the predictive performance of the models.

---

## ⚙️ Installation & Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd cardio-risk-3d
```

### 2. Install Python Dependencies

```bash
pip install pandas scikit-learn joblib fastapi uvicorn openpyxl
```

### 3. Start Backend

From the project root:

```bash
uvicorn backend.cardio_risk_3d__backend__app:app --reload
```

Backend:

```text
http://127.0.0.1:8000
```

API documentation:

```text
http://127.0.0.1:8000/docs
```

### 4. Start Frontend

```bash
cd frontend
npm install
npm install three @react-three/fiber @react-three/drei
npm run dev
```

Open the local URL provided by Vite.

---

## ⚠️ Clinical Disclaimer

**This application is developed for educational and clinical decision-support purposes only. It does not provide a definitive medical diagnosis and should not replace professional clinical evaluation, formal diagnostic imaging, or advice from a qualified healthcare professional.**

---

## 👥 Project

**CardioRisk 3D**
**Track:** Cardiovascular Risk Visualization & Prediction
**Domain:** AI / Machine Learning / Healthcare / 3D Visualization
