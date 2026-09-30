"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubscriptionGate } from "@/components/dashboard/subscription-gate";
import { cn } from "@/lib/utils";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { supabase } from "@/lib/supabaseClient";
import {
  extractCandidateName,
  renderResumeHtml,
  renderResumeFromData,
  renderCoverLetterHtml,
  type ResumeData,
} from "@/components/resume-templates/render";
import type {
  ResumeTemplateId,
  ResumeTemplateThemeOverrides,
} from "@/components/resume-templates/types";
import {
  BookOpen,
  Briefcase,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  List,
  Loader2,
  Mic,
  SaveIcon,
  Search,
  Trash2,
} from "lucide-react";
import swal from "sweetalert";
import { resolveResumePhotoUrl } from "@/lib/resume-photo";
import { InterviewPrepDialog } from "@/components/dashboard/interview/interview-prep-dialog";
import { MockInterviewDialog } from "@/components/dashboard/interview/mock-interview-dialog";
import { MOCK_ATTEMPTS_PER_JOB } from "@/lib/interview-config";

const STATUS_STYLES: Record<string, string> = {
  Applied: "border-blue-200 bg-blue-50 text-blue-700",
  Interviewing: "border-amber-200 bg-amber-50 text-amber-700",
  Offer: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Rejected: "border-rose-200 bg-rose-50 text-rose-700",
};
const statusClass = (status: string) =>
  STATUS_STYLES[status] || "border-slate-200 bg-slate-50 text-slate-700";

// Browsers draw a native select's arrow hard against its right border and
// ignore padding for it, so the selects here hide it (`appearance-none`) and
// draw this one inside their right padding instead.
const SelectChevron = ({ className }: { className?: string }) => (
  <ChevronDown
    aria-hidden="true"
    className={cn(
      "pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2",
      className
    )}
  />
);

const scoreClass = (score: number | null) => {
  if (score === null) return "bg-slate-100 text-slate-400";
  if (score < 55) return "bg-red-50 text-red-700";
  if (score < 70) return "bg-orange-50 text-orange-700";
  if (score < 80) return "bg-yellow-50 text-yellow-700";
  return "bg-emerald-50 text-emerald-700";
};

type Job = {
  id: string;
  organization: string;
  designation: string;
  interview_status: string;
  initial_score: number | null;
  /** Null until the scan's resume is tailored — see the Scan section. Absent
   *  entirely on a database that predates the column. */
  optimized_score?: number | null;
  matched_keywords: string[];
  missing_keywords: string[];
  keyword_universe?: string[];
  /** Whether interview prep has been generated; the prep itself is fetched on open. */
  has_interview_prep?: boolean;
  /** Completed mock interviews for this job, or null before the first. */
  mock_interview?: { attempts: number; bestScore: number | null } | null;
  resume_template_id?: string | null;
  cover_letter_template_id?: string | null;
  generated_resume_text?: string | null;
  generated_cover_letter_text?: string | null;
  generated_resume_payload?: {
    resumeData?: ResumeData | null;
    resumeText?: string;
    template?: ResumeTemplateId;
    overrides?: ResumeTemplateThemeOverrides | null;
    candidateName?: string;
    designation?: string;
    photoPath?: string;
  } | null;
  created_at: string;
  updated_at: string;
};

const STATUS_OPTIONS = ["Applied", "Interviewing", "Offer", "Rejected"];

// Interview prep and the mock interview are built from the keywords a scan
// saves. A job typed into the form below has none, so it doesn't get the
// interview buttons (the interview routes refuse it too).
const hasKeywordData = (job: Job) =>
  Boolean(
    job.keyword_universe?.length || job.matched_keywords?.length || job.missing_keywords?.length
  );
const JOBS_PER_PAGE = 10;

type JobTrackerSectionProps = {
  subscriptionLocked?: boolean;
};

export const JobTrackerSection = ({ subscriptionLocked = false }: JobTrackerSectionProps = {}) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [newJob, setNewJob] = useState({
    organization: "",
    designation: "",
    status: STATUS_OPTIONS[0],
  });
  // Which job each interview dialog is showing. The job stays set while the
  // dialog animates closed, so its content doesn't blank out mid-transition.
  const [prepJob, setPrepJob] = useState<Job | null>(null);
  const [prepOpen, setPrepOpen] = useState(false);
  const [mockJob, setMockJob] = useState<Job | null>(null);
  const [mockOpen, setMockOpen] = useState(false);

  const handlePrepReady = useCallback((jobId: string) => {
    setJobs((prev) =>
      prev.map((job) => (job.id === jobId ? { ...job, has_interview_prep: true } : job))
    );
  }, []);

  // Every start counts towards the job's mock interview limit; the best score
  // only moves when one is scored.
  const handleMockStarted = useCallback((jobId: string) => {
    setJobs((prev) =>
      prev.map((job) =>
        job.id === jobId
          ? {
              ...job,
              mock_interview: {
                attempts: (job.mock_interview?.attempts || 0) + 1,
                bestScore: job.mock_interview?.bestScore ?? null,
              },
            }
          : job
      )
    );
  }, []);

  const handleMockCompleted = useCallback((jobId: string, score: number) => {
    setJobs((prev) =>
      prev.map((job) => {
        if (job.id !== jobId) return job;
        const previous = job.mock_interview;
        return {
          ...job,
          mock_interview: {
            attempts: previous?.attempts || 1,
            bestScore: Math.max(previous?.bestScore ?? score, score),
          },
        };
      })
    );
  }, []);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/job-tracker?userId=${session.user.id}`);
      const result = await response.json();

      if (result.success) {
        setJobs(result.data || []);
      } else {
        toast.error("Failed to load jobs.");
      }
    } catch (error) {
      console.error("Error fetching jobs:", error);
      toast.error("Failed to load jobs.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddJob = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newJob.organization || !newJob.designation) {
      toast.error("Organization and designation are required.");
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to add jobs.");
        return;
      }

      const response = await fetch("/api/job-tracker", {
        method: "POST",
        body: JSON.stringify({
          userId: session.user.id,
          organization: newJob.organization,
          designation: newJob.designation,
          initialScore: 0,
          matchedKeywords: [],
          missingKeywords: [],
          keywordUniverse: [],
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Job added to tracker!");
        setNewJob({
          organization: "",
          designation: "",
          status: STATUS_OPTIONS[0],
        });
        fetchJobs();
      } else {
        toast.error(result.message || "Failed to add job.");
      }
    } catch (error) {
      console.error("Error adding job:", error);
      toast.error("Failed to add job.");
    }
  };

  const updateStatus = async (jobId: string, status: string) => {
    setUpdating(jobId);
    try {
      const response = await fetch("/api/job-tracker", {
        method: "PATCH",
        body: JSON.stringify({
          id: jobId,
          interviewStatus: status,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setJobs((prev) =>
          prev.map((job) =>
            job.id === jobId ? { ...job, interview_status: status } : job
          )
        );
        toast.success("Status updated!");
      } else {
        toast.error(result.message || "Failed to update status.");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status.");
    } finally {
      setUpdating(null);
    }
  };

  const toSlugPart = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "unknown";


  const downloadGeneratedDocument = async (job: Job, type: "resume" | "cover") => {
    const coverText = job.generated_cover_letter_text || "";
    const payload = job.generated_resume_payload || null;
    // The resume is only downloadable once the user has downloaded the optimized
    // resume for this JD (which is when the exact payload gets stored).
    if (type === "resume" && !payload) {
      toast.error("Download the optimized resume from Scan first, then it appears here.");
      return;
    }
    if (type === "cover" && !coverText) {
      toast.error("No saved cover letter found for this entry. Download once from Scan first.");
      return;
    }

    const payloadCandidate =
      payload?.candidateName || extractCandidateName(payload?.resumeText || "");

    setDownloading(`${job.id}-${type}`);
    try {
      // Reproduce the EXACT optimized resume the user downloaded — same renderer
      // (structured object when available), template, and overrides.
      const photoUrl =
        type === "resume" ? await resolveResumePhotoUrl(payload?.photoPath) : "";
      const html =
        type === "resume"
          ? payload?.resumeData
            ? renderResumeFromData({
                data: payload.resumeData,
                templateId: (payload.template || "classic-blue") as ResumeTemplateId,
                candidateName: payloadCandidate,
                designation: payload.designation || job.designation || "",
                photoUrl,
                overrides: payload.overrides || undefined,
              })
            : renderResumeHtml({
                resumeText: payload?.resumeText || "",
                templateId: (payload?.template || "classic-blue") as ResumeTemplateId,
                candidateName: payloadCandidate,
                designation: payload?.designation || job.designation || "",
                photoUrl,
                overrides: payload?.overrides || undefined,
              })
          : renderCoverLetterHtml(coverText);
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        body: JSON.stringify({
          html,
          type: type === "resume" ? "saved-resume" : "saved-cover-letter",
        }),
      });
      if (!response.ok) throw new Error("Failed to generate PDF.");

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      const candidateSlug = toSlugPart(
        type === "resume" ? payloadCandidate : extractCandidateName(coverText)
      );
      const orgSlug = toSlugPart(job.organization || "organization");
      anchor.download =
        type === "resume"
          ? `${candidateSlug}-${orgSlug}-resume.pdf`
          : `${candidateSlug}-${orgSlug}-cover-letter.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error(error);
      toast.error("Unable to download document.");
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (jobId: string) => {
    const confirmed = await swal({
      title: "Delete this job?",
      text: "This will remove the job from your tracker.",
      icon: "warning",
      buttons: ["Cancel", "Delete"],
      dangerMode: true,
    });
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/job-tracker?id=${jobId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Job deleted!");
        fetchJobs();
      } else {
        toast.error(result.message || "Failed to delete job.");
      }
    } catch (error) {
      console.error("Error deleting job:", error);
      toast.error("Failed to delete job.");
    }
  };

  const filteredJobs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return jobs;
    return jobs.filter(
      (job) =>
        job.organization.toLowerCase().includes(query) ||
        job.designation.toLowerCase().includes(query) ||
        job.interview_status.toLowerCase().includes(query)
    );
  }, [jobs, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / JOBS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const paginatedJobs = filteredJobs.slice(
    (currentPage - 1) * JOBS_PER_PAGE,
    currentPage * JOBS_PER_PAGE
  );

  // Interview prep and the mock interview, for one job. `compact` is the
  // table cell, where the column header already says "Interview". `counted`
  // puts the paid plan's attempts-left in the tooltip; the free trial's single
  // interview isn't per job, so the locked view leaves it out.
  const renderInterviewButtons = (job: Job, compact: boolean, counted = true) => {
    const bestMockScore = job.mock_interview?.bestScore ?? null;
    const mockAttemptsLeft = Math.max(
      0,
      MOCK_ATTEMPTS_PER_JOB - (job.mock_interview?.attempts || 0)
    );
    const mockTitle = counted
      ? [
          mockAttemptsLeft
            ? `Mock interview (${mockAttemptsLeft} of ${MOCK_ATTEMPTS_PER_JOB} left`
            : `Mock interview (all ${MOCK_ATTEMPTS_PER_JOB} used`,
          bestMockScore !== null ? `, best score ${bestMockScore})` : ")",
        ].join("")
      : "Mock interview";
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          title={
            job.has_interview_prep ? "Interview prep material (ready)" : "Interview prep material"
          }
          onClick={() => {
            setPrepJob(job);
            setPrepOpen(true);
          }}
          className={cn(
            "relative gap-1.5 rounded-md border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-800",
            !compact && "flex-1 sm:flex-none"
          )}
        >
          <BookOpen className="h-4 w-4" />
          {compact ? "Prep" : "Interview prep"}
          {job.has_interview_prep ? (
            <span
              aria-hidden
              className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
            />
          ) : null}
        </Button>
        <Button
          size="sm"
          title={mockTitle}
          onClick={() => {
            setMockJob(job);
            setMockOpen(true);
          }}
          className={cn(
            "relative gap-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-800",
            !compact && "flex-1 sm:flex-none"
          )}
        >
          <Mic className="h-4 w-4" />
          {compact ? "Mock" : "Mock interview"}
          {/* Best score so far: inline where the row has room, a corner badge
              on phones, where the two buttons split the width and an inline
              chip would push past it. */}
          {!compact && bestMockScore !== null ? (
            <>
              <span className="hidden rounded bg-white/15 px-1.5 py-px text-[11px] font-semibold tabular-nums sm:inline">
                {bestMockScore}
              </span>
              <span className="absolute -right-1.5 -top-2 rounded-full bg-violet-600 px-1.5 py-px text-[10px] font-bold tabular-nums text-white ring-2 ring-white sm:hidden">
                {bestMockScore}
              </span>
            </>
          ) : null}
        </Button>
      </>
    );
  };

  const interviewDialogs = (
    <>
      <InterviewPrepDialog
        job={prepJob}
        open={prepOpen}
        onOpenChange={setPrepOpen}
        onPrepReady={handlePrepReady}
      />
      <MockInterviewDialog
        job={mockJob}
        open={mockOpen}
        onOpenChange={setMockOpen}
        onStarted={handleMockStarted}
        onCompleted={handleMockCompleted}
      />
    </>
  );

  if (loading) {
    return (
      <section className="space-y-8">
        <div className="flex items-start gap-3 sm:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
            <List className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Job Tracker</h1>
            <p className="text-sm text-slate-500">
              Keep tabs on every opportunity you are pursuing.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      </section>
    );
  }

  if (subscriptionLocked) {
    // Tracking jobs is a paid feature, but interview practice isn't only
    // that: the free plan's trial includes a prep guide and one mock
    // interview, and both need a scanned job to work from. The scan that
    // produces that job is also what ends the trial and locks this section,
    // so the jobs are listed here, read-only, with just those two buttons.
    // (The server holds the actual allowance; see lib/server/interview.js.)
    const practiceJobs = jobs.filter(hasKeywordData).slice(0, JOBS_PER_PAGE);
    return (
      <section className="space-y-8 max-w-6xl mx-auto">
        <div className="flex items-start gap-3 sm:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
            <List className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Job Tracker</h1>
            <p className="text-sm text-slate-500">
              Keep tabs on every opportunity you are pursuing.
            </p>
          </div>
        </div>
        {practiceJobs.length ? (
          <div className="mx-auto max-w-xl rounded-2xl border border-violet-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">Interview practice</h2>
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-200">
                Included free
              </span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              An interview prep guide and one mock interview, for a job you&apos;ve scanned.
            </p>
            <ul className="mt-3 divide-y divide-slate-100">
              {practiceJobs.map((job) => (
                <li
                  key={job.id}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="break-anywhere text-sm font-semibold text-slate-900">
                      {job.organization}
                    </p>
                    <p className="break-anywhere text-sm text-slate-600">{job.designation}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {renderInterviewButtons(job, false, false)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <SubscriptionGate
          event="job_tracker_locked_upgrade_clicked"
          title="You're out of scans"
          body="Job Tracker keeps every role you've scanned in one place, with the score it earned and the documents you generated for it."
          highlights={[
            "Every scan saved automatically, with its score",
            "Track each application from applied to offer",
            "Re-download the exact CV and cover letter you sent",
            `Interview prep and ${MOCK_ATTEMPTS_PER_JOB} mock interviews for every job you scan`,
          ]}
        />
        {interviewDialogs}
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start gap-3 sm:items-center">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
          <List className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Job Tracker</h1>
          <p className="text-sm text-slate-500">
            Keep tabs on every opportunity you are pursuing.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Add a role</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Manually add jobs, or they&apos;re saved automatically when you run a scan.
        </p>

        <form onSubmit={handleAddJob} className="mt-4 grid gap-3 md:grid-cols-3">
          <Input
            className="rounded-md"
            placeholder="Organization"
            value={newJob.organization}
            onChange={(event) =>
              setNewJob((prev) => ({ ...prev, organization: event.target.value }))
            }
          />
          <Input
            className="rounded-md"
            placeholder="Designation / Role"
            value={newJob.designation}
            onChange={(event) =>
              setNewJob((prev) => ({ ...prev, designation: event.target.value }))
            }
          />
          <div className="relative">
            <select
              value={newJob.status}
              onChange={(event) =>
                setNewJob((prev) => ({ ...prev, status: event.target.value }))
              }
              aria-label="Interview status"
              className="h-11 w-full appearance-none rounded-md border border-slate-200 bg-white pl-3 pr-10 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 md:h-9"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <SelectChevron className="right-3 text-slate-400" />
          </div>
          <div className="md:col-span-3">
            <Button type="submit" className="w-full rounded-md md:w-auto">
              <SaveIcon className="mr-2 h-4 w-4" />
              Save job
            </Button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="rounded-md pl-9"
              placeholder="Search by organization, role, or status"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        {/* The table needs ~950px for seven columns, so it starts at xl;
            narrower screens get the row as a card (below). */}
        <div className="hidden items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 xl:grid xl:grid-cols-[minmax(0,1.6fr),minmax(0,1.3fr),172px,104px,120px,168px,36px]">
          <span>Organization</span>
          <span>Role</span>
          <span>Documents</span>
          <span>Score</span>
          <span>Status</span>
          <span>Interview</span>
          <span></span>
        </div>
        <div className="divide-y divide-slate-100">
          {filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Briefcase className="h-6 w-6" />
              </span>
              <p className="text-sm font-medium text-slate-600">
                {jobs.length === 0 ? "No jobs tracked yet" : "No matching jobs"}
              </p>
              <p className="text-xs text-slate-400">
                {jobs.length === 0
                  ? "Run a scan or add a job manually to start tracking."
                  : "Try a different search term."}
              </p>
            </div>
          ) : (
            paginatedJobs.map((job) => {
              // The six cells are built once and composed twice: as a stacked
              // card on phones and as the original table row from `sm` up.
              // Sharing the pieces keeps the two layouts from drifting apart.
              const resumeButton = (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    downloading === `${job.id}-resume` || !job.generated_resume_payload
                  }
                  title={
                    job.generated_resume_payload
                      ? undefined
                      : "Available after you download the optimized resume for this job"
                  }
                  className="flex-1 gap-0 rounded-md rounded-r-none sm:flex-none"
                  onClick={() => downloadGeneratedDocument(job, "resume")}
                >
                  {downloading === `${job.id}-resume` ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-1 h-4 w-4" />
                  )}
                  Resume
                </Button>
              );
              const coverButton = (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={downloading === `${job.id}-cover`}
                  className="flex-1 gap-0 rounded-md rounded-l-none border-l-0 sm:flex-none"
                  onClick={() => downloadGeneratedDocument(job, "cover")}
                >
                  {downloading === `${job.id}-cover` ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-1 h-4 w-4" />
                  )}
                  Cover
                </Button>
              );
              // Before tailoring there is only the scan score. After it, both
              // are shown as "was → now", so the lift the optimization bought
              // is readable at a glance instead of overwriting the original.
              const optimized = job.optimized_score ?? null;
              const scoreChip = (
                // shrink-0: on the phone card this sits next to the company
                // name, and a long name would otherwise squash the badge.
                <span
                  className="inline-flex shrink-0 items-center gap-1"
                  title={
                    optimized !== null
                      ? `Scan score ${job.initial_score ?? "—"} → optimized ${optimized}`
                      : "Scan score"
                  }
                >
                  <span
                    className={cn(
                      "inline-flex min-w-[2.25rem] items-center justify-center rounded-md px-2 py-1 text-sm font-bold tabular-nums",
                      optimized !== null
                        ? "bg-slate-100 text-slate-400"
                        : scoreClass(job.initial_score)
                    )}
                  >
                    {job.initial_score !== null ? job.initial_score : "—"}
                  </span>
                  {optimized !== null ? (
                    <>
                      <span aria-hidden className="text-xs text-slate-400">
                        →
                      </span>
                      <span
                        className={cn(
                          "inline-flex min-w-[2.25rem] items-center justify-center rounded-md px-2 py-1 text-sm font-bold tabular-nums",
                          scoreClass(optimized)
                        )}
                      >
                        {optimized}
                      </span>
                    </>
                  ) : null}
                </span>
              );
              // The status colours sit on the wrapper so the chevron can pick up
              // the same text colour; the select inherits them.
              const statusSelect = (
                <div
                  className={cn(
                    "relative inline-flex rounded-md shadow-sm",
                    statusClass(job.interview_status)
                  )}
                >
                  <select
                    value={job.interview_status}
                    onChange={(event) => updateStatus(job.id, event.target.value)}
                    disabled={updating === job.id}
                    aria-label={`Status for ${job.designation} at ${job.organization}`}
                    className="peer h-9 cursor-pointer appearance-none rounded-md border border-inherit bg-transparent pl-3 pr-8 text-xs font-semibold text-inherit transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 disabled:opacity-50 sm:h-8"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status} className="bg-white text-slate-700">
                        {status}
                      </option>
                    ))}
                  </select>
                  <SelectChevron className="right-2.5 peer-disabled:opacity-50" />
                </div>
              );
              const deleteButton = (
                <button
                  type="button"
                  aria-label="Delete job"
                  onClick={() => handleDelete(job.id)}
                  className="-mr-1.5 rounded-md p-2.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 sm:mr-0 sm:p-1.5"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              );
              const canPractise = hasKeywordData(job);
              const interviewButtons = (compact: boolean) =>
                renderInterviewButtons(job, compact);

              return (
                <div key={job.id} className="transition hover:bg-slate-50/70">
                  {/* Phone: a tappable card. The score reads as an attribute of
                      the company, so it sits on the title line; the status is
                      the one thing you change here, so it gets the right edge
                      of its own row where a thumb lands. */}
                  <div className="flex flex-col gap-3 px-4 py-4 sm:hidden">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="break-anywhere text-sm font-semibold text-slate-900">
                            {job.organization}
                          </p>
                          {scoreChip}
                        </div>
                        <p className="break-anywhere mt-0.5 text-sm text-slate-600">
                          {job.designation}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {new Date(job.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {deleteButton}
                    </div>
                    <div className="flex justify-end">{statusSelect}</div>
                    <div className="flex">
                      {resumeButton}
                      {coverButton}
                    </div>
                    {canPractise ? (
                      <div className="flex gap-2">{interviewButtons(false)}</div>
                    ) : null}
                  </div>

                  {/* Tablet up to xl: the same row on two lines. What the job
                      is and where it stands on top; everything you can do
                      with it underneath, documents left, interview right. */}
                  <div className="hidden px-5 py-4 sm:block xl:hidden">
                    <div className="flex items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="break-anywhere text-sm font-semibold text-slate-900">
                          {job.organization}
                        </p>
                        <p className="break-anywhere mt-0.5 text-sm text-slate-600">
                          {job.designation}
                          <span className="text-slate-400">
                            {" · "}
                            {new Date(job.created_at).toLocaleDateString()}
                          </span>
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {scoreChip}
                        {statusSelect}
                        {deleteButton}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex">
                        {resumeButton}
                        {coverButton}
                      </div>
                      {canPractise ? (
                      <div className="flex gap-2">{interviewButtons(false)}</div>
                    ) : null}
                    </div>
                  </div>

                  {/* xl and up: the table row, with the interview buttons as
                      its last column. */}
                  <div className="hidden items-center gap-3 px-5 py-4 xl:grid xl:grid-cols-[minmax(0,1.6fr),minmax(0,1.3fr),172px,104px,120px,168px,36px]">
                    <div className="flex min-w-0 flex-col justify-center">
                      <p className="break-anywhere text-sm font-semibold text-slate-900">
                        {job.organization}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(job.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="break-anywhere flex items-center text-sm text-slate-600">
                      {job.designation}
                    </p>
                    <div className="flex items-center">
                      {resumeButton}
                      {coverButton}
                    </div>
                    <div className="flex items-center justify-start gap-2">{scoreChip}</div>
                    <div className="flex items-center">{statusSelect}</div>
                    <div className="flex items-center gap-2">
                      {canPractise ? interviewButtons(true) : null}
                    </div>
                    <div className="flex items-center justify-end">{deleteButton}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {/* Four items won't fit one phone row, so the count moves to its own
            line above the controls and the arrows split the width evenly. */}
        {filteredJobs.length > JOBS_PER_PAGE && (
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-xs text-slate-500">
              Showing {(currentPage - 1) * JOBS_PER_PAGE + 1}–
              {Math.min(currentPage * JOBS_PER_PAGE, filteredJobs.length)} of{" "}
              {filteredJobs.length} jobs
            </p>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <Button
                variant="outline"
                size="sm"
                className="rounded-md"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-xs font-medium tabular-nums text-slate-600">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-md"
                disabled={currentPage === totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {interviewDialogs}
    </section>
  );
};
