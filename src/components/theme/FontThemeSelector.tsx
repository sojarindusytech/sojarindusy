"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { AvailableFont } from "@/lib/theme";
import { Type, Palette, Check, Sparkles, SlidersHorizontal, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FontThemeSelector() {
  const { font, setFont, fontOptions } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentFontOption = fontOptions.find((f) => f.id === font);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:border-[#024AE5] hover:text-[#024AE5] transition-all"
        title="Change Typography & Theme Colors"
      >
        <Type className="h-3.5 w-3.5 text-[#024AE5]" />
        <span className="hidden sm:inline font-semibold">
          {currentFontOption?.name || "Font"}
        </span>
        <div className="flex items-center gap-1 ml-0.5">
          <span className="h-2 w-2 rounded-full bg-[#024AE5]" title="Primary: #024AE5" />
          <span className="h-2 w-2 rounded-full bg-[#3C8B4F]" title="Brand Green: #3C8B4F" />
        </div>
        <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 origin-top-right rounded-xl border border-slate-200 bg-white p-4 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-4 w-4 text-[#024AE5]" />
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Theme & Typography
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Live Switch</span>
          </div>

          {/* Color Palette Display */}
          <div className="mb-3 rounded-lg bg-slate-50 p-2.5 border border-slate-100 space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-700 block">
              Active Color System
            </span>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded-md bg-[#024AE5] shadow-xs" />
                <div>
                  <span className="font-semibold block text-slate-800">#024AE5</span>
                  <span className="text-slate-400 text-[9px]">Primary Blue</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 rounded-md bg-[#3C8B4F] shadow-xs" />
                <div>
                  <span className="font-semibold block text-slate-800">#3C8B4F</span>
                  <span className="text-slate-400 text-[9px]">Brand Green</span>
                </div>
              </div>
            </div>
          </div>

          {/* Font Selector List */}
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-slate-700 block mb-1">
              Select Typography
            </span>
            {fontOptions.map((opt) => {
              const isSelected = font === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    setFont(opt.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left rounded-lg p-2 transition-all flex items-center justify-between text-xs ${
                    isSelected
                      ? "bg-blue-50 border border-[#024AE5]/30 text-[#024AE5] font-bold"
                      : "hover:bg-slate-50 text-slate-700 border border-transparent"
                  }`}
                >
                  <div>
                    <p className="font-semibold">{opt.name}</p>
                    <p className="text-[10px] text-slate-400 font-normal">
                      {opt.description}
                    </p>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-[#024AE5] shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
