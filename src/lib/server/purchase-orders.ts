import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateReorder } from "@/lib/reorder";
import { nextDocumentNumber, nextPoNumber } from "@/lib/server/rpc";
import { parseDbError } from "@/lib/server/db-error";
import { notifyAll } from "@/lib/server/notifications";
import { loadSalesSettings } from "@/lib/sales-settings";
import type { PurchaseOrder } from "@/types/database.types";

/**
 * Next PO number: the Sales Settings counter (prefix / FY / next number). If it
 * is unavailable, fall back to the collision-free document counter so an
 * automatic PO is never lost over numbering.
 */
export async function allocatePoNumber(): Promise<string | null> {
  const primary = await nextPoNumber();
  if (!primary.error && primary.data) return primary.data;
  console.error("[allocatePoNumber] next_po_number failed, using fallback:", primary.error?.raw);
  const fallback = await nextDocumentNumber("PO");
  return fallback.error ? null : fallback.data;
}

export interface PoManufacturer {
  id: string;
  name: string;
}

/** Every manufacturer account, for the Sales Settings and New Purchase Order dropdowns. */
export async function listManufacturers(): Promise<PoManufacturer[]> {
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, company_name, first_name, last_name, email")
    .eq("role", "manufacturer")
    .order("company_name", { ascending: true });
  if (error) {
    console.error("[listManufacturers] Query error:", error.message);
    return [];
  }
  return ((data as { id: string; company_name: string | null; first_name: string | null; last_name: string | null; email: string | null }[]) ?? []).map((p) => ({
    id: p.id,
    name: p.company_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.email || "Manufacturer",
  }));
}

export async function isManufacturer(id: string): Promise<boolean> {
  const { data } = await createAdminClient().from("profiles").select("id").eq("id", id).eq("role", "manufacturer").maybeSingle();
  return Boolean(data);
}

/** The manufacturer new POs go to (Sales Settings), or null while none is chosen / the account is gone. */
export async function defaultPoManufacturerId(): Promise<string | null> {
  const id = (await loadSalesSettings())?.po_manufacturer_id ?? null;
  return id && (await isManufacturer(id)) ? id : null;
}

/** Notify the PO's manufacturer, or every manufacturer when the PO has none assigned. */
export const manufacturerTarget = (manufacturerId: string | null | undefined) =>
  manufacturerId ? { userId: manufacturerId } : { role: "manufacturer" as const };

interface VariantForReorder {
  id: string;
  sku: string;
  product_id: string;
  min_quantity: number | null;
  trigger_quantity: number | null;
  stock_quantity: number | null;
  reserved_quantity: number | null;
  specifications: Record<string, unknown> | null;
  products: { id: string; title: string } | null;
}

/**
 * Creates a manufacturer purchase order when an SKU's stock falls to or below
 * its trigger quantity (see src/lib/reorder.ts for the rule).
 *
 * At most one open automatic PO per SKU: a unique index enforces it, so two
 * orders that drain stock at the same moment cannot both create one. Manual
 * POs placed by an admin are not limited.
 *
 * Server-only: as an exported Server Action this was a public endpoint that
 * let anyone place purchase orders with the manufacturer.
 */
export async function checkAndGeneratePurchaseOrder(
  variantId: string,
  currentStock: number
): Promise<{ created: boolean; order?: PurchaseOrder; reason?: string }> {
  try {
    const adminDb = createAdminClient();

    const { data: variantData, error: variantErr } = await adminDb
      .from("product_variants")
      .select("id, sku, min_quantity, trigger_quantity, stock_quantity, reserved_quantity, specifications, product_id, products(id, title)")
      .eq("id", variantId)
      .single();

    if (variantErr || !variantData) {
      return { created: false, reason: "Variant not found" };
    }
    const variant = variantData as unknown as VariantForReorder;

    const targetQty = Number(variant.min_quantity) || 0;
    const triggerQty = Number(variant.trigger_quantity) || 0;
    // What can still be sold: on hand minus units reserved by open orders. Read from the
    // database so every caller (orders, invoices, edits, imports) is judged the same way.
    const available =
      variant.stock_quantity === null || variant.stock_quantity === undefined
        ? currentStock
        : Math.max(0, Number(variant.stock_quantity) - (Number(variant.reserved_quantity) || 0));
    const decision = evaluateReorder({ currentStock: available, minQuantity: targetQty, triggerQuantity: triggerQty });

    if (!decision.shouldOrder) {
      if (decision.misconfigured) {
        console.warn(`[checkAndGeneratePurchaseOrder] SKU ${variant.sku}: ${decision.reason}`);
      }
      return { created: false, reason: decision.reason };
    }

    const orderNumber = await allocatePoNumber();
    if (!orderNumber) return { created: false, reason: "Could not number the purchase order" };
    const manufacturerId = await defaultPoManufacturerId();
    const productTitle = variant.products?.title || "Tooling Product";

    const { data: created, error: insertErr } = await adminDb
      .from("purchase_orders" as never)
      .insert({
        order_number: orderNumber,
        variant_id: variant.id,
        product_id: variant.product_id,
        sku_code: variant.sku,
        product_title: productTitle,
        min_quantity: targetQty,
        trigger_quantity: triggerQty,
        actual_quantity: available,
        order_quantity: decision.orderQuantity,
        specifications: variant.specifications || {},
        status: "Placed",
        manufacturer_id: manufacturerId,
        is_auto: true,
      } as never)
      .select("*")
      .single();

    if (insertErr) {
      const parsed = parseDbError(insertErr);
      if (parsed.code === "UNIQUE_VIOLATION") {
        return { created: false, reason: "An open purchase order already exists for this SKU" };
      }
      console.error("[checkAndGeneratePurchaseOrder] Failed to insert auto PO:", insertErr.message);
      return { created: false, reason: insertErr.message };
    }

    await notifyAll([
      {
        role: "admin",
        title: "Low Stock: Auto PO Placed",
        message: `PO #${orderNumber} automatically created for ${variant.sku} (${decision.orderQuantity} units).`,
        type: "purchase_order",
        link: "/admin/purchase-orders",
        metadata: { order_number: orderNumber, sku: variant.sku, quantity: decision.orderQuantity },
      },
      {
        ...manufacturerTarget(manufacturerId),
        title: "New Production Order",
        message: `New PO #${orderNumber} placed: ${decision.orderQuantity} units of ${productTitle} (${variant.sku}).`,
        type: "purchase_order",
        link: "/manufacturer",
        metadata: { order_number: orderNumber, sku: variant.sku, quantity: decision.orderQuantity },
      },
    ]);

    revalidatePath("/admin/purchase-orders");
    revalidatePath("/manufacturer");
    revalidatePath("/admin/products");

    return { created: true, order: created as unknown as PurchaseOrder };
  } catch (err) {
    console.error("[checkAndGeneratePurchaseOrder] Exception:", err);
    return { created: false, reason: err instanceof Error ? err.message : "Unknown error" };
  }
}

/** Runs the reorder check for several SKUs; failures are logged, never thrown. */
export async function checkReorderForStock(lines: { variantId: string; stockAfter: number }[]): Promise<void> {
  for (const line of lines) {
    const result = await checkAndGeneratePurchaseOrder(line.variantId, line.stockAfter);
    if (!result.created && result.reason && !/above the trigger|disabled|already exists/i.test(result.reason)) {
      console.warn(`[reorder] ${line.variantId}: ${result.reason}`);
    }
  }
}
