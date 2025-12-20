import { redirect } from "next/navigation";

export default function JobTrackerPage() {
  redirect("/scan?section=job-tracker");
}
