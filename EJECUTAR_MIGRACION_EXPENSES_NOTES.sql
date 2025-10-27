-- ============================================================
-- MIGRACIÓN: Agregar columna notes a la tabla expenses
-- Fecha: 2025-10-26
-- ============================================================
-- Esta migración agrega la columna 'notes' que falta en la tabla expenses
-- También agrega las columnas campaign_id y auto_processed si no existen
-- ============================================================

-- 1. Agregar columna notes para notas de texto libre en gastos
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN expenses.notes IS 'Notas opcionales de texto libre para detalles adicionales del gasto';

-- 2. Agregar columna campaign_id para tracking de campañas de marketing
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES marketing_campaigns(id);

COMMENT ON COLUMN expenses.campaign_id IS 'Referencia a campaña de marketing si el gasto está relacionado con marketing';

-- 3. Agregar columna auto_processed para flags de automatización
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS auto_processed boolean DEFAULT false;

COMMENT ON COLUMN expenses.auto_processed IS 'Indica si el gasto fue procesado automáticamente (ej: actualización de inventario)';

-- 4. Crear índice para mejorar performance en queries con campaign_id
CREATE INDEX IF NOT EXISTS idx_expenses_campaign_id ON expenses(campaign_id) WHERE campaign_id IS NOT NULL;

-- 5. Verificar que las columnas se crearon correctamente
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'expenses'
        AND column_name = 'notes'
    ) THEN
        RAISE NOTICE '✓ Columna notes agregada exitosamente';
    ELSE
        RAISE EXCEPTION '✗ Error: La columna notes no se pudo crear';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'expenses'
        AND column_name = 'campaign_id'
    ) THEN
        RAISE NOTICE '✓ Columna campaign_id agregada exitosamente';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'expenses'
        AND column_name = 'auto_processed'
    ) THEN
        RAISE NOTICE '✓ Columna auto_processed agregada exitosamente';
    END IF;
END $$;

-- ============================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================
-- Para ejecutar este script:
-- 1. Abre el SQL Editor en Supabase Dashboard
-- 2. Copia y pega todo este contenido
-- 3. Haz clic en "Run"
-- 4. Verifica que aparezcan los mensajes de éxito
-- ============================================================