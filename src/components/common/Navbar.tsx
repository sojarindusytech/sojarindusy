import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Layers, ExternalLink, Zap } from "lucide-react";
import { GithubIcon } from "@/components/common/Icons";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/80">
      <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
            <Layers className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Sojar Indusy
            </span>
            <Badge variant="secondary" className="gap-1 text-[11px] font-normal">
              <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
              Turbopack
            </Badge>
          </div>
        </div>

        <nav className="flex items-center gap-4">
          <a
            href="https://github.com/sojarindusytech/sojarindusy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <GithubIcon className="h-4 w-4" />
            <span className="hidden sm:inline">GitHub</span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        </nav>
      </div>
    </header>
  );
}
