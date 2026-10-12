/** PixelTile — a single square of the pixel geometry system. */
import clsx from "clsx";

import type { CSSProperties } from "react";

import { GRID_UNIT, PIXEL_UNIT, pixelCssVar, type PixelColorName } from "./tokens";

export interface PixelTileProps {
  /** Edge length in px. Defaults to the 16px pixel unit. */
  size?: number;
  /** Pixel ramp colour (or any CSS colour). Defaults to orange. */
  color?: PixelColorName | string;
  className?: string;
  style?: CSSProperties;
  /** One-shot entry animation. */
  enter?: "none" | "fade" | "rise" | "drop" | "pop";
  /** Entry animation delay in ms. */
  delay?: number;
  title?: string;
}

export function PixelTile({
  size = PIXEL_UNIT,
  color = "orange",
  className,
  style,
  enter = "none",
  delay = 0,
  title,
}: PixelTileProps) {
  const from =
    enter === "rise" ? { ["--px-from-y" as string]: `-${GRID_UNIT}px` }
    : enter === "drop" ? { ["--px-from-y" as string]: `${GRID_UNIT}px` }
    : enter === "pop" ? {}
    : { ["--px-from-x" as string]: "0px", ["--px-from-y" as string]: "0px" };
  return (
    <span
      aria-hidden={title ? undefined : true}
      title={title}
      className={clsx("pixel-tile", enter !== "none" && enter !== "fade" && "pixel-cell", className)}
      style={{
        width: size,
        height: size,
        background: pixelCssVar(color),
        opacity: enter === "fade" ? 0 : undefined,
        animationDelay: enter === "fade" ? undefined : `${delay}ms`,
        ...(enter === "fade"
          ? { animation: `pixel-cell-in 360ms cubic-bezier(0.2,0,0,1) ${delay}ms both` }
          : from),
        ...style,
      }}
    />
  );
}
