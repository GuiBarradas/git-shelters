export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          dedupe_key: string | null
          event_name: string
          id: string
          occurred_at: string
          props_json: Json
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          dedupe_key?: string | null
          event_name: string
          id?: string
          occurred_at?: string
          props_json?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          dedupe_key?: string | null
          event_name?: string
          id?: string
          occurred_at?: string
          props_json?: Json
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          id: string
          ip_hash: string | null
          meta_json: Json
          occurred_at: string
          user_id: string | null
        }
        Insert: {
          action: string
          id?: string
          ip_hash?: string | null
          meta_json?: Json
          occurred_at?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          id?: string
          ip_hash?: string | null
          meta_json?: Json
          occurred_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      byte_transactions: {
        Row: {
          balance_after: number
          created_at: string
          delta: number
          id: string
          source: string
          source_ref: string
          user_id: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          delta: number
          id?: string
          source: string
          source_ref: string
          user_id: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          delta?: number
          id?: string
          source?: string
          source_ref?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "byte_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_event_outcomes: {
        Row: {
          choice: string
          event_id: string
          id: string
          outcome_json: Json
          resolved_at: string
          resolved_on: string
          user_id: string
        }
        Insert: {
          choice: string
          event_id: string
          id?: string
          outcome_json: Json
          resolved_at?: string
          resolved_on?: string
          user_id: string
        }
        Update: {
          choice?: string
          event_id?: string
          id?: string
          outcome_json?: Json
          resolved_at?: string
          resolved_on?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_event_outcomes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "daily_events_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_event_outcomes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_events_catalog: {
        Row: {
          active: boolean
          id: string
          narrative: string
          option_a: Json
          option_b: Json
          sort_order: number
          title: string
        }
        Insert: {
          active?: boolean
          id: string
          narrative: string
          option_a: Json
          option_b: Json
          sort_order: number
          title: string
        }
        Update: {
          active?: boolean
          id?: string
          narrative?: string
          option_a?: Json
          option_b?: Json
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      forks: {
        Row: {
          created_at: string
          id: string
          mood: string
          name: string
          room_slot: number | null
          seed: number
          trait: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mood?: string
          name: string
          room_slot?: number | null
          seed?: number
          trait: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mood?: string
          name?: string
          room_slot?: number | null
          seed?: number
          trait?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      github_sync_state: {
        Row: {
          backfill_at: string | null
          backfill_status: string
          last_event_id: string | null
          last_synced_at: string | null
          user_id: string
        }
        Insert: {
          backfill_at?: string | null
          backfill_status?: string
          last_event_id?: string | null
          last_synced_at?: string | null
          user_id: string
        }
        Update: {
          backfill_at?: string | null
          backfill_status?: string
          last_event_id?: string | null
          last_synced_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "github_sync_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          built_at: string
          kind: string
          level: number
          slot: number
          user_id: string
        }
        Insert: {
          built_at?: string
          kind: string
          level?: number
          slot: number
          user_id: string
        }
        Update: {
          built_at?: string
          kind?: string
          level?: number
          slot?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          bytes: number
          cache: number
          created_at: string
          deleted_at: string | null
          email: string | null
          github_id: number
          github_login: string
          id: string
          last_seen_at: string
          last_tick_at: string
          payload: number
          uptime: number
        }
        Insert: {
          bytes?: number
          cache?: number
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          github_id: number
          github_login: string
          id: string
          last_seen_at?: string
          last_tick_at?: string
          payload?: number
          uptime?: number
        }
        Update: {
          bytes?: number
          cache?: number
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          github_id?: number
          github_login?: string
          id?: string
          last_seen_at?: string
          last_tick_at?: string
          payload?: number
          uptime?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_tick: {
        Args: {
          p_cache: number
          p_expected_tick: string
          p_new_tick: string
          p_payload: number
          p_uptime: number
          p_user_id: string
        }
        Returns: boolean
      }
      assign_fork: {
        Args: { p_fork_id: string; p_slot: number; p_user_id: string }
        Returns: undefined
      }
      build_room: {
        Args: { p_kind: string; p_slot: number; p_user_id: string }
        Returns: number
      }
      credit_bytes_tx: {
        Args: {
          p_delta: number
          p_source: string
          p_source_ref: string
          p_user_id: string
        }
        Returns: number
      }
      credit_bytes_tx_batch: {
        Args: { p_credits: Json; p_user_id: string }
        Returns: number
      }
      ensure_starter_fork: {
        Args: { p_name: string; p_trait: string; p_user_id: string }
        Returns: string
      }
      pick_daily_event: { Args: { p_user_id: string }; Returns: string }
      recruit_fork: {
        Args: {
          p_cost: number
          p_name: string
          p_trait: string
          p_user_id: string
        }
        Returns: string
      }
      resolve_daily_event: {
        Args: { p_choice: string; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
