/**
 * Central Clinical Risk Bands & Thresholds Configuration
 * Single source of truth for:
 * - Risk category ranges (Low <35%, Intermediate 35-60%, High >60%)
 * - Decision thresholds per vessel
 * - Standardized, desaturated clinical colors (HEX and Three.js numeric)
 */

export interface RiskBand {
  id: 'low' | 'intermediate' | 'high';
  label: string;
  min: number;
  max: number;
  colorHex: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  threeColor: number;
}

export const RISK_BANDS = {
  LOW: {
    id: 'low',
    label: 'Low Risk',
    min: 0.0,
    max: 0.35,
    colorHex: '#16a34a',       // Desaturated clinical green
    textColor: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    dotColor: 'bg-emerald-600 dark:bg-emerald-500',
    threeColor: 0x16a34a
  },
  INTERMEDIATE: {
    id: 'intermediate',
    label: 'Intermediate Risk',
    min: 0.35,
    max: 0.60,
    colorHex: '#d97706',       // Desaturated amber
    textColor: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-950/40',
    borderColor: 'border-amber-200 dark:border-amber-800',
    dotColor: 'bg-amber-500',
    threeColor: 0xd97706
  },
  HIGH: {
    id: 'high',
    label: 'High Risk',
    min: 0.60,
    max: 1.0,
    colorHex: '#dc2626',       // Desaturated clinical red
    textColor: 'text-rose-700 dark:text-rose-400',
    bgColor: 'bg-rose-50 dark:bg-rose-950/40',
    borderColor: 'border-rose-200 dark:border-rose-800',
    dotColor: 'bg-rose-600 dark:bg-rose-500',
    threeColor: 0xdc2626
  }
} as const;

export const VESSEL_THRESHOLDS = {
  CAD: 0.50,
  LAD: 0.50,
  LCX: 0.40,
  RCA: 0.45
} as const;

export function getRiskBand(probability: number) {
  if (probability < 0.35) return RISK_BANDS.LOW;
  if (probability <= 0.60) return RISK_BANDS.INTERMEDIATE;
  return RISK_BANDS.HIGH;
}

export function getRiskColorHex(probability: number): string {
  return getRiskBand(probability).colorHex;
}

export function getVesselStatusText(probability: number, threshold: number): 'Stenotic' | 'Normal' {
  return probability >= threshold ? 'Stenotic' : 'Normal';
}
