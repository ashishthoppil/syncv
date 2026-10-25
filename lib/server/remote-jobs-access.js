import { getPlanForUser, getSupabaseAdminClient } from "@/lib/server/subscriptions";

/**
 * How much of Remote Jobs a user gets. The full list comes with a plan that
 * includes it (Remote Jobs or Pro). Everyone else — on the free trial or past
 * it — gets the same short preview, so the board never goes blank. The same
 * rule the dashboard draws, enforced here too, because a screen that merely
 * hides results still answers `curl`.
 */
export const getRemoteJobsAccess = async (userId) => {
  const plan = await getPlanForUser(getSupabaseAdminClient(), userId);
  return { fullList: Boolean(plan?.includesRemoteJobs) };
};
