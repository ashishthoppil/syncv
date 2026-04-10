"use client";

import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Logo } from "../../components/navbar/logo";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const router = useRouter();

  useEffect(() => {
    // Check if user has a valid session from the reset link
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        toast.error("Invalid or expired reset link. Please request a new one.");
        router.push("/login");
      }
    });
  }, [router]);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");

    if (!password || !confirmPassword) {
      setError("Please enter and confirm your new password.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      setError(error.message);
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    toast.success("Password updated successfully!");
    setLoading(false);

    setTimeout(() => {
      router.push("/login");
    }, 2000);
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 pt-32 pb-10 flex justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="flex flex-col items-center gap-3 text-center">
            <Logo />
            <div>
              <h1 className="text-2xl font-semibold">Reset your password</h1>
              <p className="text-sm text-muted-foreground">
                Enter your new password below.
              </p>
            </div>
          </div>

          {success ? (
            <div className="mt-8 space-y-4 text-center">
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="text-sm text-emerald-800">
                  Password updated successfully! Redirecting to login...
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="mt-8 space-y-5">
              <div className="space-y-2 text-left">
                <label className="text-sm font-medium text-slate-600">
                  New password
                </label>
                <Input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2 text-left">
                <label className="text-sm font-medium text-slate-600">
                  Confirm new password
                </label>
                <Input
                  type="password"
                  name="confirmPassword"
                  autoComplete="new-password"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full rounded-full"
                disabled={loading}
              >
                {loading ? "Updating..." : "Update password"}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link className="font-semibold text-primary" href="/login">
              Log in
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
