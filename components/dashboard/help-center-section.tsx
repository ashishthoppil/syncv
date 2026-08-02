"use client";

import {
  ChangeEvent,
  FormEvent,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronDown,
  LifeBuoy,
  Loader2,
  MessageSquarePlus,
  NotebookPen,
  SendHorizonal,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import swal from "sweetalert";
import { toast } from "react-toastify";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { inputClass, labelClass, SectionCard } from "@/components/dashboard/resume-form";

const ATTACHMENT_BUCKET = "ticket-attachments";
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const selectClass =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10";

const TYPE_OPTIONS = [
  { value: "query", label: "Query" },
  { value: "complaint", label: "Complaint" },
  { value: "feedback", label: "Feedback" },
];

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_STYLES: Record<string, string> = {
  open: "border-blue-200 bg-blue-50 text-blue-700",
  in_progress: "border-amber-200 bg-amber-50 text-amber-700",
  resolved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  closed: "border-slate-200 bg-slate-100 text-slate-600",
  cancelled: "border-rose-200 bg-rose-50 text-rose-700",
};

const statusClass = (status: string) =>
  STATUS_STYLES[status] || "border-slate-200 bg-slate-50 text-slate-700";

const statusLabel = (status: string) =>
  STATUS_OPTIONS.find((option) => option.value === status)?.label || status;

const formatDate = (value: string) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

const formatDateTime = (value: string) =>
  value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";

type TicketNote = {
  id: string;
  note: string;
  created_at: string;
};

type Ticket = {
  id: string;
  ticket_number: string;
  type: "query" | "complaint";
  message: string;
  status: string;
  contact_email: string;
  created_at: string;
  attachment_urls?: string[];
  notes?: TicketNote[];
};

type SectionUser = { id?: string; email?: string } | null;

// Every support endpoint resolves the caller from this token rather than a
// userId in the payload, so the header is not optional.
const authedFetch = async (url: string, options: RequestInit = {}) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(options.headers || {}),
    },
  });
};

export const HelpCenterSection = ({ user }: { user: SectionUser }) => {
  // null = not loaded yet, [] = loaded and empty. Keeps the empty state from
  // flashing before the first response lands.
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminScope, setAdminScope] = useState(false);
  const [loading, setLoading] = useState(true);

  const [type, setType] = useState("query");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);

  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterEmail, setFilterEmail] = useState("");
  // Debounced separately from the input value — the email filter runs server-side,
  // so refetching on every keystroke would hammer the database.
  const [debouncedEmail, setDebouncedEmail] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedEmail(filterEmail.trim()), 350);
    return () => clearTimeout(timer);
  }, [filterEmail]);

  // Object URLs are revoked on unmount; a ref avoids re-running the effect (and
  // tearing down live previews) every time the list changes.
  const previewsRef = useRef<string[]>([]);
  previewsRef.current = previews;
  useEffect(() => () => previewsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);

  useEffect(() => {
    if (user?.email) setEmail((current) => current || user.email || "");
  }, [user?.email]);

  const loadTickets = useCallback(
    async (scope: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (scope) {
          params.set("scope", "all");
          if (filterType) params.set("type", filterType);
          if (filterStatus) params.set("status", filterStatus);
          if (debouncedEmail) params.set("email", debouncedEmail);
        }
        const query = params.toString();
        const response = await authedFetch(`/api/support/tickets${query ? `?${query}` : ""}`);
        const result = await response.json();

        if (!result.success) {
          toast.error(result.message || "Unable to load your tickets.");
          setTickets([]);
          return;
        }

        setTickets(result.data || []);
        setIsAdmin(Boolean(result.isAdmin));
      } catch {
        toast.error("Unable to load your tickets.");
        setTickets([]);
      } finally {
        setLoading(false);
      }
    },
    [filterType, filterStatus, debouncedEmail]
  );

  useEffect(() => {
    loadTickets(adminScope);
  }, [loadTickets, adminScope]);

  const isComplaint = type === "complaint";
  const isFeedback = type === "feedback";

  const resetForm = () => {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setMessage("");
    setFiles([]);
    setPreviews([]);
  };

  // The repo elsewhere leans on the `accept` attribute alone, which the browser
  // treats as advisory — so validate type, size and count for real here.
  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files || []);
    event.target.value = "";
    if (!picked.length) return;

    const accepted: File[] = [];
    for (const file of picked) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image.`);
        continue;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${file.name} is larger than 5MB.`);
        continue;
      }
      accepted.push(file);
    }

    const room = MAX_ATTACHMENTS - files.length;
    if (accepted.length > room) {
      toast.error(`You can attach up to ${MAX_ATTACHMENTS} images.`);
    }

    const next = accepted.slice(0, Math.max(room, 0));
    if (!next.length) return;

    setFiles((current) => [...current, ...next]);
    setPreviews((current) => [...current, ...next.map((file) => URL.createObjectURL(file))]);
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setFiles((current) => current.filter((_, i) => i !== index));
    setPreviews((current) => current.filter((_, i) => i !== index));
  };

  const uploadAttachments = async () => {
    const paths: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop() || "png";
      // The API rejects paths outside the caller's own folder, so this prefix
      // is load-bearing, not just tidy.
      const path = `${user?.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(path, file);
      if (error) throw error;
      paths.push(path);
    }
    return paths;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!message.trim()) {
      toast.error("Please describe your request.");
      return;
    }
    if (!email.trim()) {
      toast.error("Please enter an email address.");
      return;
    }
    if (isComplaint && files.length === 0) {
      toast.error("Complaints need at least one image so we can see the problem.");
      return;
    }

    setSubmitting(true);
    try {
      const attachments = files.length ? await uploadAttachments() : [];
      const response = await authedFetch("/api/support/tickets", {
        method: "POST",
        body: JSON.stringify({ type, message: message.trim(), contactEmail: email.trim(), attachments }),
      });
      const result = await response.json();

      if (!result.success) {
        toast.error(result.message || "Unable to send your request.");
        return;
      }

      resetForm();
      if (result.feedback) {
        toast.success("Thanks for the feedback — it's on its way to our team.");
        return;
      }

      toast.success(`Ticket ${result.data.ticket_number} raised. We'll be in touch.`);
      await loadTickets(adminScope);
    } catch {
      toast.error("Unable to send your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (ticket: Ticket) => {
    const confirmed = await swal({
      title: `Cancel ${ticket.ticket_number}?`,
      text: "We'll stop working on it. The ticket stays in your history.",
      icon: "warning",
      buttons: ["Keep it", "Cancel ticket"],
      dangerMode: true,
    });
    if (!confirmed) return;

    setUpdatingId(ticket.id);
    try {
      const response = await authedFetch("/api/support/tickets", {
        method: "PATCH",
        body: JSON.stringify({ ticketId: ticket.id, status: "cancelled" }),
      });
      const result = await response.json();
      if (!result.success) {
        toast.error(result.message || "Unable to cancel this ticket.");
        return;
      }
      setTickets((current) =>
        (current || []).map((row) => (row.id === ticket.id ? { ...row, status: "cancelled" } : row))
      );
      toast.success("Ticket cancelled.");
    } catch {
      toast.error("Unable to cancel this ticket.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusChange = async (ticket: Ticket, status: string) => {
    setUpdatingId(ticket.id);
    const previous = ticket.status;
    setTickets((current) =>
      (current || []).map((row) => (row.id === ticket.id ? { ...row, status } : row))
    );

    try {
      const response = await authedFetch("/api/support/tickets", {
        method: "PATCH",
        body: JSON.stringify({ ticketId: ticket.id, status }),
      });
      const result = await response.json();
      if (!result.success) {
        // Roll the optimistic update back so the row reflects reality.
        setTickets((current) =>
          (current || []).map((row) => (row.id === ticket.id ? { ...row, status: previous } : row))
        );
        toast.error(result.message || "Unable to update the status.");
        return;
      }
      toast.success(`${ticket.ticket_number} marked ${statusLabel(status).toLowerCase()}.`);
    } catch {
      setTickets((current) =>
        (current || []).map((row) => (row.id === ticket.id ? { ...row, status: previous } : row))
      );
      toast.error("Unable to update the status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAddNote = async (ticket: Ticket) => {
    const note = (noteDrafts[ticket.id] || "").trim();
    if (!note) {
      toast.error("Note cannot be empty.");
      return;
    }

    setSavingNoteId(ticket.id);
    try {
      const response = await authedFetch("/api/support/notes", {
        method: "POST",
        body: JSON.stringify({ ticketId: ticket.id, note }),
      });
      const result = await response.json();
      if (!result.success) {
        toast.error(result.message || "Unable to save the note.");
        return;
      }
      setTickets((current) =>
        (current || []).map((row) =>
          row.id === ticket.id ? { ...row, notes: [...(row.notes || []), result.data] } : row
        )
      );
      setNoteDrafts((current) => ({ ...current, [ticket.id]: "" }));
      toast.success("Note added — the user has been notified.");
    } catch {
      toast.error("Unable to save the note.");
    } finally {
      setSavingNoteId(null);
    }
  };

  const hasFilters = Boolean(filterType || filterStatus || debouncedEmail);
  const rows = tickets || [];
  const emptyCopy = useMemo(() => {
    if (adminScope) {
      return hasFilters
        ? { title: "No tickets match these filters", hint: "Try widening your search." }
        : { title: "No tickets yet", hint: "Queries and complaints will appear here." };
    }
    return {
      title: "No tickets yet",
      hint: "Raise a query or complaint above and you'll be able to track it here.",
    };
  }, [adminScope, hasFilters]);

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
          <LifeBuoy className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Help Center</h1>
          <p className="text-sm text-slate-500">
            Raise a query, report a problem, or tell us what you think.
          </p>
        </div>
      </div>

      <SectionCard icon={MessageSquarePlus} title="Contact support">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="support-type">
                Type of message
              </label>
              <select
                id="support-type"
                className={cn(selectClass, "mt-1")}
                value={type}
                onChange={(event) => setType(event.target.value)}
                disabled={submitting}
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="support-email">
                Email address
              </label>
              <Input
                id="support-email"
                type="email"
                className="mt-1 rounded-md"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                disabled={submitting}
              />
            </div>
          </div>

          <div>
            <label className={labelClass} htmlFor="support-message">
              Message
            </label>
            <textarea
              id="support-message"
              className={cn(inputClass, "mt-1 min-h-[120px] resize-y leading-relaxed")}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={
                isFeedback
                  ? "What's working well, and what could be better?"
                  : "Tell us what happened, and what you expected instead."
              }
              disabled={submitting}
            />
          </div>

          <div>
            <label className={labelClass}>
              Images{" "}
              {isComplaint ? (
                <span className="text-rose-600">(required for complaints)</span>
              ) : (
                <span className="normal-case tracking-normal text-slate-400">(optional)</span>
              )}
            </label>
            <label
              className={cn(
                "mt-1 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-6 py-6 text-center transition hover:border-slate-300 hover:bg-slate-50",
                (submitting || files.length >= MAX_ATTACHMENTS) && "pointer-events-none opacity-60"
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
                <UploadCloud className="h-5 w-5" />
              </span>
              <span className="text-sm font-medium text-slate-700">
                {files.length >= MAX_ATTACHMENTS
                  ? `Maximum ${MAX_ATTACHMENTS} images added`
                  : "Click to attach screenshots"}
              </span>
              <span className="text-xs text-slate-400">
                PNG or JPG, up to 5MB each — {MAX_ATTACHMENTS} images max
              </span>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleFilesSelected}
                disabled={submitting || files.length >= MAX_ATTACHMENTS}
              />
            </label>

            {previews.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-3">
                {previews.map((preview, index) => (
                  <div key={preview} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview}
                      alt={files[index]?.name || "Attachment preview"}
                      className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      disabled={submitting}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-rose-600"
                      aria-label={`Remove ${files[index]?.name || "attachment"}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-400">
              {isFeedback
                ? "Feedback is emailed straight to our team — it won't create a trackable ticket."
                : "You'll get a ticket number and can follow progress in the table below."}
            </p>
            <Button type="submit" className="rounded-md" disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <SendHorizonal className="mr-2 h-4 w-4" />
              )}
              {submitting ? "Sending…" : isFeedback ? "Send feedback" : "Raise ticket"}
            </Button>
          </div>
        </form>
      </SectionCard>

      {isAdmin && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Support inbox</h3>
              <p className="text-xs text-slate-500">
                {adminScope ? "Viewing every user's tickets." : "Viewing only your own tickets."}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-md"
              onClick={() => setAdminScope((current) => !current)}
            >
              {adminScope ? "Show my tickets" : "Show all tickets"}
            </Button>
          </div>

          {adminScope && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <select
                className={selectClass}
                value={filterType}
                onChange={(event) => setFilterType(event.target.value)}
                aria-label="Filter by type"
              >
                <option value="">All types</option>
                <option value="query">Query</option>
                <option value="complaint">Complaint</option>
              </select>
              <select
                className={selectClass}
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value)}
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Input
                className="rounded-md"
                placeholder="Filter by email"
                value={filterEmail}
                onChange={(event) => setFilterEmail(event.target.value)}
                aria-label="Filter by email"
              />
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <LifeBuoy className="h-6 w-6" />
            </span>
            <p className="text-sm font-medium text-slate-600">{emptyCopy.title}</p>
            <p className="text-xs text-slate-400">{emptyCopy.hint}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Ticket</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Type</th>
                  {adminScope && <th className="hidden px-4 py-3 lg:table-cell">From</th>}
                  <th className="hidden px-4 py-3 md:table-cell">Message</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Raised</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((ticket) => {
                  const expanded = expandedId === ticket.id;
                  const cancellable =
                    !isAdmin && ticket.status !== "cancelled" && ticket.status !== "closed";

                  return (
                    <Fragment key={ticket.id}>
                      <tr
                        className={cn(
                          "group cursor-pointer hover:bg-slate-50/60",
                          ticket.status === "cancelled" && "opacity-60"
                        )}
                        onClick={() => setExpandedId(expanded ? null : ticket.id)}
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">
                          <span className="flex items-center gap-1.5">
                            <ChevronDown
                              className={cn(
                                "h-3.5 w-3.5 text-slate-400 transition-transform",
                                expanded && "rotate-180"
                              )}
                            />
                            {ticket.ticket_number}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 capitalize text-slate-600 sm:table-cell">
                          {ticket.type}
                        </td>
                        {adminScope && (
                          <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">
                            {ticket.contact_email}
                          </td>
                        )}
                        <td className="hidden max-w-xs truncate px-4 py-3 text-slate-600 md:table-cell">
                          {ticket.message}
                        </td>
                        <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                          {isAdmin && adminScope ? (
                            <select
                              className={cn(
                                "h-8 cursor-pointer rounded-full border px-3 text-xs font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 disabled:opacity-50",
                                statusClass(ticket.status)
                              )}
                              value={ticket.status}
                              disabled={updatingId === ticket.id}
                              onChange={(event) => handleStatusChange(ticket, event.target.value)}
                            >
                              {STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span
                              className={cn(
                                "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
                                statusClass(ticket.status)
                              )}
                            >
                              {statusLabel(ticket.status)}
                            </span>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 text-slate-500 lg:table-cell">
                          {formatDate(ticket.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(event) => event.stopPropagation()}>
                          {cancellable ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="h-8 rounded-md px-2 text-xs text-slate-500 hover:text-rose-600"
                              onClick={() => handleCancel(ticket)}
                              disabled={updatingId === ticket.id}
                            >
                              {updatingId === ticket.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                              <span className="ml-1 hidden sm:inline">Cancel</span>
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={adminScope ? 7 : 6} className="px-4 py-4">
                            <div className="space-y-4">
                              <div>
                                <p className={labelClass}>Message</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                                  {ticket.message}
                                </p>
                              </div>

                              {ticket.attachment_urls && ticket.attachment_urls.length > 0 && (
                                <div>
                                  <p className={labelClass}>Attachments</p>
                                  <div className="mt-2 flex flex-wrap gap-3">
                                    {ticket.attachment_urls.map((url) => (
                                      <a key={url} href={url} target="_blank" rel="noreferrer">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={url}
                                          alt="Ticket attachment"
                                          className="h-24 w-24 rounded-lg border border-slate-200 object-cover transition hover:opacity-90"
                                        />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div>
                                <p className={labelClass}>
                                  Notes from support
                                  {ticket.notes?.length ? ` (${ticket.notes.length})` : ""}
                                </p>
                                {ticket.notes && ticket.notes.length > 0 ? (
                                  <ul className="mt-2 space-y-2">
                                    {ticket.notes.map((note) => (
                                      <li
                                        key={note.id}
                                        className="rounded-lg border border-slate-200 bg-white p-3"
                                      >
                                        <p className="whitespace-pre-wrap text-sm text-slate-700">
                                          {note.note}
                                        </p>
                                        <p className="mt-1 text-[11px] text-slate-400">
                                          {formatDateTime(note.created_at)}
                                        </p>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="mt-1 text-sm text-slate-400">No notes yet.</p>
                                )}
                              </div>

                              {isAdmin && (
                                <div className="border-t border-slate-200 pt-3">
                                  <p className={labelClass}>Add a note</p>
                                  <p className="mt-0.5 text-[11px] text-slate-400">
                                    Visible to the user who raised this ticket, and emailed to them.
                                  </p>
                                  <textarea
                                    className={cn(inputClass, "mt-2 min-h-[70px] resize-y")}
                                    value={noteDrafts[ticket.id] || ""}
                                    onChange={(event) =>
                                      setNoteDrafts((current) => ({
                                        ...current,
                                        [ticket.id]: event.target.value,
                                      }))
                                    }
                                    placeholder="Let them know what's happening…"
                                    disabled={savingNoteId === ticket.id}
                                  />
                                  <Button
                                    type="button"
                                    className="mt-2 rounded-md"
                                    onClick={() => handleAddNote(ticket)}
                                    disabled={savingNoteId === ticket.id}
                                  >
                                    {savingNoteId === ticket.id ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <NotebookPen className="mr-2 h-4 w-4" />
                                    )}
                                    {savingNoteId === ticket.id ? "Saving…" : "Add note"}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
