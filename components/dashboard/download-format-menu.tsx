"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Download, FilePen, FileText, Loader2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * The file formats a tailored resume or cover letter downloads in. PDF stays
 * the default everywhere — it is what you send, and it looks the same on every
 * screen. Word is there for people who want to keep editing, or who are asked
 * for a .docx.
 */
export type DocFormat = "pdf" | "docx";

export const DOC_FORMATS: {
  format: DocFormat;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  { format: "pdf", label: "PDF", hint: "Ready to send — looks the same everywhere", icon: FileText },
  { format: "docx", label: "Word (.docx)", hint: "Keep editing in Word or Google Docs", icon: FilePen },
];

/**
 * A format picker in a popover. Above the preview modal and its dialogs (up to
 * z-[90]), since it opens from inside them.
 */
export const DownloadFormatMenu = ({
  trigger,
  onPick,
  align = "end",
}: {
  trigger: ReactNode;
  onPick: (format: DocFormat) => void;
  align?: "start" | "center" | "end";
}) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} sideOffset={6} className="z-[95] w-72 p-1.5">
        <p className="px-2.5 pb-1 pt-1.5 text-xs font-medium text-slate-500">Download as</p>
        {DOC_FORMATS.map(({ format, label, hint, icon: Icon }) => (
          <button
            key={format}
            type="button"
            onClick={() => {
              setOpen(false);
              onPick(format);
            }}
            className="flex w-full items-start gap-3 rounded-md px-2.5 py-2.5 text-left transition-colors hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none"
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900">{label}</span>
              <span className="block text-xs text-slate-500">{hint}</span>
            </span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};

/**
 * Download button with the format choice beside it: one click still gets the
 * PDF, and the chevron offers Word.
 */
export const SplitDownloadButton = ({
  label,
  busy = false,
  disabled = false,
  onDownload,
  className,
  "data-tour": dataTour,
}: {
  label: string;
  busy?: boolean;
  disabled?: boolean;
  onDownload: (format: DocFormat) => void;
  className?: string;
  "data-tour"?: string;
}) => (
  <div data-tour={dataTour} className={cn("flex min-w-0", className)}>
    <Button
      className="min-w-0 flex-1 rounded-md rounded-r-none"
      disabled={disabled || busy}
      onClick={() => onDownload("pdf")}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Download />}
      <span className="truncate">{label}</span>
    </Button>
    <DownloadFormatMenu
      onPick={onDownload}
      trigger={
        <Button
          aria-label="More download formats"
          className="rounded-md rounded-l-none border-l border-white/20 px-2.5 md:px-2"
          disabled={disabled || busy}
        >
          <ChevronDown />
        </Button>
      }
    />
  </div>
);
