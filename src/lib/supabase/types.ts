// Hand-written to mirror supabase/schema.sql. If you edit the schema, run
// `npx supabase gen types typescript` against your project to regenerate
// this properly instead of hand-editing both places.

export interface Database {
  public: {
    Tables: {
      firms: {
        Row: {
          id: string;
          dc_firm_id: number;
          dc_firm_name: string;
          treasury_jwt: string;
          treasury_jwt_expires_at: string | null;
          jwt_invalid: boolean;
          discord_webhook_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          dc_firm_id: number;
          dc_firm_name: string;
          treasury_jwt: string;
          treasury_jwt_expires_at?: string | null;
          jwt_invalid?: boolean;
          discord_webhook_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["firms"]["Insert"]>;
        Relationships: [];
      };
      firm_members: {
        Row: {
          id: string;
          firm_id: string;
          user_id: string;
          role: "owner" | "member";
          created_at: string;
        };
        Insert: {
          id?: string;
          firm_id: string;
          user_id: string;
          role?: "owner" | "member";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["firm_members"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "firm_members_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "firms";
            referencedColumns: ["id"];
          },
        ];
      };
      shops: {
        Row: {
          shop_id: number;
          firm_id: string;
          world: string;
          x: number;
          y: number;
          z: number;
          admin_shop: boolean;
          account_type: string | null;
          owner_uuid: string | null;
          owner_name: string | null;
          material: string | null;
          item_key: string;
          item_name: string | null;
          item_custom: boolean;
          buy_price: string | null;
          sell_price: string | null;
          batch_qty: number | null;
          current_stock: number | null;
          stock_at: string | null;
          last_seen: string | null;
          low_stock_threshold: number | null;
          notes: string | null;
          last_alert_state: "ok" | "low" | "empty";
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["shops"]["Row"]> & {
          shop_id: number;
          firm_id: string;
          world: string;
          x: number;
          y: number;
          z: number;
          item_key: string;
        };
        Update: Partial<Database["public"]["Tables"]["shops"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "shops_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "firms";
            referencedColumns: ["id"];
          },
        ];
      };
      poll_log: {
        Row: {
          id: string;
          firm_id: string;
          polled_at: string;
          success: boolean;
          shops_synced: number;
          error: string | null;
        };
        Insert: {
          id?: string;
          firm_id: string;
          polled_at?: string;
          success: boolean;
          shops_synced?: number;
          error?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["poll_log"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "poll_log_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "firms";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
