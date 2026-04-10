"use client";

import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Logo } from "../../components/navbar/logo";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success("Welcome back!");
    setLoading(false);
    router.push("/scan");
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/scan`,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        toast.error(error.message);
        setGoogleLoading(false);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      toast.error("Unable to start Google sign-in. Please try again.");
      setGoogleLoading(false);
    } catch (err) {
      toast.error("Failed to sign in with Google");
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setResetEmailSent(true);
    toast.success("Password reset email sent! Check your inbox.");
    setLoading(false);
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 pt-32 pb-10 flex justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="flex flex-col items-center gap-3 text-center">
            <Logo />
            <div>
              <h1 className="text-2xl font-semibold">Log in to SynCV</h1>
              <p className="text-sm text-muted-foreground">
                Welcome back! Please enter your details.
              </p>
            </div>
          </div>

          {forgotPasswordMode ? (
            <form onSubmit={handleForgotPassword} className="mt-8 space-y-5">
              {resetEmailSent ? (
                <div className="space-y-4 text-center">
                  <div className="rounded-2xl bg-emerald-50 p-4">
                    <p className="text-sm text-emerald-800">
                      Password reset email sent! Please check your inbox and follow the instructions to reset your password.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-full"
                    onClick={() => {
                      setForgotPasswordMode(false);
                      setResetEmailSent(false);
                      setEmail("");
                    }}
                  >
                    Back to login
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2 text-left">
                    <label className="text-sm font-medium text-slate-600">
                      Email address
                    </label>
                    <Input
                      type="email"
                      inputMode="email"
                      name="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <p className="text-xs text-slate-500">
                      Enter your email address and we'll send you a link to reset your password.
                    </p>
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
                    {loading ? "Sending..." : "Send reset link"}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-full"
                    onClick={() => setForgotPasswordMode(false)}
                    disabled={loading}
                  >
                    Back to login
                  </Button>
                </>
              )}
            </form>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="mt-8 w-full rounded-full"
                onClick={handleGoogleLogin}
                disabled={loading || googleLoading}
              >
                {googleLoading ? (
                  "Connecting..."
                ) : (
                  <>
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Sign in with Google
                  </>
                )}
              </Button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-500">Or continue with</span>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2 text-left">
                  <label className="text-sm font-medium text-slate-600">
                    Email address
                  </label>
                  <Input
                    type="email"
                    inputMode="email"
                    name="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2 text-left">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-600">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setForgotPasswordMode(true)}
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                  disabled={loading || googleLoading}
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link className="font-semibold text-primary" href="/sign-up">
              Sign up
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
