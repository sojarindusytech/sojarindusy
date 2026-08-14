"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { AvailableFont, FONT_OPTIONS, FontOption } from "@/lib/theme";

interface ThemeContextType {
  font: AvailableFont;
  setFont: (font: AvailableFont) => void;
  fontOptions: FontOption[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [font, setFontState] = useState<AvailableFont>("jakarta");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedFont = localStorage.getItem("sojar_theme_font") as AvailableFont | null;
    if (savedFont && FONT_OPTIONS.some((f) => f.id === savedFont)) {
      setFontState(savedFont);
      applyFontClass(savedFont);
    } else {
      applyFontClass("jakarta");
    }
  }, []);

  const applyFontClass = (selectedFont: AvailableFont) => {
    const root = document.documentElement;
    // Remove existing font classes
    FONT_OPTIONS.forEach((f) => {
      root.classList.remove(`font-${f.id}`);
    });
    root.classList.add(`font-${selectedFont}`);
  };

  const setFont = (newFont: AvailableFont) => {
    setFontState(newFont);
    localStorage.setItem("sojar_theme_font", newFont);
    applyFontClass(newFont);
  };

  return (
    <ThemeContext.Provider value={{ font, setFont, fontOptions: FONT_OPTIONS }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
