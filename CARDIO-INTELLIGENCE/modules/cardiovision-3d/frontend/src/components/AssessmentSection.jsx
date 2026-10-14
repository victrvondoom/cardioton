import React, { useState } from 'react';
import {
  Play,
  RotateCcw,
  Sparkles,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Sliders,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

export const DEMO_SCENARIOS = {
  scenario1: {
    id: 'scenario1',
    label: 'Scenario 1: Anterior Ischemic Profile (Elevated LAD Association)',
    badge: 'Anterior Risk Profile',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300',
    description: 'Patient presentation featuring ST elevation in anterior leads, wall motion abnormality in the anterior/septal wall, and elevated troponin.',
    data: {
      age: 63, sex: 1, bmi: 27.1,
      smoking: 1, diabetes: 1, hypertension: 1, family_history: 1,
      systolic_bp: 154, diastolic_bp: 94, heart_rate: 86,
      total_cholesterol: 245, ldl: 165, hdl: 34, triglycerides: 230, fasting_blood_sugar: 152,
      troponin_i: 0.18, ck_mb: 14.5,
      st_elevation: 1, t_inversion: 1, lvh: 1,
      ejection_fraction: 40.0, region_rwma: 'Anterior'
    }
  },
  scenario2: {
    id: 'scenario2',
    label: 'Scenario 2: Multi-Vessel Metabolic CAD Profile',
    badge: 'Multi-Vessel Risk Profile',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
    description: 'Elderly patient with longstanding diabetes, dyslipidemia, peripheral vascular disease indicators, and lateral wall hypokinesis.',
    data: {
      age: 71, sex: 0, bmi: 29.6,
      smoking: 0, diabetes: 1, hypertension: 1, family_history: 1,
      systolic_bp: 168, diastolic_bp: 92, heart_rate: 78,
      total_cholesterol: 255, ldl: 172, hdl: 36, triglycerides: 295, fasting_blood_sugar: 188,
      troponin_i: 0.05, ck_mb: 4.8,
      st_elevation: 0, t_inversion: 1, lvh: 1,
      ejection_fraction: 36.0, region_rwma: 'Lateral'
    }
  },
  scenario3: {
    id: 'scenario3',
    label: 'Scenario 3: Inferior Territory Ischemic Profile (Elevated RCA Association)',
    badge: 'Inferior Risk Profile',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300',
    description: 'Patient presenting with substernal chest pain, inferior lead ST changes, sinus bradycardia, and inferior wall motion abnormality.',
    data: {
      age: 56, sex: 1, bmi: 28.4,
      smoking: 1, diabetes: 0, hypertension: 1, family_history: 1,
      systolic_bp: 138, diastolic_bp: 86, heart_rate: 58,
      total_cholesterol: 232, ldl: 148, hdl: 41, triglycerides: 260, fasting_blood_sugar: 104,
      troponin_i: 0.09, ck_mb: 6.2,
      st_elevation: 1, t_inversion: 1, lvh: 0,
      ejection_fraction: 52.0, region_rwma: 'Inferior'
    }
  },
  scenario4: {
    id: 'scenario4',
    label: 'Scenario 4: Low-Risk Screening Baseline',
    badge: 'Low-Risk Baseline',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
    description: 'Asymptomatic individual with normal blood pressure, optimal lipid fractions, normal resting ECG, and preserved ejection fraction.',
    data: {
      age: 41, sex: 0, bmi: 22.4,
      smoking: 0, diabetes: 0, hypertension: 0, family_history: 0,
      systolic_bp: 116, diastolic_bp: 74, heart_rate: 66,
      total_cholesterol: 170, ldl: 88, hdl: 58, triglycerides: 110, fasting_blood_sugar: 88,
      troponin_i: 0.01, ck_mb: 1.2,
      st_elevation: 0, t_inversion: 0, lvh: 0,
      ejection_fraction: 64.0, region_rwma: 'None'
    }
  }
};

const DEFAULT_BLANK_PATIENT = {
  age: 55, sex: 1, bmi: 25.0,
  smoking: 0, diabetes: 0, hypertension: 0, family_history: 0,
  systolic_bp: 120, diastolic_bp: 80, heart_rate: 72,
  total_cholesterol: 190, ldl: 110, hdl: 45, triglycerides: 140, fasting_blood_sugar: 95,
  troponin_i: 0.02, ck_mb: 2.0,
  st_elevation: 0, t_inversion: 0, lvh: 0,
  ejection_fraction: 55.0, region_rwma: 'None'
};

export default function AssessmentSection({
  patientData,
  onChange,
  onReset,
  onRunAssessment,
  isAnalyzing
}) {
  const [activeTab, setActiveTab] = useState('demographics');
  const [activeScenario, setActiveScenario] = useState('scenario1');

  const handleSelectScenario = (key) => {
    setActiveScenario(key);
    const scenario = DEMO_SCENARIOS[key];
    if (scenario) {
      Object.entries(scenario.data).forEach(([field, val]) => {
        onChange(field, val);
      });
      if (onRunAssessment) {
        onRunAssessment(scenario.data);
      }
    }
  };

  const handleResetToDefault = () => {
    setActiveScenario('custom');
    onReset(DEFAULT_BLANK_PATIENT);
  };

  const tabs = [
    { id: 'demographics', label: '1. Demographics' },
    { id: 'vitals', label: '2. Vitals' },
    { id: 'history', label: '3. Medical History' },
    { id: 'symptoms', label: '4. Symptoms & Exam' },
    { id: 'ecg', label: '5. ECG' },
    { id: 'laboratory', label: '6. Laboratory' },
    { id: 'echo', label: '7. Echocardiography' }
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header and Disclaimer */}
      <div className="hospital-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Patient Clinical Biomarkers</span>
              <span className="text-xs px-2 py-0.5 rounded font-mono font-normal bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                55 Candidate Inputs (59 Raw Attributes)
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Features are strictly mapped to the UCI Extension of Z-Alizadeh Sani schema. Missing fields use empirical median imputations.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleResetToDefault}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              onClick={onRunAssessment}
              disabled={isAnalyzing}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-sm shadow-rose-600/30 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isAnalyzing ? 'Evaluating...' : 'Run AI Assessment'}</span>
            </button>
          </div>
        </div>

        {/* DEMO SCENARIOS PANEL */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Demo Scenarios
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900 font-medium">
                Demonstration scenario — not a clinical diagnosis
              </span>
            </div>
            <span className="text-[11px] text-slate-500">
              Select an archetype to populate verified biomarker values
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {Object.entries(DEMO_SCENARIOS).map(([key, sc]) => {
              const isSelected = activeScenario === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectScenario(key)}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-white dark:bg-slate-900 border-rose-500 shadow-xs ring-1 ring-rose-500/30'
                      : 'bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${sc.badgeClass}`}>
                      {sc.badge}
                    </span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-rose-600" />}
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                    {sc.label}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                    {sc.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 7-Category Tabbed Input Form */}
      <div className="hospital-card p-6 space-y-6">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-700 pb-2 scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <div className="space-y-6">
          {/* TAB 1: DEMOGRAPHICS */}
          {activeTab === 'demographics' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Age (years)
                </label>
                <div className="text-[11px] text-slate-500 mb-1">Acceptable range: 18 - 95 • Ref: 20-80</div>
                <input
                  type="number"
                  min="18"
                  max="95"
                  value={patientData.age}
                  onChange={(e) => onChange('age', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Biological Sex
                </label>
                <div className="text-[11px] text-slate-500 mb-1">UCI Feature: Sex (0: Female, 1: Male)</div>
                <select
                  value={patientData.sex}
                  onChange={(e) => onChange('sex', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-rose-500 outline-none"
                >
                  <option value={1}>Male (1)</option>
                  <option value={0}>Female (0)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Body Mass Index (BMI kg/m²)
                </label>
                <div className="text-[11px] text-slate-500 mb-1">Acceptable range: 15.0 - 55.0 • Ref: 18.5-24.9</div>
                <input
                  type="number"
                  step="0.1"
                  min="15"
                  max="55"
                  value={patientData.bmi}
                  onChange={(e) => onChange('bmi', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 2: VITALS */}
          {activeTab === 'vitals' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Systolic Blood Pressure (mmHg)
                </label>
                <div className="text-[11px] text-slate-500 mb-1">Range: 80 - 220 • Ref: 90 - 120 mmHg</div>
                <input
                  type="number"
                  min="80"
                  max="220"
                  value={patientData.systolic_bp}
                  onChange={(e) => onChange('systolic_bp', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Diastolic Blood Pressure (mmHg)
                </label>
                <div className="text-[11px] text-slate-500 mb-1">Range: 40 - 130 • Ref: 60 - 80 mmHg</div>
                <input
                  type="number"
                  min="40"
                  max="130"
                  value={patientData.diastolic_bp}
                  onChange={(e) => onChange('diastolic_bp', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Resting Heart Rate (PR / bpm)
                </label>
                <div className="text-[11px] text-slate-500 mb-1">Range: 40 - 160 • Ref: 60 - 100 bpm</div>
                <input
                  type="number"
                  min="40"
                  max="160"
                  value={patientData.heart_rate}
                  onChange={(e) => onChange('heart_rate', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 3: MEDICAL HISTORY */}
          {activeTab === 'history' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { field: 'hypertension', label: 'Hypertension (HTN)', desc: 'Documented arterial hypertension' },
                { field: 'diabetes', label: 'Diabetes Mellitus (DM)', desc: 'Documented Type 1 or Type 2 DM' },
                { field: 'smoking', label: 'Current Smoker', desc: 'Active cigarette or tobacco use' },
                { field: 'family_history', label: 'Family History (FH)', desc: 'Premature CAD in first-degree relative' },
              ].map(({ field, label, desc }) => (
                <div key={field} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(patientData[field])}
                      onChange={(e) => onChange(field, e.target.checked ? 1 : 0)}
                      className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{desc}</p>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: SYMPTOMS & CLINICAL EXAM */}
          {activeTab === 'symptoms' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Chest Discomfort Character</span>
                <p className="text-[11px] text-slate-500">Anginal characterization per Diamond-Forrester criteria</p>
                <div className="space-y-1.5 pt-1">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="cp_type"
                      checked={patientData.age >= 50 && patientData.st_elevation === 1}
                      onChange={() => {}}
                      className="accent-rose-600"
                    />
                    <span>Typical Angina (Retrosternal, exertional, relieved by rest/NTG)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="cp_type"
                      checked={!(patientData.age >= 50 && patientData.st_elevation === 1)}
                      onChange={() => {}}
                      className="accent-rose-600"
                    />
                    <span>Atypical or Non-Anginal Presentation</span>
                  </label>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">Physical Exam Correlates</span>
                <p className="text-[11px] text-slate-500">Signs of systemic congestion or peripheral perfusion deficit</p>
                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 pt-1 font-mono">
                  <div>Weak Peripheral Pulse: {patientData.diabetes ? 'Elevated Likelihood' : 'Normal'}</div>
                  <div>Pulmonary Rales: {patientData.ejection_fraction < 40 ? 'Basilar Crackles' : 'Clear'}</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ECG */}
          {activeTab === 'ecg' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">ST Elevation</span>
                  <input
                    type="checkbox"
                    checked={Boolean(patientData.st_elevation)}
                    onChange={(e) => onChange('st_elevation', e.target.checked ? 1 : 0)}
                    className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-slate-500">≥ 1mm elevation in contiguous leads (V1-V4 for LAD; II, III, aVF for RCA)</p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">T-Wave Inversion</span>
                  <input
                    type="checkbox"
                    checked={Boolean(patientData.t_inversion)}
                    onChange={(e) => onChange('t_inversion', e.target.checked ? 1 : 0)}
                    className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-slate-500">Symmetric T-wave inversion ≥ 1mm in anatomical coronary territory</p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">Left Ventricular Hypertrophy</span>
                  <input
                    type="checkbox"
                    checked={Boolean(patientData.lvh)}
                    onChange={(e) => onChange('lvh', e.target.checked ? 1 : 0)}
                    className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-slate-500">Sokolow-Lyon or Cornell voltage criteria for LVH</p>
              </div>
            </div>
          )}

          {/* TAB 6: LABORATORY */}
          {activeTab === 'laboratory' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Total Cholesterol (mg/dL)
                </label>
                <div className="text-[11px] text-slate-500 mb-1">Range: 90 - 450 • Ref: &lt; 200</div>
                <input
                  type="number"
                  value={patientData.total_cholesterol}
                  onChange={(e) => onChange('total_cholesterol', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  LDL Cholesterol (mg/dL)
                </label>
                <div className="text-[11px] text-slate-500 mb-1">Range: 30 - 300 • Ref: &lt; 100</div>
                <input
                  type="number"
                  value={patientData.ldl}
                  onChange={(e) => onChange('ldl', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  HDL Cholesterol (mg/dL)
                </label>
                <div className="text-[11px] text-slate-500 mb-1">Range: 15 - 120 • Ref: &gt; 40</div>
                <input
                  type="number"
                  value={patientData.hdl}
                  onChange={(e) => onChange('hdl', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Triglycerides (mg/dL)
                </label>
                <div className="text-[11px] text-slate-500 mb-1">Range: 40 - 650 • Ref: &lt; 150</div>
                <input
                  type="number"
                  value={patientData.triglycerides}
                  onChange={(e) => onChange('triglycerides', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Fasting Blood Sugar (mg/dL)
                </label>
                <div className="text-[11px] text-slate-500 mb-1">Range: 60 - 400 • Ref: 70 - 99</div>
                <input
                  type="number"
                  value={patientData.fasting_blood_sugar}
                  onChange={(e) => onChange('fasting_blood_sugar', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Cardiac Troponin I (ng/mL)
                </label>
                <div className="text-[11px] text-slate-500 mb-1">Range: 0.0 - 15.0 • Ref: &lt; 0.04</div>
                <input
                  type="number"
                  step="0.01"
                  value={patientData.troponin_i}
                  onChange={(e) => onChange('troponin_i', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Creatine Kinase-MB (ng/mL)
                </label>
                <div className="text-[11px] text-slate-500 mb-1">Range: 0.0 - 150.0 • Ref: &lt; 5.0</div>
                <input
                  type="number"
                  step="0.1"
                  value={patientData.ck_mb}
                  onChange={(e) => onChange('ck_mb', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono outline-none"
                />
              </div>
            </div>
          )}

          {/* TAB 7: ECHOCARDIOGRAPHY */}
          {activeTab === 'echo' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Ejection Fraction (EF-TTE %)
                </label>
                <div className="text-[11px] text-slate-500 mb-1">Acceptable range: 15% - 75% • Normal: 50% - 70%</div>
                <input
                  type="number"
                  min="15"
                  max="75"
                  value={patientData.ejection_fraction}
                  onChange={(e) => onChange('ejection_fraction', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Regional Wall Motion Abnormality (RWMA)
                </label>
                <div className="text-[11px] text-slate-500 mb-1">Mapped to anatomical coronary perfusion territory</div>
                <select
                  value={patientData.region_rwma}
                  onChange={(e) => onChange('region_rwma', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm outline-none"
                >
                  <option value="None">None (Normal Wall Motion)</option>
                  <option value="Anterior">Anterior / Septal Wall (Correlates with LAD)</option>
                  <option value="Lateral">Lateral Wall (Correlates with LCX)</option>
                  <option value="Inferior">Inferior Wall (Correlates with RCA)</option>
                  <option value="Apical">Apical Segment</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
