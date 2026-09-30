// Shared by the interview routes and the dashboard, so the limit the server
// enforces is the one the page counts down.

/**
 * Mock interviews per tracked job. Every interview that starts counts, whether
 * or not it is finished: the questions and the interviewer's voice are paid for
 * the moment it begins. An interview that fails to start is never saved, so it
 * doesn't count.
 */
export const MOCK_ATTEMPTS_PER_JOB = 3;

/**
 * What the free plan's trial includes: a prep guide for this many jobs and
 * this many mock interviews, each counted once across everything the account
 * has ever scanned (not per job). Enough to try both on the one job a free
 * scan produces; a paid plan has prep for every job and MOCK_ATTEMPTS_PER_JOB
 * interviews per job.
 */
export const FREE_TRIAL_INTERVIEW_PREPS = 1;
export const FREE_TRIAL_MOCK_INTERVIEWS = 1;
