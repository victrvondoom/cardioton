import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PatientForm } from '../PatientForm';
import { api, validateSchema } from '../api';
import type { FeatureManifest } from '../api';
import { ModuleBoundary } from '../ModuleBoundary';
import source from '../../../artifacts/data/feature_manifest.json';
const schema = source as FeatureManifest;
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('shows exact group progress and focuses the first invalid field without filling defaults', () => {
  const values = Object.fromEntries(schema.feature_order.map(name => [name, '']));
  render(<PatientForm schema={schema} values={values} onChange={vi.fn()} />);
  Element.prototype.scrollIntoView = vi.fn();
  fireEvent.click(screen.getByRole('button', { name: 'Go to first incomplete or invalid field' }));
  expect(document.activeElement).toBe(screen.getByLabelText('Age'));
  expect(screen.getByLabelText('Age').getAttribute('aria-invalid')).toBe('true');
  expect(screen.getByRole('progressbar').getAttribute('value')).toBe('0');
  expect(screen.getByRole('button', { name: 'Demographics · 0/5' })).toBeTruthy();
  expect((screen.getByLabelText('Age') as HTMLInputElement).value).toBe('');
});
it('keeps group navigation keyboard focus on a field rather than scrolling only', () => {
  render(<PatientForm schema={schema} values={{}} onChange={vi.fn()} />);
  Element.prototype.scrollIntoView = vi.fn();
  fireEvent.click(screen.getByRole('button', { name: 'Laboratory · 0/14' }));
  expect(document.activeElement).toBe(screen.getByLabelText('FBS'));
});
it('rejects malformed schema and target columns before form rendering', () => {
  for (const data of [null, {}, {...source, feature_order: ['Cath', ...source.feature_order.slice(1)]},
    {...source, features: []}]) expect(() => validateSchema(data as FeatureManifest)).toThrow('Malformed source schema');
  expect(validateSchema(schema)).toBe(schema);
});
it('fails cleanly on malformed successful JSON or health data and unavailable backend', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('invalid JSON')).mockResolvedValueOnce(new Response('{}'))
    .mockRejectedValueOnce(new TypeError('Failed to fetch')));
  await expect(api.health()).rejects.toThrow('Malformed API response');
  await expect(api.health()).rejects.toThrow('Malformed application health');
  await expect(api.health()).rejects.toThrow('Failed to fetch');
});
it('contains module errors without claiming anatomy loaded or dropping numerical siblings', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  function Broken() { throw new Error('chunk unavailable'); return null; }
  render(<><p>Numerical outputs remain here</p><ModuleBoundary name="3D anatomy"><Broken /></ModuleBoundary></>);
  expect(screen.getByRole('alert').textContent).toContain('has not loaded successfully');
  expect(screen.getByText('Numerical outputs remain here')).toBeTruthy();
});
it('preserves the original Three color outputs across a dense probability grid', async () => {
  const { Color } = await import('three');
  const { probabilityColor } = await import('../anatomy/contract');
  for (let i = 0; i <= 1000; i++) {
    const p = i / 1000;
    const expected = new Color('#3182bd').lerp(new Color('#d64b3b'), p).getStyle();
    // Same upstream Color implementation and frozen v1 endpoints/interpolation.
    const actual = probabilityColor(p);
    expect(actual).toBe(expected);
  }
});
