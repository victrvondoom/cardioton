/** PixelPulse — a one-shot square pulse, retriggered by changing `fire`. */
import clsx from "clsx";

import { pixelCssVar, GRID_UNIT, type PixelColorName } from "./tokens";

export interface PixelPulseProps {
  /** Increment to fire another pulse. */
  fire: number;
  size?: number;
  color?: PixelColorName | string;
  className?: string;
}

export function PixelPulse({ fire, size = GRID_UNIT, color = "orange", className }: PixelPulseProps) {
  return (
    <span className={clsx("relative inline-block", className)} style={{ width: size, height: size }} aria-hidden="true">
      <span
        className="pixel-tile absolute inset-0"
        style={{ background: pixelCssVar(color) }}
      />
      <span
        key={fire}
        className="pixel-tile absolute inset-0 pixel-pulse-once"
        style={{ background: pixelCssVar(color) }}
      />
    </span>
  );
}
