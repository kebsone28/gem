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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      alerts: {
        Row: {
          affected_teams: string[] | null
          alert_type: string
          created_at: string | null
          description: string
          detected_at: string | null
          id: string
          project_id: string | null
          recommended_action: string | null
          resolved_at: string | null
          severity: string
          status: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          affected_teams?: string[] | null
          alert_type: string
          created_at?: string | null
          description: string
          detected_at?: string | null
          id?: string
          project_id?: string | null
          recommended_action?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          affected_teams?: string[] | null
          alert_type?: string
          created_at?: string | null
          description?: string
          detected_at?: string | null
          id?: string
          project_id?: string | null
          recommended_action?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      field_reports: {
        Row: {
          anomalies: string | null
          created_at: string | null
          hours_worked: number | null
          households_completed: number | null
          id: string
          material_needs: string | null
          photos_urls: string[] | null
          project_id: string
          report_date: string
          reported_by: string | null
          tasks_completed: string[] | null
          team_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          anomalies?: string | null
          created_at?: string | null
          hours_worked?: number | null
          households_completed?: number | null
          id?: string
          material_needs?: string | null
          photos_urls?: string[] | null
          project_id: string
          report_date?: string
          reported_by?: string | null
          tasks_completed?: string[] | null
          team_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          anomalies?: string | null
          created_at?: string | null
          hours_worked?: number | null
          households_completed?: number | null
          id?: string
          material_needs?: string | null
          photos_urls?: string[] | null
          project_id?: string
          report_date?: string
          reported_by?: string | null
          tasks_completed?: string[] | null
          team_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_reports_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      project_settings: {
        Row: {
          average_distance_km: number | null
          chargeurs_daily_capacity: number | null
          chargeurs_hourly_rate: number | null
          chargeurs_per_team: number | null
          chauffeurs_count: number | null
          chauffeurs_daily_trips: number | null
          chauffeurs_hourly_rate: number | null
          contingency_rate: number | null
          controleurs_daily_capacity: number | null
          controleurs_hourly_rate: number | null
          controleurs_per_team: number | null
          created_at: string | null
          electriciens_interieur_daily_capacity: number | null
          electriciens_interieur_hourly_rate: number | null
          electriciens_interieur_per_team: number | null
          electriciens_reseau_daily_capacity: number | null
          electriciens_reseau_hourly_rate: number | null
          electriciens_reseau_per_team: number | null
          fuel_cost_per_day: number | null
          id: string
          macons_daily_capacity: number | null
          macons_hourly_rate: number | null
          macons_per_team: number | null
          preparateurs_daily_capacity: number | null
          preparateurs_hourly_rate: number | null
          preparateurs_per_team: number | null
          project_id: string
          resource_availability_rate: number | null
          total_households: number
          truck_capacity: number | null
          truck_count: number | null
          truck_monthly_cost: number | null
          updated_at: string | null
          user_id: string | null
          working_days_per_week: number | null
        }
        Insert: {
          average_distance_km?: number | null
          chargeurs_daily_capacity?: number | null
          chargeurs_hourly_rate?: number | null
          chargeurs_per_team?: number | null
          chauffeurs_count?: number | null
          chauffeurs_daily_trips?: number | null
          chauffeurs_hourly_rate?: number | null
          contingency_rate?: number | null
          controleurs_daily_capacity?: number | null
          controleurs_hourly_rate?: number | null
          controleurs_per_team?: number | null
          created_at?: string | null
          electriciens_interieur_daily_capacity?: number | null
          electriciens_interieur_hourly_rate?: number | null
          electriciens_interieur_per_team?: number | null
          electriciens_reseau_daily_capacity?: number | null
          electriciens_reseau_hourly_rate?: number | null
          electriciens_reseau_per_team?: number | null
          fuel_cost_per_day?: number | null
          id?: string
          macons_daily_capacity?: number | null
          macons_hourly_rate?: number | null
          macons_per_team?: number | null
          preparateurs_daily_capacity?: number | null
          preparateurs_hourly_rate?: number | null
          preparateurs_per_team?: number | null
          project_id: string
          resource_availability_rate?: number | null
          total_households?: number
          truck_capacity?: number | null
          truck_count?: number | null
          truck_monthly_cost?: number | null
          updated_at?: string | null
          user_id?: string | null
          working_days_per_week?: number | null
        }
        Update: {
          average_distance_km?: number | null
          chargeurs_daily_capacity?: number | null
          chargeurs_hourly_rate?: number | null
          chargeurs_per_team?: number | null
          chauffeurs_count?: number | null
          chauffeurs_daily_trips?: number | null
          chauffeurs_hourly_rate?: number | null
          contingency_rate?: number | null
          controleurs_daily_capacity?: number | null
          controleurs_hourly_rate?: number | null
          controleurs_per_team?: number | null
          created_at?: string | null
          electriciens_interieur_daily_capacity?: number | null
          electriciens_interieur_hourly_rate?: number | null
          electriciens_interieur_per_team?: number | null
          electriciens_reseau_daily_capacity?: number | null
          electriciens_reseau_hourly_rate?: number | null
          electriciens_reseau_per_team?: number | null
          fuel_cost_per_day?: number | null
          id?: string
          macons_daily_capacity?: number | null
          macons_hourly_rate?: number | null
          macons_per_team?: number | null
          preparateurs_daily_capacity?: number | null
          preparateurs_hourly_rate?: number | null
          preparateurs_per_team?: number | null
          project_id?: string
          resource_availability_rate?: number | null
          total_households?: number
          truck_capacity?: number | null
          truck_count?: number | null
          truck_monthly_cost?: number | null
          updated_at?: string | null
          user_id?: string | null
          working_days_per_week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_settings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks_history: {
        Row: {
          actual_duration_hours: number | null
          blocked_reason: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          notes: string | null
          project_id: string
          started_at: string | null
          status: string
          task_code: string
          team_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          actual_duration_hours?: number | null
          blocked_reason?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          project_id: string
          started_at?: string | null
          status?: string
          task_code: string
          team_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          actual_duration_hours?: number | null
          blocked_reason?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          started_at?: string | null
          status?: string
          task_code?: string
          team_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_history_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          adresse: string
          commune: string | null
          cout: number | null
          created_at: string | null
          date_debut: string | null
          date_fin_prevue: string | null
          equipes: Json
          gps: Json | null
          history: Json | null
          id: string
          menage: string
          progress: number | null
          region: string
          status: string
          tasks: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          adresse: string
          commune?: string | null
          cout?: number | null
          created_at?: string | null
          date_debut?: string | null
          date_fin_prevue?: string | null
          equipes?: Json
          gps?: Json | null
          history?: Json | null
          id: string
          menage: string
          progress?: number | null
          region: string
          status: string
          tasks?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          adresse?: string
          commune?: string | null
          cout?: number | null
          created_at?: string | null
          date_debut?: string | null
          date_fin_prevue?: string | null
          equipes?: Json
          gps?: Json | null
          history?: Json | null
          id?: string
          menage?: string
          progress?: number | null
          region?: string
          status?: string
          tasks?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stocks: {
        Row: {
          created_at: string | null
          id: string
          item: string
          quantite: number
          seuil: number
          unite: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item: string
          quantite?: number
          seuil?: number
          unite?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item?: string
          quantite?: number
          seuil?: number
          unite?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stocks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          assigned_project_id: string | null
          created_at: string | null
          current_location: string | null
          daily_capacity: number | null
          hourly_rate: number | null
          id: string
          members: number
          name: string
          status: string | null
          team_type: string | null
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          assigned_project_id?: string | null
          created_at?: string | null
          current_location?: string | null
          daily_capacity?: number | null
          hourly_rate?: number | null
          id: string
          members?: number
          name: string
          status?: string | null
          team_type?: string | null
          type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_project_id?: string | null
          created_at?: string | null
          current_location?: string | null
          daily_capacity?: number | null
          hourly_rate?: number | null
          id?: string
          members?: number
          name?: string
          status?: string | null
          team_type?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_tasks: {
        Row: {
          category: string
          code: string
          created_at: string | null
          depends_on: string[] | null
          description: string | null
          estimated_duration_hours: number | null
          id: string
          name: string
          required_team_type: string
          sequence_order: number
          updated_at: string | null
        }
        Insert: {
          category: string
          code: string
          created_at?: string | null
          depends_on?: string[] | null
          description?: string | null
          estimated_duration_hours?: number | null
          id?: string
          name: string
          required_team_type: string
          sequence_order: number
          updated_at?: string | null
        }
        Update: {
          category?: string
          code?: string
          created_at?: string | null
          depends_on?: string[] | null
          description?: string | null
          estimated_duration_hours?: number | null
          id?: string
          name?: string
          required_team_type?: string
          sequence_order?: number
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
