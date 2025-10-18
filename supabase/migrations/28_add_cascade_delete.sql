-- Migration: Add CASCADE DELETE to maintain referential integrity
-- When a clinic is deleted, all related data should be deleted automatically
-- When a workspace is deleted, all clinics and related data should be deleted

-- ==============================================================================
-- STEP 1: Drop existing foreign keys without CASCADE
-- ==============================================================================

-- Drop clinic_id foreign keys (if they exist)
DO $$
BEGIN
    -- settings_time
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'settings_time_clinic_id_fkey'
        AND table_name = 'settings_time'
    ) THEN
        ALTER TABLE public.settings_time DROP CONSTRAINT settings_time_clinic_id_fkey;
    END IF;

    -- fixed_costs
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fixed_costs_clinic_id_fkey'
        AND table_name = 'fixed_costs'
    ) THEN
        ALTER TABLE public.fixed_costs DROP CONSTRAINT fixed_costs_clinic_id_fkey;
    END IF;

    -- assets
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'assets_clinic_id_fkey'
        AND table_name = 'assets'
    ) THEN
        ALTER TABLE public.assets DROP CONSTRAINT assets_clinic_id_fkey;
    END IF;

    -- supplies
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'supplies_clinic_id_fkey'
        AND table_name = 'supplies'
    ) THEN
        ALTER TABLE public.supplies DROP CONSTRAINT supplies_clinic_id_fkey;
    END IF;

    -- services
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'services_clinic_id_fkey'
        AND table_name = 'services'
    ) THEN
        ALTER TABLE public.services DROP CONSTRAINT services_clinic_id_fkey;
    END IF;

    -- service_supplies
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'service_supplies_service_id_fkey'
        AND table_name = 'service_supplies'
    ) THEN
        ALTER TABLE public.service_supplies DROP CONSTRAINT service_supplies_service_id_fkey;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'service_supplies_supply_id_fkey'
        AND table_name = 'service_supplies'
    ) THEN
        ALTER TABLE public.service_supplies DROP CONSTRAINT service_supplies_supply_id_fkey;
    END IF;

    -- patients
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'patients_clinic_id_fkey'
        AND table_name = 'patients'
    ) THEN
        ALTER TABLE public.patients DROP CONSTRAINT patients_clinic_id_fkey;
    END IF;

    -- treatments
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'treatments_clinic_id_fkey'
        AND table_name = 'treatments'
    ) THEN
        ALTER TABLE public.treatments DROP CONSTRAINT treatments_clinic_id_fkey;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'treatments_patient_id_fkey'
        AND table_name = 'treatments'
    ) THEN
        ALTER TABLE public.treatments DROP CONSTRAINT treatments_patient_id_fkey;
    END IF;

    -- expenses
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'expenses_clinic_id_fkey'
        AND table_name = 'expenses'
    ) THEN
        ALTER TABLE public.expenses DROP CONSTRAINT expenses_clinic_id_fkey;
    END IF;

    -- tariffs
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'tariffs_clinic_id_fkey'
        AND table_name = 'tariffs'
    ) THEN
        ALTER TABLE public.tariffs DROP CONSTRAINT tariffs_clinic_id_fkey;
    END IF;

    -- marketing tables
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'marketing_platforms_clinic_id_fkey'
        AND table_name = 'marketing_platforms'
    ) THEN
        ALTER TABLE public.marketing_platforms DROP CONSTRAINT marketing_platforms_clinic_id_fkey;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'marketing_campaigns_platform_id_fkey'
        AND table_name = 'marketing_campaigns'
    ) THEN
        ALTER TABLE public.marketing_campaigns DROP CONSTRAINT marketing_campaigns_platform_id_fkey;
    END IF;

    -- clinics -> workspace
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'clinics_workspace_id_fkey'
        AND table_name = 'clinics'
    ) THEN
        ALTER TABLE public.clinics DROP CONSTRAINT clinics_workspace_id_fkey;
    END IF;

    -- expense_categories
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'expense_categories_clinic_id_fkey'
        AND table_name = 'expense_categories'
    ) THEN
        ALTER TABLE public.expense_categories DROP CONSTRAINT expense_categories_clinic_id_fkey;
    END IF;

END $$;

-- ==============================================================================
-- STEP 2: Add foreign keys WITH CASCADE DELETE
-- ==============================================================================

-- Clinics -> Workspace (CASCADE DELETE)
ALTER TABLE public.clinics
ADD CONSTRAINT clinics_workspace_id_fkey
FOREIGN KEY (workspace_id)
REFERENCES public.workspaces(id)
ON DELETE CASCADE;

-- Settings Time -> Clinic (CASCADE DELETE)
ALTER TABLE public.settings_time
ADD CONSTRAINT settings_time_clinic_id_fkey
FOREIGN KEY (clinic_id)
REFERENCES public.clinics(id)
ON DELETE CASCADE;

-- Fixed Costs -> Clinic (CASCADE DELETE)
ALTER TABLE public.fixed_costs
ADD CONSTRAINT fixed_costs_clinic_id_fkey
FOREIGN KEY (clinic_id)
REFERENCES public.clinics(id)
ON DELETE CASCADE;

-- Assets -> Clinic (CASCADE DELETE)
ALTER TABLE public.assets
ADD CONSTRAINT assets_clinic_id_fkey
FOREIGN KEY (clinic_id)
REFERENCES public.clinics(id)
ON DELETE CASCADE;

-- Supplies -> Clinic (CASCADE DELETE)
ALTER TABLE public.supplies
ADD CONSTRAINT supplies_clinic_id_fkey
FOREIGN KEY (clinic_id)
REFERENCES public.clinics(id)
ON DELETE CASCADE;

-- Services -> Clinic (CASCADE DELETE)
ALTER TABLE public.services
ADD CONSTRAINT services_clinic_id_fkey
FOREIGN KEY (clinic_id)
REFERENCES public.clinics(id)
ON DELETE CASCADE;

-- Service Supplies -> Service (CASCADE DELETE)
ALTER TABLE public.service_supplies
ADD CONSTRAINT service_supplies_service_id_fkey
FOREIGN KEY (service_id)
REFERENCES public.services(id)
ON DELETE CASCADE;

-- Service Supplies -> Supply (CASCADE DELETE)
ALTER TABLE public.service_supplies
ADD CONSTRAINT service_supplies_supply_id_fkey
FOREIGN KEY (supply_id)
REFERENCES public.supplies(id)
ON DELETE CASCADE;

-- Patients -> Clinic (CASCADE DELETE)
ALTER TABLE public.patients
ADD CONSTRAINT patients_clinic_id_fkey
FOREIGN KEY (clinic_id)
REFERENCES public.clinics(id)
ON DELETE CASCADE;

-- Treatments -> Patient (CASCADE DELETE)
ALTER TABLE public.treatments
ADD CONSTRAINT treatments_patient_id_fkey
FOREIGN KEY (patient_id)
REFERENCES public.patients(id)
ON DELETE CASCADE;

-- Treatments -> Clinic (CASCADE DELETE)
ALTER TABLE public.treatments
ADD CONSTRAINT treatments_clinic_id_fkey
FOREIGN KEY (clinic_id)
REFERENCES public.clinics(id)
ON DELETE CASCADE;

-- Expenses -> Clinic (CASCADE DELETE)
ALTER TABLE public.expenses
ADD CONSTRAINT expenses_clinic_id_fkey
FOREIGN KEY (clinic_id)
REFERENCES public.clinics(id)
ON DELETE CASCADE;

-- Tariffs -> Clinic (CASCADE DELETE)
ALTER TABLE public.tariffs
ADD CONSTRAINT tariffs_clinic_id_fkey
FOREIGN KEY (clinic_id)
REFERENCES public.clinics(id)
ON DELETE CASCADE;

-- Marketing Platforms -> Clinic (CASCADE DELETE)
ALTER TABLE public.marketing_platforms
ADD CONSTRAINT marketing_platforms_clinic_id_fkey
FOREIGN KEY (clinic_id)
REFERENCES public.clinics(id)
ON DELETE CASCADE;

-- Marketing Campaigns -> Platform (CASCADE DELETE)
ALTER TABLE public.marketing_campaigns
ADD CONSTRAINT marketing_campaigns_platform_id_fkey
FOREIGN KEY (platform_id)
REFERENCES public.marketing_platforms(id)
ON DELETE CASCADE;

-- Expense Categories -> Clinic (CASCADE DELETE)
ALTER TABLE public.expense_categories
ADD CONSTRAINT expense_categories_clinic_id_fkey
FOREIGN KEY (clinic_id)
REFERENCES public.clinics(id)
ON DELETE CASCADE;

-- ==============================================================================
-- SUMMARY
-- ==============================================================================
-- This migration ensures that:
-- 1. When a workspace is deleted, all its clinics are deleted (CASCADE)
-- 2. When a clinic is deleted, all related data is deleted (CASCADE):
--    - settings_time
--    - fixed_costs
--    - assets
--    - supplies
--    - services (and their service_supplies)
--    - patients (and their treatments)
--    - treatments
--    - expenses
--    - tariffs
--    - marketing_platforms (and their campaigns)
--    - expense_categories
