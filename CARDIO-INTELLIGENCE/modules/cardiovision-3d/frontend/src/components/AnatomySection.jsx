import React, { useState } from 'react';
import HeartCanvas, { VESSEL_COLORS } from './HeartCanvas';
import {
  Heart,
  Info,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  BookOpen,
  ArrowRight,
  ExternalLink,
  Play
} from 'lucide-react';

const VESSEL_ANATOMY = {
  LAD: {
    name: 'Left Anterior Descending Artery',
    code: 'LAD',
    course: 'Originates from Left Main Coronary Artery (LMCA) and courses along the anterior interventricular sulcus to the cardiac apex.',
    perfusion: 'Supplies the anterior wall of the left ventricle, apex, anterior two-thirds of the interventricular septum, and bundle branches.',
    significance: 'Critical vascular conduit ("widowmaker"). Stenosis conveys high risk of extensive anterior transmural ischemia or anterior STEMI.',
    sourceLandmark: 'Anterior interventricular groove node in the 3D model.'
  },
  LCX: {
    name: 'Left Circumflex Artery',
    code: 'LCX',
    course: 'Arises from the LMCA and runs along the left atrioventricular groove around the left cardiac border to the posterior surface.',
    perfusion: 'Supplies the lateral and posterolateral myocardial walls of the left ventricle via obtuse marginal (OM) branches.',
    significance: 'Stenosis can precipitate lateral ischemia, localized hypokinesis, and ischemic mitral valve dysfunction.',
    sourceLandmark: 'Left atrioventricular sulcus node in the 3D model.'
  },
  RCA: {
    name: 'Right Coronary Artery',
    code: 'RCA',
    course: 'Originates from the right aortic sinus and travels inferiorly along the right atrioventricular sulcus to the crux of the heart.',
    perfusion: 'Supplies the right ventricular free wall, inferior LV wall, sinus node (~60%), and AV node (~90% in right-dominant circulation).',
    significance: 'Stenosis frequently triggers inferior wall ischemia, right ventricular infarction, and high-grade AV block.',
    sourceLandmark: 'Right atrioventricular groove and posterior descending artery node in the 3D model.'
  }
};

export default function AnatomySection({
  predictionData,
  selectedVessel,
  onSelectVessel,
  onNavigate
}) {
  const [showAttribution, setShowAttribution] = useState(false);

  // Extract authentic prediction values without hardcoded demo fallbacks
  const hasPrediction = Boolean(predictionData?.vessels);
  const ladProb = hasPrediction ? (predictionData.vessels.LAD?.probability ?? null) : null;
  const lcxProb = hasPrediction ? (predictionData.vessels.LCX?.probability ?? null) : null;
  const rcaProb = hasPrediction ? (predictionData.vessels.RCA?.probability ?? null) : null;

  const currentVessel = selectedVessel ? (VESSEL_ANATOMY[selectedVessel] || VESSEL_ANATOMY.LAD) : null;
  const currentVesselData = selectedVessel && hasPrediction ? predictionData.vessels[selectedVessel] : null;
  const currentProb = currentVesselData?.probability ?? null;
  const currentShap = currentVesselData?.top_shap_features || [];

  return (
    <div className="space-y-6 pb-12">
      {/* 3D Centerpiece Viewer Container */}
      <div className="hospital-card p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950 dark:text-sky-300">
                CENTERPIECE 3D VISUALIZATION
              </span>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Interactive Coronary Anatomy & Territory Mapping
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Select LAD, LCX, or RCA to highlight its anatomical branch, focus the camera, and inspect live predicted stenosis probability with TreeSHAP explanations.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setShowAttribution(!showAttribution)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Model Attribution & License</span>
            </button>
          </div>
        </div>

        {/* 3D Canvas Box */}
        <div className="w-full h-[520px] rounded-2xl overflow-hidden relative border border-slate-200 dark:border-slate-800 shadow-inner">
          <HeartCanvas
            ladProb={ladProb}
            lcxProb={lcxProb}
            rcaProb={rcaProb}
            selectedVessel={selectedVessel}
            onSelectVessel={onSelectVessel}
          />
        </div>

        {/* Persistent Plaque Notice */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Anatomical Mapping Label:</strong> Prediction mapped to anatomical vessel; this does not represent measured plaque location or intravascular lesion geometry.
          </span>
        </div>
      </div>

      {/* Selected Vessel Inspector Card */}
      {currentVessel ? (
        <div
          className="hospital-card p-6 border-l-4 space-y-5"
          style={{ borderLeftColor: VESSEL_COLORS[selectedVessel] }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: VESSEL_COLORS[selectedVessel] }}
              />
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {currentVessel.name} ({currentVessel.code})
                </h3>
                <p className="text-xs text-slate-500">
                  Coronary Branch Inspector • Mapped Landmark: {currentVessel.sourceLandmark}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              <div className="text-right">
                {hasPrediction && currentProb !== null ? (
                  <>
                    <div className="text-2xl font-extrabold font-mono text-slate-900 dark:text-white">
                      {(currentProb * 100).toFixed(1)}%
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      Predicted Stenosis Probability — {selectedVessel}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
                      Pending Assessment
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Run AI Assessment to view model predictions
                    </div>
                  </>
                )}
              </div>
              {hasPrediction ? (
                <button
                  onClick={() => onNavigate('explainability')}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Vessel SHAP Drivers</span>
                </button>
              ) : (
                <button
                  onClick={() => onNavigate('assessment')}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Open Assessment</span>
                </button>
              )}
            </div>
          </div>

          {/* Clinical Risk Tier & Stenosis Status if Prediction Available */}
          {hasPrediction && currentVesselData && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`px-2.5 py-1 rounded-md font-mono font-semibold border ${
                currentVesselData.risk_tier === 'High'
                  ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300'
                  : currentVesselData.risk_tier === 'Moderate'
                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
              }`}>
                {currentVesselData.risk_tier} Model Risk Tier
              </span>
              <span className="px-2.5 py-1 rounded-md font-mono font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {currentVesselData.stenosis_50_plus ? '≥50% Stenosis Predicted' : '<50% Stenosis Predicted'}
              </span>
              <span className="text-[11px] text-slate-500 italic">
                Model estimate derived from patient biomarkers. Not a direct catheterization measurement.
              </span>
            </div>
          )}

          {/* Anatomical Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-1">
              <span className="font-bold text-slate-700 dark:text-slate-300">Anatomical Course</span>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{currentVessel.course}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-1">
              <span className="font-bold text-slate-700 dark:text-slate-300">Myocardial Perfusion Territory</span>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{currentVessel.perfusion}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-1">
              <span className="font-bold text-slate-700 dark:text-slate-300">Clinical Significance</span>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{currentVessel.significance}</p>
            </div>
          </div>

          {/* Key Model-Contributing Features for This Vessel */}
          {hasPrediction ? (
            currentShap.length > 0 ? (
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                  <div>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Why this prediction? — Top Model Contributors for {selectedVessel} (TreeSHAP)
                    </span>
                    <p className="text-[11px] text-slate-500">
                      SHAP values describe how input features contributed to the model prediction. They do not establish biological causation.
                    </p>
                  </div>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('explainability')}
                      className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline shrink-0"
                    >
                      View Full Explanation →
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {currentShap.slice(0, 6).map((f, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                    >
                      <div className="flex flex-col min-w-0 pr-1">
                        <span className="font-medium text-slate-700 dark:text-slate-200 truncate">{f.feature}</span>
                        <span className="text-[10px] text-slate-400">
                          {(f.shap_value || 0) >= 0 ? 'Pushes Higher' : 'Pushes Lower'}
                        </span>
                      </div>
                      <span
                        className={`font-mono font-bold shrink-0 ${
                          (f.shap_value || 0) >= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-teal-600 dark:text-teal-400'
                        }`}
                      >
                        {f.contribution || ((f.shap_value || 0) >= 0 ? `+${Math.abs(f.shap_value || 0).toFixed(3)}` : `-${Math.abs(f.shap_value || 0).toFixed(3)}`)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 text-xs text-slate-500">
                No dominant local feature attributions recorded for this vessel in the current evaluation.
              </div>
            )
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 flex items-center justify-between gap-3">
              <span>TreeSHAP local feature attributions will appear here once patient assessment is evaluated.</span>
              <button
                onClick={() => onNavigate('assessment')}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 shrink-0"
              >
                Go to Assessment →
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Neutral Overview State when Reset Framing is clicked */
        <div className="hospital-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Coronary Vasculature Overview
              </h3>
              <p className="text-xs text-slate-500">
                All major branches are in neutral overview framing. Select any branch below or click directly on the 3D heart mesh to focus.
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              3 Branches Mapped
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(VESSEL_ANATOMY).map(([code, v]) => {
              const prob = code === 'LAD' ? ladProb : code === 'LCX' ? lcxProb : rcaProb;
              return (
                <button
                  key={code}
                  onClick={() => onSelectVessel(code)}
                  className="text-left p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-2 bg-slate-50/50 dark:bg-slate-800/30"
                  style={{ borderLeftWidth: 4, borderLeftColor: VESSEL_COLORS[code] }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">{code}</span>
                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                      {prob != null ? `${(prob * 100).toFixed(1)}%` : 'Pending'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
                    {v.name}
                  </p>
                  <p className="text-[10px] text-slate-500 line-clamp-1">
                    {v.perfusion}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Model Attribution Modal / Slideout */}
      {showAttribution && (
        <div className="hospital-card p-6 border border-sky-200 dark:border-sky-900 bg-sky-50/50 dark:bg-sky-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-sky-950 dark:text-sky-200 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-sky-600" />
              <span>3D Anatomical Model Attribution & Scientific Provenance</span>
            </h4>
            <button
              onClick={() => setShowAttribution(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Close
            </button>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
            <p>
              <strong>Model Source:</strong> Open-source segmented 3D Human Coronary Anatomy Geometry (GLTF/GLB).
            </p>
            <p>
              <strong>License:</strong> Creative Commons Attribution 4.0 International (CC-BY 4.0).
            </p>
            <p>
              <strong>Landmark Correspondence:</strong>
              <br />• LAD: Segmented along the anterior interventricular groove.
              <br />• LCX: Segmented along the circumflex coronary groove.
              <br />• RCA: Segmented along the right atrioventricular sulcus.
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
              <strong>Caveat:</strong> The 3D model serves as a cognitive visual reference for perfusion territories. Model probabilities reflect statistical risk correlations derived from the UCI Z-Alizadeh Sani cohort, not direct anatomical measurements or physical plaque imaging.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
