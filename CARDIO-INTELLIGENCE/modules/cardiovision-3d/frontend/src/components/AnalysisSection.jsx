import React from 'react';
import {
  Activity,
  Heart,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Info,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { VESSEL_COLORS } from './HeartCanvas';

export default function AnalysisSection({
  predictionData,
  onNavigate,
  onSelectVessel
}) {
  if (!predictionData?.overall_cad) {
    return (
      <div className="hospital-card p-12 text-center space-y-4 my-8">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 flex items-center justify-center mx-auto text-rose-600">
          <Heart className="w-6 h-6 animate-pulse" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          No AI Assessment Performed Yet
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          Patient biomarkers must be evaluated through the trained machine learning pipeline before model-estimated probabilities and vessel stenosis predictions can be displayed.
        </p>
        <button
          onClick={() => onNavigate('assessment')}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-sm inline-flex items-center gap-2"
        >
          <span>Open Patient Assessment</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const overall = predictionData.overall_cad;
  const vessels = predictionData.vessels || {};
  const summary = predictionData.summary || {};

  const getTierBadge = (tier) => {
    switch (tier?.toLowerCase()) {
      case 'high':
        return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300';
      case 'moderate':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Overview Header */}
      <div className="hospital-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300">
                AI ASSESSMENT RESULTS
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Coronary Artery Disease & Vessel-Level Predictions
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Probabilities represent mathematical estimates from the trained XGBoost and Random Forest classifiers on the UCI cohort.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => onNavigate('anatomy')}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Heart className="w-3.5 h-3.5" />
              <span>Map to 3D Anatomy</span>
            </button>
            <button
              onClick={() => onNavigate('explainability')}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Why This Prediction?</span>
            </button>
          </div>
        </div>

        {/* Anatomical & Educational Disclaimer */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
          <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              Model Prediction Context & Plaque Disclaimer:
            </p>
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Predictions are vessel-level likelihood estimates of significant lumen narrowing (≥50% diameter stenosis) based on clinical and ECG correlates. 
              <strong> These are model predictions and NOT direct anatomical measurements.</strong> The model does not detect the exact physical location of plaque within the artery.
            </p>
          </div>
        </div>
      </div>

      {/* Target Displays: Overall CAD + 3 Vessels */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {/* OVERALL CAD CARD */}
        <div className="hospital-card p-6 border-l-4 border-l-rose-500 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              Overall CAD
            </span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getTierBadge(overall.risk_tier)}`}>
              {overall.risk_tier} Probability
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white">
              {overall.percentage}%
            </div>
            <div className="text-xs font-medium text-slate-500">
              Model-estimated probability
            </div>
          </div>

          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-rose-600 h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, overall.percentage)}%` }}
            />
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
            Estimated likelihood of ≥50% angiographic stenosis in at least one major coronary branch.
          </p>
        </div>

        {/* LAD CARD */}
        <div
          onClick={() => {
            onSelectVessel('LAD');
            onNavigate('anatomy');
          }}
          className="hospital-card hospital-card-hover p-6 border-l-4 cursor-pointer space-y-4 group"
          style={{ borderLeftColor: VESSEL_COLORS.LAD }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: VESSEL_COLORS.LAD }} />
              <span className="text-xs font-mono font-bold text-slate-900 dark:text-white group-hover:text-rose-600 transition-colors">
                LAD
              </span>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getTierBadge(vessels.LAD?.risk_tier)}`}>
              {vessels.LAD?.risk_tier}
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white">
              {vessels.LAD?.percentage}%
            </div>
            <div className="text-xs font-medium text-slate-500">
              Predicted stenosis probability
            </div>
          </div>

          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, vessels.LAD?.percentage || 0)}%`,
                backgroundColor: VESSEL_COLORS.LAD
              }}
            />
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between text-[11px] text-slate-500">
            <span>Anterior Territory</span>
            <span className="font-semibold text-rose-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              3D View <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* LCX CARD */}
        <div
          onClick={() => {
            onSelectVessel('LCX');
            onNavigate('anatomy');
          }}
          className="hospital-card hospital-card-hover p-6 border-l-4 cursor-pointer space-y-4 group"
          style={{ borderLeftColor: VESSEL_COLORS.LCX }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: VESSEL_COLORS.LCX }} />
              <span className="text-xs font-mono font-bold text-slate-900 dark:text-white group-hover:text-teal-600 transition-colors">
                LCX
              </span>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getTierBadge(vessels.LCX?.risk_tier)}`}>
              {vessels.LCX?.risk_tier}
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white">
              {vessels.LCX?.percentage}%
            </div>
            <div className="text-xs font-medium text-slate-500">
              Predicted stenosis probability
            </div>
          </div>

          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, vessels.LCX?.percentage || 0)}%`,
                backgroundColor: VESSEL_COLORS.LCX
              }}
            />
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between text-[11px] text-slate-500">
            <span>Lateral Territory</span>
            <span className="font-semibold text-teal-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              3D View <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* RCA CARD */}
        <div
          onClick={() => {
            onSelectVessel('RCA');
            onNavigate('anatomy');
          }}
          className="hospital-card hospital-card-hover p-6 border-l-4 cursor-pointer space-y-4 group"
          style={{ borderLeftColor: VESSEL_COLORS.RCA }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: VESSEL_COLORS.RCA }} />
              <span className="text-xs font-mono font-bold text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors">
                RCA
              </span>
            </div>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getTierBadge(vessels.RCA?.risk_tier)}`}>
              {vessels.RCA?.risk_tier}
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-3xl font-extrabold font-mono text-slate-900 dark:text-white">
              {vessels.RCA?.percentage}%
            </div>
            <div className="text-xs font-medium text-slate-500">
              Predicted stenosis probability
            </div>
          </div>

          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, vessels.RCA?.percentage || 0)}%`,
                backgroundColor: VESSEL_COLORS.RCA
              }}
            />
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between text-[11px] text-slate-500">
            <span>Inferior Territory</span>
            <span className="font-semibold text-amber-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
              3D View <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>

      {/* Decision-Support Synthesis Panel */}
      <div className="hospital-card p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          AI Decision-Support Synthesis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              High-Probability Target Vessels
            </span>
            <div className="flex flex-wrap gap-2 pt-1">
              {summary.high_probability_vessels && summary.high_probability_vessels.length > 0 ? (
                summary.high_probability_vessels.map((v) => (
                  <span
                    key={v}
                    className="px-2.5 py-1 rounded-md text-xs font-mono font-bold border"
                    style={{
                      backgroundColor: `${VESSEL_COLORS[v]}15`,
                      color: VESSEL_COLORS[v],
                      borderColor: `${VESSEL_COLORS[v]}40`
                    }}
                  >
                    {v} Territory (≥50% Probability)
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500">None detected with ≥50% probability</span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 pt-1">
              {summary.ai_assessment_summary}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Educational Decision-Support Context
            </span>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
              {predictionData?.summary?.clinical_recommendation || 
                'Educational Decision-Support: Model probability correlates with elevated risk. For formal evaluation, clinical correlation and formal diagnostic imaging are required.'}
            </p>
            <p className="text-[10px] text-slate-400 italic">
              Notice: This system does not generate medical orders, prescriptions, or invasive treatment decisions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
