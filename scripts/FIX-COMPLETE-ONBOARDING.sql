-- =================================================================
-- SCRIPT COMPLETO: Fix de Onboarding (TODO-EN-UNO)
-- =================================================================
-- Ejecutar TODO este script de una sola vez en Supabase SQL Editor
-- =================================================================

-- ============================
-- PARTE 1: DIAGNÓSTICO INICIAL
-- ============================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'INICIANDO DIAGNÓSTICO Y FIX DE ONBOARDING';
    RAISE NOTICE '========================================';
END $$;

-- Verificar si las tablas existen
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'patient_sources') THEN
        RAISE NOTICE '✅ Tabla patient_sources existe';
    ELSE
        RAISE EXCEPTION '❌ CRÍTICO: Tabla patient_sources NO EXISTE. Debes ejecutar primero el script 30-patient-sources-and-referrals.sql';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'custom_categories') THEN
        RAISE NOTICE '✅ Tabla custom_categories existe';
    ELSE
        RAISE EXCEPTION '❌ CRÍTICO: Tabla custom_categories NO EXISTE. Debes ejecutar primero el script 30-patient-sources-and-referrals.sql';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'category_types') THEN
        RAISE NOTICE '✅ Tabla category_types existe';
    ELSE
        RAISE EXCEPTION '❌ CRÍTICO: Tabla category_types NO EXISTE. Debes ejecutar primero el script 30-patient-sources-and-referrals.sql';
    END IF;
END $$;

-- ============================
-- PARTE 2: HABILITAR RLS
-- ============================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'HABILITANDO RLS EN LAS TABLAS';
    RAISE NOTICE '========================================';
END $$;

ALTER TABLE public.patient_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    RAISE NOTICE '✅ RLS habilitado en patient_sources';
    RAISE NOTICE '✅ RLS habilitado en custom_categories';
    RAISE NOTICE '✅ RLS habilitado en category_types';
END $$;

-- ============================
-- PARTE 3: CREAR POLÍTICAS
-- ============================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'CREANDO POLÍTICAS RLS';
    RAISE NOTICE '========================================';
END $$;

-- PATIENT_SOURCES
DROP POLICY IF EXISTS "Users can view patient sources in their clinics" ON public.patient_sources;
CREATE POLICY "Users can view patient sources in their clinics" ON public.patient_sources
  FOR SELECT USING (
    clinic_id IN (
      SELECT c.id FROM public.clinics c
      INNER JOIN public.workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert patient sources in their clinics" ON public.patient_sources;
CREATE POLICY "Users can insert patient sources in their clinics" ON public.patient_sources
  FOR INSERT WITH CHECK (
    clinic_id IN (
      SELECT c.id FROM public.clinics c
      INNER JOIN public.workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update patient sources in their clinics" ON public.patient_sources;
CREATE POLICY "Users can update patient sources in their clinics" ON public.patient_sources
  FOR UPDATE USING (
    clinic_id IN (
      SELECT c.id FROM public.clinics c
      INNER JOIN public.workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete custom patient sources in their clinics" ON public.patient_sources;
CREATE POLICY "Users can delete custom patient sources in their clinics" ON public.patient_sources
  FOR DELETE USING (
    clinic_id IN (
      SELECT c.id FROM public.clinics c
      INNER JOIN public.workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
    AND is_system = false
  );

DO $$
BEGIN
    RAISE NOTICE '✅ Políticas creadas para patient_sources (4)';
END $$;

-- CUSTOM_CATEGORIES
DROP POLICY IF EXISTS "Users can view categories in their clinics" ON public.custom_categories;
CREATE POLICY "Users can view categories in their clinics" ON public.custom_categories
  FOR SELECT USING (
    clinic_id IN (
      SELECT c.id FROM public.clinics c
      INNER JOIN public.workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert categories in their clinics" ON public.custom_categories;
CREATE POLICY "Users can insert categories in their clinics" ON public.custom_categories
  FOR INSERT WITH CHECK (
    clinic_id IN (
      SELECT c.id FROM public.clinics c
      INNER JOIN public.workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update categories in their clinics" ON public.custom_categories;
CREATE POLICY "Users can update categories in their clinics" ON public.custom_categories
  FOR UPDATE USING (
    clinic_id IN (
      SELECT c.id FROM public.clinics c
      INNER JOIN public.workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete custom categories in their clinics" ON public.custom_categories;
CREATE POLICY "Users can delete custom categories in their clinics" ON public.custom_categories
  FOR DELETE USING (
    clinic_id IN (
      SELECT c.id FROM public.clinics c
      INNER JOIN public.workspaces w ON c.workspace_id = w.id
      WHERE w.owner_id = auth.uid()
    )
    AND is_system = false
  );

DO $$
BEGIN
    RAISE NOTICE '✅ Políticas creadas para custom_categories (4)';
END $$;

-- CATEGORY_TYPES
DROP POLICY IF EXISTS "Authenticated users can view category types" ON public.category_types;
CREATE POLICY "Authenticated users can view category types" ON public.category_types
  FOR SELECT USING (auth.uid() IS NOT NULL);

DO $$
BEGIN
    RAISE NOTICE '✅ Políticas creadas para category_types (1)';
END $$;

-- ============================
-- PARTE 4: VERIFICACIÓN FINAL
-- ============================

DO $$
DECLARE
    v_patient_sources_policies INT;
    v_custom_categories_policies INT;
    v_category_types_policies INT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIÓN FINAL';
    RAISE NOTICE '========================================';

    -- Contar políticas
    SELECT COUNT(*) INTO v_patient_sources_policies
    FROM pg_policies
    WHERE tablename = 'patient_sources' AND schemaname = 'public';

    SELECT COUNT(*) INTO v_custom_categories_policies
    FROM pg_policies
    WHERE tablename = 'custom_categories' AND schemaname = 'public';

    SELECT COUNT(*) INTO v_category_types_policies
    FROM pg_policies
    WHERE tablename = 'category_types' AND schemaname = 'public';

    RAISE NOTICE 'patient_sources: % políticas', v_patient_sources_policies;
    RAISE NOTICE 'custom_categories: % políticas', v_custom_categories_policies;
    RAISE NOTICE 'category_types: % políticas', v_category_types_policies;

    -- Verificar políticas críticas
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'patient_sources'
        AND policyname = 'Users can insert patient sources in their clinics'
    ) THEN
        RAISE NOTICE '✅ patient_sources INSERT policy OK';
    ELSE
        RAISE EXCEPTION '❌ patient_sources INSERT policy FALTA';
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'custom_categories'
        AND policyname = 'Users can insert categories in their clinics'
    ) THEN
        RAISE NOTICE '✅ custom_categories INSERT policy OK';
    ELSE
        RAISE EXCEPTION '❌ custom_categories INSERT policy FALTA';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅✅✅ ÉXITO TOTAL ✅✅✅';
    RAISE NOTICE 'Políticas RLS configuradas correctamente';
    RAISE NOTICE 'El onboarding DEBERÍA funcionar ahora';
    RAISE NOTICE '========================================';
END $$;

-- Mostrar resumen de políticas
SELECT
    'RESUMEN FINAL' as seccion,
    tablename as tabla,
    cmd as comando,
    COUNT(*) as cantidad
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('patient_sources', 'custom_categories', 'category_types')
GROUP BY tablename, cmd
ORDER BY tablename, cmd;
