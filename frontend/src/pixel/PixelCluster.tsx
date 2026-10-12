/** PixelCluster — renders a character bitmap as an arrangement of squares. */
import clsx from "clsx";

import type { CSSProperties } from "react";

import { DEFAULT_BITMAP_PALETTE, GRID_UNIT, pixelCssVar, type PixelColorName } from "./tokens";

export interface PixelClusterProps {
  /** Bitmap rows; each character maps through `palette`. */
  map: readonly string[];
  palette?: Record<string, PixelColorName | string | null>;
  /** Edge length of one cell in px. Defaults to the 8px grid unit. */
  cell?: number;
  /** Gap between cells in px. */
  gap?: number;
  /** Staggered assemble animation on mount. */
  animate?: boolean;
  /** Per-cell stagger step in ms. */
  staggerMs?: number;
  /** Direction cells travel from when assembling. */
  direction?: "up" | "down" | "left" | "right" | "scale";
  className?: string;
  style?: CSSProperties;
  /** Accessible label — the cluster is decorative unless labelled. */
  ariaLabel?: string;
}

export function PixelCluster({
  map,
  palette = DEFAULT_BITMAP_PALETTE,
  cell = GRID_UNIT,
  gap = 0,
  animate = false,
  staggerMs = 14,
  direction = "scale",
  className,
  style,
  ariaLabel,
}: PixelClusterProps) {
  const rows = map.length;
  const cols = map.reduce((max, row) => Math.max(max, row.length), 0);
  const pitch = cell + gap;
  const from =
    direction === "up" ? { x: 0, y: -cell }
    : direction === "down" ? { x: 0, y: cell }
    : direction === "left" ? { x: -cell, y: 0 }
    : direction === "right" ? { x: cell, y: 0 }
    : { x: 0, y: 0 };

  const cells: React.ReactNode[] = [];
  map.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const symbol = row[x];
      const colorName = palette[symbol];
      if (!colorName) continue;
      const index = y * cols + x;
      cells.push(
        <span
          key={`${x}-${y}`}
          className={clsx("pixel-tile", animate && "pixel-cell")}
          style={{
            position: "absolute",
            left: x * pitch,
            top: y * pitch,
            width: cell,
            height: cell,
            background: pixelCssVar(colorName),
            ...(animate
              ? {
                  ["--px-delay" as string]: `${index * staggerMs}ms`,
                  ["--px-from-x" as string]: `${from.x}px`,
                  ["--px-from-y" as string]: `${from.y}px`,
                }
              : null),
          }}
        />,
      );
    }
  });

  return (
    <span
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={clsx("relative inline-block shrink-0", className)}
      style={{ width: cols * pitch - gap, height: rows * pitch - gap, ...style }}
    >
      {cells}
    </span>
  );
}
