---
id: ISSUE-009
title: Eliminar botón "Actualizar" del Dashboard
status: open
priority: P2
area: ui
estimate: XS (5 min)
parent: TASK-20251209-dashboard-mega-refactor
assignee: null
---

# Eliminar botón "Actualizar" del Dashboard

## Problema
El botón "Actualizar" en el Dashboard:
1. No existe en ningún otro módulo de la app
2. Usa `window.location.reload()` que es un anti-pattern
3. Los datos ya se auto-actualizan con los hooks
4. Crea espacio en blanco innecesario en mobile

## Ubicación
- **Archivo**: `web/app/page.tsx`
- **Líneas**: 246-249, 301-305

```typescript
// Línea 246-249
const handleRefresh = () => {
  fetchReportsData()
  window.location.reload()  // ← Anti-pattern
}

// Línea 301-305
<PageHeader
  ...
  actions={
    <Button onClick={handleRefresh} variant="outline">
      <RefreshCw className="h-4 w-4 mr-2" />
      {t('refresh')}
    </Button>
  }
/>
```

## Solución
Eliminar el botón y la función:

```typescript
// ELIMINAR líneas 246-249 (handleRefresh)

// CAMBIAR líneas 301-305
<PageHeader
  title={t('title')}
  subtitle={t('subtitle', { clinic: currentClinic?.name || '' })}
  // SIN actions prop
/>
```

## Alternativa (si se quiere mantener refresh)
Si decidimos que el refresh es necesario, moverlo a la sidebar global o usar SWR con `mutate()`:

```typescript
// Con SWR (futuro)
const handleRefresh = () => {
  mutate('/api/dashboard/*')  // Revalidar solo datos del dashboard
}
```

## Acceptance Criteria
- [ ] Botón "Actualizar" eliminado del Dashboard
- [ ] Función `handleRefresh` eliminada
- [ ] No hay espacio en blanco donde estaba el botón
- [ ] `npm run typecheck` pasa
- [ ] Traducción `refresh` puede mantenerse (usado en otros lugares)

## Testing
1. Ir a Dashboard
2. Verificar que no hay botón "Actualizar"
3. Verificar que el header se ve limpio

## Archivos a Modificar
1. `web/app/page.tsx`
