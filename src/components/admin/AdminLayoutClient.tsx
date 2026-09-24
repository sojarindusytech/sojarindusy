"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";

interface AdminLayoutClientProps {
  userName?: string;
  userEmail?: string;
  children: React.ReactNode;
}

export function AdminLayoutClient({
  userName,
  userEmail,
  children,
}: AdminLayoutClientProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile drawer on route transition
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar Navigation: Desktop persistent sidebar + Mobile slide-out drawer */}
      <AdminSidebar
        isMobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main Content Viewport */}
      <div className="flex flex-1 min-w-0 flex-col bg-white">
        <AdminHeader
          userName={userName}
          userEmail={userEmail}
          isMobileOpen={mobileOpen}
          onMenuClick={() => setMobileOpen((prev) => !prev)}
        />
        <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
