"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateUserPassword } from "@/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { resetPasswordSchema } from "@/lib/validations/auth";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Check,
  ShieldCheck,
} from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionChecking, setSessionChecking] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // Check if session exists from SSR cookie exchange
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setHasValidSession(true);
          setSessionChecking(false);
          return;
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setHasValidSession(true);
          setSessionChecking(false);
          return;
        }
      } catch {
        // Continue to auth state change listener
      }

      // Check onAuthStateChange for PASSWORD_RECOVERY or SIGNED_IN event
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY" || session) {
          setHasValidSession(true);
        }
        setSessionChecking(false);
      });

      // Timeout fallback in case no session exists
      const timer = setTimeout(() => {
        setSessionChecking(false);
      }, 1500);

      return () => {
        subscription.unsubscribe();
        clearTimeout(timer);
      };
    };

    checkSession();
  }, []);

  // Real-time password criteria
  const passwordChecks = {
    length: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    matches: password.length > 0 && password === confirmPassword,
  };

  const isFormValid =
    passwordChecks.length &&
    passwordChecks.hasUpper &&
    passwordChecks.hasLower &&
    passwordChecks.hasNumber &&
    passwordChecks.hasSpecial &&
    passwordChecks.matches;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = resetPasswordSchema.safeParse({
      password,
      confirm_password: confirmPassword,
    });

    if (!validation.success) {
      setError(validation.error.issues[0]?.message || "Please satisfy all password requirements.");
      return;
    }

    setLoading(true);

    try {
      const res = await updateUserPassword(password, confirmPassword);
      if (res.error) {
        setError(res.error);
        setLoading(false);
      } else {
        router.push("/login?reset=success");
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred while resetting your password."
      );
      setLoading(false);
    }
  };

  if (sessionChecking) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-slate-50/70 px-4 py-12">
        <div className="text-center space-y-3">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#024AE5] border-t-transparent" />
          <p className="text-xs text-slate-500 font-medium">Verifying reset authorization link...</p>
        </div>
      </div>
    );
  }

  if (!hasValidSession) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-slate-50/70 px-4 py-12">
        <Card className="w-full max-w-md border border-slate-200 bg-white shadow-none rounded-2xl p-6 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Recovery Link Invalid or Expired</h2>
            <p className="mt-2 text-xs text-slate-500 leading-relaxed">
              This password reset link is invalid or has already expired. Password recovery links can only be used once for security.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2.5">
            <Link href="/forgot-password">
              <Button variant="primary" className="w-full text-xs h-10">
                Request a New Reset Link
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" className="w-full text-xs h-10 border-slate-200">
                Return to Sign In
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-slate-50/70 px-4 py-12">
      <Card className="w-full max-w-md border border-slate-200 bg-white shadow-none rounded-2xl">
        <CardHeader className="space-y-3 bg-white p-6 pb-2 text-center border-0">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#024AE5] text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
              Set New Password
            </CardTitle>
            <p className="mt-1.5 text-xs text-slate-500">
              Create a new secure password for your Sojar Indusy enterprise account.
            </p>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 p-6 pt-2 bg-white">
            {error && (
              <div className="flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-50 p-3 text-xs text-red-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {/* New Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                New Password *
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter strong password"
                  autoComplete="new-password"
                  required
                  className="pr-10 h-10 text-xs border-slate-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 focus:outline-none"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirm_password" className="text-xs font-semibold text-slate-700">
                Confirm New Password *
              </Label>
              <div className="relative">
                <Input
                  id="confirm_password"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  required
                  className="pr-10 h-10 text-xs border-slate-200"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 focus:outline-none"
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Live Password Rules Checklist */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
              <p className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                Security Requirements
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                <div
                  className={`flex items-center gap-1.5 ${
                    passwordChecks.length ? "text-emerald-700 font-medium" : "text-slate-500"
                  }`}
                >
                  <Check
                    className={`h-3 w-3 ${
                      passwordChecks.length ? "text-emerald-600 font-bold" : "text-slate-300"
                    }`}
                  />
                  <span>8+ characters</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 ${
                    passwordChecks.hasUpper ? "text-emerald-700 font-medium" : "text-slate-500"
                  }`}
                >
                  <Check
                    className={`h-3 w-3 ${
                      passwordChecks.hasUpper ? "text-emerald-600 font-bold" : "text-slate-300"
                    }`}
                  />
                  <span>Uppercase (A-Z)</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 ${
                    passwordChecks.hasLower ? "text-emerald-700 font-medium" : "text-slate-500"
                  }`}
                >
                  <Check
                    className={`h-3 w-3 ${
                      passwordChecks.hasLower ? "text-emerald-600 font-bold" : "text-slate-300"
                    }`}
                  />
                  <span>Lowercase (a-z)</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 ${
                    passwordChecks.hasNumber ? "text-emerald-700 font-medium" : "text-slate-500"
                  }`}
                >
                  <Check
                    className={`h-3 w-3 ${
                      passwordChecks.hasNumber ? "text-emerald-600 font-bold" : "text-slate-300"
                    }`}
                  />
                  <span>Number (0-9)</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 sm:col-span-2 ${
                    passwordChecks.hasSpecial ? "text-emerald-700 font-medium" : "text-slate-500"
                  }`}
                >
                  <Check
                    className={`h-3 w-3 ${
                      passwordChecks.hasSpecial ? "text-emerald-600 font-bold" : "text-slate-300"
                    }`}
                  />
                  <span>Special character (!@#$%^&*)</span>
                </div>
                <div
                  className={`flex items-center gap-1.5 sm:col-span-2 ${
                    passwordChecks.matches ? "text-emerald-700 font-medium" : "text-slate-500"
                  }`}
                >
                  <Check
                    className={`h-3 w-3 ${
                      passwordChecks.matches ? "text-emerald-600 font-bold" : "text-slate-300"
                    }`}
                  />
                  <span>Passwords match</span>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3.5 bg-white p-6 pt-2 border-0">
            <Button
              type="submit"
              size="lg"
              variant="primary"
              disabled={loading || !isFormValid}
              className="w-full gap-2 text-xs h-10 font-semibold"
            >
              {loading ? (
                "Updating Password..."
              ) : (
                <>
                  <span>Save New Password & Sign In</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
