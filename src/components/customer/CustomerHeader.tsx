"use client";

import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShoppingBag,
  User,
  ChevronDown,
  LogOut,
  Search,
  Plus,
  Building2,
  ShieldCheck,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOutUser } from "@/actions/auth";
import { cn } from "@/lib/utils";

interface CustomerHeaderProps {
  userName: string;
  userEmail?: string;
  companyName: string;
  isMobileOpen?: boolean;
  onOpenRfq?: () => void;
  onMenuClick?: () => void;
}

export function CustomerHeader({
  userName,
  userEmail,
  companyName,
  isMobileOpen,
  onOpenRfq,
  onMenuClick,
}: CustomerHeaderProps) {
  const { itemCount, setIsCartOpen } = useCart();
  const [searchValue, setSearchValue] = useState("");
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      router.push(`/dashboard/orders?q=${encodeURIComponent(searchValue.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-6">
      {/* Left: Quick Search Bar + Animated Hamburger Menu (Mobile/Tablet) */}
      <div className="flex flex-1 max-w-xl items-center gap-2 sm:gap-3 min-w-0 mr-2">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden relative h-9 w-9 -ml-1 flex flex-col items-center justify-center gap-1.5 rounded-lg text-slate-700 hover:text-[#024AE5] hover:bg-slate-100 transition-colors cursor-pointer active:scale-95 shrink-0"
          aria-label={isMobileOpen ? "Close navigation menu" : "Open navigation menu"}
        >
          <span
            className={cn(
              "h-0.5 w-4.5 bg-current rounded-full transition-all duration-300 ease-in-out origin-center",
              isMobileOpen ? "translate-y-2 rotate-45 bg-slate-900" : ""
            )}
          />
          <span
            className={cn(
              "h-0.5 w-4.5 bg-current rounded-full transition-all duration-300 ease-in-out",
              isMobileOpen ? "opacity-0 scale-x-0" : "opacity-100"
            )}
          />
          <span
            className={cn(
              "h-0.5 w-4.5 bg-current rounded-full transition-all duration-300 ease-in-out origin-center",
              isMobileOpen ? "-translate-y-2 -rotate-45 bg-slate-900" : ""
            )}
          />
        </button>

        <form onSubmit={handleSearch} className="relative w-full max-w-xs sm:max-w-md">
          <Input
            type="text"
            placeholder="Search SKU, item, order #..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pr-8 sm:pr-10 h-9 text-xs bg-slate-50/70 border-slate-200 focus-visible:bg-white focus-visible:ring-[#024AE5]"
          />
          <Search className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 pointer-events-none" />
        </form>
      </div>

      {/* Right: Actions + Cart Drawer + User Profile Pill with Dropdown */}
      <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
        {/* Request RFQ Button */}
        {onOpenRfq ? (
          <Button
            size="sm"
            onClick={onOpenRfq}
            className="hidden md:inline-flex bg-[#3C8B4F] hover:bg-[#347844] text-white text-xs font-bold h-8.5 px-3 gap-1 shadow-none cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Request RFQ</span>
          </Button>
        ) : (
          <Link href="/dashboard/rfqs">
            <Button
              size="sm"
              className="hidden md:inline-flex bg-[#3C8B4F] hover:bg-[#347844] text-white text-xs font-bold h-8.5 px-3 gap-1 shadow-none cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Request RFQ</span>
            </Button>
          </Link>
        )}

        {/* Cart Drawer Trigger Button */}
        <button
          onClick={() => setIsCartOpen(true)}
          className="group relative p-2 rounded-lg text-[#024AE5] hover:text-[#024AE5] hover:bg-blue-50/80 transition-all duration-200 cursor-pointer border border-blue-200/60 bg-blue-50/20 flex items-center justify-center h-8.5 w-8.5 active:scale-95 shrink-0"
          title="Open Industrial Cart"
        >
          <ShoppingBag className="h-4 w-4 text-[#024AE5] group-hover:scale-110 transition-transform duration-200" />
          {itemCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-[#024AE5] text-white font-bold text-[10px] h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center shadow-xs animate-in zoom-in-50 duration-200">
              {itemCount}
            </span>
          )}
        </button>

        {/* Sojar Solutions Customer Profile Pill with Dropdown indicator */}
        <div className="relative group">
          <button
            type="button"
            className="flex items-center gap-2 sm:gap-2.5 p-1 sm:pl-3 sm:py-1 text-left rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-bold text-xs shrink-0">
              <User className="h-4 w-4" />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-semibold text-slate-900 leading-tight truncate max-w-[140px]">
                {companyName || "Enterprise Client"}
              </span>
              <span className="text-[10px] font-medium text-slate-400 leading-tight truncate max-w-[140px]">
                {userName || "Authorized Contact"}
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:block ml-0.5" />
          </button>

          {/* Hover Dropdown Menu */}
          <div className="absolute right-0 top-full hidden pt-2 group-hover:block z-50">
            <div className="w-52 rounded-md border border-slate-200 bg-white shadow-lg py-1 flex flex-col">
              {userEmail && (
                <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100 truncate">
                  {userEmail}
                </div>
              )}
              <Link
                href="/dashboard/profile"
                className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <Settings className="h-3.5 w-3.5 text-slate-500" />
                <span>Delivery & Profile</span>
              </Link>
              <form action={signOutUser}>
                <button
                  type="submit"
                  className="flex items-center gap-2 w-full text-left px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5 text-red-500" />
                  <span>Sign Out</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
