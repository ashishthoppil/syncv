import StaticContentPage from "@/components/marketing/static-page";
import { TERMS } from "@/lib/content/pages";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: TERMS.title,
  description: TERMS.description,
  path: TERMS.path,
});

export default function Page() {
  return <StaticContentPage page={TERMS} />;
}
