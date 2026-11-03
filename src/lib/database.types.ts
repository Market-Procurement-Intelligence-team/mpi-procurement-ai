// Database types for the MPI Supabase project (schema: public).
// Generated from supabase/migrations up to 20261023120000, then extended by hand up to 20261102120000. To regenerate from
// the live project: npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "12"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          id: number
          actor_id: string | null
          org_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          details: Json
          created_at: string
        }
        Insert: {
          id?: number
          actor_id?: string | null
          org_id?: string | null
          action: string
          entity_type: string
          entity_id?: string | null
          details?: Json
          created_at?: string
        }
        Update: {
          id?: number
          actor_id?: string | null
          org_id?: string | null
          action?: string
          entity_type?: string
          entity_id?: string | null
          details?: Json
          created_at?: string
        }
        Relationships: []
      }
      catalogue_categories: {
        Row: {
          id: string
          slug: string
          name: string
          parent_id: string | null
          is_tangible: boolean
          sort_order: number
          is_active: boolean
          created_at: string
          payment_terms: string | null
        }
        Insert: {
          id?: string
          slug: string
          name: string
          parent_id?: string | null
          is_tangible?: boolean
          sort_order?: number
          is_active?: boolean
          created_at?: string
          payment_terms?: string | null
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          parent_id?: string | null
          is_tangible?: boolean
          sort_order?: number
          is_active?: boolean
          created_at?: string
          payment_terms?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalogue_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "catalogue_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogue_items: {
        Row: {
          id: string
          category_id: string
          name: string
          description: string | null
          unit: string
          is_tangible: boolean
          specs: Json
          image_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          category_id: string
          name: string
          description?: string | null
          unit?: string
          is_tangible?: boolean
          specs?: Json
          image_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          category_id?: string
          name?: string
          description?: string | null
          unit?: string
          is_tangible?: boolean
          specs?: Json
          image_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalogue_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "catalogue_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      government_schemes: {
        Row: {
          id: string
          code: string
          name: string
          short_name: string
          ministry: string | null
          department: string | null
          description: string | null
          nature_of_assistance: string | null
          max_assistance: string | null
          max_subsidy_pct: number | null
          who_can_apply: string[]
          eligibility: string[]
          how_to_apply: string[]
          documents_required: string[]
          key_benefits: string[]
          for_startups: boolean
          for_msmes: boolean
          category_ids: string[]
          industry_keywords: string[]
          stage_keywords: string[]
          procurement_triggers: string[]
          sector_specific: boolean
          official_url: string | null
          contact_office: string | null
          source: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          name: string
          short_name: string
          ministry?: string | null
          department?: string | null
          description?: string | null
          nature_of_assistance?: string | null
          max_assistance?: string | null
          max_subsidy_pct?: number | null
          who_can_apply?: string[]
          eligibility?: string[]
          how_to_apply?: string[]
          documents_required?: string[]
          key_benefits?: string[]
          for_startups?: boolean
          for_msmes?: boolean
          category_ids?: string[]
          industry_keywords?: string[]
          stage_keywords?: string[]
          procurement_triggers?: string[]
          sector_specific?: boolean
          official_url?: string | null
          contact_office?: string | null
          source?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          name?: string
          short_name?: string
          ministry?: string | null
          department?: string | null
          description?: string | null
          nature_of_assistance?: string | null
          max_assistance?: string | null
          max_subsidy_pct?: number | null
          who_can_apply?: string[]
          eligibility?: string[]
          how_to_apply?: string[]
          documents_required?: string[]
          key_benefits?: string[]
          for_startups?: boolean
          for_msmes?: boolean
          category_ids?: string[]
          industry_keywords?: string[]
          stage_keywords?: string[]
          procurement_triggers?: string[]
          sector_specific?: boolean
          official_url?: string | null
          contact_office?: string | null
          source?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string | null
          link: string | null
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          body?: string | null
          link?: string | null
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          body?: string | null
          link?: string | null
          read_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          id: string
          po_id: string
          status: Database["public"]["Enums"]["po_status"]
          changed_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          po_id: string
          status: Database["public"]["Enums"]["po_status"]
          changed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          po_id?: string
          status?: Database["public"]["Enums"]["po_status"]
          changed_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          id: string
          name: string
          type: Database["public"]["Enums"]["org_type"]
          gstin: string | null
          udyam_number: string | null
          city: string | null
          state: string | null
          verification_status: Database["public"]["Enums"]["verification_status"]
          verification_note: string | null
          verified_at: string | null
          verified_by: string | null
          display_name: string
          is_demo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          type: Database["public"]["Enums"]["org_type"]
          gstin?: string | null
          udyam_number?: string | null
          city?: string | null
          state?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verification_note?: string | null
          verified_at?: string | null
          verified_by?: string | null
          display_name: string
          is_demo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["org_type"]
          gstin?: string | null
          udyam_number?: string | null
          city?: string | null
          state?: string | null
          verification_status?: Database["public"]["Enums"]["verification_status"]
          verification_note?: string | null
          verified_at?: string | null
          verified_by?: string | null
          display_name?: string
          is_demo?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: boolean
          payment_terms: string
          updated_by: string | null
          updated_at: string
          offer_score_weights: Json
        }
        Insert: {
          id?: boolean
          payment_terms?: string
          updated_by?: string | null
          updated_at?: string
          offer_score_weights?: Json
        }
        Update: {
          id?: boolean
          payment_terms?: string
          updated_by?: string | null
          updated_at?: string
          offer_score_weights?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          full_name: string | null
          email: string | null
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          full_name?: string | null
          email?: string | null
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          full_name?: string | null
          email?: string | null
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          id: string
          po_number: string
          request_id: string
          quote_id: string
          buyer_org_id: string
          vendor_org_id: string
          status: Database["public"]["Enums"]["po_status"]
          total_amount: number
          currency: string
          approved_by: string
          approved_at: string
          expected_delivery: string | null
          status_changed_at: string
          created_at: string
        }
        Insert: {
          id?: string
          po_number?: string
          request_id: string
          quote_id: string
          buyer_org_id: string
          vendor_org_id: string
          status?: Database["public"]["Enums"]["po_status"]
          total_amount: number
          currency?: string
          approved_by: string
          approved_at?: string
          expected_delivery?: string | null
          status_changed_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          po_number?: string
          request_id?: string
          quote_id?: string
          buyer_org_id?: string
          vendor_org_id?: string
          status?: Database["public"]["Enums"]["po_status"]
          total_amount?: number
          currency?: string
          approved_by?: string
          approved_at?: string
          expected_delivery?: string | null
          status_changed_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_buyer_org_id_fkey"
            columns: ["buyer_org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_org_id_fkey"
            columns: ["vendor_org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_lines: {
        Row: {
          id: string
          quote_id: string
          request_line_id: string | null
          line_type: Database["public"]["Enums"]["quote_line_type"]
          description: string
          quantity: number
          unit_price: number
          tax_rate: number
          line_amount: number | null
          line_tax: number | null
          sort_order: number
          pass_through: boolean
        }
        Insert: {
          id?: string
          quote_id: string
          request_line_id?: string | null
          line_type?: Database["public"]["Enums"]["quote_line_type"]
          description: string
          quantity: number
          unit_price: number
          tax_rate?: number
          line_amount?: never
          line_tax?: never
          sort_order?: number
          pass_through?: boolean
        }
        Update: {
          id?: string
          quote_id?: string
          request_line_id?: string | null
          line_type?: Database["public"]["Enums"]["quote_line_type"]
          description?: string
          quantity?: number
          unit_price?: number
          tax_rate?: number
          line_amount?: never
          line_tax?: never
          sort_order?: number
          pass_through?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "quote_lines_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_request_line_id_fkey"
            columns: ["request_line_id"]
            isOneToOne: false
            referencedRelation: "request_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_negotiations: {
        Row: {
          id: string
          quote_id: string
          request_id: string
          buyer_org_id: string
          vendor_org_id: string
          proposed_by: Database["public"]["Enums"]["negotiation_side"]
          proposed_total: number
          message: string | null
          status: Database["public"]["Enums"]["negotiation_status"]
          response_message: string | null
          responded_at: string | null
          revised_quote_id: string | null
          created_by: string | null
          created_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          quote_id: string
          request_id: string
          buyer_org_id: string
          vendor_org_id: string
          proposed_by: Database["public"]["Enums"]["negotiation_side"]
          proposed_total: number
          message?: string | null
          status?: Database["public"]["Enums"]["negotiation_status"]
          response_message?: string | null
          responded_at?: string | null
          revised_quote_id?: string | null
          created_by?: string | null
          created_at?: string
          expires_at?: string
        }
        Update: {
          id?: string
          quote_id?: string
          request_id?: string
          buyer_org_id?: string
          vendor_org_id?: string
          proposed_by?: Database["public"]["Enums"]["negotiation_side"]
          proposed_total?: number
          message?: string | null
          status?: Database["public"]["Enums"]["negotiation_status"]
          response_message?: string | null
          responded_at?: string | null
          revised_quote_id?: string | null
          created_by?: string | null
          created_at?: string
          expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_negotiations_buyer_org_id_fkey"
            columns: ["buyer_org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_negotiations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_negotiations_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: true
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_negotiations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_negotiations_revised_quote_id_fkey"
            columns: ["revised_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_negotiations_vendor_org_id_fkey"
            columns: ["vendor_org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          id: string
          invitation_id: string
          request_id: string
          vendor_org_id: string
          version: number
          status: Database["public"]["Enums"]["quote_status"]
          currency: string
          subtotal: number
          discount_pct: number
          discount_amount: number
          tax_amount: number
          total: number | null
          lead_time_days: number | null
          payment_terms: string | null
          valid_until: string | null
          notes: string | null
          submitted_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          volume_discount_pct: number
          volume_discount_amount: number
          volume_rate_card_id: string | null
          volume_clients: number | null
          supplier_tax_mode: string
          pass_through_amount: number
          rcm_tax_amount: number
          price_terms_locked: boolean
        }
        Insert: {
          id?: string
          invitation_id: string
          request_id: string
          vendor_org_id: string
          version?: number
          status?: Database["public"]["Enums"]["quote_status"]
          currency?: string
          subtotal?: number
          discount_pct?: number
          discount_amount?: number
          tax_amount?: number
          total?: never
          lead_time_days?: number | null
          payment_terms?: string | null
          valid_until?: string | null
          notes?: string | null
          submitted_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          volume_discount_pct?: number
          volume_discount_amount?: number
          volume_rate_card_id?: string | null
          volume_clients?: number | null
          supplier_tax_mode?: string
          pass_through_amount?: number
          rcm_tax_amount?: number
          price_terms_locked?: boolean
        }
        Update: {
          id?: string
          invitation_id?: string
          request_id?: string
          vendor_org_id?: string
          version?: number
          status?: Database["public"]["Enums"]["quote_status"]
          currency?: string
          subtotal?: number
          discount_pct?: number
          discount_amount?: number
          tax_amount?: number
          total?: never
          lead_time_days?: number | null
          payment_terms?: string | null
          valid_until?: string | null
          notes?: string | null
          submitted_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          volume_discount_pct?: number
          volume_discount_amount?: number
          volume_rate_card_id?: string | null
          volume_clients?: number | null
          supplier_tax_mode?: string
          pass_through_amount?: number
          rcm_tax_amount?: number
          price_terms_locked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "quotes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "rfq_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_vendor_org_id_fkey"
            columns: ["vendor_org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      request_lines: {
        Row: {
          id: string
          request_id: string
          item_id: string | null
          description: string
          quantity: number
          unit: string
          specs: Json
          sort_order: number
        }
        Insert: {
          id?: string
          request_id: string
          item_id?: string | null
          description: string
          quantity: number
          unit?: string
          specs?: Json
          sort_order?: number
        }
        Update: {
          id?: string
          request_id?: string
          item_id?: string | null
          description?: string
          quantity?: number
          unit?: string
          specs?: Json
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "request_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "catalogue_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_lines_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_matches: {
        Row: {
          id: string
          request_id: string
          vendor_org_id: string
          status: Database["public"]["Enums"]["match_status"]
          score: number
          reasons: string[]
          estimated_delivery_days: number | null
          estimated_delivery_date: string | null
          suggested_by: string
          review_note: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          request_id: string
          vendor_org_id: string
          status?: Database["public"]["Enums"]["match_status"]
          score?: number
          reasons?: string[]
          estimated_delivery_days?: number | null
          estimated_delivery_date?: string | null
          suggested_by?: string
          review_note?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          request_id?: string
          vendor_org_id?: string
          status?: Database["public"]["Enums"]["match_status"]
          score?: number
          reasons?: string[]
          estimated_delivery_days?: number | null
          estimated_delivery_date?: string | null
          suggested_by?: string
          review_note?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_matches_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_matches_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_matches_vendor_org_id_fkey"
            columns: ["vendor_org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          id: string
          org_id: string
          created_by: string
          title: string
          description: string | null
          requirement_text: string | null
          input_language: string | null
          ai_extracted: Json | null
          required_certifications: string[]
          category_id: string | null
          source: Database["public"]["Enums"]["request_source"]
          status: Database["public"]["Enums"]["request_status"]
          needed_by: string | null
          delivery_city: string | null
          delivery_state: string | null
          budget_min: number | null
          budget_max: number | null
          currency: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          created_by?: string
          title: string
          description?: string | null
          requirement_text?: string | null
          input_language?: string | null
          ai_extracted?: Json | null
          required_certifications?: string[]
          category_id?: string | null
          source?: Database["public"]["Enums"]["request_source"]
          status?: Database["public"]["Enums"]["request_status"]
          needed_by?: string | null
          delivery_city?: string | null
          delivery_state?: string | null
          budget_min?: number | null
          budget_max?: number | null
          currency?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          created_by?: string
          title?: string
          description?: string | null
          requirement_text?: string | null
          input_language?: string | null
          ai_extracted?: Json | null
          required_certifications?: string[]
          category_id?: string | null
          source?: Database["public"]["Enums"]["request_source"]
          status?: Database["public"]["Enums"]["request_status"]
          needed_by?: string | null
          delivery_city?: string | null
          delivery_state?: string | null
          budget_min?: number | null
          budget_max?: number | null
          currency?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "catalogue_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_invitations: {
        Row: {
          id: string
          request_id: string
          vendor_org_id: string
          status: Database["public"]["Enums"]["invitation_status"]
          invited_at: string
          responded_at: string | null
        }
        Insert: {
          id?: string
          request_id: string
          vendor_org_id: string
          status?: Database["public"]["Enums"]["invitation_status"]
          invited_at?: string
          responded_at?: string | null
        }
        Update: {
          id?: string
          request_id?: string
          vendor_org_id?: string
          status?: Database["public"]["Enums"]["invitation_status"]
          invited_at?: string
          responded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_invitations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_invitations_vendor_org_id_fkey"
            columns: ["vendor_org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      startup_details: {
        Row: {
          org_id: string
          stage: string | null
          industry: string | null
          products_sold: string | null
          team_size: string | null
          funding_stage: string | null
          has_dpiit: boolean
          dpiit_number: string | null
          annual_procurement_budget: number | null
          turnaround_priority: string | null
          interest_category_ids: string[]
          procurement_description: string | null
          government_interests: string[]
          updated_at: string
        }
        Insert: {
          org_id: string
          stage?: string | null
          industry?: string | null
          products_sold?: string | null
          team_size?: string | null
          funding_stage?: string | null
          has_dpiit?: boolean
          dpiit_number?: string | null
          annual_procurement_budget?: number | null
          turnaround_priority?: string | null
          interest_category_ids?: string[]
          procurement_description?: string | null
          government_interests?: string[]
          updated_at?: string
        }
        Update: {
          org_id?: string
          stage?: string | null
          industry?: string | null
          products_sold?: string | null
          team_size?: string | null
          funding_stage?: string | null
          has_dpiit?: boolean
          dpiit_number?: string | null
          annual_procurement_budget?: number | null
          turnaround_priority?: string | null
          interest_category_ids?: string[]
          procurement_description?: string | null
          government_interests?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "startup_details_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_categories: {
        Row: {
          vendor_org_id: string
          category_id: string
        }
        Insert: {
          vendor_org_id: string
          category_id: string
        }
        Update: {
          vendor_org_id?: string
          category_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "catalogue_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_categories_vendor_org_id_fkey"
            columns: ["vendor_org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_details: {
        Row: {
          org_id: string
          enterprise_type: Database["public"]["Enums"]["enterprise_size"] | null
          pan_number: string | null
          factory_address: string | null
          machinery: string[]
          monthly_capacity: string | null
          capacity_utilisation_pct: number | null
          certifications: string[]
          moq: number | null
          payment_terms: string | null
          quality_testing_facilities: string[]
          lead_time_days: number | null
          pan_india_dispatch: boolean
          schemes_utilised: string[]
          updated_at: string
          turnover_band: string | null
        }
        Insert: {
          org_id: string
          enterprise_type?: Database["public"]["Enums"]["enterprise_size"] | null
          pan_number?: string | null
          factory_address?: string | null
          machinery?: string[]
          monthly_capacity?: string | null
          capacity_utilisation_pct?: number | null
          certifications?: string[]
          moq?: number | null
          payment_terms?: string | null
          quality_testing_facilities?: string[]
          lead_time_days?: number | null
          pan_india_dispatch?: boolean
          schemes_utilised?: string[]
          updated_at?: string
          turnover_band?: string | null
        }
        Update: {
          org_id?: string
          enterprise_type?: Database["public"]["Enums"]["enterprise_size"] | null
          pan_number?: string | null
          factory_address?: string | null
          machinery?: string[]
          monthly_capacity?: string | null
          capacity_utilisation_pct?: number | null
          certifications?: string[]
          moq?: number | null
          payment_terms?: string | null
          quality_testing_facilities?: string[]
          lead_time_days?: number | null
          pan_india_dispatch?: boolean
          schemes_utilised?: string[]
          updated_at?: string
          turnover_band?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_details_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          id: string
          number: string
          invoice_id: string
          po_id: string
          kind: string
          taxable_amount: number
          tax_amount: number
          total: number
          quote_line_id: string | null
          units: number | null
          reason: string | null
          idempotency_key: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          number?: string
          invoice_id?: string
          po_id?: string
          kind?: string
          taxable_amount?: number
          tax_amount?: number
          total?: number
          quote_line_id?: string | null
          units?: number | null
          reason?: string | null
          idempotency_key?: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          number?: string
          invoice_id?: string
          po_id?: string
          kind?: string
          taxable_amount?: number
          tax_amount?: number
          total?: number
          quote_line_id?: string | null
          units?: number | null
          reason?: string | null
          idempotency_key?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      fee_rules: {
        Row: {
          id: string
          category_id: string | null
          version: number
          buyer_fee_type: string
          buyer_fee_value: number
          buyer_fee_min: number | null
          buyer_fee_max: number | null
          supplier_commission_enabled: boolean
          supplier_commission_pct: number
          mpi_tax_pct: number
          supplier_tax_mode: string
          payment_route: string
          professional_gate: boolean
          needs_review: boolean
          note: string | null
          effective_from: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          category_id?: string | null
          version?: number
          buyer_fee_type?: string
          buyer_fee_value?: number
          buyer_fee_min?: number | null
          buyer_fee_max?: number | null
          supplier_commission_enabled?: boolean
          supplier_commission_pct?: number
          mpi_tax_pct?: number
          supplier_tax_mode?: string
          payment_route?: string
          professional_gate?: boolean
          needs_review?: boolean
          note?: string | null
          effective_from?: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          category_id?: string | null
          version?: number
          buyer_fee_type?: string
          buyer_fee_value?: number
          buyer_fee_min?: number | null
          buyer_fee_max?: number | null
          supplier_commission_enabled?: boolean
          supplier_commission_pct?: number
          mpi_tax_pct?: number
          supplier_tax_mode?: string
          payment_route?: string
          professional_gate?: boolean
          needs_review?: boolean
          note?: string | null
          effective_from?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      invoice_installments: {
        Row: {
          id: string
          invoice_id: string
          seq: number
          label: string
          pct: number | null
          amount: number
          due_event: string
          status: string
          paid_at: string | null
        }
        Insert: {
          id?: string
          invoice_id?: string
          seq?: number
          label?: string
          pct?: number | null
          amount?: number
          due_event?: string
          status?: string
          paid_at?: string | null
        }
        Update: {
          id?: string
          invoice_id?: string
          seq?: number
          label?: string
          pct?: number | null
          amount?: number
          due_event?: string
          status?: string
          paid_at?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          id: string
          number: string
          po_id: string
          kind: string
          issuer_org_id: string
          recipient_org_id: string
          currency: string
          taxable_amount: number
          tax_amount: number
          rcm_tax_amount: number
          total: number
          tax_mode: string
          lines: Json
          status: string
          amount_paid: number
          amount_credited: number
          issued_at: string
        }
        Insert: {
          id?: string
          number?: string
          po_id?: string
          kind?: string
          issuer_org_id?: string
          recipient_org_id?: string
          currency?: string
          taxable_amount?: number
          tax_amount?: number
          rcm_tax_amount?: number
          total?: number
          tax_mode?: string
          lines?: Json
          status?: string
          amount_paid?: number
          amount_credited?: number
          issued_at?: string
        }
        Update: {
          id?: string
          number?: string
          po_id?: string
          kind?: string
          issuer_org_id?: string
          recipient_org_id?: string
          currency?: string
          taxable_amount?: number
          tax_amount?: number
          rcm_tax_amount?: number
          total?: number
          tax_mode?: string
          lines?: Json
          status?: string
          amount_paid?: number
          amount_credited?: number
          issued_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          id: string
          po_id: string
          payer_org_id: string
          payee: string
          payee_org_id: string
          amount: number
          method: string
          is_simulated: boolean
          idempotency_key: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          po_id?: string
          payer_org_id?: string
          payee?: string
          payee_org_id?: string
          amount?: number
          method?: string
          is_simulated?: boolean
          idempotency_key?: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          po_id?: string
          payer_org_id?: string
          payee?: string
          payee_org_id?: string
          amount?: number
          method?: string
          is_simulated?: boolean
          idempotency_key?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          id: string
          po_id: string
          buyer_org_id: string
          amount: number
          is_simulated: boolean
          idempotency_key: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          po_id?: string
          buyer_org_id?: string
          amount?: number
          is_simulated?: boolean
          idempotency_key?: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          po_id?: string
          buyer_org_id?: string
          amount?: number
          is_simulated?: boolean
          idempotency_key?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      settlements: {
        Row: {
          id: string
          po_id: string
          vendor_org_id: string
          gross_amount: number
          commission_deducted: number
          net_amount: number
          kind: string
          is_simulated: boolean
          idempotency_key: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          po_id?: string
          vendor_org_id?: string
          gross_amount?: number
          commission_deducted?: number
          net_amount?: number
          kind?: string
          is_simulated?: boolean
          idempotency_key?: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          po_id?: string
          vendor_org_id?: string
          gross_amount?: number
          commission_deducted?: number
          net_amount?: number
          kind?: string
          is_simulated?: boolean
          idempotency_key?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      supplier_rate_cards: {
        Row: {
          id: string
          vendor_org_id: string
          category_id: string
          version: number
          metric: string
          tiers: Json
          valid_from: string
          valid_to: string | null
          is_active: boolean
          beneficiary: string
          rate_lock: string
          note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          vendor_org_id?: string
          category_id?: string
          version?: number
          metric?: string
          tiers?: Json
          valid_from?: string
          valid_to?: string | null
          is_active?: boolean
          beneficiary?: string
          rate_lock?: string
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          vendor_org_id?: string
          category_id?: string
          version?: number
          metric?: string
          tiers?: Json
          valid_from?: string
          valid_to?: string | null
          is_active?: boolean
          beneficiary?: string
          rate_lock?: string
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      request_private_details: {
        Row: {
          request_id: string | null
          budget_min: number | null
          budget_max: number | null
          requirement_text: string | null
          ai_extracted: Json | null
        }
        Relationships: []
      }
      org_public: {
        Row: {
          id: string | null
          type: Database["public"]["Enums"]["org_type"] | null
          display_name: string | null
        }
        Relationships: []
      }
      supplier_directory: {
        Row: {
          id: string | null
          display_name: string | null
          city: string | null
          state: string | null
          verified_at: string | null
          enterprise_type: Database["public"]["Enums"]["enterprise_size"] | null
          certifications: string[] | null
          machinery: string[] | null
          monthly_capacity: string | null
          moq: number | null
          lead_time_days: number | null
          quality_testing_facilities: string[] | null
          pan_india_dispatch: boolean | null
          category_ids: string[] | null
          turnover_band: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      approve_quote: {
        Args: {
          p_quote_id: string
          p_expected_checkout?: number
        }
        Returns: string
      }
      propose_price: {
        Args: {
          p_quote_id: string
          p_total: number
          p_message?: string
        }
        Returns: string
      }
      reset_demo_workspace: {
        Args: never
        Returns: string
      }
      respond_to_price: {
        Args: {
          p_negotiation_id: string
          p_response: string
          p_counter_total?: number
          p_message?: string
        }
        Returns: string
      }
      review_match: {
        Args: {
          p_match_id: string
          p_approve: boolean
          p_note?: string
        }
        Returns: undefined
      }
      set_payment_terms: {
        Args: {
          p_terms: string
          p_category_id?: string
        }
        Returns: undefined
      }
      set_vendor_verification: {
        Args: {
          p_org_id: string
          p_status: Database["public"]["Enums"]["verification_status"]
          p_note?: string
        }
        Returns: undefined
      }
      price_guide: {
        Args: {
          p_request_line_id: string
        }
        Returns: {
          request_line_id: string
          item_id: string | null
          item_name: string | null
          description: string
          quantity: number
          unit: string
          category_name: string | null
          delivery_city: string | null
          delivery_state: string | null
          source: string
          price_count: number
          low: number | null
          typical: number | null
          high: number | null
          decided_count: number
          win_pct_low: number | null
          win_pct_typical: number | null
          win_pct_high: number | null
        }[]
      }
      suggest_schemes: {
        Args: {
          p_limit?: number
        }
        Returns: {
          scheme_id: string
          score: number
          reasons: string[]
        }[]
      }
      suggest_matches: {
        Args: {
          p_request_id: string
        }
        Returns: number
      }
      price_breakdown: {
        Args: { p_quote_id: string }
        Returns: Json
      }
      order_money: {
        Args: { p_po_id: string }
        Returns: Json
      }
      pay_order: {
        Args: { p_po_id: string; p_idempotency_key: string }
        Returns: Json
      }
      settle_supplier: {
        Args: { p_po_id: string; p_idempotency_key: string }
        Returns: Json
      }
      record_return: {
        Args: { p_po_id: string; p_quote_line_id: string; p_units: number; p_reason: string; p_idempotency_key: string }
        Returns: Json
      }
      pay_refund: {
        Args: { p_po_id: string; p_idempotency_key: string }
        Returns: Json
      }
      compare_offers: {
        Args: { p_request_id: string }
        Returns: {
          quote_id: string
          supplier_alias: string
          total_cost: number
          checkout_total: number
          volume_benefit: number
          lead_time_days: number | null
          price_points: number
          quality_points: number
          delivery_points: number
          location_points: number
          score: number
          rank: number
          reasons: string[]
        }[]
      }
      volume_status: {
        Args: { p_vendor_org_id?: string }
        Returns: {
          category_id: string
          category_name: string
          rate_card_id: string
          clients_last_month: number
          current_pct: number
          next_tier_clients: number | null
          next_tier_pct: number | null
          clients_this_month: number
          tiers: Json
        }[]
      }
      set_fee_rule: {
        Args: {
          p_category_id: string | null
          p_buyer_fee_type: string
          p_buyer_fee_value: number
          p_commission_enabled: boolean
          p_commission_pct: number
          p_supplier_tax_mode?: string
          p_payment_route?: string
          p_mpi_tax_pct?: number
          p_buyer_fee_min?: number
          p_buyer_fee_max?: number
          p_professional_gate?: boolean
          p_note?: string
        }
        Returns: string
      }
      save_rate_card: {
        Args: {
          p_vendor_org_id: string
          p_category_id: string
          p_tiers: Json
          p_metric?: string
          p_valid_from?: string
          p_valid_to?: string
          p_note?: string
        }
        Returns: string
      }
      update_order_status: {
        Args: {
          p_po_id: string
          p_status: Database["public"]["Enums"]["po_status"]
          p_expected_delivery?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "startup" | "vendor" | "admin"
      enterprise_size: "micro" | "small" | "medium"
      invitation_status: "invited" | "viewed" | "declined" | "quoted"
      match_status: "suggested" | "approved" | "rejected"
      negotiation_side: "buyer" | "vendor"
      negotiation_status: "open" | "accepted" | "declined" | "countered" | "withdrawn" | "expired"
      org_type: "startup" | "vendor" | "platform"
      po_status: "issued" | "in_production" | "qc_passed" | "dispatched" | "delivered" | "completed" | "cancelled"
      quote_line_type: "item" | "setup" | "testing" | "logistics" | "other"
      quote_status: "draft" | "submitted" | "superseded" | "withdrawn" | "accepted" | "rejected"
      request_source: "catalogue" | "ai_assisted" | "assisted_sourcing"
      request_status: "draft" | "open" | "comparing" | "ordered" | "cancelled"
      verification_status: "not_required" | "pending" | "under_review" | "needs_info" | "verified" | "rejected" | "suspended"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

