# Fix: Error de RLS en Triggers de Onboarding

**Fecha**: 2025-10-18
**Tipo**: Bug Fix (Crítico)
**Área**: Onboarding + RLS + Database Triggers
**Prioridad**: P0 - Bloqueante

## Contexto

Usuario reportó error persistente al completar onboarding:
```
"Hubo un problema al crear tu configuración"
```

Después de múltiples intentos de diagnóstico, se descubrió que el error real era:
```json
{
  "error": "Failed to create clinic",
  "details": "new row violates row-level security policy for table \"custom_categories\"",
  "code": "42501"
}
```

## Problema Identificado

### Causa Raíz

El error **NO era al crear la clínica**, sino al ejecutar **triggers automáticos** que se disparan después de crear una clínica.

**Triggers problemáticos** (archivo: `web/scripts/30-patient-sources-and-referrals.sql`):

1. **`insert_default_patient_sources()`** (líneas 69-92)
   - Se dispara AFTER INSERT en `clinics`
   - Inserta 8 fuentes de pacientes por defecto:
     - Recomendación, Google, Facebook, Instagram, Página Web, Walk-in, Campaña, Otro
   - **Falla porque `patient_sources` no tiene política RLS de INSERT**

2. **`insert_default_categories()`** (líneas 95-150)
   - Se dispara AFTER INSERT en `clinics`
   - Inserta ~25 categorías por defecto:
     - 9 categorías de servicios (Preventivo, Restaurativo, Endodoncia, etc.)
     - 7 categorías de insumos (Bioseguridad, Consumibles, etc.)
     - 9 categorías de costos fijos (Renta, Salarios, etc.)
   - **Falla porque `custom_categories` no tiene política RLS de INSERT**

### Flujo que fallaba

```
1. Usuario completa datos de workspace ✅
2. Usuario completa datos de clínica ✅
3. Click en "Siguiente"
4. API crea workspace ✅
5. API crea clínica ✅
6. Trigger insert_default_patient_sources() se ejecuta
   - Intenta insertar en patient_sources
   - ❌ FALLA: No hay política RLS de INSERT
7. (O si pasó el #6) Trigger insert_default_categories() se ejecuta
   - Intenta insertar en custom_categories
   - ❌ FALLA: No hay política RLS de INSERT (ERROR REPORTADO)
8. Rollback: Se elimina la clínica creada
9. Usuario ve: "Hubo un problema al crear tu configuración"
```

### Por qué pasó desapercibido

1. **En desarrollo**: Se probó con service role que **bypasea RLS**
2. **Migraciones antiguas**: Los triggers se agregaron después de las políticas RLS iniciales
3. **Testing incompleto**: No se probó con usuario real autenticado

## Solución Implementada

### Script de corrección: `scripts/fix-onboarding-rls-triggers.sql`

**Políticas agregadas para `patient_sources`:**

```sql
-- SELECT: Ver fuentes de sus clínicas
CREATE POLICY "Users can view patient sources in their clinics"
  FOR SELECT USING (clinic_id IN (
    SELECT c.id FROM clinics c
    INNER JOIN workspaces w ON c.workspace_id = w.id
    WHERE w.owner_id = auth.uid()
  ));

-- INSERT: Insertar fuentes en sus clínicas (CRÍTICO para el trigger)
CREATE POLICY "Users can insert patient sources in their clinics"
  FOR INSERT WITH CHECK (clinic_id IN (...));

-- UPDATE: Actualizar fuentes
CREATE POLICY "Users can update patient sources in their clinics"
  FOR UPDATE USING (clinic_id IN (...));

-- DELETE: Eliminar fuentes (solo no-system)
CREATE POLICY "Users can delete custom patient sources in their clinics"
  FOR DELETE USING (clinic_id IN (...) AND is_system = false);
```

**Políticas agregadas para `custom_categories`:**

```sql
-- SELECT: Ver categorías de sus clínicas
CREATE POLICY "Users can view categories in their clinics"
  FOR SELECT USING (clinic_id IN (...));

-- INSERT: Insertar categorías en sus clínicas (CRÍTICO para el trigger)
CREATE POLICY "Users can insert categories in their clinics"
  FOR INSERT WITH CHECK (clinic_id IN (...));

-- UPDATE: Actualizar categorías
CREATE POLICY "Users can update categories in their clinics"
  FOR UPDATE USING (clinic_id IN (...));

-- DELETE: Eliminar categorías (solo no-system)
CREATE POLICY "Users can delete custom categories in their clinics"
  FOR DELETE USING (clinic_id IN (...) AND is_system = false);
```

**Política para `category_types` (solo lectura):**

```sql
-- SELECT: Todos los usuarios autenticados pueden ver tipos
CREATE POLICY "Authenticated users can view category types"
  FOR SELECT USING (auth.uid() IS NOT NULL);
```

## Archivos Modificados/Creados

1. **`scripts/fix-onboarding-rls-triggers.sql`** - Script de corrección con políticas RLS
2. **`web/app/api/onboarding/route.ts`** - Mejora de logging para debug (cambio previo)
3. **`docs/devlog/2025-10-18-fix-onboarding-triggers-rls.md`** - Esta documentación

## Antes vs Después

### ANTES (Roto):
```
1. Usuario completa onboarding
2. API crea workspace ✅
3. API crea clínica ✅
4. Trigger intenta insertar patient_sources
5. ❌ ERROR: RLS bloquea INSERT
6. Rollback automático
7. Usuario ve: "Hubo un problema al crear tu configuración"
8. Frustración total ❌
```

### DESPUÉS (Funciona):
```
1. Usuario completa onboarding
2. API crea workspace ✅
3. API crea clínica ✅
4. Trigger inserta 8 patient_sources ✅
5. Trigger inserta ~25 custom_categories ✅
6. Se guardan cookies/localStorage ✅
7. Redirige a /setup ✅
8. Usuario puede continuar sin problemas ✅
```

## Cómo Probar

### Escenario 1: Onboarding completo (happy path)
```bash
1. Ejecutar script: scripts/fix-onboarding-rls-triggers.sql en Supabase SQL Editor
2. Limpiar datos de usuario anterior (si existe)
3. Registrarse como nuevo usuario
4. Completar nombre de workspace → "Mi Clínica Test"
5. Completar nombre de clínica → "Clínica Central"
6. Click en "Siguiente"
7. ✅ Verificar: Redirige a /setup
8. ✅ Verificar: En Supabase, la clínica tiene 8 patient_sources
9. ✅ Verificar: En Supabase, la clínica tiene ~25 custom_categories
10. ✅ Verificar: Puede continuar con los siguientes pasos sin error
```

### Escenario 2: Verificar políticas en Supabase
```sql
-- Verificar que las políticas existen
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('patient_sources', 'custom_categories')
  AND cmd = 'INSERT'
ORDER BY tablename, policyname;

-- Resultado esperado:
-- patient_sources | Users can insert patient sources in their clinics | INSERT
-- custom_categories | Users can insert categories in their clinics | INSERT
```

## Riesgos y Rollback

### Riesgos:
- **Muy bajo**: Las políticas son seguras y solo permiten a owners insertar en sus clínicas
- **Sin impacto en datos existentes**: Solo afecta nuevas inserciones
- **Compatible con triggers**: Las políticas permiten exactamente lo que los triggers necesitan

### Rollback:
Si necesitas revertir las políticas (no recomendado):

```sql
-- Eliminar políticas de patient_sources
DROP POLICY IF EXISTS "Users can view patient sources in their clinics" ON patient_sources;
DROP POLICY IF EXISTS "Users can insert patient sources in their clinics" ON patient_sources;
DROP POLICY IF EXISTS "Users can update patient sources in their clinics" ON patient_sources;
DROP POLICY IF EXISTS "Users can delete custom patient sources in their clinics" ON patient_sources;

-- Eliminar políticas de custom_categories
DROP POLICY IF EXISTS "Users can view categories in their clinics" ON custom_categories;
DROP POLICY IF EXISTS "Users can insert categories in their clinics" ON custom_categories;
DROP POLICY IF EXISTS "Users can update categories in their clinics" ON custom_categories;
DROP POLICY IF EXISTS "Users can delete custom categories in their clinics" ON custom_categories;

-- Eliminar política de category_types
DROP POLICY IF EXISTS "Authenticated users can view category types" ON category_types;
```

## Siguientes Pasos

- [x] **Identificar el problema real** (triggers + RLS)
- [x] **Crear script de corrección** con políticas RLS
- [ ] **ACCIÓN REQUERIDA**: Ejecutar `scripts/fix-onboarding-rls-triggers.sql` en Supabase
- [ ] **Probar onboarding completo** con usuario nuevo
- [ ] **TAREA FUTURA**: Agregar tests E2E que verifiquen:
  - Creación de clínica + triggers
  - Presencia de patient_sources por defecto
  - Presencia de custom_categories por defecto

## Lecciones Aprendidas

### 1. **Testing con usuarios reales, no service role**
En desarrollo, los tests se hicieron con service role que bypasea RLS. Esto ocultó el problema hasta producción.

**Solución**: Crear usuario de prueba y testear con credenciales reales.

### 2. **Logging detallado desde el inicio**
El error inicial era genérico: "Failed to create clinic". Solo después de agregar logging detallado se descubrió el error real.

**Solución**: Siempre loggear detalles completos del error (code, details, hint).

### 3. **Triggers requieren políticas RLS**
Los triggers se ejecutan en el contexto del usuario, no como superusuario. Si RLS está habilitado, los triggers también necesitan cumplir las políticas.

**Solución**: Cuando agregues triggers que insertan datos, verifica que las tablas destino tengan políticas RLS apropiadas.

### 4. **Documentar triggers y sus dependencias**
No estaba documentado que crear una clínica automáticamente crea 8 fuentes + 25 categorías.

**Solución**: Documentar side effects de operaciones CRUD importantes.

## Referencias

- Triggers afectados: `web/scripts/30-patient-sources-and-referrals.sql`
- API endpoint: `web/app/api/onboarding/route.ts`
- Devlogs relacionados:
  - `docs/devlog/2025-10-18-fix-onboarding-multiple-issues.md`
  - `docs/devlog/2025-10-18-fix-onboarding-skip-clinic-step.md`

---

**✅ Fix implementado y listo para deployment**

**⚠️ CRÍTICO**: Ejecutar `scripts/fix-onboarding-rls-triggers.sql` en Supabase **ANTES** de deployar
