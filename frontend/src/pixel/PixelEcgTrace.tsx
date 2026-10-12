/** PixelEcgTrace — a square-stepped ECG-style trace rendered as crisp SVG. */
import clsx from "clsx";

import { useId, useMemo } from "react";

import { ecgStepPath } from "./bitmaps";
import { pixelCssVar, type PixelColorName } from "./tokens";

export interface PixelEcgMarker {
  /** Position along the trace, 0–1. */
  at: number;
  color?: PixelColorName | string;
}

export interface PixelEcgTraceProps {
  beats?: number;
  width?: number;
  height?: number;
  color?: PixelColorName | string;
  /** Pixel-square markers placed along the trace (detected events). */
  markers?: PixelEcgMarker[];
  /** Draw the trace in on mount. */
  animate?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function PixelEcgTrace({
  beats = 3,
  width = 480,
  height = 64,
  color = "orange",
  markers = [],
  animate = false,
  className,
  ariaLabel = "Stepped waveform trace",
}: PixelEcgTraceProps) {
  const path = useMemo(() => ecgStepPath(width, height, beats), [width, height, beats]);
  const clipId = useId();
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={clsx("pixel-ecg block w-full", className)}
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
    >
      {animate && (
        <clipPath id={clipId}>
          <rect x={0} y={0} width={width} height={height}>
            <animate attributeName="width" from={0} to={width} dur="1.6s" fill="freeze" />
          </rect>
        </clipPath>
      )}
      <path
        d={path}
        fill="none"
        stroke={pixelCssVar(color)}
        strokeWidth={2}
        clipPath={animate ? `url(#${clipId})` : undefined}
      />
      {markers.map((marker, i) => {
        const x = Math.round(marker.at * width / 8) * 8;
        return (
          <rect
            key={i}
            x={x - 2}
            y={height * 0.62 - 2}
            width={4}
            height={4}
            fill={pixelCssVar(marker.color ?? "yellow")}
          >
            <title>Event marker</title>
          </rect>
        );
      })}
    </svg>
  );
}
