import React, { useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  ShieldCheck,
  TrendingUp,
  Cpu,
  RefreshCw,
  FileText
} from 'lucide-react';
import { VESSEL_COLORS } from './HeartCanvas';
import ModelCard from './ModelCard';

export default function PerformanceSection({
  metricsData,
  onRefreshMetrics,
  modelCardData
}) {
  const [activeTarget, setActiveTarget] = useState('CAD');
  const [viewMode, setViewMode] = useState('model_card'); // 'model_card' | 'benchmarks'

  if (!metricsData || metricsData.status === 'pending') {
    return (
      <div className="space-y-6 pb-12">
        {/* View Mode Switcher */}
        <div className="flex items-center justify-between p-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('model_card')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'model_card'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Official Model Card</span>
            </button>
            <button
              onClick={() => setViewMode('benchmarks')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'benchmarks'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Live Benchmarks &amp; ROC</span>
            </button>
          </div>
        </div>

        {viewMode === 'model_card' ? (
          <ModelCard modelCardData={modelCardData} />
        ) : (
          <div className="hospital-card p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-600 mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Model Evaluation Pending
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Live model metrics are currently being evaluated or training pipeline has not completed. In accordance with clinical transparency rules, placeholder numbers are never displayed.
            </p>
            <button
              onClick={onRefreshMetrics}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
            >
              Check Again
            </button>
          </div>
        )}
      </div>
    );
  }

  const models = metricsData.models || {};
  const currentModel = models[activeTarget] || models.CAD;
  const metrics = currentModel?.metrics || {};
  const confusion = currentModel?.confusion_matrix || [[0, 0], [0, 0]];
  const rocCurve = currentModel?.roc_curve || [];
  const cvMetrics = currentModel?.cross_validation_5fold || {};
  const classDist = currentModel?.class_distribution || {};

  // Confusion matrix components: [[TN, FP], [FN, TP]]
  const tn = confusion[0]?.[0] ?? 0;
  const fp = confusion[0]?.[1] ?? 0;
  const fn = confusion[1]?.[0] ?? 0;
  const tp = confusion[1]?.[1] ?? 0;
  const totalTest = tn + fp + fn + tp || 1;

  return (
    <div className="space-y-6 pb-12">
      {/* Top View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setViewMode('model_card')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'model_card'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4 text-sky-500" />
            <span>Official Model Card (Specification)</span>
          </button>
          <button
            onClick={() => setViewMode('benchmarks')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'benchmarks'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-purple-500" />
            <span>Interactive Holdout Benchmarks &amp; ROC</span>
          </button>
        </div>

        <div className="text-[11px] font-mono text-slate-500 px-2">
          {viewMode === 'model_card' ? 'Displaying 13-Section Specification' : `Active Target: ${activeTarget}`}
        </div>
      </div>

      {/* Conditionally Render Model Card or Live Benchmark Visualizer */}
      {viewMode === 'model_card' ? (
        <ModelCard modelCardData={modelCardData} />
      ) : (
        <div className="space-y-6">
      {/* Header */}
      <div className="hospital-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
                GENUINE EMPIRICAL BENCHMARKS
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Model Evaluation & Validation Transparency
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Exact validation metrics evaluated on an 80/20 stratified holdout split ({classDist.test_total || 61} test cases) and 5-fold cross-validation.
            </p>
          </div>

          {/* Target Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
            {['CAD', 'LAD', 'LCX', 'RCA'].map((tgt) => {
              const isSelected = activeTarget === tgt;
              return (
                <button
                  key={tgt}
                  onClick={() => setActiveTarget(tgt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                    isSelected
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tgt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Model Meta Info */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {currentModel.target_name}
            </span>
            <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-mono font-semibold">
              Selected Algorithm: {currentModel.selected_type}
            </span>
          </div>
          <div className="text-slate-500 text-[11px] font-mono">
            Validation: {metricsData.validation_strategy}
          </div>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Accuracy', val: metrics.accuracy, desc: 'Overall correct rate on test split' },
          { label: 'Precision', val: metrics.precision, desc: 'Positive predictive value' },
          { label: 'Recall (Sens)', val: metrics.recall, desc: 'True positive rate / sensitivity' },
          { label: 'F1-Score', val: metrics.f1, desc: 'Harmonic balance of prec & recall' },
          { label: 'ROC-AUC', val: metrics.roc_auc, desc: 'Area under Receiver Operating Curve' },
        ].map((m, i) => (
          <div key={i} className="hospital-card p-4 space-y-1">
            <span className="text-[11px] font-mono uppercase text-slate-500">{m.label}</span>
            <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
              {m.val !== undefined ? (m.val * 100).toFixed(1) + '%' : 'Pending'}
            </div>
            <p className="text-[10px] text-slate-400">{m.desc}</p>
          </div>
        ))}
      </div>

      {/* Confusion Matrix and ROC Curve Dual Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CONFUSION MATRIX */}
        <div className="hospital-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-600" />
              <span>Confusion Matrix ({currentModel.selected_type} on Holdout Split)</span>
            </h3>
            <span className="text-xs font-mono text-slate-500">N = {totalTest}</span>
          </div>

          {/* 2x2 Grid */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {/* True Negative */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center space-y-1">
              <span className="text-[11px] font-mono text-slate-500 uppercase">True Negative (TN)</span>
              <div className="text-2xl font-extrabold font-mono text-slate-800 dark:text-slate-100">{tn}</div>
              <span className="text-[10px] text-emerald-600 font-medium">Correct Non-Stenosis ({((tn/totalTest)*100).toFixed(1)}%)</span>
            </div>

            {/* False Positive */}
            <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-center space-y-1">
              <span className="text-[11px] font-mono text-slate-500 uppercase">False Positive (FP)</span>
              <div className="text-2xl font-extrabold font-mono text-rose-600">{fp}</div>
              <span className="text-[10px] text-rose-600 font-medium">Type I Error ({((fp/totalTest)*100).toFixed(1)}%)</span>
            </div>

            {/* False Negative */}
            <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-center space-y-1">
              <span className="text-[11px] font-mono text-slate-500 uppercase">False Negative (FN)</span>
              <div className="text-2xl font-extrabold font-mono text-amber-600">{fn}</div>
              <span className="text-[10px] text-amber-600 font-medium">Type II Error ({((fn/totalTest)*100).toFixed(1)}%)</span>
            </div>

            {/* True Positive */}
            <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 text-center space-y-1">
              <span className="text-[11px] font-mono text-slate-500 uppercase">True Positive (TP)</span>
              <div className="text-2xl font-extrabold font-mono text-emerald-600">{tp}</div>
              <span className="text-[10px] text-emerald-600 font-medium">Correct Stenosis ({((tp/totalTest)*100).toFixed(1)}%)</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 italic">
            Evaluated at standard decision threshold p ≥ 0.50 on holdout partition.
          </p>
        </div>

        {/* ROC CURVE VISUALIZER */}
        <div className="hospital-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <span>ROC Curve (ROC-AUC = {(metrics.roc_auc || 0).toFixed(3)})</span>
            </h3>
            <span className="text-xs font-mono text-purple-600 font-bold">
              AUC: {(metrics.roc_auc || 0).toFixed(3)}
            </span>
          </div>

          {/* SVG Plot for ROC curve */}
          <div className="relative w-full h-56 bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 border border-slate-200 dark:border-slate-700 flex flex-col justify-end">
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
              {/* Reference Grid */}
              <line x1="0" y1="100" x2="100" y2="100" stroke="#cbd5e1" strokeWidth="0.8" />
              <line x1="0" y1="0" x2="0" y2="100" stroke="#cbd5e1" strokeWidth="0.8" />
              <line x1="0" y1="100" x2="100" y2="0" stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="2,2" />

              {/* Dynamic ROC Curve path from genuine points */}
              {rocCurve && rocCurve.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#7c3aed"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={rocCurve.map(pt => `${pt.fpr * 100},${100 - pt.tpr * 100}`).join(' ')}
                />
              )}
            </svg>
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1">
              <span>0% FPR (1 - Specificity)</span>
              <span>100% FPR</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Y-axis: True Positive Rate (Sensitivity)</span>
            <span>X-axis: False Positive Rate</span>
          </div>
        </div>
      </div>

      {/* Class Distribution & 5-Fold Cross Validation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 5-FOLD CROSS VALIDATION */}
        <div className="hospital-card p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-sky-600" />
            <span>Stratified 5-Fold Cross-Validation Metrics</span>
          </h3>
          <p className="text-xs text-slate-500">
            Measures generalized stability across the entire 303-patient dataset (mean ± std deviation):
          </p>
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">CV Accuracy</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {cvMetrics.accuracy_mean !== undefined ? `${(cvMetrics.accuracy_mean * 100).toFixed(1)}% ± ${(cvMetrics.accuracy_std * 100).toFixed(1)}%` : 'Pending'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">CV ROC-AUC</span>
              <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                {cvMetrics.roc_auc_mean !== undefined ? `${(cvMetrics.roc_auc_mean * 100).toFixed(1)}% ± ${(cvMetrics.roc_auc_std * 100).toFixed(1)}%` : 'Pending'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">CV F1-Score</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {cvMetrics.f1_mean !== undefined ? `${(cvMetrics.f1_mean * 100).toFixed(1)}% ± ${(cvMetrics.f1_std * 100).toFixed(1)}%` : 'Pending'}
              </span>
            </div>
          </div>
        </div>

        {/* CLASS DISTRIBUTION */}
        <div className="hospital-card p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-600" />
            <span>Cohort Class Distribution & Target Prevalence</span>
          </h3>
          <p className="text-xs text-slate-500">
            Ground-truth prevalence of {currentModel.target_name} in the UCI Extension dataset:
          </p>
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Total Cohort Records</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{classDist.total_samples || 303}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Positive Cases (≥50% Stenosis)</span>
              <span className="font-mono font-bold text-rose-600">
                {classDist.positive_cases} ({classDist.prevalence_pct}%)
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Negative Cases (&lt;50% Stenosis)</span>
              <span className="font-mono font-bold text-teal-600">
                {classDist.negative_cases} ({((classDist.negative_cases / (classDist.total_samples || 1)) * 100).toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Algorithm Benchmark Comparison Table */}
      <div className="hospital-card p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Algorithm Benchmark (Random Forest vs XGBoost)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase font-mono">
              <tr>
                <th className="py-2.5 px-3">Algorithm</th>
                <th className="py-2.5 px-3">Accuracy</th>
                <th className="py-2.5 px-3">Precision</th>
                <th className="py-2.5 px-3">Recall</th>
                <th className="py-2.5 px-3">F1-Score</th>
                <th className="py-2.5 px-3">ROC-AUC</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              <tr className={currentModel.selected_type === 'RandomForest' ? 'bg-sky-50/50 dark:bg-sky-950/20 font-bold' : ''}>
                <td className="py-2.5 px-3 font-sans">Random Forest (180 trees, depth 6)</td>
                <td className="py-2.5 px-3">{((currentModel.rf_metrics?.accuracy || 0) * 100).toFixed(1)}%</td>
                <td className="py-2.5 px-3">{((currentModel.rf_metrics?.precision || 0) * 100).toFixed(1)}%</td>
                <td className="py-2.5 px-3">{((currentModel.rf_metrics?.recall || 0) * 100).toFixed(1)}%</td>
                <td className="py-2.5 px-3">{((currentModel.rf_metrics?.f1 || 0) * 100).toFixed(1)}%</td>
                <td className="py-2.5 px-3">{((currentModel.rf_metrics?.roc_auc || 0) * 100).toFixed(1)}%</td>
                <td className="py-2.5 px-3 font-sans">
                  {currentModel.selected_type === 'RandomForest' ? (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold">Selected</span>
                  ) : (
                    <span className="text-slate-400">Benchmarked</span>
                  )}
                </td>
              </tr>
              <tr className={currentModel.selected_type === 'XGBoost' ? 'bg-sky-50/50 dark:bg-sky-950/20 font-bold' : ''}>
                <td className="py-2.5 px-3 font-sans">XGBoost (120 trees, lr 0.04)</td>
                <td className="py-2.5 px-3">{((currentModel.xgb_metrics?.accuracy || 0) * 100).toFixed(1)}%</td>
                <td className="py-2.5 px-3">{((currentModel.xgb_metrics?.precision || 0) * 100).toFixed(1)}%</td>
                <td className="py-2.5 px-3">{((currentModel.xgb_metrics?.recall || 0) * 100).toFixed(1)}%</td>
                <td className="py-2.5 px-3">{((currentModel.xgb_metrics?.f1 || 0) * 100).toFixed(1)}%</td>
                <td className="py-2.5 px-3">{((currentModel.xgb_metrics?.roc_auc || 0) * 100).toFixed(1)}%</td>
                <td className="py-2.5 px-3 font-sans">
                  {currentModel.selected_type === 'XGBoost' ? (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold">Selected</span>
                  ) : (
                    <span className="text-slate-400">Benchmarked</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      </div>
      )}
    </div>
  );
}
