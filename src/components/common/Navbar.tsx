"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Layers, LogIn, UserPlus, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryNode } from "@/types/database.types";

interface NavbarProps {
  categories?: CategoryNode[];
}

import { useState } from "react";

const CategoryMenuItem = ({ node }: { node: CategoryNode }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <li 
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <Link
        href={`/categories/${node.slug}`}
        className="flex items-center justify-between px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#024AE5]"
        onClick={() => setIsOpen(false)}
      >
        <span>{node.name}</span>
        {node.children && node.children.length > 0 && (
          <ChevronRight className="h-4 w-4 text-slate-400" />
        )}
      </Link>
      {node.children && node.children.length > 0 && isOpen && (
        <ul className="absolute left-full top-0 w-48 rounded-md border border-slate-200 bg-white shadow-lg py-1 z-50">
          {node.children.map((child) => (
            <CategoryMenuItem key={child.id} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
};

export function Navbar({ categories = [] }: NavbarProps) {
  const pathname = usePathname();

  const isDashboardRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin");

  if (isDashboardRoute) {
    return null;
  }

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "About Us", href: "/about" },
  ];

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
        <nav className="hidden md:flex items-center gap-1 relative">
          <Link
            href="/"
            className={cn(
              "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
              pathname === "/"
                ? "bg-blue-50 text-[#024AE5] font-semibold"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            Home
          </Link>

          {/* Products Dropdown */}
          <div className="group relative">
            <Link
              href="/products"
              className={cn(
                "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors flex items-center gap-1",
                pathname.startsWith("/products") || pathname.startsWith("/categories")
                  ? "bg-blue-50 text-[#024AE5] font-semibold"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              Products
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Link>

            {categories.length > 0 && (
              <div className="absolute left-0 top-full hidden pt-2 group-hover:block">
                <ul className="w-56 rounded-md border border-slate-200 bg-white shadow-lg py-1">
                  {categories.map((cat) => (
                    <CategoryMenuItem key={cat.id} node={cat} />
                  ))}
                </ul>
              </div>
            )}
          </div>

          <Link
            href="/about"
            className={cn(
              "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
              pathname === "/about"
                ? "bg-blue-50 text-[#024AE5] font-semibold"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            About Us
          </Link>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
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
        </div>
      </div>
    </header>
  );
}
