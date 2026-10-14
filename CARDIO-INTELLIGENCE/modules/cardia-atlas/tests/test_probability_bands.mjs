import assert from 'node:assert/strict';
import { bandForProbability } from '../app/static/risk_bands.mjs';

for (const [probability, expected] of [
  [0, 'low'],
  [0.329999999, 'low'],
  [0.33, 'moderate'],
  [0.669999999, 'moderate'],
  [0.67, 'high'],
  [1, 'high'],
]) {
  assert.equal(bandForProbability(probability), expected, `${probability} → ${expected}`);
}
for (const invalid of [-0.0001, 1.0001, Number.NaN, Number.POSITIVE_INFINITY]) {
  assert.throws(() => bandForProbability(invalid), RangeError);
}
console.log('Continuous probability band boundary checks passed.');
