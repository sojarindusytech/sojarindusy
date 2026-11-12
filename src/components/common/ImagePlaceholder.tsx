import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Fills its (relative) parent with a centered icon tile when a card has no image. */
export function ImagePlaceholder({ icon: Icon, label, className }: { icon: LucideIcon; label: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "absolute inset-0 flex items-center justify-center bg-linear-to-br from-slate-50 via-white to-blue-50/60",
        className
      )}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-100 bg-white text-[#024AE5]/60 shadow-sm transition-colors group-hover:text-[#024AE5]">
          <Icon className="h-8 w-8" strokeWidth={1.5} />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      </div>
    </div>
  );
}
