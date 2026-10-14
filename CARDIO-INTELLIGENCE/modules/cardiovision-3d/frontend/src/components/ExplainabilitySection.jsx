import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Info,
  AlertTriangle,
  Layers,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Play,
  Search,
  ChevronDown,
  ChevronUp,
  Sliders,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { VESSEL_COLORS } from './HeartCanvas';

export default function ExplainabilitySection({
  predictionData,
  predictionError,
  selectedVessel,
  onSelectVessel,
  onNavigate
}) {
  const [activeTarget, setActiveTarget] = useState('CAD');
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Synchronize active tab when selectedVessel is passed from 3D viewer or parent
  useEffect(() => {
    if (selectedVessel && ['LAD', 'LCX', 'RCA'].includes(selectedVessel)) {
      setActiveTarget(selectedVessel);
    } else if (selectedVessel === 'CAD' || selectedVessel === null) {
      setActiveTarget('CAD');
    }
  }, [selectedVessel]);

  // Extract real SHAP values from the live prediction payload
  const hasPrediction = Boolean(predictionData?.overall_cad);
  const cadData = predictionData?.overall_cad;
  const ladData = predictionData?.vessels?.LAD;
  const lcxData = predictionData?.vessels?.LCX;
  const rcaData = predictionData?.vessels?.RCA;

  const targetMap = useMemo(() => ({
    CAD: {
      key: 'CAD',
      name: 'Overall Coronary Artery Disease (CAD)',
      shortName: 'CAD',
      targetDefinition: 'Binary classification: Presence of significant CAD (stenosis ≥ 50% in ≥ 1 vessel)',
      estimatorName: 'RandomForestClassifier (180 trees, max_depth=6)',
      outputSpace: cadData?.shap_output_space || 'probability',
      baseValue: cadData?.shap_base_value ?? 0.5006,
      sumShap: cadData?.shap_sum ?? 0,
      color: '#e11d48',
      prob: cadData?.percentage,
      probVal: cadData?.probability,
      riskTier: cadData?.risk_tier,
      topFeatures: cadData?.top_shap_features || [],
      allFeatures: cadData?.all_shap_features || cadData?.top_shap_features || [],
      desc: 'Overall patient-level CAD probability and underlying additive feature attributions'
    },
    LAD: {
      key: 'LAD',
      name: 'Left Anterior Descending Artery (LAD)',
      shortName: 'LAD',
      targetDefinition: 'Binary classification: LAD stenosis ≥ 50%',
      estimatorName: 'RandomForestClassifier (180 trees, max_depth=6)',
      outputSpace: ladData?.shap_output_space || 'probability',
      baseValue: ladData?.shap_base_value ?? 0.5022,
      sumShap: ladData?.shap_sum ?? 0,
      color: VESSEL_COLORS.LAD,
      prob: ladData?.percentage,
      probVal: ladData?.probability,
      riskTier: ladData?.risk_tier,
      territory: ladData?.territory || 'Anterior left ventricular wall, apex, anterior 2/3 of interventricular septum',
      topFeatures: ladData?.top_shap_features || [],
      allFeatures: ladData?.all_shap_features || ladData?.top_shap_features || [],
      desc: 'Target-specific TreeSHAP attributions for LAD arterial branch'
    },
    LCX: {
      key: 'LCX',
      name: 'Left Circumflex Artery (LCX)',
      shortName: 'LCX',
      targetDefinition: 'Binary classification: LCX stenosis ≥ 50%',
      estimatorName: 'XGBClassifier (120 trees, max_depth=4, lr=0.04)',
      outputSpace: lcxData?.shap_output_space || 'raw_log_odds',
      baseValue: lcxData?.shap_base_value ?? 0.0396,
      sumShap: lcxData?.shap_sum ?? 0,
      color: VESSEL_COLORS.LCX,
      prob: lcxData?.percentage,
      probVal: lcxData?.probability,
      riskTier: lcxData?.risk_tier,
      territory: lcxData?.territory || 'Posterolateral left ventricle, obtuse marginal branches',
      topFeatures: lcxData?.top_shap_features || [],
      allFeatures: lcxData?.all_shap_features || lcxData?.top_shap_features || [],
      desc: 'Target-specific TreeSHAP attributions for LCX arterial branch'
    },
    RCA: {
      key: 'RCA',
      name: 'Right Coronary Artery (RCA)',
      shortName: 'RCA',
      targetDefinition: 'Binary classification: RCA stenosis ≥ 50%',
      estimatorName: 'XGBClassifier (120 trees, max_depth=4, lr=0.04)',
      outputSpace: rcaData?.shap_output_space || 'raw_log_odds',
      baseValue: rcaData?.shap_base_value ?? 0.0639,
      sumShap: rcaData?.shap_sum ?? 0,
      color: VESSEL_COLORS.RCA,
      prob: rcaData?.percentage,
      probVal: rcaData?.probability,
      riskTier: rcaData?.risk_tier,
      territory: rcaData?.territory || 'Right ventricular free wall, inferior myocardial wall, posterior descending artery',
      topFeatures: rcaData?.top_shap_features || [],
      allFeatures: rcaData?.all_shap_features || rcaData?.top_shap_features || [],
      desc: 'Target-specific TreeSHAP attributions for RCA arterial branch'
    },
  }), [cadData, ladData, lcxData, rcaData]);

  const current = targetMap[activeTarget] || targetMap.CAD;

  // Select feature list based on showAllFeatures toggle
  const rawFeaturesList = showAllFeatures ? current.allFeatures : current.topFeatures;

  // Filter features if searchQuery is present
  const featuresList = useMemo(() => {
    if (!searchQuery.trim()) return rawFeaturesList;
    const q = searchQuery.toLowerCase();
    return current.allFeatures.filter(f =>
      f.feature.toLowerCase().includes(q) ||
      (f.raw_feature_parent && f.raw_feature_parent.toLowerCase().includes(q))
    );
  }, [rawFeaturesList, current.allFeatures, searchQuery]);

  // Compute maximum absolute magnitude for proportional bar widths
  const maxMag = Math.max(
    ...featuresList.map(f => Math.abs(f.shap_value || 0)),
    0.001
  );

  const handleTargetChange = (tgt) => {
    setActiveTarget(tgt);
    if (tgt === 'CAD') {
      if (onSelectVessel) onSelectVessel(null);
    } else {
      if (onSelectVessel) onSelectVessel(tgt);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Top Header Card */}
      <div className="hospital-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-purple-100 text-purple-800 border border-purple-200 dark:bg-purple-950 dark:text-purple-300">
                TRANSPARENT AI • TREESHAP
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                "Why this prediction?" — Feature Attribution Engine
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Live, patient-specific local feature explanations computed via TreeSHAP (Lundberg et al.) on the trained models for each distinct prediction target.
            </p>
          </div>

          {/* Target Selector Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
            {['CAD', 'LAD', 'LCX', 'RCA'].map((tgt) => {
              const isSelected = activeTarget === tgt;
              const tgtInfo = targetMap[tgt];
              return (
                <button
                  key={tgt}
                  onClick={() => handleTargetChange(tgt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  aria-label={`Select ${tgt} target explanation`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: tgtInfo.color }}
                  />
                  <span>{tgt}</span>
                  {tgtInfo.prob != null && (
                    <span className="text-[10px] opacity-75 font-normal">
                      {tgtInfo.prob}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Prominent Mandatory SHAP Disclaimer */}
        <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-purple-950 dark:text-purple-200">
            <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
            <span>CRITICAL SCIENTIFIC DISTINCTION: Model Contribution vs. Clinical Causation</span>
          </div>
          <p className="text-purple-900 dark:text-purple-300 font-medium">
            <strong>"SHAP values describe how input features contributed to the model prediction. They do not establish biological causation or constitute a clinical diagnosis."</strong>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-purple-900 dark:text-purple-300 pt-1">
            <div className="p-2.5 rounded-lg bg-white/60 dark:bg-slate-900/60 border border-purple-200 dark:border-purple-800">
              <span className="font-semibold block mb-0.5 text-purple-950 dark:text-purple-100">
                Positive Model Contribution (+):
              </span>
              Pushes the model prediction toward the positive class (stenosis / CAD) relative to the training distribution baseline.
            </div>
            <div className="p-2.5 rounded-lg bg-white/60 dark:bg-slate-900/60 border border-purple-200 dark:border-purple-800">
              <span className="font-semibold block mb-0.5 text-purple-950 dark:text-purple-100">
                Negative Model Contribution (-):
              </span>
              Pushes the model prediction away from the positive class (toward absence of stenosis) relative to the training distribution baseline.
            </div>
          </div>
        </div>
      </div>

      {/* 2. Target Context & Output Space Decomposition Card */}
      <div className="hospital-card p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: current.color }}
              />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {current.name}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {current.estimatorName}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {current.targetDefinition}
              {current.territory && (
                <span className="block text-[11px] text-slate-400 mt-0.5">
                  Territory: {current.territory}
                </span>
              )}
            </p>
          </div>

          {/* Current Probability Badge */}
          <div className="flex items-center gap-3">
            {hasPrediction && current.prob != null ? (
              <div className="text-right">
                <span className="text-[11px] uppercase font-mono text-slate-400 block">
                  Model Prediction
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                    {current.prob}%
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      current.riskTier === 'High'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : current.riskTier === 'Moderate'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}
                  >
                    {current.riskTier} Risk
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 italic">
                Awaiting Assessment
              </div>
            )}
          </div>
        </div>

        {/* Mathematical Output Space Breakdown (Section 10 & 11) */}
        {hasPrediction && (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                <span>Model Output Space:</span>
                <span className="font-mono text-purple-600 dark:text-purple-400 uppercase">
                  {current.outputSpace === 'probability' ? 'Probability Space (Random Forest)' : 'Margin / Log-Odds Space (XGBoost)'}
                </span>
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                60 Transformed Features
              </span>
            </div>

            {current.outputSpace === 'probability' ? (
              <div className="space-y-1.5 text-slate-600 dark:text-slate-400">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    Base Expected Rate 𝔼[f(x)]: <strong>{current.baseValue}</strong>
                  </span>
                  <span>+</span>
                  <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    Net Feature SHAP Σφᵢ: <strong>{current.sumShap >= 0 ? `+${current.sumShap}` : current.sumShap}</strong>
                  </span>
                  <span>=</span>
                  <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold">
                    Estimated Probability: {current.probVal} ({current.prob}%)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Because this target is modeled with Random Forest, TreeSHAP operates directly in continuous probability space. The base value represents the cohort prior probability, and local feature attributions sum additively to the model output.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 text-slate-600 dark:text-slate-400">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    Base Log-Odds 𝔼[f(x)]: <strong>{current.baseValue >= 0 ? `+${current.baseValue}` : current.baseValue}</strong>
                  </span>
                  <span>+</span>
                  <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    Net Feature SHAP Σφᵢ: <strong>{current.sumShap >= 0 ? `+${current.sumShap}` : current.sumShap}</strong>
                  </span>
                  <span>=</span>
                  <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-bold">
                    Margin: {(current.baseValue + current.sumShap).toFixed(4)}
                  </span>
                  <span>→ σ(margin) =</span>
                  <span className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold">
                    Estimated Probability: {current.probVal} ({current.prob}%)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Because this target is modeled with XGBoost, TreeSHAP computes additivity in margin (log-odds) space. The base margin plus feature contributions produce the total margin, which is converted to predicted probability via the standard logistic sigmoid function.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. SHAP Feature Attribution Visualization */}
      <div className="hospital-card p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {showAllFeatures ? 'All 60 Transformed Feature Attributions' : 'Top Influential Features'} for {current.shortName}
              </h3>
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Ranked by |SHAP| Magnitude
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Features with larger absolute SHAP values exerted greater mathematical influence on this patient's prediction.
            </p>
          </div>

          {/* Direction Legend */}
          <div className="flex items-center gap-4 text-xs font-medium self-start sm:self-auto">
            <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
              <span className="w-2.5 h-2.5 rounded bg-rose-500" />
              <span>Pushes Prediction Higher (+)</span>
            </div>
            <div className="flex items-center gap-1.5 text-teal-600 dark:text-teal-400">
              <span className="w-2.5 h-2.5 rounded bg-teal-500" />
              <span>Pushes Prediction Lower (-)</span>
            </div>
          </div>
        </div>

        {/* Error / Backend Offline State (Section 16) */}
        {predictionError && (
          <div className="p-6 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-center space-y-2">
            <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
            <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">
              Patient-specific explanation unavailable
            </h4>
            <p className="text-xs text-rose-700 dark:text-rose-300 max-w-lg mx-auto">
              Patient-specific explanation unavailable because the model service could not be reached. Ensure the backend server is running at port 8000.
            </p>
          </div>
        )}

        {/* Empty State / No Prediction (Section 15) */}
        {!hasPrediction && !predictionError && (
          <div className="p-10 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <Sliders className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                No Active Patient Assessment
              </h4>
              <p className="text-slate-500 text-xs max-w-md mx-auto">
                Run AI Assessment to generate a patient-specific explanation. Authentic TreeSHAP feature attributions will be computed live for {current.name}.
              </p>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('assessment')}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-xs inline-flex items-center gap-1.5 transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Open Patient Assessment</span>
              </button>
            )}
          </div>
        )}

        {/* Live SHAP Features List */}
        {hasPrediction && (
          <div className="space-y-4">
            {/* Controls Bar: Search & View All Toggle (Section 18) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search transformed features..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={() => setShowAllFeatures(!showAllFeatures)}
                  className="px-3 py-1.5 rounded-lg font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
                >
                  {showAllFeatures ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5" />
                      <span>Show Top 10 Contributors Only</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span>View All 60 Transformed Features</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Feature Bars */}
            {featuresList.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No features match the filter query "{searchQuery}".
              </div>
            ) : (
              <div className="space-y-3.5">
                {featuresList.map((f, idx) => {
                  const isPositive = (f.shap_value || 0) >= 0;
                  const absVal = Math.abs(f.shap_value || 0);
                  const barWidthPct = Math.min(100, Math.max(4, (absVal / maxMag) * 100));

                  return (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-slate-400 text-[11px] w-5 text-right shrink-0">
                            {idx + 1}.
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {f.feature}
                          </span>
                          {f.is_one_hot && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                              One-Hot Encoded
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 font-mono shrink-0">
                          <span className="text-[11px] text-slate-400 hidden sm:inline">
                            {isPositive ? 'Pushes Prediction Higher' : 'Pushes Prediction Lower'}
                          </span>
                          <span
                            className={`font-bold px-2 py-0.5 rounded text-xs ${
                              isPositive
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300'
                            }`}
                          >
                            {f.contribution || (isPositive ? `+${absVal.toFixed(3)}` : `-${absVal.toFixed(3)}`)}
                          </span>
                        </div>
                      </div>

                      {/* Horizontal Bar Visualizer */}
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden flex items-center">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isPositive ? 'bg-rose-500' : 'bg-teal-500'
                          }`}
                          style={{ width: `${barWidthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Scientific Footnote */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>
            Algorithm: TreeSHAP (Lundberg & Lee, 2017) • Target: {current.name} • 60 Transformed Features Evaluated
          </span>
          <span className="italic">
            All SHAP values are calculated live on the trained model estimators. Never fabricated.
          </span>
        </div>
      </div>
    </div>
  );
}
