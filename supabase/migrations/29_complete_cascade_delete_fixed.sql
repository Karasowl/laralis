-- Migration: Complete CASCADE DELETE for user account deletion (FIXED)
-- This ensures that when a user account is deleted, ALL related data is properly cascaded
-- Date: 2025-10-15

-- ==============================================================================
-- STEP 1: Add CASCADE DELETE for workspace-related tables
-- ==============================================================================

-- Workspace Members -> User (CASCADE DELETE)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'workspace_members_user_id_fkey'
        AND table_name = 'workspace_members'
    ) THEN
        ALTER TABLE public.workspace_members DROP CONSTRAINT workspace_members_user_id_fkey;
    END IF;

    -- Solo agregar si la tabla workspace_members existe
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'workspace_members'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.workspace_members
        ADD CONSTRAINT workspace_members_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- Workspace Members -> Workspace (CASCADE DELETE)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'workspace_members_workspace_id_fkey'
        AND table_name = 'workspace_members'
    ) THEN
        ALTER TABLE public.workspace_members DROP CONSTRAINT workspace_members_workspace_id_fkey;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'workspace_members'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.workspace_members
        ADD CONSTRAINT workspace_members_workspace_id_fkey
        FOREIGN KEY (workspace_id)
        REFERENCES public.workspaces(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- Workspaces -> Owner (CASCADE DELETE)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'workspaces_owner_id_fkey'
        AND table_name = 'workspaces'
    ) THEN
        ALTER TABLE public.workspaces DROP CONSTRAINT workspaces_owner_id_fkey;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'workspaces'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.workspaces
        ADD CONSTRAINT workspaces_owner_id_fkey
        FOREIGN KEY (owner_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- Workspace Activity -> Workspace (CASCADE DELETE)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'workspace_activity_workspace_id_fkey'
        AND table_name = 'workspace_activity'
    ) THEN
        ALTER TABLE public.workspace_activity DROP CONSTRAINT workspace_activity_workspace_id_fkey;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'workspace_activity'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.workspace_activity
        ADD CONSTRAINT workspace_activity_workspace_id_fkey
        FOREIGN KEY (workspace_id)
        REFERENCES public.workspaces(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- Users table -> Auth Users (CASCADE DELETE) - Solo si existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'users'
        AND table_schema = 'public'
    ) THEN
        -- Eliminar constraint existente si hay
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'users_id_fkey'
            AND table_name = 'users'
        ) THEN
            ALTER TABLE public.users DROP CONSTRAINT users_id_fkey;
        END IF;

        -- Agregar CASCADE DELETE
        ALTER TABLE public.users
        ADD CONSTRAINT users_id_fkey
        FOREIGN KEY (id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- ==============================================================================
-- STEP 2: Create or verify verification_codes table
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.verification_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    user_id UUID,
    used BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agregar foreign key con CASCADE si la columna user_id existe
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'verification_codes'
        AND column_name = 'user_id'
        AND table_schema = 'public'
    ) THEN
        -- Eliminar constraint existente
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'verification_codes_user_id_fkey'
            AND table_name = 'verification_codes'
        ) THEN
            ALTER TABLE public.verification_codes DROP CONSTRAINT verification_codes_user_id_fkey;
        END IF;

        -- Agregar CASCADE DELETE
        ALTER TABLE public.verification_codes
        ADD CONSTRAINT verification_codes_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- Crear índices si no existen
CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON public.verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON public.verification_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_codes_used ON public.verification_codes(used);

-- ==============================================================================
-- STEP 3: Verify and ensure all clinic-related tables have CASCADE
-- ==============================================================================

-- Ya verificado en migración 28, pero aseguramos marketing_platforms
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'marketing_platforms'
        AND table_schema = 'public'
    ) THEN
        -- Eliminar constraint existente
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'marketing_platforms_clinic_id_fkey'
            AND table_name = 'marketing_platforms'
        ) THEN
            ALTER TABLE public.marketing_platforms DROP CONSTRAINT marketing_platforms_clinic_id_fkey;
        END IF;

        -- Agregar CASCADE DELETE
        ALTER TABLE public.marketing_platforms
        ADD CONSTRAINT marketing_platforms_clinic_id_fkey
        FOREIGN KEY (clinic_id)
        REFERENCES public.clinics(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- ==============================================================================
-- VERIFICATION: Show current CASCADE DELETE chain
-- ==============================================================================

-- Mostrar todas las foreign keys con CASCADE DELETE
SELECT
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
    AND rc.constraint_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND rc.delete_rule = 'CASCADE'
ORDER BY tc.table_name, tc.constraint_name;

-- ==============================================================================
-- SUMMARY
-- ==============================================================================
-- CASCADE DELETE chain established:
--
-- auth.users (deleted) →
--   ├── public.users (CASCADE)
--   ├── public.workspace_members (CASCADE)
--   ├── public.verification_codes (CASCADE)
--   └── public.workspaces (if owner_id matches) (CASCADE) →
--        ├── public.workspace_members (CASCADE)
--        ├── public.workspace_activity (CASCADE)
--        └── public.clinics (CASCADE) →
--             └── ALL clinic data tables (CASCADE):
--                  - settings_time, fixed_costs, assets
--                  - supplies, services, service_supplies
--                  - patients, treatments, expenses, tariffs
--                  - categories, category_types, expense_categories
--                  - marketing_platforms, marketing_campaigns
--                  - marketing_campaign_status_history
--
-- Success message
SELECT '✅ Migration completed: Complete CASCADE DELETE chain established' as status;