/**
 * Original CardioTwin pixel bitmaps and generators.
 *
 * A bitmap is an array of equal-length strings; each character maps through
 * a palette (`r` red, `o` orange, `y` yellow, `b` blue, `g` green, `.` empty).
 * All artwork here is original — square-based compositions representing the
 * cardiovascular system, not reproductions of any third-party asset.
 */
import { mulberry32 } from "./spring";
import { PIXEL_COLOR_NAMES, type PixelColorName } from "./tokens";

/** Original pixel heart — red field with an orange highlight block. */
export const HEART_BITMAP: readonly string[] = [
  ".....rr...rr.....",
  "....rrrr.rrrr....",
  "...rrro..rrrrr...",
  "..rrroooooooooo..",
  ".rrooooooooooooo.",
  "rrrrrrrrrrrrrrrrr",
  "rrrrrrrrrrrrrrrrr",
  ".rrrrrrrrrrrrrrr.",
  "..rrrrrrrrrrrrr..",
  "...rrrrrrrrrrr...",
  "....rrrrrrrrr....",
  ".....rrrrrrr.....",
  "......rrrrr......",
  ".......rrr.......",
  "........r........",
];

/** Original pixel globe — blue outline with equator and meridian graticule. */
export function globeBitmap(size = 21): string[] {
  const rows: string[] = [];
  const c = (size - 1) / 2;
  const r = c;
  for (let y = 0; y < size; y++) {
    let row = "";
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      const onOutline = Math.abs(d - r) <= 0.7;
      const onEquator = y === Math.round(c);
      const onMeridian = x === Math.round(c);
      row += onOutline || onEquator || onMeridian ? "b" : ".";
    }
    rows.push(row);
  }
  return rows;
}

/** Original staircase — ascending square steps, colours cycling the ramp. */
export function staircaseBitmap(steps: number, colors: readonly PixelColorName[] = PIXEL_COLOR_NAMES): string[] {
  const rows: string[] = [];
  for (let y = 0; y < steps; y++) {
    let row = "";
    for (let x = 0; x < steps; x++) {
      // Step i occupies column x and rows y >= steps-1-i (ascending to the right).
      const stepIndex = steps - 1 - y;
      row += x <= stepIndex ? colors[x % colors.length].charAt(0) : ".";
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Deterministic mosaic field — a sparse arrangement of ramp-coloured squares
 * over empty cells. Used for hero backdrops; the seed keeps it stable between
 * renders and test runs.
 */
export function mosaicField(
  cols: number,
  rows: number,
  density = 0.16,
  seed = 7,
): (PixelColorName | null)[][] {
  const rand = mulberry32(seed);
  const weights: readonly (readonly [PixelColorName, number])[] = [
    ["orange", 0.34],
    ["red", 0.22],
    ["yellow", 0.16],
    ["blue", 0.16],
    ["green", 0.12],
  ];
  const out: (PixelColorName | null)[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: (PixelColorName | null)[] = [];
    for (let x = 0; x < cols; x++) {
      if (rand() >= density) {
        row.push(null);
        continue;
      }
      const pick = rand();
      let acc = 0;
      let color: PixelColorName = "orange";
      for (const [name, weight] of weights) {
        acc += weight;
        if (pick <= acc) {
          color = name;
          break;
        }
      }
      row.push(color);
    }
    out.push(row);
  }
  return out;
}

/** Convert a colour matrix into bitmap strings + palette for PixelCluster. */
export function matrixToBitmap(matrix: readonly (PixelColorName | string | null)[][]): {
  map: string[];
  palette: Record<string, PixelColorName | string | null>;
} {
  const symbols = ["r", "o", "y", "b", "g", "w", "k", "1", "2", "3"];
  const palette: Record<string, PixelColorName | string | null> = { ".": null };
  const used = new Set<string>();
  for (const row of matrix) for (const cell of row) if (cell) used.add(String(cell));
  const assigned = new Map<string, string>();
  let next = 0;
  for (const color of used) {
    const symbol = symbols[next++ % symbols.length];
    assigned.set(color, symbol);
    palette[symbol] = color;
  }
  const map = matrix.map((row) =>
    row.map((cell) => (cell == null ? "." : assigned.get(String(cell)) ?? ".")).join(""),
  );
  return { map, palette };
}

/* ---------------------------------------------------------------------------
 * Stepped ECG trace — a PQRST-shaped waveform quantised to the square grid so
 * the rendered path only ever contains horizontal and vertical segments.
 * ------------------------------------------------------------------------- */

const BASELINE = 0.62; // fraction of height where the trace rests

function beatWave(u: number): number {
  // u in [0,1) — one cardiac cycle. Returns deviation from baseline (up = +).
  const gauss = (x: number, mu: number, sigma: number, amp: number) =>
    amp * Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma));
  return (
    gauss(u, 0.16, 0.035, 0.1) + // P wave
    gauss(u, 0.34, 0.012, -0.08) + // Q dip
    gauss(u, 0.385, 0.008, 0.95) + // R spike
    gauss(u, 0.435, 0.012, -0.24) + // S dip
    gauss(u, 0.62, 0.05, 0.2) // T wave
  );
}

/**
 * SVG path data for a pixel-stepped ECG trace. Only `M`, `H` and `V`
 * commands are emitted, so with `shape-rendering: crispEdges` the line reads
 * as square joints on the 8px grid.
 */
export function ecgStepPath(width: number, height: number, beats = 3, grid = 8): string {
  const baselineY = Math.round((height * BASELINE) / grid) * grid;
  const step = grid;
  const cols = Math.max(2, Math.floor(width / step));
  const points: [number, number][] = [];
  for (let i = 0; i <= cols; i++) {
    const u = (i / cols) * beats;
    const beat = u % 1;
    const rawY = baselineY - beatWave(beat) * height * 0.42;
    const y = Math.max(grid, Math.min(height - grid, Math.round(rawY / grid) * grid));
    points.push([i * step, y]);
  }
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i];
    d += ` H ${x} V ${y}`;
  }
  return d;
}
