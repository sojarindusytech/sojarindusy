import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

/** Page heading with the module icon on its left. The text matches the sidebar item. */
export function PageTitle({
  icon: Icon,
  children,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h1 className={cn("flex items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900", className)}>
      <Icon className="h-6 w-6 shrink-0 text-[#024AE5]" />
      <span>{children}</span>
    </h1>
  );
}
