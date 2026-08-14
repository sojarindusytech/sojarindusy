"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layers, LogIn, UserPlus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "Products", href: "/products" },
    { name: "About Us", href: "/about" },
  ];

  const isDashboard = pathname.startsWith("/dashboard") || pathname.startsWith("/admin");

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-90">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#024AE5] to-[#3C8B4F] text-white">
            <Layers className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
              Sojar Indusy
            </span>
            <span className="text-[10px] text-slate-400 font-medium tracking-wider uppercase">
              Industrial Manufacturing
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                className={cn(
                  "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-50 text-[#024AE5] font-semibold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                {link.name}
              </Link>
            );
          })}
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {isDashboard ? (
            <Badge variant="green" className="gap-1 text-xs">
              <Sparkles className="h-3 w-3" />
              Portal Active
            </Badge>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs sm:text-sm">
                  <LogIn className="h-4 w-4 text-slate-500" />
                  <span>Login</span>
                </Button>
              </Link>
              <Link href="/signup">
                <Button
                  size="sm"
                  variant="primary"
                  className="gap-1.5 text-xs sm:text-sm"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Sign Up</span>
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
