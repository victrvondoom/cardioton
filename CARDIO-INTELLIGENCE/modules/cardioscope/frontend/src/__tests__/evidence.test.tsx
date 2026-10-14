import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { EvidencePage } from '../EvidencePage';
import { api, TARGETS, validateMetadata } from '../api';
import { METRICS, validateEvidence } from '../evidence';
import { savedEvidence } from './savedEvidence';
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('presents exact saved final metrics, uncertainty, counts and correctly oriented matrices',async()=>{
  vi.spyOn(api,'evidence').mockResolvedValue(savedEvidence);
  render(<EvidencePage active metadata={null}/>);
  await screen.findByRole('heading',{name:'Final holdout — 61 records'});
  for(const t of TARGETS){
    const card=document.querySelector(`[data-evidence-target="${t}"]`)!;
    for(const [key] of METRICS) expect(within(card as HTMLElement).getAllByText(savedEvidence.targets[t].metrics[key].toFixed(3)).length).toBeGreaterThan(0);
    const interval=savedEvidence.targets[t].uncertainty.intervals.roc_auc.interval!;
    expect(card.textContent).toContain(interval.map(n=>n.toFixed(3)).join('–'));
  }
  const matrices=document.querySelectorAll('.matrix-card');
  TARGETS.forEach((t,i)=>{
    const cells=[...matrices[i].querySelectorAll('tbody td strong')].map(n=>Number(n.textContent));
    expect(cells).toEqual(savedEvidence.targets[t].metrics.confusion_matrix.flat());
    expect(matrices[i].querySelector('.false-negative')?.textContent).toContain('False negative');
  });
  expect(screen.getByText(/19 of 24 positive records were missed/)).toBeTruthy();
  expect(screen.getByText(/15 of 21 positive records were missed/)).toBeTruthy();
  expect(screen.getAllByText(/C=0.1 · balanced/)).toHaveLength(2);
  expect(screen.getByText(/depth 3 · minimum leaf 10/)).toBeTruthy();
  expect(screen.getByText(/depth 5 · minimum leaf 10/)).toBeTruthy();
  expect(screen.getByText(/Authoritative patient IDs are unavailable/)).toBeTruthy();
  expect(screen.getByText(/anatomical model is reference anatomy/)).toBeTruthy();
  expect(screen.getByText(/model cannot identify lesion location/)).toBeTruthy();
  expect(screen.getByText(/Nested CV evaluated the model-selection procedure/)).toBeTruthy();
  expect(screen.getByRole('heading',{name:'Limitations that matter'})).toBeTruthy();
});
it('rejects development substitutions, mislabeled phases, corrupt matrices and missing intervals',()=>{
  expect(validateEvidence(savedEvidence)).toBe(savedEvidence);
  for(const mutate of [
    (d:typeof savedEvidence)=>{d.phase='DEVELOPMENT' as never;},
    (d:typeof savedEvidence)=>{d.records.holdout=242;},
    (d:typeof savedEvidence)=>{d.targets.CAD.metrics.roc_auc=d.targets.CAD.development_roc_auc.development_nested_cv_mean;},
    (d:typeof savedEvidence)=>{d.targets.LCX.metrics.confusion_matrix[1][0]=0;},
    (d:typeof savedEvidence)=>{d.targets.RCA.definition.positive_class='Normal';},
    (d:typeof savedEvidence)=>{d.targets.CAD.uncertainty.intervals.roc_auc.interval=[NaN,1];},
  ]){const d=structuredClone(savedEvidence);mutate(d);expect(()=>validateEvidence(d)).toThrow();}
});
it('loads lazily and exposes failures without invented performance values',async()=>{
  const spy=vi.spyOn(api,'evidence').mockRejectedValue(new Error('Checksum failed'));
  const view=render(<EvidencePage active={false} metadata={null}/>);expect(spy).not.toHaveBeenCalled();
  view.rerender(<EvidencePage active metadata={null}/>);
  expect((await screen.findByRole('alert')).textContent).toContain('Checksum failed');
  expect(document.querySelector('.performance-card')).toBeNull();
});
it('validates trusted application metadata structure',()=>{
  expect(()=>validateMetadata({} as never)).toThrow();
});
