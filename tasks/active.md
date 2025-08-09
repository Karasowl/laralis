# Active Tasks

## En Progreso

### TASK-20250809-bootstrap-app-shell ✅ COMPLETADO
**Status**: done  
**Priority**: P1  
**Estimate**: L  
**Area**: infra  

Arranque del proyecto — shell estilo Apple, i18n (EN por defecto + switch ES), motor de cálculos con tests, tasks y devlog, reglas de Cursor.

- [x] Next.js 14 App Router con TypeScript, Tailwind, shadcn/ui y Vitest
- [x] i18n con next-intl. Locale por defecto en y conmutador a es  
- [x] Motor de cálculo en lib/calc con tests que reflejen la hoja
- [x] Utilidades de dinero en lib/money.ts usando centavos y redondeo seguro
- [x] Shell de UI estilo Apple. PageHeader, Card, EmptyState, DataTable, FormField, Skeleton
- [x] Sistema de tareas en tasks/ y devlog en docs/devlog/
- [x] Cliente de Supabase y .env.example sin llaves reales
- [x] Páginas placeholder con React Hook Form y Zod

### TASK-20250809-supabase-schema ✅ COMPLETADO
**Status**: done  
**Priority**: P1  
**Estimate**: M  
**Area**: data  

Implementar esquema SQL básico y cliente server-side para Supabase.

- [x] Schema SQL con settings_time y fixed_costs en centavos
- [x] Cliente supabaseAdmin para operaciones server-side
- [x] Tipos TypeScript y validaciones Zod
- [x] Utilidades de formateo de moneda por locale

### TASK-20250809-crud-operations ✅ COMPLETADO  
**Status**: done  
**Priority**: P1  
**Estimate**: M  
**Area**: data  

Conectar páginas existentes con APIs reales de Supabase.

- [x] API routes para settings/time (GET/POST/PUT con upsert)
- [x] API routes para fixed-costs (CRUD completo con paginación)  
- [x] Conectar página de tiempo con cálculos basados en costos reales
- [x] Conectar página de costos fijos con formulario inline y CRUD
- [x] Actualizar mensajes i18n para operaciones CRUD

## Próximo

Ninguna tarea activa actualmente. Ver backlog.md para próximas tareas.
