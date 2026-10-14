import type { FeatureManifest, Prediction } from './api';
import { VESSELS } from './anatomy/contract';
import type { VesselStates } from './anatomy/contract';

export type FormValues = Record<string, string>;
// Source-name groupings for navigation only, not new features or clinical units.
const DEMOGRAPHICS = new Set(['Age', 'Weight', 'Length', 'Sex', 'BMI']);
const HISTORY = new Set(['DM', 'HTN', 'Current Smoker', 'EX-Smoker', 'FH', 'Obesity', 'CRF',
  'CVA', 'Airway disease', 'Thyroid Disease', 'CHF', 'DLP']);
const ECG = new Set(['Q Wave', 'St Elevation', 'St Depression', 'Tinversion', 'LVH', 'Poor R Progression', 'BBB']);
const LAB = new Set(['FBS', 'CR', 'TG', 'LDL', 'HDL', 'BUN', 'ESR', 'HB', 'K', 'Na', 'WBC', 'Lymph', 'Neut', 'PLT']);
const ECHO = new Set(['EF-TTE', 'Region RWMA', 'VHD']);
export const FORM_GROUPS = ['Demographics', 'History', 'Examination and symptoms', 'Laboratory', 'ECG', 'Echocardiographic measurements'];
export function fieldGroup(name: string): string {
  return DEMOGRAPHICS.has(name) ? FORM_GROUPS[0] : HISTORY.has(name) ? FORM_GROUPS[1] :
    LAB.has(name) ? FORM_GROUPS[3] : ECG.has(name) ? FORM_GROUPS[4] :
      ECHO.has(name) ? FORM_GROUPS[5] : FORM_GROUPS[2];
}
export function parseProfile(values: FormValues, schema: FeatureManifest) {
  const errors: Record<string, string> = {}, features: Record<string, number | string> = {};
  if (Object.keys(values).sort().join() !== [...schema.feature_order].sort().join())
    errors._profile = 'Profile must contain exactly the 55 schema fields.';
  for (const field of schema.features) {
    const raw = values[field.name] ?? '';
    if (!raw.trim()) { errors[field.name] = 'Required; no default is substituted.'; continue; }
    if (field.kind === 'category') {
      if (!(field.categories ?? []).includes(raw)) errors[field.name] = 'Select an exact source category.';
      else features[field.name] = raw;
    } else {
      const number = Number(raw);
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw.trim()) || !Number.isFinite(number))
        errors[field.name] = 'Enter a finite number.';
      else if (field.kind === 'integer' && !Number.isInteger(number)) errors[field.name] = 'Enter an integer.';
      else features[field.name] = number;
    }
  }
  return { features, errors, valid: Object.keys(errors).length === 0 };
}
export function predictionVessels(prediction: Prediction): VesselStates {
  return Object.fromEntries(VESSELS.map(vessel => [vessel, {
    status: 'prediction', probability: prediction.outputs[vessel].probability,
    modelVersion: prediction.model_version, profileFingerprint: prediction.profile_fingerprint,
  }])) as VesselStates;
}
