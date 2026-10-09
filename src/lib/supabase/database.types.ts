// Generated from the Supabase schema (supabase/migrations). Regenerate after schema changes.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      clients: {
        Row: {
          age: number | null;
          birth_year: number | null;
          counselor_id: string;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          age?: number | null;
          birth_year?: number | null;
          counselor_id?: string;
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          age?: number | null;
          birth_year?: number | null;
          counselor_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clients_counselor_id_fkey";
            columns: ["counselor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      genograms: {
        Row: {
          client_id: string;
          counselor_id: string;
          graph: Json;
          revision: number;
          updated_at: string;
        };
        Insert: {
          client_id: string;
          counselor_id: string;
          graph?: Json;
          revision?: number;
          updated_at?: string;
        };
        Update: {
          client_id?: string;
          counselor_id?: string;
          graph?: Json;
          revision?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "genograms_client_id_counselor_id_fkey";
            columns: ["client_id", "counselor_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id", "counselor_id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
