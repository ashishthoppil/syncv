import {
  FAIR_USE_OPTIMIZATION_BREAK_MINUTES,
  FAIR_USE_OPTIMIZATIONS_PER_DAY,
  FAIR_USE_OPTIMIZATIONS_PER_HOUR,
} from "@/lib/subscription-plans";

const MINUTE_MS = 60_000;
const BREAK_MS = FAIR_USE_OPTIMIZATION_BREAK_MINUTES * MINUTE_MS;
// Far enough back to replay any break that could still be running, however
// the ones before it fell: breaks and the bursts behind them each span an hour.
const REPLAY_MS = 6 * 60 * MINUTE_MS;

/** Midnight UTC starting the day `now` falls in — the fair-use "day". */
export const getDayStartUtc = (now = new Date()) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

/**
 * Where a paid user stands against the optimization fair-use rules:
 *
 * - After FAIR_USE_OPTIMIZATIONS_PER_HOUR optimizations within an hour, a break
 *   of FAIR_USE_OPTIMIZATION_BREAK_MINUTES starts from the last of them. After
 *   the break the count starts again from zero.
 * - No more than FAIR_USE_OPTIMIZATIONS_PER_DAY in a UTC day.
 *
 * Nothing is stored: the state is replayed from `llm_usage`, which gets one
 * `tailor_resume` row per optimization. If that table can't be read, it fails
 * open — the same choice countModelCalls makes — rather than lock out paying
 * users over a logging problem.
 */
export const getOptimizationAllowance = async (supabase, userId, now = new Date()) => {
  const nowMs = now.getTime();
  const dayStart = getDayStartUtc(now);
  const dayResetsAt = new Date(dayStart.getTime() + 24 * 60 * MINUTE_MS);
  const since = new Date(Math.min(dayStart.getTime(), nowMs - REPLAY_MS));

  let times = [];
  const { data, error } = await supabase
    .from("llm_usage")
    .select("created_at")
    .eq("user_id", userId)
    .eq("purpose", "tailor_resume")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Could not read llm_usage; optimization limits are not enforced:", error.message);
  } else {
    times = (data || []).map((row) => new Date(row.created_at).getTime());
  }

  // Replay: each optimization joins the current burst (those within the last
  // hour, since the last break); the one that fills it starts a break.
  let breakEndsAt = 0;
  let burst = [];
  for (const time of times) {
    if (time < breakEndsAt) continue; // Can't happen while enforced; ignore.
    burst = burst.filter((earlier) => earlier > time - BREAK_MS);
    burst.push(time);
    if (burst.length >= FAIR_USE_OPTIMIZATIONS_PER_HOUR) {
      breakEndsAt = time + BREAK_MS;
      burst = [];
    }
  }

  const onBreak = breakEndsAt > nowMs;
  const inBurst = onBreak ? FAIR_USE_OPTIMIZATIONS_PER_HOUR : burst.filter((t) => t > nowMs - BREAK_MS).length;
  const usedToday = times.filter((time) => time >= dayStart.getTime()).length;
  const dailyReached = usedToday >= FAIR_USE_OPTIMIZATIONS_PER_DAY;

  const blockedUntilMs = dailyReached ? dayResetsAt.getTime() : onBreak ? breakEndsAt : 0;

  return {
    hourlyLimit: FAIR_USE_OPTIMIZATIONS_PER_HOUR,
    hourlyRemaining: Math.max(0, FAIR_USE_OPTIMIZATIONS_PER_HOUR - inBurst),
    breakEndsAt: onBreak ? new Date(breakEndsAt).toISOString() : null,
    dailyLimit: FAIR_USE_OPTIMIZATIONS_PER_DAY,
    usedToday,
    dailyResetsAt: dayResetsAt.toISOString(),
    // The day's cap outranks a break: waiting out the break wouldn't help.
    blockedBy: dailyReached ? "daily" : onBreak ? "break" : null,
    blockedUntil: blockedUntilMs ? new Date(blockedUntilMs).toISOString() : null,
    // How long the wait has left, measured on the server. The header counts
    // down from this rather than from blockedUntil, so a browser whose clock
    // is off still reaches zero when the server does.
    blockedForMs: blockedUntilMs ? Math.max(0, blockedUntilMs - nowMs) : 0,
  };
};

/** "41 min", "6 h 12 min" — how long until `untilIso`, for error messages. */
export const describeWait = (untilIso, now = new Date()) => {
  const minutes = Math.max(1, Math.ceil((new Date(untilIso).getTime() - now.getTime()) / MINUTE_MS));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};
