import React from 'react';
import { ExplanationResult } from '../arterylens__frontend_src__types';

interface ShapChartProps {
  explanation: ExplanationResult | null;
  selectedTarget: string;
  onSelectTarget: (target: string) => void;
  loading: boolean;
}

export const ShapChart: React.FC<ShapChartProps> = ({
  explanation,
  selectedTarget,
  onSelectTarget,
  loading
}) => {
  if (loading || !explanation) {
    return (
      <div className="clinical-card p-4 rounded-lg animate-pulse space-y-3">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mb-3" />
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-5 bg-slate-100 dark:bg-slate-800 rounded" />
        ))}
      </div>
    );
  }

  const pos = explanation.positive_features.slice(0, 5);
  const neg = explanation.negative_features.slice(0, 4);
  const maxAbs = Math.max(
    ...pos.map(f => Math.abs(f.shap)),
    ...neg.map(f => Math.abs(f.shap)),
    0.1
  );

  return (
    <div className="clinical-card p-4 rounded-lg shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Feature contributions (SHAP)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Additive contribution to {selectedTarget} model risk score
          </p>
        </div>

        {/* Target Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-md p-0.5 border border-slate-200 dark:border-slate-700">
          {(['CAD', 'LAD', 'LCX', 'RCA'] as const).map(target => (
            <button
              key={target}
              onClick={() => onSelectTarget(target)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                selectedTarget === target
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {target}
            </button>
          ))}
        </div>
      </div>

      {/* Clean Diverging Bar Legend */}
      <div className="flex items-center gap-4 text-xs mb-3 text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2 rounded bg-rose-600" />
          <span>Increases risk (+SHAP)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2 rounded bg-blue-600" />
          <span>Decreases risk / protective (-SHAP)</span>
        </div>
      </div>

      {/* Horizontal Diverging Bars List */}
      <div className="space-y-4">
        {/* Factors Increasing Risk */}
        <div>
          <h4 className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Top factors increasing risk
          </h4>
          <div className="space-y-2">
            {pos.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No strong positive risk factors identified.</p>
            ) : (
              pos.map((item, idx) => {
                const widthPct = Math.round((Math.abs(item.shap) / maxAbs) * 100);
                return (
                  <div key={idx} className="text-xs">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {item.feature} <span className="text-slate-400 font-normal tabular-nums text-[11px]">(value: {item.value})</span>
                      </span>
                      <span className="font-medium text-rose-700 dark:text-rose-400 tabular-nums">
                        +{item.shap.toFixed(2)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden">
                      <div 
                        className="h-full bg-rose-600 rounded transition-all duration-300"
                        style={{ width: `${Math.max(2, widthPct)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Factors Decreasing Risk */}
        <div>
          <h4 className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Top factors decreasing risk (protective)
          </h4>
          <div className="space-y-2">
            {neg.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No strong protective factors identified.</p>
            ) : (
              neg.map((item, idx) => {
                const widthPct = Math.round((Math.abs(item.shap) / maxAbs) * 100);
                return (
                  <div key={idx} className="text-xs">
                    <div className="flex justify-between items-baseline mb-0.5">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {item.feature} <span className="text-slate-400 font-normal tabular-nums text-[11px]">(value: {item.value})</span>
                      </span>
                      <span className="font-medium text-blue-700 dark:text-blue-400 tabular-nums">
                        {item.shap.toFixed(2)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 rounded transition-all duration-300"
                        style={{ width: `${Math.max(2, widthPct)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
