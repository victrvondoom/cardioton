export function bandForProbability(probability) {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new RangeError('Probability must be finite and in [0, 1].');
  }
  if (probability < 0.33) return 'low';
  if (probability < 0.67) return 'moderate';
  return 'high';
}
