# Devlog Index - Laralis Dental Manager

Este índice contiene todas las entradas del devlog organizadas cronológicamente. Cada entrada documenta cambios importantes, decisiones técnicas y lecciones aprendidas durante el desarrollo.

## Formato

Cada entrada sigue la estructura:
- **Contexto**: Situación que motivó el trabajo
- **Problema**: Qué necesitaba resolverse
- **Causa raíz**: Por qué existía el problema
- **Qué cambió**: Solución implementada
- **Archivos tocados**: Lista de archivos modificados/creados
- **Antes vs Después**: Estado previo y nuevo
- **Cómo probar**: Pasos para verificar la solución
- **Riesgos y rollback**: Posibles problemas y cómo revertir
- **Siguientes pasos**: Tasks de seguimiento

## Entradas

### 2025-10-18

- **[2025-10-18-fix-setup-wizard-redirect-loop.md](2025-10-18-fix-setup-wizard-redirect-loop.md)** - Fix P0 crítico: Wizard de setup redirigía inmediatamente al hacer click en "Configure assets", creando un loop que impedía completar el onboarding
- **[2025-10-18-fix-services-revenue-rls-errors.md](2025-10-18-fix-services-revenue-rls-errors.md)** - Fix P0 crítico: Errores en /api/services y /api/dashboard/revenue por políticas RLS faltantes en tablas operacionales (services, supplies, treatments, expenses)
- **[2025-10-18-fix-onboarding-triggers-rls.md](2025-10-18-fix-onboarding-triggers-rls.md)** - Fix P0 crítico: Triggers de clinics fallaban por falta de políticas RLS en custom_categories y patient_sources
- **[2025-10-18-fix-onboarding-multiple-issues.md](2025-10-18-fix-onboarding-multiple-issues.md)** - Fix P0 crítico: Múltiples problemas que bloqueaban el onboarding (RLS, diálogo molesto, errores genéricos)
- **[2025-10-18-fix-onboarding-skip-clinic-step.md](2025-10-18-fix-onboarding-skip-clinic-step.md)** - Fix crítico: Bug donde el onboarding saltaba los pasos de workspace y clínica, causando "access denied" en assets
- **[Troubleshooting: Clínicas Fantasma](../TROUBLESHOOTING-RESET-AND-CACHE.md)** - Investigación y solución del problema de "clínicas fantasma" que aparecen después de resetear la base de datos (combinación de script SQL incompleto + caché del navegador)

### 2025-08-09

- **[2025-08-09-bootstrap-proyecto.md](2025-08-09-bootstrap-proyecto.md)** - Arranque inicial del proyecto con Next.js, i18n, motor de cálculos y shell de UI estilo Apple
- **[2025-08-09-supplies-services-module.md](2025-08-09-supplies-services-module.md)** - Implementación completa del módulo de insumos y servicios con cálculo de costos
- **[2025-08-09-fix-duplicate-routes.md](2025-08-09-fix-duplicate-routes.md)** - Resolución de conflicto de rutas duplicadas con Route Groups
- **[2025-08-09-fix-supplies-types.md](2025-08-09-fix-supplies-types.md)** - Corrección de tipos TypeScript y campos en supplies
- **[2025-08-09-supplies-crud.md](2025-08-09-supplies-crud.md)** - CRUD completo de insumos con validación y multi-tenant

## Por Área

### Infraestructura
- [2025-08-09-bootstrap-proyecto.md](2025-08-09-bootstrap-proyecto.md) - Setup inicial completo

### Onboarding & Auth
- [2025-10-18-fix-onboarding-triggers-rls.md](2025-10-18-fix-onboarding-triggers-rls.md) - Fix de políticas RLS en triggers automáticos de clinics
- [2025-10-18-fix-onboarding-multiple-issues.md](2025-10-18-fix-onboarding-multiple-issues.md) - Fix de RLS policies, UX del modal, y mensajes de error
- [2025-10-18-fix-onboarding-skip-clinic-step.md](2025-10-18-fix-onboarding-skip-clinic-step.md) - Fix del guard que permitía saltar pasos críticos

### Base de Datos / RLS
- [2025-10-18-fix-services-revenue-rls-errors.md](2025-10-18-fix-services-revenue-rls-errors.md) - Políticas RLS completas para tablas operacionales + funciones helper adaptativas
- [2025-10-18-fix-onboarding-triggers-rls.md](2025-10-18-fix-onboarding-triggers-rls.md) - Políticas RLS para custom_categories y patient_sources (triggers)
- [2025-10-18-fix-onboarding-multiple-issues.md](2025-10-18-fix-onboarding-multiple-issues.md) - Políticas RLS faltantes para workspaces e INSERT en clinics

### Motor de Cálculos
- [2025-08-09-bootstrap-proyecto.md](2025-08-09-bootstrap-proyecto.md) - Implementación del motor de cálculos con tests
- [2025-08-09-supplies-services-module.md](2025-08-09-supplies-services-module.md) - Cálculos de costos variables y tratamientos

### UI/UX
- [2025-08-09-bootstrap-proyecto.md](2025-08-09-bootstrap-proyecto.md) - Sistema de componentes estilo Apple
- [2025-08-09-supplies-services-module.md](2025-08-09-supplies-services-module.md) - Páginas de insumos y servicios con preview en vivo

### Internacionalización
- [2025-08-09-bootstrap-proyecto.md](2025-08-09-bootstrap-proyecto.md) - Setup de next-intl con EN/ES
- [2025-08-09-supplies-services-module.md](2025-08-09-supplies-services-module.md) - Strings para módulo de insumos y servicios

### Base de Datos
- [2025-08-09-supplies-services-module.md](2025-08-09-supplies-services-module.md) - Esquema de insumos, servicios y recetas

### API Endpoints
- [2025-10-18-fix-services-revenue-rls-errors.md](2025-10-18-fix-services-revenue-rls-errors.md) - Fix de errores en /api/services y /api/dashboard/revenue

## Stats

- **Total entradas**: 10
- **Última actualización**: 2025-10-18
- **Archivos documentados**: 96+