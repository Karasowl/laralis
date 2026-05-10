-- =====================================================
-- SCRIPT RLS POR PARTES - EJECUTAR SECCIÓN POR SECCIÓN
-- =====================================================
-- Si hay deadlock, espera un momento y ejecuta cada parte
-- =====================================================

-- =====================================================
-- PARTE 1: VERIFICAR EL ESTADO ACTUAL
-- =====================================================
-- Ejecuta esto primero para ver qué hay configurado:

-- Ver tablas con RLS activo:
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = true
ORDER BY tablename;

-- Ver políticas existentes:
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Ver la función helper:
SELECT prosrc
FROM pg_proc
WHERE proname = 'user_has_clinic_access';

-- =====================================================
-- PARTE 2: HABILITAR RLS (si no está activo)
-- =====================================================
-- Solo ejecuta si rowsecurity = false en alguna tabla:

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings_time ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PARTE 3: CREAR POLÍTICAS MÍNIMAS CRÍTICAS
-- =====================================================
-- Estas son las más importantes para seguridad básica:

-- WORKSPACES - Solo el owner
DROP POLICY IF EXISTS "Users can view own workspaces" ON workspaces;
CREATE POLICY "Users can view own workspaces" ON workspaces
    FOR SELECT USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert own workspaces" ON workspaces;
CREATE POLICY "Users can insert own workspaces" ON workspaces
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update own workspaces" ON workspaces;
CREATE POLICY "Users can update own workspaces" ON workspaces
    FOR UPDATE USING (auth.uid() = owner_id);

-- CLINICS - Solo las del workspace propio
DROP POLICY IF EXISTS "Users can view clinics in their workspaces" ON clinics;
CREATE POLICY "Users can view clinics in their workspaces" ON clinics
    FOR SELECT USING (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert clinics in their workspaces" ON clinics;
CREATE POLICY "Users can insert clinics in their workspaces" ON clinics
    FOR INSERT WITH CHECK (
        workspace_id IN (
            SELECT id FROM workspaces WHERE owner_id = auth.uid()
        )
    );

-- =====================================================
-- PARTE 4: POLÍTICAS PARA DATOS PRINCIPALES
-- =====================================================
-- Ejecuta después de verificar que parte 3 funcionó:

-- PATIENTS
DROP POLICY IF EXISTS "Users can view patients in their clinics" ON patients;
CREATE POLICY "Users can view patients in their clinics" ON patients
    FOR SELECT USING (user_has_clinic_access(clinic_id));

DROP POLICY IF EXISTS "Users can insert patients in their clinics" ON patients;
CREATE POLICY "Users can insert patients in their clinics" ON patients
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

-- TREATMENTS
DROP POLICY IF EXISTS "Users can view treatments in their clinics" ON treatments;
CREATE POLICY "Users can view treatments in their clinics" ON treatments
    FOR SELECT USING (user_has_clinic_access(clinic_id));

DROP POLICY IF EXISTS "Users can insert treatments in their clinics" ON treatments;
CREATE POLICY "Users can insert treatments in their clinics" ON treatments
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

-- EXPENSES
DROP POLICY IF EXISTS "Users can view expenses in their clinics" ON expenses;
CREATE POLICY "Users can view expenses in their clinics" ON expenses
    FOR SELECT USING (user_has_clinic_access(clinic_id));

DROP POLICY IF EXISTS "Users can insert expenses in their clinics" ON expenses;
CREATE POLICY "Users can insert expenses in their clinics" ON expenses
    FOR INSERT WITH CHECK (user_has_clinic_access(clinic_id));

-- =====================================================
-- PARTE 5: VERIFICACIÓN FINAL
-- =====================================================
-- Ejecuta esto al final para confirmar:

-- Contar políticas por tabla:
SELECT
    tablename,
    COUNT(*) as policies,
    string_agg(policyname, ', ') as policy_names
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Test rápido: Ver si puedes ver solo tus datos
-- (Ejecuta como usuario logueado en tu app)
SELECT COUNT(*) as my_workspaces FROM workspaces;
SELECT COUNT(*) as my_clinics FROM clinics;
SELECT COUNT(*) as my_patients FROM patients;

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================
-- 1. Si hay deadlock, cierra otras sesiones SQL en Supabase
-- 2. Ejecuta cada parte por separado
-- 3. Lo mínimo crítico son las partes 2 y 3
-- 4. Si la función user_has_clinic_access da error,
--    temporalmente puedes reemplazarla con:
--    clinic_id IN (
--        SELECT id FROM clinics WHERE workspace_id IN (
--            SELECT id FROM workspaces WHERE owner_id = auth.uid()
--        )
--    )
-- =====================================================