import React, { useState } from 'react';
import { PatientData, SamplePatient } from '../arterylens__frontend_src__types';
import { ChevronDown, ChevronRight, RotateCcw, Activity } from 'lucide-react';

interface PatientFormProps {
  patient: PatientData;
  onChange: (updated: PatientData) => void;
  samples: SamplePatient[];
  onSelectSample: (sample: SamplePatient) => void;
  onSubmit: () => void;
  loading: boolean;
}

export const PatientForm: React.FC<PatientFormProps> = ({
  patient,
  onChange,
  samples,
  onSelectSample,
  onSubmit,
  loading
}) => {
  // Collapsible accordion state (default open demographics and vitals)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    demo: true,
    history: false,
    vitals: true,
    ecg: false,
    echo: false,
    labs: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const updateField = (key: string, val: number) => {
    onChange({
      ...patient,
      [key]: val
    });
  };

  const handleResetToBaseline = () => {
    if (samples.length > 1) {
      onSelectSample(samples[1]); // Reset to normal patient
    }
  };

  return (
    <div className="clinical-card p-4 rounded-lg shadow-sm flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      {/* Header & Benchmark Patient Selector */}
      <div className="mb-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
          Patient clinical inputs
        </h2>

        {/* Benchmark Dropdown */}
        <select
          onChange={(e) => {
            const selected = samples.find(s => s.id === e.target.value);
            if (selected) onSelectSample(selected);
          }}
          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs rounded-md px-2.5 py-1.5 focus:ring-1 focus:ring-sky-500 focus:outline-none transition cursor-pointer"
          defaultValue=""
          aria-label="Load benchmark patient profile"
        >
          <option value="" disabled>Load benchmark patient...</option>
          {samples.map(s => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Accordion Sections Container */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2 text-xs">
        {/* 1. DEMOGRAPHICS */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('demo')}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100/70 dark:hover:bg-slate-800 transition text-left"
          >
            <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
              {openSections.demo ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
              <span>Demographics</span>
            </div>
            <span className="text-[11px] text-slate-400 font-normal">5 fields</span>
          </button>

          {openSections.demo && (
            <div className="p-3 bg-white dark:bg-slate-900 grid grid-cols-2 gap-2.5 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Age (years)</label>
                <input
                  type="number"
                  min="20"
                  max="95"
                  value={patient['Age'] ?? 58}
                  onChange={e => updateField('Age', parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-slate-100 tabular-nums focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Sex</label>
                <select
                  value={patient['Sex'] ?? 1}
                  onChange={e => updateField('Sex', parseFloat(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                >
                  <option value={1}>Male</option>
                  <option value={0}>Female</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Weight (kg)</label>
                <input
                  type="number"
                  value={patient['Weight'] ?? 75}
                  onChange={e => updateField('Weight', parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-slate-100 tabular-nums focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Height (cm)</label>
                <input
                  type="number"
                  value={patient['Length'] ?? 168}
                  onChange={e => updateField('Length', parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-slate-100 tabular-nums focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="col-span-2">
                <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Body mass index (BMI)</label>
                <input
                  type="number"
                  step="0.1"
                  value={patient['BMI'] ?? 26.5}
                  onChange={e => updateField('BMI', parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-slate-100 tabular-nums focus:ring-1 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* 2. MEDICAL HISTORY */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('history')}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100/70 dark:hover:bg-slate-800 transition text-left"
          >
            <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
              {openSections.history ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
              <span>Medical history</span>
            </div>
            <span className="text-[11px] text-slate-400 font-normal">10 fields</span>
          </button>

          {openSections.history && (
            <div className="p-3 bg-white dark:bg-slate-900 grid grid-cols-2 gap-2 border-t border-slate-100 dark:border-slate-800">
              {[
                { key: 'DM', label: 'Diabetes mellitus' },
                { key: 'HTN', label: 'Hypertension' },
                { key: 'Current Smoker', label: 'Current smoker' },
                { key: 'EX-Smoker', label: 'Ex-smoker' },
                { key: 'FH', label: 'Family history' },
                { key: 'DLP', label: 'Dyslipidemia' },
                { key: 'CRF', label: 'Renal failure' },
                { key: 'CHF', label: 'Heart failure' },
                { key: 'CVA', label: 'Cerebrovascular' },
                { key: 'Airway disease', label: 'Airway disease' },
              ].map(item => (
                <label key={item.key} className="flex items-center gap-1.5 p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(patient[item.key])}
                    onChange={e => updateField(item.key, e.target.checked ? 1 : 0)}
                    className="rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-0"
                  />
                  <span className="text-[11px] text-slate-700 dark:text-slate-300">{item.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* 3. SYMPTOMS & VITALS */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('vitals')}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100/70 dark:hover:bg-slate-800 transition text-left"
          >
            <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
              {openSections.vitals ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
              <span>Symptoms & examination</span>
            </div>
            <span className="text-[11px] text-slate-400 font-normal">10 fields</span>
          </button>

          {openSections.vitals && (
            <div className="p-3 bg-white dark:bg-slate-900 space-y-2.5 border-t border-slate-100 dark:border-slate-800">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Systolic BP (mmHg)</label>
                  <input
                    type="number"
                    value={patient['BP'] ?? 120}
                    onChange={e => updateField('BP', parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-slate-100 tabular-nums focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Pulse rate (bpm)</label>
                  <input
                    type="number"
                    value={patient['PR'] ?? 75}
                    onChange={e => updateField('PR', parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-slate-100 tabular-nums focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { key: 'Typical Chest Pain', label: 'Typical chest pain' },
                  { key: 'Exertional CP', label: 'Exertional chest pain' },
                  { key: 'Dyspnea', label: 'Dyspnea on exertion' },
                  { key: 'Atypical', label: 'Atypical chest pain' },
                  { key: 'Nonanginal', label: 'Non-anginal pain' },
                  { key: 'Weak Peripheral Pulse', label: 'Weak peripheral pulse' },
                  { key: 'Edema', label: 'Peripheral edema' },
                  { key: 'Lung rales', label: 'Pulmonary rales' },
                ].map(item => (
                  <label key={item.key} className="flex items-center gap-1.5 p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(patient[item.key])}
                      onChange={e => updateField(item.key, e.target.checked ? 1 : 0)}
                      className="rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-0"
                    />
                    <span className="text-[11px] text-slate-700 dark:text-slate-300">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 4. ECG FINDINGS */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('ecg')}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100/70 dark:hover:bg-slate-800 transition text-left"
          >
            <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
              {openSections.ecg ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
              <span>Electrocardiogram (ECG)</span>
            </div>
            <span className="text-[11px] text-slate-400 font-normal">7 fields</span>
          </button>

          {openSections.ecg && (
            <div className="p-3 bg-white dark:bg-slate-900 grid grid-cols-2 gap-1.5 border-t border-slate-100 dark:border-slate-800">
              {[
                { key: 'St Elevation', label: 'ST elevation' },
                { key: 'St Depression', label: 'ST depression' },
                { key: 'Tinversion', label: 'T-wave inversion' },
                { key: 'Q Wave', label: 'Pathological Q-wave' },
                { key: 'LVH', label: 'LV hypertrophy' },
                { key: 'Poor R Progression', label: 'Poor R-progression' },
                { key: 'BBB', label: 'Bundle branch block' },
              ].map(item => (
                <label key={item.key} className="flex items-center gap-1.5 p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(patient[item.key])}
                    onChange={e => updateField(item.key, e.target.checked ? 1 : 0)}
                    className="rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-0"
                  />
                  <span className="text-[11px] text-slate-700 dark:text-slate-300">{item.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* 5. ECHOCARDIOGRAPHY */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('echo')}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100/70 dark:hover:bg-slate-800 transition text-left"
          >
            <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
              {openSections.echo ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
              <span>Echocardiography & RWMA</span>
            </div>
            <span className="text-[11px] text-slate-400 font-normal">3 fields</span>
          </button>

          {openSections.echo && (
            <div className="p-3 bg-white dark:bg-slate-900 space-y-2.5 border-t border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-slate-500 dark:text-slate-400">Ejection fraction (EF-TTE)</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{patient['EF-TTE'] ?? 55}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="75"
                  value={patient['EF-TTE'] ?? 55}
                  onChange={e => updateField('EF-TTE', parseFloat(e.target.value))}
                  className="w-full accent-sky-600 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">
                  Regional wall motion abnormality (RWMA)
                </label>
                <select
                  value={patient['Region RWMA'] ?? 0}
                  onChange={e => updateField('Region RWMA', parseFloat(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                >
                  <option value={0}>0 - None (normal wall motion)</option>
                  <option value={1}>1 - Mild hypokinesia</option>
                  <option value={2}>2 - Moderate regional RWMA</option>
                  <option value={3}>3 - Severe akinesia</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">
                  Valvular heart disease (VHD)
                </label>
                <select
                  value={patient['VHD'] ?? 0}
                  onChange={e => updateField('VHD', parseFloat(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                >
                  <option value={0}>None</option>
                  <option value={1}>Mild</option>
                  <option value={2}>Moderate</option>
                  <option value={3}>Severe</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* 6. LABORATORY BIOMARKERS */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('labs')}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100/70 dark:hover:bg-slate-800 transition text-left"
          >
            <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
              {openSections.labs ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
              <span>Laboratory biomarkers</span>
            </div>
            <span className="text-[11px] text-slate-400 font-normal">10 fields</span>
          </button>

          {openSections.labs && (
            <div className="p-3 bg-white dark:bg-slate-900 grid grid-cols-2 gap-2 border-t border-slate-100 dark:border-slate-800">
              {[
                { key: 'LDL', label: 'LDL-C (mg/dL)', def: 110 },
                { key: 'HDL', label: 'HDL-C (mg/dL)', def: 45 },
                { key: 'TG', label: 'Triglycerides', def: 150 },
                { key: 'FBS', label: 'Fasting glucose', def: 95 },
                { key: 'CR', label: 'Creatinine', def: 0.9, step: 0.1 },
                { key: 'BUN', label: 'Urea nitrogen', def: 16 },
                { key: 'ESR', label: 'ESR (mm/hr)', def: 15 },
                { key: 'WBC', label: 'WBC (/uL)', def: 7200 },
                { key: 'Neut', label: 'Neutrophils %', def: 62 },
                { key: 'Lymph', label: 'Lymphocytes %', def: 28 },
              ].map(lab => (
                <div key={lab.key}>
                  <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">{lab.label}</label>
                  <input
                    type="number"
                    step={lab.step || 1}
                    value={patient[lab.key] ?? lab.def}
                    onChange={e => updateField(lab.key, parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-slate-100 tabular-nums focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons at the Bottom */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className="flex-1 bg-sky-700 hover:bg-sky-800 text-white font-medium py-2 px-3 rounded-md text-xs flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-50"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>{loading ? 'Evaluating...' : 'Run assessment'}</span>
        </button>

        <button
          type="button"
          onClick={handleResetToBaseline}
          className="p-2 border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs transition"
          title="Reset to normal baseline patient"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
