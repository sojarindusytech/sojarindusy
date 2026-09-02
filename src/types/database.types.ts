import {
  UserRole,
  UserTitle,
  OrderStatus,
  ApprovalStatus,
  UserType,
  CustomerChannel,
} from "@/lib/constants";

export type { UserRole, UserTitle, OrderStatus, ApprovalStatus, UserType, CustomerChannel };

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
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Order {
  id: string;
  user_id: string;
  order_number: string;
  status: OrderStatus;
  total_amount: number;
  items: OrderItem[];
  shipping_address: string;
  notes?: string | null;
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

export interface ProductImage {
  id?: string;
  url: string;
  title: string;
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
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  variants?: ProductVariant[];
  categories?: Category[];
  attributes?: Attribute[];
  tags?: Attribute[]; // Backward compatibility alias
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
