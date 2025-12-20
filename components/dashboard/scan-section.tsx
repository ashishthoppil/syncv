"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "react-toastify";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowRight,
  FileText,
  Loader2,
  RefreshCcw,
  UploadCloud,
} from "lucide-react";

type ScanSummary = {
  initialScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  keywordUniverse: string[];
};

const initialFormState = {
  organization: "",
  designation: "",
  jd: "",
  resume: "",
};

type FormField = keyof typeof initialFormState;
type FormErrors = Partial<Record<FormField, string>>;

export const ScanSection = () => {
  const [form, setForm] = useState(initialFormState);
  const [result, setResult] = useState<ScanSummary | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const updateForm = (key: FormField, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => {
      if (!prev[key]) return prev;
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  const validateForm = () => {
    const errors: FormErrors = {};
    (Object.keys(form) as FormField[]).forEach((field) => {
      if (!form[field].trim()) {
        const label =
          field === "jd"
            ? "Job description"
            : field === "resume"
            ? "Resume content"
            : field === "organization"
            ? "Organization"
            : "Designation";
        errors[field] = `${label} is required.`;
      }
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleDrop = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }
    const file = files[0];
    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        updateForm("resume", data.message);
        toast.success("Resume extracted successfully.");
      } else {
        toast.error(data.message || "Unable to parse the resume.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong while scanning the resume.");
    } finally {
      setIsUploading(false);
    }
  };

  const analyzeResume = async () => {
    if (!validateForm()) {
      toast.error("Please complete all required fields.");
      return;
    }

    setIsAnalyzing(true);
    try {
      // Get current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to save scan results.");
        setIsAnalyzing(false);
        return;
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: JSON.stringify({
          resume: form.resume,
          jd: form.jd,
          organization: form.organization,
          designation: form.designation,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setResult(data.message);
        
        // Save to job tracker
        try {
          const saveResponse = await fetch("/api/job-tracker", {
            method: "POST",
            body: JSON.stringify({
              userId: session.user.id,
              organization: form.organization,
              designation: form.designation,
              initialScore: data.message.initialScore,
              matchedKeywords: data.message.matchedKeywords,
              missingKeywords: data.message.missingKeywords,
              keywordUniverse: data.message.keywordUniverse,
            }),
          });
          const saveData = await saveResponse.json();
          if (saveData.success) {
            toast.success("Scan completed and saved to job tracker!");
          } else {
            toast.success("Scan completed! (Could not save to tracker)");
          }
        } catch (saveError) {
          console.error("Error saving to job tracker:", saveError);
          toast.success("Scan completed! (Could not save to tracker)");
        }
      } else {
        toast.error(data.message || "Unable to analyze the resume right now.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Unexpected error while analyzing.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetForm = () => {
    setForm(initialFormState);
    setFormErrors({});
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isFormComplete = (Object.values(form) as string[]).every((value) =>
    value.trim()
  );

  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
            Scan
          </p>
          <h1 className="text-3xl font-semibold text-slate-900">
            Optimize your resume
          </h1>
          <p className="text-sm text-slate-500">
            Provide the target role, paste the JD, and let SynCV evaluate your resume.
          </p>
        </div>

        <Button variant="outline" className="rounded-full" onClick={resetForm}>
          <RefreshCcw className="mr-2 h-4 w-4" /> New Scan
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr,1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">
                Target organization <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="Acme Corp"
                value={form.organization}
                onChange={(event) =>
                  updateForm("organization", event.target.value)
                }
                className={cn(
                  formErrors.organization &&
                    "border-red-500 focus-visible:ring-red-500"
                )}
              />
              {formErrors.organization && (
                <p className="text-xs text-red-600">{formErrors.organization}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">
                Role / designation <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="Senior Frontend Engineer"
                value={form.designation}
                onChange={(event) =>
                  updateForm("designation", event.target.value)
                }
                className={cn(
                  formErrors.designation &&
                    "border-red-500 focus-visible:ring-red-500"
                )}
              />
              {formErrors.designation && (
                <p className="text-xs text-red-600">{formErrors.designation}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">
              Job description <span className="text-red-500">*</span>
            </label>
            <textarea
              className={cn(
                "min-h-[140px] w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20",
                formErrors.jd &&
                  "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2"
              )}
              placeholder="Paste the key responsibilities, required skills, etc."
              value={form.jd}
              onChange={(event) => updateForm("jd", event.target.value)}
            />
            {formErrors.jd && (
              <p className="text-xs text-red-600">{formErrors.jd}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">
              Resume content <span className="text-red-500">*</span>
            </label>
            <textarea
              className={cn(
                "min-h-[180px] w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20",
                formErrors.resume &&
                  "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2"
              )}
              placeholder="Paste your resume or upload a PDF/DOC/DOCX file."
              value={form.resume}
              onChange={(event) => updateForm("resume", event.target.value)}
            />
            {formErrors.resume && (
              <p className="text-xs text-red-600">{formErrors.resume}</p>
            )}
          </div>

          <div
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-500"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleDrop(event.dataTransfer.files);
            }}
          >
            <UploadCloud className="h-8 w-8 text-slate-400" />
            <p className="text-sm">
              Drag and drop a PDF/DOC/DOCX or{" "}
              <button
                type="button"
                className="font-semibold text-slate-900 underline"
                onClick={() => fileInputRef.current?.click()}
              >
                browse files
              </button>
            </p>
            <p className="text-xs text-slate-400">
              {isUploading
                ? "Parsing resume..."
                : "Only the first file will be processed."}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={(event) => handleDrop(event.target.files)}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              className="rounded-full"
              onClick={analyzeResume}
              disabled={isAnalyzing || isUploading || !isFormComplete}
            >
              {isAnalyzing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              Analyze my resume
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={resetForm}
              disabled={isAnalyzing}
            >
              Clear inputs
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Scan summary</h2>
          <p className="text-sm text-slate-500">
            We compare your resume against every keyword found in the JD.
          </p>

          <div className="mt-6 rounded-3xl border border-slate-100 p-6 text-center">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Initial score
            </p>
            <p className="mt-3 text-5xl font-semibold text-slate-900">
              {result ? `${result.initialScore}/100` : "—"}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {result
                ? `Based on ${result.keywordUniverse.length} extracted keywords.`
                : "Fill the form and run a scan to see your score."}
            </p>
          </div>

          {result && (
            <dl className="mt-6 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <dt>Matched keywords</dt>
                <dd className="font-semibold text-emerald-600">
                  {result.matchedKeywords.length}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Missing keywords</dt>
                <dd className="font-semibold text-red-600">
                  {result.missingKeywords.length}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </div>

      {result && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-500" />
              <p className="text-sm font-semibold text-slate-900">
                Matched keywords ({result.matchedKeywords.length})
              </p>
            </div>
            {result.matchedKeywords.length ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {result.matchedKeywords.map((keyword) => (
                  <li
                    key={keyword}
                    className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                  >
                    {keyword}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                None of the extracted keywords are present yet.
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-red-500" />
              <p className="text-sm font-semibold text-slate-900">
                Missing keywords ({result.missingKeywords.length})
              </p>
            </div>
            {result.missingKeywords.length ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {result.missingKeywords.map((keyword) => (
                  <li
                    key={keyword}
                    className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700"
                  >
                    {keyword}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Great! Your resume covers every keyword we found.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

