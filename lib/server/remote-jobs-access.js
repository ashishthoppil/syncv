import {
  countFreeTrialScans,
  FREE_TRIAL_SCAN_LIMIT,
  getPlanForUser,
  getSupabaseAdminClient,
} from "@/lib/server/subscriptions";

/**
 * Who may use Remote Jobs. The full list comes with a plan that includes it
 * (Remote Jobs or Pro). Without one, browsing the preview needs free-trial
 * scans left, since a job you can't scan is a dead end. The same conditions
 * the dashboard uses to draw the locks — enforced here too, because a screen
 * that merely hides the search still answers `curl`.
 */
export const getRemoteJobsAccess = async (userId) => {
  const supabase = getSupabaseAdminClient();
  const plan = await getPlanForUser(supabase, userId);
  if (plan?.includesRemoteJobs) return { canBrowse: true, fullList: true };
  const used = await countFreeTrialScans(supabase, userId);
  return { canBrowse: used < FREE_TRIAL_SCAN_LIMIT, fullList: false };
};
