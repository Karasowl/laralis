# Active Tasks

## En Progreso

- [ ] TASK-20250817-pr-template-upgrade - Alinear `docs/memories/PR.md` con memorias y reglas
  - Incorporar cadena de dependencias (Depreciación → Fijos → Tiempo → Equilibrio → Insumos → Servicios → Tarifas → Tratamientos)
  - Contexto multi-tenant (Workspaces/Clinics) y snapshots en tratamientos
  - Criterios de aceptación reforzados (i18n EN/ES, AA, Zod, dinero en centavos)
  - Gobernanza: sección Tasks/Devlog y i18n keys para navegación

## Completado Hoy - 2025-08-09

- [x] TASK-20250809-fix-duplicate-routes - Resolver conflicto de rutas duplicadas
  - Movidas páginas de (setup) al directorio principal
  - Actualizada navegación en layout.tsx
  - Agregadas funciones legacy para compatibilidad
  - TypeScript y dev server funcionando correctamente

- [x] TASK-20250809-fix-supplies-types - Arreglar error de TypeScript en supplies
  - Agregado campo cost_per_portion_cents a Supply interface
  - Actualizada API route para calcular el campo
  - Corregidos tipos de columnas y formateo de moneda
  - TypeScript compila sin errores

- [x] TASK-20250809-supplies-crud - CRUD completo de insumos
  - Implementado crear, editar y eliminar con validación
  - Formulario con react-hook-form y zod
  - Categorías traducidas con i18n
  - Búsqueda con debounce de 300ms
  - Multi-tenant verificado
  - UI mejorada con Dialog y preview en vivo

## Próximo

Ver backlog.md para próximas tareas prioritarias.

## Nueva tarea

- [x] TASK-20250809-fix-cents-formatting - Alinear formateo de moneda en centavos
  - Corregido formateo en `web/app/services/page.tsx`
  - Corregido formateo en `web/app/tariffs/page.tsx`
  - Agregado devlog con contexto y pruebas manuales