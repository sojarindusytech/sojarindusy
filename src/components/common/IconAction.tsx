import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const TONES = {
  default: "text-slate-500 hover:text-slate-900",
  primary: "text-slate-500 hover:text-[#024AE5]",
  success: "text-emerald-600 hover:text-emerald-700",
  danger: "text-slate-500 hover:text-red-600",
} as const;

type BaseProps = {
  /** Shown as the tooltip and read by screen readers: the button has no visible text. */
  label: string;
  tone?: keyof typeof TONES;
  className?: string;
  children: React.ReactNode;
};

type ButtonProps = BaseProps & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className"> & { href?: undefined };
type LinkProps = BaseProps & { href: string; target?: string; rel?: string; onClick?: React.MouseEventHandler<HTMLAnchorElement> };

/**
 * Icon-only row action for tables: no background, no border, only the icon changes colour.
 * Pass `href` for navigation / downloads, otherwise it is a button.
 */
export function IconAction(props: ButtonProps | LinkProps) {
  const { label, tone = "default", className, children } = props;
  const cls = cn(
    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-transparent p-0 cursor-pointer transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#024AE5]/40 disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:h-4 [&_svg]:w-4",
    TONES[tone],
    className
  );

  if (props.href !== undefined) {
    const { href, target, rel, onClick } = props;
    return (
      <Link href={href} target={target} rel={rel ?? (target === "_blank" ? "noopener noreferrer" : undefined)} onClick={onClick} title={label} aria-label={label} className={cls}>
        {children}
      </Link>
    );
  }

  const { label: _l, tone: _t, className: _c, children: _ch, href: _h, type, ...rest } = props;
  void _l; void _t; void _c; void _ch; void _h;
  return (
    <button type={type ?? "button"} title={label} aria-label={label} className={cls} {...rest}>
      {children}
    </button>
  );
}
