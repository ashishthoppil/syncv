import StaticContentPage from "@/components/marketing/static-page";
import { CONTACT } from "@/lib/content/pages";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: CONTACT.title,
  description: CONTACT.description,
  path: CONTACT.path,
});

export default function Page() {
  return <StaticContentPage page={CONTACT} />;
}
