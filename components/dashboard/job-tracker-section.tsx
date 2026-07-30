"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { supabase } from "@/lib/supabaseClient";
import {
  extractCandidateName,
  renderResumeHtml,
  renderCoverLetterHtml,
} from "@/components/resume-templates/render";
import type { ResumeTemplateId } from "@/components/resume-templates/types";
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Download,
  List,
  Loader2,
  SaveIcon,
  Search,
  Trash2,
} from "lucide-react";
import swal from "sweetalert";

const STATUS_STYLES: Record<string, string> = {
  Applied: "border-blue-200 bg-blue-50 text-blue-700",
  Interviewing: "border-amber-200 bg-amber-50 text-amber-700",
  Offer: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Rejected: "border-rose-200 bg-rose-50 text-rose-700",
};
const statusClass = (status: string) =>
  STATUS_STYLES[status] || "border-slate-200 bg-slate-50 text-slate-700";

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
  matched_keywords: string[];
  missing_keywords: string[];
  resume_template_id?: string | null;
  cover_letter_template_id?: string | null;
  generated_resume_text?: string | null;
  generated_cover_letter_text?: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_OPTIONS = ["Applied", "Interviewing", "Offer", "Rejected"];
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
    const resumeText = job.generated_resume_text || "";
    const coverText = job.generated_cover_letter_text || "";
    if (type === "resume" && !resumeText) {
      toast.error("No saved resume found for this entry. Download once from Scan first.");
      return;
    }
    if (type === "cover" && !coverText) {
      toast.error("No saved cover letter found for this entry. Download once from Scan first.");
      return;
    }

    setDownloading(`${job.id}-${type}`);
    try {
      // Use the real template renderers (same engine as the scan preview) so
      // downloads keep their template styling instead of a bland fallback.
      const templateId = (job.resume_template_id || "classic-blue") as ResumeTemplateId;
      const html =
        type === "resume"
          ? renderResumeHtml({
              resumeText,
              templateId,
              candidateName: extractCandidateName(resumeText),
              designation: job.designation || "",
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
      const candidateSlug = toSlugPart(extractCandidateName(resumeText));
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

  if (loading) {
    return (
      <section className="space-y-8">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <List className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Job Tracker</h1>
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
    return (
      <section className="space-y-8 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <List className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Job Tracker</h1>
            <p className="text-sm text-slate-500">
              Keep tabs on every opportunity you are pursuing.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-amber-900">Subscription required</h2>
          <p className="mt-2 text-sm text-amber-800">
            Please subscribe to a plan to optimize your resume.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
          <List className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Job Tracker</h1>
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
          <select
            value={newJob.status}
            onChange={(event) =>
              setNewJob((prev) => ({ ...prev, status: event.target.value }))
            }
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <div className="md:col-span-3">
            <Button type="submit" className="w-full rounded-md md:w-auto">
              <SaveIcon className="mr-2 h-4 w-4" />
              Save job
            </Button>
          </div>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-3">
          <div className="relative max-w-sm">
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
        <div className="grid grid-cols-[2fr,1.5fr,1.5fr,0.8fr,1fr,0.5fr] items-center border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 max-sm:hidden">
          <span>Organization</span>
          <span>Role</span>
          <span>Documents</span>
          <span>Score</span>
          <span>Status</span>
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
            paginatedJobs.map((job) => (
              <div
                key={job.id}
                className="grid grid-cols-1 items-center gap-3 px-5 py-4 transition hover:bg-slate-50/70 sm:grid-cols-[2fr,1.5fr,1.5fr,0.8fr,1fr,0.5fr]"
              >
                <div className="flex flex-col justify-center">
                  <p className="text-sm font-semibold text-slate-900">{job.organization}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(job.created_at).toLocaleDateString()}
                  </p>
                </div>
                <p className="flex items-center text-sm text-slate-600">{job.designation}</p>
                <div className="flex flex-wrap sm:items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={downloading === `${job.id}-resume`}
                    className="gap-0 rounded-md rounded-r-none"
                    onClick={() => downloadGeneratedDocument(job, "resume")}
                  >
                    {downloading === `${job.id}-resume` ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-1 h-4 w-4" />
                    )}
                    Resume
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={downloading === `${job.id}-cover`}
                    className="gap-0 rounded-md rounded-l-none border-l-0"
                    onClick={() => downloadGeneratedDocument(job, "cover")}
                  >
                    {downloading === `${job.id}-cover` ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-1 h-4 w-4" />
                    )}
                    Cover
                  </Button>
                </div>
                <div className="flex items-center justify-start gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 sm:hidden">
                    Score
                  </span>
                  <span
                    className={cn(
                      "inline-flex min-w-[2.25rem] items-center justify-center rounded-md px-2 py-1 text-sm font-bold tabular-nums",
                      scoreClass(job.initial_score)
                    )}
                  >
                    {job.initial_score !== null ? job.initial_score : "—"}
                  </span>
                </div>
                <div className="flex items-center">
                  <select
                    value={job.interview_status}
                    onChange={(event) => updateStatus(job.id, event.target.value)}
                    disabled={updating === job.id}
                    className={cn(
                      "h-8 cursor-pointer rounded-full border px-3 text-xs font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 disabled:opacity-50",
                      statusClass(job.interview_status)
                    )}
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status} className="bg-white text-slate-700">
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    aria-label="Delete job"
                    onClick={() => handleDelete(job.id)}
                    className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {filteredJobs.length > JOBS_PER_PAGE && (
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
            <p className="text-xs text-slate-500">
              Showing {(currentPage - 1) * JOBS_PER_PAGE + 1}–
              {Math.min(currentPage * JOBS_PER_PAGE, filteredJobs.length)} of{" "}
              {filteredJobs.length} jobs
            </p>
            <div className="flex items-center gap-2">
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
    </section>
  );
};
