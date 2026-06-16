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
          agency_id: string
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
          agency_id: string
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
          agency_id?: string
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
        Relationships: [
          {
            foreignKeyName: "activities_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agencies: {
        Row: {
          created_at: string
          id: string
          mrr_cents: number
          name: string
          notes: string | null
          owner_user_id: string | null
          plan: Database["public"]["Enums"]["agency_plan"]
          slug: string
          status: Database["public"]["Enums"]["agency_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mrr_cents?: number
          name: string
          notes?: string | null
          owner_user_id?: string | null
          plan?: Database["public"]["Enums"]["agency_plan"]
          slug: string
          status?: Database["public"]["Enums"]["agency_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mrr_cents?: number
          name?: string
          notes?: string | null
          owner_user_id?: string | null
          plan?: Database["public"]["Enums"]["agency_plan"]
          slug?: string
          status?: Database["public"]["Enums"]["agency_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agency_members: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          role_in_agency: string
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          role_in_agency?: string
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          role_in_agency?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_members_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          agency_id: string
          candidate_id: string
          created_at: string
          created_by: string | null
          id: string
          match_score: number | null
          notes: string | null
          position_id: string
          stage: Database["public"]["Enums"]["application_stage"]
          submitted_by_kind: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          candidate_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          match_score?: number | null
          notes?: string | null
          position_id: string
          stage?: Database["public"]["Enums"]["application_stage"]
          submitted_by_kind?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          candidate_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          match_score?: number | null
          notes?: string | null
          position_id?: string
          stage?: Database["public"]["Enums"]["application_stage"]
          submitted_by_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
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
          agency_id: string
          created_at: string
          created_by: string | null
          current_company: string | null
          email: string | null
          experience: string | null
          id: string
          linkedin_url: string | null
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
          agency_id: string
          created_at?: string
          created_by?: string | null
          current_company?: string | null
          email?: string | null
          experience?: string | null
          id?: string
          linkedin_url?: string | null
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
          agency_id?: string
          created_at?: string
          created_by?: string | null
          current_company?: string | null
          email?: string | null
          experience?: string | null
          id?: string
          linkedin_url?: string | null
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
        Relationships: [
          {
            foreignKeyName: "candidates_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      client_billing_terms: {
        Row: {
          agency_id: string
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
          agency_id: string
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
          agency_id?: string
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
            foreignKeyName: "client_billing_terms_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_billing_terms_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_custom_roles: {
        Row: {
          client_id: string
          created_at: string
          id: string
          name: string
          permissions: string[]
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          name: string
          permissions?: string[]
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          name?: string
          permissions?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_custom_roles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_members: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          custom_role_id: string | null
          full_name: string | null
          id: string
          invited_email: string | null
          role: Database["public"]["Enums"]["client_member_role"] | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          custom_role_id?: string | null
          full_name?: string | null
          id?: string
          invited_email?: string | null
          role?: Database["public"]["Enums"]["client_member_role"] | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          custom_role_id?: string | null
          full_name?: string | null
          id?: string
          invited_email?: string | null
          role?: Database["public"]["Enums"]["client_member_role"] | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_members_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "client_custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_role_permissions: {
        Row: {
          client_id: string
          created_at: string
          id: string
          permissions: string[]
          role: Database["public"]["Enums"]["client_member_role"]
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          permissions?: string[]
          role: Database["public"]["Enums"]["client_member_role"]
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          permissions?: string[]
          role?: Database["public"]["Enums"]["client_member_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_role_permissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          agency_id: string
          color: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          gst_number: string | null
          id: string
          industry: string | null
          last_activity_at: string | null
          name: string
          notes: string | null
          pan_number: string | null
          registered_address: string | null
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
          user_id: string | null
          website: string | null
        }
        Insert: {
          agency_id: string
          color?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          gst_number?: string | null
          id?: string
          industry?: string | null
          last_activity_at?: string | null
          name: string
          notes?: string | null
          pan_number?: string | null
          registered_address?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Update: {
          agency_id?: string
          color?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          gst_number?: string | null
          id?: string
          industry?: string | null
          last_activity_at?: string | null
          name?: string
          notes?: string | null
          pan_number?: string | null
          registered_address?: string | null
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          agency_id: string
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
          agency_id: string
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
          agency_id?: string
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
        Relationships: [
          {
            foreignKeyName: "documents_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_round_templates: {
        Row: {
          agency_id: string
          archived: boolean
          created_at: string
          created_by: string | null
          default_conducted_by: Database["public"]["Enums"]["interview_conductor"]
          default_duration_minutes: number
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          agency_id: string
          archived?: boolean
          created_at?: string
          created_by?: string | null
          default_conducted_by?: Database["public"]["Enums"]["interview_conductor"]
          default_duration_minutes?: number
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          agency_id?: string
          archived?: boolean
          created_at?: string
          created_by?: string | null
          default_conducted_by?: Database["public"]["Enums"]["interview_conductor"]
          default_duration_minutes?: number
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_round_templates_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          agency_id: string
          application_id: string
          candidate_id: string
          candidate_reminder: boolean
          conducted_by: Database["public"]["Enums"]["interview_conductor"]
          created_at: string
          created_by: string | null
          custom_kind_label: string | null
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
          agency_id: string
          application_id: string
          candidate_id: string
          candidate_reminder?: boolean
          conducted_by?: Database["public"]["Enums"]["interview_conductor"]
          created_at?: string
          created_by?: string | null
          custom_kind_label?: string | null
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
          agency_id?: string
          application_id?: string
          candidate_id?: string
          candidate_reminder?: boolean
          conducted_by?: Database["public"]["Enums"]["interview_conductor"]
          created_at?: string
          created_by?: string | null
          custom_kind_label?: string | null
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
            foreignKeyName: "interviews_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
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
          agency_id: string
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
          agency_id: string
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
          agency_id?: string
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
            foreignKeyName: "invoice_line_items_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
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
          agency_id: string
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
          agency_id: string
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
          agency_id?: string
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
            foreignKeyName: "invoices_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
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
          agency_id: string
          client_id: string
          created_at: string
          id: string
          last_message_at: string | null
          pinned: boolean
          subject: string | null
          updated_at: string
        }
        Insert: {
          agency_id: string
          client_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          pinned?: boolean
          subject?: string | null
          updated_at?: string
        }
        Update: {
          agency_id?: string
          client_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          pinned?: boolean
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
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
          agency_id: string
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
          agency_id: string
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
          agency_id?: string
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
            foreignKeyName: "placements_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
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
      position_sourced_matches: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          match_score: number | null
          position_id: string
          reasoning: string | null
          rejected: boolean
          rejected_reason: string | null
          run_id: string | null
          shortlisted_candidate_id: string | null
          sourced_candidate_id: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          match_score?: number | null
          position_id: string
          reasoning?: string | null
          rejected?: boolean
          rejected_reason?: string | null
          run_id?: string | null
          shortlisted_candidate_id?: string | null
          sourced_candidate_id: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          match_score?: number | null
          position_id?: string
          reasoning?: string | null
          rejected?: boolean
          rejected_reason?: string | null
          run_id?: string | null
          shortlisted_candidate_id?: string | null
          sourced_candidate_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "position_sourced_matches_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_sourced_matches_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "position_sourcing_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_sourced_matches_sourced_candidate_id_fkey"
            columns: ["sourced_candidate_id"]
            isOneToOne: false
            referencedRelation: "sourced_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      position_sourcing_runs: {
        Row: {
          agency_id: string
          apify_run_ids: Json
          cost_credits: number | null
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          position_id: string
          result_count: number
          sources: string[]
          status: Database["public"]["Enums"]["sourcing_run_status"]
          triggered_by: string | null
        }
        Insert: {
          agency_id: string
          apify_run_ids?: Json
          cost_credits?: number | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          position_id: string
          result_count?: number
          sources?: string[]
          status?: Database["public"]["Enums"]["sourcing_run_status"]
          triggered_by?: string | null
        }
        Update: {
          agency_id?: string
          apify_run_ids?: Json
          cost_credits?: number | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          position_id?: string
          result_count?: number
          sources?: string[]
          status?: Database["public"]["Enums"]["sourcing_run_status"]
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "position_sourcing_runs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          agency_id: string
          assigned_recruiter_id: string | null
          client_assignee_id: string | null
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
          recruitment_model: Database["public"]["Enums"]["recruitment_model"]
          salary: string | null
          skills: string[]
          status: Database["public"]["Enums"]["position_status"]
          title: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          assigned_recruiter_id?: string | null
          client_assignee_id?: string | null
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
          recruitment_model?: Database["public"]["Enums"]["recruitment_model"]
          salary?: string | null
          skills?: string[]
          status?: Database["public"]["Enums"]["position_status"]
          title: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          assigned_recruiter_id?: string | null
          client_assignee_id?: string | null
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
          recruitment_model?: Database["public"]["Enums"]["recruitment_model"]
          salary?: string | null
          skills?: string[]
          status?: Database["public"]["Enums"]["position_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "positions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
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
      scout_source_settings: {
        Row: {
          actor_slug: string | null
          agency_id: string
          enabled: boolean
          source_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          actor_slug?: string | null
          agency_id: string
          enabled?: boolean
          source_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          actor_slug?: string | null
          agency_id?: string
          enabled?: boolean
          source_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scout_source_settings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      sourced_candidates: {
        Row: {
          agency_id: string
          avatar_url: string | null
          created_at: string
          current_company: string | null
          email: string | null
          experience_years: number | null
          headline: string | null
          id: string
          last_seen_at: string
          location: string | null
          name: string
          phone: string | null
          profile_url: string | null
          raw: Json
          skills: string[]
          source: string
          source_profile_id: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          avatar_url?: string | null
          created_at?: string
          current_company?: string | null
          email?: string | null
          experience_years?: number | null
          headline?: string | null
          id?: string
          last_seen_at?: string
          location?: string | null
          name: string
          phone?: string | null
          profile_url?: string | null
          raw?: Json
          skills?: string[]
          source: string
          source_profile_id: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          avatar_url?: string | null
          created_at?: string
          current_company?: string | null
          email?: string | null
          experience_years?: number | null
          headline?: string | null
          id?: string
          last_seen_at?: string
          location?: string | null
          name?: string
          phone?: string | null
          profile_url?: string | null
          raw?: Json
          skills?: string[]
          source?: string
          source_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sourced_candidates_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          agency_id: string | null
          assigned_to: string | null
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          priority: string
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          type: Database["public"]["Enums"]["ticket_type"]
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          assigned_to?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          priority?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          assigned_to?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          priority?: string
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          type?: Database["public"]["Enums"]["ticket_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          agency_id: string
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
          agency_id: string
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
          agency_id?: string
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
        Relationships: [
          {
            foreignKeyName: "tasks_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
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
      current_user_agency_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_agency_member: { Args: { _agency_id: string }; Returns: boolean }
      is_client_owner: {
        Args: { _client_id: string; _user_id: string }
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
      is_client_team_member: {
        Args: { _client_id: string; _user_id: string }
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
      agency_plan: "starter" | "professional" | "enterprise"
      agency_status: "trial" | "active" | "suspended" | "rejected" | "pending"
      app_role:
        | "admin"
        | "recruiter"
        | "client"
        | "lead_recruiter"
        | "senior_recruiter"
        | "super_admin"
      application_stage:
        | "sourcing"
        | "recruiter_shortlist"
        | "shared_with_client"
        | "client_shortlist"
        | "interview_scheduled"
        | "rounds"
        | "offered"
        | "closed"
        | "client_rejected"
      billing_cycle: "monthly" | "per_joining"
      candidate_source: "manual" | "scout" | "referral" | "database" | "inbound"
      client_member_role: "client_admin" | "client_recruiter" | "client_viewer"
      client_status: "active" | "inactive"
      document_kind: "jd" | "onboarding" | "offer" | "resume" | "other"
      fee_model: "percent_ctc" | "flat_per_hire" | "tiered"
      interview_conductor: "recruiter" | "client"
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
        | "invoice_due"
      position_priority: "high" | "medium" | "low"
      position_status: "open" | "in_progress" | "interviews" | "closed"
      profile_status: "pending" | "active" | "rejected"
      recruitment_model: "agency" | "self" | "hybrid"
      replacement_policy: "free_replacement" | "pro_rata_credit" | "none"
      sourcing_run_status: "pending" | "running" | "succeeded" | "failed"
      task_sla: "ok" | "warning" | "breach"
      task_state:
        | "Pending"
        | "Ongoing"
        | "Interview Pending"
        | "Closed"
        | "Reopened"
        | "No-show"
      ticket_status: "open" | "in_progress" | "resolved" | "closed"
      ticket_type: "support" | "billing" | "feature_request"
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
      agency_plan: ["starter", "professional", "enterprise"],
      agency_status: ["trial", "active", "suspended", "rejected", "pending"],
      app_role: [
        "admin",
        "recruiter",
        "client",
        "lead_recruiter",
        "senior_recruiter",
        "super_admin",
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
        "client_rejected",
      ],
      billing_cycle: ["monthly", "per_joining"],
      candidate_source: ["manual", "scout", "referral", "database", "inbound"],
      client_member_role: ["client_admin", "client_recruiter", "client_viewer"],
      client_status: ["active", "inactive"],
      document_kind: ["jd", "onboarding", "offer", "resume", "other"],
      fee_model: ["percent_ctc", "flat_per_hire", "tiered"],
      interview_conductor: ["recruiter", "client"],
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
        "invoice_due",
      ],
      position_priority: ["high", "medium", "low"],
      position_status: ["open", "in_progress", "interviews", "closed"],
      profile_status: ["pending", "active", "rejected"],
      recruitment_model: ["agency", "self", "hybrid"],
      replacement_policy: ["free_replacement", "pro_rata_credit", "none"],
      sourcing_run_status: ["pending", "running", "succeeded", "failed"],
      task_sla: ["ok", "warning", "breach"],
      task_state: [
        "Pending",
        "Ongoing",
        "Interview Pending",
        "Closed",
        "Reopened",
        "No-show",
      ],
      ticket_status: ["open", "in_progress", "resolved", "closed"],
      ticket_type: ["support", "billing", "feature_request"],
    },
  },
} as const
