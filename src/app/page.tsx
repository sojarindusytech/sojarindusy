import { SupabaseStatusCard } from "@/components/features/supabase/SupabaseStatusCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Zap,
  Layers,
  Database,
  Code2,
  FolderTree,
  ShieldCheck,
  ArrowRight,
  GitBranch,
  CheckCircle,
  Terminal,
} from "lucide-react";

export default function Home() {
  const architecturalPillars = [
    {
      icon: <Zap className="h-5 w-5 text-amber-500" />,
      title: "Turbopack Bundler",
      badge: "Fast HMR",
      description: "Powered by Next.js Turbopack for ultra-fast local compilation and instantaneous hot module replacement.",
    },
    {
      icon: <Layers className="h-5 w-5 text-blue-500" />,
      title: "Tailwind & shadcn/ui",
      badge: "Design System",
      description: "Centralized component primitives in src/components/ui/ using Tailwind CSS and Radix UI primitives.",
    },
    {
      icon: <Database className="h-5 w-5 text-emerald-500" />,
      title: "Supabase SSR Suite",
      badge: "Full-Stack Auth",
      description: "Complete browser, server, and middleware client wrappers with secure cookie session refresh.",
    },
    {
      icon: <FolderTree className="h-5 w-5 text-purple-500" />,
      title: "Centralized Architecture",
      badge: "Clean Code",
      description: "Strict separation between UI primitives, common components, feature modules, and shared utilities.",
    },
  ];

  const quickStartSteps = [
    {
      step: "01",
      title: "Configure Supabase Keys",
      description: "Copy your Project URL and Anon Key into .env.local to link your Supabase database.",
      command: "cp .env.example .env.local",
    },
    {
      step: "02",
      title: "Run Turbopack Dev Server",
      description: "Start the lightning-fast development server with turbopack enabled.",
      command: "npm run dev",
    },
    {
      step: "03",
      title: "Push to GitHub Remote",
      description: "Repository is initialized and connected to origin main branch.",
      command: "git push -u origin main",
    },
  ];

  return (
    <div className="relative isolate overflow-hidden">
      {/* Background Decorative Gradients */}
      <div
        className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80 pointer-events-none"
        aria-hidden="true"
      >
        <div
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-blue-600 to-indigo-400 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
        />
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        {/* Hero Section */}
        <div className="flex flex-col items-center text-center space-y-4 max-w-3xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge variant="outline" className="gap-1.5 py-1 px-3 bg-white/80 dark:bg-slate-900/80 shadow-sm border-blue-200 dark:border-blue-900">
              <SparkleIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              Next.js 16 + Turbopack
            </Badge>
            <Badge variant="secondary" className="gap-1 py-1 px-3">
              <GitBranch className="h-3.5 w-3.5 text-slate-500" />
              sojarindusytech/sojarindusy
            </Badge>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-slate-900 dark:text-white">
            Sojar Indusy <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Platform</span>
          </h1>

          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            Enterprise foundation engineered with Next.js App Router, Tailwind CSS design system, shadcn/ui components, and Supabase SSR integration.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href="https://github.com/sojarindusytech/sojarindusy"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="lg" className="gap-2 shadow-lg shadow-blue-600/25">
                GitHub Repository
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
            <a href="#quickstart">
              <Button size="lg" variant="outline" className="gap-2">
                Quickstart Guide
              </Button>
            </a>
          </div>
        </div>

        {/* Status Dashboard & Key Metrics */}
        <div className="mt-14 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {architecturalPillars.map((item, index) => (
                <Card key={index} className="transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                        {item.icon}
                      </div>
                      <Badge variant="secondary" className="text-[11px] font-normal">
                        {item.badge}
                      </Badge>
                    </div>
                    <CardTitle className="text-sm font-semibold pt-2">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-1">
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Architecture Directory Tree Overview */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-blue-600" />
                  <CardTitle className="text-sm font-semibold">Centralized Directory Structure</CardTitle>
                </div>
                <CardDescription>Standards enforced via workspace rules</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-xs font-mono bg-slate-950 text-slate-200 rounded-lg m-4 mt-0 p-4 border border-slate-800">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>src/components/ui/ &rarr; Basic shadcn/ui primitives</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>src/components/common/ &rarr; Shared layout & widgets</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>src/lib/supabase/ &rarr; Client, Server, Admin & Middleware</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>src/lib/utils.ts &rarr; Centralized cn() helper</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Supabase Status Live Card */}
          <div className="lg:col-span-5">
            <SupabaseStatusCard />
          </div>
        </div>

        {/* Quickstart Section */}
        <div id="quickstart" className="mt-16 pt-8 border-t border-slate-200 dark:border-slate-800">
          <div className="text-center max-w-xl mx-auto mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Next Steps & Deployment
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Follow these simple commands to develop and sync your changes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {quickStartSteps.map((step, idx) => (
              <Card key={idx} className="relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 text-2xl font-black text-slate-200/50 dark:text-slate-800/50 select-none">
                  {step.step}
                </div>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">{step.title}</CardTitle>
                  <CardDescription className="text-xs">{step.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-xs font-mono text-slate-100">
                    <Terminal className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <span className="truncate">{step.command}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}
