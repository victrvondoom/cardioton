import { useState } from "react";
import "./App.css";

const initialData = {
  Age: "",
  Weight: "",
  Length: "",
  Sex: "Male",
  BMI: "",
  DM: 0,
  HTN: 0,
  "Current Smoker": 0,
  "EX-Smoker": 0,
  FH: 0,
  Obesity: 0,
  CRF: 0,
  CVA: 0,
  "Airway disease": 0,
  "Thyroid Disease": 0,
  CHF: 0,
  DLP: 0,
  BP: "",
  PR: "",
  Edema: 0,
  "Weak Peripheral Pulse": 0,
  "Lung rales": 0,
  "Systolic Murmur": 0,
  "Diastolic Murmur": 0,
  "Typical Chest Pain": 0,
  Dyspnea: 0,
  "Function Class": "",
  Atypical: 0,
  Nonanginal: 0,
  "Exertional CP": 0,
  "LowTH Ang": 0,
  "Q Wave": 0,
  "St Elevation": 0,
  "St Depression": 0,
  Tinversion: 0,
  LVH: 0,
  "Poor R Progression": 0,
  BBB: 0,
  FBS: "",
  CR: "",
  TG: "",
  LDL: "",
  HDL: "",
  BUN: "",
  ESR: "",
  HB: "",
  K: "",
  Na: "",
  WBC: "",
  Lymph: "",
  Neut: "",
  PLT: "",
  "EF-TTE": "",
  "Region RWMA": "",
  VHD: 0,
};

function App() {
  const [formData, setFormData] = useState(initialData);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setResult(null);

    try {
      const payload = {};

      Object.keys(formData).forEach((key) => {
        if (key === "Sex") {
          payload[key] = formData[key] === "Male" ? 1 : 0;
        } else {
          payload[key] =
            formData[key] === "" ? 0 : Number(formData[key]);
        }
      });

      const response = await fetch("http://127.0.0.1:8000/predict", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Prediction request failed");
      }

      const data = await response.json();

      setResult(data);
      console.log("Prediction:", data);
    } catch (error) {
      console.error(error);
      alert(
        "Prediction failed. Make sure FastAPI backend is running."
      );
    } finally {
      setLoading(false);
    }
  };

  const clinicalHistory = [
    "Obesity",
    "CRF",
    "CVA",
    "Airway disease",
    "Thyroid Disease",
    "CHF",
    "DLP",
    "Weak Peripheral Pulse",
    "Lung rales",
    "Systolic Murmur",
    "Diastolic Murmur",
    "Dyspnea",
    "Atypical",
    "Nonanginal",
    "Exertional CP",
    "LowTH Ang",
    "LVH",
    "Poor R Progression",
  ];

  const labs = [
    "FBS",
    "CR",
    "TG",
    "LDL",
    "HDL",
    "BUN",
    "ESR",
    "HB",
    "K",
    "Na",
    "WBC",
    "Lymph",
    "Neut",
    "PLT",
  ];

  return (
    <div className="app">
      <h1>Cardiovascular Risk Prediction</h1>
      <p className="subtitle">
        Enter patient clinical information
      </p>

      <form onSubmit={handleSubmit}>

        {/* DEMOGRAPHICS */}
        <div className="section">
          <h2>1. Demographics</h2>

          <div className="grid">
            <div className="field">
              <label>Age</label>
              <input
                type="number"
                name="Age"
                value={formData.Age}
                onChange={handleChange}
              />
            </div>

            <div className="field">
              <label>Weight</label>
              <input
                type="number"
                name="Weight"
                value={formData.Weight}
                onChange={handleChange}
              />
            </div>

            <div className="field">
              <label>Length</label>
              <input
                type="number"
                name="Length"
                value={formData.Length}
                onChange={handleChange}
              />
            </div>

            <div className="field">
              <label>Sex</label>
              <select
                name="Sex"
                value={formData.Sex}
                onChange={handleChange}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div className="field">
              <label>BMI</label>
              <input
                type="number"
                step="any"
                name="BMI"
                value={formData.BMI}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* RISK FACTORS */}
        <div className="section">
          <h2>2. Risk Factors</h2>

          <div className="grid">
            {[
              "DM",
              "HTN",
              "Current Smoker",
              "EX-Smoker",
              "FH",
            ].map((field) => (
              <div className="field" key={field}>
                <label>{field}</label>

                <select
                  name={field}
                  value={formData[field]}
                  onChange={handleChange}
                >
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* CLINICAL HISTORY */}
        <div className="section">
          <h2>3. Clinical History</h2>

          <div className="grid">
            {clinicalHistory.map((field) => (
              <div className="field" key={field}>
                <label>{field}</label>

                <select
                  name={field}
                  value={formData[field]}
                  onChange={handleChange}
                >
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* CLINICAL MEASUREMENTS */}
        <div className="section">
          <h2>4. Clinical Measurements</h2>

          <div className="grid">
            <div className="field">
              <label>BP</label>
              <input
                type="number"
                name="BP"
                value={formData.BP}
                onChange={handleChange}
              />
            </div>

            <div className="field">
              <label>PR</label>
              <input
                type="number"
                name="PR"
                value={formData.PR}
                onChange={handleChange}
              />
            </div>

            <div className="field">
              <label>Edema</label>
              <select
                name="Edema"
                value={formData.Edema}
                onChange={handleChange}
              >
                <option value="0">No</option>
                <option value="1">Yes</option>
              </select>
            </div>

            <div className="field">
              <label>Typical Chest Pain</label>
              <select
                name="Typical Chest Pain"
                value={formData["Typical Chest Pain"]}
                onChange={handleChange}
              >
                <option value="0">No</option>
                <option value="1">Yes</option>
              </select>
            </div>

            <div className="field">
              <label>Function Class</label>
              <input
                type="number"
                name="Function Class"
                value={formData["Function Class"]}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* ECG */}
        <div className="section">
          <h2>5. ECG Features</h2>

          <div className="grid">
            {[
              "Q Wave",
              "St Elevation",
              "St Depression",
              "Tinversion",
              "LVH",
              "Poor R Progression",
            ].map((field) => (
              <div className="field" key={field}>
                <label>{field}</label>

                <select
                  name={field}
                  value={formData[field]}
                  onChange={handleChange}
                >
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </div>
            ))}

            <div className="field">
              <label>BBB</label>

              <select
                name="BBB"
                value={formData.BBB}
                onChange={handleChange}
              >
                <option value="0">Normal</option>
                <option value="1">LBBB</option>
                <option value="2">RBBB</option>
              </select>
            </div>
          </div>
        </div>

        {/* LABS */}
        <div className="section">
          <h2>6. Blood & Lab Values</h2>

          <div className="grid">
            {labs.map((field) => (
              <div className="field" key={field}>
                <label>{field}</label>

                <input
                  type="number"
                  step="any"
                  name={field}
                  value={formData[field]}
                  onChange={handleChange}
                />
              </div>
            ))}
          </div>
        </div>

        {/* ECHO */}
        <div className="section">
          <h2>7. Echo / Cardiac Imaging</h2>

          <div className="grid">
            <div className="field">
              <label>EF-TTE</label>
              <input
                type="number"
                step="any"
                name="EF-TTE"
                value={formData["EF-TTE"]}
                onChange={handleChange}
              />
            </div>

            <div className="field">
              <label>Region RWMA</label>
              <input
                type="number"
                step="any"
                name="Region RWMA"
                value={formData["Region RWMA"]}
                onChange={handleChange}
              />
            </div>

            <div className="field">
              <label>VHD</label>

              <select
                name="VHD"
                value={formData.VHD}
                onChange={handleChange}
              >
                <option value="0">Normal</option>
                <option value="1">Mild</option>
                <option value="2">Moderate</option>
                <option value="3">Severe</option>
              </select>
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading}>
          {loading
            ? "Predicting..."
            : "Predict Cardiovascular Risk"}
        </button>

      </form>

      {/* RESULTS */}
      {result && (
        <div className="results">
          <h2>Prediction Results</h2>

          <div className="result-grid">
            <div className="result-card">
              <h3>CAD</h3>
              <strong>{(result.CAD * 100).toFixed(1)}%</strong>
            </div>

            <div className="result-card">
              <h3>LAD</h3>
              <strong>{(result.LAD * 100).toFixed(1)}%</strong>
            </div>

            <div className="result-card">
              <h3>LCX</h3>
              <strong>{(result.LCX * 100).toFixed(1)}%</strong>
            </div>

            <div className="result-card">
              <h3>RCA</h3>
              <strong>{(result.RCA * 100).toFixed(1)}%</strong>
            </div>
          </div>
        </div>
      )}

      <p className="disclaimer">
        Clinical decision-support / educational use only.
        This tool is not a substitute for formal diagnostic
        evaluation or medical imaging.
      </p>
    </div>
  );
}

export default App;