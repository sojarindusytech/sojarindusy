"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { CustomerSidebar } from "./CustomerSidebar";
import { CustomerHeader } from "./CustomerHeader";

interface CustomerLayoutClientProps {
  userName: string;
  userEmail?: string;
  companyName: string;
  children: React.ReactNode;
}

export function CustomerLayoutClient({
  userName,
  userEmail,
  companyName,
  children,
}: CustomerLayoutClientProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile drawer on route transition
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-white">
      {/* Sidebar Navigation: Desktop persistent sidebar + Mobile slide-out drawer */}
      <CustomerSidebar
        companyName={companyName}
        isMobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main Content Viewport */}
      <div className="flex flex-1 min-w-0 flex-col overflow-x-hidden bg-white">
        <CustomerHeader
          userName={userName}
          userEmail={userEmail}
          companyName={companyName}
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
