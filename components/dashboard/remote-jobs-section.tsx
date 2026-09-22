"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { track } from "@vercel/analytics";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubscriptionGate } from "@/components/dashboard/subscription-gate";
import { cn } from "@/lib/utils";
import {
  EMPLOYMENT_TYPES,
  dedupeLabels,
  EXPERIENCE_LEVELS,
  FREE_PLAN_PREVIEW_JOBS,
  FREE_PLAN_VISIBLE_JOBS,
  isScannable,
  POSTED_WITHIN_OPTIONS,
  REMOTE_JOBS_PAGE_SIZE,
  REMOTE_LOCATIONS,
  type RemoteJob,
} from "@/lib/remote-jobs/types";
import {
  ArrowLeft,
  Building2,
  Clock,
  ExternalLink,
  Globe2,
  Loader2,
  Lock,
  ScanLine,
  Search,
  SearchX,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";

const EXAMPLE_QUERIES = [
  "React Developer",
  "Frontend Developer",
  "Software Engineer",
  "Product Designer",
  "Data Analyst",
];

type Filters = {
  remoteLocation: string;
  employmentType: string;
  experienceLevel: string;
  postedWithinDays: string;
};

const EMPTY_FILTERS: Filters = {
  remoteLocation: "",
  employmentType: "",
  experienceLevel: "",
  postedWithinDays: "",
};

type RemoteJobsSectionProps = {
  userId?: string;
  /**
   * True only for an active Speed or Pro plan. Defaults to false so a missing
   * prop locks the list rather than giving it away — the gate fails closed.
   */
  hasFullAccess?: boolean;
  /**
   * No plan and no free scans left. Browsing stops entirely: a job you can't
   * scan is a dead end, and the search is the product, not a teaser. Defaults
   * to false so an unknown state still renders — the host knows first.
   */
  locked?: boolean;
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

/** "Full-time · Senior" — only the parts the source actually gave us. */
const metaLine = (job: RemoteJob) =>
  [job.employmentType, job.experienceLevel].filter(Boolean).join(" · ");

/**
 * Chips for a job: its skills when the source gives any, otherwise its own
 * categorisation. De-duplicated here as well as in the normalizers — the label
 * doubles as the React key, and a cached response from before the normalizers
 * deduped would otherwise throw a duplicate-key error.
 */
const tagsFor = (job: RemoteJob) =>
  dedupeLabels(job.skills.length ? job.skills : job.categories);

const remoteLine = (job: RemoteJob) =>
  job.remoteCountries.length
    ? `Remote — ${job.remoteCountries.join(", ")}`
    : "Remote";

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
        Find remote opportunities that match your experience.
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
  locked = false,
  onScanJob,
}: RemoteJobsSectionProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeJobId = searchParams?.get("job") || "";

  const [queryInput, setQueryInput] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [jobs, setJobs] = useState<RemoteJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [partialSources, setPartialSources] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
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

  useEffect(() => {
    track("remote_jobs_viewed");
  }, []);

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters]
  );

  /** The stripped record from the result list — header fields only, possibly no JD. */
  const listJob = useMemo(
    () => (activeJobId ? jobs.find((job) => job.id === activeJobId) || null : null),
    [activeJobId, jobs]
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

  // Speed/Pro see the whole list; everyone else gets three they can open and a
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
  useEffect(() => {
    if (hasFullAccess || !activeJobId) return;
    if (!lockedJobs.some((job) => job.id === activeJobId)) return;
    router.replace("/scan?section=remote-jobs");
  }, [hasFullAccess, activeJobId, lockedJobs, router]);

  const runSearch = useCallback(
    async (query: string, nextFilters: Filters, offset = 0) => {
      if (!userId) {
        setError("Please log in to browse remote jobs.");
        return;
      }
      // The gate below is what the user sees; this just saves the round trip,
      // since the route turns the same search away.
      if (locked) return;
      const append = offset > 0;
      if (append) {
        setLoadingMore(true);
      } else {
        activeSearchRef.current = { query, filters: nextFilters };
        setLoading(true);
        setError("");
        setPartialSources([]);
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
        if (nextFilters.remoteLocation)
          params.set("remoteLocation", nextFilters.remoteLocation);
        if (nextFilters.employmentType)
          params.set("employmentType", nextFilters.employmentType);
        if (nextFilters.experienceLevel)
          params.set("experienceLevel", nextFilters.experienceLevel);
        if (nextFilters.postedWithinDays)
          params.set("postedWithinDays", nextFilters.postedWithinDays);

        const response = await fetch(`/api/remote-jobs?${params.toString()}`);
        const payload = await response.json();
        if (!payload.success) {
          // A failed page-2 keeps what's already on screen; only a failed first
          // page is worth replacing the list with an error.
          if (append) {
            setHasMore(false);
            return;
          }
          setJobs([]);
          setError(payload.message || "Unable to load remote jobs right now.");
          return;
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
        if (!append) setPartialSources(payload.partialSources || []);
      } catch (searchError) {
        console.error("Remote job search failed:", searchError);
        if (append) {
          setHasMore(false);
          return;
        }
        setJobs([]);
        setError(
          "We couldn't reach the job sources. Check your connection and try again."
        );
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
          setHasSearched(true);
        }
      }
    },
    [userId, hasFullAccess, locked]
  );

  const handleSearch = (event?: React.FormEvent) => {
    event?.preventDefault();
    track("remote_job_search", {
      query: queryInput.trim().slice(0, 100),
      remoteLocation: filters.remoteLocation || "any",
    });
    runSearch(queryInput, filters);
  };

  const handleExample = (example: string) => {
    setQueryInput(example);
    track("remote_job_search", { query: example, remoteLocation: filters.remoteLocation || "any" });
    runSearch(example, filters);
  };

  // Changing a filter re-runs the search only once the user has searched at
  // least once — otherwise the empty state would vanish on a stray tap.
  const updateFilter = (key: keyof Filters, value: string) => {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    if (hasSearched) runSearch(queryInput, nextFilters);
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

  const openJob = (job: RemoteJob) => {
    router.push(`/scan?section=remote-jobs&job=${encodeURIComponent(job.id)}`);
  };

  const closeJob = () => {
    router.push("/scan?section=remote-jobs");
  };

  // Fetches the complete record: either because the job was opened by URL
  // (refresh, shared link, back/forward) and isn't in the result list at all,
  // or because the list record came back without its description.
  useEffect(() => {
    if (!activeJobId || !userId || locked) return;
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
  }, [activeJobId, userId, locked, listJob, linkedJob]);

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

  // Ahead of the detail view on purpose: `?job=<id>` is a shareable URL, and a
  // locked user following one would otherwise walk straight past the gate.
  if (locked) {
    return (
      <section className="space-y-6">
        <SectionHeading />
        <SubscriptionGate
          event="remote_jobs_locked_upgrade_clicked"
          title="You're out of scans"
          body="Remote Jobs finds the roles, and a scan tells you where you stand against each one. Pick a plan to carry on with both."
          highlights={[
            "Browse every remote job we pull in, not just the first few",
            "Send any posting straight to a scan, prefilled",
            "Tailored CV and cover letter for each application",
          ]}
        />
      </section>
    );
  }

  if (activeJobId) {
    return (
      <section ref={detailTopRef} className="mx-auto max-w-4xl space-y-6">
        <Button
          variant="ghost"
          className="-ml-2 rounded-md px-2 text-slate-600"
          onClick={closeJob}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to jobs
        </Button>

        {detailPending && !listJob ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : detailPending && listJob ? (
          // Header fields are already in hand from the result list, so show the
          // job immediately and keep only the description in a loading state.
          <JobDetail job={listJob} descriptionLoading onScan={() => {}} onApply={() => handleApply(listJob)} />
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
              Back to search
            </Button>
          </div>
        ) : (
          <JobDetail
            job={selectedJob}
            onScan={() => handleScanJob(selectedJob)}
            onApply={() => handleApply(selectedJob)}
          />
        )}
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <SectionHeading />

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
            <Button type="submit" className="rounded-md sm:w-auto" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {EXAMPLE_QUERIES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => handleExample(example)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100 active:bg-slate-200"
              >
                {example}
              </button>
            ))}
          </div>
        </form>

        {/* Filters collapse on phones so the search field stays the first thing
            on screen; from `lg` they're always open. */}
        <button
          type="button"
          onClick={() => setShowFilters((prev) => !prev)}
          aria-expanded={showFilters}
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>

        <div
          className={cn(
            "mt-4 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-4",
            showFilters ? "grid" : "hidden lg:grid"
          )}
        >
          <div className="space-y-1.5">
            <label
              htmlFor="remote-from"
              className="text-xs font-medium text-slate-500"
            >
              Remote from
            </label>
            <select
              id="remote-from"
              className={SELECT_CLASS}
              value={filters.remoteLocation}
              onChange={(event) =>
                updateFilter("remoteLocation", event.target.value)
              }
            >
              <option value="">Any location</option>
              {REMOTE_LOCATIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="employment-type"
              className="text-xs font-medium text-slate-500"
            >
              Employment type
            </label>
            <select
              id="employment-type"
              className={SELECT_CLASS}
              value={filters.employmentType}
              onChange={(event) =>
                updateFilter("employmentType", event.target.value)
              }
            >
              <option value="">Any type</option>
              {EMPLOYMENT_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="experience-level"
              className="text-xs font-medium text-slate-500"
            >
              Experience level
            </label>
            <select
              id="experience-level"
              className={SELECT_CLASS}
              value={filters.experienceLevel}
              onChange={(event) =>
                updateFilter("experienceLevel", event.target.value)
              }
            >
              <option value="">Any level</option>
              {EXPERIENCE_LEVELS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="posted-date"
              className="text-xs font-medium text-slate-500"
            >
              Posted date
            </label>
            <select
              id="posted-date"
              className={SELECT_CLASS}
              value={filters.postedWithinDays}
              onChange={(event) =>
                updateFilter("postedWithinDays", event.target.value)
              }
            >
              <option value="">Any time</option>
              {POSTED_WITHIN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
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
            Find your next remote job
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Search for a role above to discover remote opportunities.
          </p>
        </div>
      ) : !jobs.length ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <SearchX className="mx-auto h-8 w-8 text-slate-300" />
          <h2 className="mt-3 text-base font-semibold text-slate-900">
            No matching remote jobs found
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
              Showing {openJobs.length} remote{" "}
              {openJobs.length === 1 ? "job" : "jobs"}
            </p>
            {partialSources.length > 0 && (
              <p className="text-xs text-amber-700">
                Some sources ({partialSources.join(", ")}) didn&apos;t respond —
                results may be incomplete.
              </p>
            )}
          </div>

          {openJobs.map((job) => (
            <JobCard key={job.id} job={job} onView={() => openJob(job)} />
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
              That&apos;s every remote job we found. Try a different title or
              broaden your filters for more.
            </p>
          )}
        </div>
      )}
    </section>
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
      Unlock every remote job
    </h2>
    <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
      Your free plan shows the first {FREE_PLAN_VISIBLE_JOBS}. Speed and Pro
      open the full list, so you can keep scrolling and scan any role against
      your resume.
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

const JobCard = ({ job, onView }: { job: RemoteJob; onView: () => void }) => {
  const meta = metaLine(job);
  const tags = tagsFor(job);
  const posted = formatPostedAt(job.postedAt);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300">
      <div className="flex items-start gap-3">
        <CompanyLogo job={job} size="sm" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-slate-900 break-words">
            {job.title}
          </h3>
          {job.companyName && (
            <p className="mt-0.5 text-sm text-slate-600 break-words">
              {job.companyName}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-slate-600">
        <p className="flex items-start gap-1.5">
          <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <span className="min-w-0 break-words">{remoteLine(job)}</span>
        </p>
        {meta && <p className="text-slate-500">{meta}</p>}
        {job.salary && (
          <p className="flex items-center gap-1.5 text-slate-500">
            <Wallet className="h-4 w-4 shrink-0 text-slate-400" />
            {job.salary}
          </p>
        )}
      </div>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.slice(0, 5).map((tag) => (
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
          {posted && <span>{posted}</span>}
          {posted && isScannable(job) && <span className="mx-1.5">·</span>}
          {isScannable(job) && <span>Scan to see your match</span>}
        </div>
        <Button className="w-full rounded-md sm:w-auto" onClick={onView}>
          View Job
        </Button>
      </div>
    </article>
  );
};

const JobDetail = ({
  job,
  onScan,
  onApply,
  descriptionLoading = false,
}: {
  job: RemoteJob;
  onScan: () => void;
  onApply: () => void;
  /** The header is real but the JD is still being fetched. */
  descriptionLoading?: boolean;
}) => {
  const meta = metaLine(job);
  const tags = tagsFor(job);
  const posted = formatPostedAt(job.postedAt);
  const scannable = !descriptionLoading && isScannable(job);
  const hasDescription = scannable || Boolean(job.descriptionHtml);

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
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <CompanyLogo job={job} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-slate-900 break-words sm:text-2xl">
              {job.title}
            </h1>
            {job.companyName && (
              <p className="mt-0.5 text-sm text-slate-600 break-words sm:text-base">
                {job.companyName}
              </p>
            )}
          </div>
        </div>

        <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <Globe2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <div className="min-w-0">
              <dt className="text-xs font-medium text-slate-500">
                Remote eligibility
              </dt>
              <dd className="text-sm text-slate-700 break-words">
                {remoteLine(job)}
              </dd>
            </div>
          </div>

          {job.location && (
            <div className="flex items-start gap-2">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <dt className="text-xs font-medium text-slate-500">Location</dt>
                <dd className="text-sm text-slate-700">{job.location}</dd>
              </div>
            </div>
          )}

          {meta && (
            <div className="flex items-start gap-2">
              <ScanLine className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <dt className="text-xs font-medium text-slate-500">Role</dt>
                <dd className="text-sm text-slate-700">{meta}</dd>
              </div>
            </div>
          )}

          {job.salary && (
            <div className="flex items-start gap-2">
              <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <dt className="text-xs font-medium text-slate-500">Salary</dt>
                <dd className="text-sm text-slate-700">{job.salary}</dd>
              </div>
            </div>
          )}

          {posted && (
            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <dt className="text-xs font-medium text-slate-500">Posted</dt>
                <dd className="text-sm text-slate-700">
                  {posted.replace("Posted ", "")}
                </dd>
              </div>
            </div>
          )}
        </dl>

        {tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5 border-t border-slate-100 pt-4">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
              >
                {tag.replace(/-/g, " ")}
              </span>
            ))}
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
            against. Open it on {job.sourceName} to read the full listing.
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

        {/* Attribution — the job APIs grant access on condition that listings
            stay credited and link back to the original posting. */}
        {job.sourceUrl && (
          <p className="mt-6 border-t border-slate-100 pt-4 text-xs text-slate-400">
            Originally posted on{" "}
            <a
              href={job.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-slate-600 underline"
            >
              {job.sourceName}
            </a>
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
