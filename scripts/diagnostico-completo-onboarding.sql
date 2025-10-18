-- =================================================================
-- DIAGNÓSTICO COMPLETO DEL ONBOARDING
-- =================================================================
-- Este script verifica TODO lo necesario para que el onboarding funcione
-- Devuelve TODO en una sola tabla para que Supabase lo muestre completo
-- =================================================================

WITH diagnostico AS (
  -- 1. Verificar columnas de workspaces
  SELECT
    1 as orden,
    'WORKSPACES' as categoria,
    'Columna owner_id' as item,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'workspaces' AND column_name = 'owner_id'
      ) THEN '✅ EXISTE'
      ELSE '❌ NO EXISTE'
    END as estado,
    '' as detalle

  UNION ALL

  SELECT
    2 as orden,
    'WORKSPACES' as categoria,
    'Columna created_by' as item,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'workspaces' AND column_name = 'created_by'
      ) THEN '✅ EXISTE'
      ELSE '❌ NO EXISTE'
    END as estado,
    '' as detalle

  UNION ALL

  -- 2. Verificar RLS en workspaces
  SELECT
    3 as orden,
    'WORKSPACES RLS' as categoria,
    'RLS habilitado' as item,
    CASE
      WHEN (SELECT relrowsecurity FROM pg_class WHERE relname = 'workspaces')
      THEN '✅ SÍ'
      ELSE '❌ NO'
    END as estado,
    '' as detalle

  UNION ALL

  SELECT
    4 as orden,
    'WORKSPACES RLS' as categoria,
    'Política INSERT' as item,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'workspaces' AND cmd = 'INSERT'
      )
      THEN '✅ EXISTE (' || (SELECT COUNT(*)::text FROM pg_policies WHERE tablename = 'workspaces' AND cmd = 'INSERT') || ')'
      ELSE '❌ NO EXISTE'
    END as estado,
    COALESCE(
      (SELECT string_agg(policyname, ', ') FROM pg_policies WHERE tablename = 'workspaces' AND cmd = 'INSERT'),
      'Ninguna'
    ) as detalle

  UNION ALL

  -- 3. Verificar RLS en clinics
  SELECT
    5 as orden,
    'CLINICS RLS' as categoria,
    'RLS habilitado' as item,
    CASE
      WHEN (SELECT relrowsecurity FROM pg_class WHERE relname = 'clinics')
      THEN '✅ SÍ'
      ELSE '❌ NO'
    END as estado,
    '' as detalle

  UNION ALL

  SELECT
    6 as orden,
    'CLINICS RLS' as categoria,
    'Política INSERT' as item,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'clinics' AND cmd = 'INSERT'
      )
      THEN '✅ EXISTE (' || (SELECT COUNT(*)::text FROM pg_policies WHERE tablename = 'clinics' AND cmd = 'INSERT') || ')'
      ELSE '❌ NO EXISTE'
    END as estado,
    COALESCE(
      (SELECT string_agg(policyname, ', ') FROM pg_policies WHERE tablename = 'clinics' AND cmd = 'INSERT'),
      'Ninguna'
    ) as detalle

  UNION ALL

  -- 4. Verificar columnas de clinics
  SELECT
    7 as orden,
    'CLINICS' as categoria,
    'Columnas requeridas' as item,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clinics' AND column_name = 'name')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clinics' AND column_name = 'workspace_id')
      THEN '✅ OK (name, workspace_id)'
      ELSE '❌ FALTAN COLUMNAS'
    END as estado,
    (
      SELECT string_agg(column_name, ', ')
      FROM information_schema.columns
      WHERE table_name = 'clinics'
        AND column_name IN ('name', 'workspace_id', 'address', 'phone', 'email')
    ) as detalle

  UNION ALL

  -- 5. Resumen general
  SELECT
    8 as orden,
    '📊 DIAGNÓSTICO FINAL' as categoria,
    'Estado del onboarding' as item,
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workspaces' AND cmd = 'INSERT')
      THEN '❌ BLOQUEADO - Falta política INSERT en workspaces'
      WHEN NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clinics' AND cmd = 'INSERT')
      THEN '❌ BLOQUEADO - Falta política INSERT en clinics'
      WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name IN ('owner_id', 'created_by'))
      THEN '❌ BLOQUEADO - Falta columna de usuario en workspaces'
      ELSE '✅ DEBERÍA FUNCIONAR - Todas las verificaciones pasaron'
    END as estado,
    '' as detalle

  UNION ALL

  -- 6. Lista de todas las columnas de workspaces
  SELECT
    9 as orden,
    'WORKSPACES COLUMNS' as categoria,
    column_name as item,
    data_type || CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END as estado,
    COALESCE(column_default, '') as detalle
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'workspaces'

  UNION ALL

  -- 7. Lista de políticas de workspaces con detalles
  SELECT
    10 as orden,
    'WORKSPACES POLICIES' as categoria,
    policyname as item,
    cmd as estado,
    substring(COALESCE(qual::text, with_check::text, ''), 1, 100) as detalle
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'workspaces'

  UNION ALL

  -- 8. Lista de políticas de clinics con detalles
  SELECT
    11 as orden,
    'CLINICS POLICIES' as categoria,
    policyname as item,
    cmd as estado,
    substring(COALESCE(qual::text, with_check::text, ''), 1, 100) as detalle
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'clinics'
)

SELECT
  categoria as "CATEGORÍA",
  item as "VERIFICACIÓN",
  estado as "ESTADO",
  detalle as "DETALLE"
FROM diagnostico
ORDER BY orden;

-- =================================================================
-- CÓMO LEER LOS RESULTADOS:
-- =================================================================
-- 1. Busca la fila "📊 DIAGNÓSTICO FINAL"
-- 2. Si dice "✅ DEBERÍA FUNCIONAR" → Todo OK
-- 3. Si dice "❌ BLOQUEADO" → Lee el mensaje y ejecuta el fix correspondiente
-- 4. Revisa las secciones WORKSPACES COLUMNS y POLICIES para detalles
-- =================================================================
