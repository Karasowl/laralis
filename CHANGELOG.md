# Changelog - Laralis Dental Manager

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

### Planeado
- Sistema de roles y permisos
- Reportes avanzados de rentabilidad
- Integración con facturación electrónica

---

## [0.2.0] - 2025-10-18

### ✨ Agregado
- **Dark Mode Premium**: Rediseño completo con paleta moderna inspirada en Notion/Linear
- **Wizard de Setup**: Sistema completo de onboarding paso a paso
- **Auto-cleanup**: Detección automática de datos fantasma en localStorage
- **Diagnóstico RLS**: Scripts SQL para verificar estado de políticas
- **Sistema de Requirements**: Validación progresiva de configuración inicial

### 🔧 Mejorado
- Requirement `service_recipe` ahora más flexible (permite servicios sin supplies)
- Dark mode con mejor contraste y jerarquía visual
- Validación de recetas de servicios menos estricta

### 🐛 Corregido
- Fix de loop infinito en configuración de assets
- Fix de políticas RLS faltantes en tablas operacionales
- Fix de triggers que fallaban por falta de SECURITY DEFINER
- Fix de "clínicas fantasma" después de reset de base de datos
- Fix de guard que permitía saltar pasos críticos del onboarding
- Fix de múltiples problemas de UX en modal de onboarding

### 🗑️ Eliminado
- Validación obligatoria de supplies en servicios

---

## [0.1.0] - 2025-08-09

### ✨ Agregado
- Setup inicial del proyecto con Next.js 14 + TypeScript
- Sistema de internacionalización (i18n) con next-intl (EN/ES)
- Motor de cálculos de costos y pricing
- Módulo de Insumos (Supplies) con CRUD completo
- Módulo de Servicios con recetas
- Módulo de Activos (Assets) con depreciación
- Módulo de Costos Fijos (Fixed Costs)
- Módulo de Configuración de Tiempo
- Sistema de autenticación con Supabase
- Multi-tenancy con workspaces y clínicas
- UI estilo Apple con Tailwind CSS + shadcn/ui
- Tests unitarios con Vitest

### 🎨 UI/UX
- Sistema de diseño modular y reutilizable
- Componentes base: DataTable, FormModal, PageHeader, etc.
- Modo oscuro (primera versión)
- Responsive design mobile-first

### 🔒 Seguridad
- Row Level Security (RLS) en Supabase
- Políticas de acceso multi-tenant
- Triggers automáticos para datos iniciales

---

## Tipos de Cambios

- **✨ Agregado** - Nueva funcionalidad
- **🔧 Mejorado** - Mejora de funcionalidad existente
- **🐛 Corregido** - Bug fix
- **🗑️ Eliminado** - Funcionalidad removida
- **🔒 Seguridad** - Vulnerabilidad corregida
- **🎨 UI/UX** - Cambios visuales o de experiencia
- **⚡ Performance** - Mejoras de rendimiento
- **📚 Documentación** - Solo cambios en docs

---

## Versionamiento

Este proyecto usa [Semantic Versioning](https://semver.org/):
- **MAJOR** (X.0.0): Cambios incompatibles con versiones anteriores
- **MINOR** (0.X.0): Nueva funcionalidad compatible con versiones anteriores
- **PATCH** (0.0.X): Correcciones de bugs compatibles

La versión actual se sincroniza automáticamente con `package.json`.
