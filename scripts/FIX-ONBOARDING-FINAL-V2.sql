-- =================================================================
-- SCRIPT FINAL V2: Fix COMPLETO de Onboarding
-- =================================================================
-- Este script resuelve TODOS los problemas del onboarding:
-- 1. Agrega constraint UNIQUE a category_types.name si no existe
-- 2. Puebla category_types con los datos necesarios
-- 3. Habilita RLS en patient_sources, custom_categories, category_types
-- 4. Agrega políticas RLS necesarias para los triggers
-- =================================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '🔧 INICIANDO FIX COMPLETO DE ONBOARDING V2';
    RAISE NOTICE '========================================';
END $$;

-- ============================
-- PARTE 1: VERIFICAR TABLAS
-- ============================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '1️⃣ Verificando que las tablas existen...';

    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'patient_sources') THEN
        RAISE EXCEPTION '❌ CRÍTICO: Tabla patient_sources NO EXISTE';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'custom_categories') THEN
        RAISE EXCEPTION '❌ CRÍTICO: Tabla custom_categories NO EXISTE';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'category_types') THEN
        RAISE EXCEPTION '❌ CRÍTICO: Tabla category_types NO EXISTE';
    END IF;

    RAISE NOTICE '   ✅ Todas las tablas existen';
END $$;

-- ============================
-- PARTE 2: AGREGAR CONSTRAINT UNIQUE A category_types
-- ============================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '2️⃣ Verificando/agregando constraint UNIQUE en category_types.name...';

    -- Verificar si el constraint ya existe
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'category_types_name_key'
        AND conrelid = 'category_types'::regclass
    ) THEN
        -- Agregar constraint UNIQUE
        ALTER TABLE category_types ADD CONSTRAINT category_types_name_key UNIQUE (name);
        RAISE NOTICE '   ✅ Constraint UNIQUE agregado a category_types.name';
    ELSE
        RAISE NOTICE '   ℹ️ Constraint UNIQUE ya existe en category_types.name';
    END IF;
END $$;

-- ============================
-- PARTE 3: POBLAR category_types
-- ============================

DO $$
DECLARE
    v_count INT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '3️⃣ Poblando category_types con datos necesarios...';

    -- Insertar tipos básicos (ahora que tenemos el constraint UNIQUE)
    INSERT INTO category_types (name, display_name) VALUES
        ('service', 'Categorías de Servicios'),
        ('supply', 'Categorías de Insumos'),
        ('fixed_cost', 'Categorías de Costos Fijos'),
        ('expense', 'Categorías de Gastos')
    ON CONFLICT (name) DO NOTHING;

    -- Verificar
    SELECT COUNT(*) INTO v_count FROM category_types WHERE name IN ('service', 'supply', 'fixed_cost', 'expense');

    IF v_count >= 4 THEN
        RAISE NOTICE '   ✅ category_types poblada (%/4 tipos)', v_count;
    ELSE
        RAISE WARNING '   ⚠️ Solo % tipos encontrados (esperado: 4)', v_count;
    END IF;
END $$;

-- ============================
-- PARTE 4: HABILITAR RLS
-- ============================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '4️⃣ Habilitando RLS...';
END $$;

ALTER TABLE public.patient_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_types ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    RAISE NOTICE '   ✅ RLS habilitado en las 3 tablas';
END $$;

-- ============================
-- PARTE 5: POLÍTICAS RLS
-- ============================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '5️⃣ Creando políticas RLS...';
END $$;

-- === PATIENT_SOURCES ===
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

-- === CUSTOM_CATEGORIES ===
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

-- === CATEGORY_TYPES ===
DROP POLICY IF EXISTS "Authenticated users can view category types" ON public.category_types;
CREATE POLICY "Authenticated users can view category types" ON public.category_types
  FOR SELECT USING (auth.uid() IS NOT NULL);

DO $$
BEGIN
    RAISE NOTICE '   ✅ 9 políticas RLS creadas';
END $$;

-- ============================
-- PARTE 6: VERIFICACIÓN FINAL
-- ============================

DO $$
DECLARE
    v_category_types_count INT;
    v_patient_sources_policies INT;
    v_custom_categories_policies INT;
    v_has_service BOOLEAN;
    v_has_supply BOOLEAN;
    v_has_fixed_cost BOOLEAN;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '6️⃣ Verificación final...';

    -- Verificar category_types
    SELECT COUNT(*) INTO v_category_types_count FROM category_types;
    SELECT EXISTS(SELECT 1 FROM category_types WHERE name = 'service') INTO v_has_service;
    SELECT EXISTS(SELECT 1 FROM category_types WHERE name = 'supply') INTO v_has_supply;
    SELECT EXISTS(SELECT 1 FROM category_types WHERE name = 'fixed_cost') INTO v_has_fixed_cost;

    -- Contar políticas
    SELECT COUNT(*) INTO v_patient_sources_policies FROM pg_policies WHERE tablename = 'patient_sources' AND schemaname = 'public';
    SELECT COUNT(*) INTO v_custom_categories_policies FROM pg_policies WHERE tablename = 'custom_categories' AND schemaname = 'public';

    -- Verificaciones
    IF v_category_types_count >= 4 THEN
        RAISE NOTICE '   ✅ category_types: % tipos', v_category_types_count;
    ELSE
        RAISE WARNING '   ⚠️ category_types solo tiene % tipos', v_category_types_count;
    END IF;

    IF v_has_service AND v_has_supply AND v_has_fixed_cost THEN
        RAISE NOTICE '   ✅ Tipos necesarios presentes: service, supply, fixed_cost';
    ELSE
        RAISE WARNING '   ⚠️ Faltan tipos críticos';
    END IF;

    IF v_patient_sources_policies >= 4 THEN
        RAISE NOTICE '   ✅ patient_sources: % políticas', v_patient_sources_policies;
    ELSE
        RAISE WARNING '   ⚠️ patient_sources: solo % políticas', v_patient_sources_policies;
    END IF;

    IF v_custom_categories_policies >= 4 THEN
        RAISE NOTICE '   ✅ custom_categories: % políticas', v_custom_categories_policies;
    ELSE
        RAISE WARNING '   ⚠️ custom_categories: solo % políticas', v_custom_categories_policies;
    END IF;

    -- Verificar políticas críticas de INSERT
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'patient_sources' AND policyname = 'Users can insert patient sources in their clinics') THEN
        RAISE EXCEPTION '❌ Falta política INSERT en patient_sources';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'custom_categories' AND policyname = 'Users can insert categories in their clinics') THEN
        RAISE EXCEPTION '❌ Falta política INSERT en custom_categories';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅✅✅ FIX COMPLETO EXITOSO ✅✅✅';
    RAISE NOTICE '';
    RAISE NOTICE 'Resumen:';
    RAISE NOTICE '  • UNIQUE constraint en category_types.name';
    RAISE NOTICE '  • category_types: % tipos', v_category_types_count;
    RAISE NOTICE '  • patient_sources: % políticas RLS', v_patient_sources_policies;
    RAISE NOTICE '  • custom_categories: % políticas RLS', v_custom_categories_policies;
    RAISE NOTICE '';
    RAISE NOTICE '🎉 El onboarding DEBERÍA funcionar ahora';
    RAISE NOTICE '========================================';
END $$;

-- Mostrar resumen de category_types
SELECT
    '📋 CATEGORY_TYPES' as seccion,
    name,
    display_name
FROM category_types
ORDER BY name;

-- Mostrar resumen de políticas
SELECT
    '📋 POLÍTICAS RLS' as seccion,
    tablename as tabla,
    cmd as comando,
    COUNT(*) as cantidad
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('patient_sources', 'custom_categories', 'category_types')
GROUP BY tablename, cmd
ORDER BY tablename, cmd;
