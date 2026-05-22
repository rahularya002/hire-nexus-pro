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
      applications: {
        Row: {
          candidate_id: string
          created_at: string
          created_by: string | null
          id: string
          match_score: number | null
          notes: string | null
          position_id: string
          stage: Database["public"]["Enums"]["application_stage"]
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          match_score?: number | null
          notes?: string | null
          position_id: string
          stage?: Database["public"]["Enums"]["application_stage"]
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          match_score?: number | null
          notes?: string | null
          position_id?: string
          stage?: Database["public"]["Enums"]["application_stage"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          created_at: string
          created_by: string | null
          current_company: string | null
          email: string | null
          experience: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          phone: string | null
          resume_url: string | null
          role: string | null
          skills: string[]
          source: Database["public"]["Enums"]["candidate_source"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_company?: string | null
          email?: string | null
          experience?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          resume_url?: string | null
          role?: string | null
          skills?: string[]
          source?: Database["public"]["Enums"]["candidate_source"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_company?: string | null
          email?: string | null
          experience?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          resume_url?: string | null
          role?: string | null
          skills?: string[]
          source?: Database["public"]["Enums"]["candidate_source"]
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          color: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          industry: string | null
          last_activity_at: string | null
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          color?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          last_activity_at?: string | null
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          color?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: string | null
          last_activity_at?: string | null
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      interviews: {
        Row: {
          application_id: string
          candidate_id: string
          candidate_reminder: boolean
          created_at: string
          created_by: string | null
          cv_attached: boolean
          duration_minutes: number | null
          id: string
          interviewer: string | null
          kind: Database["public"]["Enums"]["interview_kind"]
          location: string | null
          meeting_link: string | null
          notes: string | null
          position_id: string
          provider: Database["public"]["Enums"]["interview_provider"]
          recruiter_reminder: boolean
          round_index: number
          scheduled_at: string | null
          status: Database["public"]["Enums"]["interview_status"]
          updated_at: string
        }
        Insert: {
          application_id: string
          candidate_id: string
          candidate_reminder?: boolean
          created_at?: string
          created_by?: string | null
          cv_attached?: boolean
          duration_minutes?: number | null
          id?: string
          interviewer?: string | null
          kind?: Database["public"]["Enums"]["interview_kind"]
          location?: string | null
          meeting_link?: string | null
          notes?: string | null
          position_id: string
          provider?: Database["public"]["Enums"]["interview_provider"]
          recruiter_reminder?: boolean
          round_index?: number
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["interview_status"]
          updated_at?: string
        }
        Update: {
          application_id?: string
          candidate_id?: string
          candidate_reminder?: boolean
          created_at?: string
          created_by?: string | null
          cv_attached?: boolean
          duration_minutes?: number | null
          id?: string
          interviewer?: string | null
          kind?: Database["public"]["Enums"]["interview_kind"]
          location?: string | null
          meeting_link?: string | null
          notes?: string | null
          position_id?: string
          provider?: Database["public"]["Enums"]["interview_provider"]
          recruiter_reminder?: boolean
          round_index?: number
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["interview_status"]
          updated_at?: string
        }
        Relationships: []
      }
      placements: {
        Row: {
          application_id: string
          candidate_id: string
          client_id: string
          created_at: string
          created_by: string | null
          ctc_display: string | null
          ctc_inr: number | null
          guarantee_window_days: number
          id: string
          invoice_amount_inr: number | null
          invoice_status: Database["public"]["Enums"]["invoice_status"]
          joining_date: string | null
          notes: string | null
          offer_date: string | null
          position_id: string
          updated_at: string
        }
        Insert: {
          application_id: string
          candidate_id: string
          client_id: string
          created_at?: string
          created_by?: string | null
          ctc_display?: string | null
          ctc_inr?: number | null
          guarantee_window_days?: number
          id?: string
          invoice_amount_inr?: number | null
          invoice_status?: Database["public"]["Enums"]["invoice_status"]
          joining_date?: string | null
          notes?: string | null
          offer_date?: string | null
          position_id: string
          updated_at?: string
        }
        Update: {
          application_id?: string
          candidate_id?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          ctc_display?: string | null
          ctc_inr?: number | null
          guarantee_window_days?: number
          id?: string
          invoice_amount_inr?: number | null
          invoice_status?: Database["public"]["Enums"]["invoice_status"]
          joining_date?: string | null
          notes?: string | null
          offer_date?: string | null
          position_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      positions: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          experience: string | null
          id: string
          location: string | null
          openings: number
          posted_at: string
          priority: Database["public"]["Enums"]["position_priority"]
          salary: string | null
          skills: string[]
          status: Database["public"]["Enums"]["position_status"]
          title: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          experience?: string | null
          id?: string
          location?: string | null
          openings?: number
          posted_at?: string
          priority?: Database["public"]["Enums"]["position_priority"]
          salary?: string | null
          skills?: string[]
          status?: Database["public"]["Enums"]["position_status"]
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          experience?: string | null
          id?: string
          location?: string | null
          openings?: number
          posted_at?: string
          priority?: Database["public"]["Enums"]["position_priority"]
          salary?: string | null
          skills?: string[]
          status?: Database["public"]["Enums"]["position_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_name: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permissions: string[]
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          permissions?: string[]
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          permissions?: string[]
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_client_owner_of_position: {
        Args: { _position_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "recruiter"
        | "client"
        | "lead_recruiter"
        | "senior_recruiter"
      application_stage:
        | "sourcing"
        | "recruiter_shortlist"
        | "shared_with_client"
        | "client_shortlist"
        | "interview_scheduled"
        | "rounds"
        | "offered"
        | "closed"
      candidate_source: "manual" | "scout" | "referral" | "database" | "inbound"
      client_status: "active" | "inactive"
      interview_kind:
        | "hr_screen"
        | "technical"
        | "hiring_manager"
        | "panel"
        | "ceo"
        | "culture_fit"
        | "case_study"
      interview_provider:
        | "google_meet"
        | "microsoft_teams"
        | "zoom"
        | "on_site"
        | "phone"
      interview_status:
        | "pending_confirmation"
        | "confirmed"
        | "reschedule_requested"
        | "completed"
        | "no_show"
        | "cancelled"
      invoice_status: "draft" | "sent" | "paid" | "overdue"
      position_priority: "high" | "medium" | "low"
      position_status: "open" | "in_progress" | "interviews" | "closed"
      profile_status: "pending" | "active" | "rejected"
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
      app_role: [
        "admin",
        "recruiter",
        "client",
        "lead_recruiter",
        "senior_recruiter",
      ],
      application_stage: [
        "sourcing",
        "recruiter_shortlist",
        "shared_with_client",
        "client_shortlist",
        "interview_scheduled",
        "rounds",
        "offered",
        "closed",
      ],
      candidate_source: ["manual", "scout", "referral", "database", "inbound"],
      client_status: ["active", "inactive"],
      interview_kind: [
        "hr_screen",
        "technical",
        "hiring_manager",
        "panel",
        "ceo",
        "culture_fit",
        "case_study",
      ],
      interview_provider: [
        "google_meet",
        "microsoft_teams",
        "zoom",
        "on_site",
        "phone",
      ],
      interview_status: [
        "pending_confirmation",
        "confirmed",
        "reschedule_requested",
        "completed",
        "no_show",
        "cancelled",
      ],
      invoice_status: ["draft", "sent", "paid", "overdue"],
      position_priority: ["high", "medium", "low"],
      position_status: ["open", "in_progress", "interviews", "closed"],
      profile_status: ["pending", "active", "rejected"],
    },
  },
} as const
