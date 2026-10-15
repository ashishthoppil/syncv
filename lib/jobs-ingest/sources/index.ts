import type { IngestSource } from "../types";
import { arbeitnowSource } from "./arbeitnow";
import { ashbySource } from "./ashby";
import { greenhouseSource } from "./greenhouse";
import { himalayasSource } from "./himalayas";
import { jobicySource } from "./jobicy";
import { leverSource } from "./lever";
import { recruiteeSource } from "./recruitee";
import { smartRecruitersSource } from "./smartrecruiters";
import { startupJobsSource } from "./startup-jobs";
import { workableSource } from "./workable";
import { workingNomadsSource } from "./working-nomads";

/**
 * Every source the daily cron pulls. Adding one means writing an adapter and
 * listing it here — the cron fans out over this list, and the report email
 * gets a row for it automatically.
 */
export const INGEST_SOURCES: IngestSource[] = [
  jobicySource,
  greenhouseSource,
  ashbySource,
  leverSource,
  workableSource,
  smartRecruitersSource,
  recruiteeSource,
  arbeitnowSource,
  workingNomadsSource,
  himalayasSource,
  startupJobsSource,
];

export const getIngestSource = (id: string) =>
  INGEST_SOURCES.find((source) => source.id === id) || null;
