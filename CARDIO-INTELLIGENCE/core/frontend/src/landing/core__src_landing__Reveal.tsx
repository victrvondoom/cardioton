/**
 * Reveal — scroll-triggered pixel-flavoured reveal.
 *
 * One IntersectionObserver per element, disconnected after the first reveal.
 * A short rise + fade; under prefers-reduced-motion the landing stylesheet
 * forces content visible, and without IntersectionObserver (jsdom) it shows
 * immediately rather than leaving content hidden.
 */
import { useEffect, useRef, useState } from "react";

import type { CSSProperties, ElementType, ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Stagger, in ms. */
  delay?: number;
  className?: string;
  style?: CSSProperties;
  as?: ElementType;
  id?: string;
  /** Forwarded for callers that drive hover-linked effects. */
  onMouseEnter?: () => void;
  onFocus?: () => void;
}

export default function Reveal({
  children,
  delay = 0,
  className,
  style,
  as: Tag = "div",
  id,
  onMouseEnter,
  onFocus,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "-10% 0px", threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      id={id}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
      className={["pl-reveal", visible ? "is-visible" : "", className ?? ""].filter(Boolean).join(" ")}
      style={{ ...style, ["--reveal-delay" as string]: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
