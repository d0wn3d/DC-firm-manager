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
          is_operator: boolean;
          deposit_account_id: number | null;
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
          is_operator?: boolean;
          deposit_account_id?: number | null;
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
          manual_stock: number | null;
          manual_stock_at: string | null;
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
      warehouse_manual_items: {
        Row: {
          id: string;
          firm_id: string;
          item_key: string;
          item_name: string;
          quantity: number;
          valuation_method: "lowest_shop_price" | "manual_price";
          manual_unit_price: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          firm_id: string;
          item_key: string;
          item_name: string;
          quantity?: number;
          valuation_method?: "lowest_shop_price" | "manual_price";
          manual_unit_price?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["warehouse_manual_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "warehouse_manual_items_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "firms";
            referencedColumns: ["id"];
          },
        ];
      };
      warehouse_price_overrides: {
        Row: {
          firm_id: string;
          item_key: string;
          manual_unit_price: number;
          updated_at: string;
        };
        Insert: {
          firm_id: string;
          item_key: string;
          manual_unit_price: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["warehouse_price_overrides"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "warehouse_price_overrides_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "firms";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger_accounts: {
        Row: {
          firm_id: string;
          account_type: "operating" | "savings";
          balance: number;
          locked_balance: number;
          updated_at: string;
        };
        Insert: {
          firm_id: string;
          account_type: "operating" | "savings";
          balance?: number;
          locked_balance?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ledger_accounts"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "ledger_accounts_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "firms";
            referencedColumns: ["id"];
          },
        ];
      };
      deposit_requests: {
        Row: {
          id: string;
          firm_id: string;
          requested_by: string;
          whole_dollar_amount: number;
          cents_code: number;
          status: "pending" | "matched" | "expired" | "cancelled";
          matched_posting_id: number | null;
          credited_amount: number | null;
          created_at: string;
          expires_at: string;
          matched_at: string | null;
        };
        Insert: {
          id?: string;
          firm_id: string;
          requested_by: string;
          whole_dollar_amount: number;
          cents_code: number;
          status?: "pending" | "matched" | "expired" | "cancelled";
          matched_posting_id?: number | null;
          credited_amount?: number | null;
          created_at?: string;
          expires_at: string;
          matched_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["deposit_requests"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "deposit_requests_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "firms";
            referencedColumns: ["id"];
          },
        ];
      };
      chart_of_accounts: {
        Row: {
          id: string;
          firm_id: string;
          code: string;
          name: string;
          type: "asset" | "liability" | "equity" | "income" | "expense";
          parent_id: string | null;
          is_system: boolean;
          archived: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          firm_id: string;
          code: string;
          name: string;
          type: "asset" | "liability" | "equity" | "income" | "expense";
          parent_id?: string | null;
          is_system?: boolean;
          archived?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chart_of_accounts"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "firms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "chart_of_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      journal_entries: {
        Row: {
          id: string;
          firm_id: string;
          account_id: number;
          posting_id: number;
          category_id: string | null;
          memo: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          firm_id: string;
          account_id: number;
          posting_id: number;
          category_id?: string | null;
          memo?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["journal_entries"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "journal_entries_firm_id_fkey";
            columns: ["firm_id"];
            isOneToOne: false;
            referencedRelation: "firms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "journal_entries_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "chart_of_accounts";
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
