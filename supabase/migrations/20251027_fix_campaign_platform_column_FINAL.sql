-- ============================================================================
-- MIGRACIÓN: Fix Campaign Platform Column
-- ============================================================================
-- Fecha: 2025-10-27
-- Autor: Sistema Laralis
-- Descripción: Renombra platform_category_id a platform_id en marketing_campaigns
--
-- PROBLEMA:
--   - La BD tiene columna "platform_category_id" (nombre incorrecto)
--   - El código usa "platform_id" (nombre correcto)
--   - Esto causa error 500 al crear campañas
--
-- SOLUCIÓN:
--   1. Eliminar vista campaign_stats (dependencia)
--   2. Eliminar FK constraint antiguo
--   3. Renombrar columna platform_category_id → platform_id
--   4. Crear nuevo FK constraint
--   5. Recrear vista campaign_stats con columna correcta
--
-- ROLLBACK: Ver MIGRATIONS_REFERENCE.md
-- ============================================================================

-- ====================
-- PASO 1: Eliminar vista dependiente
-- ====================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.views
        WHERE table_schema = 'public'
        AND table_name = 'campaign_stats'
    ) THEN
        RAISE NOTICE '[1/7] Eliminando vista campaign_stats...';
        DROP VIEW IF EXISTS public.campaign_stats CASCADE;
        RAISE NOTICE '✓ Vista eliminada';
    ELSE
        RAISE NOTICE '[1/7] Vista campaign_stats no existe, continuando...';
    END IF;
END $$;

-- ====================
-- PASO 2: Verificar y renombrar columna
-- ====================
DO $$
BEGIN
    -- Verificar si existe platform_category_id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'marketing_campaigns'
        AND column_name = 'platform_category_id'
    ) THEN
        RAISE NOTICE '[2/7] Columna platform_category_id encontrada';

        -- 2a. Eliminar FK constraint si existe
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_schema = 'public'
            AND table_name = 'marketing_campaigns'
            AND constraint_name = 'marketing_campaigns_platform_category_id_fkey'
        ) THEN
            RAISE NOTICE '[3/7] Eliminando FK constraint antiguo...';
            ALTER TABLE public.marketing_campaigns
            DROP CONSTRAINT marketing_campaigns_platform_category_id_fkey;
            RAISE NOTICE '✓ FK constraint eliminado';
        END IF;

        -- 2b. Renombrar o migrar columna
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'marketing_campaigns'
            AND column_name = 'platform_id'
        ) THEN
            RAISE NOTICE '[4/7] Renombrando columna platform_category_id → platform_id...';
            ALTER TABLE public.marketing_campaigns
            RENAME COLUMN platform_category_id TO platform_id;
            RAISE NOTICE '✓ Columna renombrada';
        ELSE
            RAISE NOTICE '[4/7] Ambas columnas existen, migrando datos...';

            -- Copiar datos de platform_category_id a platform_id donde sea NULL
            UPDATE public.marketing_campaigns
            SET platform_id = platform_category_id
            WHERE platform_id IS NULL AND platform_category_id IS NOT NULL;

            -- Eliminar columna antigua
            ALTER TABLE public.marketing_campaigns
            DROP COLUMN platform_category_id;
            RAISE NOTICE '✓ Datos migrados y columna antigua eliminada';
        END IF;
    ELSE
        RAISE NOTICE '[2/7] Columna platform_category_id no existe';
        RAISE NOTICE '[3/7] Saltando eliminación de FK';
        RAISE NOTICE '[4/7] platform_id ya existe, continuando...';
    END IF;
END $$;

-- ====================
-- PASO 3: Asegurar NOT NULL
-- ====================
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'marketing_campaigns'
        AND column_name = 'platform_id'
        AND is_nullable = 'YES'
    ) THEN
        RAISE NOTICE '[5/7] Configurando platform_id como NOT NULL...';

        -- Eliminar registros con platform_id NULL
        DELETE FROM public.marketing_campaigns WHERE platform_id IS NULL;

        -- Hacer columna NOT NULL
        ALTER TABLE public.marketing_campaigns
        ALTER COLUMN platform_id SET NOT NULL;
        RAISE NOTICE '✓ Columna configurada como NOT NULL';
    ELSE
        RAISE NOTICE '[5/7] Columna platform_id ya es NOT NULL';
    END IF;
END $$;

-- ====================
-- PASO 4: Crear FK constraint
-- ====================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'marketing_campaigns'
        AND constraint_name = 'marketing_campaigns_platform_id_fkey'
    ) THEN
        RAISE NOTICE '[6/7] Creando FK constraint para platform_id...';
        ALTER TABLE public.marketing_campaigns
        ADD CONSTRAINT marketing_campaigns_platform_id_fkey
        FOREIGN KEY (platform_id)
        REFERENCES public.categories(id)
        ON DELETE CASCADE;
        RAISE NOTICE '✓ FK constraint creado';
    ELSE
        RAISE NOTICE '[6/7] FK constraint ya existe';
    END IF;
END $$;

-- ====================
-- PASO 5: Crear índice
-- ====================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'marketing_campaigns'
        AND indexname = 'idx_marketing_campaigns_platform'
    ) THEN
        RAISE NOTICE '[7/7] Creando índice en platform_id...';
        CREATE INDEX idx_marketing_campaigns_platform
        ON public.marketing_campaigns(platform_id);
        RAISE NOTICE '✓ Índice creado';
    ELSE
        RAISE NOTICE '[7/7] Índice ya existe';
    END IF;
END $$;

-- ====================
-- PASO 6: Recrear vista campaign_stats
-- ====================
DO $$
BEGIN
    RAISE NOTICE 'Recreando vista campaign_stats...';
END $$;

CREATE OR REPLACE VIEW public.campaign_stats AS
SELECT
    c.id AS campaign_id,
    c.name AS campaign_name,
    c.platform_id,
    cat.display_name AS platform_name,
    c.is_active,
    c.is_archived,
    COUNT(DISTINCT p.id) AS total_patients,
    COUNT(DISTINCT CASE
        WHEN p.created_at >= CURRENT_DATE - INTERVAL '30 days'
        THEN p.id
    END) AS patients_last_30_days,
    COALESCE(SUM(e.amount_cents), 0) AS total_spent_cents,
    COALESCE(SUM(
        CASE
            WHEN e.expense_date >= CURRENT_DATE - INTERVAL '30 days'
            THEN e.amount_cents
        END
    ), 0) AS spent_last_30_days_cents
FROM public.marketing_campaigns c
LEFT JOIN public.categories cat ON cat.id = c.platform_id
LEFT JOIN public.patients p ON p.campaign_id = c.id
LEFT JOIN public.expenses e ON e.campaign_id = c.id
GROUP BY c.id, c.name, c.platform_id, cat.display_name, c.is_active, c.is_archived;

DO $$
BEGIN
    RAISE NOTICE '✓ Vista recreada';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICACIÓN DE MIGRACIÓN';
    RAISE NOTICE '========================================';
END $$;

-- Verificar columnas
SELECT
    '✓ Verificación de columnas' AS status,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'marketing_campaigns'
AND column_name IN ('platform_id', 'platform_category_id')
ORDER BY column_name;

-- Verificar FK constraints
SELECT
    '✓ Verificación de FK constraints' AS status,
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
AND table_name = 'marketing_campaigns'
AND constraint_name LIKE '%platform%';

-- Verificar vista
SELECT
    '✓ Verificación de vista' AS status,
    table_name AS view_name,
    view_definition
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name = 'campaign_stats';

-- ====================
-- MENSAJE FINAL
-- ====================
SELECT '✅ MIGRACIÓN COMPLETADA EXITOSAMENTE' AS status,
       'La columna platform_id está lista para usar' AS message;

-- ============================================================================
-- FIN DE MIGRACIÓN
-- ============================================================================
