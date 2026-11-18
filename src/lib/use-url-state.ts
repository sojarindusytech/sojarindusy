"use client";

import { useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A filter value kept in the page URL (?status=issued), so it survives reload, Back, and can be
 * shared as a link. Uses history.replaceState, which Next keeps in sync with useSearchParams
 * without a server round trip, so typing in a search box does not reload the list.
 * The default value is left out of the URL.
 */
export function useUrlState(key: string, initial = ""): [string, (value: string) => void] {
  const params = useSearchParams();
  const pathname = usePathname();
  const value = params.get(key) ?? initial;

  const setValue = useCallback(
    (next: string) => {
      const query = new URLSearchParams(window.location.search);
      if (next === initial || next === "") query.delete(key);
      else query.set(key, next);
      const qs = query.toString();
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
    },
    [key, initial, pathname]
  );

  return [value, setValue];
}
