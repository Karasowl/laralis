-- =====================================================
-- Script: Reset completo de la base de datos
-- Fecha: 2025-10-18
-- Basado en estructura real detectada: 27 tablas, 45 FKs
--
-- ⚠️ ADVERTENCIA CRÍTICA: Este script eliminará TODO:
--   - Todos los usuarios (auth.users)
--   - Todos los workspaces, organizaciones y clínicas
--   - Todos los pacientes, tratamientos, gastos, campañas
--   - Todos los servicios, insumos, activos, costos fijos
--   - Todas las categorías personalizadas e invitaciones
--   - Todo el historial de actividad
--
-- ✅ SE MANTIENEN:
--   - Esquema (tablas, columnas, tipos)
--   - Funciones, triggers, vistas
--   - Políticas RLS
--   - Categorías del sistema (si las hay en 'categories' o 'category_types')
--
-- =====================================================

BEGIN;

-- ============================================================================
-- 1. RESUMEN ANTES DE BORRAR
-- ============================================================================
SELECT '========================================' as separador;
SELECT 'ESTADO ACTUAL ANTES DE LIMPIAR' as titulo;
SELECT '========================================' as separador;

SELECT
    'ESTRUCTURA MULTI-TENANT' as seccion,
    (SELECT COUNT(*) FROM auth.users) as usuarios,
    (SELECT COUNT(*) FROM workspaces) as workspaces,
    (SELECT COUNT(*) FROM organizations) as organizaciones,
    (SELECT COUNT(*) FROM clinics) as clinicas,
    (SELECT COUNT(*) FROM workspace_members) as workspace_members,
    (SELECT COUNT(*) FROM workspace_users) as workspace_users,
    (SELECT COUNT(*) FROM clinic_users) as clinic_users;

SELECT
    'DATOS DE NEGOCIO' as seccion,
    (SELECT COUNT(*) FROM patients) as pacientes,
    (SELECT COUNT(*) FROM treatments) as tratamientos,
    (SELECT COUNT(*) FROM expenses) as gastos,
    (SELECT COUNT(*) FROM marketing_campaigns) as campañas,
    (SELECT COUNT(*) FROM marketing_campaign_status_history) as historial_campañas;

SELECT
    'CATÁLOGOS Y CONFIGURACIÓN' as seccion,
    (SELECT COUNT(*) FROM services) as servicios,
    (SELECT COUNT(*) FROM supplies) as insumos,
    (SELECT COUNT(*) FROM service_supplies) as recetas,
    (SELECT COUNT(*) FROM assets) as activos,
    (SELECT COUNT(*) FROM fixed_costs) as costos_fijos,
    (SELECT COUNT(*) FROM tariffs) as tarifas,
    (SELECT COUNT(*) FROM settings_time) as configs_tiempo;

SELECT
    'SISTEMA' as seccion,
    (SELECT COUNT(*) FROM categories) as categorias,
    (SELECT COUNT(*) FROM category_types) as tipos_categoria,
    (SELECT COUNT(*) FROM custom_categories) as categorias_custom,
    (SELECT COUNT(*) FROM patient_sources) as fuentes_pacientes,
    (SELECT COUNT(*) FROM invitations) as invitaciones,
    (SELECT COUNT(*) FROM verification_codes) as codigos_verificacion,
    (SELECT COUNT(*) FROM workspace_activity) as actividad_workspace,
    (SELECT COUNT(*) FROM role_permissions) as permisos_roles;

-- ============================================================================
-- 2. DESHABILITAR RLS TEMPORALMENTE
-- ============================================================================
ALTER TABLE IF EXISTS workspace_activity DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS marketing_campaign_status_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS marketing_campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS treatments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS patient_sources DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tariffs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS service_supplies DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS services DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS supplies DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fixed_costs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS settings_time DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS custom_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS category_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invitations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clinic_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workspace_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workspace_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clinics DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workspaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS verification_codes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS role_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS _backup_patient_sources DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. ELIMINAR DATOS EN ORDEN CORRECTO (respetando foreign keys)
-- ============================================================================

-- 3.1 Actividad de workspace (tiene SET NULL, pero mejor limpiar primero)
DELETE FROM workspace_activity;

-- 3.2 Historial de marketing (depende de campaigns)
DELETE FROM marketing_campaign_status_history;

-- 3.3 Tratamientos (depende de patients y services)
DELETE FROM treatments;

-- 3.4 Pacientes (tiene self-reference y múltiples FKs)
-- Primero quitar referencias circulares y opcionales
UPDATE patients SET referred_by_patient_id = NULL WHERE referred_by_patient_id IS NOT NULL;
UPDATE patients SET campaign_id = NULL WHERE campaign_id IS NOT NULL;
UPDATE patients SET source_id = NULL WHERE source_id IS NOT NULL;
UPDATE patients SET platform_id = NULL WHERE platform_id IS NOT NULL;
DELETE FROM patients;

-- 3.5 Campañas de marketing (depende de clinics y categories)
DELETE FROM marketing_campaigns;

-- 3.6 Fuentes de pacientes (depende de clinics)
DELETE FROM patient_sources;

-- 3.7 Tarifas (depende de services)
DELETE FROM tariffs;

-- 3.8 Recetas de servicios (depende de services y supplies)
DELETE FROM service_supplies;

-- 3.9 Servicios (depende de clinics)
DELETE FROM services;

-- 3.10 Insumos (depende de clinics)
DELETE FROM supplies;

-- 3.11 Gastos (depende de clinics, categories, assets, supplies con NO ACTION)
-- Primero quitar referencias opcionales
UPDATE expenses SET related_asset_id = NULL WHERE related_asset_id IS NOT NULL;
UPDATE expenses SET related_supply_id = NULL WHERE related_supply_id IS NOT NULL;
DELETE FROM expenses;

-- 3.12 Activos (depende de clinics)
DELETE FROM assets;

-- 3.13 Costos fijos (depende de clinics)
DELETE FROM fixed_costs;

-- 3.14 Configuración de tiempo (depende de clinics)
DELETE FROM settings_time;

-- 3.15 Categorías personalizadas (depende de category_types y clinics)
DELETE FROM custom_categories;

-- 3.16 Invitaciones (depende de workspace y clinic)
DELETE FROM invitations;

-- 3.17 Códigos de verificación (independiente)
DELETE FROM verification_codes;

-- 3.18 Usuarios por clínica (depende de clinics)
DELETE FROM clinic_users;

-- 3.19 Miembros de workspace
DELETE FROM workspace_members;

-- 3.20 Usuarios de workspace
DELETE FROM workspace_users;

-- 3.21 Clínicas (depende de workspace y organizations)
DELETE FROM clinics;

-- 3.22 Workspaces (top level con CASCADE)
DELETE FROM workspaces;

-- 3.23 Organizaciones (top level)
DELETE FROM organizations;

-- 3.24 Tablas de sistema (OPCIONAL: comentar si quieres mantener data del sistema)
-- DELETE FROM categories; -- CUIDADO: Puede tener categorías del sistema
-- DELETE FROM category_types; -- CUIDADO: Tipos de categoría del sistema
-- DELETE FROM role_permissions; -- CUIDADO: Permisos del sistema

-- 3.25 Backup de fuentes (probablemente se puede limpiar)
DELETE FROM _backup_patient_sources;

-- 3.26 Usuarios de autenticación
-- ⚠️ NOTA: Requiere permisos especiales (service_role key)
-- Si da error, comentar y borrar manualmente desde Dashboard > Authentication > Users
DELETE FROM auth.users;

-- ============================================================================
-- 4. RE-HABILITAR RLS
-- ============================================================================
ALTER TABLE IF EXISTS workspace_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS marketing_campaign_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS treatments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS patient_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS service_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS services ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS settings_time ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS custom_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS category_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clinic_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workspace_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS _backup_patient_sources ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. VERIFICAR ESTADO DESPUÉS DE LIMPIAR
-- ============================================================================
SELECT '========================================' as separador;
SELECT 'ESTADO DESPUÉS DE LIMPIAR' as titulo;
SELECT '========================================' as separador;

SELECT
    'ESTRUCTURA MULTI-TENANT' as seccion,
    (SELECT COUNT(*) FROM auth.users) as usuarios,
    (SELECT COUNT(*) FROM workspaces) as workspaces,
    (SELECT COUNT(*) FROM organizations) as organizaciones,
    (SELECT COUNT(*) FROM clinics) as clinicas,
    (SELECT COUNT(*) FROM workspace_members) as workspace_members,
    (SELECT COUNT(*) FROM workspace_users) as workspace_users,
    (SELECT COUNT(*) FROM clinic_users) as clinic_users;

SELECT
    'DATOS DE NEGOCIO' as seccion,
    (SELECT COUNT(*) FROM patients) as pacientes,
    (SELECT COUNT(*) FROM treatments) as tratamientos,
    (SELECT COUNT(*) FROM expenses) as gastos,
    (SELECT COUNT(*) FROM marketing_campaigns) as campañas,
    (SELECT COUNT(*) FROM marketing_campaign_status_history) as historial_campañas;

SELECT
    'CATÁLOGOS Y CONFIGURACIÓN' as seccion,
    (SELECT COUNT(*) FROM services) as servicios,
    (SELECT COUNT(*) FROM supplies) as insumos,
    (SELECT COUNT(*) FROM service_supplies) as recetas,
    (SELECT COUNT(*) FROM assets) as activos,
    (SELECT COUNT(*) FROM fixed_costs) as costos_fijos,
    (SELECT COUNT(*) FROM tariffs) as tarifas,
    (SELECT COUNT(*) FROM settings_time) as configs_tiempo;

SELECT
    'SISTEMA (pueden tener datos)' as seccion,
    (SELECT COUNT(*) FROM categories) as categorias,
    (SELECT COUNT(*) FROM category_types) as tipos_categoria,
    (SELECT COUNT(*) FROM custom_categories) as categorias_custom,
    (SELECT COUNT(*) FROM patient_sources) as fuentes_pacientes,
    (SELECT COUNT(*) FROM invitations) as invitaciones,
    (SELECT COUNT(*) FROM verification_codes) as codigos_verificacion,
    (SELECT COUNT(*) FROM workspace_activity) as actividad_workspace,
    (SELECT COUNT(*) FROM role_permissions) as permisos_roles;

SELECT '========================================' as separador;
SELECT '✅ BASE DE DATOS LIMPIADA COMPLETAMENTE' as resultado;
SELECT 'Estructura preservada: Tablas, funciones, triggers, vistas, políticas RLS' as nota1;
SELECT 'NOTA: categories, category_types, role_permissions pueden tener datos del sistema' as nota2;
SELECT '========================================' as separador;

COMMIT;

-- =====================================================
-- NOTAS IMPORTANTES:
-- =====================================================
--
-- 1. ORDEN DE ELIMINACIÓN:
--    El script respeta todas las foreign keys detectadas (45 FKs)
--    Se eliminan primero las tablas hoja, luego las intermedias, finalmente las raíz
--
-- 2. TABLAS DEL SISTEMA (NO SE BORRAN POR DEFAULT):
--    - categories: Puede contener categorías del sistema
--    - category_types: Tipos de categoría predefinidos
--    - role_permissions: Permisos del sistema
--    Si quieres borrarlas, descomenta las líneas en la sección 3.24
--
-- 3. REFERENCIAS CIRCULARES:
--    - patients.referred_by_patient_id (self-reference) se limpia con UPDATE antes de DELETE
--    - Otras referencias SET NULL se manejan automáticamente
--
-- 4. ERROR COMÚN: auth.users
--    Si obtienes "permission denied for table auth.users":
--    a) Ejecuta desde SQL Editor con credenciales admin
--    b) O comenta la línea y borra usuarios manualmente desde:
--       Dashboard → Authentication → Users
--
-- 5. ESTRUCTURA DETECTADA:
--    27 tablas, 45 foreign keys
--    Arquitectura: organizations + workspaces → clinics → datos
--
-- =====================================================
