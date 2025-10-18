-- Migration: Complete CASCADE DELETE for all user and workspace relationships
-- This ensures that when a user account is deleted, ALL related data is properly cascaded
-- Date: 2025-10-15

-- ==============================================================================
-- STEP 1: Add missing CASCADE DELETE for user-related tables
-- ==============================================================================

-- User Workspaces -> User (CASCADE DELETE)
DO $$
BEGIN
    -- Drop existing constraint if exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'user_workspaces_user_id_fkey'
        AND table_name = 'user_workspaces'
    ) THEN
        ALTER TABLE public.user_workspaces DROP CONSTRAINT user_workspaces_user_id_fkey;
    END IF;

    -- Add CASCADE DELETE
    ALTER TABLE public.user_workspaces
    ADD CONSTRAINT user_workspaces_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;
END $$;

-- User Workspaces -> Workspace (CASCADE DELETE)
DO $$
BEGIN
    -- Drop existing constraint if exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'user_workspaces_workspace_id_fkey'
        AND table_name = 'user_workspaces'
    ) THEN
        ALTER TABLE public.user_workspaces DROP CONSTRAINT user_workspaces_workspace_id_fkey;
    END IF;

    -- Add CASCADE DELETE
    ALTER TABLE public.user_workspaces
    ADD CONSTRAINT user_workspaces_workspace_id_fkey
    FOREIGN KEY (workspace_id)
    REFERENCES public.workspaces(id)
    ON DELETE CASCADE;
END $$;

-- Workspace Members -> User (CASCADE DELETE)
DO $$
BEGIN
    -- Drop existing constraint if exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'workspace_members_user_id_fkey'
        AND table_name = 'workspace_members'
    ) THEN
        ALTER TABLE public.workspace_members DROP CONSTRAINT workspace_members_user_id_fkey;
    END IF;

    -- Add CASCADE DELETE
    ALTER TABLE public.workspace_members
    ADD CONSTRAINT workspace_members_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;
END $$;

-- Workspace Members -> Workspace (CASCADE DELETE)
DO $$
BEGIN
    -- Drop existing constraint if exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'workspace_members_workspace_id_fkey'
        AND table_name = 'workspace_members'
    ) THEN
        ALTER TABLE public.workspace_members DROP CONSTRAINT workspace_members_workspace_id_fkey;
    END IF;

    -- Add CASCADE DELETE
    ALTER TABLE public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_fkey
    FOREIGN KEY (workspace_id)
    REFERENCES public.workspaces(id)
    ON DELETE CASCADE;
END $$;

-- Workspaces -> Owner (CASCADE DELETE)
DO $$
BEGIN
    -- Drop existing constraint if exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'workspaces_owner_id_fkey'
        AND table_name = 'workspaces'
    ) THEN
        ALTER TABLE public.workspaces DROP CONSTRAINT workspaces_owner_id_fkey;
    END IF;

    -- Add CASCADE DELETE
    ALTER TABLE public.workspaces
    ADD CONSTRAINT workspaces_owner_id_fkey
    FOREIGN KEY (owner_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;
END $$;

-- Workspace Activity -> Workspace (CASCADE DELETE)
DO $$
BEGIN
    -- Drop existing constraint if exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'workspace_activity_workspace_id_fkey'
        AND table_name = 'workspace_activity'
    ) THEN
        ALTER TABLE public.workspace_activity DROP CONSTRAINT workspace_activity_workspace_id_fkey;
    END IF;

    -- Add CASCADE DELETE
    ALTER TABLE public.workspace_activity
    ADD CONSTRAINT workspace_activity_workspace_id_fkey
    FOREIGN KEY (workspace_id)
    REFERENCES public.workspaces(id)
    ON DELETE CASCADE;
END $$;

-- Users table -> Auth Users (CASCADE DELETE)
DO $$
BEGIN
    -- Drop existing constraint if exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'users_id_fkey'
        AND table_name = 'users'
    ) THEN
        ALTER TABLE public.users DROP CONSTRAINT users_id_fkey;
    END IF;

    -- Add CASCADE DELETE
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'users'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.users
        ADD CONSTRAINT users_id_fkey
        FOREIGN KEY (id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE;
    END IF;
END $$;

-- ==============================================================================
-- STEP 2: Create verification_codes table if not exists
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.verification_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    used BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Index for quick lookups
    CONSTRAINT idx_verification_email_code UNIQUE (email, code)
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON public.verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON public.verification_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_verification_codes_used ON public.verification_codes(used);

-- ==============================================================================
-- STEP 3: Verify category_types and expense_categories tables exist with CASCADE
-- ==============================================================================

-- Create category_types table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.category_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(clinic_id, entity_type, name)
);

-- Create expense_categories table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.expense_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 999,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(clinic_id, name)
);

-- ==============================================================================
-- STEP 4: Ensure marketing_platforms table exists with CASCADE
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.marketing_platforms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    platform_type VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(clinic_id, name)
);

-- ==============================================================================
-- STEP 5: Add indexes for performance
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_category_types_clinic ON public.category_types(clinic_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_clinic ON public.expense_categories(clinic_id);
CREATE INDEX IF NOT EXISTS idx_marketing_platforms_clinic ON public.marketing_platforms(clinic_id);

-- ==============================================================================
-- SUMMARY OF CASCADE DELETE CHAIN
-- ==============================================================================
-- When auth.users record is deleted:
-- 1. public.users record is deleted (CASCADE)
-- 2. public.user_workspaces records are deleted (CASCADE)
-- 3. public.workspace_members records are deleted (CASCADE)
-- 4. public.verification_codes records are deleted (CASCADE)
-- 5. If user owns workspaces:
--    - public.workspaces records are deleted (CASCADE)
--    - public.workspace_activity records are deleted (CASCADE)
--    - public.clinics records are deleted (CASCADE)
--    - All clinic-related data is deleted (CASCADE):
--      * category_types, categories, expense_categories
--      * marketing_platforms, marketing_campaigns, marketing_campaign_status_history
--      * services, supplies, service_supplies
--      * assets, fixed_costs, settings_time
--      * patients, treatments, expenses, tariffs

-- Success message
SELECT 'Migration completed: Complete CASCADE DELETE chain established for user account deletion' as status;