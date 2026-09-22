"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState, type ReactNode } from "react";

type RevealProps = {
  as?: "div" | "li" | "p";
  /** Stagger in ms, for siblings that scroll into view together (grid rows). */
  delay?: number;
  className?: string;
  children: ReactNode;
};

/**
 * Fades and lifts its content in the first time it scrolls into view.
 *
 * The hidden state ships in the server HTML, so nothing flashes visible and
 * then disappears on hydration. Content stays in the markup either way, so
 * crawlers still read it. Two escape hatches keep it from ever hiding content
 * for good: reduced-motion users get everything shown with no animation, and
 * a browser running without JavaScript never applies the hidden state.
 *
 * The motion is a keyframe animation (`animate-reveal-up`), not a transition,
 * so the element is free to carry its own hover transitions: twMerge would
 * otherwise keep only one `transition-*` class and silently drop the other.
 */
export function Reveal({ as: Tag = "div", delay = 0, className, children }: RevealProps) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    // The bottom margin holds the reveal until the element is a little way up
    // the screen, so the motion happens where the reader is looking rather
    // than in the last few pixels at the bottom edge.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return (
    <Tag
      ref={setNode}
      style={shown && delay ? { animationDelay: `${delay}ms` } : undefined}
      className={cn(
        shown
          ? "animate-reveal-up motion-reduce:animate-none"
          : "opacity-0 motion-reduce:opacity-100 [@media(scripting:none)]:opacity-100",
        className
      )}
    >
      {children}
    </Tag>
  );
}
