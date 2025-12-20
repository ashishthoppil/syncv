"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "react-toastify";
import { Loader2 } from "lucide-react";

const Loading = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="text-center">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-500" />
      <p className="mt-4 text-sm text-slate-600">Completing sign in...</p>
    </div>
  </div>
);

const AuthCallbackContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const next = searchParams.get("next") || "/scan";

      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            toast.error("Authentication failed. Please try again.");
            router.push("/login");
            return;
          }

          toast.success("Successfully signed in!");
          router.push(next);
        } catch (err) {
          console.error("Error during OAuth callback:", err);
          toast.error("An error occurred during authentication.");
          router.push("/login");
        }
      } else {
        router.push("/login");
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return <Loading />;
};

export default function AuthCallback() {
  return (
    <Suspense fallback={<Loading />}>
      <AuthCallbackContent />
    </Suspense>
  );
}
