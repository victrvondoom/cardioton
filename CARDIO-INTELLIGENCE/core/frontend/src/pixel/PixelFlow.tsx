/**
 * PixelFlow — event-driven square-particle streams along horizontal lanes.
 *
 * Unlike PixelField (an ambient interactive layer), PixelFlow spawns nothing
 * on its own: squares appear only while a lane is `active` — activity comes
 * from real events (a running agent, a completed invocation, an error) —
 * or from an explicit `emit()` burst. Particles are grid-snapped squares
 * travelling from `fromX` to `toX`; they die at the lane end. The loop runs
 * only while there is something to draw, pauses offscreen / when the tab is
 * hidden, and never starts under prefers-reduced-motion.
 *
 * Lanes are declared in a `viewWidth` × `viewHeight` coordinate space (e.g.
 * the same viewBox as an SVG sibling) and are projected into canvas space, so
 * the overlay always lines up with the underlying diagram at any scale.
 */
import clsx from "clsx";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import { usePrefersReducedMotion } from "./core__src_pixel__hooks";
import { mulberry32 } from "./spring";
import { GRID_UNIT, pixelCanvasColor, resetPixelCanvasPalette, type PixelColorName } from "./core__src_pixel__tokens";

export interface PixelFlowLane {
  /** Lane geometry in view coordinates. */
  y: number;
  fromX: number;
  toX: number;
  /** Spawn squares only while active — driven by real events, never ambient. */
  active: boolean;
  color: PixelColorName;
  /** Squares per second while active. */
  rate?: number;
  /** Travel speed in view units per second. */
  speed?: number;
}

export interface PixelFlowHandle {
  /** Spawn a burst of squares at canvas coordinates. */
  emit: (x: number, y: number, color?: PixelColorName, count?: number) => void;
  /** Project view coordinates to canvas coordinates. */
  project: (x: number, y: number) => { x: number; y: number };
}

export interface PixelFlowProps {
  lanes: readonly PixelFlowLane[];
  /** View-space width the lanes are declared in (e.g. an SVG viewBox). */
  viewWidth?: number;
  /** View-space height the lanes are declared in. */
  viewHeight?: number;
  className?: string;
  opacity?: number;
  /** Hard cap on simultaneously live particles. */
  maxParticles?: number;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  color: PixelColorName;
  vx: number;
  vy: number;
  life: number;
  burst: boolean;
}

const MAX_DT = 1 / 30;

export const PixelFlow = forwardRef<PixelFlowHandle, PixelFlowProps>(function PixelFlow(
  { lanes, viewWidth = 0, viewHeight = 0, className, opacity = 0.9, maxParticles = 160 },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const stateRef = useRef<{
    particles: Particle[];
    raf: number;
    running: boolean;
    width: number;
    height: number;
    dpr: number;
    scale: number;
    offsetX: number;
    offsetY: number;
    debt: number[];
  } | null>(null);

  const lanesRef = useRef(lanes);
  lanesRef.current = lanes;
  const configRef = useRef({ viewWidth, viewHeight, maxParticles, opacity });
  configRef.current = { viewWidth, viewHeight, maxParticles, opacity };

  function project(x: number, y: number): { x: number; y: number } {
    const state = stateRef.current;
    if (!state) return { x, y };
    return {
      x: state.offsetX + x * state.scale,
      y: state.offsetY + y * state.scale,
    };
  }

  useImperativeHandle(ref, () => ({
    emit(x, y, color = "orange", count = 8) {
      const state = stateRef.current;
      if (!state || reduced) return;
      const rand = mulberry32(Date.now() & 0xffffffff);
      for (let i = 0; i < count; i++) {
        const angle = rand() * Math.PI * 2;
        const speed = 40 + rand() * 110;
        state.particles.push({
          x,
          y,
          size: rand() > 0.5 ? GRID_UNIT : GRID_UNIT / 2,
          color,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.8 + rand() * 0.6,
          burst: true,
        });
      }
      while (state.particles.length > configRef.current.maxParticles) state.particles.shift();
      if (!state.running) startLoop();
    },
    project,
  }), [reduced]);

  function resize() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Measure the canvas itself so an explicit CSS width (e.g. wider than the
    // visible box inside a horizontal scroller) is honoured.
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const state = stateRef.current;
    if (state) {
      state.width = rect.width;
      state.height = rect.height;
      state.dpr = dpr;
      const { viewWidth: vw, viewHeight: vh } = configRef.current;
      if (vw > 0 && vh > 0) {
        // Uniform scale-to-fit, centred — mirrors SVG preserveAspectRatio="xMidYMid meet".
        state.scale = Math.min(rect.width / vw, rect.height / vh);
      } else {
        state.scale = 1;
      }
      state.offsetX = (rect.width - vw * state.scale) / 2;
      state.offsetY = (rect.height - vh * state.scale) / 2;
    }
  }

  function drawFrame(dt: number) {
    const canvas = canvasRef.current;
    const state = stateRef.current;
    if (!canvas || !state) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height, dpr, particles } = state;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Spawn from active lanes — the only ambient source, and it is real activity.
    const currentLanes = lanesRef.current;
    for (let i = 0; i < currentLanes.length; i++) {
      const lane = currentLanes[i];
      if (!lane.active) {
        state.debt[i] = 0;
        continue;
      }
      const rate = lane.rate ?? 5;
      const speed = lane.speed ?? 160;
      state.debt[i] = (state.debt[i] ?? 0) + dt * rate;
      while (state.debt[i] >= 1) {
        state.debt[i] -= 1;
        const dir = lane.toX >= lane.fromX ? 1 : -1;
        const start = project(lane.fromX, lane.y);
        state.particles.push({
          x: start.x,
          y: start.y,
          size: GRID_UNIT / 2,
          color: lane.color,
          vx: dir * speed * state.scale,
          vy: 0,
          life: 1,
          burst: false,
        });
        if (state.particles.length > configRef.current.maxParticles) state.particles.shift();
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (p.burst) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.pow(0.3, dt);
        p.vy *= Math.pow(0.3, dt);
        p.life -= dt;
        if (p.life <= 0 || p.x < -20 || p.y < -20 || p.x > width + 20 || p.y > height + 20) {
          particles.splice(i, 1);
          continue;
        }
      } else {
        p.x += p.vx * dt;
        // Stream particles die at the lane end.
        const end = project(laneEndX(currentLanes, p), p.y);
        const pastEnd = p.vx >= 0 ? p.x >= end.x : p.x <= end.x;
        if (pastEnd) {
          particles.splice(i, 1);
          continue;
        }
      }
      const alpha = configRef.current.opacity * (p.burst ? Math.max(0, Math.min(1, p.life)) : 0.9);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pixelCanvasColor(p.color);
      ctx.fillRect(
        Math.round(p.x / (GRID_UNIT / 2)) * (GRID_UNIT / 2),
        Math.round(p.y / (GRID_UNIT / 2)) * (GRID_UNIT / 2),
        p.size,
        p.size,
      );
    }
    ctx.globalAlpha = 1;

    if (particles.length === 0 && !currentLanes.some((l) => l.active)) stopLoop();
  }

  /** Find which lane a stream particle belongs to (nearest lane y). */
  function laneEndX(lanesList: readonly PixelFlowLane[], p: Particle): number {
    let best: PixelFlowLane | null = null;
    let bestDist = Infinity;
    for (const lane of lanesList) {
      const c = project(lane.y, 0).y;
      const dist = Math.abs(c - p.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = lane;
      }
    }
    return best ? best.toX : p.x;
  }

  function startLoop() {
    const state = stateRef.current;
    if (!state || state.running || reduced) return;
    state.running = true;
    let last = performance.now();
    const frame = (now: number) => {
      const s = stateRef.current;
      if (!s || !s.running) return;
      const dt = Math.min((now - last) / 1000, MAX_DT);
      last = now;
      drawFrame(dt);
      if (s.running) s.raf = requestAnimationFrame(frame);
    };
    state.raf = requestAnimationFrame(frame);
  }

  function stopLoop() {
    const state = stateRef.current;
    if (!state) return;
    state.running = false;
    if (state.raf) cancelAnimationFrame(state.raf);
  }

  // Lanes becoming active must wake the loop even without an emit().
  useEffect(() => {
    if (reduced) return;
    if (lanes.some((l) => l.active)) startLoop();
    else stopLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lanes, reduced]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    stateRef.current = {
      particles: [],
      raf: 0,
      running: false,
      width: 0,
      height: 0,
      dpr: 1,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      debt: [],
    };
    resetPixelCanvasPalette();
    resize();

    const parent = canvas.parentElement;
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver === "function" && parent) {
      resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(parent);
    }

    let viewObserver: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "function") {
      viewObserver = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && !document.hidden) startLoop();
        else stopLoop();
      });
      viewObserver.observe(canvas);
    }

    const onVisibility = () => {
      if (document.hidden) stopLoop();
      else if (lanesRef.current.some((l) => l.active) || (stateRef.current?.particles.length ?? 0) > 0) startLoop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const themeObserver =
      typeof MutationObserver === "function"
        ? new MutationObserver(() => resetPixelCanvasPalette())
        : null;
    themeObserver?.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    if (!reduced && lanesRef.current.some((l) => l.active)) startLoop();

    return () => {
      stopLoop();
      resizeObserver?.disconnect();
      viewObserver?.disconnect();
      themeObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      stateRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      className={clsx("pointer-events-none absolute inset-0", className)}
      style={{ opacity }}
      aria-hidden="true"
    />
  );
});
