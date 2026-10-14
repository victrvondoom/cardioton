/**
 * Pixel engine tokens — the five-colour square ramp that carries the
 * interface, plus helpers to resolve colours in DOM (CSS variables, theme
 * aware) and on canvas (computed values).
 *
 * These are CardioTwin design proposals for the pixel-native identity; the
 * values mirror the `--pixel-*` custom properties in src/styles/index.css.
 */

export const PIXEL_COLORS = {
  red: "#F0442B",
  orange: "#FF7900",
  yellow: "#FFB400",
  blue: "#39A9E8",
  green: "#59DFA6",
} as const;

export type PixelColorName = keyof typeof PIXEL_COLORS;

export const PIXEL_COLOR_NAMES: readonly PixelColorName[] = ["red", "orange", "yellow", "blue", "green"];

/** Atomic units of the pixel geometry system. */
export const PIXEL_UNIT = 16;
export const GRID_UNIT = 8;

/** Default bitmap palette: character → pixel colour name. "." is empty. */
export const DEFAULT_BITMAP_PALETTE: Record<string, PixelColorName | null> = {
  r: "red",
  o: "orange",
  y: "yellow",
  b: "blue",
  g: "green",
  ".": null,
};

/** CSS variable reference for a pixel colour (theme aware in DOM). */
export function pixelCssVar(color: PixelColorName | string): string {
  if (color in PIXEL_COLORS) return `rgb(var(--pixel-${color}))`;
  return color;
}

let canvasPaletteCache: Partial<Record<PixelColorName, string>> | null = null;
let canvasInkCache: string | null = null;

/** Reset cached canvas colours (call when the theme class changes). */
export function resetPixelCanvasPalette(): void {
  canvasPaletteCache = null;
  canvasInkCache = null;
}

function readCssTriplet(name: string): string {
  if (typeof window === "undefined" || typeof document === "undefined") return "";
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  // Custom properties are declared as space-separated RGB triplets ("240 68 43").
  const parts = raw.split(/\s+/).map(Number);
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    return `rgb(${parts[0]} ${parts[1]} ${parts[2]})`;
  }
  return raw;
}

/** Literal colour for canvas rendering, resolved from the live theme. */
export function pixelCanvasColor(color: PixelColorName | string): string {
  if (!(color in PIXEL_COLORS)) return color;
  const name = color as PixelColorName;
  if (!canvasPaletteCache) canvasPaletteCache = {};
  return (canvasPaletteCache[name] ??= readCssTriplet(`--pixel-${name}`) || PIXEL_COLORS[name]);
}

/** Ink colour (headline text) for canvas, resolved from the live theme. */
export function pixelCanvasInk(): string {
  return (canvasInkCache ??= readCssTriplet("--ink-primary") || "#F7F7F4");
}
