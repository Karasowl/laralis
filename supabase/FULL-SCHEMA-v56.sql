-- =============================================================================
-- LARALIS FULL DATABASE SCHEMA v56
-- Generated: 2025-12-08
-- Source: Supabase Schema Visualizer (REAL PRODUCTION SCHEMA)
--
-- Este archivo crea TODO el schema de Laralis desde cero.
-- Ejecutar en un proyecto Supabase nuevo ANTES de importar datos.
--
-- INSTRUCCIONES:
-- 1. Crear nuevo proyecto en Supabase
-- 2. Ir a SQL Editor
-- 3. Copiar y pegar TODO este archivo
-- 4. Ejecutar (puede tomar 1-2 minutos)
-- 5. Importar backup JSON desde la app
--
-- NOTA: Las foreign keys están ordenadas para evitar errores de dependencia.
-- =============================================================================

-- =============================================================================
-- PARTE 1: EXTENSIONES
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- PARTE 2: TABLAS (en orden de dependencias)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2.1 TABLAS SIN DEPENDENCIAS
-- -----------------------------------------------------------------------------

CREATE TABLE public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT organizations_pkey PRIMARY KEY (id)
);

CREATE TABLE public.workspaces (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL,
  slug character varying NOT NULL UNIQUE,
  description text,
  owner_id uuid,
  logo_url text,
  settings jsonb DEFAULT '{}'::jsonb,
  max_clinics integer DEFAULT 3,
  max_users integer DEFAULT 5,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  onboarding_completed boolean DEFAULT false,
  onboarding_step integer DEFAULT 0,
  subscription_status character varying DEFAULT 'trial'::character varying,
  subscription_ends_at timestamp with time zone,
  CONSTRAINT workspaces_pkey PRIMARY KEY (id),
  CONSTRAINT workspaces_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id)
);

CREATE TABLE public.category_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name character varying NOT NULL UNIQUE,
  display_name character varying NOT NULL,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  clinic_id uuid,
  code character varying,
  description text,
  icon character varying,
  color character varying,
  is_system boolean DEFAULT false,
  is_active boolean DEFAULT true,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT category_types_pkey PRIMARY KEY (id)
);

CREATE TABLE public.role_permissions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  role text NOT NULL CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text, 'viewer'::text])),
  resource_name text NOT NULL,
  action_name text NOT NULL,
  allowed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT role_permissions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.verification_codes (
  email text NOT NULL,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT verification_codes_pkey PRIMARY KEY (email)
);

CREATE TABLE public.user_settings (
  user_id uuid NOT NULL,
  key text NOT NULL,
  value jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_settings_pkey PRIMARY KEY (user_id, key),
  CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Backup table
CREATE TABLE public._backup_patient_sources (
  id uuid,
  clinic_id uuid,
  entity_type character varying,
  name character varying,
  display_name character varying,
  is_system boolean,
  is_active boolean,
  display_order integer,
  created_at timestamp with time zone
);

-- -----------------------------------------------------------------------------
-- 2.2 CLINICS (depende de workspaces, organizations)
-- -----------------------------------------------------------------------------

CREATE TABLE public.clinics (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id uuid,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  workspace_id uuid,
  is_active boolean DEFAULT true,
  address text,
  phone character varying,
  email character varying,
  global_discount_config jsonb DEFAULT '{"type": "percentage", "value": 0, "enabled": false}'::jsonb,
  price_rounding integer DEFAULT 10 CHECK (price_rounding > 0),
  auto_complete_appointments boolean NOT NULL DEFAULT false,
  CONSTRAINT clinics_pkey PRIMARY KEY (id),
  CONSTRAINT clinics_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id),
  CONSTRAINT clinics_org_id_fkey FOREIGN KEY (org_id) REFERENCES public.organizations(id)
);

-- -----------------------------------------------------------------------------
-- 2.3 WORKSPACE/CLINIC USERS (depende de workspaces, clinics, auth.users)
-- -----------------------------------------------------------------------------

CREATE TABLE public.workspace_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role character varying NOT NULL CHECK (role::text = ANY (ARRAY['owner'::character varying, 'admin'::character varying, 'member'::character varying, 'viewer'::character varying]::text[])),
  permissions jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  joined_at timestamp with time zone DEFAULT now(),
  invited_by uuid,
  invitation_accepted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workspace_users_pkey PRIMARY KEY (id),
  CONSTRAINT workspace_users_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id),
  CONSTRAINT workspace_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT workspace_users_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id)
);

CREATE TABLE public.workspace_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  email character varying,
  display_name character varying,
  role character varying NOT NULL CHECK (role::text = ANY (ARRAY['owner'::character varying, 'super_admin'::character varying, 'admin'::character varying, 'editor'::character varying, 'viewer'::character varying]::text[])),
  permissions jsonb DEFAULT '{}'::jsonb,
  allowed_clinics uuid[],
  invitation_status character varying DEFAULT 'pending'::character varying CHECK (invitation_status::text = ANY (ARRAY['pending'::character varying, 'accepted'::character varying, 'rejected'::character varying]::text[])),
  invited_at timestamp with time zone DEFAULT now(),
  accepted_at timestamp with time zone,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  clinic_ids uuid[] DEFAULT '{}'::uuid[],
  CONSTRAINT workspace_members_pkey PRIMARY KEY (id),
  CONSTRAINT workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id),
  CONSTRAINT workspace_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.clinic_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role character varying NOT NULL CHECK (role::text = ANY (ARRAY['admin'::character varying, 'doctor'::character varying, 'assistant'::character varying, 'receptionist'::character varying, 'viewer'::character varying]::text[])),
  permissions jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  can_access_all_patients boolean DEFAULT false,
  assigned_chair character varying,
  schedule jsonb DEFAULT '{}'::jsonb,
  joined_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clinic_users_pkey PRIMARY KEY (id),
  CONSTRAINT clinic_users_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id),
  CONSTRAINT clinic_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  clinic_id uuid,
  email character varying NOT NULL,
  role character varying NOT NULL,
  permissions jsonb DEFAULT '{}'::jsonb,
  token character varying NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  invited_by uuid NOT NULL,
  accepted_at timestamp with time zone,
  rejected_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT invitations_pkey PRIMARY KEY (id),
  CONSTRAINT invitations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id),
  CONSTRAINT invitations_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id),
  CONSTRAINT invitations_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id)
);

-- -----------------------------------------------------------------------------
-- 2.4 CATEGORIES (depende de clinics, category_types)
-- -----------------------------------------------------------------------------

CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid,
  entity_type character varying NOT NULL,
  name character varying NOT NULL,
  display_name character varying NOT NULL,
  is_system boolean DEFAULT false,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 999,
  created_at timestamp with time zone DEFAULT now(),
  category_type_id uuid,
  code character varying,
  description text,
  icon character varying,
  color character varying,
  metadata jsonb DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  parent_id uuid,
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);

CREATE TABLE public.custom_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  category_type_id uuid NOT NULL,
  name character varying NOT NULL,
  display_name character varying NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  is_system boolean DEFAULT false,
  color character varying,
  icon character varying,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT custom_categories_pkey PRIMARY KEY (id),
  CONSTRAINT custom_categories_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id),
  CONSTRAINT custom_categories_category_type_id_fkey FOREIGN KEY (category_type_id) REFERENCES public.category_types(id)
);

CREATE TABLE public.patient_sources (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  name character varying NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  is_system boolean DEFAULT false,
  color character varying,
  icon character varying,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT patient_sources_pkey PRIMARY KEY (id),
  CONSTRAINT patient_sources_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
);

-- -----------------------------------------------------------------------------
-- 2.5 SETTINGS & CONFIGURATION
-- -----------------------------------------------------------------------------

CREATE TABLE public.settings_time (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL UNIQUE,
  work_days integer DEFAULT 20,
  hours_per_day numeric DEFAULT 7,
  real_pct numeric DEFAULT 80.00,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  working_days_config jsonb DEFAULT '{"manual": {"friday": true, "monday": true, "sunday": false, "tuesday": true, "saturday": true, "thursday": true, "wednesday": true}, "detected": null, "useHistorical": true}'::jsonb,
  CONSTRAINT settings_time_pkey PRIMARY KEY (id),
  CONSTRAINT settings_time_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
);

CREATE TABLE public.clinic_google_calendar (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL UNIQUE,
  calendar_id text NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamp with time zone NOT NULL,
  connected_email text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clinic_google_calendar_pkey PRIMARY KEY (id),
  CONSTRAINT clinic_google_calendar_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
);

-- -----------------------------------------------------------------------------
-- 2.6 FIXED COSTS & ASSETS
-- -----------------------------------------------------------------------------

CREATE TABLE public.fixed_costs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  category character varying NOT NULL,
  concept character varying NOT NULL,
  amount_cents bigint NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fixed_costs_pkey PRIMARY KEY (id),
  CONSTRAINT fixed_costs_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
);

CREATE TABLE public.assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  name character varying NOT NULL,
  category character varying,
  purchase_date date NOT NULL,
  purchase_price_cents bigint NOT NULL,
  depreciation_years integer DEFAULT 3,
  depreciation_months integer DEFAULT (depreciation_years * 12),
  is_active boolean DEFAULT true,
  disposal_date date,
  disposal_value_cents bigint,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  monthly_depreciation_cents bigint DEFAULT
    CASE
      WHEN ((depreciation_years IS NOT NULL) AND (depreciation_years > 0)) THEN (purchase_price_cents / (depreciation_years * 12))
      ELSE NULL::bigint
    END,
  CONSTRAINT assets_pkey PRIMARY KEY (id),
  CONSTRAINT assets_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
);

-- -----------------------------------------------------------------------------
-- 2.7 SUPPLIES
-- -----------------------------------------------------------------------------

CREATE TABLE public.supplies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  name text NOT NULL,
  category character varying NOT NULL DEFAULT 'otros'::text,
  presentation text NOT NULL DEFAULT ''::text,
  price_cents bigint NOT NULL,
  portions integer NOT NULL CHECK (portions > 0),
  created_at timestamp with time zone DEFAULT now(),
  cost_per_portion_cents integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  stock_quantity integer DEFAULT 0,
  min_stock_alert integer DEFAULT 10,
  last_purchase_price_cents integer,
  last_purchase_date date,
  CONSTRAINT supplies_pkey PRIMARY KEY (id),
  CONSTRAINT supplies_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
);

-- -----------------------------------------------------------------------------
-- 2.8 SERVICES
-- -----------------------------------------------------------------------------

CREATE TABLE public.services (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  name character varying NOT NULL,
  description text,
  category character varying,
  is_active boolean DEFAULT true,
  est_minutes integer NOT NULL DEFAULT 60,
  fixed_cost_per_minute_cents bigint DEFAULT 0,
  variable_cost_cents bigint DEFAULT 0,
  margin_pct numeric DEFAULT 30.00,
  price_cents bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  active boolean DEFAULT true,
  discount_type character varying DEFAULT 'none'::character varying CHECK (discount_type::text = ANY (ARRAY['none'::character varying, 'percentage'::character varying, 'fixed'::character varying]::text[])),
  discount_value numeric DEFAULT 0 CHECK (discount_value >= 0::numeric),
  discount_reason text,
  final_price_with_discount_cents integer,
  CONSTRAINT services_pkey PRIMARY KEY (id),
  CONSTRAINT services_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
);

CREATE TABLE public.service_supplies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL,
  supply_id uuid NOT NULL,
  qty numeric NOT NULL DEFAULT 1,
  unit_cost_cents integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT service_supplies_pkey PRIMARY KEY (id),
  CONSTRAINT service_supplies_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id),
  CONSTRAINT service_supplies_supply_id_fkey FOREIGN KEY (supply_id) REFERENCES public.supplies(id)
);

-- -----------------------------------------------------------------------------
-- 2.9 TARIFFS (DEPRECATED - kept for legacy)
-- -----------------------------------------------------------------------------

CREATE TABLE public.tariffs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  service_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,
  valid_from date NOT NULL,
  valid_until date,
  fixed_cost_per_minute_cents bigint NOT NULL,
  variable_cost_cents bigint NOT NULL,
  margin_pct numeric NOT NULL,
  price_cents bigint NOT NULL,
  rounded_price_cents bigint NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  discount_type character varying DEFAULT 'none'::character varying CHECK (discount_type::text = ANY (ARRAY['none'::character varying, 'percentage'::character varying, 'fixed'::character varying]::text[])),
  discount_value numeric DEFAULT 0 CHECK (discount_value >= 0::numeric),
  discount_reason text,
  final_price_with_discount_cents integer,
  CONSTRAINT tariffs_pkey PRIMARY KEY (id),
  CONSTRAINT tariffs_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id),
  CONSTRAINT tariffs_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id)
);

COMMENT ON TABLE public.tariffs IS 'DEPRECATED: Use services table for pricing. Kept for audit/fiscal compliance only.';

-- -----------------------------------------------------------------------------
-- 2.10 MARKETING
-- -----------------------------------------------------------------------------

CREATE TABLE public.marketing_campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  name character varying NOT NULL,
  code character varying,
  is_active boolean DEFAULT true,
  is_archived boolean DEFAULT false,
  archived_at timestamp with time zone,
  reactivated_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  platform_id uuid NOT NULL,
  CONSTRAINT marketing_campaigns_pkey PRIMARY KEY (id),
  CONSTRAINT marketing_campaigns_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id),
  CONSTRAINT marketing_campaigns_platform_id_fkey FOREIGN KEY (platform_id) REFERENCES public.categories(id)
);

CREATE TABLE public.marketing_campaign_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  status character varying NOT NULL,
  changed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT marketing_campaign_status_history_pkey PRIMARY KEY (id),
  CONSTRAINT marketing_campaign_status_history_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id)
);

-- -----------------------------------------------------------------------------
-- 2.11 PATIENTS
-- -----------------------------------------------------------------------------

CREATE TABLE public.patients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  first_name character varying NOT NULL,
  last_name character varying NOT NULL,
  email character varying,
  phone character varying,
  birth_date date,
  gender character varying,
  address text,
  city character varying,
  state character varying,
  postal_code character varying,
  medical_history text,
  allergies text,
  medications text,
  emergency_contact character varying,
  emergency_phone character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  notes text,
  first_visit_date date,
  source_id uuid,
  referred_by_patient_id uuid,
  acquisition_date date,
  campaign_name character varying,
  campaign_id uuid,
  platform_id uuid,
  CONSTRAINT patients_pkey PRIMARY KEY (id),
  CONSTRAINT patients_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id),
  CONSTRAINT patients_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.patient_sources(id),
  CONSTRAINT patients_referred_by_patient_id_fkey FOREIGN KEY (referred_by_patient_id) REFERENCES public.patients(id),
  CONSTRAINT patients_platform_id_fkey FOREIGN KEY (platform_id) REFERENCES public.categories(id),
  CONSTRAINT patients_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id)
);

-- -----------------------------------------------------------------------------
-- 2.12 TREATMENTS
-- -----------------------------------------------------------------------------

CREATE TABLE public.treatments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  service_id uuid NOT NULL,
  treatment_date date NOT NULL DEFAULT CURRENT_DATE,
  treatment_time time without time zone,
  status character varying DEFAULT 'scheduled'::character varying,
  fixed_cost_per_minute_cents bigint NOT NULL DEFAULT 0,
  minutes integer NOT NULL DEFAULT 30,
  variable_cost_cents bigint NOT NULL DEFAULT 0,
  margin_pct numeric NOT NULL DEFAULT 30,
  price_cents bigint NOT NULL DEFAULT 0,
  tooth_number character varying,
  notes text,
  is_paid boolean DEFAULT false,
  payment_method character varying,
  payment_date date,
  discount_pct numeric DEFAULT 0,
  discount_reason text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  tariff_version integer,
  is_refunded boolean DEFAULT false,
  refunded_at timestamp with time zone,
  refund_reason text,
  CONSTRAINT treatments_pkey PRIMARY KEY (id),
  CONSTRAINT fk_patient FOREIGN KEY (patient_id) REFERENCES public.patients(id),
  CONSTRAINT fk_service FOREIGN KEY (service_id) REFERENCES public.services(id)
);

-- -----------------------------------------------------------------------------
-- 2.13 EXPENSES
-- -----------------------------------------------------------------------------

CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL,
  expense_date date NOT NULL,
  category character varying NOT NULL,
  subcategory character varying,
  description text,
  amount_cents bigint NOT NULL,
  vendor character varying,
  invoice_number character varying,
  is_recurring boolean DEFAULT false,
  is_paid boolean DEFAULT true,
  payment_method character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  related_asset_id uuid,
  related_supply_id uuid,
  quantity integer,
  auto_processed boolean DEFAULT false,
  category_id uuid NOT NULL,
  campaign_id uuid,
  notes text,
  is_variable boolean DEFAULT false,
  expense_category character varying,
  CONSTRAINT expenses_pkey PRIMARY KEY (id),
  CONSTRAINT expenses_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id),
  CONSTRAINT fk_expenses_category FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT expenses_related_asset_id_fkey FOREIGN KEY (related_asset_id) REFERENCES public.assets(id),
  CONSTRAINT expenses_related_supply_id_fkey FOREIGN KEY (related_supply_id) REFERENCES public.supplies(id),
  CONSTRAINT expenses_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.marketing_campaigns(id)
);

-- -----------------------------------------------------------------------------
-- 2.14 AI CHAT (Lara)
-- -----------------------------------------------------------------------------

CREATE TABLE public.ai_chat_sessions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  clinic_id uuid,
  title text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT ai_chat_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT ai_chat_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT ai_chat_sessions_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id)
);

CREATE TABLE public.ai_chat_messages (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL,
  role text NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT ai_chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT ai_chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.ai_chat_sessions(id)
);

-- -----------------------------------------------------------------------------
-- 2.15 WORKSPACE ACTIVITY (Audit log)
-- -----------------------------------------------------------------------------

CREATE TABLE public.workspace_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  clinic_id uuid,
  user_id uuid,
  user_email character varying,
  action character varying NOT NULL,
  entity_type character varying,
  entity_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workspace_activity_pkey PRIMARY KEY (id),
  CONSTRAINT workspace_activity_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id),
  CONSTRAINT workspace_activity_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id)
);

-- =============================================================================
-- PARTE 3: ÍNDICES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_clinics_workspace_id ON public.clinics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON public.patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_source_id ON public.patients(source_id);
CREATE INDEX IF NOT EXISTS idx_patients_campaign_id ON public.patients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_treatments_clinic_id ON public.treatments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_treatments_patient_id ON public.treatments(patient_id);
CREATE INDEX IF NOT EXISTS idx_treatments_service_id ON public.treatments(service_id);
CREATE INDEX IF NOT EXISTS idx_treatments_treatment_date ON public.treatments(treatment_date);
CREATE INDEX IF NOT EXISTS idx_services_clinic_id ON public.services(clinic_id);
CREATE INDEX IF NOT EXISTS idx_supplies_clinic_id ON public.supplies(clinic_id);
CREATE INDEX IF NOT EXISTS idx_expenses_clinic_id ON public.expenses(clinic_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_fixed_costs_clinic_id ON public.fixed_costs(clinic_id);
CREATE INDEX IF NOT EXISTS idx_assets_clinic_id ON public.assets(clinic_id);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_clinic_id ON public.marketing_campaigns(clinic_id);

-- =============================================================================
-- PARTE 4: FUNCIONES
-- =============================================================================

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para crear datos default de clínica
CREATE OR REPLACE FUNCTION handle_new_clinic()
RETURNS TRIGGER AS $$
DECLARE
  service_type_id uuid;
BEGIN
  -- Get the service category type ID
  SELECT id INTO service_type_id FROM public.category_types WHERE name = 'service' LIMIT 1;

  -- Crear patient sources por defecto
  INSERT INTO public.patient_sources (clinic_id, name) VALUES
    (NEW.id, 'Referral'),
    (NEW.id, 'Website'),
    (NEW.id, 'Social Media'),
    (NEW.id, 'Walk-in'),
    (NEW.id, 'Advertisement'),
    (NEW.id, 'Event'),
    (NEW.id, 'Other');

  -- Crear custom categories por defecto (if service category type exists)
  IF service_type_id IS NOT NULL THEN
    INSERT INTO public.custom_categories (clinic_id, category_type_id, name, display_name) VALUES
      (NEW.id, service_type_id, 'Preventive', 'Preventive'),
      (NEW.id, service_type_id, 'Restorative', 'Restorative'),
      (NEW.id, service_type_id, 'Surgical', 'Surgical');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función helper para verificar membresía en clínica
CREATE OR REPLACE FUNCTION is_clinic_member(clinic_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.clinic_users
    WHERE clinic_id = clinic_uuid AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    JOIN public.clinics c ON c.workspace_id = wm.workspace_id
    WHERE c.id = clinic_uuid AND wm.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función helper para verificar membresía en workspace
CREATE OR REPLACE FUNCTION is_workspace_member(workspace_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = workspace_uuid AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- PARTE 5: TRIGGERS
-- =============================================================================

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_time_updated_at BEFORE UPDATE ON public.settings_time
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplies_updated_at BEFORE UPDATE ON public.supplies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_treatments_updated_at BEFORE UPDATE ON public.treatments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para crear datos default al crear clínica
CREATE TRIGGER after_clinic_insert
  AFTER INSERT ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION handle_new_clinic();

-- =============================================================================
-- PARTE 6: ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Habilitar RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_time ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_google_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (pueden necesitar ajustes según tus necesidades)
-- Workspaces
CREATE POLICY "workspace_select" ON public.workspaces FOR SELECT USING (is_workspace_member(id) OR owner_id = auth.uid());
CREATE POLICY "workspace_insert" ON public.workspaces FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "workspace_update" ON public.workspaces FOR UPDATE USING (owner_id = auth.uid());

-- Clinics
CREATE POLICY "clinic_select" ON public.clinics FOR SELECT USING (is_clinic_member(id) OR is_workspace_member(workspace_id));
CREATE POLICY "clinic_insert" ON public.clinics FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "clinic_update" ON public.clinics FOR UPDATE USING (is_clinic_member(id));

-- Tablas dependientes de clinic_id (patrón común)
CREATE POLICY "patients_select" ON public.patients FOR SELECT USING (is_clinic_member(clinic_id));
CREATE POLICY "patients_insert" ON public.patients FOR INSERT WITH CHECK (is_clinic_member(clinic_id));
CREATE POLICY "patients_update" ON public.patients FOR UPDATE USING (is_clinic_member(clinic_id));
CREATE POLICY "patients_delete" ON public.patients FOR DELETE USING (is_clinic_member(clinic_id));

CREATE POLICY "treatments_select" ON public.treatments FOR SELECT USING (is_clinic_member(clinic_id));
CREATE POLICY "treatments_insert" ON public.treatments FOR INSERT WITH CHECK (is_clinic_member(clinic_id));
CREATE POLICY "treatments_update" ON public.treatments FOR UPDATE USING (is_clinic_member(clinic_id));
CREATE POLICY "treatments_delete" ON public.treatments FOR DELETE USING (is_clinic_member(clinic_id));

CREATE POLICY "services_select" ON public.services FOR SELECT USING (is_clinic_member(clinic_id));
CREATE POLICY "services_insert" ON public.services FOR INSERT WITH CHECK (is_clinic_member(clinic_id));
CREATE POLICY "services_update" ON public.services FOR UPDATE USING (is_clinic_member(clinic_id));
CREATE POLICY "services_delete" ON public.services FOR DELETE USING (is_clinic_member(clinic_id));

CREATE POLICY "supplies_select" ON public.supplies FOR SELECT USING (is_clinic_member(clinic_id));
CREATE POLICY "supplies_insert" ON public.supplies FOR INSERT WITH CHECK (is_clinic_member(clinic_id));
CREATE POLICY "supplies_update" ON public.supplies FOR UPDATE USING (is_clinic_member(clinic_id));
CREATE POLICY "supplies_delete" ON public.supplies FOR DELETE USING (is_clinic_member(clinic_id));

CREATE POLICY "expenses_select" ON public.expenses FOR SELECT USING (is_clinic_member(clinic_id));
CREATE POLICY "expenses_insert" ON public.expenses FOR INSERT WITH CHECK (is_clinic_member(clinic_id));
CREATE POLICY "expenses_update" ON public.expenses FOR UPDATE USING (is_clinic_member(clinic_id));
CREATE POLICY "expenses_delete" ON public.expenses FOR DELETE USING (is_clinic_member(clinic_id));

CREATE POLICY "fixed_costs_select" ON public.fixed_costs FOR SELECT USING (is_clinic_member(clinic_id));
CREATE POLICY "fixed_costs_insert" ON public.fixed_costs FOR INSERT WITH CHECK (is_clinic_member(clinic_id));
CREATE POLICY "fixed_costs_update" ON public.fixed_costs FOR UPDATE USING (is_clinic_member(clinic_id));
CREATE POLICY "fixed_costs_delete" ON public.fixed_costs FOR DELETE USING (is_clinic_member(clinic_id));

CREATE POLICY "assets_select" ON public.assets FOR SELECT USING (is_clinic_member(clinic_id));
CREATE POLICY "assets_insert" ON public.assets FOR INSERT WITH CHECK (is_clinic_member(clinic_id));
CREATE POLICY "assets_update" ON public.assets FOR UPDATE USING (is_clinic_member(clinic_id));
CREATE POLICY "assets_delete" ON public.assets FOR DELETE USING (is_clinic_member(clinic_id));

CREATE POLICY "settings_time_select" ON public.settings_time FOR SELECT USING (is_clinic_member(clinic_id));
CREATE POLICY "settings_time_insert" ON public.settings_time FOR INSERT WITH CHECK (is_clinic_member(clinic_id));
CREATE POLICY "settings_time_update" ON public.settings_time FOR UPDATE USING (is_clinic_member(clinic_id));

CREATE POLICY "patient_sources_select" ON public.patient_sources FOR SELECT USING (is_clinic_member(clinic_id));
CREATE POLICY "patient_sources_insert" ON public.patient_sources FOR INSERT WITH CHECK (is_clinic_member(clinic_id));
CREATE POLICY "patient_sources_update" ON public.patient_sources FOR UPDATE USING (is_clinic_member(clinic_id));
CREATE POLICY "patient_sources_delete" ON public.patient_sources FOR DELETE USING (is_clinic_member(clinic_id));

CREATE POLICY "custom_categories_select" ON public.custom_categories FOR SELECT USING (is_clinic_member(clinic_id));
CREATE POLICY "custom_categories_insert" ON public.custom_categories FOR INSERT WITH CHECK (is_clinic_member(clinic_id));
CREATE POLICY "custom_categories_update" ON public.custom_categories FOR UPDATE USING (is_clinic_member(clinic_id));
CREATE POLICY "custom_categories_delete" ON public.custom_categories FOR DELETE USING (is_clinic_member(clinic_id));

CREATE POLICY "marketing_campaigns_select" ON public.marketing_campaigns FOR SELECT USING (is_clinic_member(clinic_id));
CREATE POLICY "marketing_campaigns_insert" ON public.marketing_campaigns FOR INSERT WITH CHECK (is_clinic_member(clinic_id));
CREATE POLICY "marketing_campaigns_update" ON public.marketing_campaigns FOR UPDATE USING (is_clinic_member(clinic_id));
CREATE POLICY "marketing_campaigns_delete" ON public.marketing_campaigns FOR DELETE USING (is_clinic_member(clinic_id));

CREATE POLICY "tariffs_select" ON public.tariffs FOR SELECT USING (is_clinic_member(clinic_id));

CREATE POLICY "clinic_google_calendar_select" ON public.clinic_google_calendar FOR SELECT USING (is_clinic_member(clinic_id));
CREATE POLICY "clinic_google_calendar_insert" ON public.clinic_google_calendar FOR INSERT WITH CHECK (is_clinic_member(clinic_id));
CREATE POLICY "clinic_google_calendar_update" ON public.clinic_google_calendar FOR UPDATE USING (is_clinic_member(clinic_id));
CREATE POLICY "clinic_google_calendar_delete" ON public.clinic_google_calendar FOR DELETE USING (is_clinic_member(clinic_id));

-- Chat sessions/messages (user-based)
CREATE POLICY "ai_chat_sessions_select" ON public.ai_chat_sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ai_chat_sessions_insert" ON public.ai_chat_sessions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ai_chat_sessions_update" ON public.ai_chat_sessions FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "ai_chat_messages_select" ON public.ai_chat_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.ai_chat_sessions WHERE id = session_id AND user_id = auth.uid())
);
CREATE POLICY "ai_chat_messages_insert" ON public.ai_chat_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.ai_chat_sessions WHERE id = session_id AND user_id = auth.uid())
);

-- Workspace members/users
CREATE POLICY "workspace_members_select" ON public.workspace_members FOR SELECT USING (is_workspace_member(workspace_id) OR user_id = auth.uid());
CREATE POLICY "workspace_members_insert" ON public.workspace_members FOR INSERT WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "workspace_members_update" ON public.workspace_members FOR UPDATE USING (is_workspace_member(workspace_id));

CREATE POLICY "workspace_users_select" ON public.workspace_users FOR SELECT USING (is_workspace_member(workspace_id) OR user_id = auth.uid());
CREATE POLICY "workspace_users_insert" ON public.workspace_users FOR INSERT WITH CHECK (is_workspace_member(workspace_id));

CREATE POLICY "clinic_users_select" ON public.clinic_users FOR SELECT USING (is_clinic_member(clinic_id) OR user_id = auth.uid());
CREATE POLICY "clinic_users_insert" ON public.clinic_users FOR INSERT WITH CHECK (is_clinic_member(clinic_id));

-- Categories (may have null clinic_id for global categories)
CREATE POLICY "categories_select" ON public.categories FOR SELECT USING (clinic_id IS NULL OR is_clinic_member(clinic_id));
CREATE POLICY "categories_insert" ON public.categories FOR INSERT WITH CHECK (clinic_id IS NULL OR is_clinic_member(clinic_id));
CREATE POLICY "categories_update" ON public.categories FOR UPDATE USING (clinic_id IS NULL OR is_clinic_member(clinic_id));

-- =============================================================================
-- PARTE 7: DATOS INICIALES (SEED)
-- =============================================================================

-- Category types globales
INSERT INTO public.category_types (name, display_name) VALUES
  ('service', 'Categorías de Servicios'),
  ('supply', 'Categorías de Insumos'),
  ('fixed_cost', 'Categorías de Costos Fijos'),
  ('expense', 'Categorías de Gastos'),
  ('marketing_platform', 'Plataformas de Marketing')
ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- FIN DEL SCRIPT
-- =============================================================================

DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

  RAISE NOTICE '';
  RAISE NOTICE '✅ Schema v56 creado exitosamente!';
  RAISE NOTICE '📊 Total de tablas: %', table_count;
  RAISE NOTICE '';
  RAISE NOTICE '📋 PRÓXIMOS PASOS:';
  RAISE NOTICE '   1. Crear un usuario en Authentication';
  RAISE NOTICE '   2. Importar backup JSON desde la app';
  RAISE NOTICE '';
END $$;
