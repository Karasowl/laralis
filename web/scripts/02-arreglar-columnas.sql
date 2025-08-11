-- =====================================================
-- SCRIPT PARA ARREGLAR COLUMNAS FALTANTES
-- Ejecuta esto DESPUÉS del diagnóstico
-- =====================================================

-- 1. ARREGLAR settings_time - Agregar columna real_pct si no existe
ALTER TABLE settings_time 
ADD COLUMN IF NOT EXISTS real_pct NUMERIC(3,2) DEFAULT 0.80;

-- Si la columna se llama diferente, ejecuta UNA de estas líneas:
-- ALTER TABLE settings_time RENAME COLUMN real_percentage TO real_pct;
-- ALTER TABLE settings_time RENAME COLUMN effective_pct TO real_pct;
-- ALTER TABLE settings_time RENAME COLUMN effective_percentage TO real_pct;
-- ALTER TABLE settings_time RENAME COLUMN effectiveness TO real_pct;

-- 2. ARREGLAR assets - Asegurar que las columnas existen
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS name VARCHAR(255);

ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS purchase_price_cents INTEGER DEFAULT 0;

ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS depreciation_months INTEGER DEFAULT 36;

ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS purchase_date DATE;

ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS clinic_id UUID;

-- 3. ARREGLAR services - Asegurar columna est_minutes
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS est_minutes INTEGER DEFAULT 30;

ALTER TABLE services 
ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT 'otros';

ALTER TABLE services 
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE services 
ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- 4. CREAR tabla service_supplies si no existe
CREATE TABLE IF NOT EXISTS service_supplies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_id UUID NOT NULL,
    supply_id UUID NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    CONSTRAINT fk_supply FOREIGN KEY (supply_id) REFERENCES supplies(id) ON DELETE CASCADE,
    CONSTRAINT unique_service_supply UNIQUE(service_id, supply_id)
);

-- 5. Verificar que todo está correcto
SELECT 
    'settings_time columnas' as verificacion,
    string_agg(column_name, ', ') as resultado
FROM information_schema.columns 
WHERE table_name = 'settings_time'
UNION ALL
SELECT 
    'assets columnas' as verificacion,
    string_agg(column_name, ', ') as resultado
FROM information_schema.columns 
WHERE table_name = 'assets'
UNION ALL
SELECT 
    'services columnas' as verificacion,
    string_agg(column_name, ', ') as resultado
FROM information_schema.columns 
WHERE table_name = 'services';