import SolutionPage from "@/components/marketing/solution-page";
import { SOLUTIONS } from "@/lib/content/solutions";
import { buildMetadata } from "@/lib/seo/metadata";

const solution = SOLUTIONS.resumeTailor;

export const metadata = buildMetadata({
  title: solution.title,
  description: solution.description,
  path: solution.path,
});

export default function Page() {
  return <SolutionPage solution={solution} />;
}
