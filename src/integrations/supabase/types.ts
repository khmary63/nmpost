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
  public: {
    Tables: {
      ai_model_settings: {
        Row: {
          id: string
          model_id: string
          setting_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          model_id: string
          setting_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          model_id?: string
          setting_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      channel_settings: {
        Row: {
          channel: string
          channel_chat_id: string
          created_at: string
          id: string
          is_active: boolean
          manager_url: string
          personal_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          channel_chat_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          manager_url?: string
          personal_url?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          channel_chat_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          manager_url?: string
          personal_url?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_kopecks: number
          created_at: string
          id: string
          order_id: string
          payment_url: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          raw_response: Json | null
          raw_webhook: Json | null
          status: string
          tbank_payment_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_kopecks: number
          created_at?: string
          id?: string
          order_id: string
          payment_url?: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          raw_response?: Json | null
          raw_webhook?: Json | null
          status?: string
          tbank_payment_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_kopecks?: number
          created_at?: string
          id?: string
          order_id?: string
          payment_url?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          raw_response?: Json | null
          raw_webhook?: Json | null
          status?: string
          tbank_payment_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          channels: string[]
          content: string
          created_at: string
          id: string
          image_url: string | null
          include_footer: boolean
          published_at: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["post_status"]
          style: Database["public"]["Enums"]["post_style"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channels?: string[]
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          include_footer?: boolean
          published_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          style?: Database["public"]["Enums"]["post_style"]
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channels?: string[]
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          include_footer?: boolean
          published_at?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          style?: Database["public"]["Enums"]["post_style"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          current_period_start: string
          id: string
          is_active: boolean
          plan: Database["public"]["Enums"]["plan_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          is_active?: boolean
          plan?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          is_active?: boolean
          plan?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          status: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      usage_counters: {
        Row: {
          ai_image_count: number
          ai_text_count: number
          content_plan_count: number
          created_at: string
          id: string
          period_month: string
          posts_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_image_count?: number
          ai_text_count?: number
          content_plan_count?: number
          created_at?: string
          id?: string
          period_month: string
          posts_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_image_count?: number
          ai_text_count?: number
          content_plan_count?: number
          created_at?: string
          id?: string
          period_month?: string
          posts_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_subscription: {
        Args: {
          _months?: number
          _plan: Database["public"]["Enums"]["plan_tier"]
          _user_id: string
        }
        Returns: undefined
      }
      check_and_increment_usage: {
        Args: { _resource: string; _user_id: string }
        Returns: Json
      }
      get_ai_model: {
        Args: { _default: string; _key: string }
        Returns: string
      }
      get_current_usage: {
        Args: { _user_id: string }
        Returns: {
          ai_image_count: number
          ai_text_count: number
          content_plan_count: number
          posts_count: number
        }[]
      }
      get_plan_limits: {
        Args: { _plan: Database["public"]["Enums"]["plan_tier"] }
        Returns: Json
      }
      get_user_plan: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["plan_tier"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "agent"
      plan_tier: "free" | "basic" | "pro"
      post_status: "draft" | "scheduled" | "published"
      post_style: "minimal" | "bold" | "elegant" | "creative"
      support_ticket_status: "new" | "in_progress" | "resolved" | "closed"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "agent"],
      plan_tier: ["free", "basic", "pro"],
      post_status: ["draft", "scheduled", "published"],
      post_style: ["minimal", "bold", "elegant", "creative"],
      support_ticket_status: ["new", "in_progress", "resolved", "closed"],
    },
  },
} as const
