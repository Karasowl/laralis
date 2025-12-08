# Roadmap Competitivo - Laralis

## Estado Actual vs Dentalink

### Lo que YA tenemos (90%)
```
✅ Pacientes (CRUD completo)
✅ Tratamientos con calendario (FullCalendar)
✅ Google Calendar sync
✅ Detección de conflictos de citas
✅ Servicios con pricing y costos
✅ Insumos con porciones
✅ Gastos y categorías
✅ Marketing y ROI
✅ Reportes avanzados (40+ páginas)
✅ Punto de equilibrio
✅ Activos con depreciación
✅ Lara AI (voz + análisis) ← VENTAJA ÚNICA
✅ Multi-tenant con RLS
✅ Export/Import con validación
✅ i18n (ES/EN)
✅ Onboarding wizard
```

### Lo que NOS FALTA (10%)
```
❌ Autoagendamiento PÚBLICO (link sin login)
❌ Notificaciones automáticas (email)
❌ Notificaciones WhatsApp
❌ Recetas médicas
❌ Odontograma interactivo
❌ Periodontograma
❌ Control de cajas por usuario
❌ Liquidación de doctores
```

---

## FASE 1: MVP Vendible (P0)

**Objetivo:** Poder vender el Plan Básico a $29/mes
**Tiempo estimado:** 2-3 semanas

### 1.1 Autoagendamiento Público
**Prioridad:** CRÍTICA

**Descripción:**
Link público que pacientes pueden usar sin login para agendar citas.

**Ejemplo URL:** `laralis.app/book/clinica-xyz`

**Flujo:**
1. Paciente abre link
2. Selecciona servicio (opcional)
3. Selecciona fecha y hora disponible
4. Ingresa datos (nombre, teléfono, email)
5. Confirma
6. Recibe confirmación por email
7. Aparece en agenda del doctor

**Componentes a crear:**
- Página pública `/book/[clinic-slug]`
- API para disponibilidad `/api/public/availability`
- API para crear cita `/api/public/book`
- Configuración de disponibilidad en settings

**Dependencias:** Ninguna

### 1.2 Notificaciones Email Automáticas
**Prioridad:** CRÍTICA

**Triggers:**
1. Cita creada → Email de confirmación
2. 24h antes → Email de recordatorio
3. Cita cancelada → Email de notificación

**Contenido del email:**
```
Asunto: Confirmación de cita - [Clínica]

Hola [Nombre],

Tu cita ha sido confirmada:
📅 Fecha: [Fecha]
🕐 Hora: [Hora]
👨‍⚕️ Doctor: [Doctor]
📍 Dirección: [Dirección]

[Botón: Confirmar] [Botón: Cancelar]

¡Te esperamos!
```

**Componentes a crear:**
- Servicio de email (Resend/SendGrid)
- Templates de email
- Cron job para recordatorios
- Tabla de notificaciones enviadas

**Dependencias:** Autoagendamiento

---

## FASE 2: Plan Profesional (P1)

**Objetivo:** Habilitar upsell a $49/mes
**Tiempo estimado:** 3-4 semanas

### 2.1 Notificaciones WhatsApp
**Prioridad:** ALTA

**Opciones de implementación:**
1. **WhatsApp Business API** (oficial, costoso)
2. **Twilio** (más fácil, $0.005/msg)
3. **360dialog** (económico)

**Flujo:**
1. Cita creada → WhatsApp con datos
2. Paciente responde "1" para confirmar
3. Sistema actualiza estado

**Componentes:**
- Integración con proveedor
- Webhook para respuestas
- Templates aprobados por Meta

### 2.2 Recetas Médicas
**Prioridad:** ALTA

**Features:**
- Crear receta desde tratamiento
- Vademécum básico (medicamentos comunes)
- Plantillas personalizables
- Generar PDF con formato oficial
- Historial de recetas por paciente

**Campos de receta:**
- Medicamento
- Dosis
- Frecuencia
- Duración
- Indicaciones especiales

**Componentes:**
- Tabla `prescriptions`
- Tabla `prescription_templates`
- Tabla `medications` (vademécum)
- Generador PDF
- UI de creación

---

## FASE 3: Plan Clínica (P2)

**Objetivo:** Habilitar plan premium $99/mes
**Tiempo estimado:** 4-6 semanas

### 3.1 Odontograma Interactivo
**Prioridad:** ALTA

**Especificaciones:**
- Diagrama SVG de 32 dientes (adulto)
- Numeración FDI internacional
- Click para seleccionar diente(s)
- Click para seleccionar cara(s)
- Catálogo de diagnósticos con iconos
- Historial de diagnósticos
- Versionado

**Componentes:**
- Componente SVG `<Odontogram />`
- Tabla `dental_findings`
- Catálogo de diagnósticos
- UI de selección múltiple

**Referencia:** Ver screenshots de Dentalink

### 3.2 Periodontograma
**Prioridad:** MEDIA

**Mediciones:**
- Profundidad de sondaje (6 puntos por diente)
- Margen gingival
- NIC (calculado)
- Sangrado
- Movilidad

**Componentes:**
- Componente `<Periodontogram />`
- Tabla `periodontal_exams`
- Gráfica de línea para visualización
- Comparativa entre versiones

### 3.3 Control de Cajas
**Prioridad:** MEDIA

**Features:**
- Cada usuario tiene su caja
- Apertura/cierre de caja
- Registro de ingresos por método de pago
- Registro de gastos de caja
- Cuadre diario

**Componentes:**
- Tabla `cash_registers`
- Tabla `cash_movements`
- Dashboard de caja
- Reporte de cierre

---

## FASE 4: Diferenciadores (P3)

**Objetivo:** Features únicas que competencia no tiene
**Tiempo:** Ongoing

### 4.1 Lara Mejorada
- Análisis predictivo de ingresos
- Sugerencias de precios
- Alertas de pacientes inactivos
- Resumen semanal por voz

### 4.2 Portal del Paciente
- Login para pacientes
- Ver historial de tratamientos
- Ver próximas citas
- Pagar online (Stripe)

### 4.3 Reportes Inteligentes
- Predicción de punto de equilibrio
- Análisis de servicios más rentables
- Comparativa mes a mes automática

---

## Timeline Visual

```
Semana 1-2    Semana 3-4    Semana 5-8    Semana 9-12
    │             │             │             │
    ▼             ▼             ▼             ▼
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
│ FASE 1  │  │ FASE 1  │  │ FASE 2  │  │ FASE 3  │
│ Autoag. │→ │ Emails  │→ │WhatsApp │→ │Odontog. │
│         │  │         │  │Recetas  │  │Period.  │
└─────────┘  └─────────┘  └─────────┘  └─────────┘
    │             │             │             │
    └─────────────┴─────────────┴─────────────┘
           Beta con esposa        Primeros 10
                                   clientes
```

---

## Criterios de Priorización

### P0 (Must Have para MVP)
- Sin esto no podemos vender
- Bloquea el launch
- Afecta propuesta de valor core

### P1 (Plan Profesional)
- Genera upsell significativo
- Diferenciador vs básicos
- Solicitado frecuentemente

### P2 (Plan Clínica)
- Para clientes más grandes
- Complejidad alta
- Margen mayor

### P3 (Nice to Have)
- Diferenciadores a largo plazo
- Innovación
- Cuando haya recursos

---

## Métricas de Éxito por Fase

### FASE 1
- [ ] Esposa puede agendar pacientes online
- [ ] Pacientes reciben email de confirmación
- [ ] 0 bugs críticos en flujo de agenda

### FASE 2
- [ ] 5 clientes usando WhatsApp
- [ ] 10 recetas generadas
- [ ] Feedback positivo de UX

### FASE 3
- [ ] 1 cliente usando odontograma
- [ ] Control de cajas funcionando
- [ ] Plan Clínica vendido

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| WhatsApp API costoso | Alta | Medio | Empezar con email only |
| Odontograma complejo | Alta | Alto | MVP con selección simple |
| Sin tiempo para todo | Alta | Alto | Priorizar FASE 1 estricta |
| Pocos early adopters | Media | Alto | Esposa + red cercana |

---

## Siguiente Acción

**TAREA INMEDIATA:** Implementar autoagendamiento público

```
Crear:
1. /app/book/[slug]/page.tsx
2. /api/public/availability/route.ts
3. /api/public/book/route.ts
4. Configuración en /settings/booking
```

---

Última actualización: 2025-12-07
