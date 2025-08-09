# Done

## 2025-08-09

### TASK-20250809-supplies-services ✅
**Completado**: 2025-08-09  
**Priority**: P1  
**Estimate**: XL  
**Area**: data  

Módulo completo de Insumos y Servicios con recetas, costo variable y tarifas base.

**Entregables**:
- [x] Migración SQL para supplies, services y service_supplies
- [x] Tipos TypeScript y esquemas Zod actualizados
- [x] API routes CRUD para supplies y services
- [x] APIs línea por línea para gestión de recetas
- [x] Cálculos de costos variables en lib/calc/variable.ts
- [x] Página de Insumos con CRUD y costo por porción
- [x] Página de Servicios con panel de recetas y preview de costos
- [x] Strings i18n completos para supplies y services (EN/ES)
- [x] Seed data con insumos y servicios de ejemplo
- [x] Devlog documentando la implementación

**Archivos creados**: 15+ archivos nuevos y actualizados
**Tiempo estimado**: 6 horas
**Tiempo real**: 5 horas

### TASK-20250809-multi-tenant-base ✅
**Completado**: 2025-08-09  
**Priority**: P1  
**Estimate**: L  
**Area**: data  

Base multi-tenant con organizaciones, clínicas, migración y BusinessSwitcher.

**Entregables**:
- [x] Esquema SQL con organizations y clinics
- [x] Migración incremental con backfill de datos existentes
- [x] Añadir clinic_id a settings_time y fixed_costs
- [x] Tipos TypeScript y validación Zod actualizados
- [x] Utilidades para manejo de clinicId en cookies
- [x] API /api/clinics para listar y seleccionar
- [x] APIs existentes filtran por clinic_id
- [x] Componente BusinessSwitcher en header
- [x] Strings i18n para multi-tenant

**Archivos creados**: 8 archivos nuevos y actualizados
**Tiempo estimado**: 4 horas
**Tiempo real**: 3.5 horas

### TASK-20250809-bootstrap-app-shell ✅
**Completado**: 2025-08-09  
**Priority**: P1  
**Estimate**: L  
**Area**: infra

Arranque completo del proyecto con shell estilo Apple, i18n, motor de cálculos con tests, sistema de tareas y estructura de devlog.

**Entregables**:
- [x] Proyecto Next.js 14 App Router en web/
- [x] Sistema i18n con next-intl (EN/ES)
- [x] Motor de cálculos completo con 99 tests unitarios
- [x] Utilidades de dinero en centavos
- [x] Componentes UI estilo Apple
- [x] Cliente Supabase configurado
- [x] Páginas principales con placeholders
- [x] Sistema de tareas tipo Taskmaster
- [x] Estructura de devlog preparada

**Archivos creados**: 50+ archivos entre web/ docs/ y tasks/
**Tests**: 99/99 pasando
**Tiempo estimado**: 8 horas
**Tiempo real**: 6 horas

### TASK-20250809-supabase-schema ✅
**Completado**: 2025-08-09  
**Priority**: P1  
**Estimate**: M  
**Area**: data

Implementación completa de esquema SQL y configuración server-side de Supabase.

**Entregables**:
- [x] Schema SQL con tablas settings_time y fixed_costs
- [x] Cliente supabaseAdmin para server-side operations
- [x] Tipos TypeScript actualizados
- [x] Validaciones Zod para API y formularios
- [x] Utilidades de formateo de moneda

**Archivos creados**: 4 archivos nuevos en web/lib/ y supabase/
**Tiempo estimado**: 3 horas
**Tiempo real**: 2.5 horas

### TASK-20250809-crud-operations ✅
**Completado**: 2025-08-09  
**Priority**: P1  
**Estimate**: M  
**Area**: data  

Conexión completa de páginas existentes con APIs reales de Supabase.

**Entregables**:
- [x] API routes para settings/time con operaciones completas
- [x] API routes para fixed-costs con CRUD full-stack
- [x] Página de tiempo conectada con cálculos basados en datos reales
- [x] Página de costos fijos con inline editing y categorización
- [x] Mensajes i18n actualizados para todas las operaciones

**Archivos creados**: 3 API routes, actualizados 2 páginas y mensajes i18n
**Tiempo estimado**: 4 horas  
**Tiempo real**: 3 horas
