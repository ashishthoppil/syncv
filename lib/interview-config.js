// Shared by the interview routes and the dashboard, so the limit the server
// enforces is the one the page counts down.

/**
 * Mock interviews per tracked job. Every interview that starts counts, whether
 * or not it is finished: the questions and the interviewer's voice are paid for
 * the moment it begins. An interview that fails to start is never saved, so it
 * doesn't count.
 */
export const MOCK_ATTEMPTS_PER_JOB = 3;
