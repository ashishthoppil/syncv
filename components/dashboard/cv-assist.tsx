"use client";

// One-shot resume assist buttons (Generate summary, Rephrase). Each button can
// be used once per field: after a result lands the button stays spent, and if
// the field already held text, Undo puts that text back.
//
// History is keyed by the field a button writes to — "summary",
// "experience:2", "project:0" — and belongs to whatever owns the draft, not to
// the cards. The onboarding wizard unmounts a card on every step change and the
// editors unmount theirs behind the Design tab; state kept in the card would
// re-arm the button each time.

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Undo2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AssistState =
  | { phase: "pending"; run: number }
  // `previous` is null when the field was empty — there is nothing to undo to.
  | { phase: "applied"; previous: string | null }
  | { phase: "undone" };

export type AssistHistory = Record<string, AssistState>;

export type AssistList = "experience" | "project";

export const SUMMARY_KEY = "summary";
export const assistKey = (list: AssistList, index: number) => `${list}:${index}`;

// "experience:2" -> { list: "experience", index: 2 }; "summary" -> index -1.
const parseKey = (key: string) => {
  const [list, index] = key.split(":");
  return { list, index: index === undefined ? -1 : Number(index) };
};

// The part of a resume draft the buttons write to. Both the base-resume draft
// and the optimized-resume editor's drafts have this shape.
type AssistableDraft = {
  summary: string;
  experiences: { text: string }[];
  projects: { text: string }[];
};

export const readAssistField = (draft: AssistableDraft, key: string) => {
  const { list, index } = parseKey(key);
  if (list === SUMMARY_KEY) return draft.summary;
  const entries = list === "experience" ? draft.experiences : draft.projects;
  return entries[index]?.text;
};

export const writeAssistField = <T extends AssistableDraft>(
  draft: T,
  key: string,
  text: string
): T => {
  const { list, index } = parseKey(key);
  if (list === SUMMARY_KEY) return { ...draft, summary: text };
  const withText = <E extends { text: string }>(entries: E[]) =>
    entries.map((entry, i) => (i === index ? { ...entry, text } : entry));
  return list === "experience"
    ? { ...draft, experiences: withText(draft.experiences) }
    : { ...draft, projects: withText(draft.projects) };
};

// Pending runs never outlive the component that started them, so they are
// left out of anything saved for a later mount.
export const settledAssist = (history: AssistHistory): AssistHistory =>
  Object.fromEntries(
    Object.entries(history).filter(([, state]) => state.phase !== "pending")
  );

type FieldAccess = {
  /** The field's current text, or undefined once the field is gone. */
  read: (key: string) => string | undefined;
  /** Replace the field's text in the owner's state. */
  write: (key: string, text: string) => void;
};

export const useAssist = (access: FieldAccess, initial: AssistHistory = {}) => {
  const [history, setHistoryState] = useState<AssistHistory>(initial);
  // Read by requests that finish after the render that started them.
  const historyRef = useRef(history);
  const accessRef = useRef(access);
  accessRef.current = access;
  const mountedRef = useRef(false);
  const runCount = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const setHistory = useCallback((next: AssistHistory) => {
    historyRef.current = next;
    setHistoryState(next);
  }, []);

  /**
   * Run `request` for the field at `key`, at most once. `request` returns the
   * replacement text, or null after telling the user why it failed — a failed
   * attempt doesn't spend the button.
   */
  const run = async (key: string, request: () => Promise<string | null>) => {
    if (historyRef.current[key]) return;
    const before = accessRef.current.read(key) ?? "";
    const id = ++runCount.current;
    setHistory({ ...historyRef.current, [key]: { phase: "pending", run: id } });

    const text = await request().catch(() => null);
    if (!mountedRef.current) return;

    // Deleting an earlier entry shifts keys while the request is out, so look
    // the run up again rather than trusting `key`. Gone means the history was
    // reset (e.g. the draft was replaced from a file) or the entry deleted.
    const current = Object.keys(historyRef.current).find((candidate) => {
      const state = historyRef.current[candidate];
      return state.phase === "pending" && state.run === id;
    });
    if (current === undefined) return;

    const next = { ...historyRef.current };
    // The field is read-only while pending, so a change means it isn't the
    // same field any more — don't write into it.
    if (text === null || accessRef.current.read(current) !== before) {
      delete next[current];
    } else {
      accessRef.current.write(current, text);
      next[current] = { phase: "applied", previous: before.trim() ? before : null };
    }
    setHistory(next);
  };

  const undo = (key: string) => {
    const state = historyRef.current[key];
    if (state?.phase !== "applied" || state.previous === null) return;
    accessRef.current.write(key, state.previous);
    setHistory({ ...historyRef.current, [key]: { phase: "undone" } });
  };

  /** Keep keys pointing at the same entries after `list[index]` is deleted. */
  const removeEntry = (list: AssistList, index: number) => {
    const next: AssistHistory = {};
    Object.entries(historyRef.current).forEach(([key, state]) => {
      const parsed = parseKey(key);
      if (parsed.list !== list || parsed.index < index) next[key] = state;
      else if (parsed.index > index) next[assistKey(list, parsed.index - 1)] = state;
    });
    setHistory(next);
  };

  const reset = useCallback(() => setHistory({}), [setHistory]);

  return {
    history,
    state: (key: string): AssistState | undefined => history[key],
    pending: (key: string) => history[key]?.phase === "pending",
    run,
    undo,
    removeEntry,
    reset,
  };
};

export type Assist = ReturnType<typeof useAssist>;

// Sits in the bottom-right corner of the field's textarea, inside its pb-10.
export const AssistButtons = ({
  assist,
  field,
  icon: Icon,
  label,
  doneLabel,
  onRun,
}: {
  assist: Assist;
  field: string;
  icon: LucideIcon;
  label: string;
  doneLabel: string;
  onRun: () => void;
}) => {
  const state = assist.state(field);
  const pending = state?.phase === "pending";
  const applied = state?.phase === "applied";
  const spent = Boolean(state) && !pending;
  const canUndo = state?.phase === "applied" && state.previous !== null;

  return (
    <div className="absolute bottom-4 right-2 flex items-center gap-1.5">
      {canUndo ? (
        <button
          type="button"
          onClick={() => assist.undo(field)}
          title="Put back the text you had before"
          className="inline-flex h-6 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <Undo2 className="h-3.5 w-3.5" />
          Undo
        </button>
      ) : null}
      <button
        type="button"
        onClick={onRun}
        disabled={Boolean(state)}
        title={spent ? "This can only be used once" : undefined}
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-md px-2.5 text-xs font-medium",
          spent
            ? "cursor-not-allowed bg-slate-100 text-slate-500"
            : "bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
        )}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : applied ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <Icon className="h-3.5 w-3.5" />
        )}
        {applied ? doneLabel : label}
      </button>
    </div>
  );
};
