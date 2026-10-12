/**
 * PixelField — an interactive canvas layer of square pixel particles.
 *
 * Particles are grid-snapped squares (never glowing circles). They drift
 * gently, are repelled by the pointer, and spring back to their home cell
 * (F = -kx - cv, delta-time integrated). The loop pauses when the layer is
 * offscreen or the tab is hidden, adapts to the device pixel ratio, and
 * renders a single static frame under prefers-reduced-motion.
 *
 * `emit()` spawns a burst of squares at a point — used for real workflow
 * events (agent activity, ECG markers), never for decoration.
 */
import clsx from "clsx";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import { usePrefersReducedMotion } from "./hooks";
import { createSpring, mulberry32, stepSpring } from "./spring";
import { GRID_UNIT, pixelCanvasColor, PIXEL_COLOR_NAMES, resetPixelCanvasPalette, type PixelColorName } from "./tokens";

export interface PixelFieldHandle {
  /** Spawn a burst of square particles at canvas coordinates. */
  emit: (x: number, y: number, color?: PixelColorName, count?: number) => void;
}

export interface PixelFieldProps {
  className?: string;
  /** Approximate particles per 20,000 px² of area. */
  density?: number;
  /** Hard cap on the particle count. */
  maxParticles?: number;
  /** Pointer repulsion. Default true. */
  interactive?: boolean;
  colors?: readonly PixelColorName[];
  opacity?: number;
}

interface Particle {
  hx: number;
  hy: number;
  x: number;
  y: number;
  size: number;
  color: PixelColorName;
  driftX: number;
  driftY: number;
  phase: number;
  // Spring state for the pointer-repulsion offset.
  ox: { x: number; v: number };
  oy: { x: number; v: number };
  burst: boolean;
  life: number;
}

const MAX_DT = 1 / 30;

export const PixelField = forwardRef<PixelFieldHandle, PixelFieldProps>(function PixelField(
  { className, density = 1, maxParticles = 90, interactive = true, colors = PIXEL_COLOR_NAMES, opacity = 0.85 },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const stateRef = useRef<{
    particles: Particle[];
    pointer: { x: number; y: number; active: boolean };
    raf: number;
    running: boolean;
    width: number;
    height: number;
    dpr: number;
  } | null>(null);

  useImperativeHandle(ref, () => ({
    emit(x, y, color = "orange", count = 10) {
      const state = stateRef.current;
      if (!state) return;
      const rand = mulberry32(Date.now() & 0xffffffff);
      for (let i = 0; i < count; i++) {
        const angle = rand() * Math.PI * 2;
        const speed = 30 + rand() * 90;
        state.particles.push({
          hx: x,
          hy: y,
          x,
          y,
          size: rand() > 0.5 ? GRID_UNIT : GRID_UNIT / 2,
          color,
          driftX: Math.cos(angle) * speed,
          driftY: Math.sin(angle) * speed,
          phase: rand() * Math.PI * 2,
          ox: createSpring(),
          oy: createSpring(),
          burst: true,
          life: 0.9 + rand() * 0.6,
        });
      }
      // Keep the field bounded.
      while (state.particles.length > maxParticles * 2) state.particles.shift();
      if (!state.running) startLoop();
    },
  }), []);

  // Keep the latest config in a ref so the loop never restarts on prop change.
  const configRef = useRef({ density, maxParticles, interactive, colors, opacity });
  configRef.current = { density, maxParticles, interactive, colors, opacity };

  function buildParticles(width: number, height: number): Particle[] {
    const { density: d, maxParticles: cap, colors: cols } = configRef.current;
    const target = Math.min(cap, Math.max(12, Math.round((width * height * d) / 20000)));
    const rand = mulberry32(20261011);
    const particles: Particle[] = [];
    for (let i = 0; i < target; i++) {
      particles.push({
        hx: Math.floor(rand() * width),
        hy: Math.floor(rand() * height),
        x: 0,
        y: 0,
        size: rand() > 0.6 ? GRID_UNIT : GRID_UNIT / 2,
        color: cols[Math.floor(rand() * cols.length)],
        driftX: (rand() - 0.5) * 6,
        driftY: (rand() - 0.5) * 6,
        phase: rand() * Math.PI * 2,
        ox: createSpring(),
        oy: createSpring(),
        burst: false,
        life: 1,
      });
    }
    // Snap home positions to the grid.
    for (const p of particles) {
      p.hx = Math.round(p.hx / GRID_UNIT) * GRID_UNIT;
      p.hy = Math.round(p.hy / GRID_UNIT) * GRID_UNIT;
      p.x = p.hx;
      p.y = p.hy;
    }
    return particles;
  }

  function resize() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
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
      if (state.particles.length === 0 || reduced) {
        state.particles = buildParticles(rect.width, rect.height);
      }
    }
    if (reduced) drawFrame(0); // static frame
  }

  function drawFrame(dt: number) {
    const canvas = canvasRef.current;
    const state = stateRef.current;
    if (!canvas || !state) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height, dpr, particles, pointer } = state;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const { interactive: pointerOn, opacity: layerOpacity } = configRef.current;

    for (const p of particles) {
      if (!p.burst) {
        // Gentle drift of the home cell across the field.
        p.hx = (p.hx + p.driftX * dt + width) % width;
        p.hy = (p.hy + p.driftY * dt + height) % height;
        // Pointer repulsion with a spring return.
        if (pointerOn && pointer.active) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0.01 && dist < 96) {
            const force = (1 - dist / 96) * 260;
            p.ox.v += (dx / dist) * force * dt;
            p.oy.v += (dy / dist) * force * dt;
          }
        }
        // The spring target is the (drifting) home cell; repulsion shows up as
        // velocity on the spring, so the square is pushed off the lattice and
        // settles back — physical, not teleporting.
        stepSpring(p.ox, p.hx, dt, 140, 16);
        stepSpring(p.oy, p.hy, dt, 140, 16);
        p.x = p.ox.x;
        p.y = p.oy.x;
        // Idle shimmer on the grid.
        p.phase += dt * 1.6;
      } else {
        // Burst particles fly outward and fade.
        p.x += p.driftX * dt;
        p.y += p.driftY * dt;
        p.driftX *= Math.pow(0.35, dt);
        p.driftY *= Math.pow(0.35, dt);
        p.life -= dt;
        if (p.life <= 0 || p.x < -20 || p.y < -20 || p.x > width + 20 || p.y > height + 20) {
          particles.splice(particles.indexOf(p), 1);
          continue;
        }
      }
      const alpha = layerOpacity * (p.burst ? Math.max(0, Math.min(1, p.life)) : 0.55 + 0.25 * Math.sin(p.phase));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pixelCanvasColor(p.color);
      // Snap to the grid so particles always read as squares on the lattice.
      ctx.fillRect(Math.round(p.x / (GRID_UNIT / 2)) * (GRID_UNIT / 2), Math.round(p.y / (GRID_UNIT / 2)) * (GRID_UNIT / 2), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  let frame: (now: number) => void = () => {};
  function startLoop() {
    const state = stateRef.current;
    if (!state || state.running) return;
    state.running = true;
    let last = performance.now();
    frame = (now: number) => {
      const s = stateRef.current;
      if (!s || !s.running) return;
      const dt = Math.min((now - last) / 1000, MAX_DT);
      last = now;
      drawFrame(dt);
      s.raf = requestAnimationFrame(frame);
    };
    state.raf = requestAnimationFrame(frame);
  }

  function stopLoop() {
    const state = stateRef.current;
    if (!state) return;
    state.running = false;
    if (state.raf) cancelAnimationFrame(state.raf);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    stateRef.current = {
      particles: [],
      pointer: { x: 0, y: 0, active: false },
      raf: 0,
      running: false,
      width: 0,
      height: 0,
      dpr: 1,
    };
    resetPixelCanvasPalette();
    resize();

    const parent = canvas.parentElement;
    const observer = typeof ResizeObserver === "function" && parent ? new ResizeObserver(() => resize()) : null;
    if (observer && parent) observer.observe(parent);

    const viewObserver =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(([entry]) => {
            const state = stateRef.current;
            if (!state) return;
            if (entry.isIntersecting && !document.hidden) startLoop();
            else stopLoop();
          })
        : null;
    if (viewObserver) viewObserver.observe(canvas);

    const onVisibility = () => {
      if (document.hidden) stopLoop();
      else startLoop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onPointer = (event: PointerEvent) => {
      const state = stateRef.current;
      if (!state) return;
      const rect = canvas.getBoundingClientRect();
      state.pointer.x = event.clientX - rect.left;
      state.pointer.y = event.clientY - rect.top;
      state.pointer.active = true;
    };
    const onLeave = () => {
      const state = stateRef.current;
      if (state) state.pointer.active = false;
    };
    if (interactive) {
      window.addEventListener("pointermove", onPointer, { passive: true });
      window.addEventListener("pointerleave", onLeave, { passive: true });
    }

    // Refresh the cached palette when the theme class flips.
    const themeObserver =
      typeof MutationObserver === "function"
        ? new MutationObserver(() => {
            resetPixelCanvasPalette();
            if (reduced) drawFrame(0);
          })
        : null;
    themeObserver?.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    if (!reduced) startLoop();

    return () => {
      stopLoop();
      observer?.disconnect();
      viewObserver?.disconnect();
      themeObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      if (interactive) {
        window.removeEventListener("pointermove", onPointer);
        window.removeEventListener("pointerleave", onLeave);
      }
      stateRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, interactive]);

  return (
    <canvas
      ref={canvasRef}
      className={clsx("pointer-events-none absolute inset-0", className)}
      style={{ opacity }}
      aria-hidden="true"
    />
  );
});
