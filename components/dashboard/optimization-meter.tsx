"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Clock3, Gauge } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

/** The paid plan's optimization fair-use state, from /api/subscription. */
export type OptimizationUsage = {
  hourlyLimit: number;
  hourlyRemaining: number;
  dailyLimit: number;
  usedToday: number;
  blockedBy: "daily" | "break" | null;
  blockedForMs: number;
};

const pad = (value: number) => String(value).padStart(2, "0");

/** 41:23, or 6:12:04 once there are hours in it. */
const formatCountdown = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
};

/**
 * The live wait before the next optimization: whether there is one, why, and
 * a ticking countdown. Shared by the header meter and the Optimize buttons so
 * they unlock together. `onExpire` fires a beat after zero, for the one caller
 * that should fetch the fresh state (the header), not every caller.
 */
export function useOptimizationWait(
  usage: OptimizationUsage | null | undefined,
  onExpire?: () => void
) {
  // A deadline on this browser's clock, fixed when this state arrived.
  const deadline = useMemo(
    () => (usage?.blockedBy && usage.blockedForMs > 0 ? Date.now() + usage.blockedForMs : null),
    [usage]
  );
  const [now, setNow] = useState(() => Date.now());
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    if (!deadline) return;
    setNow(Date.now());
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    // A beat after zero, so the server agrees the wait is over. If it still
    // disagrees, the fresh state carries a new deadline and this runs again.
    const expire = window.setTimeout(
      () => onExpireRef.current?.(),
      Math.max(1000, deadline - Date.now() + 750)
    );
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(expire);
    };
  }, [deadline]);

  const waitMs = deadline ? Math.max(0, deadline - now) : 0;
  const waiting = waitMs > 0;
  return {
    waiting,
    blockedBy: waiting ? usage?.blockedBy ?? null : null,
    countdown: formatCountdown(waitMs),
  };
}

/**
 * The dashboard header's balance for paid users, where the scans-left badge
 * sits for the free plan: optimizations used today against the daily cap, and
 * — during a break, or once the day's cap is used — a live countdown to when
 * optimizing opens again. `onExpire` fires as the countdown runs out, so the
 * host can fetch the fresh state from the server.
 */
export function OptimizationMeter({
  usage,
  onExpire,
}: {
  usage: OptimizationUsage;
  onExpire?: () => void;
}) {
  const { waiting, countdown } = useOptimizationWait(usage, onExpire);
  const today = `${usage.usedToday}/${usage.dailyLimit}`;

  let label: string;
  let short: string;
  if (usage.blockedBy === "daily" && waiting) {
    label = `${today} today · resets in ${countdown}`;
    short = `${today} · ${countdown}`;
  } else if (usage.blockedBy === "break" && waiting) {
    label = `Optimize again in ${countdown} · ${today} today`;
    short = `${countdown} · ${today}`;
  } else {
    label = `${today} optimizations today`;
    short = today;
  }

  const rule = `Up to ${usage.dailyLimit} optimizations a day. After ${usage.hourlyLimit} optimizations in an hour, optimizing pauses for an hour.`;
  const detail = waiting
    ? usage.blockedBy === "daily"
      ? "Today's optimizations are used up."
      : "You're on a short break."
    : `${usage.hourlyRemaining} more before a break.`;

  return (
    <Badge
      variant="outline"
      title={`${rule} ${detail}`}
      className={cn(
        "gap-1.5 whitespace-nowrap px-2.5 py-1 text-[11px] tabular-nums sm:px-3 sm:text-xs",
        waiting
          ? "border-violet-200 bg-violet-50 text-brand"
          : "border-slate-200 bg-slate-50 text-slate-700"
      )}
    >
      {waiting ? (
        <Clock3 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <Gauge aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      )}
      {/* role="timer" is not a live region, so the ticking isn't read out
          every second; the full sentence is there for anyone who asks. */}
      <span role={waiting ? "timer" : undefined}>
        <span aria-hidden="true" className="sm:hidden">
          {short}
        </span>
        <span className="hidden sm:inline">{label}</span>
        <span className="sr-only sm:hidden">{label}</span>
      </span>
    </Badge>
  );
}
