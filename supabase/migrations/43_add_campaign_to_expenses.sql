-- Migration 43: Agregar campaign_id a expenses para vincular gastos de marketing con campañas
-- Date: 2025-10-21
-- Purpose: Permitir tracking de gastos por campaña de marketing para métricas precisas de CAC/ROI

-- 1. Agregar columna campaign_id a expenses
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE SET NULL;

-- 2. Crear índice para performance en consultas de métricas
CREATE INDEX IF NOT EXISTS idx_expenses_campaign ON public.expenses(campaign_id);

-- 3. Crear índice compuesto para consultas de gastos de marketing por clínica y campaña
CREATE INDEX IF NOT EXISTS idx_expenses_clinic_campaign ON public.expenses(clinic_id, campaign_id)
WHERE campaign_id IS NOT NULL;

-- 4. Crear índice compuesto para consultas de gastos de marketing por categoría y campaña
CREATE INDEX IF NOT EXISTS idx_expenses_category_campaign ON public.expenses(category_id, campaign_id)
WHERE campaign_id IS NOT NULL;

-- 5. Agregar comentario explicativo a la columna
COMMENT ON COLUMN public.expenses.campaign_id IS
'FK a marketing_campaigns. Vincula gastos de marketing (Publicidad, Promociones, Eventos) con campañas específicas para tracking de CAC/ROI por campaña.';

-- 6. Crear vista helper para gastos de marketing con información de campaña
CREATE OR REPLACE VIEW public.marketing_expenses_with_campaign AS
SELECT
    e.id as expense_id,
    e.clinic_id,
    e.expense_date,
    e.amount_cents,
    e.category,
    e.subcategory,
    e.description,
    e.vendor,
    mc.id as campaign_id,
    mc.name as campaign_name,
    mc.platform_id,
    c.display_name as platform_name,
    mc.is_active as campaign_is_active,
    mc.is_archived as campaign_is_archived,
    mc.created_at as campaign_created_at
FROM public.expenses e
LEFT JOIN public.marketing_campaigns mc ON e.campaign_id = mc.id
LEFT JOIN public.categories c ON mc.platform_id = c.id
WHERE e.category_id IN (
    -- Obtener IDs de categorías de marketing
    SELECT id FROM public.categories
    WHERE entity_type = 'expense'
    AND name IN ('marketing', 'publicidad', 'promociones', 'eventos')
);

-- 7. Crear función helper para obtener gastos de marketing por campaña
CREATE OR REPLACE FUNCTION get_marketing_expenses_by_campaign(
    p_clinic_id UUID,
    p_campaign_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    expense_id UUID,
    expense_date DATE,
    amount_cents BIGINT,
    category VARCHAR,
    subcategory VARCHAR,
    campaign_name VARCHAR,
    platform_name VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.expense_date,
        e.amount_cents,
        e.category,
        e.subcategory,
        mc.name,
        c.display_name
    FROM public.expenses e
    LEFT JOIN public.marketing_campaigns mc ON e.campaign_id = mc.id
    LEFT JOIN public.categories c ON mc.platform_id = c.id
    WHERE e.clinic_id = p_clinic_id
    AND (p_campaign_id IS NULL OR e.campaign_id = p_campaign_id)
    AND (p_start_date IS NULL OR e.expense_date >= p_start_date)
    AND (p_end_date IS NULL OR e.expense_date <= p_end_date)
    AND e.category_id IN (
        SELECT id FROM public.categories
        WHERE entity_type = 'expense'
        AND name IN ('marketing', 'publicidad', 'promociones', 'eventos')
    )
    ORDER BY e.expense_date DESC;
END;
$$ LANGUAGE plpgsql;

-- 8. Crear función helper para obtener total de gastos de marketing por campaña
CREATE OR REPLACE FUNCTION get_campaign_marketing_spend(
    p_clinic_id UUID,
    p_campaign_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    total_spend BIGINT;
BEGIN
    SELECT COALESCE(SUM(amount_cents), 0)
    INTO total_spend
    FROM public.expenses
    WHERE clinic_id = p_clinic_id
    AND campaign_id = p_campaign_id
    AND (p_start_date IS NULL OR expense_date >= p_start_date)
    AND (p_end_date IS NULL OR expense_date <= p_end_date);

    RETURN total_spend;
END;
$$ LANGUAGE plpgsql;

-- 9. Crear vista agregada de métricas de campaña (incluye gastos)
CREATE OR REPLACE VIEW public.campaign_metrics AS
SELECT
    mc.id as campaign_id,
    mc.clinic_id,
    mc.name as campaign_name,
    c.display_name as platform_name,
    mc.is_active,
    mc.is_archived,
    mc.created_at as campaign_created_at,
    -- Métricas de pacientes
    COUNT(DISTINCT p.id) as total_patients,
    COUNT(DISTINCT CASE WHEN p.acquisition_date >= CURRENT_DATE - INTERVAL '30 days' THEN p.id END) as patients_last_30_days,
    -- Métricas de gastos
    COALESCE(SUM(e.amount_cents), 0) as total_spend_cents,
    COALESCE(SUM(CASE WHEN e.expense_date >= CURRENT_DATE - INTERVAL '30 days' THEN e.amount_cents ELSE 0 END), 0) as spend_last_30_days_cents,
    COUNT(DISTINCT e.id) as total_expenses,
    -- Métricas calculadas
    CASE
        WHEN COUNT(DISTINCT p.id) > 0
        THEN COALESCE(SUM(e.amount_cents), 0) / COUNT(DISTINCT p.id)
        ELSE 0
    END as cac_cents,
    -- Fechas
    MIN(p.acquisition_date) as first_patient_date,
    MAX(p.acquisition_date) as last_patient_date,
    MIN(e.expense_date) as first_expense_date,
    MAX(e.expense_date) as last_expense_date
FROM public.marketing_campaigns mc
LEFT JOIN public.categories c ON mc.platform_id = c.id
LEFT JOIN public.patients p ON mc.id = p.campaign_id
LEFT JOIN public.expenses e ON mc.id = e.campaign_id
GROUP BY
    mc.id, mc.clinic_id, mc.name, c.display_name,
    mc.is_active, mc.is_archived, mc.created_at;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Migración 43 completada exitosamente';
    RAISE NOTICE '📊 Columna campaign_id agregada a expenses';
    RAISE NOTICE '🔍 Índices creados para performance';
    RAISE NOTICE '📈 Vistas y funciones helper creadas';
    RAISE NOTICE '🎯 Siguiente paso: Actualizar formulario de gastos para mostrar selector de campañas cuando category = Marketing';
END $$;
