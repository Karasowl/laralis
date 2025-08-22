# Módulo de Gastos (Expenses)

## 🎯 Objetivo

El módulo de gastos registra **gastos reales y variables** que ocurren día a día, diferenciándose de los costos fijos que son planificados. Su función principal es:

- Registrar compras y gastos cuando suceden
- Integrar automáticamente con otros módulos del sistema
- Proporcionar datos reales para reportes P&L
- Controlar inventario y activos automáticamente

## 🔄 Diferencia: Costos Fijos vs Gastos

### **Costos Fijos** (ya implementados)
- **Planificados y constantes** cada mes
- Configuración inicial del negocio (renta, luz, agua)
- Se usan para calcular **costo por minuto** y **tarifas**
- Son parte de la configuración base

### **Gastos (Expenses)** 
- **Reales y variables** que ocurren día a día
- Compras de insumos, mantenimiento, gastos imprevistos
- Se registran **cuando suceden**, no se planifican
- Sirven para **reportes P&L** y análisis financiero real

## 🔗 Integración con Otros Módulos

### 1. **Gastos → Assets (Depreciación)**
```
Compro sillón $50,000 
↓
• Crea registro en `assets` (nuevo equipo)
• Crea registro en `expenses` (para control contable)
• Se actualiza automáticamente `depreciación mensual`
• Se recalculan automáticamente `costos fijos`
• Se recalculan automáticamente `tarifas`
```

### 2. **Gastos → Supplies (Inventario)**
```
Compro 10 cajas de guantes $1,500
↓
• Crea registro en `expenses` (gasto real)
• Actualiza `supplies.stock_quantity` (+1000 guantes)
• Actualiza `supplies.last_purchase_price_cents`
• Actualiza `supplies.last_purchase_date`
```

### 3. **Gastos → Fixed Costs (Comparación)**
```
Pago renta $3,000
↓
• Crea registro en `expenses` (gasto real)
• Compara vs `fixed_costs.monthly_amount_cents` planificado
• Genera alerta si hay variación significativa
```

## 🗄️ Estructura de Base de Datos

### Tabla `expenses` (existente)
```sql
CREATE TABLE expenses (
    id UUID PRIMARY KEY,
    clinic_id UUID NOT NULL,
    
    -- Información básica del gasto
    expense_date DATE NOT NULL,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    description TEXT,
    amount_cents INTEGER NOT NULL,
    
    -- Información del proveedor
    vendor VARCHAR(255),
    invoice_number VARCHAR(100),
    
    -- Configuración
    is_recurring BOOLEAN DEFAULT false,
    
    -- Integración automática (nuevos campos)
    related_asset_id UUID REFERENCES assets(id),
    related_supply_id UUID REFERENCES supplies(id),
    quantity INTEGER,
    auto_processed BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Campos adicionales en `supplies` (necesarios)
```sql
ALTER TABLE supplies ADD COLUMN IF NOT EXISTS:
    stock_quantity INTEGER DEFAULT 0,
    min_stock_alert INTEGER DEFAULT 10,
    last_purchase_price_cents INTEGER,
    last_purchase_date DATE
```

## 📋 Categorías de Gastos

### **Categorías Principales**
1. **Equipos** → Se integra con `assets`
2. **Insumos** → Se integra con `supplies` 
3. **Servicios** → Gastos operativos (luz, agua, internet)
4. **Mantenimiento** → Reparaciones y mantenimiento
5. **Marketing** → Publicidad y promoción
6. **Administrativos** → Gastos de oficina
7. **Personal** → Nómina y beneficios
8. **Otros** → Gastos varios

### **Subcategorías Inteligentes**
- **Equipos**: Dental, Mobiliario, Tecnología, Herramientas
- **Insumos**: Anestesia, Materiales, Limpieza, Protección
- **Servicios**: Electricidad, Agua, Internet, Teléfono, Gas

## 🎯 Flujos de Trabajo

### **Escenario 1: Compra de Equipos**
1. Usuario registra gasto en categoría "Equipos"
2. Sistema pregunta: "¿Añadir a Assets para depreciación?"
3. Si acepta → Crea asset automáticamente con datos del gasto
4. Recalcula toda la cadena: depreciación → costos fijos → tarifas
5. Notifica cambios en tarifas a usuarios

### **Escenario 2: Compra de Insumos**
1. Usuario registra gasto en categoría "Insumos"
2. Sistema muestra insumos existentes: "¿Qué insumo compraste?"
3. Usuario selecciona insumo existente o crea nuevo
4. Sistema actualiza automáticamente:
   - `stock_quantity` += cantidad comprada
   - `last_purchase_price_cents` = precio unitario
   - `last_purchase_date` = fecha del gasto

### **Escenario 3: Gastos Operativos**
1. Usuario registra gasto (luz, agua, etc.)
2. Sistema compara vs costo fijo planificado
3. Si hay variación >20% → Genera alerta
4. Sugiere actualizar costo fijo si es tendencia

## 🎨 UI/UX del Módulo

### **Formulario de Registro**
```
┌─ Nuevo Gasto ─────────────────┐
│ Fecha: [22/08/2025]          │
│ Categoría: [Insumos ▼]       │
│ Subcategoría: [Anestesia ▼]  │
│ Descripción: [___________]    │
│ Monto: $[_____]              │
│ Proveedor: [___________]      │
│ Factura: [___________]        │
│                              │
│ 🔗 Integración Automática    │
│ □ Actualizar inventario      │
│ □ Crear nuevo asset          │
│                              │
│ [Cancelar] [Guardar]         │
└──────────────────────────────┘
```

### **Lista de Gastos**
```
📊 Gastos - Agosto 2025                    [+ Nuevo Gasto]

🔍 Filtros: [Categoría ▼] [Fecha ▼] [Proveedor ▼]

Fecha      Categoría    Descripción           Monto    Estado
22/08/25   Insumos     Guantes nitrilo       $1,500   🔗 Integrado
21/08/25   Equipos     Sillón dental         $50,000  🔗 Asset creado
20/08/25   Servicios   Electricidad CFE      $2,800   ⚠️ +20% vs plan
19/08/25   Insumos     Anestesia lidocaína   $800     🔗 Integrado
```

### **Dashboard de Gastos**
```
📈 Resumen Agosto 2025

Total Gastos: $54,100
   🏗️ Equipos: $50,000 (92%)
   🧴 Insumos: $2,300 (4%) 
   ⚡ Servicios: $1,800 (3%)

vs Costos Fijos Planificados:
   ✅ Dentro del rango: $18,545
   ⚠️ Variaciones: $2,800 (+15%)
   
🔔 Alertas:
   • Stock bajo: Gasas (5 unidades)
   • Precio cambió: Anestesia (+$50)
```

## 🔔 Sistema de Alertas

### **Alertas de Inventario**
- Stock bajo cuando `stock_quantity < min_stock_alert`
- Cambios significativos en precios (>10%)
- Insumos sin stock para servicios programados

### **Alertas Financieras**
- Gastos que exceden costos fijos planificados >20%
- Gastos recurrentes sin registrar en costos fijos
- Presupuesto mensual excedido

## 🔄 Integración con Tratamientos

### **Descuento Automático de Inventario**
```sql
-- Al registrar tratamiento
UPDATE supplies 
SET stock_quantity = stock_quantity - cantidad_usada
WHERE id IN (insumos_del_servicio)
```

### **Ajustes en Tratamientos**
```
Tratamiento: Limpieza Dental

┌─ Insumos Estándar ✅ (auto-calculados)
│  • Guantes: 2 pares ✅
│  • Gasas: 5 unidades ✅  
│  • Cepillo: 1 unidad ✅
│
└─ ⚙️ Ajustes (desplegable)
   • ➕ Insumos extra: [Añadir]
   • ➖ Insumos no usados: [Quitar]
   • ⏱️ Tiempo real: 45 min (vs 60 estimado)
```

## 📊 Reportes Relacionados

### **Reporte P&L Mejorado**
```
Estado de Resultados - Agosto 2025

INGRESOS
Tratamientos realizados:        $45,600

GASTOS
Gastos variables reales:        $4,100
  - Insumos utilizados:         $2,300
  - Otros gastos:              $1,800

Costos fijos:                   $18,545
  - Depreciación:              $1,861
  - Operativos:                $16,684

UTILIDAD NETA:                  $22,955
```

### **Análisis de Variaciones**
```
Análisis vs Planificado

GASTOS PLANIFICADOS vs REALES
Insumos:     $2,000 → $2,300 (+15%)
Servicios:   $1,500 → $1,800 (+20%) ⚠️
Equipos:     $0     → $50,000 (no planificado)

EFICIENCIA DE INVENTARIO
Gasas:       Planificado 100, Real 95 (5% ahorro)
Anestesia:   Planificado 20, Real 25 (25% exceso) ⚠️
```

## 🚀 Fases de Implementación

### **Fase 1: Core (2-3 horas)**
- ✅ Estructura de BD ya existe
- Crear API CRUD básica
- Formulario de registro simple
- Lista con filtros básicos

### **Fase 2: Integración (3-4 horas)**
- Integración con supplies (inventario)
- Integración con assets (equipos)
- Sistema de categorías inteligentes
- Alertas básicas

### **Fase 3: Automatización (2-3 horas)**
- Descuento automático en tratamientos
- Comparación vs costos fijos
- Reportes P&L integrados
- Dashboard de gastos

## 🔗 Referencias a Otros Módulos

- **Ver**: `03-depreciation.md` para integración con assets
- **Ver**: `04-fixed-costs.md` para comparación planificado vs real  
- **Ver**: `11-supplies.md` para gestión de inventario
- **Ver**: `08-treatments.md` para descuento automático
- **Ver**: `15-analytics.md` para reportes financieros