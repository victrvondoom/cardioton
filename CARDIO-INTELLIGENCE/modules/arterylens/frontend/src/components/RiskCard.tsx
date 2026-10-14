import React from 'react';
import { PredictionResult } from '../arterylens__frontend_src__types';
import { getRiskBand } from '../config/arterylens__src_config__riskBands';

interface RiskCardProps {
  prediction: PredictionResult | null;
  loading: boolean;
}

export const RiskCard: React.FC<RiskCardProps> = ({ prediction, loading }) => {
  if (loading || !prediction) {
    return (
      <div className="clinical-card p-4 rounded-lg animate-pulse">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-2" />
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-3" />
        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded w-full" />
      </div>
    );
  }

  const cadProb = prediction.probabilities.CAD;
  const percentage = Math.round(cadProb * 100);
  const band = getRiskBand(cadProb);

  return (
    <div className="clinical-card p-4 rounded-lg shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Overall CAD risk
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Calibrated Logistic Regression (ROC-AUC 0.93)
          </p>
        </div>

        {/* Small colored dot + sentence case category text */}
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <span className={`w-2 h-2 rounded-full ${band.dotColor}`} />
          <span className={band.textColor}>{band.label}</span>
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-3xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
          {percentage}%
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          estimated likelihood
        </span>
      </div>

      {/* Clean, thin probability bar */}
      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
        <div 
          className="h-full rounded-full transition-all duration-500"
          style={{ 
            width: `${Math.max(3, Math.min(100, percentage))}%`,
            backgroundColor: band.colorHex 
          }}
        />
      </div>

      {/* Compact verified clinical validation metadata */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
        <span>Decision threshold: <strong className="text-slate-700 dark:text-slate-300">0.50</strong></span>
        <span>Sensitivity: 87.0% • Specificity: 86.2%</span>
      </div>
    </div>
  );
};
