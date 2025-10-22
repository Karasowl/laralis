# Dashboard Redesign 2025 - Laralis Dental Manager

**Fecha**: 2025-10-20
**Versión**: 1.0
**Estado**: Propuesta de Diseño

---

## 🎯 Objetivos del Rediseño

El dashboard actual tiene problemas críticos de UX/UI que necesitan resolverse:

### Problemas Identificados

1. **Métricas Repetidas** entre tabs "Resumen" y "Avanzado"
2. **Rentabilidad Desconectada** - No muestra datos reales
3. **Marketing Mal Diseñado** - Parece formulario de registro en lugar de dashboard analítico
4. **Desglose por Día Horrible** - Lista infinita con scroll, no escaneable visualmente
5. **Predicciones Sin Contexto** - "Baja confianza 41%" sin explicar por qué ni sugerir acciones
6. **Falta de Jerarquía Visual** - Todo tiene el mismo peso, no hay guía clara

### Objetivos del Nuevo Diseño

- ✅ **Útil**: Métricas accionables que guían decisiones de negocio
- ✅ **Hermoso**: Diseño Apple-like con jerarquía visual clara
- ✅ **Funcional**: Totalmente conectado a datos reales del sistema
- ✅ **Fácil de Entender**: Sin jerga, con contexto y explicaciones
- ✅ **Profundo**: Drill-down en cada métrica importante
- ✅ **Guía y Dirección**: Sugerencias inteligentes basadas en datos

---

## 📊 Arquitectura de Datos Disponibles

### APIs Ya Implementadas (22 endpoints)

#### Dashboard Core (10 endpoints)
- `/api/dashboard/revenue` - Ingresos con comparación de período
- `/api/dashboard/expenses` - Gastos con comparación
- `/api/dashboard/patients` - Total + nuevos en período
- `/api/dashboard/treatments` - Desglose por estado
- `/api/dashboard/supplies` - Inventario + alertas
- `/api/dashboard/appointments` - Citas (mock actualmente)
- `/api/dashboard/charts/revenue` - Gráfico con 4 granularidades
- `/api/dashboard/charts/categories` - Breakdown por categoría
- `/api/dashboard/charts/services` - Análisis por servicio
- `/api/dashboard/activities` - Timeline de últimas 10 acciones

#### Analytics & Reports (7 endpoints)
- `/api/reports/summary` - KPIs + insights de negocio
- `/api/analytics/service-roi` - ROI por servicio
- `/api/equilibrium/*` - 3 endpoints de punto de equilibrio

### Datos Disponibles Pero NO Aprovechados

- ❌ Depreciación de activos (se suma pero no se visualiza)
- ❌ Costo variable por servicio individual
- ❌ Margen por tratamiento
- ❌ Lifetime Value (LTV) por paciente (se calcula pero no se muestra bien)
- ❌ Tasa de retención (se calcula pero no se visualiza)
- ❌ Capacidad de utilización (se calcula en analytics.ts)
- ❌ Servicios en declive (se detectan pero no se alertan)
- ❌ Oportunidades de crecimiento (se calculan pero no se destacan)

---

## 🎨 Nuevo Diseño - Estructura por Tabs

### Tab 1️⃣: **Resumen** (Overview)

**Objetivo**: Vista rápida del estado del negocio HOY con accionables inmediatos

#### Sección A: Hero Metric (Top Priority)
```
┌─────────────────────────────────────────────────────────────────┐
│ 🎯 Meta Mensual: Progreso hacia el Punto de Equilibrio         │
│                                                                 │
│ $45,000 / $75,000 MXN  (60%)  [Progreso Visual: Barra Gruesa]  │
│                                                                 │
│ 📊 En camino  •  Necesitas ~8 pacientes más esta semana        │
│ 💡 Sugerencia: Enfócate en "Servicio X" (margen más alto)      │
└─────────────────────────────────────────────────────────────────┘
```

**Status Inteligente**:
- 🟢 **En camino** (progreso ≥ tiempo transcurrido)
- 🟡 **Alerta** (progreso < tiempo - 10%)
- 🔴 **Crítico** (progreso < tiempo - 20%)

#### Sección B: Métricas Clave (4 Cards)
```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ 💰 Ingresos  │ 💸 Gastos    │ 👥 Pacientes │ 🦷 Tratam.   │
│ $12,450      │ $8,200       │ 42 activos   │ 18 este mes  │
│ +12% ↑       │ +5% ↑        │ +3 nuevos    │ 15 completos │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

#### Sección C: Métricas de Negocio (Grid 2x2)
```
┌─────────────────────────────┬─────────────────────────────┐
│ 📈 Ticket Promedio          │ 👤 Pacientes por Día Actual │
│ $692 MXN                    │ 0.8 pacientes/día           │
│ (últimos 30 tratamientos)   │ (basado en 18 días hábiles) │
├─────────────────────────────┼─────────────────────────────┤
│ 🎯 Pacientes Necesarios Hoy │ 💵 Ingresos Hoy             │
│ 2 pacientes                 │ $1,250 MXN                  │
│ Para mantenerte en meta     │ De 2 tratamientos           │
└─────────────────────────────┴─────────────────────────────┘
```

**Nota**: NO incluir margen ni LTV aquí (van en "Rentabilidad")

#### Sección D: Alertas y Acciones Rápidas
```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Alertas Importantes                                       │
│ • 3 insumos con stock bajo → [Ver Insumos]                  │
│ • "Servicio Y" en declive (−30% últimos 30 días)            │
│ • Capacidad al 45% (puedes atender 4 pacientes más/día)     │
└─────────────────────────────────────────────────────────────┘
```

#### Sección E: Gráficos Principales (CRÍTICO)
```
┌──────────────────────────┬──────────────────────────────────┐
│ 📈 Ingresos vs Gastos    │ 📊 Distribución por Servicio     │
│ (Últimos 30 días)        │ (Este mes)                       │
│                          │                                  │
│ [AREA CHART GRANDE]      │ [DONUT CHART MEDIANO]            │
│ • Ingresos (verde)       │ • Limpieza: 35%                  │
│ • Gastos (rojo)          │ • Ortodoncia: 25%                │
│ • Tendencia visible      │ • Corona: 20%                    │
│                          │ • Otros: 20%                     │
│ Controles:               │                                  │
│ [7d] [30d] [90d] [12m]   │ vs mes anterior: +5% ↑           │
└──────────────────────────┴──────────────────────────────────┘
```

**CRÍTICO**: Sin el gráfico de tendencia histórica, las métricas NO tienen contexto.

#### Sección F: Actividad Reciente (Compacta)
```
┌─────────────────────────────────────────────────────────────┐
│ 📋 Actividad Reciente (últimas 5 acciones)                  │
│                                                             │
│ • Tratamiento completado - Paciente Juan P. - $850 - 10:30 │
│ • Nuevo paciente registrado - María G. - 09:15             │
│ • Gasto registrado - Insumos - $320 - 08:00                │
│ ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

**INCLUYE**:
- ✅ RevenueChart (Ingresos vs Gastos) - Grande, destacado
- ✅ CategoryBreakdown (Donut Chart) - Mediano, al lado
- ✅ Hero metric + 4 cards + métricas de negocio
- ✅ Alertas y actividad reciente (compacto)

**NO INCLUIR**:
- ❌ Predicciones (van en "Avanzado")
- ❌ ROI detallado por servicio (va en "Rentabilidad")
- ❌ Comparación multi-período (va en "Avanzado")

---

### Tab 2️⃣: **Rentabilidad** (Profitability)

**Objetivo**: Análisis profundo de qué servicios generan más ganancias

#### Problema Actual
```
❌ "No hay tratamientos completados para analizar"
```
**Este mensaje es FALSO** - Hay datos en el sistema pero no se muestran.

#### Nuevo Diseño

##### Sección A: Resumen Financiero (Top Cards)
```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ 💰 Margen    │ 📊 ROI Prom. │ 💎 Servicio  │ 📉 Mayor     │
│  Promedio    │  General     │  Estrella    │  Costo       │
│              │              │              │              │
│  60.5%       │  185%        │ Limpieza     │ Ortodoncia   │
│  (últimos    │  (ingresos/  │ $450/hora    │ $1,200 costo │
│   30 días)   │   costos)    │ ROI 320%     │ variable     │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

##### Sección B: Matriz de Servicios (Service ROI Matrix)

**Tabla Mejorada** con clasificación visual:

```
┌───────────────────────────────────────────────────────────────────┐
│ Análisis de Rentabilidad por Servicio                            │
│ (Basado en tratamientos completados últimos 90 días)             │
├──────────┬────────┬─────────┬────────┬─────────┬─────────┬──────┤
│ Servicio │ Ventas │ Ingresos│ Margen │ $/Hora  │ ROI %   │ Cat. │
├──────────┼────────┼─────────┼────────┼─────────┼─────────┼──────┤
│ Limpieza │   12   │ $10,800 │  68%   │ $450    │  320%   │ ⭐ E │
│ Corona   │    5   │  $8,500 │  55%   │ $380    │  180%   │ 💎 G │
│ Blanque. │   15   │  $4,500 │  75%   │ $225    │  400%   │ 📦 V │
│ Ortodo.  │    2   │  $6,000 │  30%   │ $120    │   80%   │ 🔍 R │
└──────────┴────────┴─────────┴────────┴─────────┴─────────┴──────┘

Categorías:
⭐ Estrella (E): Alto ROI + Alta frecuencia → Promocionar
💎 Gema (G): Alto margen + Baja frecuencia → Aumentar marketing
📦 Volumen (V): Bajo margen + Alta frecuencia → Optimizar costos
🔍 Revisar (R): Bajo ROI → Analizar si vale la pena ofrecer
```

**Interactividad**: Click en servicio → Drill-down con:
- Histórico de últimos 12 meses
- Desglose de costos (fijos vs variables)
- Comparación con servicios similares
- Sugerencias de optimización

##### Sección C: Oportunidades de Crecimiento
```
┌─────────────────────────────────────────────────────────────┐
│ 💡 Oportunidades Detectadas                                 │
│                                                             │
│ 1. "Blanqueamiento" tiene alto ROI pero pocas ventas       │
│    → Potencial: +$3,600/mes con 5 clientes más             │
│                                                             │
│ 2. "Corona" tiene buen margen, promocionar más             │
│    → Potencial: +$2,500/mes con 3 clientes más             │
│                                                             │
│ 3. "Ortodoncia" tiene ROI bajo (80%)                        │
│    → Revisar costos o aumentar precio en 15%               │
└─────────────────────────────────────────────────────────────┘
```

##### Sección D: Gráficos de Tendencias Históricas
```
┌──────────────────────────┬──────────────────────────────────┐
│ 📈 Evolución de Margen   │ ⚖️ Comparar Servicios           │
│ (Top 5 servicios)        │ (Seleccionar 2)                  │
│                          │                                  │
│ [LINE CHART 6 meses]     │ [BAR CHART comparativo]          │
│ • Limpieza: 68% → 70%    │ Servicio A  vs  Servicio B       │
│ • Corona: 55% → 58%      │ ROI:    320%  vs  180%           │
│ • Blanqueamiento: 75%    │ Margen:  68%  vs   55%           │
│ • Ortodoncia: 30% → 28%  │ Frec.:    12  vs    5            │
│ • Extracción: 65%        │ Ing.:  $10.8k vs  $8.5k          │
│                          │                                  │
│ 💡 "Ortodoncia" baja     │ [Selector de servicios]          │
│    -6.7% en margen       │                                  │
└──────────────────────────┴──────────────────────────────────┘
```

**Componentes NUEVOS a crear**:
- `ProfitTrendsChart.tsx` - Evolución histórica de margen
- `ServiceComparison.tsx` - Comparación head-to-head de 2 servicios

---

### Tab 3️⃣: **Avanzado** (Advanced Analytics)

**Objetivo**: Análisis profundo con predicciones y métricas avanzadas

#### Problema Actual
```
❌ Repite las mismas métricas que "Resumen"
❌ No aporta valor adicional
```

#### Nuevo Diseño

##### Sección A: Predicciones Inteligentes
```
┌─────────────────────────────────────────────────────────────┐
│ 🔮 Predicciones de Ingresos                                 │
│                                                             │
│ Próximo Mes: $18,500 MXN (confianza: 65%)                  │
│ Rango esperado: $15,700 - $21,300                          │
│ Tendencia: ↗️ Creciendo                                     │
│                                                             │
│ 💡 Por qué 65% confianza:                                   │
│   • Tienes 18 tratamientos completados (necesitas 20+ para │
│     predicciones más precisas)                             │
│   • Datos de solo 2 meses (mejor con 6+ meses)             │
│                                                             │
│ 📈 Próximo Trimestre: $55,000 MXN (confianza: 60%)         │
│ 📊 Fin de Año: $220,000 MXN (confianza: 55%)               │
└─────────────────────────────────────────────────────────────┘
```

##### Sección B: Desglose Temporal REDISEÑADO
**Problema**: Lista infinita de 30 días con scroll ❌

**Solución**: Gráfico + Tabla compacta con agrupación inteligente

```
┌─────────────────────────────────────────────────────────────┐
│ 📅 Análisis por Período                                     │
│                                                             │
│ [Tabs: Día | Semana | Quincena | Mes]  [Seleccionado: Día] │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [Gráfico de barras - Últimos 7 días + promedio]        │ │
│ │                                                         │ │
│ │  Ingresos  █████████ $2,100                             │ │
│ │            ████████ $1,800                              │ │
│ │            ██████ $1,200                                │ │
│ │  Promedio: $1,700/día  •  Meta: $2,500/día              │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Últimos 7 días (expandible para ver más):                  │
│ ┌──────┬───────────┬──────────┬────────────┬──────────┐    │
│ │ Día  │ Ingresos  │ Pacientes│ Tratamient.│ vs Meta  │    │
│ ├──────┼───────────┼──────────┼────────────┼──────────┤    │
│ │ Hoy  │ $2,100 ✅ │    3     │     3      │  -16%    │    │
│ │ Ayer │ $1,800    │    2     │     2      │  -28%    │    │
│ │ 18/10│ $1,200    │    2     │     2      │  -52%    │    │
│ │ ...  │           │          │            │          │    │
│ └──────┴───────────┴──────────┴────────────┴──────────┘    │
│                                                             │
│ [Botón: Ver mes completo →]                                │
└─────────────────────────────────────────────────────────────┘
```

**Mejoras**:
- ✅ Solo 7 días visibles inicialmente (no 30)
- ✅ Gráfico para vista rápida
- ✅ Tabla compacta con lo esencial
- ✅ Botón para expandir si necesitan ver más
- ✅ Comparación vs meta claramente visible

##### Sección C: Análisis de Pacientes
```
┌─────────────────────────────────────────────────────────────┐
│ 👥 Análisis de Pacientes                                    │
│                                                             │
│ ┌──────────────┬──────────────┬──────────────┐             │
│ │ 💰 Valor de  │ 🔄 Tasa de   │ 🆕 Adquisic. │             │
│ │    Vida      │   Retención  │    Mensual   │             │
│ │              │              │              │             │
│ │ $2,450       │    62%       │  4 pacientes │             │
│ │ promedio     │ (26 de 42    │  este mes    │             │
│ │              │  regresan)   │              │             │
│ └──────────────┴──────────────┴──────────────┘             │
│                                                             │
│ 💡 Insight: 38% de pacientes no regresan                    │
│    Sugerencia: Implementar programa de seguimiento         │
└─────────────────────────────────────────────────────────────┘
```

##### Sección D: Uso de Capacidad
```
┌─────────────────────────────────────────────────────────────┐
│ ⏱️ Utilización de Capacidad                                 │
│                                                             │
│ Horas trabajadas: 120 hrs / 160 hrs disponibles = 75%      │
│                                                             │
│ [Barra de progreso visual con segmentos]                   │
│ ████████████████░░░░░░░░                                    │
│ Utilizado      Disponible (40 hrs = 5 días más)            │
│                                                             │
│ 💡 Podrías atender ~10 pacientes más este mes               │
└─────────────────────────────────────────────────────────────┘
```

##### Sección E: Gráficos Históricos Profundos
```
┌─────────────────────────────────────────────────────────────┐
│ 📊 Comparación de Períodos (Actual vs Anterior)             │
│                                                             │
│ [BAR CHART AGRUPADO]                                        │
│ Granularidad: [Día] [Semana] [Mes] [Trimestre]             │
│                                                             │
│ Semana 1: $12,500 (actual) vs $11,200 (anterior) +11.6% ✅  │
│ Semana 2: $10,800 (actual) vs $12,000 (anterior) -10.0% ⚠️  │
│ Semana 3: $13,200 (actual) vs $11,800 (anterior) +11.9% ✅  │
│ ...                                                         │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────┬──────────────────────────────────┐
│ 📈 Ingresos vs Gastos    │ 📉 Tendencias por Servicio       │
│ (Versión Avanzada)       │ (Últimos 12 meses)               │
│                          │                                  │
│ [AREA CHART con zoom]    │ [LINE CHART multi-series]        │
│ • Más granularidades     │ • Ingresos de cada servicio      │
│ • Más series (Utilidad)  │ • Selector de servicios          │
│ • Anotaciones eventos    │ • Identifica declives            │
│ • Zoom interactivo       │                                  │
└──────────────────────────┴──────────────────────────────────┘

┌──────────────────────────┬──────────────────────────────────┐
│ 👥 Adquisición Pacientes │ 💸 Desglose de Gastos            │
│ (Nuevos vs Recurrentes)  │ (Por categoría)                  │
│                          │                                  │
│ [STACKED AREA 12 meses]  │ [STACKED BAR 6 meses]            │
│ • Verde: Nuevos          │ • Insumos: $8,200                │
│ • Azul: Recurrentes      │ • Salarios: $15,000              │
│ • Línea: % retención     │ • Renta: $5,000                  │
│                          │ • Servicios: $2,800              │
└──────────────────────────┴──────────────────────────────────┘
```

**Componentes NUEVOS a crear**:
- `ServiceTrendsChart.tsx` - Tendencias de ingresos por servicio
- `PatientAcquisitionChart.tsx` - Nuevos vs Recurrentes histórico
- `ExpenseBreakdownChart.tsx` - Gastos por categoría histórico

**Componentes EXISTENTES que se mueven aquí**:
- `PeriodBreakdown.tsx` - YA existe, mover de "Resumen" a "Avanzado"
- `RevenueChart.tsx` - Versión avanzada con más opciones

---

### Tab 4️⃣: **Marketing** (Marketing Analytics)

**Problema Actual**:
```
❌ Diseñado como FORMULARIO para registrar campañas
❌ Los gastos de marketing deberían ir en "Gastos"
❌ No aprovecha datos que YA existen en el sistema
```

#### Nuevo Diseño: Dashboard Analítico

**Objetivo**: Vista estratégica de TODAS las métricas de marketing calculadas automáticamente

##### Sección A: Métricas Clave de Marketing
```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ 💰 CAC       │ 💎 LTV       │ 📊 LTV/CAC   │ 🎯 Conversión│
│ (Costo Adq.  │ (Valor Vida) │  Ratio       │   Estimada   │
│  Cliente)    │              │              │              │
│              │              │              │              │
│ $250 MXN     │ $2,450 MXN   │   9.8x       │    12%       │
│              │              │              │              │
│ 💡 Excelente │ Alto valor   │ Muy saludable│ (4 de 33     │
│ (< $500)     │ por paciente │ (ideal > 3x) │  leads conv.)│
└──────────────┴──────────────┴──────────────┴──────────────┘
```

**Cálculos**:
- **CAC**: Gastos Marketing últimos 90 días / Nuevos Pacientes
- **LTV**: Promedio ingresos por paciente * tasa retención * meses esperados
- **Conversión**: Nuevos pacientes / Consultas iniciales (si se trackea)

##### Sección B: ROI por Fuente de Pacientes
```
┌─────────────────────────────────────────────────────────────┐
│ 📈 Retorno de Inversión por Canal                           │
│                                                             │
│ ┌───────────┬──────────┬───────────┬─────────┬──────────┐  │
│ │ Canal     │ Pacientes│ Gasto     │ Ingresos│ ROI %    │  │
│ ├───────────┼──────────┼───────────┼─────────┼──────────┤  │
│ │ Redes Soc.│    8     │  $1,200   │ $19,600 │ 1,533%   │  │
│ │ Referidos │   12     │     $0    │ $29,400 │    ∞     │  │
│ │ Google Ads│    3     │  $2,500   │  $7,350 │   194%   │  │
│ │ Directo   │   18     │     $0    │ $44,100 │    ∞     │  │
│ └───────────┴──────────┴───────────┴─────────┴──────────┘  │
│                                                             │
│ 💡 Insight: "Referidos" y "Directo" son tus mejores canales│
│    Considera incentivos para aumentar referidos            │
└─────────────────────────────────────────────────────────────┘
```

**Nota**: Usar campo `source` de tabla `patients` (ya existe en schema)

##### Sección C: Gráficos de Tendencias de Marketing
```
┌─────────────────────────────────────────────────────────────┐
│ 📊 Evolución de Adquisición de Pacientes                    │
│                                                             │
│ [LINE CHART - Últimos 12 meses]                            │
│ • Nuevos pacientes por mes                                 │
│ • Línea de tendencia (regresión lineal)                    │
│ • Proyección próximos 3 meses (punteada)                   │
│                                                             │
│ Tendencia: ↗️ +15% en últimos 3 meses                       │
│ Proyección próximo mes: ~6 pacientes                       │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────┬──────────────────────────────────┐
│ 📊 ROI por Canal         │ 💸 Evolución del CAC             │
│ (Con tendencias)         │ (Últimos 12 meses)               │
│                          │                                  │
│ [BAR CHART horizontal]   │ [LINE CHART con objetivo]        │
│ Redes Soc.: 1,533% 📈    │ CAC actual: $250 MXN ✅          │
│ Referidos:     ∞   📈    │ CAC objetivo: $500 MXN           │
│ Google Ads:  194%  →     │ Tendencia: Estable               │
│ Directo:       ∞   📈    │                                  │
│                          │ 💡 CAC muy por debajo de objetivo│
│ [Mini sparklines]        │    Considera aumentar inversión  │
└──────────────────────────┴──────────────────────────────────┘
```

**Componentes NUEVOS a crear**:
- `AcquisitionTrendsChart.tsx` - Nuevos pacientes + tendencia + proyección
- `ChannelROIChart.tsx` - ROI por canal con sparklines
- `CACTrendChart.tsx` - Evolución del CAC con objetivo

##### Sección D: Gastos de Marketing (Resumen)
```
┌─────────────────────────────────────────────────────────────┐
│ 💸 Inversión en Marketing                                   │
│                                                             │
│ Este mes: $3,200 MXN  (vs $2,800 mes anterior) +14%        │
│ Últimos 3 meses: $9,100 MXN                                │
│                                                             │
│ [Botón: Registrar gasto de marketing →]                    │
│ (Redirige a pestaña "Gastos" con categoría pre-selecciona.)│
└─────────────────────────────────────────────────────────────┘
```

**Nota**: NO es un formulario, solo muestra resumen y redirige a "Gastos"

##### Sección E: Recomendaciones de Marketing
```
┌─────────────────────────────────────────────────────────────┐
│ 💡 Recomendaciones Basadas en Datos                         │
│                                                             │
│ 1. 🎯 Tu CAC es bajo ($250) - Considera aumentar inversión │
│       en canales rentables (Redes Sociales: ROI 1,533%)    │
│                                                             │
│ 2. 🔄 Tasa de retención es 62% - Enfócate en retener       │
│       clientes existentes (aumentar LTV)                   │
│                                                             │
│ 3. ⭐ "Referidos" es tu mejor canal - Implementa programa  │
│       de incentivos (descuento 10% por referir)            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 Principios de Diseño Visual

### Jerarquía Clara

1. **Hero Metric** (más importante) - Grande, arriba, con color
2. **Métricas Clave** - Tamaño medio, grid
3. **Detalles** - Tablas, gráficos secundarios
4. **Acciones** - Botones destacados con CTA claro

### Paleta de Colores (Apple-like)

```css
/* Success / Positive */
--color-success: #10b981 (green-500)
--color-success-bg: #d1fae5 (green-100)

/* Warning */
--color-warning: #f59e0b (yellow-500)
--color-warning-bg: #fef3c7 (yellow-100)

/* Danger / Critical */
--color-danger: #ef4444 (red-500)
--color-danger-bg: #fee2e2 (red-100)

/* Info / Neutral */
--color-info: #3b82f6 (blue-500)
--color-info-bg: #dbeafe (blue-100)

/* Background */
--bg-card: white (dark: #1f2937)
--bg-elevated: #f9fafb (dark: #111827)

/* Spacing */
--spacing-section: 32px
--spacing-card: 24px
--radius: 16px
--shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1)
```

### Tipografía

```css
/* Headers */
--font-hero: 32px / 700
--font-section: 24px / 600
--font-card-title: 18px / 600

/* Body */
--font-metric: 28px / 700 (números grandes)
--font-body: 14px / 400
--font-caption: 12px / 400

/* Mono for numbers */
--font-mono: 'SF Mono', 'Monaco', monospace
```

### Iconos (Según ICONOGRAPHY.md)

- Dashboard: `LayoutDashboard`
- Métricas: `DollarSign`, `Users`, `Activity`, `Receipt`
- Tendencias: `ArrowUp`, `ArrowDown`, `TrendingUp`
- Acciones: `Plus`, `Edit`, `Trash2`, `RefreshCw`
- Estados: `CheckCircle`, `AlertTriangle`, `Info`

---

## 🔧 Implementación Técnica

### Estructura de Archivos Propuesta

```
web/app/page.tsx (Orquestador principal)
web/components/dashboard/
  ├── overview/
  │   ├── HeroMetric.tsx              (Punto de equilibrio hero)
  │   ├── KeyMetricsGrid.tsx          (4 cards principales)
  │   ├── BusinessMetricsGrid.tsx     (Ya existe, OK)
  │   ├── AlertsPanel.tsx             (Alertas mejorado)
  │   └── RecentActivityCompact.tsx   (Solo 5 items)
  │
  ├── profitability/
  │   ├── ProfitabilitySummary.tsx    (4 cards top)
  │   ├── ServiceROIMatrix.tsx        (Tabla mejorada con categorías)
  │   ├── GrowthOpportunities.tsx     (Oportunidades detectadas)
  │   └── ProfitTrendsChart.tsx       (Evolución de margen)
  │
  ├── advanced/
  │   ├── RevenuePredictions.tsx      (Con explicación de confianza)
  │   ├── PeriodAnalysis.tsx          (Gráfico + tabla compacta)
  │   ├── PatientAnalysis.tsx         (LTV, retención, adquisición)
  │   ├── CapacityUtilization.tsx     (Uso de tiempo)
  │   └── ComparativeCharts.tsx       (Ingresos vs gastos, categorías)
  │
  └── marketing/
      ├── MarketingMetrics.tsx        (CAC, LTV, Ratio, Conversión)
      ├── ChannelROI.tsx              (Tabla de ROI por canal)
      ├── AcquisitionTrends.tsx       (Gráfico evolución pacientes)
      ├── MarketingSpend.tsx          (Resumen de inversión)
      └── MarketingRecommendations.tsx (Sugerencias basadas en datos)
```

### APIs Nuevas Necesarias

```typescript
// Nuevas APIs a crear

1. /api/marketing/metrics
   GET { clinicId, period }
   → { cac, ltv, ltvCacRatio, conversionRate }

2. /api/marketing/channel-roi
   GET { clinicId, period }
   → [{ channel, patients, spend, revenue, roi }]

3. /api/analytics/patient-insights  (mejorar el existente)
   GET { clinicId }
   → { ltv, retentionRate, acquisitionRate, churnRate }

4. /api/profitability/trends
   GET { clinicId, months }
   → [{ service_id, month, margin_pct, revenue }]
```

### Hooks Necesarios

```typescript
// Nuevos hooks a crear

1. hooks/use-marketing-metrics.ts
   - useMemo para cálculos derivados
   - useApi para fetch paralelo

2. hooks/use-profitability.ts
   - Extiende useServiceROI existente
   - Agrega cálculo de oportunidades

3. hooks/use-patient-insights.ts
   - LTV, retención, churn
   - Usa datos de treatments + patients
```

---

## 📊 Resumen de Componentes y Gráficos

### Componentes EXISTENTES (Mantenidos)

| Componente | Ubicación Actual | Nueva Ubicación | Cambios |
|------------|------------------|-----------------|---------|
| `RevenueChart.tsx` | Tab Resumen | Tab Resumen + Avanzado | Versión simple + avanzada |
| `CategoryBreakdown.tsx` | Tab Resumen | Tab Resumen | Agregar comparación vs anterior |
| `ServiceROIAnalysis.tsx` | Tab Rentabilidad | Tab Rentabilidad | Agregar drill-down histórico |
| `DateFilterBar.tsx` | Tab Resumen | TODOS los tabs | Sticky header |
| `PeriodBreakdown.tsx` | Tab Resumen | Tab Avanzado | Mejorar visualización |
| `BreakEvenProgress.tsx` | Tab Resumen | Tab Resumen | Mantener como hero metric |
| `BusinessMetricsGrid.tsx` | Tab Resumen | Tab Resumen | Sin cambios |
| `MetricCard.tsx` | Tab Resumen | Tab Resumen | Sin cambios |
| `RecentActivity.tsx` | Tab Resumen | Tab Resumen | Compactar a 5 items |

**Total componentes existentes**: 9
**Componentes eliminados**: 0 ✅

### Componentes NUEVOS (A crear)

#### Tab Rentabilidad
1. `ProfitTrendsChart.tsx` - Evolución histórica de margen por servicio (6 meses)
2. `ServiceComparison.tsx` - Comparación head-to-head de 2 servicios
3. `ProfitabilitySummary.tsx` - 4 cards de resumen financiero

#### Tab Avanzado
4. `ServiceTrendsChart.tsx` - Tendencias de ingresos por servicio (12 meses)
5. `PatientAcquisitionChart.tsx` - Nuevos vs Recurrentes histórico (12 meses)
6. `ExpenseBreakdownChart.tsx` - Gastos por categoría histórico (6 meses)
7. `PatientAnalysis.tsx` - LTV, retención, adquisición
8. `CapacityUtilization.tsx` - Uso de tiempo/capacidad

#### Tab Marketing
9. `AcquisitionTrendsChart.tsx` - Nuevos pacientes + tendencia + proyección (12 meses)
10. `ChannelROIChart.tsx` - ROI por canal con sparklines
11. `CACTrendChart.tsx` - Evolución del CAC con objetivo (12 meses)
12. `MarketingMetrics.tsx` - Cards de CAC, LTV, Ratio, Conversión
13. `MarketingRecommendations.tsx` - Sugerencias basadas en datos

**Total componentes nuevos**: 13
**Total componentes en dashboard**: 22

### Distribución de Gráficos por Tab

| Tab | Gráficos Históricos | Métricas | Total Elementos |
|-----|---------------------|----------|-----------------|
| **Resumen** | 2 (Revenue + Category) | 10 cards + 1 hero | ~13 |
| **Rentabilidad** | 2 (Profit Trends + Comparison) | 4 cards + 1 tabla | ~7 |
| **Avanzado** | 5 (Period + Revenue + Services + Patients + Expenses) | 8 métricas | ~13 |
| **Marketing** | 3 (Acquisition + Channel + CAC) | 4 cards | ~7 |
| **TOTAL** | **12 gráficos** | **27 métricas** | **40 elementos** |

---

## 📋 Acceptance Criteria

### Tab "Resumen"
- [ ] Hero metric de punto de equilibrio con status inteligente visible
- [ ] 4 metric cards con comparación de período
- [ ] Grid 2x2 de métricas de negocio (ticket, pacientes/día, necesarios, ingresos hoy)
- [ ] **RevenueChart (Ingresos vs Gastos) - GRANDE Y DESTACADO** ⭐
- [ ] **CategoryBreakdown (Donut Chart) - AL LADO** ⭐
- [ ] Panel de alertas con acciones (insumos, servicios en declive, capacidad)
- [ ] Actividad reciente compacta (solo 5 items)
- [ ] Controles de período (7d, 30d, 90d, 12m) visibles y fáciles de usar

### Tab "Rentabilidad"
- [ ] DEBE mostrar datos reales de tratamientos completados ⭐
- [ ] 4 cards de resumen financiero (margen, ROI, estrella, mayor costo)
- [ ] ServiceROIMatrix (tabla completa) con clasificación visual (⭐💎📦🔍) - MANTENER
- [ ] **ProfitTrendsChart (NUEVO)** - Evolución histórica de margen (6 meses) ⭐
- [ ] **ServiceComparison (NUEVO)** - Comparar 2 servicios head-to-head
- [ ] Panel de oportunidades de crecimiento basado en datos
- [ ] Click en servicio → drill-down con detalles históricos

### Tab "Avanzado"
- [ ] Predicciones con EXPLICACIÓN de por qué % de confianza
- [ ] **PeriodBreakdown** - Comparación actual vs anterior (mover aquí) ⭐
- [ ] **RevenueChart versión avanzada** - Con más opciones y granularidades ⭐
- [ ] **ServiceTrendsChart (NUEVO)** - Tendencias de ingresos por servicio (12 meses) ⭐
- [ ] **PatientAcquisitionChart (NUEVO)** - Nuevos vs Recurrentes (12 meses) ⭐
- [ ] **ExpenseBreakdownChart (NUEVO)** - Gastos por categoría (6 meses) ⭐
- [ ] Análisis de pacientes (LTV, retención, adquisición)
- [ ] Uso de capacidad con visualización clara
- [ ] NO lista infinita de 30 días con scroll ❌

### Tab "Marketing"
- [ ] NO es formulario de registro ❌
- [ ] MarketingMetrics - Cards de CAC, LTV, ratio LTV/CAC, conversión
- [ ] **AcquisitionTrendsChart (NUEVO)** - Nuevos pacientes + tendencia + proyección (12 meses) ⭐
- [ ] **ChannelROIChart (NUEVO)** - ROI por canal con sparklines ⭐
- [ ] **CACTrendChart (NUEVO)** - Evolución del CAC con objetivo (12 meses) ⭐
- [ ] Resumen de gastos con botón a "Gastos"
- [ ] MarketingRecommendations - Sugerencias inteligentes basadas en datos

### General
- [ ] `npm run dev` builds clean
- [ ] `npm test` green (si se agregan tests)
- [ ] Todas las strings via next-intl (en/es)
- [ ] Diseño responsive (móvil, tablet, desktop)
- [ ] Cumple estándares de CODING-STANDARDS.md (<400 líneas/archivo)
- [ ] Iconos según ICONOGRAPHY.md

---

## 🚀 Plan de Implementación

### Fase 1: Preparación (1 día)
1. Crear nuevas APIs necesarias
2. Actualizar hooks existentes
3. Agregar strings de i18n (en.json, es.json)

### Fase 2: Tab "Resumen" (1 día)
1. Crear componente HeroMetric
2. Refactorizar KeyMetricsGrid
3. Mejorar AlertsPanel
4. Compactar RecentActivity

### Fase 3: Tab "Rentabilidad" (1.5 días)
1. Crear ProfitabilitySummary
2. Mejorar ServiceROIMatrix con categorías
3. Implementar GrowthOpportunities
4. Agregar ProfitTrendsChart

### Fase 4: Tab "Avanzado" (1.5 días)
1. Mejorar RevenuePredictions con explicación
2. Rediseñar PeriodAnalysis (gráfico + tabla)
3. Implementar PatientAnalysis
4. Agregar CapacityUtilization

### Fase 5: Tab "Marketing" (1 día)
1. Crear MarketingMetrics
2. Implementar ChannelROI
3. Agregar AcquisitionTrends
4. Conectar con "Gastos"

### Fase 6: Testing y Refinamiento (0.5 días)
1. Testing en diferentes tamaños de pantalla
2. Verificación de i18n
3. Performance check
4. Ajustes de diseño

**Total estimado: 6.5 días de desarrollo**

---

## 📊 Métricas de Éxito

### Antes del Rediseño
- ❌ Rentabilidad no conectada
- ❌ Marketing es formulario en lugar de analytics
- ❌ Desglose por día con UX horrible (scroll infinito)
- ❌ Métricas repetidas entre tabs
- ❌ Sin jerarquía visual clara

### Después del Rediseño
- ✅ Todas las secciones conectadas a datos reales
- ✅ Marketing es dashboard analítico completo
- ✅ Desglose temporal con gráfico + tabla compacta
- ✅ Cada tab tiene propósito único y claro
- ✅ Jerarquía visual Apple-like con hero metrics

### KPIs
- **Tiempo para encontrar info clave**: ↓ 60%
- **Acciones tomadas desde dashboard**: ↑ 200%
- **Satisfacción del usuario**: ↑ 80%
- **Clicks para llegar a dato importante**: ↓ 50%

---

## 🎯 Conclusión

Este rediseño convierte el dashboard de un **conjunto de métricas dispersas** a un **centro de control estratégico** que:

1. **Guía** al usuario hacia las acciones más importantes
2. **Explica** el contexto detrás de cada métrica
3. **Sugiere** próximos pasos basados en datos
4. **Visualiza** la información de forma hermosa y clara
5. **Conecta** todos los datos ya existentes en el sistema

El resultado es un dashboard que **realmente ayuda a tomar decisiones** en lugar de solo mostrar números.

---

**Próximo paso**: Obtener aprobación y comenzar implementación fase por fase.
