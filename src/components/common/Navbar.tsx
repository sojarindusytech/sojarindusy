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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryNode } from "@/types/database.types";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

interface NavbarProps {
  categories?: CategoryNode[];
  user?: any;
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

export function Navbar({ categories = [], user }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { itemCount, setIsCartOpen } = useCart();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileProductsOpen, setIsMobileProductsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

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
              src="/assets/sojar-logo.webp"
              alt="Sojar Indusy"
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
                <ChevronDown className="h-3.5 w-3.5 opacity-60 stroke-[2.5]" />
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
                "rounded-md px-3.5 py-1.5 text-sm font-bold transition-colors",
                pathname === "/about"
                  ? "bg-blue-50 text-[#024AE5]"
                  : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              About Us
            </Link>
          </nav>

          {/* Action Buttons: Login, Sign Up, Blue Cart & Mobile Hamburger */}
          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <div className="relative group">
                <Button
                  variant="ghost"
                  className="gap-2 text-xs sm:text-sm font-bold rounded-full border border-slate-300 hover:border-slate-400 bg-white px-3 sm:px-4 py-1.5 h-auto shadow-none text-slate-800"
                >
                  <User className="h-4 w-4 text-[#024AE5]" />
                  <span className="max-w-[100px] sm:max-w-[140px] truncate">{user.email?.split("@")[0]}</span>
                </Button>

                <div className="absolute right-0 top-full hidden pt-2 group-hover:block z-50">
                  <div className="w-48 rounded-md border border-slate-200 bg-white shadow-lg py-1 flex flex-col">
                    <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100 truncate">
                      {user.email}
                    </div>
                    {user?.user_metadata?.role === "admin" ||
                    user?.user_metadata?.role === "platform_owner" ||
                    user?.email === "admin@sojarindusy.com" ? (
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

            {/* Hamburger Menu Toggle (Mobile & Tablet) */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-700 hover:text-[#024AE5] hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center"
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6 text-slate-900 transition-transform duration-200" />
              ) : (
                <Menu className="h-6 w-6 transition-transform duration-200" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Drawer - Portaled directly to document.body to prevent any header clipping */}
      {mounted && isMobileMenuOpen && createPortal(
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
                  src="/assets/sojar-logo.webp"
                  alt="Sojar Indusy"
                  width={150}
                  height={42}
                  className="h-8 w-auto object-contain"
                />
              </Link>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
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

              {/* User Profile or Login/Sign-up */}
              {user ? (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="px-3 py-2 bg-slate-50 rounded-lg text-xs text-slate-600 font-medium truncate">
                    Signed in as <span className="font-bold text-slate-900">{user.email}</span>
                  </div>
                  {user?.user_metadata?.role === "admin" ||
                  user?.user_metadata?.role === "platform_owner" ||
                  user?.email === "admin@sojarindusy.com" ? (
                    <Link
                      href="/admin/dashboard"
                      prefetch={false}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block w-full text-center px-4 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      Admin Portal &rarr;
                    </Link>
                  ) : (
                    <Link
                      href="/dashboard"
                      prefetch={false}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block w-full text-center px-4 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                      Customer Portal &rarr;
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <Link
                    href="/login"
                    prefetch={false}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block w-full text-center rounded-full border border-slate-300 hover:border-slate-400 bg-white text-slate-800 py-2.5 text-xs font-bold transition-colors cursor-pointer shadow-none"
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    prefetch={false}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block w-full text-center rounded-full bg-[#024AE5] hover:bg-[#0238B0] text-white py-2.5 text-xs font-bold transition-colors cursor-pointer shadow-none"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
