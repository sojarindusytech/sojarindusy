"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, RefreshCw, Database, KeyRound, ShieldAlert, Sparkles } from "lucide-react";

export function SupabaseStatusCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
  } | null>(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const isUrlSet = Boolean(
    supabaseUrl && !supabaseUrl.includes("your-project-ref")
  );

  const handleTestConnection = async () => {
    setLoading(true);
    setResult(null);

    try {
      if (!isUrlSet) {
        setResult({
          tested: true,
          success: false,
          message:
            "Supabase URL is still using placeholder value in .env.local. Update NEXT_PUBLIC_SUPABASE_URL with your project URL.",
        });
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.getSession();

      if (error) {
        setResult({
          tested: true,
          success: false,
          message: `Connection attempt returned: ${error.message}`,
        });
      } else {
        setResult({
          tested: true,
          success: true,
          message: "Supabase client successfully initialized and contacted the API!",
        });
      }
    } catch (err: unknown) {
      const errMessage =
        err instanceof Error ? err.message : "Unknown connection error occurred";
      setResult({
        tested: true,
        success: false,
        message: errMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden border-slate-200/80 shadow-lg dark:border-slate-800">
      <CardHeader className="bg-gradient-to-r from-emerald-500/10 via-blue-500/5 to-transparent pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-600 text-white">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Supabase Client Suite</CardTitle>
              <CardDescription>SSR & Browser Client Status</CardDescription>
            </div>
          </div>
          {isUrlSet ? (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="h-3 w-3" /> Ready
            </Badge>
          ) : (
            <Badge variant="warning" className="gap-1">
              <AlertCircle className="h-3 w-3" /> Credentials Needed
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        <div className="grid gap-2 text-xs sm:text-sm">
          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-slate-500" />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                NEXT_PUBLIC_SUPABASE_URL
              </span>
            </div>
            <code className="text-xs text-slate-500 max-w-[200px] truncate sm:max-w-none">
              {isUrlSet ? supabaseUrl : "Placeholder in .env.local"}
            </code>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-slate-500" />
              <span className="font-medium text-slate-700 dark:text-slate-300">
                Architecture
              </span>
            </div>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              @supabase/ssr + App Router
            </span>
          </div>
        </div>

        {result && (
          <div
            className={`rounded-lg border p-3 text-xs leading-relaxed ${
              result.success
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-300"
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold mb-1">
              {result.success ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-600" />
              )}
              {result.success ? "Success" : "Notice"}
            </div>
            <p>{result.message}</p>
          </div>
        )}
      </CardContent>

      <CardFooter className="border-t border-slate-100 bg-slate-50/30 dark:border-slate-800 dark:bg-slate-900/30 flex justify-between gap-2 py-3">
        <p className="text-xs text-slate-500">
          Edit <code className="text-slate-700 dark:text-slate-300">.env.local</code> to configure.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={handleTestConnection}
          disabled={loading}
          className="gap-1.5"
        >
          {loading ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
          )}
          {loading ? "Testing..." : "Test Connection"}
        </Button>
      </CardFooter>
    </Card>
  );
}
