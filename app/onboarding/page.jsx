"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Loader2, FileUp, UserRoundPen } from "lucide-react";

export default function OnboardingPage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const ensureSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      setLoading(false);
    };

    ensureSession();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-slate-900">
            Complete your profile
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Choose one path to set contact details for optimized resumes.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 inline-flex rounded-2xl bg-slate-100 p-3 text-slate-700">
              <FileUp className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900">
              Upload Base Resume
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Upload once and we’ll extract your phone, email, LinkedIn, portfolio, GitHub, Behance, and other links into your profile.
            </p>
            <Button
              className="mt-6 w-full rounded-full"
              onClick={() => router.push("/scan?section=profile")}
            >
              Continue with Upload
            </Button>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 inline-flex rounded-2xl bg-slate-100 p-3 text-slate-700">
              <UserRoundPen className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900">
              Fill Profile Form
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Enter contact details manually and update them anytime from the Profile section.
            </p>
            <Button
              variant="outline"
              className="mt-6 w-full rounded-full"
              onClick={() => router.push("/scan?section=profile")}
            >
              Continue with Form
            </Button>
          </section>
        </div>
      </div>
    </main>
  );
}
