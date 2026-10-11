import {
  UserRole,
  UserTitle,
  OrderStatus,
  ApprovalStatus,
  UserType,
  CustomerChannel,
  QuoteStatus,
  PurchaseOrderStatus,
} from "@/lib/constants";

export type { UserRole, UserTitle, OrderStatus, ApprovalStatus, UserType, CustomerChannel, QuoteStatus, PurchaseOrderStatus };

export interface Profile {
  id: string;
  role: UserRole;
  title: UserTitle;
  first_name: string;
  last_name: string;
  department: string;
  designation: string;
  mobile: string;
  landline?: string | null;
  email: string;
  company_name: string;
  company_address: string;
  additional_address?: string | null;
  gstin?: string | null;
  city: string;
  state: string;
  pincode: string;
  approval_status?: ApprovalStatus;
  channel?: CustomerChannel;
  user_type?: UserType;
  notes?: string | null;
  credit_limit?: number | null;
  credit_days?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface OrderItem {
  /** The SKU (product_variants.id); legacy lines may hold "item-N". */
  id: string;
  product_id?: string;
  name: string;
  sku: string;
  quantity: number;
  /** Units taken from stock when the order was placed. */
  reserved_quantity?: number;
  /** Units ordered beyond stock; they ship once restocked. */
  backordered_quantity?: number;
  unit_price: number;
  total_price: number;
  /** This line's share of the coupon discount (orders with tax_snapshot). */
  discount_amount?: number;
  /** total_price - discount_amount: the value GST was charged on. */
  taxable_amount?: number;
  /** GST % charged on this line (0 when GST billing was off). */
  gst_rate?: number;
  gst_amount?: number;
  specifications?: Record<string, any>;
}

export interface CustomerOrderDetails {
  company_name: string;
  contact_name: string;
  mobile: string;
  email: string;
  gstin?: string | null;
  city: string;
  state: string;
  pincode: string;
}

export type ContactSubmissionStatus = "unread" | "read" | "replied" | "archived";

export interface ContactSubmission {
  id: string;
  full_name: string;
  email: string;
  mobile?: string | null;
  message: string;
  status: ContactSubmissionStatus;
  privacy_accepted?: boolean;
  admin_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactSubmissionInsert {
  id?: string;
  full_name: string;
  email: string;
  mobile?: string | null;
  message: string;
  status?: ContactSubmissionStatus;
  privacy_accepted?: boolean;
  admin_notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ContactSubmissionUpdate {
  id?: string;
  full_name?: string;
  email?: string;
  mobile?: string | null;
  message?: string;
  status?: ContactSubmissionStatus;
  privacy_accepted?: boolean;
  admin_notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type RFQStatus = "pending" | "reviewing" | "quoted" | "accepted" | "declined";

export interface RFQ {
  id: string;
  rfq_number: string;
  user_id: string;
  company_name?: string | null;
  contact_person?: string | null;
  email?: string | null;
  mobile?: string | null;
  item_name: string;
  quantity: string;
  required_by_date?: string | null;
  specifications?: string | null;
  drawing_url?: string | null;
  status: RFQStatus;
  quoted_amount?: number | null;
  admin_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RFQInsert {
  id?: string;
  rfq_number?: string;
  user_id: string;
  company_name?: string | null;
  contact_person?: string | null;
  email?: string | null;
  mobile?: string | null;
  item_name: string;
  quantity: string;
  required_by_date?: string | null;
  specifications?: string | null;
  drawing_url?: string | null;
  status?: RFQStatus;
  quoted_amount?: number | null;
  admin_notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RFQUpdate {
  id?: string;
  rfq_number?: string;
  user_id?: string;
  company_name?: string | null;
  contact_person?: string | null;
  email?: string | null;
  mobile?: string | null;
  item_name?: string;
  quantity?: string;
  required_by_date?: string | null;
  specifications?: string | null;
  drawing_url?: string | null;
  status?: RFQStatus;
  quoted_amount?: number | null;
  admin_notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** items / totals mirror InvoiceLine / InvoiceTotals from src/lib/invoice.ts. */
export interface CommercialQuote {
  id: string;
  quote_number: string;
  quote_fy?: string | null;
  seq?: number | null;
  rfq_id?: string | null;
  user_id?: string | null;
  quote_date: string;
  valid_until: string;
  company_name: string;
  contact_person?: string | null;
  email?: string | null;
  mobile?: string | null;
  gstin?: string | null;
  address?: string | null;
  place_of_supply?: string | null;
  gst_enabled: boolean;
  items: import("@/lib/invoice").InvoiceLine[];
  totals: import("@/lib/invoice").InvoiceTotals;
  /** Taxable amount after discounts. */
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_in_words?: string | null;
  status: QuoteStatus;
  payment_terms?: string | null;
  delivery_terms?: string | null;
  admin_notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteStatusHistoryEntry {
  id: string;
  quote_id: string;
  from_status: QuoteStatus | null;
  to_status: QuoteStatus;
  notes: string | null;
  changed_by: string | null;
  /** Display name of whoever made the change (joined from profiles). */
  changed_by_name?: string | null;
  changed_at: string;
}

export type CommercialQuoteInsert = Omit<CommercialQuote, "id" | "created_at" | "updated_at">;
export type CommercialQuoteUpdate = Partial<CommercialQuote>;

export interface Order {
  id: string;
  user_id: string;
  order_number: string;
  status: OrderStatus;
  subtotal?: number;
  gst_amount?: number;
  total_amount: number;
  items: OrderItem[];
  shipping_address: string;
  courier_partner?: string | null;
  awb_number?: string | null;
  tracking_url?: string | null;
  dispatched_at?: string | null;
  delivered_at?: string | null;
  returned_at?: string | null;
  return_reason?: string | null;
  invoice_number?: string | null;
  customer_details?: CustomerOrderDetails | null;
  notes?: string | null;
  /** Coupon discount, taken off the subtotal before GST. 0 when none. */
  discount_amount?: number;
  coupon_code?: string | null;
  /** The coupon's rules as they were when the order was placed. */
  coupon_snapshot?: CouponSnapshot | null;
  /** How GST was charged; null on orders placed before per-line GST. */
  tax_snapshot?: OrderTaxSnapshot | null;
  idempotency_key?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesSettings {
  id: boolean;
  company_name: string;
  address: string;
  gstin: string | null;
  state_code: string;
  state_name: string;
  msme: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  signature_url: string | null;
  bank_name: string | null;
  bank_address: string | null;
  account_no: string | null;
  ifsc: string | null;
  account_holder: string | null;
  terms: string | null;
  gst_billing_enabled: boolean;
  default_gst_rate: number;
  invoice_prefix: string;
  invoice_fy: string | null;
  invoice_next_number: number;
  invoice_pad: number;
  po_prefix: string;
  po_fy: string | null;
  po_next_number: number;
  po_pad: number;
  rfq_prefix: string;
  rfq_fy: string | null;
  rfq_next_number: number;
  rfq_pad: number;
  quote_prefix: string;
  quote_fy: string | null;
  quote_next_number: number;
  quote_pad: number;
  quote_validity_days: number;
  quote_payment_terms: string | null;
  quote_delivery_terms: string | null;
  /** Copies printed on the invoice PDF, one page set each. */
  invoice_copies: import("@/lib/invoice").InvoiceCopy[];
  updated_at: string;
}

export interface InvoiceBillTo {
  name: string;
  address: string;
  contact?: string | null;
  gstin?: string | null;
  /** "24-Gujarat" style, same shape as Place of Supply. */
  state?: string | null;
}

export type InvoiceStatus = "issued" | "cancelled";

/** items / totals mirror InvoiceLine / InvoiceTotals from src/lib/invoice.ts. */
export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_fy: string | null;
  seq: number | null;
  order_id: string | null;
  user_id: string | null;
  invoice_date: string;
  po_number: string | null;
  place_of_supply: string | null;
  gst_enabled: boolean;
  bill_to: InvoiceBillTo;
  items: import("@/lib/invoice").InvoiceLine[];
  totals: import("@/lib/invoice").InvoiceTotals;
  total_amount: number;
  amount_in_words: string | null;
  status: InvoiceStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  description?: string | null;
  image_url?: string | null;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  product_count?: number;
}

export interface CategoryNode extends Category {
  depth: number;
  children: CategoryNode[];
  parent_name?: string | null;
}

export interface ProductCategory {
  product_id: string;
  category_id: string;
  created_at?: string;
}

export interface ProductDocument {
  id?: string;
  name: string;
  url: string;
  file_type: "pdf" | "excel" | "sheet" | "doc" | "other";
  file_size?: string;
  attribute_id?: string | null;
  attribute_name?: string | null;
}

export interface ProductImage {
  id?: string;
  url: string;
  title: string;
  attribute_id?: string | null;
  attribute_name?: string | null;
  is_primary?: boolean;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku: string;
  diameter?: number | null;
  flute_length?: number | null;
  overall_length?: number | null;
  shank_diameter?: number | null;
  list_price: number;
  stock_quantity: number;
  /** Target stock level the auto purchase order restocks up to. Not customer-facing. */
  min_quantity?: number;
  /** Reorder threshold: auto PO fires when stock <= this. 0 disables auto-ordering. */
  trigger_quantity?: number;
  /** Customer-facing minimum order quantity (storefront). */
  min_order_quantity?: number;
  /** GST % for this SKU. null/undefined uses the sales-settings default. */
  gst_rate?: number | null;
  /** HSN/SAC code. null/undefined uses the sales-settings default. */
  hsn_code?: string | null;
  specifications?: Record<string, any>;
  is_archived?: boolean;
  archived_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type InventoryMovementType = 
  | 'INITIAL_IMPORT'
  | 'MANUAL_ADJUSTMENT'
  | 'BULK_UPDATE'
  | 'ORDER_RESERVATION'
  | 'ORDER_FULFILLED'
  | 'ORDER_CANCELLED'
  | 'RETURN_RESTOCK'
  | 'RESTOCK'
  | 'ARCHIVED';

export interface InventoryLog {
  id: string;
  variant_id?: string | null;
  product_id?: string | null;
  sku_code: string;
  product_title: string;
  movement_type: InventoryMovementType | string;
  quantity_delta: number;
  balance_before: number;
  balance_after: number;
  reference_id?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  order_number: string;
  variant_id: string;
  product_id: string;
  sku_code: string;
  product_title: string;
  min_quantity: number;
  trigger_quantity: number;
  actual_quantity: number;
  order_quantity: number;
  specifications: Record<string, any>;
  status: PurchaseOrderStatus;
  manufacturer_id?: string | null;
  notes?: string | null;
  placed_at: string;
  dispatched_at?: string | null;
  received_at?: string | null;
  /** True when raised automatically by the low-stock check (at most one open per SKU). */
  is_auto?: boolean;
  created_at: string;
  updated_at: string;
  product?: {
    id: string;
    title: string;
    slug?: string;
  };
  variant?: ProductVariant;
}

export type NotificationType =
  | "order"
  | "purchase_order"
  | "inventory"
  | "account"
  | "rfq"
  | "system"
  | "info";

export interface AppNotification {
  id: string;
  user_id?: string | null;
  role?: UserRole | null;
  title: string;
  message: string;
  type: NotificationType;
  link?: string | null;
  is_read: boolean;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}


export interface Attribute {
  id: string;
  name: string;
  slug: string;
  type?: string;
  created_at?: string;
}

// Backward compatibility alias
export type Tag = Attribute;

export interface ProductAttribute {
  product_id: string;
  attribute_id: string;
  created_at?: string;
}

// Backward compatibility alias
export type ProductTag = ProductAttribute;

export interface Product {
  id: string;
  title: string;
  slug: string;
  short_description?: string | null;
  description?: string | null;
  images: ProductImage[];
  documents?: ProductDocument[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  variants?: ProductVariant[];
  categories?: Category[];
  attributes?: Attribute[];
  tags?: Attribute[]; // Backward compatibility alias
}

// ---- Coupons --------------------------------------------------------------------

export type CouponDiscountType = "percent" | "fixed";
export type CouponAppliesTo = "all" | "products" | "categories";
export type CouponCustomerScope = "all" | "selected";
export type CouponRedemptionStatus = "reserved" | "applied" | "released";

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: CouponDiscountType;
  /** Percent (0-100] or rupees, depending on discount_type. Numeric columns arrive as numbers or strings. */
  discount_value: number | string;
  max_discount: number | string | null;
  min_order_value: number | string;
  valid_from: string;
  valid_until: string | null;
  /** null = unlimited */
  max_total_uses: number | null;
  /** null = unlimited, 1 = one-time use */
  max_uses_per_customer: number | null;
  first_order_only: boolean;
  can_combine: boolean;
  applies_to: CouponAppliesTo;
  customer_scope: CouponCustomerScope;
  is_active: boolean;
  version: number;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/** What checkout needs to evaluate a code; see coupon_checkout_context(). */
export interface CouponCheckoutContext {
  coupon: Coupon;
  product_ids: string[];
  /** Includes every sub-category of the categories chosen on the coupon. */
  category_ids: string[];
  customer_allowed: boolean;
  total_uses: number;
  customer_uses: number;
  has_prior_orders: boolean;
}

export interface CouponUsageSummary {
  coupon_id: string;
  active_uses: number | string;
  released_uses: number | string;
  total_discount: number | string;
}

/** GST basis of an order, frozen when it was placed (orders.tax_snapshot). */
export interface OrderTaxSnapshot {
  gst_enabled: boolean;
  seller_state_code: string | null;
  /** "24-Gujarat"; null when the customer's state was unknown. */
  place_of_supply: string | null;
  /** true: CGST + SGST; false: IGST. */
  intra_state: boolean;
  cgst: number;
  sgst: number;
  igst: number;
}

export interface CouponSnapshot {
  coupon_id: string;
  code: string;
  description: string | null;
  discount_type: CouponDiscountType;
  discount_value: number;
  max_discount: number | null;
  min_order_value: number;
  applies_to: CouponAppliesTo;
  first_order_only: boolean;
  version: number;
  eligible_subtotal?: number;
}

export interface CouponRedemption {
  id: string;
  coupon_id: string;
  order_id: string;
  user_id: string;
  coupon_code: string;
  discount_amount: number | string;
  status: CouponRedemptionStatus;
  expires_at: string | null;
  released_at: string | null;
  release_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Profile;
        Update: Partial<Profile>;
        Relationships: [];
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, "created_at" | "updated_at">;
        Update: Partial<Order>;
        Relationships: [];
      };
      categories: {
        Row: Category;
        Insert: Omit<Category, "id" | "created_at" | "updated_at">;
        Update: Partial<Category>;
        Relationships: [];
      };
      product_categories: {
        Row: ProductCategory;
        Insert: ProductCategory;
        Update: Partial<ProductCategory>;
        Relationships: [];
      };
      products: {
        Row: Product;
        Insert: Omit<Product, "id" | "created_at" | "updated_at">;
        Update: Partial<Product>;
        Relationships: [];
      };
      product_variants: {
        Row: ProductVariant;
        Insert: Omit<ProductVariant, "id" | "created_at" | "updated_at">;
        Update: Partial<ProductVariant>;
        Relationships: [];
      };
      attributes: {
        Row: Attribute;
        Insert: Omit<Attribute, "id" | "created_at">;
        Update: Partial<Attribute>;
        Relationships: [];
      };
      product_attributes: {
        Row: ProductAttribute;
        Insert: ProductAttribute;
        Update: Partial<ProductAttribute>;
        Relationships: [];
      };
      tags: {
        Row: Attribute;
        Insert: Omit<Attribute, "id" | "created_at">;
        Update: Partial<Attribute>;
        Relationships: [];
      };
      product_tags: {
        Row: ProductAttribute;
        Insert: ProductAttribute;
        Update: Partial<ProductAttribute>;
        Relationships: [];
      };
      contact_submissions: {
        Row: ContactSubmission;
        Insert: ContactSubmissionInsert;
        Update: ContactSubmissionUpdate;
        Relationships: [];
      };
      rfqs: {
        Row: RFQ;
        Insert: RFQInsert;
        Update: RFQUpdate;
        Relationships: [];
      };
      quotes: {
        Row: CommercialQuote;
        Insert: CommercialQuoteInsert;
        Update: CommercialQuoteUpdate;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_platform_owner: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      user_role: UserRole;
      order_status: OrderStatus;
      approval_status: ApprovalStatus;
      user_type: UserType;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
