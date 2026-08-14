import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#024AE5] text-white shadow-xs",
        primary:
          "border-transparent bg-[#024AE5] text-white shadow-xs",
        green:
          "border-transparent bg-[#3C8B4F] text-white shadow-xs",
        success:
          "border-[#3C8B4F]/30 bg-[#3C8B4F]/10 text-[#3C8B4F]",
        blue:
          "border-[#024AE5]/30 bg-[#024AE5]/10 text-[#024AE5]",
        secondary:
          "border-transparent bg-slate-100 text-slate-800 hover:bg-slate-200",
        warning:
          "border-amber-500/30 bg-amber-500/10 text-amber-800",
        destructive:
          "border-red-500/30 bg-red-500/10 text-red-800",
        outline: "text-slate-800 border-slate-200 bg-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
