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

### 2026-02-05

- **[2026-02-05-refactor-phase1-baseline.md](2026-02-05-refactor-phase1-baseline.md)** - Refactor incremental: baseline automatizado, CI minima, PR checklist, toolkit API (`requestId` + logger), migracion inicial de rutas `expenses/*`, estabilizacion de `useExpenses` y limpieza de temporales/duplicados.

### 2026-02-04

- **[2026-02-04-block-service-role-client.md](2026-02-04-block-service-role-client.md)** - Fix de seguridad: `supabaseAdmin` ahora es server-only y lanza error si se evalua en navegador, evitando uso accidental en cliente.
- **[2026-02-04-security-headers-and-api-validation.md](2026-02-04-security-headers-and-api-validation.md)** - Hardening: CSP + HSTS (prod) y validacion Zod en endpoints criticos con helper compartido.
- **[2026-02-04-api-validation-actions.md](2026-02-04-api-validation-actions.md)** - Validacion Zod aplicada a endpoints `api/actions/*`.
- **[2026-02-04-api-validation-remaining.md](2026-02-04-api-validation-remaining.md)** - Validacion Zod en endpoints restantes fuera de `api/actions/*`.
- **[2026-02-04-api-validation-additional.md](2026-02-04-api-validation-additional.md)** - Parseo seguro adicional y validacion Zod en endpoints complementarios.

### 2025-12-31

- **[2025-12-31-fix-dashboard-comparison-filter.md](2025-12-31-fix-dashboard-comparison-filter.md)** - Fix P1: El filtro de "Comparación" del dashboard existía en la UI pero no afectaba los datos. Implementado soporte completo: fetching paralelo del período anterior, cálculo de cambios porcentuales, nuevo componente ComparisonIndicator, indicadores visuales con tendencias (↗/↘) y colores semánticos.
- **[2025-12-31-multi-user-permissions-system.md](2025-12-31-multi-user-permissions-system.md)** - Feature P0: Sistema completo de roles y permisos multi-usuario. Incluye: workspace_users con 5 roles, clinic_users con 5 roles, sistema de invitaciones con tokens, UI de Team Settings con 3 tabs, componentes `<Can>` para rendering condicional, hooks usePermissions/useWorkspaceMembers/useClinicMembers, 10+ nuevas APIs, 3 migraciones SQL, ~150 nuevas keys i18n.

### 2025-12-18

- **[2025-12-18-fix-service-price-drift-bug.md](2025-12-18-fix-service-price-drift-bug.md)** - Fix P0 crítico: Precios de servicios cambiaban solos con el tiempo. Causa raíz: trigger recalculaba price_cents basándose en costos potencialmente desactualizados cada vez que se editaba un servicio. Solución: nuevo campo original_price_cents + trigger reescrito para SOLO aplicar descuentos.

### 2025-12-14

- **[2025-12-14-fix-break-even-days-remaining-ux.md](2025-12-14-fix-break-even-days-remaining-ux.md)** - Fix P1 UX: Mensaje confuso "X días restantes" en Punto de Equilibrio. El número podía exceder los días del mes porque mostraba "días necesarios al ritmo actual", no "días que quedan". Agregado badge rojo + advertencia cuando meta es inalcanzable.
- **[2025-12-14-fix-profile-phone-not-showing.md](2025-12-14-fix-profile-phone-not-showing.md)** - Fix P1: Teléfono no aparecía en Cuenta/Perfil debido a mismatch entre dónde se guardaba (auth.users.phone) y dónde se leía (user_metadata.phone). Unificado para usar user_metadata en ambos casos.

### 2025-12-08

- **[2025-12-08-fix-dashboard-date-filter.md](2025-12-08-fix-dashboard-date-filter.md)** - Fix P1: Dashboard date filter no se aplicaba a todos los componentes. Hooks como useReports, useServiceROI, useMarketingMetrics, y useChannelROI ignoraban el filtro de fechas. Ahora todos respetan currentRange.

### 2025-12-05

- **[2025-12-05-fix-treatment-price-recalculation-bug.md](2025-12-05-fix-treatment-price-recalculation-bug.md)** - Fix P0 critico: Bug donde los precios de tratamientos se recalculaban incorrectamente al hacer cualquier update (ej: cambio de status), causando que precios de $500 cambiaran a $487 sin intervencion del usuario. Causa raiz: `undefined !== 'service-uuid'` siempre evaluaba a true.

### 2025-11-17

- **[2025-11-17-tariff-to-service-architecture-migration.md](2025-11-17-tariff-to-service-architecture-migration.md)** - ⚠️ BREAKING Architectural Change P0: Deprecación completa del sistema de tarifas (tariffs table) y migración de toda la lógica de pricing a la tabla services. Simplificación del 50% en queries, eliminación de versionado innecesario, single source of truth en services.price_cents.

### 2025-10-18

- **[2025-10-18-improve-dark-mode-ux.md](2025-10-18-improve-dark-mode-ux.md)** - Mejora P2 UX: Dark mode rediseñado con técnicas modernas - eliminado "alto contraste" molesto, implementada paleta suave inspirada en GitHub/Material Design
- **[2025-10-18-fix-service-recipe-requirement-too-strict.md](2025-10-18-fix-service-recipe-requirement-too-strict.md)** - Fix P1 crítico: Requirement service_recipe era demasiado estricto, exigía que servicios tuvieran supplies cuando muchos servicios dentales no los necesitan
- **[2025-10-18-fix-setup-wizard-redirect-loop.md](2025-10-18-fix-setup-wizard-redirect-loop.md)** - Fix P0 crítico: Wizard de setup redirigía inmediatamente al hacer click en "Configure assets", creando un loop que impedía completar el onboarding
- **[2025-10-18-fix-services-revenue-rls-errors.md](2025-10-18-fix-services-revenue-rls-errors.md)** - Fix P0 crítico: Errores en /api/services y /api/dashboard/revenue por políticas RLS faltantes en tablas operacionales (services, supplies, treatments, expenses)
- **[2025-10-18-fix-onboarding-triggers-rls.md](2025-10-18-fix-onboarding-triggers-rls.md)** - Fix P0 crítico: Triggers de clinics fallaban por falta de políticas RLS en custom_categories y patient_sources
- **[2025-10-18-fix-onboarding-multiple-issues.md](2025-10-18-fix-onboarding-multiple-issues.md)** - Fix P0 crítico: Múltiples problemas que bloqueaban el onboarding (RLS, diálogo molesto, errores genéricos)
- **[2025-10-18-fix-onboarding-skip-clinic-step.md](2025-10-18-fix-onboarding-skip-clinic-step.md)** - Fix crítico: Bug donde el onboarding saltaba los pasos de workspace y clínica, causando "access denied" en assets
- **[Troubleshooting: Clínicas Fantasma](../TROUBLESHOOTING-RESET-AND-CACHE.md)** - Investigación y solución del problema de "clínicas fantasma" que aparecen después de resetear la base de datos (combinación de script SQL incompleto + caché del navegador)

### 2025-10-22

- **[2025-10-22-export-import-system.md](2025-10-22-export-import-system.md)** - Feature P1: Sistema completo de exportación e importación con versionado de esquema, migraciones automáticas, validación exhaustiva (8 tipos), checksums SHA-256, y rollback manual. Cobertura de 25 tablas con compatibilidad hacia adelante.

### 2025-08-09

- **[2025-08-09-bootstrap-proyecto.md](2025-08-09-bootstrap-proyecto.md)** - Arranque inicial del proyecto con Next.js, i18n, motor de cálculos y shell de UI estilo Apple
- **[2025-08-09-supplies-services-module.md](2025-08-09-supplies-services-module.md)** - Implementación completa del módulo de insumos y servicios con cálculo de costos
- **[2025-08-09-fix-duplicate-routes.md](2025-08-09-fix-duplicate-routes.md)** - Resolución de conflicto de rutas duplicadas con Route Groups
- **[2025-08-09-fix-supplies-types.md](2025-08-09-fix-supplies-types.md)** - Corrección de tipos TypeScript y campos en supplies
- **[2025-08-09-supplies-crud.md](2025-08-09-supplies-crud.md)** - CRUD completo de insumos con validación y multi-tenant

## Por Área

### Infraestructura
- [2026-02-05-refactor-phase1-baseline.md](2026-02-05-refactor-phase1-baseline.md) - Baseline de deuda tecnica + guardrails + toolkit API + limpieza inicial
- [2026-02-04-block-service-role-client.md](2026-02-04-block-service-role-client.md) - Fix seguridad: supabaseAdmin server-only
- [2026-02-04-security-headers-and-api-validation.md](2026-02-04-security-headers-and-api-validation.md) - Hardening: headers CSP/HSTS + validacion Zod
- [2026-02-04-api-validation-remaining.md](2026-02-04-api-validation-remaining.md) - Validacion Zod en endpoints restantes
- [2026-02-04-api-validation-additional.md](2026-02-04-api-validation-additional.md) - Parseo seguro adicional en endpoints complementarios
- [2025-11-17-tariff-to-service-architecture-migration.md](2025-11-17-tariff-to-service-architecture-migration.md) - ⚠️ BREAKING: Deprecación de tariffs, services ahora es el pricing catalog
- [2025-08-09-bootstrap-proyecto.md](2025-08-09-bootstrap-proyecto.md) - Setup inicial completo
- [2025-10-22-export-import-system.md](2025-10-22-export-import-system.md) - Sistema completo de export/import con migraciones

### Multi-Tenancy & Permisos
- [2025-12-31-multi-user-permissions-system.md](2025-12-31-multi-user-permissions-system.md) - Sistema completo de roles, permisos, invitaciones, y UI de Team Settings

### Onboarding & Auth
- [2025-12-14-fix-profile-phone-not-showing.md](2025-12-14-fix-profile-phone-not-showing.md) - Fix de mismatch phone field: auth.users.phone vs user_metadata.phone
- [2025-10-18-fix-service-recipe-requirement-too-strict.md](2025-10-18-fix-service-recipe-requirement-too-strict.md) - Fix de requirement excesivamente estricto que bloqueaba el wizard
- [2025-10-18-fix-setup-wizard-redirect-loop.md](2025-10-18-fix-setup-wizard-redirect-loop.md) - Fix de redirect loop en configuración de assets
- [2025-10-18-fix-onboarding-triggers-rls.md](2025-10-18-fix-onboarding-triggers-rls.md) - Fix de políticas RLS en triggers automáticos de clinics
- [2025-10-18-fix-onboarding-multiple-issues.md](2025-10-18-fix-onboarding-multiple-issues.md) - Fix de RLS policies, UX del modal, y mensajes de error
- [2025-10-18-fix-onboarding-skip-clinic-step.md](2025-10-18-fix-onboarding-skip-clinic-step.md) - Fix del guard que permitía saltar pasos críticos

### Base de Datos / RLS
- [2025-10-18-fix-services-revenue-rls-errors.md](2025-10-18-fix-services-revenue-rls-errors.md) - Políticas RLS completas para tablas operacionales + funciones helper adaptativas
- [2025-10-18-fix-onboarding-triggers-rls.md](2025-10-18-fix-onboarding-triggers-rls.md) - Políticas RLS para custom_categories y patient_sources (triggers)
- [2025-10-18-fix-onboarding-multiple-issues.md](2025-10-18-fix-onboarding-multiple-issues.md) - Políticas RLS faltantes para workspaces e INSERT en clinics

### Motor de Cálculos
- [2025-12-05-fix-treatment-price-recalculation-bug.md](2025-12-05-fix-treatment-price-recalculation-bug.md) - Fix critico de recalculo incorrecto de precios en updates
- [2025-08-09-bootstrap-proyecto.md](2025-08-09-bootstrap-proyecto.md) - Implementación del motor de cálculos con tests
- [2025-08-09-supplies-services-module.md](2025-08-09-supplies-services-module.md) - Cálculos de costos variables y tratamientos

### UI/UX
- [2025-12-31-fix-dashboard-comparison-filter.md](2025-12-31-fix-dashboard-comparison-filter.md) - Fix de filtro de comparación en Dashboard (período anterior / año anterior)
- [2025-12-14-fix-break-even-days-remaining-ux.md](2025-12-14-fix-break-even-days-remaining-ux.md) - Fix de mensaje confuso "días restantes" en Punto de Equilibrio
- [2025-12-08-fix-dashboard-date-filter.md](2025-12-08-fix-dashboard-date-filter.md) - Fix de filtro de fechas en Dashboard
- [2025-10-18-improve-dark-mode-ux.md](2025-10-18-improve-dark-mode-ux.md) - Rediseño completo de dark mode con paleta moderna
- [2025-08-09-bootstrap-proyecto.md](2025-08-09-bootstrap-proyecto.md) - Sistema de componentes estilo Apple
- [2025-08-09-supplies-services-module.md](2025-08-09-supplies-services-module.md) - Páginas de insumos y servicios con preview en vivo
- [2025-10-22-export-import-system.md](2025-10-22-export-import-system.md) - UI de export/import con tabs, drag & drop, y validación visual

### Internacionalización
- [2025-08-09-bootstrap-proyecto.md](2025-08-09-bootstrap-proyecto.md) - Setup de next-intl con EN/ES
- [2025-08-09-supplies-services-module.md](2025-08-09-supplies-services-module.md) - Strings para módulo de insumos y servicios
- [2025-10-22-export-import-system.md](2025-10-22-export-import-system.md) - 90 keys para export, import, y validación (EN + ES)

### Base de Datos
- [2025-08-09-supplies-services-module.md](2025-08-09-supplies-services-module.md) - Esquema de insumos, servicios y recetas

### Data Management / Export-Import
- [2025-10-22-export-import-system.md](2025-10-22-export-import-system.md) - Sistema completo con versionado, migraciones, validación (8 tipos), checksums SHA-256

### API Endpoints
- [2025-10-18-fix-services-revenue-rls-errors.md](2025-10-18-fix-services-revenue-rls-errors.md) - Fix de errores en /api/services y /api/dashboard/revenue
- [2025-10-22-export-import-system.md](2025-10-22-export-import-system.md) - Endpoints /api/export/generate, /validate, /import
- [2026-02-04-api-validation-remaining.md](2026-02-04-api-validation-remaining.md) - Validacion Zod en endpoints restantes
- [2026-02-04-api-validation-additional.md](2026-02-04-api-validation-additional.md) - Parseo seguro adicional en endpoints complementarios

## Stats

- **Total entradas**: 27
- **Ultima actualizacion**: 2026-02-05
- **Archivos documentados**: 235+
