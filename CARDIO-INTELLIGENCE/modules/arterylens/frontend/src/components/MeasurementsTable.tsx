import React from 'react';
import { PatientData } from '../arterylens__frontend_src__types';

interface MeasurementsTableProps {
  patient: PatientData;
}

interface MeasurementRow {
  name: string;
  normalRange: string;
  unit: string;
  status: 'Normal' | 'Borderline' | 'Abnormal';
  displayValue: string | number;
}

export const MeasurementsTable: React.FC<MeasurementsTableProps> = ({ patient }) => {
  const getMeasurementStatus = (): MeasurementRow[] => {
    const ef = patient['EF-TTE'] ?? 55;
    const bp = patient['BP'] ?? 120;
    const ldl = patient['LDL'] ?? 100;
    const hdl = patient['HDL'] ?? 45;
    const tg = patient['TG'] ?? 140;
    const fbs = patient['FBS'] ?? 95;
    const stElev = patient['St Elevation'] ?? 0;
    const rwma = patient['Region RWMA'] ?? 0;
    const nlr = patient['NLR'] ?? (patient['Neut'] && patient['Lymph'] ? patient['Neut'] / patient['Lymph'] : 2.0);

    return [
      {
        name: 'Left ventricular ejection fraction (EF-TTE)',
        normalRange: '50 – 70',
        unit: '%',
        displayValue: ef,
        status: ef >= 50 ? 'Normal' : ef >= 40 ? 'Borderline' : 'Abnormal'
      },
      {
        name: 'Systolic blood pressure',
        normalRange: '90 – 120',
        unit: 'mmHg',
        displayValue: bp,
        status: bp <= 125 ? 'Normal' : bp <= 140 ? 'Borderline' : 'Abnormal'
      },
      {
        name: 'LDL-C (low-density lipoprotein)',
        normalRange: '< 100',
        unit: 'mg/dL',
        displayValue: ldl,
        status: ldl < 100 ? 'Normal' : ldl <= 150 ? 'Borderline' : 'Abnormal'
      },
      {
        name: 'HDL-C (high-density lipoprotein)',
        normalRange: '> 40',
        unit: 'mg/dL',
        displayValue: hdl,
        status: hdl >= 40 ? 'Normal' : 'Abnormal'
      },
      {
        name: 'Serum triglycerides (TG)',
        normalRange: '< 150',
        unit: 'mg/dL',
        displayValue: tg,
        status: tg < 150 ? 'Normal' : tg <= 200 ? 'Borderline' : 'Abnormal'
      },
      {
        name: 'Fasting blood glucose (FBS)',
        normalRange: '70 – 100',
        unit: 'mg/dL',
        displayValue: fbs,
        status: fbs < 100 ? 'Normal' : fbs <= 125 ? 'Borderline' : 'Abnormal'
      },
      {
        name: 'Neutrophil/lymphocyte ratio (NLR)',
        normalRange: '< 2.5',
        unit: 'ratio',
        displayValue: typeof nlr === 'number' ? nlr.toFixed(2) : nlr,
        status: nlr < 2.5 ? 'Normal' : nlr <= 3.5 ? 'Borderline' : 'Abnormal'
      },
      {
        name: 'Regional wall motion abnormality (RWMA)',
        normalRange: '0 (None)',
        unit: 'score',
        displayValue: rwma,
        status: rwma === 0 ? 'Normal' : 'Abnormal'
      },
      {
        name: 'ECG ST-segment elevation',
        normalRange: '0 (Absent)',
        unit: 'binary',
        displayValue: stElev === 1 ? 'Present' : 'Absent',
        status: stElev === 0 ? 'Normal' : 'Abnormal'
      }
    ];
  };

  const rows = getMeasurementStatus();

  return (
    <div className="clinical-card p-4 rounded-lg shadow-sm">
      <div className="mb-3 pb-2.5 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Diagnostic measurements
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Patient lab and physiological parameters compared to clinical reference ranges
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs tabular-nums">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <th className="py-2 px-3 font-medium">Parameter</th>
              <th className="py-2 px-3 font-medium">Patient value</th>
              <th className="py-2 px-3 font-medium">Reference range</th>
              <th className="py-2 px-3 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((row, idx) => {
              let dotColor = 'bg-emerald-600';
              let statusText = 'Normal';
              let statusTextColor = 'text-emerald-700 dark:text-emerald-400';

              if (row.status === 'Borderline') {
                dotColor = 'bg-amber-500';
                statusText = 'Borderline';
                statusTextColor = 'text-amber-700 dark:text-amber-400';
              } else if (row.status === 'Abnormal') {
                dotColor = 'bg-rose-600';
                statusText = 'Abnormal';
                statusTextColor = 'text-rose-700 dark:text-rose-400';
              }

              return (
                <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                  <td className="py-2 px-3 text-slate-800 dark:text-slate-200 font-sans font-medium">
                    {row.name}
                  </td>
                  <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">
                    {row.displayValue} <span className="text-[11px] font-normal text-slate-400">{row.unit}</span>
                  </td>
                  <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                    {row.normalRange} {row.unit}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusTextColor}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                      <span>{statusText}</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
