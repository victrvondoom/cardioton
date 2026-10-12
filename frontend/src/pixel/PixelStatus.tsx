/** PixelStatus — square status indicator for agent / task / pipeline states. */
import clsx from "clsx";

import { GRID_UNIT } from "./tokens";

export type PixelStatusKind =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "awaiting"
  | "canceled"
  | "idle";

export const PIXEL_STATUS_LABELS: Record<PixelStatusKind, string> = {
  queued: "Queued",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  awaiting: "Awaiting approval",
  canceled: "Canceled",
  idle: "Idle",
};

export interface PixelStatusProps {
  state: PixelStatusKind;
  size?: number;
  /** Show the textual label beside the square. */
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export function PixelStatus({ state, size = GRID_UNIT, showLabel = false, label, className }: PixelStatusProps) {
  const pulsing = state === "running" || state === "queued";
  return (
    <span
      role="status"
      className={clsx("inline-flex items-center gap-2", className)}
      title={label ?? PIXEL_STATUS_LABELS[state]}
    >
      <span
        className={clsx("pixel-status", `pixel-status--${state}`, pulsing && "pixel-blink")}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
      {showLabel && (
        <span className="text-mono-tech text-[10px] uppercase tracking-[0.08em] text-ink-muted">
          {label ?? PIXEL_STATUS_LABELS[state]}
        </span>
      )}
    </span>
  );
}
