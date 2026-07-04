import type {
  ActivityType,
  DraftState,
  DraftType,
  GeneratedBy,
  LeadStatus,
  ObservedWebsiteIssue,
  ReplyCategory,
  TemplateType
} from "@/lib/types";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      leads: {
        Row: {
          id: string;
          owner_id: string;
          business_name: string;
          contact_name: string | null;
          email: string;
          website_url: string | null;
          industry: string | null;
          location: string | null;
          observed_website_issues: ObservedWebsiteIssue[];
          issue_details: string | null;
          notes: string | null;
          status: LeadStatus;
          date_contacted: string | null;
          follow_up_count: number;
          initial_sent_at: string | null;
          last_activity_at: string;
          gmail_thread_id: string | null;
          source_place_id: string | null;
          stop_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["leads"]["Row"]> & {
          owner_id: string;
          business_name: string;
          email: string;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Row"]>;
        Relationships: [];
      };
      email_drafts: {
        Row: {
          id: string;
          owner_id: string;
          lead_id: string;
          draft_type: DraftType;
          subject: string;
          body: string;
          state: DraftState;
          gmail_draft_id: string | null;
          gmail_message_id: string | null;
          generated_by: GeneratedBy;
          created_at: string;
          updated_at: string;
          sent_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["email_drafts"]["Row"]> & {
          owner_id: string;
          lead_id: string;
          subject: string;
          body: string;
        };
        Update: Partial<Database["public"]["Tables"]["email_drafts"]["Row"]>;
        Relationships: [];
      };
      replies: {
        Row: {
          id: string;
          owner_id: string;
          lead_id: string;
          gmail_message_id: string;
          gmail_thread_id: string;
          sender_email: string;
          received_at: string;
          body: string;
          classification: ReplyCategory;
          confidence: number;
          explanation: string;
          manually_overridden: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["replies"]["Row"]> & {
          owner_id: string;
          lead_id: string;
          gmail_message_id: string;
          gmail_thread_id: string;
          sender_email: string;
          body: string;
          classification: ReplyCategory;
          confidence: number;
          explanation: string;
        };
        Update: Partial<Database["public"]["Tables"]["replies"]["Row"]>;
        Relationships: [];
      };
      activities: {
        Row: {
          id: string;
          owner_id: string;
          lead_id: string;
          activity_type: ActivityType;
          description: string;
          metadata: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["activities"]["Row"]> & {
          owner_id: string;
          lead_id: string;
          activity_type: ActivityType;
          description: string;
        };
        Update: Partial<Database["public"]["Tables"]["activities"]["Row"]>;
        Relationships: [];
      };
      templates: {
        Row: {
          id: string;
          owner_id: string;
          template_type: TemplateType;
          content: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["templates"]["Row"]> & {
          owner_id: string;
          template_type: TemplateType;
          content: string;
        };
        Update: Partial<Database["public"]["Tables"]["templates"]["Row"]>;
        Relationships: [];
      };
      settings: {
        Row: {
          id: string;
          owner_id: string;
          sender_name: string;
          sender_email: string;
          agency_name: string;
          agency_website: string | null;
          portfolio_link: string | null;
          calendly_link: string | null;
          daily_send_limit: number;
          follow_up_delay_days: number;
          encrypted_openai_key_reference: string | null;
          encrypted_gmail_refresh_token: string | null;
          gmail_connection_metadata: Json;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["settings"]["Row"]> & {
          owner_id: string;
          sender_name: string;
          sender_email: string;
          agency_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["settings"]["Row"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          owner_id: string;
          type: string;
          lead_id: string | null;
          title: string;
          message: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["notifications"]["Row"]> & {
          owner_id: string;
          type: string;
          title: string;
          message: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
