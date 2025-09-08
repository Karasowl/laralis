# Documentación Modular - Laralis Dental Manager

Esta carpeta contiene la documentación organizada por módulos del sistema dental. Cada archivo describe un componente específico y sus integraciones.

## 📁 Estructura de Módulos

### 🏗️ **Core System**
- `01-architecture.md` - Arquitectura general y flujo de datos
- `02-multi-tenancy.md` - Workspaces, clínicas, usuarios

### 💰 **Financial System** 
- `03-depreciation.md` - Assets y depreciación
- `04-fixed-costs.md` - Costos fijos planificados  
- ✅ `05-expenses.md` - Gastos reales e integración
- `06-financial-reports.md` - P&L, dashboard, punto de equilibrio

### 🦷 **Clinical Operations**
- `07-patients.md` - Gestión de pacientes
- `08-treatments.md` - Registro de tratamientos y snapshots
- `09-clinical-history.md` - Historial clínico y odontograma
- `10-appointments.md` - Agenda y citas

### 🛠️ **Resource Management**
- `11-supplies.md` - Insumos e inventario
- `12-services.md` - Servicios y recetas
- `13-tariffs.md` - Cálculo de tarifas y precios

### 📊 **Business Intelligence**
- `14-marketing.md` - Campañas y fuentes de pacientes
- `15-analytics.md` - Reportes y métricas
- `16-integrations.md` - Conexiones entre módulos

## 🔗 Flujo de Lectura Recomendado

### Para **Desarrolladores**:
1. `01-architecture.md` - Entender la base
2. `02-multi-tenancy.md` - Sistema de usuarios
3. Módulos específicos según feature a implementar

### Para **Entender Finanzas**:
1. `03-depreciation.md` - Base del sistema
2. `04-fixed-costs.md` - Costos planificados
3. `05-expenses.md` - Gastos reales
4. `06-financial-reports.md` - Reportes finales

### Para **Operación Clínica**:
1. `07-patients.md` - Gestión de pacientes
2. `11-supplies.md` - Insumos
3. `12-services.md` - Servicios
4. `08-treatments.md` - Registro diario

## 📊 Estado de Documentación

- ✅ **Completado**: `05-expenses.md`
- 🚧 **En progreso**: -
- ⏳ **Pendiente**: Todos los demás

## 🎯 Convenciones

Cada módulo incluye:
- **Objetivo** - Para qué sirve
- **Integración** - Cómo se conecta con otros módulos
- **Estructura BD** - Tablas y campos
- **UI/UX** - Interfaces y flujos
- **Implementación** - Fases y estimaciones
- **Referencias** - Links a módulos relacionados

## 📝 Contribuir

Al crear o editar módulos:
1. Seguir la estructura estándar
2. Incluir ejemplos prácticos
3. Documentar todas las integraciones
4. Actualizar este README