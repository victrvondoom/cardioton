import React from 'react';
import { PredictionResult } from '../arterylens__frontend_src__types';
import { getRiskBand, VESSEL_THRESHOLDS } from '../config/arterylens__src_config__riskBands';
import { Info } from 'lucide-react';

interface VesselCardsProps {
  prediction: PredictionResult | null;
  selectedVessel: string;
  onSelectVessel: (vessel: string) => void;
  loading: boolean;
}

export const VesselCards: React.FC<VesselCardsProps> = ({
  prediction,
  selectedVessel,
  onSelectVessel,
  loading
}) => {
  if (loading || !prediction) {
    return (
      <div className="clinical-card p-4 rounded-lg space-y-2 animate-pulse">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-3" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-md" />
        ))}
      </div>
    );
  }

  const vessels = [
    {
      id: 'LAD',
      fullName: 'Left anterior descending',
      territory: 'Anterior wall & septum',
      model: 'Random Forest',
      auc: '0.86',
      threshold: VESSEL_THRESHOLDS.LAD,
      prob: prediction.probabilities.LAD,
      isStenotic: prediction.probabilities.LAD >= VESSEL_THRESHOLDS.LAD
    },
    {
      id: 'LCX',
      fullName: 'Left circumflex',
      territory: 'Lateral & posterior LV',
      model: 'XGBoost',
      auc: '0.73',
      threshold: VESSEL_THRESHOLDS.LCX,
      prob: prediction.probabilities.LCX,
      isStenotic: prediction.probabilities.LCX >= VESSEL_THRESHOLDS.LCX
    },
    {
      id: 'RCA',
      fullName: 'Right coronary',
      territory: 'Inferior wall & RV',
      model: 'Logistic Regression',
      auc: '0.72',
      threshold: VESSEL_THRESHOLDS.RCA,
      prob: prediction.probabilities.RCA,
      isStenotic: prediction.probabilities.RCA >= VESSEL_THRESHOLDS.RCA
    }
  ];

  return (
    <div className="clinical-card p-4 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Coronary vessel stenosis
        </h3>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Click vessel to inspect
        </span>
      </div>

      {/* Table-like list */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {vessels.map(v => {
          const isSelected = selectedVessel === v.id;
          const pct = Math.round(v.prob * 100);
          const band = getRiskBand(v.prob);

          return (
            <div
              key={v.id}
              onClick={() => onSelectVessel(v.id)}
              className={`py-2.5 px-2 rounded-md transition cursor-pointer flex flex-col gap-1.5 ${
                isSelected 
                  ? 'bg-slate-50 dark:bg-slate-800/80 ring-1 ring-slate-300 dark:ring-slate-600' 
                  : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
              }`}
            >
              {/* Row Top: Vessel Name, Status Dot, Percentage */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${band.dotColor}`} />
                  <div>
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {v.id}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5">
                      {v.fullName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-medium ${v.isStenotic ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}`}>
                    {v.isStenotic ? 'Stenotic' : 'Normal'}
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums w-8 text-right">
                    {pct}%
                  </span>
                </div>
              </div>

              {/* Row Middle: Small subtle probability bar */}
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-300"
                  style={{ 
                    width: `${Math.max(2, pct)}%`,
                    backgroundColor: band.colorHex 
                  }}
                />
              </div>

              {/* Row Bottom: Model architecture + AUC */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                <span>{v.territory}</span>
                <span>{v.model} (AUC {v.auc})</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Single Footnote for LCX/RCA Reliability Caveat */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <p>
          Note: LCX (AUC 0.73) and RCA (AUC 0.72) models have moderate discrimination due to overlapping non-invasive clinical presentations.
        </p>
      </div>
    </div>
  );
};
