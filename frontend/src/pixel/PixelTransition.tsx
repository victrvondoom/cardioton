/**
 * PixelTransition — the shared route transition.
 *
 * On navigation a diagonal band of near-black squares sweeps across a fixed
 * overlay canvas, edged with a thin line of pixel-orange squares — a geometric
 * mask reveal rather than a fade. Fast (~460 ms), transform-free, and skipped
 * entirely under prefers-reduced-motion.
 */
import { useEffect, useRef } from "react";

import { usePrefersReducedMotion } from "./hooks";
import { pixelCanvasColor, resetPixelCanvasPalette } from "./tokens";

const CELL = 16;
const DURATION_MS = 460;

export function PixelTransition({ locationKey }: { locationKey: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const first = useRef(true);

  useEffect(() => {
    if (reduced) return;
    if (first.current) {
      first.current = false;
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    resetPixelCanvasPalette();

    const cols = Math.ceil(width / CELL);
    const rows = Math.ceil(height / CELL);
    const diagonal = cols + rows;
    const start = performance.now();
    let raf = 0;

    const draw = (now: number) => {
      const t = Math.min((now - start) / DURATION_MS, 1.25);
      ctx.clearRect(0, 0, width, height);
      if (t <= 1) {
        const bg = pixelCanvasColor("orange");
        ctx.fillStyle = "rgb(13 14 16)"; // matches --surface-bg (#0D0E10)
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const phase = (col + row) / diagonal;
            if (phase <= t && phase > t - 0.22) {
              ctx.fillRect(col * CELL, row * CELL, CELL - 1, CELL - 1);
              // Leading edge: a single orange square per column of the wave.
              if (phase > t - 0.22 && phase <= t - 0.22 + 1 / diagonal) {
                ctx.fillStyle = bg;
                ctx.fillRect(col * CELL, row * CELL, CELL - 1, CELL - 1);
                ctx.fillStyle = "rgb(13 14 16)";
              }
            }
          }
        }
      }
      if (t < 1.25) raf = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, width, height);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [locationKey, reduced]);

  if (reduced) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[70]"
      style={{ opacity: 0.9 }}
    />
  );
}
