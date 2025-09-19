-- ================================================================
-- COPIA TODO ESTE ARCHIVO Y EJECUTALO EN SUPABASE SQL EDITOR
-- ================================================================

-- PASO 1: Guardar definiciones de todas las vistas antes de eliminarlas
CREATE TEMP TABLE IF NOT EXISTS temp_view_definitions (
    view_name TEXT PRIMARY KEY,
    view_definition TEXT,
    view_owner TEXT
);

-- Guardar todas las vistas del esquema public
INSERT INTO temp_view_definitions (view_name, view_definition, view_owner)
SELECT
    v.viewname,
    pg_get_viewdef(c.oid, true),
    v.viewowner
FROM pg_views v
JOIN pg_class c ON c.relname = v.viewname AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
WHERE v.schemaname = 'public'
ON CONFLICT (view_name) DO NOTHING;

-- Mostrar las vistas que se van a eliminar
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE 'Vistas encontradas que serán eliminadas:';
    FOR rec IN SELECT view_name FROM temp_view_definitions
    LOOP
        RAISE NOTICE '  - %', rec.view_name;
    END LOOP;
END $$;

-- PASO 2: Eliminar TODAS las vistas del esquema public
DO $$
DECLARE
    rec RECORD;
BEGIN
    -- Eliminar todas las vistas en orden inverso de dependencias
    FOR rec IN
        SELECT viewname
        FROM pg_views
        WHERE schemaname = 'public'
        ORDER BY viewname DESC -- Orden inverso para manejar dependencias
    LOOP
        EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE', rec.viewname);
        RAISE NOTICE 'Eliminada vista: %', rec.viewname;
    END LOOP;
END $$;

-- PASO 3: Eliminar columna generada que causa problemas
ALTER TABLE public.assets
DROP COLUMN IF EXISTS monthly_depreciation_cents;

-- PASO 4: Convertir todas las columnas de dinero a BIGINT
-- Fixed costs
ALTER TABLE public.fixed_costs ALTER COLUMN amount_cents TYPE BIGINT;

-- Supplies
ALTER TABLE public.supplies ALTER COLUMN price_cents TYPE BIGINT;

-- Services
ALTER TABLE public.services
ALTER COLUMN fixed_cost_per_minute_cents TYPE BIGINT,
ALTER COLUMN variable_cost_cents TYPE BIGINT,
ALTER COLUMN price_cents TYPE BIGINT;

-- Treatments
ALTER TABLE public.treatments
ALTER COLUMN fixed_cost_per_minute_cents TYPE BIGINT,
ALTER COLUMN variable_cost_cents TYPE BIGINT,
ALTER COLUMN price_cents TYPE BIGINT;

-- Expenses
ALTER TABLE public.expenses ALTER COLUMN amount_cents TYPE BIGINT;

-- Assets
ALTER TABLE public.assets
ALTER COLUMN purchase_price_cents TYPE BIGINT,
ALTER COLUMN disposal_value_cents TYPE BIGINT;

-- Tariffs
ALTER TABLE public.tariffs
ALTER COLUMN fixed_cost_per_minute_cents TYPE BIGINT,
ALTER COLUMN variable_cost_cents TYPE BIGINT,
ALTER COLUMN price_cents TYPE BIGINT,
ALTER COLUMN rounded_price_cents TYPE BIGINT;

-- Marketing campaigns (si existe)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns
               WHERE table_schema = 'public'
               AND table_name = 'marketing_campaigns'
               AND column_name = 'budget_cents') THEN
        ALTER TABLE public.marketing_campaigns ALTER COLUMN budget_cents TYPE BIGINT;
    END IF;

    IF EXISTS (SELECT FROM information_schema.columns
               WHERE table_schema = 'public'
               AND table_name = 'marketing_campaigns'
               AND column_name = 'spent_cents') THEN
        ALTER TABLE public.marketing_campaigns ALTER COLUMN spent_cents TYPE BIGINT;
    END IF;
END $$;

-- PASO 5: Recrear columna generada
ALTER TABLE public.assets
ADD COLUMN monthly_depreciation_cents BIGINT
GENERATED ALWAYS AS (
    CASE
        WHEN depreciation_years IS NOT NULL AND depreciation_years > 0
        THEN purchase_price_cents / (depreciation_years * 12)
        ELSE NULL
    END
) STORED;

-- PASO 6: Intentar recrear las vistas principales desde la tabla temporal
DO $$
DECLARE
    rec RECORD;
    v_sql TEXT;
BEGIN
    -- Intentar recrear cada vista guardada
    FOR rec IN SELECT view_name, view_definition FROM temp_view_definitions
    LOOP
        BEGIN
            v_sql := format('CREATE VIEW public.%I AS %s', rec.view_name, rec.view_definition);
            EXECUTE v_sql;
            RAISE NOTICE 'Recreada vista: %', rec.view_name;

            -- Restaurar permisos básicos
            EXECUTE format('GRANT SELECT ON public.%I TO authenticated', rec.view_name);
            EXECUTE format('GRANT SELECT ON public.%I TO service_role', rec.view_name);
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'No se pudo recrear vista %: %', rec.view_name, SQLERRM;
                -- Continuar con las demás vistas
        END;
    END LOOP;
END $$;

-- PASO 7: Si alguna vista crítica no se recreó, crearlas manualmente
-- Vista referral_network
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_views WHERE schemaname = 'public' AND viewname = 'referral_network') THEN
        CREATE VIEW public.referral_network AS
        SELECT
            p.id AS patient_id,
            p.first_name,
            p.last_name,
            p.email,
            p.phone,
            p.created_at AS patient_since,
            p.acquisition_source,
            p.referred_by_patient_id,
            ref.first_name AS referred_by_first_name,
            ref.last_name AS referred_by_last_name,
            COUNT(DISTINCT t.id) AS total_treatments,
            SUM(t.price_cents) AS total_revenue_cents,
            MAX(t.treatment_date) AS last_treatment_date,
            COUNT(DISTINCT referred.id) AS referrals_made,
            COUNT(DISTINCT referred_t.id) AS referral_treatments,
            SUM(referred_t.price_cents) AS referral_revenue_cents,
            COALESCE(SUM(t.price_cents), 0) + COALESCE(SUM(referred_t.price_cents), 0) AS network_value_cents
        FROM public.patients p
        LEFT JOIN public.patients ref ON p.referred_by_patient_id = ref.id
        LEFT JOIN public.treatments t ON p.id = t.patient_id
        LEFT JOIN public.patients referred ON referred.referred_by_patient_id = p.id
        LEFT JOIN public.treatments referred_t ON referred.id = referred_t.patient_id
        GROUP BY
            p.id, p.first_name, p.last_name, p.email, p.phone, p.created_at,
            p.acquisition_source, p.referred_by_patient_id, ref.first_name, ref.last_name;

        GRANT SELECT ON public.referral_network TO authenticated;
        GRANT SELECT ON public.referral_network TO service_role;
        RAISE NOTICE 'Creada vista referral_network manualmente';
    END IF;
END $$;

-- Vista v_dashboard_metrics
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_views WHERE schemaname = 'public' AND viewname = 'v_dashboard_metrics') THEN
        CREATE VIEW public.v_dashboard_metrics AS
        SELECT
            COALESCE(SUM(t.price_cents), 0) as total_revenue_cents,
            COALESCE(AVG(t.price_cents), 0) as avg_treatment_value_cents,
            COUNT(DISTINCT t.id) as total_treatments,
            COUNT(DISTINCT t.patient_id) as unique_patients,
            COUNT(DISTINCT t.id) FILTER (
                WHERE t.treatment_date >= date_trunc('month', CURRENT_DATE)
            ) as treatments_this_month,
            COALESCE(SUM(t.price_cents) FILTER (
                WHERE t.treatment_date >= date_trunc('month', CURRENT_DATE)
            ), 0) as revenue_this_month_cents,
            COUNT(DISTINCT t.service_id) as services_used,
            COALESCE((
                SELECT SUM(e.amount_cents)
                FROM public.expenses e
                WHERE e.expense_date >= date_trunc('month', CURRENT_DATE)
            ), 0) as expenses_this_month_cents,
            COALESCE(SUM(t.price_cents) FILTER (
                WHERE t.treatment_date >= date_trunc('month', CURRENT_DATE)
            ), 0) - COALESCE((
                SELECT SUM(e.amount_cents)
                FROM public.expenses e
                WHERE e.expense_date >= date_trunc('month', CURRENT_DATE)
            ), 0) as profit_this_month_cents
        FROM public.treatments t
        WHERE t.status = 'completed';

        GRANT SELECT ON public.v_dashboard_metrics TO authenticated;
        GRANT SELECT ON public.v_dashboard_metrics TO service_role;
        RAISE NOTICE 'Creada vista v_dashboard_metrics manualmente';
    END IF;
END $$;

-- PASO 8: VERIFICAR QUE TODO FUNCIONO
DO $$
DECLARE
    v_integer_count INTEGER;
    v_bigint_count INTEGER;
    v_views_count INTEGER;
BEGIN
    -- Contar columnas que aún son INTEGER
    SELECT COUNT(*) INTO v_integer_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND column_name LIKE '%_cents'
    AND data_type = 'integer';

    -- Contar columnas que ahora son BIGINT
    SELECT COUNT(*) INTO v_bigint_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND column_name LIKE '%_cents'
    AND data_type = 'bigint';

    -- Contar vistas recreadas
    SELECT COUNT(*) INTO v_views_count
    FROM pg_views
    WHERE schemaname = 'public';

    RAISE NOTICE '================================================';
    RAISE NOTICE 'RESULTADOS DE LA MIGRACIÓN:';
    RAISE NOTICE '================================================';

    IF v_integer_count > 0 THEN
        RAISE NOTICE '⚠️  Columnas INTEGER restantes: %', v_integer_count;
    END IF;

    RAISE NOTICE '✅ Columnas convertidas a BIGINT: %', v_bigint_count;
    RAISE NOTICE '✅ Vistas en el esquema public: %', v_views_count;

    IF v_integer_count = 0 THEN
        RAISE NOTICE '================================================';
        RAISE NOTICE '🎉 ÉXITO: Migración completada correctamente';
        RAISE NOTICE '================================================';
    END IF;

    -- Limpiar tabla temporal
    DROP TABLE IF EXISTS temp_view_definitions;
END $$;

-- ================================================================
-- FIN DEL SCRIPT
-- Busca "ÉXITO: Migración completada" para confirmar que funcionó
-- ================================================================