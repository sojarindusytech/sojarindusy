"use client";

import { useState } from "react";
import { Search, Bell, User, ChevronDown, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";

interface AdminHeaderProps {
  userEmail?: string;
  userName?: string;
  onToggleSidebar?: () => void;
}

export function AdminHeader({
  userName = "Super Admin",
  onToggleSidebar,
}: AdminHeaderProps) {
  const [searchValue, setSearchValue] = useState("");

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-6">
      {/* Left: Hamburger + Search Input */}
      <div className="flex flex-1 max-w-xl items-center gap-4">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          aria-label="Toggle navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="relative w-full max-w-md">
          <Input
            type="text"
            placeholder="Search by SKU, product, series, diameter..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pr-10 h-9 text-xs bg-slate-50/70 border-slate-200 focus-visible:bg-white focus-visible:ring-[#024AE5]"
          />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Right: Notification Bell + Sojar Indusy Super Admin Profile with Dropdown */}
      <div className="flex items-center gap-5">
        {/* Notification Bell with Badge */}
        <button
          type="button"
          className="relative p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white leading-none">
            12
          </span>
        </button>

        {/* Sojar Indusy Super Admin Profile Pill with Dropdown indicator */}
        <button
          type="button"
          className="flex items-center gap-2.5 pl-3 py-1 text-left rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <User className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-900 leading-tight">
              Sojar Indusy
            </span>
            <span className="text-[10px] font-medium text-slate-400 leading-tight">
              Super Admin
            </span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400 ml-1" />
        </button>
      </div>
    </header>
  );
}
