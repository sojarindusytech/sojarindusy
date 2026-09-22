"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { KeyRound, AlertCircle, CheckCircle2, ArrowRight, ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const validation = forgotPasswordSchema.safeParse({ email });
    if (!validation.success) {
      setError(validation.error.issues[0]?.message || "Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const res = await sendPasswordResetEmail(email);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(
          res.message ||
            "If an account exists with this email, a password recovery link has been sent. Please check your inbox and spam folders."
        );
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred while requesting password reset."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-slate-50/70 px-4 py-12">
      <Card className="w-full max-w-md border border-slate-200 bg-white shadow-none rounded-2xl">
        <CardHeader className="space-y-3 bg-white p-6 pb-2 text-center border-0">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#024AE5] text-white">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
              Forgot Password
            </CardTitle>
            <p className="mt-1.5 text-xs text-slate-500">
              Enter your registered official email and we will send you a secure link to reset your password.
            </p>
          </div>
        </CardHeader>

        {success ? (
          <div className="p-6 pt-4 space-y-5">
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs text-emerald-900">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-emerald-950">Password Reset Link Sent</p>
                <p className="text-emerald-800 leading-relaxed">{success}</p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-600 flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400 shrink-0" />
              <span>
                Target email: <strong className="text-slate-800 font-mono">{email}</strong>
              </span>
            </div>

            <div className="pt-2">
              <Link href="/login" className="w-full block">
                <Button variant="outline" className="w-full h-10 text-xs border-slate-200 gap-1.5">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Return to Sign In</span>
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 p-6 pt-2 bg-white">
              {error && (
                <div className="flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-50 p-3 text-xs text-red-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                  Official Email Address *
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="e.g. name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="h-10 text-xs border-slate-200"
                />
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3.5 bg-white p-6 pt-2 border-0">
              <Button
                type="submit"
                size="lg"
                variant="primary"
                disabled={loading}
                className="w-full gap-2 text-xs h-10 font-semibold"
              >
                {loading ? (
                  "Dispatching Reset Link..."
                ) : (
                  <>
                    <span>Send Reset Link</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <div className="text-center pt-1">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
