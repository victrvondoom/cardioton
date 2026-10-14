import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Copy,
  Download,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  Heart
} from 'lucide-react';
import { VESSEL_COLORS } from './HeartCanvas';

export default function ReportSection({
  patientData,
  predictionData
}) {
  const [copied, setCopied] = useState(false);

  const cadPct = predictionData?.overall_cad?.percentage ?? null;
  const ladPct = predictionData?.vessels?.LAD?.percentage ?? null;
  const lcxPct = predictionData?.vessels?.LCX?.percentage ?? null;
  const rcaPct = predictionData?.vessels?.RCA?.percentage ?? null;

  const topCadShap = predictionData?.overall_cad?.top_shap_features || [];

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = () => {
    const text = `
CARDIOVISION AI - DECISION-SUPPORT ASSESSMENT REPORT
Date: ${new Date().toLocaleDateString()}
Report ID: CV-${Date.now().toString().slice(-6)}
Model Version: v1.0.0 (Trained on UCI ML Repository Dataset #411)

PATIENT SUMMARY:
- Age: ${patientData.age} years | Sex: ${patientData.sex === 1 ? 'Male' : 'Female'} | BMI: ${patientData.bmi}
- Blood Pressure: ${patientData.systolic_bp}/${patientData.diastolic_bp} mmHg | Heart Rate: ${patientData.heart_rate} bpm
- Risk Factors: DM: ${patientData.diabetes ? 'Yes' : 'No'}, HTN: ${patientData.hypertension ? 'Yes' : 'No'}, Smoker: ${patientData.smoking ? 'Yes' : 'No'}
- ECG: ST Elevation: ${patientData.st_elevation ? 'Yes' : 'No'}, T-Inversion: ${patientData.t_inversion ? 'Yes' : 'No'}
- Echocardiography: LVEF: ${patientData.ejection_fraction}% | RWMA: ${patientData.region_rwma}

AI MODEL PREDICTIONS:
- Overall CAD: Model-estimated probability: ${cadPct != null ? `${cadPct}%` : 'Pending'}
- LAD (Left Anterior Descending): Predicted stenosis probability: ${ladPct != null ? `${ladPct}%` : 'Pending'}
- LCX (Left Circumflex): Predicted stenosis probability: ${lcxPct != null ? `${lcxPct}%` : 'Pending'}
- RCA (Right Coronary Artery): Predicted stenosis probability: ${rcaPct != null ? `${rcaPct}%` : 'Pending'}

TOP MODEL-CONTRIBUTING FEATURES (TreeSHAP):
${topCadShap.slice(0, 5).map(f => `  • ${f.feature}: ${f.contribution} (${f.impact})`).join('\n')}

LEAKAGE PROTECTION AUDIT:
Target variables (Cath, LAD, LCX, RCA) were strictly excluded from input features to prevent target leakage.

DISCLAIMER:
Research & Educational Decision-Support Prototype. Model outputs are estimates for demonstration purposes only and are not medical diagnoses or substitutes for professional evaluation or formal diagnostic imaging.
Prediction mapped to anatomical vessel; this does not represent measured plaque location.
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header and Actions */}
      <div className="hospital-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-rose-600" />
            <span>Cardiovascular Decision-Support Report</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Standardized technical summary for multidisciplinary review and research documentation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Text'}</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Printable Report Sheet */}
      <div className="hospital-card p-8 sm:p-10 space-y-8 bg-white text-slate-900 shadow-lg border border-slate-200">
        {/* Report Top Branding */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center text-white">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold tracking-tight">CardioVision AI</h3>
              <p className="text-xs text-slate-500">
                AI-Assisted Cardiovascular Decision-Support Prototype • v1.0.0
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right text-xs font-mono text-slate-500 space-y-0.5">
            <div>Report Ref: CV-{Date.now().toString().slice(-6)}</div>
            <div>Date: {new Date().toLocaleDateString()}</div>
            <div>Cohort Model: UCI ML Repository #411</div>
          </div>
        </div>

        {/* 1. Patient Biomarker Summary */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-500">
            1. Patient Biomarker Summary
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Demographics</span>
              <span className="font-semibold">{patientData.age}y • {patientData.sex === 1 ? 'Male' : 'Female'} • BMI {patientData.bmi}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Vitals</span>
              <span className="font-semibold">{patientData.systolic_bp}/{patientData.diastolic_bp} mmHg • {patientData.heart_rate} bpm</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Lipid Panel</span>
              <span className="font-semibold">LDL {patientData.ldl} • HDL {patientData.hdl} • TG {patientData.triglycerides}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Echo / RWMA</span>
              <span className="font-semibold">EF {patientData.ejection_fraction}% • {patientData.region_rwma}</span>
            </div>
          </div>
        </div>

        {/* 2. Model-Estimated Stenosis Probabilities */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-500">
            2. Model-Estimated Stenosis Probabilities
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
              <span className="text-xs font-mono font-bold text-slate-600">Overall CAD</span>
              <div className="text-2xl font-bold font-mono text-slate-900">{cadPct != null ? `${cadPct}%` : 'Pending'}</div>
              <p className="text-[11px] text-slate-500">Model-estimated probability</p>
            </div>
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/40 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-xs font-mono font-bold text-rose-700">LAD Territory</span>
              </div>
              <div className="text-2xl font-bold font-mono text-rose-700">{ladPct != null ? `${ladPct}%` : 'Pending'}</div>
              <p className="text-[11px] text-slate-500">Predicted stenosis prob</p>
            </div>
            <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/40 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-500" />
                <span className="text-xs font-mono font-bold text-teal-700">LCX Territory</span>
              </div>
              <div className="text-2xl font-bold font-mono text-teal-700">{lcxPct != null ? `${lcxPct}%` : 'Pending'}</div>
              <p className="text-[11px] text-slate-500">Predicted stenosis prob</p>
            </div>
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-xs font-mono font-bold text-amber-700">RCA Territory</span>
              </div>
              <div className="text-2xl font-bold font-mono text-amber-700">{rcaPct != null ? `${rcaPct}%` : 'Pending'}</div>
              <p className="text-[11px] text-slate-500">Predicted stenosis prob</p>
            </div>
          </div>
        </div>

        {/* 3. Top Model-Contributing Features */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-500">
            3. Top Model-Contributing Features (TreeSHAP)
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-slate-200 rounded-lg">
              <thead className="bg-slate-50 text-slate-600 font-mono text-[11px] uppercase border-b">
                <tr>
                  <th className="py-2 px-3">Feature Name</th>
                  <th className="py-2 px-3">Contribution</th>
                  <th className="py-2 px-3">Direction</th>
                  <th className="py-2 px-3">Attribution Context</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {topCadShap.slice(0, 5).map((f, i) => (
                  <tr key={i}>
                    <td className="py-2 px-3 font-sans font-medium">{f.feature}</td>
                    <td className="py-2 px-3 font-bold">{f.contribution}</td>
                    <td className="py-2 px-3">
                      <span className={(f.shap_value || 0) >= 0 ? 'text-rose-600 font-bold' : 'text-teal-600 font-bold'}>
                        {(f.shap_value || 0) >= 0 ? 'Pushes Prediction Higher' : 'Pushes Prediction Lower'}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-sans text-slate-500 text-[11px]">
                      Model feature attribution (statistical association, not direct biological causation)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Target Leakage Protection & Model Specifications */}
        <div className="space-y-2 text-xs text-slate-600 border-t border-slate-200 pt-4">
          <h4 className="font-bold text-slate-800">4. Methodology & Target Leakage Prevention Statement</h4>
          <p>
            LAD, LCX, RCA and Cath were excluded from model input features to prevent target leakage. The predictive architecture utilizes 60 non-invasive clinical and ECG biomarkers trained with Stratified 5-Fold Cross-Validation on the UCI Z-Alizadeh Sani extension cohort.
          </p>
        </div>

        {/* 5. Persistent Visible Disclaimer */}
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>MANDATORY CLINICAL SAFETY NOTICE</span>
          </div>
          <p className="leading-relaxed">
            Research & Educational Decision-Support Prototype. Model outputs are estimates for demonstration purposes only and are not medical diagnoses or substitutes for professional evaluation or formal diagnostic imaging.
          </p>
          <p className="leading-relaxed">
            Prediction mapped to anatomical vessel; this does not represent measured plaque location.
          </p>
        </div>
      </div>
    </div>
  );
}
