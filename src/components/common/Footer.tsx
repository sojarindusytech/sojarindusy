import { GithubIcon } from "@/components/common/Icons";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/50 py-8">
      <div className="container mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span>&copy; {new Date().getFullYear()} Sojar Indusy. Built with Next.js, Tailwind CSS & Supabase.</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
          <a
            href="https://github.com/sojarindusytech/sojarindusy"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <GithubIcon className="h-4 w-4" />
            <span>Repository</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
