"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function NavigationProgressBarContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const finishTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startProgress = () => {
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    setVisible(true);
    setProgress(18);

    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev < 65) return prev + Math.random() * 12 + 6;
        if (prev < 85) return prev + Math.random() * 4 + 1.5;
        if (prev < 94) return prev + 0.6;
        return prev;
      });
    }, 120);
  };

  const finishProgress = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(100);

    finishTimerRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 300);
  };

  // When pathname or searchParams change, the route transition completed
  useEffect(() => {
    finishProgress();
  }, [pathname, searchParams]);

  // Intercept click on internal navigation links
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Find closest anchor tag
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Skip non-navigating links or modifier clicks
      if (
        target.target === "_blank" ||
        target.hasAttribute("download") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:") ||
        href.startsWith("#") ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      // Handle full external vs internal URLs
      if (href.startsWith("http://") || href.startsWith("https://")) {
        try {
          const url = new URL(href);
          if (url.origin === window.location.origin) {
            const targetPath = url.pathname + url.search;
            const currentPath = window.location.pathname + window.location.search;
            if (targetPath !== currentPath) {
              startProgress();
            }
          }
        } catch {
          // ignore
        }
        return;
      }

      // Internal relative link
      const currentPath = window.location.pathname + window.location.search;
      if (href !== currentPath && href !== "#") {
        startProgress();
      }
    };

    const handlePopState = () => {
      startProgress();
    };

    document.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("popstate", handlePopState);
      if (timerRef.current) clearInterval(timerRef.current);
      if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <>
      {/* Top Dynamic Bar */}
      <div
        className="fixed top-0 left-0 right-0 h-[3px] z-[99999] pointer-events-none transition-all"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transition:
            progress === 100
              ? "width 120ms ease-out, opacity 250ms ease-in"
              : "width 180ms cubic-bezier(0.1, 0.9, 0.2, 1)",
          background: "linear-gradient(90deg, #024AE5 0%, #2563EB 60%, #3C8B4F 100%)",
          boxShadow: "0 0 12px rgba(2, 74, 229, 0.8), 0 0 6px rgba(2, 74, 229, 0.5)",
        }}
      />

      {/* Floating Micro Spinner (Top Right) */}
      <div
        className="fixed top-3.5 right-4 z-[99999] pointer-events-none transition-opacity duration-200"
        style={{ opacity: progress === 100 ? 0 : 1 }}
      >
        <div className="flex items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-200/90 shadow-md text-xs text-slate-800">
          <span className="w-3.5 h-3.5 border-2 border-slate-200 border-t-[#024AE5] rounded-full animate-spin shrink-0" />
          <span className="text-[11px] font-skoda font-semibold text-slate-700 tracking-tight">Loading...</span>
        </div>
      </div>
    </>
  );
}

export function NavigationProgressBar() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressBarContent />
    </Suspense>
  );
}
