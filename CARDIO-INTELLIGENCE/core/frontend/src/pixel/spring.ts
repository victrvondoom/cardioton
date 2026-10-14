/**
 * Damped spring physics for the pixel engine.
 *
 * Conceptual model: F = -k·x - c·v (Hooke + damping), integrated with
 * semi-implicit Euler using a clamped delta time so motion stays stable
 * across frame rates and after tab sleeps.
 */

export interface SpringState {
  /** Current displacement from the resting position. */
  x: number;
  /** Current velocity. */
  v: number;
}

export const SPRING_DEFAULTS = { k: 220, c: 22 } as const;

export function createSpring(x = 0): SpringState {
  return { x, v: 0 };
}

/**
 * Advance the spring toward `target` by `dt` seconds and return the new
 * position. `dt` is clamped to 1/30 s to keep the integrator stable.
 */
export function stepSpring(
  state: SpringState,
  target: number,
  dt: number,
  k: number = SPRING_DEFAULTS.k,
  c: number = SPRING_DEFAULTS.c,
): number {
  const step = Math.min(Math.max(dt, 0), 1 / 30);
  const acceleration = -k * (state.x - target) - c * state.v;
  state.v += acceleration * step;
  state.x += state.v * step;
  return state.x;
}

/** True when the spring has practically settled at its target. */
export function springSettled(state: SpringState, target: number, epsilon = 0.01): boolean {
  return Math.abs(state.x - target) < epsilon && Math.abs(state.v) < epsilon;
}

/** Deterministic pseudo-random generator (mulberry32) — stable mosaics/tests. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
