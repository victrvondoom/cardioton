// Direct upstream module keeps the unchanged color math out of the renderer barrel.
import { Color } from 'three/src/math/Color.js';
import type { AnatomyManifest } from '../api';

export const VESSELS = ['LAD', 'LCX', 'RCA'] as const;
export type Vessel = typeof VESSELS[number];
export type GroupName = 'heart' | Vessel;
export const GROUPS: readonly GroupName[] = ['heart', ...VESSELS];
export const LABELS: Record<Vessel, string> = {
  LAD: 'Left anterior descending artery',
  LCX: 'Left circumflex artery',
  RCA: 'Right coronary artery',
};
const EXPECTED = {
  heart: ['FMA7088', 'BP9305', 30], LAD: ['FMA3862', 'BP9548', 18],
  LCX: ['FMA3895', 'BP9745', 6], RCA: ['FMA50039', 'BP9299', 29],
} as const;

// Validate the actual API response, not just its compile-time TypeScript type.
export function validateManifest(input: AnatomyManifest): AnatomyManifest {
  if (!input || input.schema_version !== 1 || !input.groups || !input.meshes || !input.assembly ||
      !input.source_records?.attribution || input.source_records.license !== 'CC BY 4.0') {
    throw new Error('Unsupported or incomplete anatomy manifest');
  }
  if (Object.keys(input.groups).sort().join() !== [...GROUPS].sort().join()) {
    throw new Error('Anatomy must contain exactly heart, LAD, LCX and RCA');
  }
  const seen = new Set<string>();
  for (const group of GROUPS) {
    const record = input.groups[group];
    const [concept, representation, count] = EXPECTED[group];
    if (record.concept_id !== concept || record.representation_id !== representation ||
        !Array.isArray(record.leaf_ids) || record.leaf_ids.length !== count) {
      throw new Error(`Unverified source mapping for ${group}`);
    }
    for (const leaf of record.leaf_ids) {
      if (seen.has(leaf)) throw new Error(`Duplicate coronary/heart geometry: ${leaf}`);
      seen.add(leaf);
      const mesh = input.meshes[leaf];
      if (!/^FJ\d+[A-Z]*$/.test(leaf) || !mesh || mesh.path !== `meshes/${leaf}.obj` ||
          !/^[a-f0-9]{64}$/.test(mesh.sha256) || !Number.isInteger(mesh.bytes) || mesh.bytes <= 0 ||
          !Number.isInteger(mesh.faces) || mesh.faces <= 0 || !Number.isInteger(mesh.vertices) || mesh.vertices <= 0) {
        throw new Error(`Invalid source mesh record: ${leaf}`);
      }
    }
  }
  const original = input.groups.heart.original_leaf_ids;
  if (!original || original.length !== 83 || new Set(original).size !== 83 ||
      original.some(leaf => !seen.has(leaf)) || Object.keys(input.meshes).length !== 83) {
    throw new Error('Heart-base subtraction does not match the original 83-leaf heart');
  }
  const { center, scale } = input.assembly;
  if (!Array.isArray(center) || center.length !== 3 || !center.every(Number.isFinite) ||
      !Number.isFinite(scale) || scale <= 0) throw new Error('Invalid shared anatomical transform');
  return input;
}

// Prediction state carries the same profile/model identity as numerical results.
export type VesselData =
  | { status: 'unavailable' }
  | { status: 'pending' }
  | { status: 'error'; message: string }
  | { status: 'prediction'; probability: number; modelVersion: string; profileFingerprint: string };
export type VesselStates = Record<Vessel, VesselData>;
export const NEUTRAL_STATES: VesselStates = {
  LAD: { status: 'unavailable' }, LCX: { status: 'unavailable' }, RCA: { status: 'unavailable' },
};
export const NEUTRAL_COLOR = '#338aa0';
export function probabilityColor(probability: number): string {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new Error('Probability must be finite and between 0 and 1');
  }
  return new Color('#3182bd').lerp(new Color('#d64b3b'), probability).getStyle();
}
export function vesselColor(data: VesselData): string {
  return data.status === 'prediction' ? probabilityColor(data.probability) : NEUTRAL_COLOR;
}

export function transformPoint(point: readonly number[], manifest: AnatomyManifest): [number, number, number] {
  return [0, 1, 2].map(axis =>
    (point[axis] - manifest.assembly.center[axis]) * manifest.assembly.scale,
  ) as [number, number, number];
}
