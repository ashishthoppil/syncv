"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The first-run product tour: a spotlight over one control at a time, with a
 * popup explaining what it's for. It runs exactly once, immediately after
 * someone registers and saves their first base resume, and walks the whole
 * happy path — scan → score → tailored CV → base resume.
 *
 * The base resume comes last on purpose: it only means something once the user
 * has watched a scan tailor it to a job, so the tour opens on the Scan section
 * (where registration now lands) and points at Base Resume on the way out.
 *
 * Steps are pinned to the DOM by `data-tour` attributes rather than by class
 * names or positions, so restyling a section can't silently break the tour.
 */

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

export type TourSignal =
  | "section:base-resume"
  | "section:scan"
  | "scan:analyzed"
  /** Optimization has started, and it puts its own dialogs (role mismatch, the
   *  keyword picker) on screen. They sit below the tour overlay, so the current
   *  step stands down — still on the same step — until the result arrives. */
  | "scan:optimizing"
  /** That flow ended without a preview — cancelled or failed. Put the paused
   *  step back on screen rather than leaving the tour invisible but running. */
  | "scan:idle"
  | "scan:optimized"
  | "scan:preview-closed";

export type TourStepId =
  | "scan-form"
  | "scan-summary"
  | "preview-document"
  | "preview-editor"
  | "preview-design"
  | "preview-download"
  | "preview-cover"
  | "nav-base-resume"
  | "base-resume";

type TourStep = {
  id: TourStepId;
  /** CSS selector. The first *visible* match wins, so the mobile and desktop
   *  copies of a control can share one attribute. */
  target: string;
  title: string;
  body: string;
  /** The step stays armed (nothing on screen) until this signal fires. Without
   *  one it appears as soon as the previous step is done. */
  awaits?: TourSignal;
  /** "next" renders the Next button; "action" means the user has to do the
   *  thing being pointed at, and the following step's `awaits` moves us on. */
  advance: "next" | "action";
  actionHint?: string;
  /** Lives on a screen that a page reload throws away (a scan result, the
   *  preview modal), so resuming rewinds to the last step that still exists. */
  transient?: boolean;
  /** Plan-gated or otherwise absent targets: skip the step instead of stalling
   *  forever on an element that is never going to appear. */
  optional?: boolean;
  padding?: number;
};

const TOUR_STEPS: TourStep[] = [
  {
    id: "scan-form",
    target: '[data-tour="scan-form"]',
    awaits: "section:scan",
    advance: "next",
    title: "Set up your scan",
    body: "Your base resume is saved — this is where you put it to work. Paste the job description, then fill in the company and the role you're applying for. Pick which base resume to scan against — if you only have one, it's already selected. Once everything is filled in, click Analyze resume.",
  },
  {
    id: "scan-summary",
    target: '[data-tour="scan-summary"]',
    awaits: "scan:analyzed",
    advance: "action",
    actionHint: "Click Create tailored CV & Cover letter to continue",
    transient: true,
    title: "Your score card",
    body: "This is your score card for that job description — how well you match, plus the keywords you already have and the ones you're missing. Click Create tailored CV & Cover letter to tailor your resume to this job.",
  },
  {
    id: "preview-document",
    target: '[data-tour="preview-document"]',
    awaits: "scan:optimized",
    advance: "next",
    title: "Your tailored resume",
    body: "This is your resume rewritten for this job description. Highlighted text marks the keywords we added — they're highlighted here only, never in the file you download.",
    transient: true,
  },
  {
    id: "preview-editor",
    target: '[data-tour="preview-editor"]',
    advance: "next",
    title: "Edit any field",
    body: "Nothing here is locked. Reword a bullet, add or remove items, fix your title — the preview updates as you type. After editing, use Re-evaluate to rescore the new version.",
    transient: true,
  },
  {
    id: "preview-design",
    target: '[data-tour="preview-design"]',
    advance: "next",
    optional: true,
    title: "Pick a template",
    body: "Switch templates here, and fine-tune the accent colour, fonts and spacing to taste. Your content stays exactly as you wrote it.",
    transient: true,
  },
  {
    id: "preview-download",
    target: '[data-tour="preview-download"]',
    advance: "next",
    title: "Download your CV",
    body: "Happy with it? Download the tailored resume as a PDF, ready to send with your application.",
    transient: true,
  },
  {
    id: "preview-cover",
    target: '[data-tour="preview-cover-tab"]',
    advance: "next",
    optional: true,
    title: "And your cover letter",
    body: "Switch to the Cover letter tab for the letter we drafted for this same job. Edit and download it exactly like the resume. Close the preview when you're done — there's one last thing to show you.",
    transient: true,
  },
  // Closing the preview — from any of the steps above, not just the last one —
  // lands here. Base Resume is the one section the tour hasn't shown yet, and
  // it finally means something now that the user has watched a scan tailor it.
  {
    id: "nav-base-resume",
    target: '[data-tour="nav-base-resume"]',
    awaits: "scan:preview-closed",
    advance: "action",
    // Hidden once someone is out of scans, at which point there is nothing to
    // point at and no section to walk them into.
    optional: true,
    actionHint: "Click Base Resume to continue",
    title: "Where that resume came from",
    body: "Every tailored CV starts from a base resume. Open Base Resume to see yours — the Manage link next to the resume picker on the scan form gets you here too.",
  },
  {
    id: "base-resume",
    target: '[data-tour="first-base-resume"]',
    awaits: "section:base-resume",
    advance: "next",
    title: "This is your base resume",
    body: "This is the base resume you created. You can manage multiple resumes here to scan against different job descriptions — e.g. Full Stack Developer Resume, Frontend Developer Resume.",
  },
];

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

type StoredTour = { status: "running" | "done"; step: number };

const storageKey = (userId: string) => `syncv_product_tour:${userId}`;

const readStored = (userId: string): StoredTour | null => {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTour;
    if (parsed?.status !== "running" && parsed?.status !== "done") return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeStored = (userId: string, value: StoredTour) => {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(value));
  } catch {
    // A private-mode browser without storage just replays the tour next time.
  }
};

/**
 * Arms the tour for a user who has just registered and saved their first base
 * resume. A no-op if that user has seen (or is already seeing) it — this is a
 * first-run tour, not something the onboarding route can re-trigger.
 */
export const startProductTour = (userId?: string | null) => {
  if (!userId || typeof window === "undefined") return;
  if (readStored(userId)) return;
  writeStored(userId, { status: "running", step: 0 });
};

// A reload destroys scan results and the preview modal, so resuming into one of
// those steps would spotlight an element that no longer exists. Walk back to the
// most recent step that can still be shown on a freshly loaded dashboard.
const resumableIndex = (index: number) => {
  let i = Math.max(0, Math.min(index, TOUR_STEPS.length - 1));
  while (i > 0 && TOUR_STEPS[i].transient) i -= 1;
  return i;
};

// Whether a resumed step still has to wait for its signal. A section signal is
// re-emitted as soon as the dashboard mounts, so those steps arm themselves —
// but "the preview was closed" can never fire again, and a freshly loaded page
// has no preview open anyway, so that step is already satisfied.
const stillAwaitsOnLoad = (step: TourStep) =>
  Boolean(step.awaits) && step.awaits !== "scan:preview-closed";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type TourContextValue = {
  /** The step currently on screen — null when the tour is idle, armed, or over.
   *  Sections read this to put themselves in the state the step describes. */
  activeStepId: TourStepId | null;
  running: boolean;
  signal: (signal: TourSignal) => void;
};

const TourContext = createContext<TourContextValue>({
  activeStepId: null,
  running: false,
  signal: () => {},
});

export const useProductTour = () => useContext(TourContext);

/** Emits `section:<id>` whenever the dashboard changes section. */
export const TourSectionSignal = ({ section }: { section: string }) => {
  const { signal, running } = useProductTour();
  // `running` is a dependency, not just a guard. Child effects run before the
  // provider's own, so the first emission always lands before the tour has read
  // localStorage; re-running once it starts is what delivers the section the
  // user actually landed on.
  useEffect(() => {
    if (!running) return;
    signal(`section:${section}` as TourSignal);
  }, [section, running, signal]);
  return null;
};

// `seen` is "the user has actually looked at this step", which outlives
// `visible` — a step that stood down for a dialog has still been seen, and only
// a seen step is allowed to hand off to a later one.
type TourState = {
  running: boolean;
  index: number;
  visible: boolean;
  seen: boolean;
};

export const ProductTourProvider = ({
  userId,
  children,
}: {
  userId?: string | null;
  children: ReactNode;
}) => {
  const [state, setState] = useState<TourState>({
    running: false,
    index: 0,
    visible: false,
    seen: false,
  });
  // Signals arrive from effects and event handlers that captured an older
  // render, so every read of the current step goes through the ref.
  const stateRef = useRef(state);

  const update = useCallback((patch: Partial<TourState>) => {
    const next = { ...stateRef.current, ...patch };
    stateRef.current = next;
    setState(next);
  }, []);

  /** Move to `index`, shown straight away unless it is waiting on a signal. */
  const goTo = useCallback(
    (index: number, visible: boolean, patch?: Partial<TourState>) =>
      update({ index, visible, seen: visible, ...patch }),
    [update]
  );

  useEffect(() => {
    if (!userId) return;
    // `?tour=1` replays it from the top for anyone who wants to see it again —
    // otherwise the only way to watch this run is to register a new account.
    const forced =
      new URLSearchParams(window.location.search).get("tour") === "1";
    const stored = readStored(userId);
    if (!forced && stored?.status !== "running") return;
    const index = forced ? 0 : resumableIndex(stored?.step ?? 0);
    // An armed step waits for its signal; the dashboard re-emits the current
    // section on mount, so the first step arms itself moments later.
    goTo(index, !stillAwaitsOnLoad(TOUR_STEPS[index]), { running: true });
  }, [userId, goTo]);

  useEffect(() => {
    if (!userId || !state.running) return;
    writeStored(userId, { status: "running", step: state.index });
  }, [userId, state.running, state.index]);

  const finish = useCallback(() => {
    update({ running: false, visible: false, seen: false, index: 0 });
    if (userId) writeStored(userId, { status: "done", step: 0 });
  }, [update, userId]);

  const advance = useCallback(() => {
    const { index } = stateRef.current;
    const nextIndex = index + 1;
    if (nextIndex >= TOUR_STEPS.length) {
      finish();
      return;
    }
    goTo(nextIndex, !TOUR_STEPS[nextIndex].awaits);
  }, [finish, goTo]);

  const signal = useCallback(
    (incoming: TourSignal) => {
      const { running, index, visible, seen } = stateRef.current;
      if (!running) return;
      const step = TOUR_STEPS[index];

      // Stand down without losing our place, so the app's own dialogs — which
      // render below the overlay — are usable.
      if (incoming === "scan:optimizing") {
        if (visible) update({ visible: false });
        return;
      }
      // The paired resume. A no-op once a later step has taken over, which is
      // what happens on the success path.
      if (incoming === "scan:idle") {
        if (!visible) update({ visible: true, seen: true });
        return;
      }

      // Leaving the section a transient step belongs to strands it: the scan
      // result and the preview it points at only exist in memory, and switching
      // section unmounts them. Drop back to the last step that can still be
      // shown instead of stalling on an element that is gone for good.
      if (incoming.startsWith("section:") && step.transient) {
        const rewound = resumableIndex(index);
        goTo(rewound, TOUR_STEPS[rewound].awaits === incoming);
        return;
      }
      // The step we're already on was just armed by its own signal.
      if (step.awaits === incoming && !visible) {
        update({ visible: true, seen: true });
        return;
      }
      // Otherwise jump to the next step waiting on this signal — that lets
      // someone who ignores the popup and goes straight to Scan pick the tour
      // back up where they landed. Only from a step they have actually read,
      // though: while a step is still armed, an unrelated signal (the dashboard
      // settling on its default section during boot, say) must not skip it.
      if (!seen) return;
      const ahead = TOUR_STEPS.findIndex(
        (candidate, i) => i > index && candidate.awaits === incoming
      );
      if (ahead >= 0) goTo(ahead, true);
    },
    [goTo, update]
  );

  const step = state.running ? TOUR_STEPS[state.index] : null;

  return (
    <TourContext.Provider
      value={{
        activeStepId: state.visible && step ? step.id : null,
        running: state.running,
        signal,
      }}
    >
      {children}
      {state.running && state.visible && step ? (
        <TourSpotlight
          key={step.id}
          step={step}
          stepNumber={state.index + 1}
          total={TOUR_STEPS.length}
          onNext={advance}
          onSkipStep={advance}
          onDismiss={finish}
        />
      ) : null}
    </TourContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Spotlight
// ---------------------------------------------------------------------------

type Rect = { top: number; left: number; width: number; height: number };

const POPUP_GAP = 14;
const VIEWPORT_MARGIN = 12;
const MISSING_TARGET_TIMEOUT = 2500;
// Below this, "put the card near the thing" stops working: the targets that
// matter (the scan form, the score panel, the preview panes) are taller than the
// screen, so there is no near. The card docks to an edge instead and the
// spotlight is clipped to the strip left over — see `stageFor`.
const COMPACT_WIDTH = 640;
const COMPACT_HEIGHT = 560;
// Air between the docked card and the lit strip.
const STAGE_GAP = 10;

/** The first match with a real box on screen — `sm:`-hidden duplicates of the
 *  same control (mobile tab bar vs. sidebar) report a zero-size rect. */
const resolveTarget = (selector: string): HTMLElement | null => {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return (
    nodes.find((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) || null
  );
};

const sameRect = (a: Rect, b: Rect) =>
  Math.abs(a.top - b.top) < 0.5 &&
  Math.abs(a.left - b.left) < 0.5 &&
  Math.abs(a.width - b.width) < 0.5 &&
  Math.abs(a.height - b.height) < 0.5;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

const placePopup = (
  rect: Rect,
  popup: { width: number; height: number },
  viewport: { width: number; height: number }
) => {
  const fitsBelow =
    viewport.height - (rect.top + rect.height) >=
    popup.height + POPUP_GAP + VIEWPORT_MARGIN;
  const fitsAbove = rect.top >= popup.height + POPUP_GAP + VIEWPORT_MARGIN;

  // A target taller than most of the screen (the scan form, the preview panes)
  // leaves no room above or below, so on a wide layout the popup moves to
  // whichever side has space instead of sitting on top of the thing it
  // describes.
  const isTall = rect.height > viewport.height * 0.55;
  if (isTall && viewport.width >= 900 && !fitsBelow && !fitsAbove) {
    const spaceRight = viewport.width - (rect.left + rect.width);
    const onRight = spaceRight >= popup.width + POPUP_GAP + VIEWPORT_MARGIN;
    const left = onRight
      ? rect.left + rect.width + POPUP_GAP
      : rect.left - POPUP_GAP - popup.width;
    return {
      left: clamp(left, VIEWPORT_MARGIN, viewport.width - popup.width - VIEWPORT_MARGIN),
      top: clamp(
        rect.top,
        VIEWPORT_MARGIN,
        viewport.height - popup.height - VIEWPORT_MARGIN
      ),
    };
  }

  let top: number;
  if (fitsBelow) top = rect.top + rect.height + POPUP_GAP;
  else if (fitsAbove) top = rect.top - POPUP_GAP - popup.height;
  else {
    // Neither side fits: settle into the larger gap and let the card overlap the
    // dimmed area rather than drift off screen.
    const spaceBelow = viewport.height - (rect.top + rect.height);
    top = spaceBelow >= rect.top ? rect.top + rect.height + POPUP_GAP : rect.top - POPUP_GAP - popup.height;
  }

  return {
    left: clamp(
      rect.left + rect.width / 2 - popup.width / 2,
      VIEWPORT_MARGIN,
      viewport.width - popup.width - VIEWPORT_MARGIN
    ),
    top: clamp(
      top,
      VIEWPORT_MARGIN,
      viewport.height - popup.height - VIEWPORT_MARGIN
    ),
  };
};

/** The strip of screen the spotlight gets once the docked card has taken its
 *  share. Full screen on a roomy layout, where the card is placed beside the
 *  target rather than docked. */
const stageFor = (
  compact: boolean,
  dockTop: boolean,
  popupBox: { top: number; bottom: number } | null,
  viewportHeight: number
) => {
  if (!compact || !popupBox) return { top: 0, bottom: viewportHeight };
  return dockTop
    ? { top: popupBox.bottom + STAGE_GAP, bottom: viewportHeight }
    : { top: 0, bottom: popupBox.top - STAGE_GAP };
};

const TourSpotlight = ({
  step,
  stepNumber,
  total,
  onNext,
  onSkipStep,
  onDismiss,
}: {
  step: TourStep;
  stepNumber: number;
  total: number;
  onNext: () => void;
  onSkipStep: () => void;
  onDismiss: () => void;
}) => {
  const [rect, setRect] = useState<Rect | null>(null);
  const [popupSize, setPopupSize] = useState({ width: 320, height: 172 });
  // Where the card actually landed. Docked positions are written in CSS so that
  // `env(safe-area-inset-*)` does the work, which means the only way to know the
  // numbers — and so how much screen is left for the spotlight — is to measure.
  const [popupBox, setPopupBox] = useState<{ top: number; bottom: number } | null>(
    null
  );
  // A state ref, not a plain one: the popup only mounts once a target has been
  // found, and the observer has to attach on that later render.
  const [popupNode, setPopupNode] = useState<HTMLDivElement | null>(null);
  const popupNodeRef = useRef<HTMLDivElement | null>(null);
  const hasScrolledRef = useRef(false);
  const missingSinceRef = useRef<number | null>(null);
  const skipRef = useRef(onSkipStep);
  skipRef.current = onSkipStep;

  // Mirrored into a ref as well so the frame loop can measure the card without
  // taking it as a dependency and restarting on mount.
  const attachPopup = useCallback((node: HTMLDivElement | null) => {
    popupNodeRef.current = node;
    setPopupNode(node);
  }, []);

  // The target can move for reasons no single listener covers — page scroll, a
  // modal pane scrolling internally, layout settling after an image loads. A
  // frame loop is the one thing that catches all of them; it only runs while a
  // step is on screen, and state updates are gated on the rect actually moving.
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const element = resolveTarget(step.target);
      if (!element) {
        setRect((previous) => (previous === null ? previous : null));
        if (missingSinceRef.current === null) {
          missingSinceRef.current = performance.now();
        } else if (
          step.optional &&
          performance.now() - missingSinceRef.current > MISSING_TARGET_TIMEOUT
        ) {
          skipRef.current();
          return;
        }
      } else {
        missingSinceRef.current = null;
        const box = element.getBoundingClientRect();
        if (!hasScrolledRef.current) {
          hasScrolledRef.current = true;
          // Centring only makes sense for something that fits. A target taller
          // than the screen gets its top aligned instead — for the score panel
          // that is the ring and the optimize button the copy is talking about,
          // rather than the middle of a keyword list.
          element.scrollIntoView({
            block: box.height > window.innerHeight * 0.5 ? "start" : "center",
            behavior: "smooth",
          });
        }
        const padding = step.padding ?? 8;
        const top = Math.max(0, box.top - padding);
        const left = Math.max(0, box.left - padding);
        // Clamped to the viewport, and never negative: a target scrolled fully
        // off screen reports a box that would otherwise invert the hole.
        const next: Rect = {
          top,
          left,
          width: Math.max(0, Math.min(window.innerWidth, box.right + padding) - left),
          height: Math.max(0, Math.min(window.innerHeight, box.bottom + padding) - top),
        };
        setRect((previous) =>
          previous && sameRect(previous, next) ? previous : next
        );
      }

      const popup = popupNodeRef.current?.getBoundingClientRect();
      setPopupBox((previous) => {
        if (!popup) return previous === null ? previous : null;
        if (
          previous &&
          Math.abs(previous.top - popup.top) < 0.5 &&
          Math.abs(previous.bottom - popup.bottom) < 0.5
        ) {
          return previous;
        }
        return { top: popup.top, bottom: popup.bottom };
      });

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [step]);

  useEffect(() => {
    if (!popupNode || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const box = popupNode.getBoundingClientRect();
      setPopupSize((previous) =>
        Math.abs(previous.width - box.width) < 0.5 &&
        Math.abs(previous.height - box.height) < 0.5
          ? previous
          : { width: box.width, height: box.height }
      );
    });
    observer.observe(popupNode);
    return () => observer.disconnect();
  }, [popupNode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDismiss]);

  if (typeof document === "undefined" || !rect) return null;

  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const compact =
    viewport.width < COMPACT_WIDTH || viewport.height < COMPACT_HEIGHT;
  // Dock away from the target: a control near the bottom of the screen (the tab
  // bar, the pinned download button) gets a card at the top, everything else
  // gets one at the bottom, where a thumb can reach Next.
  const dockTop = compact && rect.top + rect.height / 2 > viewport.height / 2;
  const stage = stageFor(compact, dockTop, popupBox, viewport.height);

  // On a phone the target is routinely taller than the screen, so light the
  // slice of it that shares the screen with the card instead of holing out the
  // whole viewport — which would dim nothing and highlight nothing.
  const holeTop = Math.max(rect.top, stage.top);
  const holeHeight = Math.max(0, Math.min(rect.top + rect.height, stage.bottom) - holeTop);
  const hole: Rect = {
    top: holeTop,
    left: rect.left,
    width: rect.width,
    height: holeHeight,
  };

  const desktopPosition = compact
    ? null
    : placePopup(rect, popupSize, viewport);
  const isLast = stepNumber === total;

  return createPortal(
    <>
      {/* Four panels rather than one box-shadow ring: the hole is genuinely
          empty, so the control being pointed at stays clickable while every
          click outside it is swallowed. */}
      <div className="pointer-events-none fixed inset-0 z-[100]">
        <div
          className="pointer-events-auto absolute bg-slate-900/65"
          style={{ top: 0, left: 0, right: 0, height: hole.top }}
        />
        <div
          className="pointer-events-auto absolute bg-slate-900/65"
          style={{ top: hole.top + hole.height, left: 0, right: 0, bottom: 0 }}
        />
        <div
          className="pointer-events-auto absolute bg-slate-900/65"
          style={{ top: hole.top, left: 0, width: hole.left, height: hole.height }}
        />
        <div
          className="pointer-events-auto absolute bg-slate-900/65"
          style={{
            top: hole.top,
            left: hole.left + hole.width,
            right: 0,
            height: hole.height,
          }}
        />
        <div
          aria-hidden
          className="absolute rounded-lg ring-2 ring-white/90 animate-tour-pulse motion-reduce:animate-none"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
          }}
        />
      </div>

      <div
        ref={attachPopup}
        role="dialog"
        aria-label={step.title}
        className={cn(
          "fixed z-[101] rounded-xl border border-slate-200 bg-white p-4 shadow-2xl",
          !compact
            ? "w-[min(22rem,calc(100vw-1.5rem))]"
            : // Long copy on a short screen would otherwise squeeze the
              // spotlight down to nothing.
              "max-h-[55dvh] touch-scroll overflow-y-auto"
        )}
        style={
          desktopPosition
            ? { top: desktopPosition.top, left: desktopPosition.left }
            : // Docked: left/right set the width, and the insets keep the card
              // clear of the notch and the home indicator.
              {
                left: `calc(env(safe-area-inset-left) + ${VIEWPORT_MARGIN}px)`,
                right: `calc(env(safe-area-inset-right) + ${VIEWPORT_MARGIN}px)`,
                ...(dockTop
                  ? { top: `calc(env(safe-area-inset-top) + ${VIEWPORT_MARGIN}px)` }
                  : {
                      bottom: `calc(env(safe-area-inset-bottom) + ${VIEWPORT_MARGIN}px)`,
                    }),
              }
        }
      >
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            <Sparkles className="h-3 w-3" />
            Step {stepNumber} of {total}
          </span>
          <button
            type="button"
            className="text-xs font-medium text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
            onClick={onDismiss}
          >
            Skip tour
          </button>
        </div>

        <p className="mt-3 text-sm font-semibold text-slate-900">{step.title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.body}</p>

        <div className="mt-4 flex items-center justify-end gap-2">
          {step.advance === "action" ? (
            <p className="text-xs font-medium text-slate-500">
              {step.actionHint || "Continue in the app"}
            </p>
          ) : (
            <Button size="sm" className="rounded-md" onClick={onNext}>
              {isLast ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" /> Got it
                </>
              ) : (
                <>
                  Next <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </>,
    document.body
  );
};
