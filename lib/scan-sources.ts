/**
 * Where a scan was started from, recorded on `scan_usage.source` when the
 * resume is analysed.
 *
 * Shared so the client, the API route and the migration all agree on the exact
 * strings — this is the sort of value that drifts into three spellings if each
 * side hardcodes it.
 */
export const SCAN_SOURCE_MANUAL = "manual";
export const SCAN_SOURCE_REMOTE_JOBS = "remote-jobs";

export const SCAN_SOURCES = [SCAN_SOURCE_MANUAL, SCAN_SOURCE_REMOTE_JOBS] as const;

export type ScanSource = (typeof SCAN_SOURCES)[number];

/**
 * Clamps whatever arrived to a known source.
 *
 * The database column deliberately has no CHECK constraint, because
 * `app/api/analyze` only logs a failed `scan_usage` insert — a rejected row
 * would silently skip quota counting and hand out free scans. Validation lives
 * here instead, where an unexpected value degrades to "manual" rather than
 * breaking the write.
 */
export const normalizeScanSource = (value: unknown): ScanSource => {
  const candidate = String(value || "").trim();
  return (SCAN_SOURCES as readonly string[]).includes(candidate)
    ? (candidate as ScanSource)
    : SCAN_SOURCE_MANUAL;
};
