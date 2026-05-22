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
      activities: {
        Row: {
          actor_id: string | null
          application_id: string | null
          candidate_id: string | null
          client_id: string | null
          client_visible: boolean
          created_at: string
          detail: string | null
          id: string
          kind: Database["public"]["Enums"]["activity_kind"]
          occurred_at: string
          position_id: string | null
          title: string
        }
        Insert: {
          actor_id?: string | null
          application_id?: string | null
          candidate_id?: string | null
          client_id?: string | null
          client_visible?: boolean
          created_at?: string
          detail?: string | null
          id?: string
          kind: Database["public"]["Enums"]["activity_kind"]
          occurred_at?: string
          position_id?: string | null
          title: string
        }
        Update: {
          actor_id?: string | null
          application_id?: string | null
          candidate_id?: string | null
          client_id?: string | null
          client_visible?: boolean
          created_at?: string
          detail?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["activity_kind"]
          occurred_at?: string
          position_id?: string | null
          title?: string
        }
        Relationships: []
      }
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
      client_billing_terms: {
        Row: {
          billing_cycle: Database["public"]["Enums"]["billing_cycle"]
          client_id: string
          created_at: string
          currency: string
          fee_model: Database["public"]["Enums"]["fee_model"]
          fee_value: number
          gst_pct: number
          id: string
          invoice_day_of_month: number
          payment_terms_days: number
          po_number: string | null
          po_required: boolean
          replacement_policy: Database["public"]["Enums"]["replacement_policy"]
          replacement_window_days: number
          tds_pct: number
          tiers: Json
          updated_at: string
        }
        Insert: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          client_id: string
          created_at?: string
          currency?: string
          fee_model?: Database["public"]["Enums"]["fee_model"]
          fee_value?: number
          gst_pct?: number
          id?: string
          invoice_day_of_month?: number
          payment_terms_days?: number
          po_number?: string | null
          po_required?: boolean
          replacement_policy?: Database["public"]["Enums"]["replacement_policy"]
          replacement_window_days?: number
          tds_pct?: number
          tiers?: Json
          updated_at?: string
        }
        Update: {
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"]
          client_id?: string
          created_at?: string
          currency?: string
          fee_model?: Database["public"]["Enums"]["fee_model"]
          fee_value?: number
          gst_pct?: number
          id?: string
          invoice_day_of_month?: number
          payment_terms_days?: number
          po_number?: string | null
          po_required?: boolean
          replacement_policy?: Database["public"]["Enums"]["replacement_policy"]
          replacement_window_days?: number
          tds_pct?: number
          tiers?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_billing_terms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
      documents: {
        Row: {
          application_id: string | null
          candidate_id: string | null
          client_id: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["document_kind"]
          mime: string | null
          name: string
          notes: string | null
          position_id: string | null
          received: boolean
          required: boolean
          size_bytes: number | null
          storage_bucket: string | null
          storage_path: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          application_id?: string | null
          candidate_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          mime?: string | null
          name: string
          notes?: string | null
          position_id?: string | null
          received?: boolean
          required?: boolean
          size_bytes?: number | null
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          application_id?: string | null
          candidate_id?: string | null
          client_id?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          mime?: string | null
          name?: string
          notes?: string | null
          position_id?: string | null
          received?: boolean
          required?: boolean
          size_bytes?: number | null
          storage_bucket?: string | null
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
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
        Relationships: [
          {
            foreignKeyName: "interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          amount_inr: number
          candidate_name: string
          created_at: string
          ctc_inr: number | null
          fee_basis: string
          id: string
          invoice_id: string
          joining_date: string | null
          kind: Database["public"]["Enums"]["invoice_line_kind"]
          placement_id: string | null
          position_title: string
        }
        Insert: {
          amount_inr?: number
          candidate_name: string
          created_at?: string
          ctc_inr?: number | null
          fee_basis?: string
          id?: string
          invoice_id: string
          joining_date?: string | null
          kind?: Database["public"]["Enums"]["invoice_line_kind"]
          placement_id?: string | null
          position_title: string
        }
        Update: {
          amount_inr?: number
          candidate_name?: string
          created_at?: string
          ctc_inr?: number | null
          fee_basis?: string
          id?: string
          invoice_id?: string
          joining_date?: string | null
          kind?: Database["public"]["Enums"]["invoice_line_kind"]
          placement_id?: string | null
          position_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_placement_id_fkey"
            columns: ["placement_id"]
            isOneToOne: false
            referencedRelation: "placements"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          due_date: string
          gst_inr: number
          id: string
          invoice_no: string
          issue_date: string
          notes: string | null
          period_from: string
          period_to: string
          po_number: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal_inr: number
          tds_inr: number
          total_inr: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          due_date: string
          gst_inr?: number
          id?: string
          invoice_no: string
          issue_date: string
          notes?: string | null
          period_from: string
          period_to: string
          po_number?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_inr?: number
          tds_inr?: number
          total_inr?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string
          gst_inr?: number
          id?: string
          invoice_no?: string
          issue_date?: string
          notes?: string | null
          period_from?: string
          period_to?: string
          po_number?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal_inr?: number
          tds_inr?: number
          total_inr?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          client_id: string
          created_at: string
          id: string
          last_message_at: string | null
          pinned: boolean
          subject: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          pinned?: boolean
          subject?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          pinned?: boolean
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachments: Json
          author_name: string
          body: string
          created_at: string
          id: string
          initials: string
          read_by_client_at: string | null
          read_by_staff_at: string | null
          sender_id: string | null
          sender_role: Database["public"]["Enums"]["message_sender_role"]
          thread_id: string
        }
        Insert: {
          attachments?: Json
          author_name: string
          body?: string
          created_at?: string
          id?: string
          initials: string
          read_by_client_at?: string | null
          read_by_staff_at?: string | null
          sender_id?: string | null
          sender_role: Database["public"]["Enums"]["message_sender_role"]
          thread_id: string
        }
        Update: {
          attachments?: Json
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          initials?: string
          read_by_client_at?: string | null
          read_by_staff_at?: string | null
          sender_id?: string | null
          sender_role?: Database["public"]["Enums"]["message_sender_role"]
          thread_id?: string
        }
        Relationships: []
      }
      notification_dedup: {
        Row: {
          created_at: string
          dedup_key: string
        }
        Insert: {
          created_at?: string
          dedup_key: string
        }
        Update: {
          created_at?: string
          dedup_key?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          link: string | null
          read_at: string | null
          related_interview_id: string | null
          related_invoice_id: string | null
          related_task_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          link?: string | null
          read_at?: string | null
          related_interview_id?: string | null
          related_invoice_id?: string | null
          related_task_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          link?: string | null
          read_at?: string | null
          related_interview_id?: string | null
          related_invoice_id?: string | null
          related_task_id?: string | null
          title?: string
          user_id?: string
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
        Relationships: [
          {
            foreignKeyName: "placements_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "placements_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          assigned_recruiter_id: string | null
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
          assigned_recruiter_id?: string | null
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
          assigned_recruiter_id?: string | null
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
      tasks: {
        Row: {
          application_id: string | null
          assigned_to: string | null
          candidate_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          due_at: string | null
          due_label: string | null
          id: string
          kind: string
          notes: string | null
          position_id: string | null
          sla: Database["public"]["Enums"]["task_sla"]
          state: Database["public"]["Enums"]["task_state"]
          title: string
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          assigned_to?: string | null
          candidate_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          due_label?: string | null
          id?: string
          kind?: string
          notes?: string | null
          position_id?: string | null
          sla?: Database["public"]["Enums"]["task_sla"]
          state?: Database["public"]["Enums"]["task_state"]
          title: string
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          assigned_to?: string | null
          candidate_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          due_label?: string | null
          id?: string
          kind?: string
          notes?: string | null
          position_id?: string | null
          sla?: Database["public"]["Enums"]["task_sla"]
          state?: Database["public"]["Enums"]["task_state"]
          title?: string
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
      is_client_owner_of_thread: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      activity_kind:
        | "call"
        | "shortlist"
        | "share"
        | "interview_scheduled"
        | "interview_completed"
        | "offer"
        | "closure"
        | "note"
        | "submission"
        | "document"
        | "message"
        | "stage_change"
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
      billing_cycle: "monthly" | "per_joining"
      candidate_source: "manual" | "scout" | "referral" | "database" | "inbound"
      client_status: "active" | "inactive"
      document_kind: "jd" | "onboarding" | "offer" | "resume" | "other"
      fee_model: "percent_ctc" | "flat_per_hire" | "tiered"
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
      invoice_line_kind:
        | "placement"
        | "replacement_covered"
        | "credit_left_in_window"
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
      message_sender_role: "staff" | "client"
      notification_kind:
        | "interview_reminder"
        | "task_sla_breach"
        | "invoice_overdue"
        | "system"
      position_priority: "high" | "medium" | "low"
      position_status: "open" | "in_progress" | "interviews" | "closed"
      profile_status: "pending" | "active" | "rejected"
      replacement_policy: "free_replacement" | "pro_rata_credit" | "none"
      task_sla: "ok" | "warning" | "breach"
      task_state:
        | "Pending"
        | "Ongoing"
        | "Interview Pending"
        | "Closed"
        | "Reopened"
        | "No-show"
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
      activity_kind: [
        "call",
        "shortlist",
        "share",
        "interview_scheduled",
        "interview_completed",
        "offer",
        "closure",
        "note",
        "submission",
        "document",
        "message",
        "stage_change",
      ],
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
      billing_cycle: ["monthly", "per_joining"],
      candidate_source: ["manual", "scout", "referral", "database", "inbound"],
      client_status: ["active", "inactive"],
      document_kind: ["jd", "onboarding", "offer", "resume", "other"],
      fee_model: ["percent_ctc", "flat_per_hire", "tiered"],
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
      invoice_line_kind: [
        "placement",
        "replacement_covered",
        "credit_left_in_window",
      ],
      invoice_status: ["draft", "sent", "paid", "overdue", "cancelled"],
      message_sender_role: ["staff", "client"],
      notification_kind: [
        "interview_reminder",
        "task_sla_breach",
        "invoice_overdue",
        "system",
      ],
      position_priority: ["high", "medium", "low"],
      position_status: ["open", "in_progress", "interviews", "closed"],
      profile_status: ["pending", "active", "rejected"],
      replacement_policy: ["free_replacement", "pro_rata_credit", "none"],
      task_sla: ["ok", "warning", "breach"],
      task_state: [
        "Pending",
        "Ongoing",
        "Interview Pending",
        "Closed",
        "Reopened",
        "No-show",
      ],
    },
  },
} as const
