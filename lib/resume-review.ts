// Change review for the optimized resume: what the optimizer replaced or added,
// compared with the base resume, as a list of changes the user accepts or
// rejects one at a time.
//
// The review is worked out once, when the optimized resume arrives. After that
// the resume object stays the source of truth: a pending or accepted change
// leaves the optimizer's text in place, and rejecting one writes the original
// text back. A change is found again by the text it produces, so a line the
// user has since edited by hand simply drops out of the review.
//
// Pure functions only — no React, no DOM — so both layouts share them.

export type ReviewableResume = {
  summary?: string;
  skills?: string[];
  experience?: { company?: string; responsibilities?: string[] }[];
  projects?: { name?: string; responsibilities?: string[] }[];
};

export type ReviewPart =
  | { type: "equal"; text: string }
  | { type: "change"; id: number; del: string; ins: string };

type TextUnit = {
  kind: "summary" | "experience" | "projects";
  /** The role's company or the project's name, normalized; "" for the summary. */
  groupKey: string;
  parts: ReviewPart[];
};

type SkillsUnit = {
  kind: "skills";
  label: string | null;
  /** `id` is set on items the optimizer added. */
  items: { text: string; id: number | null }[];
};

export type ReviewUnit = TextUnit | SkillsUnit;

export type ResumeReview = { units: ReviewUnit[] };

/** A change with no entry here is still pending. */
export type ReviewDecisions = Record<number, "accepted" | "rejected">;

export type ReviewChangeKind = "replaced" | "added" | "removed" | "estimated";

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

const collapse = (value = "") => String(value || "").replace(/\s+/g, " ").trim();
const squash = (value = "") => String(value || "").replace(/\s+/g, "");
const groupKeyOf = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const sameGroup = (a: string, b: string) => Boolean(a && b && (a.includes(b) || b.includes(a)));

// Joins pieces of a sentence, putting back the space a removed piece took with it.
const joinPieces = (pieces: string[]) =>
  collapse(
    pieces.reduce((text, piece) => {
      if (!piece) return text;
      return text && !/\s$/.test(text) && !/^\s/.test(piece) ? `${text} ${piece}` : text + piece;
    }, "")
  );

// ---------------------------------------------------------------------------
// Word diff
// ---------------------------------------------------------------------------

// A word with the whitespace that follows it, so pieces re-join exactly.
const tokenize = (text: string) => text.match(/\S+\s*/g) || [];

type Op = { type: "equal" | "del" | "ins"; text: string };

const diffWords = (original: string[], proposed: string[]): Op[] => {
  const n = original.length;
  const m = proposed.length;
  const a = original.map((token) => token.trim());
  const b = proposed.map((token) => token.trim());
  // Longest common subsequence, filled from the end so it reads forwards.
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: "equal", text: proposed[j] });
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ type: "del", text: original[i] });
      i += 1;
    } else {
      ops.push({ type: "ins", text: proposed[j] });
      j += 1;
    }
  }
  while (i < n) ops.push({ type: "del", text: original[i++] });
  while (j < m) ops.push({ type: "ins", text: proposed[j++] });
  return ops;
};

type ChangeRun = { type: "change"; del: string; ins: string };
type Run = { type: "equal"; tokens: string[] } | ChangeRun;

// Two changes this few words apart read as one edit, not two.
const MERGE_GAP_WORDS = 2;
// Past this many separate edits, or with less than this share of the line left
// untouched, a word-by-word diff is confetti: show the old line, then the new.
const MAX_CHANGES_PER_LINE = 3;
const MIN_UNCHANGED_SHARE = 0.5;

const diffText = (original: string, proposed: string): Run[] => {
  const from = collapse(original);
  const to = collapse(proposed);
  if (from === to) return [{ type: "equal", tokens: tokenize(to) }];
  if (!from) return [{ type: "change", del: "", ins: to }];
  if (!to) return [{ type: "change", del: from, ins: "" }];

  const originalTokens = tokenize(from);
  const proposedTokens = tokenize(to);
  const runs: Run[] = [];
  diffWords(originalTokens, proposedTokens).forEach((op) => {
    const last = runs[runs.length - 1];
    if (op.type === "equal") {
      if (last?.type === "equal") last.tokens.push(op.text);
      else runs.push({ type: "equal", tokens: [op.text] });
      return;
    }
    let change: ChangeRun;
    if (last?.type === "change") {
      change = last;
    } else {
      change = { type: "change", del: "", ins: "" };
      runs.push(change);
    }
    if (op.type === "del") change.del += op.text;
    else change.ins += op.text;
  });

  const merged: Run[] = [];
  runs.forEach((run) => {
    const previous = merged[merged.length - 1];
    const beforePrevious = merged[merged.length - 2];
    if (
      run.type === "change" &&
      previous?.type === "equal" &&
      beforePrevious?.type === "change" &&
      previous.tokens.length <= MERGE_GAP_WORDS
    ) {
      const gap = previous.tokens.join("");
      beforePrevious.del = joinPieces([beforePrevious.del, gap, run.del]);
      beforePrevious.ins = joinPieces([beforePrevious.ins, gap, run.ins]);
      merged.pop();
      return;
    }
    merged.push(run.type === "equal" ? { type: "equal", tokens: [...run.tokens] } : { ...run });
  });

  const changes = merged.filter((run) => run.type === "change").length;
  const unchanged = merged.reduce(
    (count, run) => (run.type === "equal" ? count + run.tokens.length : count),
    0
  );
  const longest = Math.max(originalTokens.length, proposedTokens.length);
  if (changes > MAX_CHANGES_PER_LINE || unchanged / longest < MIN_UNCHANGED_SHARE) {
    return [{ type: "change", del: from, ins: to }];
  }
  return merged;
};

// ---------------------------------------------------------------------------
// Building the review
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "over", "using", "across",
  "through", "while", "their", "our", "was", "were", "are", "has", "have", "had", "its",
]);

const wordSet = (text: string) =>
  new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9+#.\s-]/g, " ")
      .split(/\s+/)
      .map((word) => word.replace(/^[.-]+|[.-]+$/g, ""))
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
  );

// How much of the shorter line's vocabulary the two lines share.
const similarity = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  a.forEach((word) => {
    if (b.has(word)) shared += 1;
  });
  return shared < 2 ? 0 : shared / Math.min(a.size, b.size);
};

const MIN_PAIR_SIMILARITY = 0.4;

// Which original bullet each optimized bullet was rewritten from, best matches
// first. A bullet with no counterpart (null) is one the optimizer added.
const pairBullets = (original: string[], proposed: string[]): (string | null)[] => {
  const originalSets = original.map(wordSet);
  const proposedSets = proposed.map(wordSet);
  const candidates: { from: number; to: number; score: number }[] = [];
  proposed.forEach((line, to) => {
    original.forEach((source, from) => {
      const score = collapse(source) === collapse(line) ? 2 : similarity(originalSets[from], proposedSets[to]);
      if (score >= MIN_PAIR_SIMILARITY) candidates.push({ from, to, score });
    });
  });
  candidates.sort((x, y) => y.score - x.score);

  const pairs: (string | null)[] = proposed.map(() => null);
  const usedFrom = new Set<number>();
  const usedTo = new Set<number>();
  candidates.forEach(({ from, to }) => {
    if (usedFrom.has(from) || usedTo.has(to)) return;
    usedFrom.add(from);
    usedTo.add(to);
    pairs[to] = original[from];
  });
  return pairs;
};

const SKILL_LABEL_PATTERN = /^([A-Za-z][A-Za-z0-9 &/+().-]{0,38}?):\s*(.*)$/;
const splitSkillItems = (value: string) =>
  value
    .split(/,(?![^()]*\))/)
    .map((item) => item.trim())
    .filter(Boolean);
const parseSkillLine = (line: string) => {
  const clean = collapse(line);
  const match = clean.match(SKILL_LABEL_PATTERN);
  return match && match[2]
    ? { label: match[1].trim(), items: splitSkillItems(match[2]) }
    : { label: null, items: splitSkillItems(clean) };
};
const skillKey = (item: string) =>
  item
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, " ")
    .trim();

/**
 * Compare the base resume with what the optimizer returned.
 *
 * Covers the summary, skills, and the bullets of each role and project — the
 * parts the optimizer rewrites. Bullets it dropped outright have nowhere to be
 * shown and are not tracked.
 */
export const buildResumeReview = (
  original: ReviewableResume,
  optimized: ReviewableResume
): ResumeReview => {
  const units: ReviewUnit[] = [];
  let nextId = 1;

  const addTextUnit = (kind: TextUnit["kind"], groupKey: string, from: string, to: string) => {
    const runs = diffText(from, to);
    if (!runs.some((run) => run.type === "change")) return;
    units.push({
      kind,
      groupKey,
      parts: runs.map((run) =>
        run.type === "equal"
          ? { type: "equal", text: run.tokens.join("") }
          : { type: "change", id: nextId++, del: run.del, ins: run.ins }
      ),
    });
  };

  if (collapse(optimized.summary)) {
    addTextUnit("summary", "", original.summary || "", optimized.summary || "");
  }

  const knownSkills = new Set(
    (original.skills || []).flatMap((line) => parseSkillLine(line).items.map(skillKey))
  );
  (optimized.skills || []).forEach((line) => {
    const { label, items } = parseSkillLine(line);
    const tracked = items.map((text) => ({
      text,
      id: knownSkills.has(skillKey(text)) ? null : nextId++,
    }));
    if (tracked.some((item) => item.id !== null)) units.push({ kind: "skills", label, items: tracked });
  });

  const addBulletUnits = (
    kind: "experience" | "projects",
    originalGroups: { key: string; bullets: string[] }[],
    optimizedGroups: { key: string; bullets: string[] }[]
  ) => {
    const used = new Set<number>();
    optimizedGroups.forEach((group) => {
      // Groups pair one-to-one and in order, so two roles at one employer (a
      // promotion) are each compared with their own bullets.
      const index = originalGroups.findIndex(
        (candidate, i) => !used.has(i) && sameGroup(candidate.key, group.key)
      );
      if (index !== -1) used.add(index);
      const source = index === -1 ? [] : originalGroups[index].bullets;
      pairBullets(source, group.bullets).forEach((from, position) => {
        addTextUnit(kind, group.key, from || "", group.bullets[position]);
      });
    });
  };

  addBulletUnits(
    "experience",
    (original.experience || []).map((role) => ({
      key: groupKeyOf(role.company),
      bullets: role.responsibilities || [],
    })),
    (optimized.experience || []).map((role) => ({
      key: groupKeyOf(role.company),
      bullets: role.responsibilities || [],
    }))
  );
  addBulletUnits(
    "projects",
    (original.projects || []).map((project) => ({
      key: groupKeyOf(project.name),
      bullets: project.responsibilities || [],
    })),
    (optimized.projects || []).map((project) => ({
      key: groupKeyOf(project.name),
      bullets: project.responsibilities || [],
    }))
  );

  return { units };
};

// ---------------------------------------------------------------------------
// Reading a review against the current resume
// ---------------------------------------------------------------------------

const unitChangeIds = (unit: ReviewUnit): number[] =>
  unit.kind === "skills"
    ? unit.items.flatMap((item) => (item.id === null ? [] : [item.id]))
    : unit.parts.flatMap((part) => (part.type === "change" ? [part.id] : []));

/** The line a unit stands for right now: the original text wherever a change was rejected. */
const composeUnit = (unit: ReviewUnit, decisions: ReviewDecisions): string => {
  if (unit.kind === "skills") {
    const items = unit.items
      .filter((item) => item.id === null || decisions[item.id] !== "rejected")
      .map((item) => item.text);
    if (!items.length) return "";
    return unit.label ? `${unit.label}: ${items.join(", ")}` : items.join(", ");
  }
  return joinPieces(
    unit.parts.map((part) =>
      part.type === "equal" ? part.text : decisions[part.id] === "rejected" ? part.del : part.ins
    )
  );
};

type UnitLocation =
  | { section: "summary" }
  | { section: "skills"; index: number }
  | { section: "experience" | "projects"; group: number; index: number };

type LocatedUnit = { unit: ReviewUnit; text: string; location: UnitLocation };

// Where each unit's line sits in the resume as it stands. A unit whose line is
// no longer there — the user rewrote or deleted it — is left out.
const locateUnits = (
  data: ReviewableResume,
  review: ResumeReview,
  decisions: ReviewDecisions
): LocatedUnit[] => {
  const located: LocatedUnit[] = [];
  const taken = new Set<string>();

  review.units.forEach((unit) => {
    const text = composeUnit(unit, decisions);
    if (!text) return;

    if (unit.kind === "summary") {
      if (collapse(data.summary) === text) located.push({ unit, text, location: { section: "summary" } });
      return;
    }

    if (unit.kind === "skills") {
      const index = (data.skills || []).findIndex(
        (line, i) => !taken.has(`skills:${i}`) && squash(line) === squash(text)
      );
      if (index === -1) return;
      taken.add(`skills:${index}`);
      located.push({ unit, text, location: { section: "skills", index } });
      return;
    }

    const section = unit.kind;
    const groups =
      section === "experience"
        ? (data.experience || []).map((role) => ({
            key: groupKeyOf(role.company),
            bullets: role.responsibilities || [],
          }))
        : (data.projects || []).map((project) => ({
            key: groupKeyOf(project.name),
            bullets: project.responsibilities || [],
          }));
    const find = (sameGroupOnly: boolean) => {
      for (let group = 0; group < groups.length; group += 1) {
        if (sameGroupOnly && !sameGroup(groups[group].key, unit.groupKey)) continue;
        const index = groups[group].bullets.findIndex(
          (bullet, i) => !taken.has(`${section}:${group}:${i}`) && collapse(bullet) === text
        );
        if (index !== -1) return { group, index };
      }
      return null;
    };
    const spot = find(true) || find(false);
    if (!spot) return;
    taken.add(`${section}:${spot.group}:${spot.index}`);
    located.push({ unit, text, location: { section, ...spot } });
  });

  return located;
};

const writeLine = <T extends ReviewableResume>(data: T, location: UnitLocation, text: string): T => {
  if (location.section === "summary") return { ...data, summary: text };

  if (location.section === "skills") {
    const skills = [...(data.skills || [])];
    if (text) skills[location.index] = text;
    else skills.splice(location.index, 1);
    return { ...data, skills };
  }

  const edit = <G extends { responsibilities?: string[] }>(groups: G[] = []) =>
    groups.map((group, index) => {
      if (index !== location.group) return group;
      const responsibilities = [...(group.responsibilities || [])];
      if (text) responsibilities[location.index] = text;
      else responsibilities.splice(location.index, 1);
      return { ...group, responsibilities };
    });
  return location.section === "experience"
    ? { ...data, experience: edit(data.experience) }
    : { ...data, projects: edit(data.projects) };
};

// ---------------------------------------------------------------------------
// Markup
//
// Pending changes are written into a copy of the resume between private-use
// characters, which pass through the template renderer and its HTML escaping
// untouched. renderReviewMarkup then swaps them for tags. Marking the data
// rather than searching the rendered HTML means a change is highlighted exactly
// where it is, whatever the template does with the line around it.
// ---------------------------------------------------------------------------

const MARK_OPEN: Record<ReviewChangeKind, string> = {
  removed: "",
  replaced: "",
  added: "",
  estimated: "",
};
const MARK_ID_END = "";
const MARK_CLOSE = "";
const MARK_KIND = Object.fromEntries(
  Object.entries(MARK_OPEN).map(([kind, open]) => [open, kind])
) as Record<string, ReviewChangeKind>;
const MARK_PATTERN = /([-])(\d+)([^]*)/g;

const wrap = (kind: ReviewChangeKind, id: number, text: string) =>
  `${MARK_OPEN[kind]}${id}${MARK_ID_END}${text}${MARK_CLOSE}`;

const markUnit = (unit: ReviewUnit, decisions: ReviewDecisions, estimated: boolean): string => {
  if (unit.kind === "skills") {
    const items = unit.items
      .filter((item) => item.id === null || decisions[item.id] !== "rejected")
      .map((item) =>
        item.id === null || decisions[item.id] ? item.text : wrap("added", item.id, item.text)
      );
    return unit.label ? `${unit.label}: ${items.join(", ")}` : items.join(", ");
  }
  return joinPieces(
    unit.parts.map((part) => {
      if (part.type === "equal") return part.text;
      const decision = decisions[part.id];
      if (decision === "rejected") return part.del;
      if (decision === "accepted") return part.ins;
      const del = collapse(part.del);
      const ins = collapse(part.ins);
      const kind: ReviewChangeKind = estimated ? "estimated" : del ? "replaced" : "added";
      // The old text first, the new text straight after it.
      return [del ? wrap("removed", part.id, del) : "", ins ? wrap(kind, part.id, ins) : ""]
        .filter(Boolean)
        .join(" ")
        .concat(" ");
    })
  );
};

export type ReviewedResume<T> = {
  /** A copy of the resume with pending changes marked, for the preview only. */
  data: T;
  /** Changes still waiting on the user, in lines that are still in the resume. */
  pendingIds: number[];
  /** The pending changes that sit in a line carrying an unconfirmed suggested figure. */
  estimatedIds: number[];
};

/**
 * `estimatedLines` are the metrics points whose suggested figure is still
 * unconfirmed: a change inside one of those is marked as an estimate.
 */
export const markReviewedResume = <T extends ReviewableResume>(
  data: T,
  review: ResumeReview,
  decisions: ReviewDecisions,
  estimatedLines: string[] = []
): ReviewedResume<T> => {
  const estimatedSet = new Set(estimatedLines.map(collapse));
  let marked = data;
  const pendingIds: number[] = [];
  const estimatedIds: number[] = [];

  locateUnits(data, review, decisions).forEach(({ unit, text, location }) => {
    const pending = unitChangeIds(unit).filter((id) => !decisions[id]);
    if (!pending.length) return;
    const estimated = unit.kind !== "skills" && estimatedSet.has(text);
    pendingIds.push(...pending);
    if (estimated) estimatedIds.push(...pending);
    marked = writeLine(marked, location, markUnit(unit, decisions, estimated));
  });

  return { data: marked, pendingIds, estimatedIds };
};

/** Reject one change: its line goes back to the original text (or is removed, if it was added). */
export const rejectReviewChange = <T extends ReviewableResume>(
  data: T,
  review: ResumeReview,
  decisions: ReviewDecisions,
  id: number
): { data: T; decisions: ReviewDecisions } => {
  const target = locateUnits(data, review, decisions).find(({ unit }) =>
    unitChangeIds(unit).includes(id)
  );
  const next: ReviewDecisions = { ...decisions, [id]: "rejected" };
  if (!target) return { data, decisions: next };
  return { data: writeLine(data, target.location, composeUnit(target.unit, next)), decisions: next };
};

/** The line a change sits in, as it reads now — used to tell which suggested figure it confirms. */
export const lineOfReviewChange = (
  data: ReviewableResume,
  review: ResumeReview,
  decisions: ReviewDecisions,
  id: number
): string =>
  locateUnits(data, review, decisions).find(({ unit }) => unitChangeIds(unit).includes(id))?.text ||
  "";

const MARK_STYLE: Record<ReviewChangeKind, string> = {
  removed:
    "background-color:rgba(244,63,94,0.13);color:#be123c;text-decoration:line-through;text-decoration-color:rgba(190,18,60,0.55);",
  replaced: "background-color:rgba(16,185,129,0.2);color:inherit;",
  added: "background-color:rgba(16,185,129,0.2);color:inherit;",
  estimated: "background-color:rgba(245,158,11,0.26);color:inherit;",
};
const MARK_BASE_STYLE =
  "border-radius:2px;padding:0 1px;cursor:pointer;box-decoration-break:clone;-webkit-box-decoration-break:clone;";

/** Turn the markers left by markReviewedResume into highlight tags. PREVIEW ONLY. */
export const renderReviewMarkup = (html: string): string =>
  html.replace(MARK_PATTERN, (_, open: string, id: string, text: string) => {
    const kind = MARK_KIND[open];
    const tag = kind === "removed" ? "del" : "mark";
    return `<${tag} data-review-change="${id}" data-review-kind="${kind}" style="${MARK_BASE_STYLE}${MARK_STYLE[kind]}">${text}</${tag}>`;
  });
