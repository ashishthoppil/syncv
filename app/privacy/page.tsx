import StaticContentPage from "@/components/marketing/static-page";
import { PRIVACY } from "@/lib/content/pages";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: PRIVACY.title,
  description: PRIVACY.description,
  path: PRIVACY.path,
});

export default function Page() {
  return <StaticContentPage page={PRIVACY} />;
}
