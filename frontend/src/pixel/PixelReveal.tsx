/** PixelReveal — blocky stepped-clip scroll reveal for pixel content. */
import clsx from "clsx";

import type { CSSProperties, ElementType, ReactNode } from "react";

import { useInView } from "./hooks";

export interface PixelRevealProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: ElementType;
  id?: string;
  /** Stagger, in ms. */
  delay?: number;
}

export function PixelReveal({
  children,
  className,
  style,
  as: Tag = "div",
  id,
  delay = 0,
}: PixelRevealProps) {
  const [ref, inView] = useInView<HTMLElement>();
  return (
    <Tag
      ref={ref}
      id={id}
      className={clsx("pixel-reveal", inView && "is-visible", className)}
      style={{ ...style, ["--reveal-delay" as string]: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
