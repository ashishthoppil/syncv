"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { supabase } from "@/lib/supabaseClient";
import { Download, Loader2, Trash2 } from "lucide-react";
import swal from "sweetalert";

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

export const JobTrackerSection = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
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

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const toSlugPart = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "unknown";

  const extractCandidateName = (resumeText = "") => {
    const lines = resumeText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return "Candidate";
    const firstLine = lines[0].replace(/[^a-zA-Z.\s-]/g, "").trim();
    return firstLine || "Candidate";
  };

  const toStructuredHtml = (content = "") => {
    const paragraphs = content
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map(
        (part) =>
          `<p style="font-size:13px;line-height:1.65;color:#334155;margin:0 0 10px;">${escapeHtml(
            part
          ).replace(/\n/g, "<br/>")}</p>`
      )
      .join("");
    return paragraphs || '<p style="font-size:13px;color:#64748b;">No content available.</p>';
  };

  const toResumeTemplateHtml = (job: Job) => {
    const content = job.generated_resume_text || "";
    const candidateName = extractCandidateName(content);
    const designation = job.designation || "";
    const body = toStructuredHtml(content);
    const templateId = job.resume_template_id || "classic-blue";

    if (templateId === "bold-modern") {
      return `
        <section style="font-family:Arial,sans-serif;padding:24px;">
          <div style="border-bottom:2px solid #111827;padding-bottom:10px;margin-bottom:12px;">
            <h1 style="margin:0;font-size:34px;line-height:1.1;font-weight:800;color:#111827;">${escapeHtml(
              candidateName
            )}</h1>
            <p style="margin:8px 0 0;font-size:14px;font-weight:700;color:#1f2937;">${escapeHtml(
              designation
            )}</p>
          </div>
          ${body}
        </section>
      `;
    }

    if (templateId === "analyst-photo") {
      return `
        <section style="font-family:Arial,sans-serif;padding:24px;">
          <div style="border-bottom:2px solid #2563eb;padding-bottom:10px;margin-bottom:12px;">
            <h1 style="margin:0;font-size:34px;line-height:1.1;font-weight:800;color:#2563eb;">${escapeHtml(
              candidateName
            )}</h1>
            <p style="margin:8px 0 0;font-size:14px;font-weight:700;color:#1f2937;">${escapeHtml(
              designation
            )}</p>
          </div>
          ${body}
        </section>
      `;
    }

    return `
      <section style="font-family:Arial,sans-serif;padding:24px;">
        <div style="background:#7eb4df;height:12px;margin-bottom:12px;"></div>
        <h1 style="margin:0;font-size:34px;line-height:1.1;font-weight:700;color:#334155;">${escapeHtml(
          candidateName
        )}</h1>
        <p style="margin:8px 0 12px;font-size:14px;font-weight:700;color:#475569;">${escapeHtml(
          designation
        )}</p>
        ${body}
      </section>
    `;
  };

  const toCoverHtml = (content = "") => {
    const plain = content.replace(/\*\*(.+?)\*\*/g, "$1");
    const paragraphs = plain
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map(
        (part) =>
          `<p style="font-size:13px;line-height:1.7;color:#334155;margin:0 0 12px;">${escapeHtml(
            part
          ).replace(/\n/g, "<br/>")}</p>`
      )
      .join("");
    return `<section style="font-family:Arial,sans-serif;padding:24px;">${paragraphs}</section>`;
  };

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
      const html = type === "resume" ? toResumeTemplateHtml(job) : toCoverHtml(coverText);
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

  if (loading) {
    return (
      <section className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Job Tracker</h1>
          <p className="text-sm text-slate-500">
            Keep tabs on every opportunity you are pursuing.
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Job Tracker</h1>
        <p className="text-sm text-slate-500">
          Keep tabs on every opportunity you are pursuing.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Add a role</h2>
        <p className="text-sm text-slate-500">
          Manually add jobs or they will be saved automatically when you run a scan.
        </p>

        <form
          onSubmit={handleAddJob}
          className="mt-6 grid gap-4 md:grid-cols-3"
        >
          <Input
            placeholder="Organization"
            value={newJob.organization}
            onChange={(event) =>
              setNewJob((prev) => ({ ...prev, organization: event.target.value }))
            }
          />
          <Input
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
            className="h-9 w-full rounded-full border border-input bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <div className="md:col-span-3">
            <Button type="submit" className="w-full rounded-full md:w-auto">
              Save Job
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-0 shadow-sm">
        <div className="grid grid-cols-[2fr,1.5fr,1.5fr,0.8fr,1fr,0.5fr] items-center border-b px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 max-sm:hidden">
          <span>Organization</span>
          <span>Role</span>
          <span>Documents</span>
          <span>Score</span>
          <span>Status</span>
          <span></span>
        </div>
        <div className="divide-y">
          {jobs.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-slate-500">
                No jobs tracked yet. Run a scan or add a job manually.
              </p>
            </div>
          ) : (
            jobs.map((job) => (
              <div
                key={job.id}
                className="grid grid-cols-1 gap-3 px-6 py-4 sm:grid-cols-[2fr,1.5fr,1.5fr,0.8fr,1fr,0.5fr]"
              >
                <div className="flex flex-col justify-center">
                  <p className="text-sm font-semibold text-slate-900">
                    {job.organization}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(job.created_at).toLocaleDateString()}
                  </p>
                </div>
                <p className="flex items-center text-sm text-slate-600">{job.designation}</p>
                <div className="flex flex-wrap gap-2 sm:items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={downloading === `${job.id}-resume`}
                    className="gap-0"
                    onClick={() => downloadGeneratedDocument(job, "resume")}
                  >
                    {downloading === `${job.id}-resume` ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-1 h-4 w-4" />
                    )}
                    CV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={downloading === `${job.id}-cover`}
                    className="gap-0"
                    onClick={() => downloadGeneratedDocument(job, "cover")}
                  >
                    {downloading === `${job.id}-cover` ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-1 h-4 w-4" />
                    )}
                    Letter
                  </Button>
                </div>
                <div className="flex items-center justify-start">
                  {job.initial_score !== null ? (
                    <p className="text-sm font-semibold text-slate-900">
                      {job.initial_score}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">—</p>
                  )}
                </div>
                <div className="flex items-center">
                  <select
                    value={job.interview_status}
                    onChange={(event) =>
                      updateStatus(job.id, event.target.value)
                    }
                    disabled={updating === job.id}
                    className="h-9 rounded-full border border-input bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => handleDelete(job.id)}
                    className="text-red-600 hover:text-red-700 hover:border-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
