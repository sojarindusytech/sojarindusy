"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInUser } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { loginSchema } from "@/lib/validations/auth";
import { Lock, AlertCircle, CheckCircle2, ArrowRight, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");
  const redirectTo = searchParams.get("redirect");
  const resetSuccess = searchParams.get("reset") === "success";
  const verifiedSuccess = searchParams.get("verified") === "true";
  const callbackError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUnconfirmed, setIsUnconfirmed] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const handleResendVerification = async () => {
    if (!email) return;
    setResendingEmail(true);
    setResendMessage(null);
    try {
      const { resendVerificationEmail } = await import("@/actions/auth");
      const res = await resendVerificationEmail(email);
      if (res.error) {
        setError(res.error);
      } else {
        setResendMessage("Verification email resent! Please check your inbox and spam folder.");
      }
    } catch {
      setError("Failed to resend confirmation email. Please try again later.");
    } finally {
      setResendingEmail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsUnconfirmed(false);
    setResendMessage(null);

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setError(result.error.issues[0]?.message || "Invalid email or password format.");
      return;
    }

    setLoading(true);

    try {
      const res = await signInUser(email, password);

      if (res.error) {
        setError(res.error);
        if (res.isEmailUnconfirmed) {
          setIsUnconfirmed(true);
        }
      } else {
        if (redirectTo) {
          router.push(redirectTo);
        } else if (res.redirectUrl) {
          router.push(res.redirectUrl);
        }
        router.refresh();
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred during sign-in."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border border-slate-200 bg-white shadow-none rounded-2xl">
      <CardHeader className="space-y-3 bg-white p-6 pb-2 text-center border-0">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#024AE5] text-white">
          <Lock className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
          Sign In
        </CardTitle>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 p-6 pt-2 bg-white">
          {resetSuccess && (
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <p>Your password has been reset successfully! Please sign in with your new password.</p>
            </div>
          )}

          {verifiedSuccess && (
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <p>Email verified successfully! Your account is undergoing administrator approval.</p>
            </div>
          )}

          {registered && (
            <div className="flex items-start gap-2.5 rounded-lg border border-[#3C8B4F]/30 bg-[#3C8B4F]/10 p-3 text-xs text-[#3C8B4F]">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#3C8B4F] mt-0.5" />
              <p>Registration complete! Please enter your credentials to log in.</p>
            </div>
          )}

          {callbackError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <p>The authorization link was invalid or has expired. Please try again or request a new link.</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-50 p-3 text-xs text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
              <div className="space-y-1.5 flex-1">
                <p>{error}</p>
                {isUnconfirmed && (
                  <div className="pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleResendVerification}
                      disabled={resendingEmail}
                      className="h-7 text-[11px] border-red-200 text-red-700 hover:bg-red-100"
                    >
                      {resendingEmail ? "Resending..." : "Resend Verification Email"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {resendMessage && (
            <div className="flex items-start gap-2.5 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
              <p>{resendMessage}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 text-xs border-slate-200"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                Password
              </Label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-[#024AE5] hover:underline"
              >
                Forgot Password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10 h-10 text-xs border-slate-200"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 transition-colors p-1 cursor-pointer focus:outline-none z-10"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 bg-white p-6 pt-2 border-0">
          <Button
            type="submit"
            size="lg"
            variant="primary"
            disabled={loading}
            className="w-full gap-2 text-xs h-10 font-semibold"
          >
            {loading ? (
              "Signing In..."
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          <p className="text-center text-xs text-slate-500">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-[#024AE5] hover:underline"
            >
              Sign Up
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-slate-50/70 px-4 py-12">
      <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Loading sign in...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
