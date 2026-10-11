"use client";

import React, { createContext, useCallback, useContext, useState, useEffect } from "react";
import { computeOrderTotals } from "@/lib/pricing";

export interface CartItem {
  variantId: string;
  productId?: string;
  sku: string;
  title: string;
  unitPrice: number;
  quantity: number;
  image?: string;
  specifications?: Record<string, any>;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  /** Replace stale prices with the ones the server reported. */
  applyPriceChanges: (changes: { variantId: string; newPrice: number }[]) => void;
  subtotal: number;
  gstAmount: number;
  totalAmount: number;
  itemCount: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "sojar_indusy_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        setItems(JSON.parse(stored));
      }
    } catch (e) {
      console.warn("Could not load cart from localStorage", e);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      } catch (e) {
        console.warn("Could not save cart to localStorage", e);
      }
    }
  }, [items, isLoaded]);

  const addItem = (item: Omit<CartItem, "quantity">, quantity = 1) => {
    setItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.variantId === item.variantId);
      if (existingIdx > -1) {
        // Immutable update: the updater may run twice in React strict mode.
        return prev.map((i, idx) => (idx === existingIdx ? { ...i, quantity: i.quantity + quantity } : i));
      }
      return [...prev, { ...item, quantity }];
    });
    setIsCartOpen(true);
  };

  const removeItem = (variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  };

  const updateQuantity = (variantId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(variantId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.variantId === variantId ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  // Stable identity: checkout hooks list it as an effect dependency.
  const applyPriceChanges = useCallback((changes: { variantId: string; newPrice: number }[]) => {
    const newPrices = new Map(changes.map((c) => [c.variantId, c.newPrice]));
    setItems((prev) =>
      prev.map((i) => (newPrices.has(i.variantId) ? { ...i, unitPrice: newPrices.get(i.variantId)! } : i))
    );
  }, []);

  // Display only, an estimate at the standard 18% GST: checkout shows the
  // server's totals (per-SKU GST rates, CGST + SGST or IGST).
  const totals = computeOrderTotals(items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0));
  const subtotal = totals.subtotal;
  const gstAmount = totals.gst;
  const totalAmount = totals.total;
  const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        applyPriceChanges,
        subtotal,
        gstAmount,
        totalAmount,
        itemCount,
        isCartOpen,
        setIsCartOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
