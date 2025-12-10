---
id: ISSUE-012
title: RecentActivity debería estar colapsada por defecto
status: open
priority: P1
area: ui
estimate: S (1 hora)
parent: TASK-20251209-dashboard-mega-refactor
assignee: null
---

# RecentActivity debería estar colapsada por defecto

## Problema
El componente `RecentActivity` muestra TODOS los items sin límite, ocupando mucho espacio vertical en el dashboard. Debería mostrar 1-2 items por defecto y expandir on-demand.

## Ubicación
- **Archivo**: `web/components/dashboard/RecentActivity.tsx`

## Solución Propuesta

```typescript
interface RecentActivityProps {
  activities: Activity[]
  title: string
  description: string
  collapsedLimit?: number  // NUEVO: items a mostrar colapsado (default 2)
}

export function RecentActivity({
  activities,
  title,
  description,
  collapsedLimit = 2
}: RecentActivityProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const visibleActivities = isExpanded
    ? activities
    : activities.slice(0, collapsedLimit)

  const hasMore = activities.length > collapsedLimit

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {visibleActivities.map((activity, i) => (
            <ActivityItem key={i} activity={activity} />
          ))}
        </div>

        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full mt-3"
          >
            {isExpanded
              ? t('recentActivity.showLess')
              : t('recentActivity.showMore', { count: activities.length - collapsedLimit })
            }
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
```

## Traducciones Necesarias

```json
// messages/en.json
{
  "dashboardComponents": {
    "recentActivity": {
      "showMore": "Show {count} more",
      "showLess": "Show less"
    }
  }
}

// messages/es.json
{
  "dashboardComponents": {
    "recentActivity": {
      "showMore": "Ver {count} más",
      "showLess": "Ver menos"
    }
  }
}
```

## Acceptance Criteria
- [ ] Por defecto muestra solo 2 actividades
- [ ] Botón "Ver X más" aparece si hay más de 2
- [ ] Click en botón expande/colapsa la lista
- [ ] Animación suave de expand/collapse
- [ ] Traducciones en EN y ES
- [ ] `npm run typecheck` pasa

## Testing
1. Ir a Dashboard con +5 actividades recientes
2. Verificar que solo se muestran 2
3. Click en "Ver 3 más"
4. Verificar que se muestran todas
5. Click en "Ver menos"
6. Verificar que vuelve a mostrar 2

## Archivos a Modificar
1. `web/components/dashboard/RecentActivity.tsx`
2. `messages/en.json`
3. `messages/es.json`
