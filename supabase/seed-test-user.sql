-- Script para crear usuario de prueba en Supabase
-- IMPORTANTE: Ejecutar este script en el dashboard de Supabase

-- Paso 1: Crear el usuario de prueba (esto debe hacerse mediante Auth API o Dashboard)
-- Email: test@laralis.com
-- Password: Test123456!

-- Paso 2: Una vez creado el usuario, obtener su ID y ejecutar lo siguiente:
-- Reemplazar 'USER_ID_HERE' con el ID real del usuario creado

DO $$
DECLARE
    test_user_id UUID := 'USER_ID_HERE'; -- REEMPLAZAR con el ID del usuario
    test_workspace_id UUID;
    test_clinic_id UUID;
BEGIN
    -- Crear workspace de prueba
    INSERT INTO public.workspaces (
        id,
        name,
        slug,
        owner_id,
        onboarding_completed,
        onboarding_step,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        'Test Workspace',
        'test-workspace',
        test_user_id,
        true,
        5,
        NOW(),
        NOW()
    ) RETURNING id INTO test_workspace_id;

    -- Crear membresía del workspace
    INSERT INTO public.workspace_members (
        workspace_id,
        user_id,
        role,
        created_at
    ) VALUES (
        test_workspace_id,
        test_user_id,
        'owner',
        NOW()
    );

    -- Crear clínica de prueba
    INSERT INTO public.clinics (
        id,
        workspace_id,
        name,
        address,
        phone,
        email,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        gen_random_uuid(),
        test_workspace_id,
        'Test Clinic',
        '123 Test Street',
        '555-0100',
        'clinic@test.com',
        true,
        NOW(),
        NOW()
    ) RETURNING id INTO test_clinic_id;

    -- Crear configuración de tiempo
    INSERT INTO public.settings_time (
        clinic_id,
        working_days_per_month,
        working_hours_per_day,
        productive_minutes_per_hour,
        created_at,
        updated_at
    ) VALUES (
        test_clinic_id,
        20,
        8,
        50,
        NOW(),
        NOW()
    );

    -- Crear algunos costos fijos
    INSERT INTO public.fixed_costs (clinic_id, name, category, amount_cents, is_active)
    VALUES 
        (test_clinic_id, 'Renta', 'rent', 2000000, true),
        (test_clinic_id, 'Electricidad', 'utilities', 50000, true),
        (test_clinic_id, 'Internet', 'utilities', 100000, true);

    -- Crear algunos insumos
    INSERT INTO public.supplies (clinic_id, name, unit, quantity_per_unit, cost_per_unit_cents, unit_cost_cents, is_active)
    VALUES 
        (test_clinic_id, 'Guantes', 'caja', 100, 15000, 150, true),
        (test_clinic_id, 'Mascarillas', 'paquete', 50, 8000, 160, true),
        (test_clinic_id, 'Anestesia', 'cartucho', 10, 25000, 2500, true);

    -- Crear algunos servicios
    INSERT INTO public.services (clinic_id, name, duration_minutes, margin_percentage, is_active)
    VALUES 
        (test_clinic_id, 'Limpieza Dental', 30, 50, true),
        (test_clinic_id, 'Extracción Simple', 45, 60, true),
        (test_clinic_id, 'Endodoncia', 90, 75, true);

    -- Crear algunos pacientes
    INSERT INTO public.patients (clinic_id, first_name, last_name, email, phone)
    VALUES 
        (test_clinic_id, 'Juan', 'Pérez', 'juan@example.com', '555-0001'),
        (test_clinic_id, 'María', 'González', 'maria@example.com', '555-0002'),
        (test_clinic_id, 'Carlos', 'López', 'carlos@example.com', '555-0003');

    -- Crear plataformas de marketing del sistema (compartidas entre todas las clínicas)
    INSERT INTO public.categories (entity_type, name, display_name, is_system, is_active, display_order)
    VALUES 
        ('marketing_platform', 'meta-ads', 'Meta Ads', true, true, 1),
        ('marketing_platform', 'google-ads', 'Google Ads', true, true, 2),
        ('marketing_platform', 'tiktok-ads', 'TikTok Ads', true, true, 3),
        ('marketing_platform', 'linkedin-ads', 'LinkedIn Ads', true, true, 4),
        ('marketing_platform', 'twitter-ads', 'Twitter Ads', true, true, 5)
    ON CONFLICT (entity_type, name) DO NOTHING;

    -- Crear categorías de fuentes de pacientes
    INSERT INTO public.categories (entity_type, name, display_name, is_system, is_active, display_order)
    VALUES 
        ('patient_source', 'campaign', 'Campaña', true, true, 1),
        ('patient_source', 'patient-referral', 'Referencia de paciente', true, true, 2),
        ('patient_source', 'google-search', 'Búsqueda en Google', true, true, 3),
        ('patient_source', 'social-media', 'Redes sociales', true, true, 4),
        ('patient_source', 'website', 'Sitio web', true, true, 5),
        ('patient_source', 'direct-call', 'Llamada directa', true, true, 6),
        ('patient_source', 'walk-in', 'Walk-in', true, true, 7),
        ('patient_source', 'other', 'Otro', true, true, 8)
    ON CONFLICT (entity_type, name) DO NOTHING;

    RAISE NOTICE 'Test data created successfully!';
    RAISE NOTICE 'Workspace ID: %', test_workspace_id;
    RAISE NOTICE 'Clinic ID: %', test_clinic_id;
    
END $$;

-- Instrucciones:
-- 1. Crear usuario en Supabase Auth con email: test@laralis.com y password: Test123456!
-- 2. Obtener el ID del usuario creado
-- 3. Reemplazar 'USER_ID_HERE' con el ID real
-- 4. Ejecutar este script en el SQL Editor de Supabase