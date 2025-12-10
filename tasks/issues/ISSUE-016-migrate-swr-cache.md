---
id: ISSUE-016
title: Migrar hooks a useSwrCrud para cache
status: open
priority: P2
area: infra
estimate: M (2-3 horas)
parent: TASK-20251209-dashboard-mega-refactor
assignee: null
---

# Migrar hooks a useSwrCrud para cache

## Problema
Al navegar entre módulos (ej: Pacientes → Dashboard → Pacientes), los datos se recargan completamente. Esto causa:
- 300ms+ de espera innecesaria
- Más requests al servidor
- UX subóptima

## Causa Raíz
Los hooks usan `useCrudOperations` que NO tiene cache. Pero existen hooks SWR (`useSwrCrud`, `useSwrApi`) que NUNCA se usan.

## Solución
Migrar hooks de dominio de `useCrudOperations` a `useSwrCrud`. La API es compatible.

## Patrón de Migración

```typescript
// ANTES (sin cache)
import { useCrudOperations } from '@/hooks/use-crud-operations'

export function usePatients(options) {
  const crud = useCrudOperations<Patient>({
    endpoint: '/api/patients',
    entityName: 'Patient',
    includeClinicId: true,
  })
  return { ...crud }
}

// DESPUÉS (con cache SWR)
import { useSwrCrud } from '@/hooks/use-swr-crud'

export function usePatients(options) {
  const crud = useSwrCrud<Patient>({
    endpoint: '/api/patients',
    entityName: 'Patient',
    includeClinicId: true,
    revalidateOnFocus: true,  // Opcional: refresh al volver a la tab
    dedupingInterval: 2000,   // Opcional: dedup de requests
  })
  return { ...crud }
}
```

## Hooks a Migrar (Prioridad)

| Hook | Prioridad | Beneficio |
|------|-----------|-----------|
| `use-patients.ts` | Alta | Datos estables, navegación frecuente |
| `use-treatments.ts` | Alta | Navegación frecuente |
| `use-services.ts` | Media | Precios no cambian constantemente |
| `use-supplies.ts` | Media | Datos relativamente estables |
| `use-expenses.ts` | Baja | Datos entrados recientemente |

## Configuración SWR Recomendada

```typescript
const swrConfig = {
  revalidateOnFocus: true,      // Refresh al volver a la tab
  revalidateOnReconnect: true,  // Refresh al reconectar internet
  dedupingInterval: 2000,       // No duplicar requests en 2s
  refreshInterval: 0,           // No auto-refresh (ahorra bandwidth)
}
```

## Ubicación del Refresh Manual
Si se implementa cache, agregar botón de refresh:

**Opción A**: En cada PageHeader
```typescript
<PageHeader
  title={t('patients')}
  actions={
    <>
      <Button onClick={() => mutate()} size="icon" variant="ghost">
        <RefreshCw className={cn("h-4 w-4", isValidating && "animate-spin")} />
      </Button>
      <Button onClick={openCreate}>
        <Plus className="h-4 w-4 mr-2" />
        {t('new')}
      </Button>
    </>
  }
/>
```

**Opción B**: En Sidebar global (un solo botón para todo)

## Acceptance Criteria
- [ ] Hooks migrados usan `useSwrCrud`
- [ ] Navegación entre módulos NO recarga datos
- [ ] Mutaciones (create/update/delete) invalidan cache
- [ ] Botón de refresh manual disponible
- [ ] No hay regresiones en funcionalidad
- [ ] `npm run typecheck` pasa

## Testing
1. Ir a Pacientes, esperar carga
2. Ir a Dashboard
3. Volver a Pacientes
4. Verificar que NO hay loading spinner (datos en cache)
5. Crear nuevo paciente
6. Verificar que la lista se actualiza (cache invalidado)

## Archivos a Modificar
1. `web/hooks/use-patients.ts`
2. `web/hooks/use-treatments.ts`
3. `web/hooks/use-services.ts`
4. `web/hooks/use-supplies.ts`
5. (Opcional) `web/hooks/use-expenses.ts`

## Riesgos
- **Datos stale**: Usuario podría ver datos desactualizados si otro usuario modificó
- **Mitigación**: `revalidateOnFocus: true` actualiza al volver a la tab

## Métricas de Éxito
- Tiempo de navegación Pacientes→Dashboard→Pacientes: de 600ms a <100ms
- Requests al servidor reducidos en ~40%
