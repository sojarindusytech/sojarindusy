"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import {
  ChevronRight,
  ChevronDown,
  User,
  LogOut,
  ShoppingCart,
  Menu,
  X,
  Home,
  Package,
  Info,
  HelpCircle,
  PhoneCall,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryNode } from "@/types/database.types";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface NavbarProps {
  categories?: CategoryNode[];
  user?: any;
  /** Resolved server-side from the profiles table, never from user_metadata. */
  isAdmin?: boolean;
  companyName?: string | null;
  userName?: string | null;
}

const CategoryMenuItem = ({ node, parentPath = "" }: { node: CategoryNode, parentPath?: string }) => {
  const [isOpen, setIsOpen] = useState(false);

  const currentPath = parentPath ? `${parentPath}/${node.slug}` : node.slug;

  return (
    <li 
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <Link
        href={`/products/${currentPath}`}
        prefetch={false}
        className="flex items-center justify-between px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 hover:text-[#024AE5]"
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
            <CategoryMenuItem key={child.id} node={child} parentPath={currentPath} />
          ))}
        </ul>
      )}
    </li>
  );
};

export function Navbar({
  categories = [],
  user,
  isAdmin = false,
  companyName,
  userName,
}: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { itemCount, setIsCartOpen } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileProductsOpen, setIsMobileProductsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const effectiveCompanyName =
    companyName || user?.user_metadata?.company_name || "Enterprise Partner";
  const effectiveUserName =
    userName ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Authorized Contact";

  useEffect(() => {
    setMounted(true);
  }, []);

  // Automatically close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile drawer is active
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  };

  const isDashboardRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/pending-approval") ||
    pathname.startsWith("/auth");

  if (isDashboardRoute) {
    return null;
  }

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md font-skoda">
        <div className="container mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Logo Only */}
          <Link href="/" className="flex items-center transition-opacity hover:opacity-90 py-1">
            <Image
              src="/assets/sojar-logo.svg"
              alt="Sojar Solutions"
              width={220}
              height={64}
              className="h-9 sm:h-11 md:h-12 w-auto object-contain"
              priority
            />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 relative">
            <Link
              href="/"
              className={cn(
                "rounded-md px-3.5 py-1.5 text-sm font-bold transition-colors",
                pathname === "/"
                  ? "bg-blue-50 text-[#024AE5]"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              Home
            </Link>

            {/* Products Dropdown */}
            <div className="group relative">
              <Link
                href="/products"
                className={cn(
                  "rounded-md px-3.5 py-1.5 text-sm font-bold transition-colors flex items-center gap-1",
                  pathname.startsWith("/products") || pathname.startsWith("/categories")
                    ? "bg-blue-50 text-[#024AE5]"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                Products
                <ChevronDown className="h-3.5 w-3.5 opacity-60 stroke-[2.5] transition-transform duration-200 group-hover:rotate-180" />
              </Link>

              {categories.length > 0 && (
                <div className="absolute left-0 top-full hidden pt-2 group-hover:block animate-in fade-in-0 zoom-in-95 duration-150">
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
                "rounded-md px-3.5 py-1.5 text-sm font-bold transition-colors",
                pathname === "/about"
                  ? "bg-blue-50 text-[#024AE5]"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              About Us
            </Link>

            <Link
              href="/faq"
              className={cn(
                "rounded-md px-3.5 py-1.5 text-sm font-bold transition-colors",
                pathname === "/faq"
                  ? "bg-blue-50 text-[#024AE5]"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              FAQ
            </Link>

            <Link
              href="/contact"
              className={cn(
                "rounded-md px-3.5 py-1.5 text-sm font-bold transition-colors",
                pathname === "/contact"
                  ? "bg-blue-50 text-[#024AE5]"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              Contact Us
            </Link>
          </nav>

          {/* Action Buttons: Login, Sign Up, Blue Cart & Mobile Hamburger */}
          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <div className="relative group hidden md:block">
                <Button
                  variant="ghost"
                  className="gap-2.5 text-xs font-bold rounded-full border border-slate-300 hover:border-slate-400 bg-white pl-2.5 pr-3.5 py-1 h-auto shadow-none text-slate-800"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-50 text-[#024AE5] shrink-0 font-bold text-xs">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[130px]">
                      {effectiveCompanyName}
                    </span>
                    <span className="text-[10px] font-medium text-slate-400 leading-tight truncate max-w-[130px]">
                      {effectiveUserName}
                    </span>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 ml-0.5" />
                </Button>

                <div className="absolute right-0 top-full hidden pt-2 group-hover:block z-50">
                  <div className="w-52 rounded-md border border-slate-200 bg-white shadow-lg py-1 flex flex-col">
                    <div className="px-4 py-2 text-xs border-b border-slate-100">
                      <span className="block font-bold text-slate-900 truncate">
                        {effectiveCompanyName}
                      </span>
                      <span className="block text-[11px] text-slate-600 font-medium truncate">
                        {effectiveUserName}
                      </span>
                      <span className="block text-[10px] text-slate-400 truncate mt-0.5">
                        {user.email}
                      </span>
                    </div>
                    {isAdmin ? (
                      <Link
                        href="/admin/dashboard"
                        className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 flex items-center justify-between"
                      >
                        <span>Admin Portal</span>
                        <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">
                          ADMIN
                        </span>
                      </Link>
                    ) : (
                      <Link
                        href="/dashboard"
                        className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#024AE5]"
                      >
                        Customer Portal
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                {/* Login Pill Button */}
                <Link
                  href="/login"
                  className="rounded-full border border-slate-300 hover:border-slate-400 bg-white text-slate-800 hover:text-slate-950 px-4 sm:px-5 py-1.5 text-xs sm:text-sm font-bold transition-colors cursor-pointer shadow-none inline-flex items-center justify-center"
                >
                  Login
                </Link>

                {/* Sign Up Pill Button */}
                <Link
                  href="/signup"
                  className="rounded-full border border-slate-300 hover:border-slate-400 bg-white text-slate-800 hover:text-slate-950 px-4 sm:px-5 py-1.5 text-xs sm:text-sm font-bold transition-colors cursor-pointer shadow-none inline-flex items-center justify-center"
                >
                  Sign Up
                </Link>
              </div>
            )}

            {/* Blue Cart Logo / Button with Animation */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="group relative p-2 text-[#024AE5] hover:bg-blue-50/80 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center active:scale-95"
              title="View Industrial Cart"
            >
              <ShoppingCart className="h-5 w-5 sm:h-5.5 sm:w-5.5 text-[#024AE5] group-hover:scale-110 transition-transform duration-200 stroke-[2.2]" />
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#024AE5] text-white font-bold text-[9px] h-4.5 min-w-[18px] px-1 rounded-full flex items-center justify-center shadow-xs animate-in zoom-in-50 duration-200">
                  {itemCount}
                </span>
              )}
            </button>

            {/* Hamburger Menu Toggle (Mobile & Tablet) with smooth morph animation */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden relative h-10 w-10 flex flex-col items-center justify-center gap-1.5 rounded-lg text-slate-700 hover:text-[#024AE5] hover:bg-slate-100 transition-colors cursor-pointer active:scale-95 shrink-0"
              aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            >
              <span
                className={cn(
                  "h-0.5 w-5 bg-current rounded-full transition-all duration-300 ease-in-out origin-center",
                  isMobileMenuOpen ? "translate-y-2 rotate-45 bg-slate-900" : ""
                )}
              />
              <span
                className={cn(
                  "h-0.5 w-5 bg-current rounded-full transition-all duration-300 ease-in-out",
                  isMobileMenuOpen ? "opacity-0 scale-x-0" : "opacity-100"
                )}
              />
              <span
                className={cn(
                  "h-0.5 w-5 bg-current rounded-full transition-all duration-300 ease-in-out origin-center",
                  isMobileMenuOpen ? "-translate-y-2 -rotate-45 bg-slate-900" : ""
                )}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer - Portaled directly to document.body with smooth open & close animations */}
      {mounted && createPortal(
        <div
          className={cn(
            "fixed inset-0 z-[100] md:hidden transition-all duration-300",
            isMobileMenuOpen ? "visible pointer-events-auto" : "invisible pointer-events-none delay-300"
          )}
        >
          {/* Full Screen Backdrop */}
          <div
            className={cn(
              "fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300 ease-in-out",
              isMobileMenuOpen ? "opacity-100" : "opacity-0"
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Full Height Drawer Panel */}
          <div
            className={cn(
              "fixed right-0 top-0 bottom-0 h-full w-[85vw] max-w-xs bg-white shadow-2xl flex flex-col z-10 border-l border-slate-200 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] font-skoda",
              isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
            )}
          >
            {/* Drawer Header with Logo & Close Button */}
            <div className="flex h-16 items-center justify-between px-5 border-b border-slate-100 bg-white shrink-0">
              <Link href="/" prefetch={false} onClick={() => setIsMobileMenuOpen(false)} className="flex items-center py-1">
                <Image
                  src="/assets/sojar-logo.svg"
                  alt="Sojar Solutions"
                  width={150}
                  height={42}
                  className="h-8 w-auto object-contain"
                />
              </Link>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-all duration-200 active:scale-90 hover:rotate-90 cursor-pointer"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Navigation Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 bg-white">
              <nav className="space-y-1">
                <Link
                  href="/"
                  prefetch={false}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-bold transition-colors",
                    pathname === "/"
                      ? "bg-blue-50 text-[#024AE5]"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <Home className="h-4 w-4 text-slate-500" />
                  <span>Home</span>
                </Link>

                {/* Products Accordion */}
                <div>
                  <button
                    type="button"
                    onClick={() => setIsMobileProductsOpen(!isMobileProductsOpen)}
                    className={cn(
                      "flex w-full items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-bold transition-colors cursor-pointer",
                      pathname.startsWith("/products")
                        ? "bg-blue-50 text-[#024AE5]"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Package className="h-4 w-4 text-slate-500" />
                      <span>Products</span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-slate-400 transition-transform duration-200",
                        isMobileProductsOpen && "rotate-180 text-slate-700"
                      )}
                    />
                  </button>

                  {isMobileProductsOpen && (
                    <div className="pl-8 pr-2 py-1 space-y-1 border-l-2 border-slate-100 ml-5 my-1 animate-in fade-in-50 duration-150">
                      <Link
                        href="/products"
                        prefetch={false}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="block px-3 py-1.5 text-xs font-bold text-[#024AE5] hover:underline"
                      >
                        Browse All Catalog &rarr;
                      </Link>
                      {categories.map((cat) => (
                        <Link
                          key={cat.id}
                          href={`/products/${cat.slug}`}
                          prefetch={false}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded font-bold"
                        >
                          {cat.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                <Link
                  href="/about"
                  prefetch={false}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-bold transition-colors",
                    pathname === "/about"
                      ? "bg-blue-50 text-[#024AE5]"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <Info className="h-4 w-4 text-slate-500" />
                  <span>About Us</span>
                </Link>

                <Link
                  href="/faq"
                  prefetch={false}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-bold transition-colors",
                    pathname === "/faq"
                      ? "bg-blue-50 text-[#024AE5]"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <HelpCircle className="h-4 w-4 text-slate-500" />
                  <span>FAQ</span>
                </Link>

                <Link
                  href="/contact"
                  prefetch={false}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-bold transition-colors",
                    pathname === "/contact"
                      ? "bg-blue-50 text-[#024AE5]"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <PhoneCall className="h-4 w-4 text-slate-500" />
                  <span>Contact Us</span>
                </Link>
              </nav>

              <div className="border-t border-slate-100 pt-4" />

              {/* Cart Quick Summary Button */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsCartOpen(true);
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-blue-50/60 text-[#024AE5] font-semibold text-xs border border-blue-100 hover:bg-blue-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <ShoppingCart className="h-4 w-4" />
                  <span>Industrial Cart</span>
                </div>
                <span className="bg-[#024AE5] text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </span>
              </button>
            </div>

            {/* Classic Bottom Drawer Footer */}
            {user ? (
              <div className="border-t border-slate-200 bg-slate-50/95 p-3.5 shrink-0 space-y-2.5">
                {/* Company Name & User Name like Dashboard */}
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-[#024AE5] font-bold text-xs shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-900 leading-tight truncate">
                        {effectiveCompanyName}
                      </span>
                      {isAdmin && (
                        <span className="text-[9px] bg-blue-100 text-[#024AE5] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 border border-blue-200/50">
                          Admin
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-slate-600 leading-tight truncate mt-0.5">
                      {effectiveUserName}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate">
                      {user.email}
                    </span>
                  </div>
                </div>

                {/* Classic Bottom Action Buttons: Dashboard & Logout */}
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  {isAdmin ? (
                    <Link
                      href="/admin/dashboard"
                      prefetch={false}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center justify-center gap-1.5 h-8 px-2.5 text-xs font-semibold text-white bg-[#024AE5] hover:bg-[#013bb8] rounded-md transition-colors text-center shadow-xs"
                    >
                      <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Admin Portal</span>
                    </Link>
                  ) : (
                    <Link
                      href="/dashboard"
                      prefetch={false}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center justify-center gap-1.5 h-8 px-2.5 text-xs font-semibold text-white bg-[#024AE5] hover:bg-[#013bb8] rounded-md transition-colors text-center shadow-xs"
                    >
                      <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Dashboard</span>
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="flex items-center justify-center gap-1.5 h-8 px-2.5 text-xs font-semibold text-slate-600 bg-white hover:text-red-600 hover:bg-red-50 hover:border-red-200 border border-slate-200 rounded-md transition-colors cursor-pointer"
                  >
                    <LogOut className="h-3.5 w-3.5 shrink-0" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-t border-slate-200 bg-white p-3.5 shrink-0 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/login"
                    prefetch={false}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-center h-8 px-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors cursor-pointer text-center"
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    prefetch={false}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-center h-8 px-2.5 text-xs font-semibold text-white bg-[#024AE5] hover:bg-[#013bb8] rounded-md transition-colors cursor-pointer text-center shadow-xs"
                  >
                    Sign Up
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
