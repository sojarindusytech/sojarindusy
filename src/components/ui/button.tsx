import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#024AE5] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer select-none active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-[#024AE5] text-white shadow-sm hover:bg-[#013bb8] hover:shadow-md",
        primary:
          "bg-[#024AE5] text-white shadow-sm hover:bg-[#013bb8] hover:shadow-md",
        green:
          "bg-[#3C8B4F] text-white shadow-sm hover:bg-[#317240] hover:shadow-md",
        destructive:
          "bg-red-600 text-white shadow-sm hover:bg-red-700",
        outline:
          "border border-slate-200 bg-white text-slate-800 shadow-xs hover:border-[#024AE5] hover:text-[#024AE5] hover:bg-blue-50/50",
        "outline-green":
          "border border-[#3C8B4F]/40 bg-white text-[#3C8B4F] shadow-xs hover:border-[#3C8B4F] hover:bg-emerald-50/50",
        secondary:
          "bg-slate-100 text-slate-900 shadow-xs hover:bg-slate-200",
        ghost:
          "hover:bg-slate-100 text-slate-700 hover:text-slate-900",
        link: "text-[#024AE5] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 text-sm",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-8 text-base font-semibold",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
