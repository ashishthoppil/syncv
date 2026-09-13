import { buildMetadata } from "@/lib/seo/metadata";

/**
 * noindex. A bare sign-in form has no informational value in a search result,
 * and leaving it indexable meant it competed with the homepage for brand
 * queries. It stays crawlable (follow) so the directive is actually read and
 * so link equity still flows out of it.
 */
export const metadata = buildMetadata({
  title: "Log In",
  description:
    "Log in to SynCV to access your base resume, tailored resumes, scans and job tracker.",
  path: "/login",
  noIndex: true,
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
