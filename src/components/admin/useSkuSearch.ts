"use client";

import { useEffect, useMemo, useState } from "react";
import { listInvoiceSkus, type InvoiceSkuHit } from "@/actions/invoice";

// Kept between modal opens so the first keystroke already has something to filter; every open still
// refreshes it in the background so stock and prices stay current.
let cache: InvoiceSkuHit[] = [];
let cacheLoaded = false;

/** SKU suggestions filtered in the browser as you type: no request per keystroke. */
export function useSkuSearch(query: string, limit = 15): { hits: InvoiceSkuHit[]; loading: boolean } {
  const [skus, setSkus] = useState<InvoiceSkuHit[]>(cache);
  // Only "loading" before the very first list arrives; later opens refresh quietly in the background.
  const [loaded, setLoaded] = useState(cacheLoaded);

  useEffect(() => {
    let cancelled = false;
    listInvoiceSkus().then((rows) => {
      cache = rows;
      cacheLoaded = true;
      if (!cancelled) {
        setSkus(rows);
        setLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const hits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const starts: InvoiceSkuHit[] = [];
    const contains: InvoiceSkuHit[] = [];
    for (const s of skus) {
      const sku = s.sku.toLowerCase();
      if (sku.startsWith(q)) starts.push(s);
      else if (sku.includes(q) || s.title.toLowerCase().includes(q)) contains.push(s);
      if (starts.length >= limit) break;
    }
    return [...starts, ...contains].slice(0, limit);
  }, [skus, query, limit]);

  return { hits, loading: !loaded };
}
