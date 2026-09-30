"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import type { ReviewChangeKind } from "@/lib/resume-review";

/**
 * The accept / reject popup for a change in the optimized resume preview.
 *
 * The preview is rendered HTML, not React, so this listens on the document for
 * the highlight tags renderReviewMarkup writes (`data-review-change`). Hovering
 * one opens the popup at the pointer; clicking or tapping one pins it open,
 * which is how it works on a phone. One component serves both layouts.
 */

const CHANGE_SELECTOR = "[data-review-change]";
const POPOVER_WIDTH = 208;
const POPOVER_HEIGHT = 78;
// Long enough to cross the gap from a highlight to the popup.
const CLOSE_DELAY_MS = 240;

type Anchor = {
  id: number;
  kind: ReviewChangeKind;
  x: number;
  y: number;
  /** Opened by a click or tap: stays until dismissed. */
  pinned: boolean;
};

const PROMPTS: Record<ReviewChangeKind, string> = {
  replaced: "Keep this change?",
  removed: "Keep this change?",
  added: "Keep this addition?",
  estimated: "Suggested figure. Is it right?",
};

const readChange = (target: EventTarget | null) => {
  const element = target instanceof Element ? target.closest(CHANGE_SELECTOR) : null;
  if (!element) return null;
  const id = Number(element.getAttribute("data-review-change"));
  if (!Number.isFinite(id)) return null;
  return {
    id,
    kind: (element.getAttribute("data-review-kind") || "replaced") as ReviewChangeKind,
  };
};

export const ResumeReviewPopover = ({
  enabled,
  onAccept,
  onReject,
}: {
  /** False while the resume preview isn't on screen. */
  enabled: boolean;
  onAccept: (id: number) => void;
  onReject: (id: number) => void;
}) => {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      setAnchor((current) => (current?.pinned ? current : null));
    }, CLOSE_DELAY_MS);
  }, [cancelClose]);

  useEffect(() => {
    if (!enabled) {
      setAnchor(null);
      return;
    }

    const insidePopover = (target: EventTarget | null) =>
      target instanceof Node && Boolean(popoverRef.current?.contains(target));

    const onMouseOver = (event: MouseEvent) => {
      const change = readChange(event.target);
      if (!change) return;
      cancelClose();
      // Already open for this change (or pinned elsewhere): leave it where it
      // is, so the pointer can travel to it.
      setAnchor((current) =>
        current && (current.pinned || current.id === change.id)
          ? current
          : { ...change, x: event.clientX, y: event.clientY, pinned: false }
      );
    };

    const onMouseOut = (event: MouseEvent) => {
      if (!readChange(event.target)) return;
      if (readChange(event.relatedTarget) || insidePopover(event.relatedTarget)) return;
      scheduleClose();
    };

    const onClick = (event: MouseEvent) => {
      if (insidePopover(event.target)) return;
      const change = readChange(event.target);
      cancelClose();
      setAnchor(change ? { ...change, x: event.clientX, y: event.clientY, pinned: true } : null);
    };

    // The popup is placed once, at the pointer; it would be left behind.
    const onScroll = () => setAnchor(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAnchor(null);
    };

    document.addEventListener("mouseover", onMouseOver);
    document.addEventListener("mouseout", onMouseOut);
    document.addEventListener("click", onClick);
    document.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelClose();
      document.removeEventListener("mouseover", onMouseOver);
      document.removeEventListener("mouseout", onMouseOut);
      document.removeEventListener("click", onClick);
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled, cancelClose, scheduleClose]);

  if (!enabled || !anchor) return null;

  // Above the pointer, or below it when there is no room; never off screen.
  const left = Math.max(
    8,
    Math.min(anchor.x - POPOVER_WIDTH / 2, window.innerWidth - POPOVER_WIDTH - 8)
  );
  const above = anchor.y - POPOVER_HEIGHT - 10;
  const top = above >= 8 ? above : anchor.y + 18;

  const decide = (action: (id: number) => void) => {
    cancelClose();
    action(anchor.id);
    setAnchor(null);
  };

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Review this change"
      className="fixed z-[85] rounded-xl border border-slate-200 bg-white p-2 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.35)]"
      style={{ left, top, width: POPOVER_WIDTH }}
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
    >
      <p className="px-1 pb-1.5 text-xs font-medium text-slate-600">{PROMPTS[anchor.kind]}</p>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => decide(onAccept)}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-emerald-600 text-xs font-semibold text-white transition hover:bg-emerald-700"
        >
          <Check className="h-3.5 w-3.5" strokeWidth={2.75} /> Accept
        </button>
        <button
          type="button"
          onClick={() => decide(onReject)}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-rose-200 bg-white text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.75} /> Reject
        </button>
      </div>
    </div>
  );
};
