import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { URL as NodeURL } from 'node:url';
import { Box3, Vector3 } from 'three';
import source from '../../../assets/anatomy/manifest.json';
import type { AnatomyManifest } from '../api';
import { GROUPS, NEUTRAL_COLOR, probabilityColor, transformPoint, validateManifest, vesselColor } from '../anatomy/contract';
import { INITIAL_STATE, viewerReducer, visibleGroups } from '../anatomy/state';
import { loadAnatomy } from '../anatomy/assets';
const manifest = source as AnatomyManifest;
afterEach(() => vi.unstubAllGlobals());
describe('pinned mapping and shared coordinates', () => {
  it('accepts the verified disjoint 30/18/6/29 mapping', () => {
    expect(validateManifest(manifest)).toBe(manifest);
    expect(GROUPS.map(g => manifest.groups[g].leaf_ids.length)).toEqual([30, 18, 6, 29]);
  });
  it('rejects duplicate coronary geometry', () => {
    const bad = structuredClone(manifest);
    bad.groups.LAD.leaf_ids[0] = bad.groups.heart.leaf_ids[0];
    expect(() => validateManifest(bad)).toThrow('Duplicate');
  });
  it.each(['concept', 'subtraction', 'transform', 'path', 'sha'])('rejects invalid %s', kind => {
    const bad = structuredClone(manifest), leaf = bad.groups.LAD.leaf_ids[0];
    if (kind === 'concept') bad.groups.LAD.concept_id = 'FMA999';
    if (kind === 'subtraction') bad.groups.heart.original_leaf_ids = [];
    if (kind === 'transform') bad.assembly.scale = NaN;
    if (kind === 'path') bad.meshes[leaf].path = '../source/secret';
    if (kind === 'sha') bad.meshes[leaf].sha256 = 'invalid';
    expect(() => validateManifest(bad)).toThrow();
  });
  it('uses one center and scale for every group', () => {
    expect(transformPoint(manifest.assembly.center, manifest)).toEqual([0, 0, 0]);
    const p = [...manifest.assembly.center]; p[2] += 1;
    expect(transformPoint(p, manifest)[2]).toBe(manifest.assembly.scale);
  });
});
it('preserves one selection across isolation and clears it on reset', () => {
  expect(viewerReducer(INITIAL_STATE, { type: 'isolate' })).toBe(INITIAL_STATE);
  let state = viewerReducer(INITIAL_STATE, { type: 'select', vessel: 'LAD' });
  state = viewerReducer(state, { type: 'isolate' });
  state = viewerReducer(state, { type: 'select', vessel: 'LCX' });
  expect(state.selected).toBe('LCX'); expect(state.isolated).toBe(true);
  expect(state.view).toBe('posterior');
  expect(visibleGroups(state)).toEqual(['LCX']);
  state = viewerReducer(state, { type: 'view', view: 'posterior' });
  expect(state.view).toBe('posterior'); expect(state.focus).toBe(false);
  state = viewerReducer(state, { type: 'show-all' });
  expect(state.selected).toBe('LCX'); expect(state.isolated).toBe(false);
  expect(visibleGroups(state)).toEqual(GROUPS);
  expect(viewerReducer(state, { type: 'reset' })).toEqual({ ...INITIAL_STATE, cameraRevision: 4 });
});
it('reissues focus when selecting the same vessel again', () => {
  const state = viewerReducer(INITIAL_STATE, { type: 'select', vessel: 'RCA' });
  expect(state.view).toBe('anterior');
  expect(viewerReducer(state, { type: 'select', vessel: 'RCA' }).cameraRevision).toBe(2);
});
it('uses neutral styling for unavailable/pending/error without inventing probabilities', () => {
  for (const data of [{ status: 'unavailable' }, { status: 'pending' }, { status: 'error', message: 'unavailable' }] as const)
    expect(vesselColor(data)).toBe(NEUTRAL_COLOR);
  expect(probabilityColor(0)).not.toBe(probabilityColor(1));
});
it.each([NaN, Infinity, -0.1, 1.1])('rejects invalid probability %s', value => {
  expect(() => probabilityColor(value)).toThrow('Probability');
});
describe('real source OBJ loader (offline)', () => {
  const folder = new NodeURL('../../../assets/anatomy/', import.meta.url);
  const cached = existsSync(new NodeURL('meshes/FJ2631.obj', folder));
  it.skipIf(!cached)('loads all 83 pinned meshes unchanged in shared coordinates', async () => {
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(readFileSync(new NodeURL(url.replace('/anatomy/', ''), folder)))));
    const progress = vi.fn(), assets = await loadAnatomy(manifest, new AbortController().signal, progress);
    try {
      expect(progress).toHaveBeenLastCalledWith(83, 83);
      expect(GROUPS.map(g => assets.groups[g].length)).toEqual([30, 18, 6, 29]);
      const bounds = new Box3();
      for (const g of GROUPS) {
        bounds.union(assets.bounds[g]);
        for (const mesh of assets.groups[g]) {
          expect(mesh.geometry.getAttribute('position').count / 3).toBe(manifest.meshes[mesh.leaf].faces);
          expect(mesh.geometry.boundingBox!.min.z).toBeGreaterThan(1100);
        }
      }
      expect(bounds.getSize(new Vector3()).x).toBeCloseTo(2, 4);
    } finally { assets.dispose(); }
  });
  it.skipIf(!cached)('rejects a missing leaf atomically after partial loading', async () => {
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('FJ2631.obj')
      ? new Response('missing', { status: 404 })
      : new Response(readFileSync(new NodeURL(url.replace('/anatomy/', ''), folder)))));
    await expect(loadAnatomy(manifest, new AbortController().signal, vi.fn())).rejects.toThrow('LAD/FJ2631: HTTP 404');
  });
  it('rejects changed contents before rendering', async () => {
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('corrupt source')));
    await expect(loadAnatomy(manifest, new AbortController().signal, vi.fn())).rejects.toThrow('checksum');
  });
  it('aborts obsolete loads without publishing partial geometry', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(loadAnatomy(manifest, controller.signal, vi.fn())).rejects.toMatchObject({ name: 'AbortError' });
  });
});
