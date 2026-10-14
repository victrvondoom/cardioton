/**
 * PixelToHeart — the signature CardioTwin transition.
 *
 * A flat field of ramp-coloured squares scatters, assembles into an original
 * pixel heart, holds briefly, then dissolves — revealing the real scientific
 * 3D viewer that stays mounted underneath the whole time. The pixel heart is
 * a stylised preview, explicitly labelled as not a medical reconstruction;
 * the underlying renderer is never torn down or recreated.
 */
import clsx from "clsx";

import { useEffect, useMemo, useRef, useState } from "react";

import type { CSSProperties } from "react";

import { HEART_BITMAP } from "./bitmaps";
import { usePrefersReducedMotion } from "./core__src_pixel__hooks";
import { mulberry32 } from "./spring";
import { DEFAULT_BITMAP_PALETTE, pixelCssVar, PIXEL_COLOR_NAMES, type PixelColorName } from "./core__src_pixel__tokens";

interface Cell {
  x: number;
  y: number;
  color: PixelColorName;
  scatterX: number;
  scatterY: number;
  scatterColor: PixelColorName;
  delay: number;
}

type Phase = "scatter" | "assemble" | "hold" | "dissolve" | "done";

export interface PixelToHeartProps {
  /** Edge length of one cell in px. */
  cell?: number;
  /** Play automatically on mount. Default true. */
  autoplay?: boolean;
  /** How long the assembled heart holds, in ms. */
  holdMs?: number;
  onDone?: () => void;
  className?: string;
  style?: CSSProperties;
}

export function PixelToHeart({
  cell = 10,
  autoplay = true,
  holdMs = 900,
  onDone,
  className,
  style,
}: PixelToHeartProps) {
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState<Phase>("scatter");
  const timers = useRef<number[]>([]);

  const cells = useMemo<Cell[]>(() => {
    const rand = mulberry32(4711);
    const out: Cell[] = [];
    HEART_BITMAP.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const symbol = row[x];
        const colorName = DEFAULT_BITMAP_PALETTE[symbol];
        if (!colorName) continue;
        out.push({
          x,
          y,
          color: colorName,
          scatterX: Math.round((rand() - 0.5) * 480),
          scatterY: Math.round((rand() - 0.5) * 320),
          scatterColor: PIXEL_COLOR_NAMES[Math.floor(rand() * PIXEL_COLOR_NAMES.length)],
          delay: Math.round(Math.hypot(x - 8, y - 7) * 26),
        });
      }
    });
    return out;
  }, []);

  const cols = HEART_BITMAP[0].length;
  const rows = HEART_BITMAP.length;

  useEffect(() => {
    if (reduced) {
      setPhase("done");
      onDone?.();
      return;
    }
    if (!autoplay) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase("scatter");
    timers.current.push(window.setTimeout(() => setPhase("assemble"), 520));
    timers.current.push(window.setTimeout(() => setPhase("hold"), 1180));
    timers.current.push(window.setTimeout(() => setPhase("dissolve"), 1180 + holdMs));
    timers.current.push(
      window.setTimeout(() => {
        setPhase("done");
        onDone?.();
      }, 1180 + holdMs + 620),
    );
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, autoplay, holdMs]);

  if (phase === "done") return null;

  return (
    <div
      className={clsx("absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface-bg", className)}
      style={style}
      role="status"
      aria-label="Stylised pixel preview assembling — not a medical reconstruction"
    >
      <span className="relative inline-block" style={{ width: cols * cell, height: rows * cell }}>
        {cells.map((c, i) => {
          const scattered = phase === "scatter";
          const dissolving = phase === "dissolve";
          return (
            <span
              key={i}
              className="pixel-tile absolute"
              style={{
                left: c.x * cell,
                top: c.y * cell,
                width: cell,
                height: cell,
                background: pixelCssVar(scattered ? c.scatterColor : c.color),
                transform: `translate(${scattered ? c.scatterX : 0}px, ${scattered ? c.scatterY : 0}px) scale(${scattered ? 0.4 : 1})`,
                opacity: dissolving ? 0 : 1,
                transition:
                  "transform 520ms cubic-bezier(0.2,0,0,1), background-color 520ms steps(4), opacity 320ms ease-out",
                transitionDelay: `${c.delay}ms`,
              }}
            />
          );
        })}
      </span>
      {phase === "hold" && (
        <span className="pixel-kicker mt-6">
          Stylised pixel preview — schematic, not a medical reconstruction
        </span>
      )}
    </div>
  );
}
