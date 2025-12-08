# Features de Dentalink - Análisis Detallado

Este documento lista todas las funcionalidades identificadas en Dentalink a partir del demo de México y entrevistas.

## Navegación Principal

```
Agenda → Pacientes → Cajas → Cobranza → Administración → Reportes → CRM
```

---

## 1. Agenda Online y Autoagendamiento

### Características
- **Agenda diaria** con vista de lista de citas
- **Agenda semanal** por profesional
- **Agenda global** para ver todos los doctores
- **Autoagendamiento online** - Link público para pacientes
- **Colores por estado** de cita (confirmado, pendiente, cancelado)
- **Búsqueda** de paciente en citas del día

### Estados de cita
- No confirmado
- Confirmado por WhatsApp
- Confirmado por email
- Contactado por chat WhatsApp
- En sala de espera
- Atendido
- Cancelado
- Reprogramación

### Indicadores visuales
- Alerta de deudas del paciente
- "Hay saldo" positivo
- "Primera vez" para nuevos pacientes
- "Múltiples citas hoy"

### UI Pattern
```
+------------------+------------------------------------------+
| Hora    Paciente | Doctor      Estado          Situación   |
+------------------+------------------------------------------+
| 10:00   Andrea P | Dra. Laura  Confirmado WA   $ No hay    |
| 12:00   Julián O | Dr. Manuel  Contactado WA   ▲ Deudas    |
+------------------+------------------------------------------+
```

**Relevancia para Laralis:** ALTA - Necesitamos autoagendamiento público

---

## 2. Notificaciones Automáticas

### Canales
- **Email** - Confirmación de cita
- **WhatsApp** - Mensaje automático con botón de confirmar

### Flujo de WhatsApp
1. Sistema envía mensaje con datos de cita
2. Paciente ve: fecha, hora, lugar, doctor
3. Paciente hace clic en "Confirmar" o "Cancelar"
4. Estado se actualiza en tiempo real en agenda

### Automatización
- Notificación 1 día antes de la cita
- Mensaje incluye link de confirmación
- Redirige a conversación de WhatsApp automáticamente

**Relevancia para Laralis:** ALTA - Diferenciador importante

---

## 3. Ficha Clínica del Paciente

### Tabs de navegación
```
Historial | Evoluciones | Antecedentes médicos | Odontograma |
Periodontograma | Rx y Documentos | Recetas | Documentos Clínicos |
Consentimientos
```

### Información del paciente
- Datos personales
- Planes de tratamiento
- Facturación y pagos
- Dar cita / Recibir pago
- Historia clínica completa

### Alertas médicas
- Enfermedades (ej: Diabetes)
- Alergias (ej: Alergia a la anestesia)
- Medicamentos actuales

**Relevancia para Laralis:** MEDIA - Ya tenemos pacientes básicos

---

## 4. Odontograma

### Características
- **Odontograma Internacional FDI** (numeración 1.1-4.8)
- **Vista permanente vs temporal**
- **Selección múltiple** de dientes
- **Selección de caras** específicas (oclusal, vestibular, etc.)
- **Catálogo de diagnósticos** con iconos visuales

### Diagnósticos disponibles
- Corona
- Corona provisoria
- Endodoncia
- Restauración
- Implante
- Perno muñón
- Prótesis removible
- Corona (mal estado)
- Otros

### Historial
- Tabla con: Fecha | Pieza | Caras | Estado | Creador | Anular
- Versionado de diagnósticos

### UI Pattern
```
     Superior
  1.8 1.7 1.6 ... 2.6 2.7 2.8
  [diente][diente][diente]...

     Inferior
  4.8 4.7 4.6 ... 3.6 3.7 3.8
```

**Relevancia para Laralis:** ALTA - Feature premium plan Clínica

---

## 5. Periodontograma

### Mediciones por pieza
- **Profundidad de surco** (sondaje)
- **Margen gingival**
- **NIC** (Nivel de Inserción Clínica) - calculado automático
- **Furca**
- **Exudado**
- **Sangrado**
- **Movilidad** (0-3)

### Visualización
- Gráfica de línea mostrando profundidades
- Colores para valores >3mm
- Vista Vestibular y Palatino/Lingual

### Versionado
- Historial de versiones por fecha y doctor
- Comparativa de evolución

**Relevancia para Laralis:** MEDIA - Feature premium, complejo

---

## 6. Módulo de Ortodoncia

### Dashboard de tratamiento
- **Presupuesto total** con descuento comercial
- **Realizado vs Abonado vs Saldo**
- **Progreso calendario** (ej: 20 de 12 meses)
- **Progreso real** (ej: 4 de 12 controles)

### Información clínica
- Último arco superior/inferior (calibre, marca)
- Tipo elásticos y configuración
- Próximo control
- Alerta de próximo control
- Indicaciones próxima sesión
- Curva de higiene

### Plantilla fotográfica
- Fotos iniciales
- Fotos por cada cita de control
- Comparativa visual de progreso

### Financiamiento
- Simulador de pago en cuotas
- Botón "Enviar presupuesto"

**Relevancia para Laralis:** BAJA - Muy especializado

---

## 7. Recetas Médicas

### Características
- **Vademécum integrado** - Base de datos de medicamentos
- **Plantillas** personalizables
- **Histórico** de recetas por paciente
- **Filtro por tratamiento**

### Formato de receta PDF
```
+------------------------------------------+
| LOGO CLÍNICA        Dentalink Mexico     |
|                     Dr(a). Nombre        |
|                     Cédula Profesional   |
+------------------------------------------+
| RECETA MÉDICA                            |
| Datos del paciente:                      |
| Nombre: XXX    Fecha nacimiento: XXX     |
| CURP/RFC: XXX  Sexo: XXX                 |
+------------------------------------------+
| Rp.                                      |
| 1. ACETAMINOFEN 500MG                    |
|    - Tomar 1 tableta cada 6 hrs x 3 días |
| 2. AMOXICILINA 500MG                     |
|    - Tomar 1 tableta cada 8 hrs x 7 días |
+------------------------------------------+
```

### Acciones
- Enviar por email
- Imprimir
- Editar
- Duplicar
- Anular

**Relevancia para Laralis:** ALTA - Plan Profesional

---

## 8. Planes de Tratamiento

### Creación de presupuesto
- Selección múltiple de dientes
- Búsqueda en catálogo de prestaciones
- Precio automático según configuración
- Sumatoria automática

### Información del presupuesto
- Total presupuesto
- Descuento comercial (%)
- Realizado / Abonado / Saldo por abonar
- Abonos asignados
- Deudas
- Vencimiento (ej: 30 días)
- Profesional a cargo
- Convenio (seguros)

### Formatos de impresión
- Presupuesto completo
- Presupuesto solo total
- Presupuesto sin detalle
- Orden de laboratorio
- Plan de atención
- Secciones
- Odontograma
- Esquema facial

### PDF de presupuesto
```
+------------------------------------------+
| Presupuesto n° 2077: Plan Dental Integral|
+------------------------------------------+
| Paciente: XXX           Convenio: XXX    |
+------------------------------------------+
| Estado | Procedimiento    | Pieza | Total|
+------------------------------------------+
| Pend.  | Limpieza dental  | arcada| $1500|
| Pend.  | Resina          | 1.7   | $590 |
| Pend.  | Endodoncia      | 1.6   | $1950|
+------------------------------------------+
| Resumen:           Estado de cuenta:     |
| Preventivo  $1,500 Total: $22,160        |
| Cuadrante I $3,720 Abonos: $0            |
| Cuadrante II $11,400 Por pagar: $22,160  |
+------------------------------------------+
```

**Relevancia para Laralis:** MEDIA - Ya tenemos tratamientos

---

## 9. Pagos y Control de Cajas

### Flujo de pago
1. Seleccionar plan de tratamiento
2. Seleccionar prestaciones a pagar
3. Indicar monto (puede ser abono parcial)
4. Seleccionar método de pago
5. Generar comprobante

### Métodos de pago
- Efectivo
- Tarjeta de débito
- Tarjeta de crédito
- Transferencia electrónica
- Cheque
- Depósito bancario

### Control de cajas
- Cada usuario tiene su propia caja
- Saldo anterior + Saldo inicial + Cobrado - Gastos = Total
- Desglose por método de pago
- Lista de transacciones

### Tabla de cajas
```
| Usuario    | Apertura  | Saldo anterior | Saldo inicial | Acumulado |
|------------|-----------|----------------|---------------|-----------|
| Dr Demo    | 11/Jun/25 | $0             | $0            | $0        |
| Pilar      | 21/May/25 | $0             | $0            | $1,000    |
```

**Relevancia para Laralis:** MEDIA - Plan Clínica

---

## 10. Liquidaciones y Gastos

### Liquidaciones de doctores
- Cálculo automático de comisiones
- Fecha de contabilización
- Desglose por procedimiento realizado
- Detalle a pagar

### Gastos
- Categorías personalizables (Luz, Internet, Depósito, etc.)
- Detalle del gasto
- Fecha de factura
- Fecha de pago
- Monto
- Asociar a caja

### Tabla de gastos
```
| Categoría | Detalle    | Fecha factura | Fecha pago  | Total  |
|-----------|------------|---------------|-------------|--------|
| Depósito  | Depósito VC| 17/06/2025    | 17/06/2025  | $2,500 |
| Internet  | Pago junio | 17/06/2025    | 17/06/2025  | $356   |
| Luz       | pago junio | 17/06/2025    | No ingresada| $550   |
```

**Relevancia para Laralis:** BAJA - Ya tenemos gastos

---

## 11. CRM / Mail Marketing

### Reportes de segmentación
- Pacientes tratados por Dr. X
- Pacientes sin visita hace X meses
- Pacientes nuevos desde fecha
- Pacientes cuya última cita fue hace X meses
- Pacientes con presupuestos no iniciados
- Pacientes pertenecientes a convenio
- Pacientes con presupuestos no finalizados
- Pacientes de cumpleaños hoy/este mes

### Campañas de email
- Selección de audiencia desde reportes
- Plantillas personalizables
- Métricas: Enviado, Leído, Clics
- Límite: 1 campaña masiva cada 30 días
- Tasa de entrega: >90%

### Tabla de campañas
```
| Fecha      | Nombre campaña      | Audiencia | Estado  |
|------------|---------------------|-----------|---------|
| 12/03/2025 | cumpleaños          | 6         | Enviado |
| 08/07/2024 | Descuento efectivo  | 121       | Enviado |
```

**Relevancia para Laralis:** BAJA - Ya tenemos marketing

---

## 12. Reportes

### Tipos de reportes
- **Solicitar reportes** - Generación bajo demanda
- **Historial de solicitudes** - Reportes generados
- **Filtros** - Por sucursal, fecha, tipo

### Reportes disponibles
- Pacientes morosos
- Tratamientos generados (detalle por acción)
- Tratamientos generados (estados)
- Tratamientos realizados
- Tratamientos generados (detalle)

### Estadísticas gráficas de pacientes
- Por edad (donuts)
- Por género
- Por delegación/zona
- Por método de pago
- Por categoría de acciones
- Por estado de citas

**Relevancia para Laralis:** BAJA - Ya tenemos reportes avanzados

---

## 13. Rx y Documentos

### Características
- Subir radiografías (JPG, PNG)
- Subir documentos
- Filtrar por usuario
- Filtrar por fecha
- Galería visual
- Zoom y comparativa

### Uso clínico
- Radiografías panorámicas
- Periapicales
- Fotos intraorales
- Fotos extraorales
- Etiquetas descriptivas

**Relevancia para Laralis:** MEDIA - Futuro

---

## 14. Consentimientos Informados

### Características
- Plantillas predefinidas
- Firma digital del paciente
- Almacenamiento en expediente
- Cumplimiento legal

**Relevancia para Laralis:** BAJA - Futuro lejano

---

## Resumen de Prioridades para Laralis

| Feature | Prioridad | Plan Laralis |
|---------|-----------|--------------|
| Autoagendamiento público | P0 | Básico |
| Notificaciones email | P0 | Básico |
| Notificaciones WhatsApp | P1 | Profesional |
| Recetas médicas | P1 | Profesional |
| Odontograma | P2 | Clínica |
| Periodontograma | P2 | Clínica |
| Control de cajas | P2 | Clínica |
| Plantilla fotográfica | P3 | Futuro |
| Módulo ortodoncia | P3 | Futuro |
| Consentimientos | P3 | Futuro |

---

Última actualización: 2025-12-07
