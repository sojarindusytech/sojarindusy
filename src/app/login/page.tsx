"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInUser } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signInUser(email, password);

      if (res.error) {
        setError(res.error);
      } else if (res.redirectUrl) {
        router.push(res.redirectUrl);
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
    <Card className="w-full max-w-md border-slate-200 bg-white shadow-xl">
      <CardHeader className="space-y-2 border-b border-slate-100 bg-slate-50/70 p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#024AE5] text-white shadow-sm">
          <Lock className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
          Sign In to Sojar Indusy
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm text-slate-500">
          Access your B2B Ecommerce Orders or Platform Owner Dashboard.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 p-6 sm:p-8 bg-white">
          {registered && (
            <div className="flex items-start gap-2.5 rounded-lg border border-[#3C8B4F]/30 bg-[#3C8B4F]/10 p-3 text-xs text-[#3C8B4F]">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#3C8B4F]" />
              <p>Registration complete! Please enter your credentials to log in.</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-50 p-3 text-xs text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <p>{error}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Official Email ID</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-800 mb-1">
              Role-Based Landing:
            </p>
            <ul className="list-disc list-inside space-y-0.5 text-[11px]">
              <li><strong>Platform Owner:</strong> Directs to Admin Platform Dashboard</li>
              <li><strong>Customer / B2B Buyer:</strong> Directs to Ecommerce Orders Dashboard</li>
            </ul>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 border-t border-slate-100 bg-slate-50/70 p-6">
          <Button
            type="submit"
            size="lg"
            variant="primary"
            disabled={loading}
            className="w-full gap-2"
          >
            {loading ? (
              "Authenticating..."
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          <p className="text-center text-xs text-slate-500">
            Don&apos;t have a business account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-[#024AE5] hover:underline"
            >
              Register your Company
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="container mx-auto flex min-h-[calc(100vh-140px)] items-center justify-center px-4 py-12 bg-white">
      <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Loading sign in...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
