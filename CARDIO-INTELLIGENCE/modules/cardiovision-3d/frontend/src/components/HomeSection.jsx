import React from 'react';
import {
  Heart,
  Activity,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Database,
  BarChart3,
  Layers,
  HelpCircle,
  Cpu,
  Eye,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { VESSEL_COLORS } from './HeartCanvas';

export default function HomeSection({
  onNavigate,
  onRunAssessment,
  metricsData,
  predictionData
}) {
  const hasPrediction = Boolean(predictionData?.overall_cad);
  const cadPct = hasPrediction ? predictionData.overall_cad.percentage : null;
  const ladPct = hasPrediction ? predictionData.vessels?.LAD?.percentage : null;
  const lcxPct = hasPrediction ? predictionData.vessels?.LCX?.percentage : null;
  const rcaPct = hasPrediction ? predictionData.vessels?.RCA?.percentage : null;

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950 text-white p-6 sm:p-10 border border-slate-800 shadow-xl">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-rose-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-80 h-80 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
            <span>Hackathon Prototype • Leakage-Audited AI Architecture</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            CardioVision AI
          </h1>
          <p className="text-lg sm:text-xl font-medium text-rose-200/90">
            AI-Assisted Cardiovascular Decision-Support Prototype
          </p>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
            Predicts overall coronary artery disease (CAD) risk and vessel-specific stenosis probabilities (LAD, LCX, RCA), mapped to interactive 3D coronary anatomy with transparent TreeSHAP explainability.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate('assessment')}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 flex items-center gap-2 transition-all hover:gap-3"
            >
              <span>Patient Assessment</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate('anatomy')}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 transition-colors"
            >
              <Heart className="w-4 h-4 text-rose-400" />
              <span>3D Coronary Anatomy</span>
            </button>
            <button
              onClick={() => onNavigate('performance')}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 transition-colors"
            >
              <BarChart3 className="w-4 h-4 text-sky-400" />
              <span>Model Performance</span>
            </button>
          </div>
        </div>

        {/* Live Model-Estimated Territory Ribbon */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Overall CAD</span>
            <div className="text-xl sm:text-2xl font-bold font-mono text-rose-400">
              {cadPct != null ? `${cadPct}%` : 'Pending'}
            </div>
            <span className="text-[10px] text-slate-400">Model-estimated probability</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: VESSEL_COLORS.LAD }} />
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">LAD Territory</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-rose-400">
              {ladPct != null ? `${ladPct}%` : 'Pending'}
            </div>
            <span className="text-[10px] text-slate-400">Predicted stenosis prob</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: VESSEL_COLORS.LCX }} />
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">LCX Territory</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-teal-400">
              {lcxPct != null ? `${lcxPct}%` : 'Pending'}
            </div>
            <span className="text-[10px] text-slate-400">Predicted stenosis prob</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: VESSEL_COLORS.RCA }} />
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">RCA Territory</span>
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-amber-400">
              {rcaPct != null ? `${rcaPct}%` : 'Pending'}
            </div>
            <span className="text-[10px] text-slate-400">Predicted stenosis prob</span>
          </div>
        </div>
      </div>

      {/* JUDGE-FIRST 30-SECOND EXECUTIVE OVERVIEW */}
      <div className="hospital-card p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-sky-100 text-sky-800 border border-sky-200">
                JUDGE-FIRST 30s OVERVIEW
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Project Architecture at a Glance
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Engineered for scientific credibility, strict target-leakage protection, and transparent multimodal AI.
            </p>
          </div>
          <button
            onClick={() => onNavigate('methodology')}
            className="text-xs font-semibold text-sky-700 hover:text-sky-800 flex items-center gap-1 self-start sm:self-auto"
          >
            <span>Read full methodology</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 5 Core Pillars: WHAT, HOW, OUTPUT, WHY, WHERE */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* WHAT */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                WHAT?
              </span>
              <Heart className="w-4 h-4 text-rose-600" />
            </div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">CAD & Stenosis Estimation</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Non-invasive estimation of overall CAD and branch-level stenosis (≥50%) across the three primary coronary arteries: LAD, LCX, and RCA.
            </p>
          </div>

          {/* HOW */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300">
                HOW?
              </span>
              <Cpu className="w-4 h-4 text-sky-600" />
            </div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">Leakage-Audited ML</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              55 candidate clinical inputs (from 59 raw attributes minus 4 targets) fed into Random Forest & XGBoost classifiers. Outcome proxies (LAD, LCX, RCA, Cath) are strictly excluded from inputs.
            </p>
          </div>

          {/* OUTPUT */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                OUTPUT?
              </span>
              <Activity className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">Continuous Probabilities</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Model-estimated probabilities (not categorical diagnoses) for Overall CAD, LAD, LCX, and RCA with confidence bounds and educational risk context.
            </p>
          </div>

          {/* WHY */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                WHY?
              </span>
              <Sparkles className="w-4 h-4 text-purple-600" />
            </div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">TreeSHAP Explainability</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Calculates additive local feature attributions per inference, displaying directional contribution (+/-) while clearly distinguishing statistical attribution from clinical causation.
            </p>
          </div>

          {/* WHERE */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                WHERE?
              </span>
              <Layers className="w-4 h-4 text-emerald-600" />
            </div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white">Interactive 3D Mapping</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Probabilities are registered directly to an open-source 3D coronary anatomy with multi-view controls (Anterior, Lateral, Inferior) and persistent plaque disclaimer.
            </p>
          </div>
        </div>

        {/* Compact "How It Works" Pipeline Diagram */}
        <div className="pt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
            Pipeline Architecture Flow
          </h3>
          <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/70 text-xs">
            <span className="px-2 py-1 rounded bg-white dark:bg-slate-900 font-mono font-semibold shadow-2xs">
              UCI Cohort (303 pts)
            </span>
            <span className="text-slate-400 font-mono">→</span>
            <span className="px-2 py-1 rounded bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-mono font-semibold border border-rose-200 dark:border-rose-900">
              Drop Leakage (Cath, LAD, LCX, RCA)
            </span>
            <span className="text-slate-400 font-mono">→</span>
            <span className="px-2 py-1 rounded bg-white dark:bg-slate-900 font-mono font-semibold shadow-2xs">
              Scale 60 Features
            </span>
            <span className="text-slate-400 font-mono">→</span>
            <span className="px-2 py-1 rounded bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-mono font-semibold">
              RF (CAD, LAD) / XGB (LCX, RCA)
            </span>
            <span className="text-slate-400 font-mono">→</span>
            <span className="px-2 py-1 rounded bg-purple-50 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-mono font-semibold">
              TreeSHAP Attribution
            </span>
            <span className="text-slate-400 font-mono">→</span>
            <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-mono font-semibold">
              3D Anatomy Projection
            </span>
          </div>
        </div>
      </div>

      {/* Target Leakage Audit Summary Badge */}
      <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-100">
              Verified Target-Leakage Protection
            </h4>
            <p className="text-xs text-emerald-900/90 dark:text-emerald-200/90">
              <strong>Methodology Compliance:</strong> LAD, LCX, RCA and Cath were excluded from model input features to prevent target leakage. The model operates exclusively on non-invasive biomarkers.
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('methodology')}
          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors"
        >
          View Leakage Audit
        </button>
      </div>

      {/* Navigation Quick Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div
          onClick={() => onNavigate('assessment')}
          className="hospital-card hospital-card-hover p-5 cursor-pointer space-y-3 group"
        >
          <div className="w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-950 flex items-center justify-center text-rose-600">
            <Activity className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-rose-600 transition-colors">
            1. Patient Assessment
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Enter demographics, vitals, lab biomarkers, ECG, and echocardiography with input validation or choose from verified demonstration scenarios.
          </p>
          <span className="text-xs font-semibold text-rose-600 flex items-center gap-1">
            <span>Configure Patient</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>

        <div
          onClick={() => onNavigate('anatomy')}
          className="hospital-card hospital-card-hover p-5 cursor-pointer space-y-3 group"
        >
          <div className="w-9 h-9 rounded-lg bg-sky-100 dark:bg-sky-950 flex items-center justify-center text-sky-600">
            <Heart className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-sky-600 transition-colors">
            2. 3D Coronary Anatomy
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Examine model predictions mapped onto the 3D heart. Orbit, zoom, pan, switch to Anterior/Lateral/Inferior views, and select vessels.
          </p>
          <span className="text-xs font-semibold text-sky-600 flex items-center gap-1">
            <span>Inspect 3D Heart</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>

        <div
          onClick={() => onNavigate('explainability')}
          className="hospital-card hospital-card-hover p-5 cursor-pointer space-y-3 group"
        >
          <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-950 flex items-center justify-center text-purple-600">
            <Sparkles className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors">
            3. SHAP Explainability
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Discover why the model made each prediction using genuine TreeSHAP values showing exact feature contributions and directions.
          </p>
          <span className="text-xs font-semibold text-purple-600 flex items-center gap-1">
            <span>Review Explanations</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>
      </div>
    </div>
  );
}
