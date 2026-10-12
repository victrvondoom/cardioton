/** PixelStaircase — ascending square steps built from the pixel ramp. */
import clsx from "clsx";

import { useMemo } from "react";

import type { CSSProperties } from "react";

import { staircaseBitmap } from "./bitmaps";
import { PixelCluster } from "./PixelCluster";
import { PIXEL_UNIT, PIXEL_COLOR_NAMES, type PixelColorName } from "./tokens";

export interface PixelStaircaseProps {
  steps?: number;
  cell?: number;
  colors?: readonly PixelColorName[];
  animate?: boolean;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

export function PixelStaircase({
  steps = 6,
  cell = PIXEL_UNIT,
  colors = PIXEL_COLOR_NAMES,
  animate = true,
  className,
  style,
  ariaLabel,
}: PixelStaircaseProps) {
  const map = useMemo(() => staircaseBitmap(steps, colors), [steps, colors]);
  return (
    <PixelCluster
      map={map}
      cell={cell}
      animate={animate}
      staggerMs={60}
      direction="up"
      className={clsx(className)}
      style={style}
      ariaLabel={ariaLabel}
    />
  );
}
