export type UserRole = "platform_owner" | "customer";
export type UserTitle = "Mr" | "Mrs" | "Miss" | "Ms";
export type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

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
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
