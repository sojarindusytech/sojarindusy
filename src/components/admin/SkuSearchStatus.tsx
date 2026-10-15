import { Loader2 } from "lucide-react";

/** Shown inside the SKU suggestion dropdown while the SKU list loads, or when nothing matches. */
export function SkuSearchStatus({ loading }: { loading: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 py-3 text-xs text-slate-500" role="status">
      {loading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#024AE5]" />
          Loading SKUs...
        </>
      ) : (
        "No matching SKU"
      )}
    </div>
  );
}
