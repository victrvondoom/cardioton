/** PixelMosaic — a controlled field of ramp-coloured squares. */
import clsx from "clsx";

import { useMemo } from "react";

import type { CSSProperties } from "react";

import { matrixToBitmap, mosaicField } from "./bitmaps";
import { PixelCluster } from "./PixelCluster";
import { GRID_UNIT, type PixelColorName } from "./tokens";
import { useInView } from "./hooks";

export interface PixelMosaicProps {
  /** Explicit colour matrix; when omitted a deterministic field is generated. */
  matrix?: readonly (PixelColorName | string | null)[][];
  cols?: number;
  rows?: number;
  /** Fill probability for the generated field (0–1). */
  density?: number;
  /** Deterministic seed for the generated field. */
  seed?: number;
  /** Edge length of one cell in px. */
  cell?: number;
  gap?: number;
  /** Staggered reveal. */
  animate?: boolean;
  /** Reveal on mount or when scrolled into view. */
  reveal?: "mount" | "intersect";
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

export function PixelMosaic({
  matrix,
  cols = 24,
  rows = 10,
  density = 0.16,
  seed = 7,
  cell = GRID_UNIT,
  gap = 0,
  animate = true,
  reveal = "mount",
  className,
  style,
  ariaLabel,
}: PixelMosaicProps) {
  const generated = useMemo(
    () => matrix ?? mosaicField(cols, rows, density, seed),
    [matrix, cols, rows, density, seed],
  );
  const { map, palette } = useMemo(() => matrixToBitmap(generated), [generated]);
  const [ref, inView] = useInView<HTMLSpanElement>();
  const play = animate && (reveal === "mount" || inView);
  return (
    <span ref={ref} className={clsx("inline-block", className)} style={style}>
      <PixelCluster
        map={map}
        palette={palette}
        cell={cell}
        gap={gap}
        animate={play}
        staggerMs={6}
        ariaLabel={ariaLabel}
      />
    </span>
  );
}
