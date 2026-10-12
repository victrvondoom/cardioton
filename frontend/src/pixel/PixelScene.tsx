/**
 * PixelScene — a planar 2.5D layer.
 *
 * The scene is flat by default; registered PixelBlocks rise gently from the
 * plane (translateZ), tilt toward the pointer (rotateX/rotateY), and settle
 * back into their grid positions with damped spring physics. All motion runs
 * on one rAF loop writing transforms directly to the DOM — the React tree is
 * never re-rendered by the animation.
 */
import clsx from "clsx";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";

import { usePrefersReducedMotion } from "./hooks";
import { createSpring, springSettled, stepSpring, type SpringState } from "./spring";

interface BlockRegistration {
  el: HTMLElement;
  rx: SpringState;
  ry: SpringState;
  lift: SpringState;
}

interface SceneApi {
  register: (block: BlockRegistration) => () => void;
  pointer: { x: number; y: number; active: boolean };
  bounds: { width: number; height: number; left: number; top: number };
}

const PixelSceneContext = createContext<SceneApi | null>(null);

export interface PixelSceneProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Maximum tilt toward the pointer, in degrees. */
  maxTiltDeg?: number;
  /** Maximum rise from the plane, in px. */
  liftPx?: number;
}

export function PixelScene({
  children,
  className,
  style,
  maxTiltDeg = 7,
  liftPx = 14,
}: PixelSceneProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const blocksRef = useRef(new Map<HTMLElement, BlockRegistration>());
  const pointerRef = useRef({ x: 0, y: 0, active: false });
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const root = rootRef.current;
    if (!root) return;
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const blocks = blocksRef.current;
      if (blocks.size === 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const rootRect = root.getBoundingClientRect();
      const pointer = pointerRef.current;
      for (const block of blocks.values()) {
        const rect = block.el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let targetRx = 0;
        let targetRy = 0;
        let targetLift = 0;
        if (pointer.active) {
          const nx = (pointer.x - cx) / Math.max(120, rootRect.width / 3);
          const ny = (pointer.y - cy) / Math.max(120, rootRect.height / 3);
          targetRy = Math.max(-1, Math.min(1, nx)) * maxTiltDeg;
          targetRx = Math.max(-1, Math.min(1, -ny)) * maxTiltDeg;
          const dist = Math.hypot(pointer.x - cx, pointer.y - cy);
          targetLift = Math.max(0, 1 - dist / (Math.max(rootRect.width, rootRect.height) * 0.6)) * liftPx;
        }
        stepSpring(block.rx, targetRx, dt, 200, 20);
        stepSpring(block.ry, targetRy, dt, 200, 20);
        stepSpring(block.lift, targetLift, dt, 200, 20);
        const settled =
          springSettled(block.rx, targetRx) &&
          springSettled(block.ry, targetRy) &&
          springSettled(block.lift, targetLift);
        if (!settled || pointer.active) {
          block.el.style.transform = `perspective(900px) rotateX(${block.rx.x.toFixed(3)}deg) rotateY(${block.ry.x.toFixed(3)}deg) translateZ(${block.lift.x.toFixed(2)}px)`;
          block.el.style.boxShadow =
            block.lift.x > 0.5 ? `0 ${Math.round(block.lift.x)}px ${Math.round(block.lift.x * 1.6)}px rgba(0,0,0,0.45)` : "";
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onPointerMove = (event: PointerEvent) => {
      pointerRef.current.x = event.clientX;
      pointerRef.current.y = event.clientY;
      pointerRef.current.active = true;
    };
    const onPointerLeave = () => {
      pointerRef.current.active = false;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [reduced, maxTiltDeg, liftPx]);

  const api: SceneApi = {
    register: (block) => {
      blocksRef.current.set(block.el, block);
      return () => {
        blocksRef.current.delete(block.el);
      };
    },
    pointer: pointerRef.current,
    bounds: { width: 0, height: 0, left: 0, top: 0 },
  };

  return (
    <PixelSceneContext.Provider value={api}>
      <div
        ref={rootRef}
        className={clsx("relative", className)}
        style={{ perspective: 900, transformStyle: "preserve-3d", ...style }}
      >
        {children}
      </div>
    </PixelSceneContext.Provider>
  );
}

export interface PixelBlockProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** A tile that rises and tilts toward the pointer inside a PixelScene. */
export function PixelBlock({ children, className, style }: PixelBlockProps) {
  const api = useContext(PixelSceneContext);
  const elRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!api || !elRef.current) return;
    return api.register({
      el: elRef.current,
      rx: createSpring(),
      ry: createSpring(),
      lift: createSpring(),
    });
  }, [api]);

  return (
    <div
      ref={elRef}
      className={clsx("will-change-transform", className)}
      style={{ transformStyle: "preserve-3d", ...style }}
    >
      {children}
    </div>
  );
}
