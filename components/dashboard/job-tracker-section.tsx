"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Trash2 } from "lucide-react";
import swal from "sweetalert";

type Job = {
  id: string;
  organization: string;
  designation: string;
  interview_status: string;
  initial_score: number | null;
  matched_keywords: string[];
  missing_keywords: string[];
  created_at: string;
  updated_at: string;
};

const STATUS_OPTIONS = ["Applied", "Interviewing", "Offer", "Rejected"];

export const JobTrackerSection = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
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
        <div className="grid grid-cols-[2fr,2fr,1fr,1fr,0.5fr] items-center border-b px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 max-sm:hidden">
          <span>Organization</span>
          <span>Role</span>
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
                className="grid grid-cols-1 gap-3 px-6 py-4 sm:grid-cols-[2fr,2fr,1fr,1fr,0.5fr]"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {job.organization}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(job.created_at).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-sm text-slate-600">{job.designation}</p>
                <div>
                  {job.initial_score !== null ? (
                    <p className="text-sm font-semibold text-slate-900">
                      {job.initial_score}/100
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400">—</p>
                  )}
                </div>
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
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
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
