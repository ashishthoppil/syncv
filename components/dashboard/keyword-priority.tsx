import { cn } from "@/lib/utils";
import {
  groupKeywordsByPriority,
  type KeywordPriority,
  type WeightedKeywordLike,
} from "@/lib/keyword-priority";

/**
 * How the scan UI shows a keyword's importance. Every keyword list (matched,
 * missing, the picker, what the optimizer added) is split into the same three
 * tiers, must-have first, so the desktop and phone layouts read alike.
 */

type KeywordTone = "matched" | "missing";

const FILLED_BARS: Record<KeywordPriority, number> = { high: 3, medium: 2, low: 1 };

/** Three rising bars, filled to the tier: a signal-strength glyph for priority. */
export const PriorityBars = ({
  priority,
  className,
}: {
  priority: KeywordPriority;
  className?: string;
}) => (
  <span aria-hidden className={cn("inline-flex shrink-0 items-end gap-[2px]", className)}>
    {[0, 1, 2].map((bar) => (
      <span
        key={bar}
        className={cn(
          "w-[3px] rounded-[1px] bg-current",
          bar >= FILLED_BARS[priority] && "opacity-25"
        )}
        style={{ height: 4 + bar * 3 }}
      />
    ))}
  </span>
);

const BAR_TONE: Record<KeywordTone | "neutral", string> = {
  matched: "text-emerald-600",
  missing: "text-rose-500",
  neutral: "text-slate-500",
};

export const KeywordPriorityHeading = ({
  priority,
  label,
  count,
  tone = "neutral",
  className,
}: {
  priority: KeywordPriority;
  label: string;
  count: number;
  tone?: KeywordTone | "neutral";
  className?: string;
}) => (
  <p
    className={cn(
      "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500",
      className
    )}
  >
    <PriorityBars priority={priority} className={BAR_TONE[tone]} />
    {label}
    <span className="font-medium tabular-nums text-slate-400">{count}</span>
  </p>
);

// A must-have chip is the heaviest on the card and a nice-to-have the lightest,
// so the ranking still reads when the headings are skimmed past.
const CHIP_TONE: Record<KeywordTone, Record<KeywordPriority, string>> = {
  matched: {
    high: "border-emerald-300 bg-emerald-100 font-semibold text-emerald-800",
    medium: "border-emerald-200 bg-emerald-50 font-medium text-emerald-700",
    low: "border-emerald-200/70 bg-white font-medium text-emerald-700",
  },
  missing: {
    high: "border-rose-300 bg-rose-100 font-semibold text-rose-800",
    medium: "border-rose-200 bg-rose-50 font-medium text-rose-700",
    low: "border-rose-200/70 bg-white font-medium text-rose-600",
  },
};

/** A keyword list as chips, under one heading per tier. */
export const KeywordPriorityChips = ({
  tone,
  keywords,
  weighted,
  dense = false,
  className,
}: {
  tone: KeywordTone;
  keywords: string[];
  weighted?: readonly WeightedKeywordLike[];
  /** Tighter chips, for the phone layout. */
  dense?: boolean;
  className?: string;
}) => (
  <div className={cn("space-y-3", className)}>
    {groupKeywordsByPriority(keywords, weighted).map((group) => (
      <div key={group.priority ?? "all"}>
        {group.priority ? (
          <KeywordPriorityHeading
            priority={group.priority}
            label={group.label}
            count={group.keywords.length}
            tone={tone}
            className="mb-1.5"
          />
        ) : null}
        <ul className="flex flex-wrap gap-1.5">
          {group.keywords.map((keyword) => (
            <li
              key={keyword}
              className={cn(
                "break-anywhere rounded-full border px-2.5 text-xs",
                dense ? "py-[3px]" : "py-1",
                CHIP_TONE[tone][group.priority ?? "medium"]
              )}
            >
              {keyword}
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
);

/** The same split as running text: "MUST-HAVE React, Node.js · IMPORTANT Docker". */
export const KeywordPriorityInline = ({
  keywords,
  weighted,
}: {
  keywords: string[];
  weighted?: readonly WeightedKeywordLike[];
}) => (
  <>
    {groupKeywordsByPriority(keywords, weighted).map((group, index) => (
      <span key={group.priority ?? "all"}>
        {index > 0 ? <span className="opacity-50"> · </span> : null}
        {group.priority ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide opacity-75">
            {group.label}{" "}
          </span>
        ) : null}
        {group.keywords.join(", ")}
      </span>
    ))}
  </>
);

/** Plain-text form of KeywordPriorityInline, for a title tooltip. */
export const keywordPriorityText = (
  keywords: string[],
  weighted?: readonly WeightedKeywordLike[]
) =>
  groupKeywordsByPriority(keywords, weighted)
    .map((group) =>
      group.priority ? `${group.label}: ${group.keywords.join(", ")}` : group.keywords.join(", ")
    )
    .join(" · ");
