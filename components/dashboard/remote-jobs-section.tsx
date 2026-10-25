"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { track } from "@vercel/analytics";
import { toast } from "react-toastify";
import swal from "sweetalert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDefaultBaseResumeTitle } from "@/lib/base-resume";
import { authedFetch } from "@/lib/authed-fetch";
import { cn } from "@/lib/utils";
import {
  COMPANY_SIZES,
  COMPANY_TYPES,
  EMPLOYMENT_TYPES,
  dedupeLabels,
  FREE_PLAN_PREVIEW_JOBS,
  FREE_PLAN_VISIBLE_JOBS,
  INDUSTRIES,
  isScannable,
  JOB_RETENTION_DAYS,
  LOCATION_OPTIONS,
  POSTED_WITHIN_OPTIONS,
  REGION_LABELS,
  REMOTE_JOBS_PAGE_SIZE,
  SALARY_OPTIONS,
  SENIORITY_LEVELS,
  SOURCE_CREDITS,
  TECH_STACK_FILTERS,
  WORKPLACE_TYPES,
  type RemoteJob,
  type SavedRemoteJob,
} from "@/lib/remote-jobs/types";
import {
  ArrowLeft,
  Bookmark,
  Building2,
  CalendarX2,
  Clock,
  Code2,
  ExternalLink,
  Globe2,
  Loader2,
  Lock,
  ScanLine,
  Search,
  SearchX,
  SlidersHorizontal,
  Trash2,
  Wallet,
} from "lucide-react";

type Filters = {
  workplaceType: string;
  location: string;
  employmentType: string;
  seniority: string;
  postedWithinDays: string;
  techStack: string;
  industry: string;
  companyType: string;
  companySize: string;
  salary: string;
};

const EMPTY_FILTERS: Filters = {
  workplaceType: "",
  location: "",
  employmentType: "",
  seniority: "",
  postedWithinDays: "",
  techStack: "",
  industry: "",
  companyType: "",
  companySize: "",
  salary: "",
};

type FilterOption = { value: string; label: string };

/**
 * A resume title as a search: "Senior Software Engineer | React & Node" →
 * "Senior Software Engineer". Keyword search needs every distinctive word to
 * appear in a job, so the tagline after a separator would only narrow it.
 */
const searchableTitle = (title: string) =>
  title.split(/\s[|•·–—-]\s|[|•·,(]/)[0].trim().slice(0, 80);

/** The filter panel, in display order. "" is each filter's "any" choice. */
const FILTER_FIELDS: {
  key: keyof Filters;
  label: string;
  anyLabel: string;
  options: readonly FilterOption[];
}[] = [
  { key: "workplaceType", label: "Work type", anyLabel: "Remote or hybrid", options: WORKPLACE_TYPES },
  { key: "location", label: "Location", anyLabel: "Any location", options: LOCATION_OPTIONS },
  { key: "employmentType", label: "Employment type", anyLabel: "Any type", options: EMPLOYMENT_TYPES },
  { key: "seniority", label: "Seniority", anyLabel: "Any level", options: SENIORITY_LEVELS },
  {
    key: "postedWithinDays",
    label: "Posted",
    anyLabel: `Last ${JOB_RETENTION_DAYS} days`,
    options: POSTED_WITHIN_OPTIONS,
  },
  {
    key: "techStack",
    label: "Tech stack",
    anyLabel: "Any tech",
    options: TECH_STACK_FILTERS.map((tech) => ({ value: tech, label: tech })),
  },
  { key: "industry", label: "Industry", anyLabel: "Any industry", options: INDUSTRIES },
  { key: "companyType", label: "Company type", anyLabel: "Any company", options: COMPANY_TYPES },
  { key: "companySize", label: "Company size", anyLabel: "Any size", options: COMPANY_SIZES },
  { key: "salary", label: "Salary", anyLabel: "Any salary", options: SALARY_OPTIONS },
];

type RemoteJobsSectionProps = {
  userId?: string;
  /**
   * True only for an active Pro plan. Defaults to false so a missing
   * prop locks the list rather than giving it away — the gate fails closed.
   */
  hasFullAccess?: boolean;
  /**
   * The plan is still loading. The opening search waits for it, since the plan
   * decides how many results to ask for.
   */
  accessLoading?: boolean;
  /**
   * Hands the selected job to the existing scanner. The host maps it onto the
   * scan form's fields and switches section — nothing about the scan flow
   * itself changes.
   */
  onScanJob?: (job: {
    organization: string;
    designation: string;
    jd: string;
    /**
     * Enough of the posting to find the way back to it after the scan. Without
     * this the user optimizes a resume and then has no route to the job they
     * did it for.
     */
    remoteJob: {
      id: string;
      title: string;
      companyName: string;
      applicationUrl: string;
    };
  }) => void;
};

const SELECT_CLASS =
  "h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 md:h-9";

const labelMap = (options: readonly FilterOption[]) =>
  Object.fromEntries(options.map((option) => [option.value, option.label]));
const EMPLOYMENT_LABELS = labelMap(EMPLOYMENT_TYPES);
const SENIORITY_LABELS = labelMap(SENIORITY_LEVELS);
const INDUSTRY_LABELS = labelMap(INDUSTRIES);
const SIZE_LABELS = labelMap(COMPANY_SIZES);

const formatPostedAt = (iso: string) => {
  if (!iso) return "";
  const posted = new Date(iso).getTime();
  if (!Number.isFinite(posted)) return "";
  const days = Math.floor((Date.now() - posted) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "Posted today";
  if (days === 1) return "Posted 1 day ago";
  if (days < 30) return `Posted ${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "Posted 1 month ago" : `Posted ${months} months ago`;
};

// "12 Oct 2026". Fixed month names, so it reads the same in every locale.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const formatSavedOn = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

const newestSavedFirst = (list: SavedRemoteJob[]) =>
  [...list].sort((a, b) => b.savedAt.localeCompare(a.savedAt));

/** The copy a save keeps: the listing without its description. */
const toSavedJob = (job: RemoteJob): SavedRemoteJob => ({
  ...job,
  description: "",
  descriptionHtml: "",
  detailLoaded: false,
  savedAt: new Date().toISOString(),
  expired: false,
});

type ListView = "search" | "saved";

/** "Full-time · Senior" — only the parts the source actually gave us. */
const metaLine = (job: RemoteJob) =>
  [EMPLOYMENT_LABELS[job.employmentType], SENIORITY_LABELS[job.seniority]]
    .filter(Boolean)
    .join(" · ");

/** "Startup · 51–200 employees · Fintech & Financial Services" */
const companyLine = (job: RemoteJob) =>
  [
    job.isStartup ? "Startup" : "",
    SIZE_LABELS[job.companySize] || "",
    INDUSTRY_LABELS[job.industry] || "",
  ]
    .filter(Boolean)
    .join(" · ");

/**
 * Chips for a job: its tech stack when the posting names any, otherwise the
 * source's own categorisation. De-duplicated here as well — the label doubles
 * as the React key.
 */
const tagsFor = (job: RemoteJob) =>
  dedupeLabels(job.skills.length ? job.skills : job.categories);

let regionNames: Intl.DisplayNames | null = null;
const countryName = (code: string) => {
  try {
    regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code) || code;
  } catch {
    return code;
  }
};

/**
 * "Remote — Anywhere", "Remote — India, APAC", "Hybrid — Bengaluru, India".
 * For a remote job the countries and regions are where you may work from; for
 * a hybrid job the source's own location (the office) reads better.
 */
const placeLine = (job: RemoteJob) => {
  const kind = job.workplaceType === "hybrid" ? "Hybrid" : "Remote";
  if (job.workplaceType === "remote" && job.regions.includes("worldwide")) {
    return `${kind} — Anywhere`;
  }
  const areas = dedupeLabels([
    ...job.countries.map(countryName),
    ...job.regions.filter((region) => region !== "worldwide").map((region) => REGION_LABELS[region]),
  ]);
  const where =
    job.workplaceType === "hybrid" ? job.location || areas.join(", ") : areas.slice(0, 4).join(", ") || job.location;
  return where ? `${kind} — ${where}` : kind;
};

/** Same place in other words: compares the letters, ignoring "remote"/"hybrid". */
const restates = (location: string, line: string) => {
  const letters = (value: string) =>
    value.toLowerCase().replace(/\b(remote|hybrid)\b/g, "").replace(/[^a-z]/g, "");
  return letters(location) === letters(line);
};

/**
 * The job title, linked to the source where its terms require it: startup.jobs
 * asks that every title link to the listing on startup.jobs, as an ordinary
 * (followed) link.
 */
const JobTitle = ({ job, className }: { job: RemoteJob; className: string }) =>
  job.source === "startupjobs" && job.sourceUrl ? (
    <a href={job.sourceUrl} target="_blank" rel="noopener" className={cn(className, "hover:underline")}>
      {job.title}
    </a>
  ) : (
    <span className={className}>{job.title}</span>
  );

const SectionHeading = () => (
  <div className="flex items-start gap-3 sm:items-center">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
      <Globe2 className="h-5 w-5" />
    </span>
    <div>
      <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
        Remote Jobs
      </h1>
      <p className="text-sm text-slate-500">
        Remote and hybrid roles, refreshed every night.
      </p>
    </div>
  </div>
);

const CompanyLogo = ({ job, size }: { job: RemoteJob; size: "sm" | "lg" }) => {
  const [failed, setFailed] = useState(false);
  const box = size === "lg" ? "h-14 w-14" : "h-11 w-11";
  if (!job.companyLogo || failed) {
    return (
      <span
        className={cn(
          box,
          "flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400"
        )}
      >
        <Building2 className={size === "lg" ? "h-6 w-6" : "h-5 w-5"} />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={job.companyLogo}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn(
        box,
        "shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-1"
      )}
    />
  );
};

export const RemoteJobsSection = ({
  userId,
  hasFullAccess = false,
  accessLoading = false,
  onScanJob,
}: RemoteJobsSectionProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeJobId = searchParams?.get("job") || "";
  // Search and Saved are two lists of the same section. The choice lives in the
  // URL, so a job opened from either one leads back to it.
  const view: ListView = searchParams?.get("view") === "saved" ? "saved" : "search";

  const [queryInput, setQueryInput] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [jobs, setJobs] = useState<RemoteJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Explains the list the section opened with — the user didn't type it.
  const [autoNote, setAutoNote] = useState("");
  // Set by any search or filter change the user starts, so the
  // opening search never overwrites what they asked for.
  const userSearchedRef = useRef(false);
  const autoSearchStartedRef = useRef(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  // Mirrors the search that produced the current list, so the scroll loader
  // pages the right query even if the inputs have been edited since.
  const activeSearchRef = useRef<{ query: string; filters: Filters } | null>(null);
  // How many records the server has handed back so far — the next page's
  // offset. Counted from the response rather than from `jobs.length`, which
  // client-side de-duplication can leave behind and stall the cursor.
  const fetchedCountRef = useRef(0);
  // A job opened from a direct link, when the result list isn't in memory.
  const [linkedJob, setLinkedJob] = useState<RemoteJob | null>(null);
  const [linkedJobError, setLinkedJobError] = useState("");
  const viewedJobIdRef = useRef("");
  const detailTopRef = useRef<HTMLElement | null>(null);

  // Saved jobs. Updated through `updateSaved`, which keeps the ref in step: an
  // undo fired from a toast runs long after the render that created it.
  const [savedJobs, setSavedJobs] = useState<SavedRemoteJob[]>([]);
  const savedJobsRef = useRef<SavedRemoteJob[]>([]);
  const [savedStatus, setSavedStatus] = useState<"loading" | "ready" | "error">("loading");
  // Jobs whose save or removal is in flight — their buttons wait for it.
  const pendingSaveRef = useRef(new Set<string>());
  const [pendingSaveIds, setPendingSaveIds] = useState<string[]>([]);

  useEffect(() => {
    track("remote_jobs_viewed");
  }, []);

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters]
  );

  const savedIds = useMemo(() => new Set(savedJobs.map((job) => job.id)), [savedJobs]);

  /**
   * The stripped record from the result list, or the saved list — header
   * fields only, possibly no JD.
   */
  const listJob = useMemo(
    () =>
      activeJobId
        ? jobs.find((job) => job.id === activeJobId) ||
          savedJobs.find((job) => job.id === activeJobId && !job.expired) ||
          null
        : null,
    [activeJobId, jobs, savedJobs]
  );

  // The ATS boards withhold descriptions from search responses (they run to
  // tens of MB), so a list record is often incomplete and the full one has to
  // be fetched. The id check on `linkedJob` matters: without it, opening a
  // second job would show the previous one's description while the new one
  // loads — and that description is what "Scan My Resume" would send.
  const selectedJob = useMemo(() => {
    if (!activeJobId) return null;
    if (linkedJob?.id === activeJobId) return linkedJob;
    return listJob?.detailLoaded ? listJob : null;
  }, [activeJobId, listJob, linkedJob]);

  /** Header is on screen from the list, but the JD is still in flight. */
  const detailPending = Boolean(activeJobId) && !selectedJob && !linkedJobError;

  // Pro sees the whole list; everyone else gets three they can open and a
  // blurred run beneath.
  const openJobs = useMemo(
    () => (hasFullAccess ? jobs : jobs.slice(0, FREE_PLAN_VISIBLE_JOBS)),
    [hasFullAccess, jobs]
  );
  const lockedJobs = useMemo(
    () =>
      hasFullAccess
        ? []
        : jobs.slice(
            FREE_PLAN_VISIBLE_JOBS,
            FREE_PLAN_VISIBLE_JOBS + FREE_PLAN_PREVIEW_JOBS
          ),
    [hasFullAccess, jobs]
  );

  /** True when the plan actually held results back, not merely that it could. */
  const withheldResults = !hasFullAccess && jobs.length > FREE_PLAN_VISIBLE_JOBS;

  // The blurred cards aren't clickable, but the URL that opens a job is — so a
  // locked one is bounced back to the list rather than rendered.
  // A saved job is the user's own pick, whatever the current search shows.
  useEffect(() => {
    if (hasFullAccess || !activeJobId || savedIds.has(activeJobId)) return;
    if (!lockedJobs.some((job) => job.id === activeJobId)) return;
    router.replace("/scan?section=remote-jobs");
  }, [hasFullAccess, activeJobId, lockedJobs, savedIds, router]);

  /**
   * Runs a search, or loads its next page. Resolves to how many jobs the first
   * page returned, or null if the search failed or didn't run.
   */
  const runSearch = useCallback(
    async (query: string, nextFilters: Filters, offset = 0): Promise<number | null> => {
      if (!userId) {
        setError("Please log in to browse remote jobs.");
        return null;
      }
      if (accessLoading) return null;
      const append = offset > 0;
      if (append) {
        setLoadingMore(true);
      } else {
        activeSearchRef.current = { query, filters: nextFilters };
        setLoading(true);
        setError("");
        setHasMore(false);
      }
      try {
        // Without a plan there is no paging, so ask only for what the list
        // shows: three open jobs plus the short blurred run beneath them.
        const params = new URLSearchParams({
          userId,
          limit: String(
            hasFullAccess
              ? REMOTE_JOBS_PAGE_SIZE
              : FREE_PLAN_VISIBLE_JOBS + FREE_PLAN_PREVIEW_JOBS
          ),
          offset: String(offset),
        });
        if (query.trim()) params.set("query", query.trim());
        for (const [key, value] of Object.entries(nextFilters)) {
          if (value) params.set(key, value);
        }

        const response = await fetch(`/api/remote-jobs?${params.toString()}`);
        const payload = await response.json();
        if (!payload.success) {
          // A failed page-2 keeps what's already on screen; only a failed first
          // page is worth replacing the list with an error.
          if (append) {
            setHasMore(false);
            return null;
          }
          setJobs([]);
          setError(payload.message || "Unable to load remote jobs right now.");
          return null;
        }
        const incoming: RemoteJob[] = Array.isArray(payload.data)
          ? payload.data
          : [];
        setJobs((prev) => {
          if (!append) return incoming;
          // Defensive: upstream can shift between pages, so never show a job
          // twice even if two pages happen to overlap.
          const seen = new Set(prev.map((job) => job.id));
          return [...prev, ...incoming.filter((job) => !seen.has(job.id))];
        });
        fetchedCountRef.current = append
          ? fetchedCountRef.current + incoming.length
          : incoming.length;
        // Scroll paging is a paid capability; without a plan the list ends at
        // the preview regardless of what the server says is available.
        setHasMore(
          hasFullAccess && Boolean(payload.hasMore) && incoming.length > 0
        );
        return incoming.length;
      } catch (searchError) {
        console.error("Remote job search failed:", searchError);
        if (append) {
          setHasMore(false);
          return null;
        }
        setJobs([]);
        setError(
          "We couldn't load jobs right now. Check your connection and try again."
        );
        return null;
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
          setHasSearched(true);
        }
      }
    },
    [userId, hasFullAccess, accessLoading]
  );

  // The section opens with results: jobs for the professional title on the
  // default base resume, or the newest jobs when there's no title or it
  // matches nothing. Once only — and not at all if the user gets there first.
  useEffect(() => {
    if (!userId || accessLoading || autoSearchStartedRef.current) return;
    autoSearchStartedRef.current = true;
    const openWithResults = async () => {
      // Covers the title lookup, so the empty "search for a role" state
      // doesn't flash before the results arrive.
      setLoading(true);
      const title = searchableTitle(await getDefaultBaseResumeTitle(userId).catch(() => ""));
      if (userSearchedRef.current) return;
      if (title) {
        setQueryInput(title);
        track("remote_job_search", { query: title, location: "any", auto: true });
        const found = await runSearch(title, EMPTY_FILTERS);
        if (userSearchedRef.current || found === null) return;
        if (found > 0) {
          setAutoNote(`Matched to “${title}”, the title on your default base resume.`);
          return;
        }
        setQueryInput("");
        setAutoNote(`Nothing matches “${title}” right now, so here are the newest jobs.`);
      }
      await runSearch("", EMPTY_FILTERS);
    };
    openWithResults();
  }, [userId, accessLoading, runSearch]);

  /** Marks a search as the user's own, ending the opening search's say. */
  const takeOver = () => {
    userSearchedRef.current = true;
    setAutoNote("");
  };

  const handleSearch = (event?: React.FormEvent) => {
    event?.preventDefault();
    takeOver();
    track("remote_job_search", {
      query: queryInput.trim().slice(0, 100),
      location: filters.location || "any",
    });
    runSearch(queryInput, filters);
  };

  // Changing a filter re-runs the search only once the user has searched at
  // least once — otherwise the empty state would vanish on a stray tap.
  const updateFilter = (key: keyof Filters, value: string) => {
    takeOver();
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    if (hasSearched) runSearch(queryInput, nextFilters);
  };

  const clearFilters = () => {
    takeOver();
    setFilters(EMPTY_FILTERS);
    if (hasSearched) runSearch(queryInput, EMPTY_FILTERS);
  };

  /**
   * Loads the next page as the sentinel below the list nears the viewport.
   * Rebuilt whenever a load starts or finishes, which is also what stops two
   * pages being requested at once.
   */
  useEffect(() => {
    if (activeJobId) return; // the detail view is showing, not the list
    if (!hasFullAccess) return; // paging past the preview needs a plan
    if (!hasMore || loading || loadingMore) return;
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        const active = activeSearchRef.current;
        if (!active) return;
        runSearch(active.query, active.filters, fetchedCountRef.current);
      },
      // Fetch a little before the sentinel is actually on screen, so the next
      // cards are usually in place by the time the user scrolls to them.
      { rootMargin: "400px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [activeJobId, hasFullAccess, hasMore, loading, loadingMore, runSearch]);

  const listUrl = (target: ListView = view) =>
    target === "saved" ? "/scan?section=remote-jobs&view=saved" : "/scan?section=remote-jobs";

  const showView = (target: ListView) => {
    if (target !== view) router.push(listUrl(target));
  };

  const openJob = (job: RemoteJob) => {
    router.push(`${listUrl()}&job=${encodeURIComponent(job.id)}`);
  };

  const closeJob = () => {
    router.push(listUrl());
  };

  const updateSaved = useCallback(
    (change: (list: SavedRemoteJob[]) => SavedRemoteJob[]) => {
      savedJobsRef.current = change(savedJobsRef.current);
      setSavedJobs(savedJobsRef.current);
    },
    []
  );

  const loadSavedJobs = useCallback(async () => {
    setSavedStatus("loading");
    try {
      const response = await authedFetch("/api/remote-jobs/saved");
      const payload = await response.json();
      if (!payload.success) throw new Error(payload.message || "Loading saved jobs failed.");
      updateSaved(() => (Array.isArray(payload.data) ? payload.data : []));
      setSavedStatus("ready");
    } catch (loadError) {
      console.error("Loading saved jobs failed:", loadError);
      setSavedStatus("error");
    }
  }, [updateSaved]);

  // Loaded with the section rather than with the Saved list, so every card can
  // show whether its job is already saved.
  useEffect(() => {
    if (!userId) return;
    loadSavedJobs();
  }, [userId, loadSavedJobs]);

  /**
   * Saves or removes a job. The bookmark flips at once and flips back if the
   * request fails. `undoable` offers the removal back in a toast — for the
   * Saved list, where the card disappears.
   */
  const setJobSaved = async (
    job: RemoteJob,
    save: boolean,
    { undoable = false }: { undoable?: boolean } = {}
  ) => {
    if (pendingSaveRef.current.has(job.id)) return;
    const previous = savedJobsRef.current.find((saved) => saved.id === job.id);
    if (save === Boolean(previous)) return;
    pendingSaveRef.current.add(job.id);
    setPendingSaveIds([...pendingSaveRef.current]);
    updateSaved((list) =>
      save ? [toSavedJob(job), ...list] : list.filter((saved) => saved.id !== job.id)
    );
    track(save ? "remote_job_saved" : "remote_job_unsaved", { jobId: job.id, source: job.source });

    try {
      const response = save
        ? await authedFetch("/api/remote-jobs/saved", {
            method: "POST",
            body: JSON.stringify({ jobId: job.id }),
          })
        : await authedFetch(`/api/remote-jobs/saved?id=${encodeURIComponent(job.id)}`, {
            method: "DELETE",
          });
      const payload = await response.json().catch(() => ({}));
      if (!payload.success) throw new Error(payload.message || "");
      if (save && payload.data) {
        updateSaved((list) => list.map((saved) => (saved.id === job.id ? payload.data : saved)));
      }
      // An expired job can't be saved again, so there is nothing to undo to.
      if (!save && undoable && previous && !previous.expired) {
        toast(({ closeToast }) => (
          <div className="flex items-center justify-between gap-3">
            <span>Removed from saved jobs.</span>
            <button
              type="button"
              className="shrink-0 font-semibold text-slate-900 underline"
              onClick={() => {
                closeToast?.();
                setJobSaved(previous, true);
              }}
            >
              Undo
            </button>
          </div>
        ));
      }
    } catch (saveError) {
      updateSaved((list) =>
        save
          ? list.filter((saved) => saved.id !== job.id)
          : previous
            ? newestSavedFirst([...list, previous])
            : list
      );
      const message = saveError instanceof Error ? saveError.message : "";
      toast.error(
        message ||
          (save
            ? "We couldn't save that job. Please try again."
            : "We couldn't remove that job. Please try again.")
      );
    } finally {
      pendingSaveRef.current.delete(job.id);
      setPendingSaveIds([...pendingSaveRef.current]);
    }
  };

  const toggleSaved = (job: RemoteJob) => setJobSaved(job, !savedIds.has(job.id));

  const clearExpiredSaved = async () => {
    const expired = savedJobsRef.current.filter((job) => job.expired);
    if (!expired.length) return;
    const confirmed = await swal({
      title: `Remove ${expired.length} expired ${expired.length === 1 ? "job" : "jobs"}?`,
      text: "They'll be cleared from your saved list. Expired postings can't be saved again.",
      icon: "warning",
      buttons: ["Cancel", "Remove"],
      dangerMode: true,
    });
    if (!confirmed) return;
    updateSaved((list) => list.filter((job) => !job.expired));
    try {
      const response = await authedFetch("/api/remote-jobs/saved?expired=1", { method: "DELETE" });
      const payload = await response.json().catch(() => ({}));
      if (!payload.success) throw new Error(payload.message || "");
    } catch (clearError) {
      console.error("Removing expired saved jobs failed:", clearError);
      updateSaved((list) => newestSavedFirst([...list, ...expired]));
      toast.error("We couldn't remove those jobs. Please try again.");
    }
  };

  /** From an expired saved job: the same search, for roles still open. */
  const findSimilar = (job: RemoteJob) => {
    const title = searchableTitle(job.title);
    takeOver();
    setQueryInput(title);
    showView("search");
    track("remote_job_search", {
      query: title,
      location: filters.location || "any",
      similar: true,
    });
    runSearch(title, filters);
  };

  // Fetches the complete record: either because the job was opened by URL
  // (refresh, shared link, back/forward) and isn't in the result list at all,
  // or because the list record came back without its description.
  useEffect(() => {
    if (!activeJobId || !userId) return;
    if (listJob?.detailLoaded) return;
    if (linkedJob?.id === activeJobId) return;

    let cancelled = false;
    setLinkedJobError("");
    fetch(
      `/api/remote-jobs?userId=${encodeURIComponent(
        userId
      )}&id=${encodeURIComponent(activeJobId)}`
    )
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        if (payload.success) {
          setLinkedJob(payload.data);
        } else {
          setLinkedJobError(
            payload.message || "This job is no longer available."
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLinkedJobError("We couldn't load this job. Please try again.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeJobId, userId, listJob, linkedJob]);

  // Opening a detail view mid-scroll would otherwise land the user halfway down
  // the description. scrollIntoView rather than window.scrollTo because the
  // dashboard's scroll container is <main>, not the window.
  useEffect(() => {
    if (!activeJobId) return;
    detailTopRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [activeJobId]);

  useEffect(() => {
    if (!selectedJob || viewedJobIdRef.current === selectedJob.id) return;
    viewedJobIdRef.current = selectedJob.id;
    track("remote_job_viewed", {
      jobId: selectedJob.id,
      source: selectedJob.source,
    });
  }, [selectedJob]);

  const handleScanJob = (job: RemoteJob) => {
    if (!isScannable(job)) {
      toast.error("This posting has no description we can scan against.");
      return;
    }
    track("remote_job_scan_clicked", { jobId: job.id, source: job.source });
    onScanJob?.({
      organization: job.companyName,
      designation: job.title,
      jd: job.description,
      remoteJob: {
        id: job.id,
        title: job.title,
        companyName: job.companyName,
        applicationUrl: job.applicationUrl,
      },
    });
  };

  const handleApply = (job: RemoteJob) => {
    if (!job.applicationUrl) {
      toast.error("This posting didn't include an application link.");
      return;
    }
    track("remote_job_apply_clicked", { jobId: job.id, source: job.source });
    window.open(job.applicationUrl, "_blank", "noopener,noreferrer");
  };

  if (activeJobId) {
    return (
      <section ref={detailTopRef} className="mx-auto max-w-4xl space-y-6">
        <Button
          variant="ghost"
          className="-ml-2 rounded-md px-2 text-slate-600"
          onClick={closeJob}
        >
          <ArrowLeft className="h-4 w-4" />
          {view === "saved" ? "Back to saved jobs" : "Back to jobs"}
        </Button>

        {detailPending && !listJob ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : detailPending && listJob ? (
          // Header fields are already in hand from the result list, so show the
          // job immediately and keep only the description in a loading state.
          <JobDetail
            job={listJob}
            descriptionLoading
            onScan={() => {}}
            onApply={() => handleApply(listJob)}
            saved={savedIds.has(listJob.id)}
            saving={pendingSaveIds.includes(listJob.id)}
            onToggleSave={() => toggleSaved(listJob)}
          />
        ) : !selectedJob ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <SearchX className="mx-auto h-8 w-8 text-slate-300" />
            <h2 className="mt-3 text-base font-semibold text-slate-900">
              {linkedJobError || "This job is no longer available."}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Postings are removed once the source takes them down.
            </p>
            <Button className="mt-5 rounded-md" onClick={closeJob}>
              {view === "saved" ? "Back to saved jobs" : "Back to search"}
            </Button>
          </div>
        ) : (
          <JobDetail
            job={selectedJob}
            onScan={() => handleScanJob(selectedJob)}
            onApply={() => handleApply(selectedJob)}
            saved={savedIds.has(selectedJob.id)}
            saving={pendingSaveIds.includes(selectedJob.id)}
            onToggleSave={() => toggleSaved(selectedJob)}
          />
        )}
      </section>
    );
  }

  const activeSaved = savedJobs.filter((job) => !job.expired);
  const expiredSaved = savedJobs.filter((job) => job.expired);

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading />
        <ViewSwitch view={view} savedCount={savedJobs.length} onChange={showView} />
      </div>

      {view === "saved" ? (
        <SavedJobsList
          status={savedStatus}
          active={activeSaved}
          expired={expiredSaved}
          pendingIds={pendingSaveIds}
          onRetry={loadSavedJobs}
          onBrowse={() => showView("search")}
          onView={openJob}
          onRemove={(job) => setJobSaved(job, false, { undoable: true })}
          onClearExpired={clearExpiredSaved}
          onFindSimilar={findSimilar}
        />
      ) : (
        <>
          {/* The first-run tour ends here. */}
          <div
            data-tour="remote-jobs-search"
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
          >
            <form onSubmit={handleSearch} className="space-y-3">
              <label
                htmlFor="remote-jobs-search"
                className="text-sm font-medium text-slate-600"
              >
                Search jobs
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="remote-jobs-search"
                    className="rounded-md pl-9"
                    placeholder="React Developer"
                    value={queryInput}
                    onChange={(event) => setQueryInput(event.target.value)}
                    enterKeyHint="search"
                  />
                </div>
                {/* Search and Filters share a row: beside the field from `sm`, and
                    under it on phones, where three full-width controls would
                    push the results down. Filters stay folded away until asked
                    for; the badge counts the ones in use, so a folded panel never
                    hides an active filter. */}
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1 rounded-md sm:flex-none" disabled={loading}>
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Search
                  </Button>
                  <button
                    type="button"
                    onClick={() => setShowFilters((prev) => !prev)}
                    aria-expanded={showFilters}
                    aria-controls="remote-jobs-filters"
                    className={cn(
                      "inline-flex h-11 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 md:h-9",
                      showFilters ? "border-slate-300 bg-slate-50" : "border-slate-200"
                    )}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </form>

            <div
              id="remote-jobs-filters"
              className={cn(
                "mt-4 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-5",
                showFilters ? "grid" : "hidden"
              )}
            >
              {FILTER_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label
                    htmlFor={`remote-jobs-filter-${field.key}`}
                    className="text-xs font-medium text-slate-500"
                  >
                    {field.label}
                  </label>
                  <select
                    id={`remote-jobs-filter-${field.key}`}
                    className={SELECT_CLASS}
                    value={filters[field.key]}
                    onChange={(event) => updateFilter(field.key, event.target.value)}
                  >
                    <option value="">{field.anyLabel}</option>
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {activeFilterCount > 0 && (
                <div className="flex items-end sm:col-span-2 lg:col-span-5">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs font-medium text-slate-500 underline hover:text-slate-700"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-amber-900">
                Job search is unavailable
              </h2>
              <p className="mt-1 text-sm text-amber-800">{error}</p>
              <Button
                variant="outline"
                className="mt-4 rounded-md"
                onClick={() => runSearch(queryInput, filters)}
              >
                Try again
              </Button>
            </div>
          ) : !hasSearched ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <Search className="mx-auto h-8 w-8 text-slate-300" />
              <h2 className="mt-3 text-base font-semibold text-slate-900">
                Find your next remote or hybrid job
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Search for a role above, or narrow it down with the filters.
              </p>
            </div>
          ) : !jobs.length ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
              <SearchX className="mx-auto h-8 w-8 text-slate-300" />
              <h2 className="mt-3 text-base font-semibold text-slate-900">
                No matching jobs found
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Try a different job title or broaden your filters.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* "Showing", not a total: more pages load as the user scrolls,
                    and without a plan the count is the three that are open. */}
                <p className="text-sm text-slate-500">
                  Showing {openJobs.length}{" "}
                  {openJobs.length === 1 ? "job" : "jobs"}
                </p>
              </div>
              {autoNote && <p className="-mt-1 text-xs text-slate-400">{autoNote}</p>}

              {openJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onView={() => openJob(job)}
                  saved={savedIds.has(job.id)}
                  saving={pendingSaveIds.includes(job.id)}
                  onToggleSave={() => toggleSaved(job)}
                />
              ))}

              {/* Without a plan the list stops after three, and the remainder is
                  shown blurred so the depth of the results is still visible. The
                  cards are inert and hidden from assistive tech — this is a teaser,
                  not content someone can reach. */}
              {lockedJobs.length > 0 && (
                <div className="relative">
                  <div
                    aria-hidden="true"
                    className="space-y-3 select-none blur-[6px]"
                  >
                    {lockedJobs.map((job) => (
                      <div key={job.id} className="pointer-events-none">
                        <JobCard job={job} onView={() => {}} />
                      </div>
                    ))}
                  </div>
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-slate-50/40 to-slate-50"
                  />
                </div>
              )}

              {/* Only when results were actually held back. A free search that
                  returned three or fewer has nothing locked, so claiming otherwise
                  would be a false upsell. */}
              {withheldResults && <UpgradePrompt router={router} />}

              {/* Scroll sentinel — crossing into view pulls the next page. */}
              {hasFullAccess && (
                <div ref={loadMoreRef} aria-hidden className="h-px w-full" />
              )}

              {loadingMore && (
                <div
                  className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500"
                  aria-live="polite"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading more jobs…
                </div>
              )}

              {!withheldResults && !hasMore && !loadingMore && (
                <p className="py-6 text-center text-xs text-slate-400">
                  That&apos;s every job we found. Try a different title or
                  broaden your filters for more.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};

/**
 * Search ⇄ Saved. Links in effect — each is a URL — so they are marked up as
 * navigation rather than as tabs.
 */
const ViewSwitch = ({
  view,
  savedCount,
  onChange,
}: {
  view: ListView;
  savedCount: number;
  onChange: (view: ListView) => void;
}) => (
  <nav
    aria-label="Remote jobs lists"
    className="grid shrink-0 grid-cols-2 rounded-lg bg-slate-100 p-1 sm:inline-grid"
  >
    {(
      [
        { id: "search", label: "Search", icon: Search },
        { id: "saved", label: "Saved", icon: Bookmark },
      ] as const
    ).map(({ id, label, icon: Icon }) => {
      const active = view === id;
      return (
        <button
          key={id}
          type="button"
          aria-current={active ? "page" : undefined}
          onClick={() => onChange(id)}
          className={cn(
            "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors md:h-9",
            active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
          {id === "saved" && savedCount > 0 ? (
            <span
              className={cn(
                "min-w-[1.25rem] rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                active ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700"
              )}
            >
              {savedCount}
            </span>
          ) : null}
        </button>
      );
    })}
  </nav>
);

const SaveJobButton = ({
  saved,
  saving,
  onClick,
  className,
}: {
  saved: boolean;
  saving: boolean;
  onClick: () => void;
  className?: string;
}) => (
  <Button
    type="button"
    variant="outline"
    aria-pressed={saved}
    title={saved ? "Remove from saved jobs" : "Save this job for later"}
    disabled={saving}
    onClick={onClick}
    className={cn("rounded-md", saved && "border-slate-300 bg-slate-50", className)}
  >
    <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
    {saved ? "Saved" : "Save"}
  </Button>
);

const SavedJobsList = ({
  status,
  active,
  expired,
  pendingIds,
  onRetry,
  onBrowse,
  onView,
  onRemove,
  onClearExpired,
  onFindSimilar,
}: {
  status: "loading" | "ready" | "error";
  active: SavedRemoteJob[];
  expired: SavedRemoteJob[];
  pendingIds: string[];
  onRetry: () => void;
  onBrowse: () => void;
  onView: (job: RemoteJob) => void;
  onRemove: (job: RemoteJob) => void;
  onClearExpired: () => void;
  onFindSimilar: (job: RemoteJob) => void;
}) => {
  if (status === "loading" && !active.length && !expired.length) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <h2 className="text-base font-semibold text-amber-900">
          Your saved jobs didn&apos;t load
        </h2>
        <p className="mt-1 text-sm text-amber-800">
          Check your connection and try again.
        </p>
        <Button variant="outline" className="mt-4 rounded-md" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  if (!active.length && !expired.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Bookmark className="h-6 w-6" />
        </span>
        <h2 className="mt-3 text-base font-semibold text-slate-900">No saved jobs yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
          Tap Save on any job to keep it here for later. If a posting closes,
          it stays on your list marked as expired.
        </p>
        <Button className="mt-5 rounded-md" onClick={onBrowse}>
          <Search className="h-4 w-4" />
          Browse jobs
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500" aria-live="polite">
        {active.length} saved {active.length === 1 ? "job" : "jobs"}
        {expired.length ? ` · ${expired.length} expired` : ""}
      </p>

      {active.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          savedAt={job.savedAt}
          onView={() => onView(job)}
          saved
          saving={pendingIds.includes(job.id)}
          onToggleSave={() => onRemove(job)}
        />
      ))}

      {expired.length > 0 && (
        <div className={cn("space-y-3", active.length > 0 && "pt-4")}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Expired{" "}
                <span className="font-normal text-slate-400">· {expired.length}</span>
              </h2>
              <p className="text-xs text-slate-500">
                These postings have closed or been taken down, so they can no
                longer be opened or scanned.
              </p>
            </div>
            <button
              type="button"
              onClick={onClearExpired}
              className="text-xs font-medium text-slate-500 underline hover:text-slate-700"
            >
              Remove all expired
            </button>
          </div>
          {expired.map((job) => (
            <ExpiredJobCard
              key={job.id}
              job={job}
              removing={pendingIds.includes(job.id)}
              onRemove={() => onRemove(job)}
              onFindSimilar={() => onFindSimilar(job)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/** A saved posting that has left the listings: what it was, and a way on. */
const ExpiredJobCard = ({
  job,
  removing,
  onRemove,
  onFindSimilar,
}: {
  job: SavedRemoteJob;
  removing: boolean;
  onRemove: () => void;
  onFindSimilar: () => void;
}) => {
  const saved = formatSavedOn(job.savedAt);
  return (
    <article className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
      <div className="flex items-start gap-3">
        <span className="opacity-60 grayscale">
          <CompanyLogo job={job} size="sm" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-slate-600 break-words">
            <JobTitle job={job} className="break-words" />
          </h3>
          {job.companyName && (
            <p className="mt-0.5 text-sm text-slate-500 break-words">{job.companyName}</p>
          )}
        </div>
        <span className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
          Expired
        </span>
      </div>

      <p className="mt-3 flex items-start gap-1.5 text-sm text-slate-500">
        <CalendarX2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <span>No longer accepting applications through this listing.</span>
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-400">{saved && <span>Saved {saved}</span>}</div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button
            variant="outline"
            className="flex-1 rounded-md sm:flex-none"
            onClick={onFindSimilar}
          >
            <Search className="h-4 w-4" />
            Find similar jobs
          </Button>
          <Button
            variant="ghost"
            className="rounded-md text-slate-600"
            onClick={onRemove}
            disabled={removing}
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </Button>
        </div>
      </div>
    </article>
  );
};

/**
 * Sits under the blurred run. Points at the same pricing anchor the scan
 * section uses when it hits a plan limit, so there's one upgrade destination.
 */
const UpgradePrompt = ({
  router,
}: {
  router: ReturnType<typeof useRouter>;
}) => (
  <div className="rounded-xl border border-slate-900/10 bg-white p-5 text-center shadow-sm">
    <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
      <Lock className="h-5 w-5" />
    </span>
    <h2 className="mt-3 text-base font-semibold text-slate-900">
      Unlock every job
    </h2>
    <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
      Your free plan shows the first {FREE_PLAN_VISIBLE_JOBS}. The Remote Jobs
      plan opens the full list; Pro adds unlimited scans, so you can check
      your resume against every role.
    </p>
    <Button
      className="mt-4 w-full rounded-md sm:w-auto"
      onClick={() => {
        track("remote_jobs_upgrade_clicked");
        router.push("/scan?section=settings&scrollTo=dashboard-pricing");
      }}
    >
      View plans
    </Button>
  </div>
);

const WorkplaceBadge = ({ job }: { job: RemoteJob }) => (
  <span
    className={cn(
      "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium",
      job.workplaceType === "hybrid"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800"
    )}
  >
    {job.workplaceType === "hybrid" ? "Hybrid" : "Remote"}
  </span>
);

const JobCard = ({
  job,
  onView,
  saved = false,
  saving = false,
  onToggleSave,
  savedAt,
}: {
  job: RemoteJob;
  onView: () => void;
  saved?: boolean;
  saving?: boolean;
  /** Left out for the blurred preview cards, which can't be acted on. */
  onToggleSave?: () => void;
  /** Shown in the Saved list. */
  savedAt?: string;
}) => {
  const savedOn = savedAt ? formatSavedOn(savedAt) : "";
  const meta = metaLine(job);
  const company = companyLine(job);
  const tags = tagsFor(job);
  const posted = formatPostedAt(job.postedAt);
  const dates = [savedOn ? `Saved ${savedOn}` : "", posted].filter(Boolean);

  return (
    // The whole card opens the job. "View Job" stays the control keyboard and
    // screen-reader users reach, so the card itself adds no second tab stop.
    <article
      onClick={(event) => {
        // Its own buttons and links keep their jobs, and selecting text to
        // copy it shouldn't open anything.
        if ((event.target as HTMLElement).closest("a, button")) return;
        if (window.getSelection()?.toString()) return;
        onView();
      }}
      className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-[border-color,box-shadow] hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <CompanyLogo job={job} size="sm" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-slate-900 break-words">
            <JobTitle job={job} className="break-words" />
          </h3>
          {job.companyName && (
            <p className="mt-0.5 text-sm text-slate-600 break-words">
              {job.companyName}
            </p>
          )}
        </div>
        <WorkplaceBadge job={job} />
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-slate-600">
        <p className="flex items-start gap-1.5">
          <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <span className="min-w-0 break-words">{placeLine(job)}</span>
        </p>
        {meta && <p className="text-slate-500">{meta}</p>}
        {company && (
          <p className="flex items-start gap-1.5 text-slate-500">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span className="min-w-0 break-words">{company}</span>
          </p>
        )}
        {job.salary && (
          <p className="flex items-center gap-1.5 text-slate-500">
            <Wallet className="h-4 w-4 shrink-0 text-slate-400" />
            {job.salary}
          </p>
        )}
      </div>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.slice(0, 6).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
            >
              {tag.replace(/-/g, " ")}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-400">
          {dates.map((date, index) => (
            <span key={date}>
              {index > 0 && <span className="mx-1.5">·</span>}
              {date}
            </span>
          ))}
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          {onToggleSave ? (
            <SaveJobButton saved={saved} saving={saving} onClick={onToggleSave} />
          ) : null}
          <Button className="flex-1 rounded-md sm:flex-none" onClick={onView}>
            View Job
          </Button>
        </div>
      </div>
    </article>
  );
};

/**
 * startup.jobs' terms: a page dedicated to one of their listings carries a
 * canonical link to the original. The dashboard is one client-side page, so
 * the tag is pointed at the job while it is open and put back on the way out.
 */
const useSourceCanonical = (job: RemoteJob) => {
  useEffect(() => {
    if (job.source !== "startupjobs" || !job.sourceUrl) return;
    const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const previous = existing?.getAttribute("href") ?? null;
    const link = existing || document.createElement("link");
    if (!existing) {
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.setAttribute("href", job.sourceUrl);
    return () => {
      if (!existing) link.remove();
      else if (previous === null) existing.removeAttribute("href");
      else existing.setAttribute("href", previous);
    };
  }, [job.source, job.sourceUrl]);
};

const JobDetail = ({
  job,
  onScan,
  onApply,
  descriptionLoading = false,
  saved,
  saving,
  onToggleSave,
}: {
  job: RemoteJob;
  onScan: () => void;
  onApply: () => void;
  /** The header is real but the JD is still being fetched. */
  descriptionLoading?: boolean;
  saved: boolean;
  saving: boolean;
  onToggleSave: () => void;
}) => {
  useSourceCanonical(job);
  const meta = metaLine(job);
  const company = companyLine(job);
  const posted = formatPostedAt(job.postedAt);
  const scannable = !descriptionLoading && isScannable(job);
  const hasDescription = scannable || Boolean(job.descriptionHtml);
  const credit = SOURCE_CREDITS[job.source];
  // Followed links where the source's terms ask for them (startup.jobs).
  const sourceRel = job.source === "startupjobs" ? "noopener" : "noopener noreferrer";

  const details = [
    { icon: Globe2, label: "Work type", value: placeLine(job) },
    {
      // The source's own wording, when it says more than the line above —
      // "Remote - United States" under "Remote — United States" says nothing.
      icon: Building2,
      label: "Location",
      value:
        job.workplaceType === "remote" && job.location && !restates(job.location, placeLine(job))
          ? job.location
          : "",
    },
    { icon: ScanLine, label: "Role", value: meta },
    { icon: Building2, label: "Company", value: company },
    { icon: Wallet, label: "Salary", value: job.salary },
    { icon: Clock, label: "Posted", value: posted.replace("Posted ", "") },
  ].filter((detail) => detail.value);

  const actions = (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button
        className="w-full rounded-md sm:w-auto"
        onClick={onScan}
        disabled={!scannable}
      >
        {descriptionLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ScanLine className="h-4 w-4" />
        )}
        Scan My Resume
      </Button>
      <Button
        variant="outline"
        className="w-full rounded-md sm:w-auto"
        onClick={onApply}
        disabled={!job.applicationUrl}
      >
        <ExternalLink className="h-4 w-4" />
        Apply
      </Button>
      <SaveJobButton
        saved={saved}
        saving={saving}
        onClick={onToggleSave}
        className="w-full sm:w-auto"
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <CompanyLogo job={job} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-slate-900 break-words sm:text-2xl">
              <JobTitle job={job} className="break-words" />
            </h1>
            {job.companyName && (
              <p className="mt-0.5 text-sm text-slate-600 break-words sm:text-base">
                {job.companyName}
              </p>
            )}
          </div>
          <WorkplaceBadge job={job} />
        </div>

        <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
          {details.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-2">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <dt className="text-xs font-medium text-slate-500">{label}</dt>
                <dd className="text-sm text-slate-700 break-words">{value}</dd>
              </div>
            </div>
          ))}
        </dl>

        {(job.skills.length > 0 || job.categories.length > 0) && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            {job.skills.length > 0 && (
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Code2 className="h-4 w-4 text-slate-400" />
                Tech stack
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {tagsFor(job).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
                >
                  {tag.replace(/-/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 border-t border-slate-100 pt-5">{actions}</div>
        {descriptionLoading ? (
          <p className="mt-2 text-xs text-slate-500">
            Loading the full job description…
          </p>
        ) : !scannable ? (
          <p className="mt-2 text-xs text-slate-500">
            This posting didn&apos;t include enough of a description to scan
            against. Open the original posting to read the full listing.
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-sm font-semibold text-slate-900">Job description</h2>
        {descriptionLoading ? (
          <div className="mt-4 space-y-2" aria-busy="true">
            {[...Array(6)].map((_, index) => (
              <div
                key={index}
                className="h-3 animate-pulse rounded bg-slate-100"
                style={{ width: `${[100, 92, 96, 70, 88, 60][index]}%` }}
              />
            ))}
          </div>
        ) : hasDescription ? (
          <div
            // Sanitized on the server before it ever reaches the client — see
            // lib/remote-jobs/sanitize.ts.
            dangerouslySetInnerHTML={{
              __html: job.descriptionHtml || job.description,
            }}
            className={cn(
              // break-words + the pre rule keep a long URL or code block from
              // widening the whole page on a phone.
              "mt-3 max-w-none break-words text-sm leading-relaxed text-slate-700",
              "[&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-slate-50 [&_pre]:p-3",
              "[&_a]:font-medium [&_a]:text-slate-900 [&_a]:underline",
              "[&_h1]:mt-5 [&_h1]:text-base [&_h1]:font-semibold [&_h1]:text-slate-900",
              "[&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-slate-900",
              "[&_h3]:mt-5 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-slate-900",
              "[&_h4]:mt-4 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-slate-900",
              "[&_li]:mt-1 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:pl-5",
              "[&_p]:mt-3 [&_strong]:font-semibold [&_strong]:text-slate-900",
              "[&_ul]:mt-2 [&_ul]:list-disc [&_ul]:pl-5"
            )}
          />
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            This posting didn&apos;t include a description.
          </p>
        )}

        {/* The job APIs grant access on condition that listings link back to
            the original posting; three of them also want to be named. Nothing
            else on the screen says where a job came from (SOURCE_CREDITS). */}
        {job.sourceUrl && (
          <p className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-400">
            <a
              href={job.sourceUrl}
              target="_blank"
              rel={sourceRel}
              className="font-medium text-slate-600 underline"
            >
              View original posting
            </a>
            {credit && (
              <>
                {" · "}
                Listing courtesy of{" "}
                <a
                  href={credit}
                  target="_blank"
                  rel={sourceRel}
                  className="font-medium text-slate-600 underline"
                >
                  {job.sourceName}
                </a>
              </>
            )}
          </p>
        )}
      </div>

      {/* Repeated at the foot so the CTA is reachable after a long description
          without scrolling back up. */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <p className="text-sm font-semibold text-slate-900">
          Ready for this role?
        </p>
        <p className="mt-0.5 text-sm text-slate-500">
          Scan this job against your base resume to see your match, then tailor
          it before you apply.
        </p>
        <div className="mt-4">{actions}</div>
      </div>
    </div>
  );
};
