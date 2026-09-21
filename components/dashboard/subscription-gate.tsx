"use client";

import { useRouter } from "next/navigation";
import { track } from "@vercel/analytics";
import { Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The one screen every locked section shows.
 *
 * Each section used to draw its own amber "Subscription Required" box — three
 * of them, in three shapes, one without a button at all and one telling Job
 * Tracker users to "optimize your resume". Amber reads as *something broke*;
 * nothing is broken here, the user has simply reached the end of the free
 * trial, and this is the app's best chance to say what a plan is for. So it
 * borrows the upgrade card's look instead: what you get, then one way forward.
 */
export const SubscriptionGate = ({
  title,
  body,
  highlights = [],
  event,
}: {
  title: string;
  body: string;
  /** What a plan opens up. Two or three, specific to the locked section. */
  highlights?: string[];
  /** Analytics event, so we can tell which locked section converts. */
  event?: string;
}) => {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
        <Lock className="h-5 w-5" />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-slate-900 sm:text-xl">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
        {body}
      </p>

      {highlights.length ? (
        // Left-aligned inside a centred card: a checklist is read line by line,
        // and centred list text makes that needlessly hard.
        <ul className="mx-auto mt-5 grid max-w-sm gap-2 text-left">
          {highlights.map((highlight) => (
            <li
              key={highlight}
              className="flex items-start gap-2 text-sm text-slate-600"
            >
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>{highlight}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <Button
        className="mt-6 w-full rounded-md sm:w-auto"
        onClick={() => {
          if (event) track(event);
          router.push("/scan?section=settings&scrollTo=dashboard-pricing");
        }}
      >
        View plans
      </Button>
    </div>
  );
};
