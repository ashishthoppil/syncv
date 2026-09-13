import StaticContentPage from "@/components/marketing/static-page";
import { REFUND_POLICY } from "@/lib/content/pages";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: REFUND_POLICY.title,
  description: REFUND_POLICY.description,
  path: REFUND_POLICY.path,
});

export default function Page() {
  return <StaticContentPage page={REFUND_POLICY} />;
}
