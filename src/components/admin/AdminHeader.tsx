"use client";

import { useState } from "react";
import { Search, User, ChevronDown, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/common/NotificationBell";

interface AdminHeaderProps {
  userEmail?: string;
  userName?: string;
  isMobileOpen?: boolean;
  onMenuClick?: () => void;
}

export function AdminHeader({
  userEmail,
  userName = "Super Admin",
  isMobileOpen,
  onMenuClick,
}: AdminHeaderProps) {
  const [searchValue, setSearchValue] = useState("");
  const router = useRouter();
  
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-6">
      {/* Left: Animated Hamburger (mobile/tablet) + Search Input */}
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

        <div className="relative w-full max-w-xs sm:max-w-md">
          <Input
            type="text"
            placeholder="Search SKU, product, series..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pr-8 sm:pr-10 h-9 text-xs bg-slate-50/70 border-slate-200 focus-visible:bg-white focus-visible:ring-[#024AE5]"
          />
          <Search className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Right: Notification Bell + Sojar Solutions Super Admin Profile with Dropdown */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* Realtime Notification Bell */}
        <NotificationBell align="right" />

        {/* Sojar Solutions Super Admin Profile Pill with Dropdown indicator */}
        <div className="relative group">
          <button
            type="button"
            className="flex items-center gap-2 sm:gap-2.5 p-1 sm:pl-3 sm:py-1 text-left rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 shrink-0">
              <User className="h-4 w-4" />
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-semibold text-slate-900 leading-tight">
                {userEmail ? userEmail.split('@')[0] : "Sojar Solutions"}
              </span>
              <span className="text-[10px] font-medium text-slate-400 leading-tight">
                {userName}
              </span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:block ml-0.5" />
          </button>
          
          <div className="absolute right-0 top-full hidden pt-2 group-hover:block z-50">
            <div className="w-48 rounded-md border border-slate-200 bg-white shadow-lg py-1 flex flex-col">
              {userEmail && (
                <div className="px-4 py-2 text-xs text-slate-500 border-b border-slate-100 truncate">
                  {userEmail}
                </div>
              )}
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
