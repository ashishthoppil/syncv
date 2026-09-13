import StaticContentPage from "@/components/marketing/static-page";
import { ABOUT } from "@/lib/content/pages";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: ABOUT.title,
  description: ABOUT.description,
  path: ABOUT.path,
});

export default function Page() {
  return <StaticContentPage page={ABOUT} />;
}
