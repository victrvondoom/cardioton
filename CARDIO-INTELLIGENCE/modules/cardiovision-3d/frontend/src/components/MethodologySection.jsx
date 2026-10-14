import React, { useState } from 'react';
import {
  GitBranch,
  ShieldCheck,
  Database,
  Layers,
  Cpu,
  CheckCircle2,
  FileCode,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  FileText
} from 'lucide-react';
import ModelCard from './ModelCard';

export default function MethodologySection({
  methodologyData,
  featuresCatalog,
  modelCardData
}) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState('methodology'); // 'methodology' | 'model_card'

  const pipelineStages = methodologyData?.pipeline_stages || [
    { step: 1, name: 'Dataset Ingestion', detail: 'UCI Extension of Z-Alizadeh Sani Dataset (303 records, 59 raw clinical attributes).' },
    { step: 2, name: 'Target-Leakage Protection', detail: 'Strict exclusion of LAD, LCX, RCA, Cath, and CAD from the feature matrix X before scaling and model training.' },
    { step: 3, name: 'Preprocessing & Encoding', detail: 'Binary mapping of clinical variables, one-hot encoding for BBB and VHD, StandardScaler fit strictly on training splits.' },
    { step: 4, name: 'Target Definitions', detail: 'Angiographically validated stenosis (>=50% diameter reduction) for CAD, LAD, LCX, and RCA.' },
    { step: 5, name: 'Model Training & Selection', detail: 'Parallel training of Random Forest (180 trees) and XGBoost (120 trees) with class weighting for imbalanced targets.' },
    { step: 6, name: 'Stratified Validation', detail: '80/20 holdout split stratified by target + 5-fold cross-validation for stability assessment.' },
    { step: 7, name: 'Explainability Engine', detail: 'TreeSHAP (Lundberg et al.) calculates exact additive feature attribution (direction + magnitude) per inference.' },
    { step: 8, name: '3D Anatomical Mapping', detail: 'Probabilities mapped to interactive 3D coronary mesh with visual territory highlighting and disclaimer.' }
  ];

  const catalog = featuresCatalog?.catalog || {};
  const featureNames = featuresCatalog?.feature_names || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Top View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setViewMode('methodology')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'methodology'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <GitBranch className="w-4 h-4 text-sky-500" />
            <span>Pipeline Methodology &amp; Feature Audit</span>
          </button>
          <button
            onClick={() => setViewMode('model_card')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'model_card'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4 text-indigo-500" />
            <span>Official Model Card</span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-slate-500 px-2">
          {viewMode === 'model_card' ? 'Displaying 13-Section Specification' : '8-Stage Pipeline Flowchart'}
        </div>
      </div>

      {viewMode === 'model_card' ? (
        <ModelCard modelCardData={modelCardData} />
      ) : (
        <div className="space-y-6">
      {/* Header */}
      <div className="hospital-card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-950 dark:text-sky-300">
            SCIENTIFIC REPRODUCIBILITY
          </span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            End-to-End Pipeline & Dataset Methodology
          </h2>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed max-w-4xl">
          Documenting every phase from raw data ingestion to target-leakage prevention, continuous scaling, parallel model selection, TreeSHAP attribution, and 3D mesh coordinate mapping.
        </p>
      </div>

      {/* TARGET-LEAKAGE PROTECTION AUDIT (Section 3) */}
      <div className="hospital-card p-6 border-l-4 border-l-emerald-500 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Target-Leakage Protection Audit
            </h3>
            <p className="text-xs text-slate-500">
              Strict compliance requirement: Direct catheterization outcomes and branch stenosis targets must never enter model inputs.
            </p>
          </div>
        </div>

        {/* Mandatory Requirement Statement */}
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
            "Target leakage audit: LAD, LCX, RCA, Cath, and CAD are excluded from model inputs. Feature construction was audited for direct and indirect target leakage."
          </p>
          <p className="text-xs text-emerald-800/90 dark:text-emerald-200/90 mt-1">
            Programmatic runtime assertions in <code className="px-1 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 font-mono text-[11px]">train_models.py</code> and FastAPI <code className="px-1 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 font-mono text-[11px]">/predict</code> guarantee that none of these columns, target-derived variables, or post-catheterization outcomes enter the feature matrix.
          </p>
        </div>

        {/* Excluded Columns List */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Excluded Outcome Columns:
          </span>
          <div className="flex flex-wrap gap-2">
            {['LAD', 'LCX', 'RCA', 'Cath', 'CAD'].map((col) => (
              <span
                key={col}
                className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-900 flex items-center gap-1.5"
              >
                <span>✕</span>
                <span>{col} (Excluded Invasive Outcome)</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* FEATURE COUNT RECONCILIATION AUDIT */}
      <div className="hospital-card p-6 border-l-4 border-l-sky-500 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950 flex items-center justify-center text-sky-600 shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Feature Count Reconciliation Audit (59 → 55 → 60)
            </h3>
            <p className="text-xs text-slate-500">
              Precise mathematical breakdown resolving raw dataset columns, excluded targets, candidate inputs, and encoded pipeline features.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 font-medium block text-[11px]">A. Raw CSV Columns</span>
            <span className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1 block">59</span>
            <span className="text-[10px] text-slate-400">Total in UCI file</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 font-medium block text-[11px]">B. Target Columns</span>
            <span className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1 block">4</span>
            <span className="text-[10px] text-slate-400">LAD, LCX, RCA, Cath</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 font-medium block text-[11px]">C. Candidate Inputs</span>
            <span className="text-xl font-bold font-mono text-sky-600 dark:text-sky-400 mt-1 block">55</span>
            <span className="text-[10px] text-slate-400">59 - 4 = 55 inputs</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 font-medium block text-[11px]">D. Cleaned Features</span>
            <span className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1 block">55</span>
            <span className="text-[10px] text-slate-400">53 num + 2 cat</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 font-medium block text-[11px]">E. Transformed Total</span>
            <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">60</span>
            <span className="text-[10px] text-slate-400">53 num + 7 OHE</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-500 font-medium block text-[11px]">F. Engineered Total</span>
            <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1 block">0</span>
            <span className="text-[10px] text-slate-400">Zero synthetic proxies</span>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          <strong className="text-slate-800 dark:text-slate-200">Reconciliation Note: </strong>
          The raw UCI CSV contains exactly 59 columns. Catheterization targets (LAD, LCX, RCA, and Cath) account for 4 columns, leaving exactly 55 candidate clinical input features before encoding. (CAD is a clinical target synonym representing Cath == 'CAD', not an additional 5th CSV column). When transformed by the ColumnTransformer, the 53 numeric/binary features remain 53 scaled features, while the 2 categorical features (BBB with 3 levels, VHD with 4 levels) expand via one-hot encoding into 7 binary indicators (53 + 7 = 60 transformed features). Zero features are artificially engineered.
        </div>
      </div>

      {/* 8-Stage Pipeline Flowchart (Section 12) */}
      <div className="hospital-card p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Complete Pipeline Flowchart
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {pipelineStages.map((stage) => (
            <div
              key={stage.step}
              className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-sky-600 dark:text-sky-400">
                  STAGE {stage.step}
                </span>
                <span className="w-2 h-2 rounded-full bg-sky-500" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                {stage.name}
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {stage.detail}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Dataset Specifications & Target Definitions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* DATASET SPECIFICATIONS */}
        <div className="hospital-card p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-sky-600" />
            <span>Dataset Specifications</span>
          </h3>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Dataset Source</span>
              <span className="font-mono text-slate-900 dark:text-white">UCI ML Repository (Dataset #411)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Cohort Size</span>
              <span className="font-mono text-slate-900 dark:text-white">303 Patient Records</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Raw Columns Count</span>
              <span className="font-mono text-slate-900 dark:text-white">59 Columns (4 Targets + 55 Inputs)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Transformed Features</span>
              <span className="font-mono text-slate-900 dark:text-white">60 Transformed Features (0 Engineered)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Ground Truth Standard</span>
              <span className="font-mono text-slate-900 dark:text-white">Coronary Angiography (Cath)</span>
            </div>
          </div>
        </div>

        {/* TARGET DEFINITIONS */}
        <div className="hospital-card p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-600" />
            <span>Target Definitions (≥50% Stenosis)</span>
          </h3>
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-700 dark:text-rose-400 font-mono">Overall CAD (Cath)</span>
                <span className="text-[11px] text-slate-400">Prevalence: 71.3% (216/303)</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                Lumen diameter reduction ≥ 50% in at least one of LAD, LCX, RCA, or diffuse multivessel involvement.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-600 font-mono">LAD Stenosis (≥50%)</span>
                <span className="text-[11px] text-slate-400">Prevalence: 58.4% (177/303)</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                Angiographically confirmed ≥50% diameter reduction in the Left Anterior Descending artery.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-teal-600 font-mono">LCX Stenosis (≥50%)</span>
                <span className="text-[11px] text-slate-400">Prevalence: 39.3% (119/303)</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                Angiographically confirmed ≥50% diameter reduction in the Left Circumflex artery branch.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-600 font-mono">RCA Stenosis (≥50%)</span>
                <span className="text-[11px] text-slate-400">Prevalence: 37.6% (114/303)</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                Angiographically confirmed ≥50% diameter reduction in the Right Coronary artery branch.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FINAL FEATURE LIST & AUDITABLE INVENTORY */}
      <div className="hospital-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Final Feature List Used by the Model ({featureNames.length || 60} Transformed Features • 0 Engineered Features)
            </h3>
            <p className="text-xs text-slate-500">
              Zero leakage outcome columns. All features are non-invasive clinical, physiological, and lab indicators.
            </p>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {['All', ...Object.keys(catalog)].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  selectedCategory === cat
                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto pr-1">
          {featureNames.map((feat, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between text-xs"
            >
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                {feat}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                #{idx + 1}
              </span>
            </div>
          ))}
        </div>
      </div>
      </div>
      )}
    </div>
  );
}
