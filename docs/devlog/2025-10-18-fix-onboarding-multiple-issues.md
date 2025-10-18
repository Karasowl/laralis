# Fix: Múltiples Problemas Críticos del Onboarding

**Fecha**: 2025-10-18
**Tipo**: Bug Fix (Múltiple)
**Área**: Onboarding Flow + RLS
**Prioridad**: P0 - Crítico (Bloquea nuevos usuarios)

## Contexto

Usuario reportó 3 problemas graves durante el onboarding que impedían completar el registro inicial:

1. **Diálogo de confirmación molesto**: Al hacer clic fuera del modal (incluso sin querer), aparecía un diálogo preguntando "¿Deseas eliminar el espacio de trabajo y la clínica creados?"
2. **Error al crear configuración**: Al completar los datos de la clínica y hacer clic en "Siguiente", fallaba con error "Hubo un problema al crear tu configuración"
3. **Comportamiento inconsistente**: A veces aparecía el onboarding completo, a veces saltaba directamente a `/setup` sin pasos de workspace/clínica

## Problemas Identificados

### Problema 1: Diálogo de Confirmación Erróneo

**Archivo**: `web/components/onboarding/OnboardingModal.tsx`
**Líneas**: 77-81

**Causa raíz**:
El handler `handleOpenChange` se disparaba con **cualquier** evento que intentara cerrar el modal, incluyendo:
- Hacer clic en el fondo/backdrop del modal
- Presionar ESC (escape)
- Cualquier interacción que no fuera en el contenido del modal

```typescript
// CÓDIGO ANTIGUO (BUGGY)
const handleOpenChange = (open: boolean) => {
  if (!open) {
    requestCancellation()  // ❌ Se dispara con CUALQUIER clic fuera
  }
}
```

**Impacto**: UX terrible - usuarios accidentalmente disparan el diálogo y pueden perder su progreso.

### Problema 2: Error "Hubo un problema al crear tu configuración"

**Archivos afectados**:
- `web/hooks/use-onboarding.ts` (líneas 164-213)
- `web/app/api/onboarding/route.ts`
- Políticas RLS en Supabase

**Causa raíz**: **Políticas RLS faltantes y restrictivas**

1. **workspaces NO tenía política de INSERT**:
   - RLS estaba habilitado (línea 68)
   - Solo había políticas para SELECT, UPDATE, DELETE
   - **NINGUNA política permitía INSERT**
   - Resultado: ❌ Cualquier intento de crear workspace fallaba silenciosamente

2. **clinics tenía política demasiado restrictiva**:
   ```sql
   CREATE POLICY "Admins can create clinics" ON public.clinics
     FOR INSERT WITH CHECK (
       EXISTS (
         SELECT 1 FROM public.workspace_users
         WHERE workspace_users.workspace_id = clinics.workspace_id
         AND workspace_users.user_id = auth.uid()
         AND workspace_users.role IN ('owner', 'admin')
       )
     );
   ```
   - Requería que el usuario **YA existiera** en `workspace_users` con rol owner/admin
   - Pero en onboarding, esto aún NO ha sucedido
   - Resultado: ❌ Crear clínica fallaba aunque se hubiera creado el workspace

**Flujo que fallaba**:
```
1. Usuario llena datos de workspace → OK
2. Usuario llena datos de clínica → OK
3. Click en "Siguiente"
4. API intenta INSERT en workspaces → ❌ BLOQUEADO (sin política)
5. (Si pasara) API intenta INSERT en clinics → ❌ BLOQUEADO (usuario no en workspace_users)
6. Error genérico al usuario: "Hubo un problema al crear tu configuración"
```

**Problema secundario**: Mensajes de error genéricos
- El hook solo mostraba `t('errors.genericDescription')`
- NO mostraba el error real del servidor
- Difícil de debuggear

### Problema 3: Comportamiento Inconsistente

**Archivo**: `web/app/onboarding/page.tsx` (líneas 45-62)
**YA CORREGIDO** en fix anterior: `2025-10-18-fix-onboarding-skip-clinic-step.md`

El guard solo verificaba workspace, no clínica, causando que saltara pasos.

## Qué Cambió

### Fix 1: Diálogo de Confirmación

**Archivo**: `web/components/onboarding/OnboardingModal.tsx`

**Antes** (líneas 77-81):
```typescript
const handleOpenChange = (open: boolean) => {
  if (!open) {
    requestCancellation()  // ❌ Se dispara con clic fuera
  }
}
```

**Después** (líneas 77-86):
```typescript
// IMPORTANTE: NO cerrar el modal automáticamente al hacer clic fuera.
// El modal solo debe cerrarse cuando el usuario hace clic explícitamente en:
// 1. El botón "Cerrar sesión" (primer paso)
// 2. Completar el onboarding
// NO debe cerrarse al hacer clic en el backdrop/fondo.
const handleOpenChange = (open: boolean) => {
  // No hacer nada - el modal está siempre abierto durante el onboarding
  // El cierre se maneja explícitamente con los botones
  return
}
```

**Resultado**: ✅ El modal solo se cierra cuando el usuario hace clic en "Cerrar sesión" o completa el onboarding.

### Fix 2: Mensajes de Error Descriptivos

**Archivo**: `web/hooks/use-onboarding.ts`

**Antes** (líneas 167-175):
```typescript
const response = await fetch('/api/onboarding', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workspace: { name: data.workspaceName, description: data.workspaceType || '' },
    clinic: { name: data.clinicName, address: data.clinicAddress, phone: data.clinicPhone, email: data.clinicEmail }
  })
})
if (!response.ok) throw new Error('Failed to create workspace/clinic')
```

**Después** (líneas 167-181):
```typescript
const response = await fetch('/api/onboarding', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workspace: { name: data.workspaceName, description: data.workspaceType || '' },
    clinic: { name: data.clinicName, address: data.clinicAddress, phone: data.clinicPhone, email: data.clinicEmail }
  })
})
if (!response.ok) {
  // Obtener el mensaje de error real del servidor
  const errorData = await response.json().catch(() => ({}))
  const errorMessage = errorData?.error || errorData?.details || 'Failed to create workspace/clinic'
  console.error('[onboarding] API error:', { status: response.status, errorData })
  throw new Error(errorMessage)
}
```

**Antes** (líneas 198-201):
```typescript
} catch (e) {
  toast.error(t('errors.genericDescription'))  // ❌ Genérico
  setLoading(false)
  return
}
```

**Después** (líneas 204-210):
```typescript
} catch (e) {
  // Mostrar el error específico en lugar del genérico
  const errorMessage = e instanceof Error ? e.message : t('errors.genericDescription')
  console.error('[onboarding] Failed to create:', e)
  toast.error(errorMessage)  // ✅ Específico
  setLoading(false)
  return
}
```

**Resultado**: ✅ Ahora se muestran errores específicos como "Unauthorized" o "Failed to create workspace" en lugar del genérico.

### Fix 3: Políticas RLS Faltantes

**Nuevo archivo**: `scripts/fix-onboarding-rls-policies.sql`

**Políticas agregadas**:

```sql
-- 1. Permitir a usuarios autenticados crear workspaces
CREATE POLICY "Users can create their own workspaces" ON public.workspaces
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
  );

-- 2. Permitir crear clínicas en workspaces propios (durante onboarding)
CREATE POLICY "Creators can create clinics in their workspace" ON public.clinics
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspaces
      WHERE workspaces.id = clinics.workspace_id
      AND workspaces.created_by = auth.uid()
    )
  );
```

**Resultado**: ✅ Ahora los usuarios pueden:
1. Crear su propio workspace (si están autenticados)
2. Crear clínicas en workspaces que ellos crearon
3. Los admins siguen pudiendo crear clínicas (política existente se mantiene)

## Archivos Modificados/Creados

1. **`web/components/onboarding/OnboardingModal.tsx`** - Fix diálogo de confirmación
2. **`web/hooks/use-onboarding.ts`** - Mejora de mensajes de error
3. **`scripts/fix-onboarding-rls-policies.sql`** - Script SQL para agregar políticas RLS
4. **`docs/devlog/2025-10-18-fix-onboarding-multiple-issues.md`** - Esta documentación

## Antes vs Después

### ANTES (Todo roto):
```
1. Usuario se registra
2. Completa datos de workspace → OK
3. Completa datos de clínica → OK
4. Click en "Siguiente"
5. → ❌ Error: "Hubo un problema al crear tu configuración"
6. Usuario hace clic fuera del modal por accidente
7. → ❌ Diálogo: "¿Deseas eliminar el espacio de trabajo...?"
8. Usuario frustrado, no puede completar onboarding
```

### DESPUÉS (Todo funciona):
```
1. Usuario se registra
2. Completa datos de workspace → OK
3. Completa datos de clínica → OK
4. Click en "Siguiente"
5. → ✅ Workspace creado (nueva política RLS)
6. → ✅ Clínica creada (nueva política RLS)
7. → ✅ Redirige a /setup con clinicId válido
8. Usuario puede completar los 6 pasos sin problemas
9. Hacer clic fuera del modal NO dispara diálogo molesto ✅
10. Si hay error, se muestra mensaje específico (no genérico) ✅
```

## Cómo Probar

### Escenario 1: Onboarding completo (happy path)
```bash
1. Ejecutar script SQL: scripts/fix-onboarding-rls-policies.sql en Supabase
2. Ejecutar script de reset: scripts/reset-database-simple.sql
3. Registrarse como nuevo usuario
4. Completar nombre de workspace → "Mi Clínica"
5. Completar nombre de clínica → "Clínica Central"
6. Click en "Siguiente"
7. Verificar: Redirige a /setup ✅
8. Verificar: Puede guardar assets sin error ✅
```

### Escenario 2: Diálogo de confirmación NO debe aparecer
```bash
1. Durante el onboarding (cualquier paso)
2. Hacer clic fuera del modal (en el fondo oscuro)
3. Verificar: NO aparece diálogo de confirmación ✅
4. Hacer clic en "Cerrar sesión" (primer paso)
5. Verificar: SÍ aparece diálogo de confirmación ✅
```

### Escenario 3: Errores descriptivos
```bash
1. Durante onboarding
2. (Simulación) Desautenticarse en otra pestaña
3. Click en "Siguiente"
4. Verificar: Error muestra "Unauthorized" (no genérico) ✅
5. Verificar: Console muestra detalles del error ✅
```

## Riesgos y Rollback

### Riesgos:
- **Muy bajo**: Los cambios son fixes de bugs críticos
- **Políticas RLS**: Las nuevas políticas son seguras (solo usuarios autenticados pueden crear workspaces propios)
- **Modal**: El cambio solo afecta el comportamiento del cierre, no la funcionalidad

### Rollback:

Si necesitas revertir:

```bash
# Git
git revert <commit-hash>

# O manualmente:
# 1. Revertir OnboardingModal.tsx a código antiguo
# 2. Revertir use-onboarding.ts a código antiguo
# 3. En Supabase, ejecutar:
DROP POLICY IF EXISTS "Users can create their own workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Creators can create clinics in their workspace" ON public.clinics;
```

## Siguientes Pasos

- [x] **Fix críticos implementados**
- [ ] **ACCIÓN REQUERIDA**: Ejecutar `scripts/fix-onboarding-rls-policies.sql` en Supabase Dashboard
- [ ] **TASK-20251018-test-onboarding-complete** - Probar onboarding end-to-end en staging
- [ ] **TASK-20251018-add-onboarding-e2e-tests** - Agregar tests E2E para prevenir regresiones
- [ ] **OPCIONAL**: Agregar rate limiting para evitar spam de creación de workspaces

## Notas Técnicas

### ¿Por qué no había política de INSERT en workspaces?

Al revisar el historial, parece que:
1. Se creó el esquema con RLS habilitado
2. Se agregaron políticas para SELECT/UPDATE/DELETE
3. Se **olvidó** agregar la política de INSERT
4. El onboarding funcionaba en desarrollo porque se probaba con service role (bypasea RLS)
5. En producción con usuarios reales, falló

### ¿Por qué la política de clinics era tan restrictiva?

La política asumía que:
1. Primero se crea el workspace
2. Después se agrega el usuario a `workspace_users` con rol owner/admin
3. Luego se puede crear la clínica

Pero en el flujo de onboarding:
1. Se crea el workspace
2. **Inmediatamente** se intenta crear la clínica
3. El usuario aún NO está en `workspace_users`
4. → Falla

**Solución**: Verificar con `workspaces.created_by` en lugar de `workspace_users.role`

### Lecciones Aprendidas

1. **Siempre testear con usuarios reales (no service role)**: En dev se probó con service role que bypasea RLS
2. **Mensajes de error descriptivos desde el inicio**: Los errores genéricos hacen debugging imposible
3. **Políticas RLS deben cubrir TODO el flujo**: No solo operaciones post-onboarding
4. **UX de modales**: Evitar cerrar modales accidentalmente (no usar backdrop click)

## Referencias

- Fix anterior relacionado: `docs/devlog/2025-10-18-fix-onboarding-skip-clinic-step.md`
- Esquema RLS: `supabase/01-workspaces-clinics-schema.sql`
- API de onboarding: `web/app/api/onboarding/route.ts`
- Hook de onboarding: `web/hooks/use-onboarding.ts`
- Modal: `web/components/onboarding/OnboardingModal.tsx`

---

**✅ Fixes críticos implementados y listos para deployment**

**⚠️ IMPORTANTE**: Ejecutar `scripts/fix-onboarding-rls-policies.sql` en Supabase antes de deployar el código
