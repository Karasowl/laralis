-- Script para ejecutar todas las migraciones en orden
-- Ejecuta este script en el SQL Editor de Supabase

-- 1. Estructura multi-tenant base
\i migrations/02_multi_tenant.sql

-- 2. Tablas de insumos y servicios
\i migrations/03_supplies_services.sql

-- 3. Correcciones de supplies
\i migrations/04_fix_supplies_table.sql

-- 4. Activos
\i migrations/05_assets.sql

-- 5. Estructura de workspaces
\i migrations/09_workspaces_structure.sql

-- 6. Setup completo del sistema
\i migrations/15_complete_system_setup.sql

-- 7. Correcciones finales
\i migrations/16_fix_existing_tables.sql

-- Verificar que todo está creado
SELECT 'Verificando tablas creadas...' as status;

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;