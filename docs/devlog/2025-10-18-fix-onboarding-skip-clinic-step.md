# Fix: Onboarding Skip Clinic Creation Step Bug

**Fecha**: 2025-10-18
**Tipo**: Bug Fix
**Área**: Onboarding Flow
**Prioridad**: P1 - Crítico

## Contexto

Un usuario reportó un error "access denied" al intentar guardar assets durante el wizard de configuración inicial (`/setup`). El problema ocurría después de hacer un reset completo de la base de datos con el script `reset-database-simple.sql`.

## Problema

Durante el onboarding, a veces los usuarios eran redirigidos directamente al wizard de 6 pasos (`/setup`) sin haber completado los pasos de creación de workspace y clínica. Esto resultaba en:

1. **Síntoma visible**: El usuario no veía los pasos de "Crear workspace" ni "Crear clínica"
2. **Síntoma técnico**: Al intentar guardar un asset, recibía error "access denied"
3. **Causa raíz**: El sistema intentaba guardar el asset sin un `clinic_id` válido, lo cual violaba las políticas RLS de Supabase

## Causa Raíz

El guard en `/web/app/onboarding/page.tsx` (líneas 45-62) solo verificaba la existencia de un **workspace** antes de redirigir a `/setup`:

```typescript
// CÓDIGO ANTIGUO (BUGGY)
useEffect(() => {
  const supabase = createClient()
  ;(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: ws } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)
      if (ws && ws.length > 0) {
        router.replace('/setup')  // ❌ Redirige sin verificar clínica
      }
    } catch {}
  })()
}, [router])
```

### Escenario problemático:

1. Usuario se registra y crea workspace ✅
2. Se hace reset de BD con `reset-database-simple.sql` → Borra datos pero preserva estructura
3. Usuario vuelve a iniciar sesión
4. El guard detecta workspace existente (de localStorage/cookies) ✅
5. Redirige a `/setup` sin verificar si existe clínica ❌
6. `/setup/page.tsx` intenta obtener `clinicId` pero es `undefined`
7. Usuario intenta guardar asset → Error "access denied" 💥

## Qué Cambió

### Archivo modificado: `web/app/onboarding/page.tsx`

**Líneas modificadas**: 45-78

**Cambio principal**: Ahora el guard verifica AMBOS requisitos antes de redirigir:
1. ✅ Usuario tiene workspace
2. ✅ Workspace tiene al menos una clínica

```typescript
// CÓDIGO NUEVO (FIXED)
// Client guard: if user already has workspace AND clinic, prefer full setup page
useEffect(() => {
  const supabase = createClient()
  ;(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Check if user has workspace
      const { data: ws } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)

      if (ws && ws.length > 0) {
        const workspaceId = ws[0].id

        // ✅ NEW: Also check if workspace has at least one clinic
        const { data: clinic } = await supabase
          .from('clinics')
          .select('id')
          .eq('workspace_id', workspaceId)
          .limit(1)

        // ✅ Only redirect to /setup if BOTH workspace AND clinic exist
        if (clinic && clinic.length > 0) {
          router.replace('/setup')
        }
        // ✅ If workspace exists but no clinic, let onboarding continue to clinic creation step
      }
    } catch {}
  })()
}, [router])
```

## Antes vs Después

### ANTES (Buggy):
```
1. Usuario se registra
2. Crea workspace ✅
3. (Reset de BD)
4. Login nuevamente
5. Guard detecta workspace → Redirige a /setup ❌
6. /setup intenta usar clinicId → undefined
7. Guardar asset → Error "access denied" 💥
```

### DESPUÉS (Fixed):
```
1. Usuario se registra
2. Crea workspace ✅
3. (Reset de BD)
4. Login nuevamente
5. Guard detecta workspace → Verifica clínica → No existe
6. Onboarding continúa normalmente ✅
7. Usuario crea clínica en paso 2 ✅
8. Guard ahora detecta workspace Y clínica → Redirige a /setup ✅
9. /setup tiene clinicId válido → Guardar asset funciona ✅
```

## Cómo Probar

### Escenario 1: Onboarding completo normal
```bash
1. Registrarse como nuevo usuario
2. Completar nombre de workspace
3. Completar nombre de clínica
4. Verificar que redirige a /setup con los 6 pasos
5. Guardar un asset → Debe funcionar ✅
```

### Escenario 2: Onboarding después de reset de BD
```bash
1. Tener un usuario registrado con workspace y clínica
2. Ejecutar scripts/reset-database-simple.sql en Supabase
3. Login con el mismo usuario
4. Verificar que aparecen los pasos de workspace Y clínica
5. Completar ambos pasos
6. Verificar que redirige a /setup
7. Guardar un asset → Debe funcionar ✅
```

### Escenario 3: Usuario con workspace pero sin clínica (edge case)
```bash
1. Crear workspace manualmente en BD
2. No crear clínica
3. Login
4. Verificar que aparece el paso de clínica
5. Crear clínica
6. Verificar que redirige a /setup
7. Guardar asset → Debe funcionar ✅
```

## Archivos Tocados

1. **`web/app/onboarding/page.tsx`** (modificado)
   - Líneas 45-78
   - Agregada verificación de existencia de clínica

## Riesgos y Rollback

### Riesgos:
- **Muy bajo**: El cambio solo afecta la lógica de redirección del guard
- **Edge case**: Si un usuario legítimamente tiene workspace sin clínica (no debería pasar en producción)

### Rollback:
Si necesitas revertir el cambio:

```bash
git revert <commit-hash>
```

O manualmente, cambiar líneas 45-78 al código antiguo (solo verificar workspace).

## Siguientes Pasos

- [ ] **TASK-20251018-test-onboarding-flow** - Agregar tests E2E para el flujo completo de onboarding
- [ ] **TASK-20251018-validate-clinic-context** - Validar que el contexto de clínica siempre tenga valores válidos en /setup
- [ ] **OPCIONAL**: Agregar mensaje de error más descriptivo si falta clinicId en /setup

## Notas Técnicas

### Por qué funcionaba antes del reset:
- El onboarding normal crea workspace → clínica → redirige a /setup en secuencia
- El guard solo se ejecuta al recargar la página o volver a /onboarding
- En flujo normal, workspace Y clínica ya existen cuando se ejecuta el guard

### Por qué fallaba después del reset:
- `reset-database-simple.sql` borra TODOS los datos (workspaces, clínicas, etc.)
- Pero NO limpia localStorage/cookies del navegador
- El guard leía workspace del contexto/cookies y asumía que existía en BD
- Redirigía a /setup antes de crear la clínica

### Lección aprendida:
**Siempre verificar dependencias en cadena**: Si workspace requiere clínica para funcionar, el guard debe verificar AMBOS, no solo uno.

## Referencias

- Archivo modificado: `web/app/onboarding/page.tsx:45-78`
- Script de reset: `scripts/reset-database-simple.sql`
- Estructura de workspaces: `supabase/migrations/09_workspaces_structure.sql:4-25`
- Políticas RLS assets: Requieren `clinic_id` válido para INSERT

---

**✅ Fix implementado y listo para testing**
