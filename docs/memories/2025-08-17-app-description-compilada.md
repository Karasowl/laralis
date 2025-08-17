# Descripción completa de la app (compilación de memorias)

Esta versión está curada y deduplicada. Incluye ejemplos, descripciones y los "por qués" de cada función, respetando el principio de que las categorías en la app son personalizables (las enumeraciones son ejemplos ilustrativos, no listas fijas).

Si prefieres leer los documentos completos sin curaduría, salta a Anexos.

Tabla de contenidos
- Versión curada (este documento)
  - [1. Visión y objetivos](#s1)
  - [2. Arquitectura y multi-tenant (Workspaces/Clinics)](#s2)
  - [3. Motor financiero y flujo de configuración](#s3)
    - [3.1 Depreciación (cálculo de depreciación mensual)](#s3-1)
    - [3.2 Costos fijos (suma por categorías + fondo de depreciación)](#s3-2)
    - [3.3 Costos por tiempo (horas planeadas/reales, costo hora/minuto)](#s3-3)
    - [3.4 Punto de equilibrio (margen de contribución e ingreso objetivo)](#s3-4)
    - [3.5 Costo por porción de insumo (precio presentación ÷ porciones)](#s3-5)
    - [3.6 Costo variable por servicio (recetas de insumos y cantidades)](#s3-6)
    - [3.7 Tarifa por servicio (fijo por tiempo + variable + margen)](#s3-7)
    - [3.8 Redondeo múltiplo (ajuste a múltiplos comerciales)](#s3-8)
    - [3.9 Snapshots de tratamiento (persistencia financiera histórica)](#s3-9)
  - [4. Insumos, servicios y tarifas (con ejemplos)](#s4)
  - [5. Pacientes, tratamientos y snapshots](#s5)
  - [6. Fuentes y referidos (tracking y ROI)](#s6)
    - [6.1 Fuentes personalizables y primera visita inmutable](#s6-1)
    - [6.2 Métricas de marketing: primera vs. histórico, CLV, retención](#s6-2)
    - [6.3 Referidos (MVP 1-nivel y visión multinivel)](#s6-3)
    - [6.4 Filtros avanzados y segmentación](#s6-4)
  - [7. UI/UX 2025, accesibilidad e i18n](#s7)
  - [8. Seguridad, datos y entorno](#s8)
  - [9. Reportes y dashboards](#s9)
    - [9.1 Home: métricas del día y actividad reciente](#s9-1)
    - [9.2 Accesos directos y alertas operativas](#s9-2)
    - [9.3 Visualizaciones: pastel, barras, tendencia, heat map, gauge](#s9-3)
    - [9.4 Reportes operativos con filtros universales](#s9-4)
    - [9.5 Exportaciones: Excel, PDF, CSV, API](#s9-5)
  - [10. Roadmap y futuras fases](#s10)
    - [10.1 Cumplimiento regulatorio (NOM-004/024, CFDI 4.0)](#s10-1)
    - [10.2 IA práctica: transcripción de notas clínicas](#s10-2)
    - [10.3 Inventario predictivo](#s10-3)
    - [10.4 Morning Huddle con IA](#s10-4)
    - [10.5 Motor de precios dinámico y simulador what-if](#s10-5)
    - [10.6 Membresías in-house](#s10-6)
    - [10.7 Teleodontología integrada](#s10-7)
    - [10.8 Odontograma/Periodontograma interactivo](#s10-8)
  - [11. Gobernanza: criterios, tareas y devlog](#s11)
- [Anexos: Documentos completos](#anexos)

<a id="s1"></a>
## 1. Visión y objetivos

Laralis transforma hojas de cálculo interconectadas en una plataforma moderna de inteligencia de negocio dental. El objetivo es capturar datos con precisión, conectarlos mediante un motor financiero, y ofrecer reportes que permitan decisiones informadas. La propuesta de valor descansa en: costo real por minuto, cadena de dependencias financiera, y reportes que reflejan la operación real (día, semana, mes) y la salud del negocio (punto de equilibrio, márgenes, ROI por fuente).

<a id="s2"></a>
## 2. Arquitectura y multi-tenant (Workspaces/Clinics)

- Workspaces (marca) agrupan múltiples Clinics (ubicaciones), similar a una jerarquía corporativa → regional → clínica → sillón.
- Cada clínica mantiene datos operativos propios (pacientes, tratamientos, inventario, tarifas), con métricas agregables a nivel Workspace.
- Roles orientativos: Propietario (único), Superadministrador, Administrador, Editor, Lector. Se recomienda simplificar en MVP si es necesario, manteniendo el modelo escalable.

¿Por qué multi-tenant? Para operar múltiples ubicaciones con independencia y consolidación confiable, permitiendo comparativas, proyecciones y gobierno central.

<a id="s3"></a>
## 3. Motor financiero y flujo de configuración

Cadena de dependencias inmutable que garantiza coherencia contable y operativa:

Depreciación → Costos Fijos → Costos por Tiempo → Punto de Equilibrio
                                ↓
                            Insumos → Servicios → Tarifas
                                         ↓
                                     Tratamientos

Orden recomendado y por qué:
1) Depreciación: base inamovible que alimenta el fondo mensual. Ejemplo: inversión total $67,000, 36 meses → $1,861.11/mes.
2) Costos fijos: números directos (renta, luz, agua, etc.) + fondo de depreciación. Suma mensual p.ej. $18,545.33.
3) Costos por tiempo: eficiencia real (ej. 80%), horas planeadas vs. reales, costo fijo por hora y por minuto (p.ej. $2.76/min).
4) Punto de equilibrio: con margen de contribución promedio (ej. 65%) para estimar ingreso mínimo (p.ej. $28,531.28/mes).

Este orden evita precios erróneos y asegura que las tarifas reflejen los costos reales.

<a id="s3-1"></a>
### 3.1 Depreciación (cálculo de depreciación mensual)
- Parámetros: inversión total, años, meses. Cálculo: inversión ÷ meses → depreciación mensual.
- Ejemplo: $67,000 ÷ 36 = $1,861.11.

<a id="s3-2"></a>
### 3.2 Costos fijos (suma por categorías + fondo de depreciación)
- Categorías personalizables (local, provisiones, personal, etc.). Suma + fondo de depreciación.
- Ejemplo: $16,684.22 + $1,861.11 = $18,545.33 mensuales.

<a id="s3-3"></a>
### 3.3 Costos por tiempo (horas planeadas/reales, costo hora/minuto)
- Horas planeadas = días × horas/día. Horas reales = planeadas × eficiencia.
- Costo hora = costos fijos ÷ horas reales; costo minuto = costo hora ÷ 60.
- Ejemplo: 20×7=140; 140×0.8=112; $18,545.33/112=$165.58/h; ÷60=$2.76/min.

<a id="s3-4"></a>
### 3.4 Punto de equilibrio (margen de contribución e ingreso objetivo)
- Margen contribución = 1 - costo variable promedio estimado.
- Ingreso objetivo = costos fijos ÷ margen contribución.
- Ejemplo: $18,545.33 ÷ 0.65 = $28,531.28.

<a id="s3-5"></a>
### 3.5 Costo por porción de insumo (precio presentación ÷ porciones)
- Maneja presentaciones variables; unidad básica de consumo (UBC) para consistencia.
- Ejemplos: aguja $162/100=$1.62; pasta $85/30=$2.83; resina $450/8=$56.25.

<a id="s3-6"></a>
### 3.6 Costo variable por servicio (recetas de insumos y cantidades)
- Recetas versionadas por servicio; suma de (cantidad × costo por porción).
- Ejemplo Limpieza: ≈ $29.63; Resina posterior: ≈ $138.87.

<a id="s3-7"></a>
### 3.7 Tarifa por servicio (fijo por tiempo + variable + margen)
- Costo fijo = minutos × costo fijo/minuto; total = fijo + variable; margen% → utilidad; precio = total + utilidad.
- Ejemplo Limpieza: 60×$2.76=$165.60; +$29.63=$195.23; 40%→$78.09; precio $273.32.

<a id="s3-8"></a>
### 3.8 Redondeo múltiplo (ajuste a múltiplos comerciales)
- ROUNDMULT a 50/100 u otros; documentar regla comercial y permitir configuración.
- Ejemplo: $273.32 → $300.00.

<a id="s3-9"></a>
### 3.9 Snapshots de tratamiento (persistencia financiera histórica)
- Persistir fixedPerMinuteCents, minutes, variableCostCents, marginPct, priceCents, tariffVersion.
- Razón: no recalcular históricos; análisis por período con integridad.

<a id="s4"></a>
## 4. Insumos, servicios y tarifas (con ejemplos)

Insumos (presentación, porciones, costo por porción) → Recetas de servicio (lista de insumos y cantidades) → Tarifas (tiempo × costo fijo por minuto + costo variable + margen + redondeo estratégico).

Ejemplos de insumos:
- Aguja dental: $162 / 100 u → $1.62 por unidad.
- Pasta profiláctica: $85 / 30 porciones → $2.83 por porción.
- Resina A2: $450 / 8 restauraciones → $56.25 por restauración.

Ejemplo de servicio (Limpieza):
- Lista de insumos (guantes, cubrebocas, gasas, cepillo, pasta, campo, eyector, lubricante, alcohol) → costo variable ≈ $29.63.

Ejemplo de tarifa (Limpieza):
- Tiempo 60 min × $2.76/min → costo fijo ≈ $165.60.
- Costo variable ≈ $29.63. Total sin margen ≈ $195.23.
- Margen 40% → utilidad ≈ $78.09. Precio ≈ $273.32.
- Redondeo múltiplo (p.ej. 50) → $300.00.

Nota de categorías personalizables: las categorías (insumos, servicios, fijos, fuentes) se gestionan por UI y DB, no son listas fijas.

<a id="s5"></a>
## 5. Pacientes, tratamientos y snapshots

- Pacientes: datos personales y clínicos, tracking de fuente de llegada desde la primera visita (inmutable).
- Tratamientos: registro inmediato con precio cobrado; el sistema captura snapshot de variables financieras (fixedPerMinuteCents, minutes, variableCostCents, marginPct, priceCents, tariffVersion) evitando recalcular históricos.

¿Por qué snapshots? Para análisis financieros precisos por período, preservando el contexto real al momento del tratamiento.

<a id="s6"></a>
## 6. Fuentes y referidos (tracking y ROI)

- Fuentes personalizables (digital, tradicional, referencias, convenios, walk-ins). El formulario de paciente incorpora la fuente obligatoria.
- Métricas: ingresos primera visita vs. ingresos totales por fuente, CLV, retención. Filtros por período y monto. Diferenciación de pacientes nuevos vs. recurrentes.
- Referidos: asociación robusta; MVP puede iniciar con 1 nivel; visión futura considera multinivel y valor acumulado.

¿Por qué separar primera visita vs. histórico? Para medir ROI inmediato de campañas y su efecto en LTV sin sesgar por recurrencia.

<a id="s6-1"></a>
### 6.1 Fuentes personalizables y primera visita inmutable
- Configurar fuentes por categorías (digital, tradicional, convenios, walk-ins, referencias).
- La fuente de primera llegada se conserva inmutable para atribución.

<a id="s6-2"></a>
### 6.2 Métricas de marketing: primera vs. histórico, CLV, retención
- Métricas diferenciadas: ingresos primera visita vs. ingresos totales históricos por fuente.
- CLV, ticket promedio, tasa de retención por fuente.

<a id="s6-3"></a>
### 6.3 Referidos (MVP 1-nivel y visión multinivel)
- MVP: asociación 1-nivel; Roadmap: multinivel con valor acumulado.

<a id="s6-4"></a>
### 6.4 Filtros avanzados y segmentación
- Filtros por monto, periodo, clínica, fuente, tipo de paciente (nuevo/recurrente/estacional/inactivo).

<a id="s7"></a>
## 7. UI/UX 2025, accesibilidad e i18n

- Estilo Apple-like: minimal, aireado, tokens de diseño (radius 16, sombras suaves), tipografía clara.
- Accesibilidad AA: contraste, focus visible, targets ≥ 44px, no depender solo de color.
- i18n: EN por defecto, ES alterno. Todas las cadenas en archivos de mensajes; UI nunca hardcodea texto visible.

¿Por qué? Mejora percepción premium, reduce fricción cognitiva y cumple estándares de inclusión desde el MVP.

<a id="s8"></a>
## 8. Seguridad, datos y entorno

- Supabase JS, RLS estrictas, claves vía variables de entorno; no exponer service role en el cliente.
- Dinero en centavos enteros, helpers de formato con Intl según locale activo.
- Validación con Zod; devolver errores claros; no filtrar secretos.

¿Por qué? Integridad financiera, prevención de errores sutiles y cumplimiento de buenas prácticas de seguridad.

<a id="s9"></a>
## 9. Reportes y dashboards

- Home: métricas del día, actividad reciente, accesos directos, alertas; gráficos (pastel por fuente, barras comparativas, tendencia, heat map de agenda, gauge de equilibrio).
- Reportes operativos: filtros temporales (predefinidos y custom), por clínica(s), tratamiento(s), paciente(s), financieros (rango de montos, estado de pago, método, plan).

¿Por qué? Sincronización perfecta entre widgets y listados detallados para tomar decisiones inmediatas y auditables.

<a id="s9-1"></a>
### 9.1 Home: métricas del día y actividad reciente
- Pacientes atendidos hoy, ingresos, próximas citas, tratamientos recientes.

<a id="s9-2"></a>
### 9.2 Accesos directos y alertas operativas
- Registrar paciente/tratamiento, ver agenda, cobrar pendientes; alertas de confirmaciones, stock, meta mensual.

<a id="s9-3"></a>
### 9.3 Visualizaciones: pastel, barras, tendencia, heat map, gauge
- Distribución por fuente, comparativas temporales, evolución, ocupación de agenda, punto de equilibrio.

<a id="s9-4"></a>
### 9.4 Reportes operativos con filtros universales
- Filtros temporales, por clínica(s), paciente(s), tratamiento(s), financieros.

<a id="s9-5"></a>
### 9.5 Exportaciones: Excel, PDF, CSV, API
- Exportación y programación; sanitizar y anonimizar según corresponda.

<a id="s10"></a>
## 10. Roadmap y futuras fases

- Cumplimiento regulatorio (NOM-004/024, CFDI 4.0) cuando sea viable la integración.
- IA práctica: transcripción de notas, inventario predictivo, morning huddle con insights, diagnóstico asistido (integraciones externas).
- Membresías in-house; teleodontología; app/portal de paciente; expansión internacional.

¿Por qué? Evolución gradual con valor medible (reducción de no-shows, mejor cobranza, mayor aceptación de tratamientos), manteniendo el núcleo financiero.

<a id="s10-1"></a>
### 10.1 Cumplimiento regulatorio (NOM-004/024, CFDI 4.0)
- Expediente clínico, notas de evolución, consentimientos, facturación con timbrado.

<a id="s10-2"></a>
### 10.2 IA práctica: transcripción de notas clínicas
- Dictado con formato NOM, resúmenes automáticos, sugerencia de códigos.

<a id="s10-3"></a>
### 10.3 Inventario predictivo
- Proyección de consumo por agenda futura + recetas; alertas y órdenes sugeridas.

<a id="s10-4"></a>
### 10.4 Morning Huddle con IA
- Briefing diario con oportunidades del día y predicciones.

<a id="s10-5"></a>
### 10.5 Motor de precios dinámico y simulador what-if
- Ajustes por complejidad, experiencia, ubicación; simulaciones de impacto.

<a id="s10-6"></a>
### 10.6 Membresías in-house
- Planes, cobro recurrente, métricas de LTV y churn.

<a id="s10-7"></a>
### 10.7 Teleodontología integrada
- Video consultas, recetas electrónicas, triaje inteligente.

<a id="s10-8"></a>
### 10.8 Odontograma/Periodontograma interactivo
- Dientes y superficies clickeables, estados, planes de tratamiento visuales.

<a id="s11"></a>
## 11. Gobernanza: criterios, tareas y devlog

- Criterios: build/test verdes; i18n completo; AA; Zod; dinero en centavos; sin dependencias no aprobadas; alcance acotado.
- Tareas `tasks/` con YAML + checklist; devlog por PR con contexto, problema, root cause, cambios, before/after, pruebas, riesgos y follow-ups.

—

<a id="anexos"></a>
## Anexos: Documentos completos

Los siguientes anexos contienen el contenido íntegro de cada memoria sin deduplicación.

---

## app_description.md
Sistema de Gestión Integral para Consultorio Dental - Documentación Completa del MVP y Visión Futura
Contexto y Objetivo del Proyecto
Este sistema surge de una necesidad concreta y real: reemplazar las hojas de cálculo de Google Sheets que actualmente gestiona el consultorio dental de mi esposa. La característica fundamental y más crítica de este sistema es que absolutamente todos los datos están interconectados: cada configuración inicial alimenta a la siguiente, creando una cascada de información perfectamente orquestada que culmina en el registro diario de pacientes y tratamientos.
La aplicación debe replicar exactamente la funcionalidad de las tablas actuales, pero transformándola en una interfaz moderna que permita registrar, consultar y analizar datos de manera eficiente. Las fórmulas internas del spreadsheet actual revelan la complejidad de estas interconexiones - cada celda, cada cálculo, cada referencia cruzada nos dice mucho sobre cómo debe fluir la información. Todo está interconectado: cuando cambias un valor en depreciación, afecta los costos fijos; cuando modificas los costos fijos, impacta en los costos por tiempo; cuando ajustas los costos por tiempo, se recalculan todas las tarifas.
El objetivo final es poder registrar todo lo necesario en datos y que esos datos se puedan consultar fácilmente para llegar a conclusiones precisas: cuántos pacientes se atendieron en un periodo de tiempo, cuáles fueron los gastos exactos, cómo actualizar esos gastos cuando cambian los precios, mantener un registro completo de pacientes y sus tratamientos, y sobre todo, tener reportes que permitan tomar decisiones informadas sobre el negocio.
PARTE I: ESTRUCTURA ORIGINAL DEL SPREADSHEET - La Base Inmutable del Sistema
El documento actual de Google Sheets contiene las siguientes pestañas, cada una con una función específica y crítica en el sistema que debe ser replicada con absoluta fidelidad:
Dashboard - El Centro de Comando
La pestaña maestra que de alguna manera recoge todo lo demás, consolidando toda la información del sistema en métricas y visualizaciones clave. Aquí convergen los ingresos diarios, semanales, mensuales y anuales, las comparativas período a período, el seguimiento del punto de equilibrio, los pacientes nuevos vs. recurrentes, todo presentado de manera visual e inmediata.
Registro de Tratamiento - El Historial Completo
El histórico completo de todos los servicios realizados, fecha por fecha, paciente por paciente. Cada línea es un registro que incluye: fecha exacta (con hora si es posible), nombre del paciente, servicio realizado, precio cobrado, método de pago, observaciones clínicas, y automáticamente debe calcular el costo asociado y la utilidad generada.
Pacientes - La Base de Datos Vital
La base de datos completa de clientes con toda su información personal y clínica. No es solo una lista de nombres - es un registro completo que incluye datos de contacto, historial de tratamientos, saldos pendientes, última visita, próxima cita programada, y crucialmente, la fuente de cómo llegó el paciente al consultorio.
Tarifas - Los Precios Calculados Inteligentemente
Los precios finales de servicios, calculados automáticamente basándose en costos y utilidad deseada. Esta tabla no permite inventar precios arbitrarios - cada tarifa es el resultado de una fórmula precisa que considera el costo fijo por tiempo, el costo variable de insumos, y el margen de utilidad configurado.
Punto de Equilibrio - El Termómetro Financiero
Los cálculos financieros críticos que determinan la viabilidad del negocio. Esta tabla responde la pregunta fundamental: ¿cuánto necesito facturar para no perder dinero? Y lo hace considerando los costos fijos totales y el margen de contribución promedio del negocio.
Costo Variable de Insumo - El Inventario Inteligente
El catálogo completo de materiales con sus precios y presentaciones. Cada insumo tiene su presentación comercial (como viene del proveedor), las porciones que rinde esa presentación, y el sistema calcula automáticamente el costo por porción que es lo que realmente importa.
Costos Variables de Servicios - Las Recetas Detalladas
El desglose detallado por tipo de tratamiento, con pestañas individuales:

C de valoración (costo variable de valoración)
C de limpieza dental (costo variable de limpieza dental)
C de resina posterior (costo variable de resina posterior)
C de resina anterior
C de extracción simple
C de endodoncia
Y así sucesivamente para cada servicio que ofrece la clínica...

Cada una define exactamente qué insumos y en qué cantidad se necesitan para ese tratamiento específico.
Depreciación - El Cimiento del Sistema
La amortización de equipos con sus cálculos mensuales. Esta es la base absoluta porque alimenta los costos fijos con el fondo de depreciación mensual.
Costo Fijo - Los Gastos Inevitables
Todos los gastos operativos constantes del negocio que deben pagarse independientemente del número de pacientes atendidos.
Costo por Tiempo - La Métrica Revolucionaria
Los cálculos de eficiencia horaria que determinan cuánto cuesta cada minuto de operación. Esta es una de las innovaciones más poderosas del sistema original.
PARTE II: FLUJO DE CONFIGURACIÓN - El Orden Crítico e Inmutable de Implementación
FASE 1: Depreciación - La Base Fundamental del Sistema
Lo primero que uno hace, siempre, sin excepción, es establecer la depreciación. ¿Por qué? Porque son cosas completamente hardcodeadas que no tienen fórmula, no salen de otras tablas, no dependen de nada más. Son el punto de partida absoluto del sistema.
Tabla de Inversión en Equipos:
Aquí se registra cada equipo dental con su costo de adquisición exacto:

Autoclave: $7,500 (lo que costó cuando se compró)
Caja reveladora: $500
Lámpara de fotocurado: $3,200
Compresor: $8,500
Unidad dental: $35,000
Rayos X: $12,300
Instrumental básico: $5,000
Total de inversión: $67,000 (suma automática de todos los equipos)

Parámetros de Depreciación:

Años para depreciar: 3 (este valor lo define el usuario según su estrategia financiera)
Meses para depreciar: 36 (cálculo automático: 3 años × 12 meses)
Depreciación mensual = Total de inversión ÷ Meses para depreciar
En nuestro ejemplo: $67,000 ÷ 36 = $1,861.11 mensuales

Este valor de depreciación mensual es crítico porque se va a sumar a los costos fijos, convirtiéndose en parte del fondo de depreciación que afecta todos los cálculos posteriores.
FASE 2: Costos Fijos - Los Gastos Operativos Invariables
Después de establecer la depreciación, y solo después, tú estableces los costos fijos. Estos también son todos hardcodeados - tú pones el número y se acabó, no hay fórmula ni nada en la tabla. Son los gastos que tienes que pagar sí o sí, trabajes o no trabajes, atiendas un paciente o cien.
Estructura Detallada de Costos Fijos:
Categoría Local:

Renta: $3,000 (el alquiler mensual del consultorio)
Luz: $250 (promedio mensual de electricidad)
Agua: $200 (servicio de agua potable)
Internet: $450 (servicio de internet de alta velocidad)
Teléfono: $180 (línea fija del consultorio)

Categoría Provisiones:

Educación continua: $900 (cursos, congresos, actualizaciones)
Publicidad: $2,000 (Facebook Ads, Google Ads, material impreso)
Rutas y mantenimiento: $417 (mantenimiento preventivo de equipos)
Seguro del consultorio: $650
Papelería y administración: $300

Categoría Personal (si aplica):

Asistente dental: $4,500
Recepcionista: $3,000
Limpieza: $800

Integración Crítica con Depreciación:
Al final de la tabla de costos fijos, se añade automáticamente:

Fondo de depreciación: $1,861.11 (viene de la tabla de depreciación)

Suma total mensual de costos fijos = Todos los costos anteriores + Fondo de depreciación
En nuestro ejemplo = $16,684.22 + $1,861.11 = $18,545.33
Este número es fundamental porque va a determinar cuánto cuesta mantener el consultorio abierto cada mes, independientemente de cuántos pacientes se atiendan.
FASE 3: Costos por Tiempo - La Eficiencia Operativa Traducida a Dinero
Ahora viene la parte donde empiezan las fórmulas automáticas. Ella lo primero que hace es establecer los parámetros de tiempo, porque necesita saber cuánto cuesta cada minuto de operación del consultorio.
Valores Configurables por el Usuario:

Días laborales: 20 (los días que trabaja al mes)
Horas por día: 7 (horario de 9 AM a 5 PM con 1 hora de comida)
Porcentaje de horas reales: 80%

Este último punto es crítico y merece explicación: nunca trabajas el 100% del tiempo disponible. Siempre hay tiempos muertos entre pacientes, tiempo de preparación, tiempo de limpieza, pacientes que llegan tarde o que cancelan. Por eso estableces un porcentaje realista - puede ser 75%, 80%, 85%, 90% - dependiendo de qué tan eficiente sea la operación.
Cálculos Automáticos del Sistema:

Horas planeadas por mes = Días laborales × Horas por día = 20 × 7 = 140 horas
Horas reales por mes = Horas planeadas × Porcentaje de horas reales = 140 × 0.80 = 112 horas
Costo fijo por hora = Costo fijo mensual ÷ Horas reales por mes
En nuestro ejemplo: $18,545.33 ÷ 112 = $165.58 por hora
Costo fijo por minuto = Costo fijo por hora ÷ 60
En nuestro ejemplo: $165.58 ÷ 60 = $2.76 por minuto

Este costo por minuto es fundamental porque cada servicio tiene un tiempo estimado, y necesitamos saber exactamente cuánto nos cuesta ese tiempo en términos de costos fijos.
FASE 4: Punto de Equilibrio - El Análisis Financiero Estratégico
El punto de equilibrio es "un poco a ojo", como decimos, porque requiere estimación basada en experiencia. Pero es absolutamente fundamental para saber si el negocio va bien o mal.
Componentes del Cálculo:

Total de costos fijos mensuales: $18,545.33 (viene de la tabla de costos fijos)
Costo variable promedio estimado: 35% (este porcentaje lo estableces basándote en experiencia - puede ser 30%, 35%, 40%, 45%)
Margen de contribución = 100% - Costo variable estimado = 100% - 35% = 65%

¿Por qué es estimado? Porque en realidad cada servicio tiene su propio costo variable, pero para el punto de equilibrio necesitas un promedio general del negocio. Con el tiempo, este número se puede ajustar basándose en datos reales.
Cálculo del Punto de Equilibrio:

Ingreso de punto de equilibrio mensual = Costos fijos mensuales ÷ Margen de contribución
En nuestro ejemplo: $18,545.33 ÷ 0.65 = $28,531.28

Esto significa que el consultorio necesita facturar $28,531.28 al mes para cubrir todos sus costos. Todo lo que facture por encima de eso es ganancia; todo lo que esté por debajo significa pérdida. Este número aparece en el dashboard como una línea roja que no debes cruzar hacia abajo.
FASE 5: Costos Variables de Insumo - El Catálogo Completo de Materiales
Ya cuando tienes esas tres cosas (depreciación, costo fijo y costo por tiempo), ya ahí tú puedes poner los costos variables de insumo. Estos también son hardcodeados, pero su costo por porción se calcula automáticamente.
Estructura Detallada de Cada Insumo:
Tomemos varios ejemplos para entender el patrón:
Ejemplo 1 - Material de Anestesia:

Nombre: Aguja dental
Categoría/Tags: Anestesia, Desechables (deben ser tags flexibles, no categorías rígidas)
Presentación: Caja (es como viene del proveedor)
Precio por presentación: $162
Porciones por presentación: 100 unidades
Costo por porción = $162 ÷ 100 = $1.62 por aguja

Ejemplo 2 - Material de Limpieza:

Nombre: Pasta profiláctica
Categoría/Tags: Limpieza, Profilaxis
Presentación: Bote
Precio por presentación: $85
Porciones por presentación: 30 aplicaciones
Costo por porción = $85 ÷ 30 = $2.83 por aplicación

Ejemplo 3 - Material de Restauración:

Nombre: Resina fotocurable A2
Categoría/Tags: Restauración, Estética
Presentación: Jeringa de 4g
Precio por presentación: $450
Porciones por presentación: 8 restauraciones promedio
Costo por porción = $450 ÷ 8 = $56.25 por restauración

Problema Importante a Resolver:
A veces compramos el mismo insumo en diferentes presentaciones. Por ejemplo, a veces compramos guantes en caja de 100, a veces en caja de 50, a veces por paquete de 10 pares. El sistema debe ser lo suficientemente flexible para manejar estos cambios de presentación sin complicaciones. Cada vez que cambia la presentación, debes poder actualizar fácilmente sin afectar los cálculos históricos.
La lista completa puede incluir cientos de insumos: agujas, anestesia, gasas, algodón, eyectores, baberos, guantes, cubrebocas, campos, fresas de diferentes tipos, adhesivos, ácidos, resinas de diferentes colores, cementos, materiales de impresión, etc.
FASE 6: Costos Variables por Servicio - La Composición Detallada de Cada Tratamiento
Después que tú creas todos los insumos, ya puedes entonces crear los costos variables de cada servicio. Aquí es donde defines exactamente qué insumos se usan en cada tratamiento y en qué cantidad.
El sistema debe tener un selector inteligente - tú solo tienes que elegir el insumo y poner la cantidad, y todo lo demás se calcula automáticamente.
Ejemplo Detallado - Servicio de Limpieza Dental:
Insumos requeridos para una limpieza:

Guantes: 1 par × $3.50 = $3.50
Cubrebocas: 1 unidad × $2.00 = $2.00
Gasas: 4 unidades × $0.50 = $2.00
Cepillo de profilaxis: 1 unidad × $12.00 = $12.00
Pasta profiláctica: 1 porción × $2.83 = $2.83
Campo desechable: 1 unidad × $4.00 = $4.00
Eyector: 1 unidad × $1.50 = $1.50
Lubricante para pieza: 0.1 porción × $8.00 = $0.80
Alcohol para desinfección: 0.2 porción × $5.00 = $1.00

Total costo variable de limpieza dental = $29.63
Ejemplo 2 - Servicio de Resina Posterior:
Insumos requeridos:

Guantes: 1 par × $3.50 = $3.50
Cubrebocas: 1 unidad × $2.00 = $2.00
Anestesia carpule: 1.5 unidades × $12.00 = $18.00
Aguja dental: 1 unidad × $1.62 = $1.62
Dique de goma: 1 unidad × $8.00 = $8.00
Grapa: 1 unidad × $15.00 = $15.00
Ácido grabador: 0.2 porción × $25.00 = $5.00
Adhesivo: 0.3 porción × $45.00 = $13.50
Resina A2: 1 porción × $56.25 = $56.25
Fresas de diamante (prorrateo): 0.1 × $50.00 = $5.00
Tiras de lija: 2 unidades × $3.00 = $6.00
Discos de pulido: 0.5 × $10.00 = $5.00

Total costo variable de resina posterior = $138.87
Este proceso se repite para cada servicio que ofrece la clínica: valoración, extracciones, endodoncias, coronas, puentes, etc. Cada uno con su lista específica de insumos y cantidades.
FASE 7: Tarifas - La Culminación del Sistema de Precios
Las tarifas son el último elemento de configuración y absolutamente todo lo anterior converge aquí. No puedes crear una tarifa sin un servicio, no puedes crear un servicio sin insumos, no puedes calcular costos sin tener la depreciación y los costos fijos. Todo está interconectado.
Proceso Detallado de Cálculo de Tarifa - Ejemplo Limpieza Dental:

Servicio seleccionado: Limpieza dental (desde selector, no se puede inventar)
Tiempo estimado del servicio: 60 minutos (lo establece el dentista basándose en su experiencia)
Costo fijo por tratamiento:

Tiempo × Costo fijo por minuto
60 minutos × $2.76 = $165.60


Costo variable por tratamiento: $29.63 (viene automáticamente de la tabla de costos variables)
Costo total sin ganancia:

Costo fijo + Costo variable
$165.60 + $29.63 = $195.23


Utilidad deseada: 40% (este porcentaje lo decides tú - puede ser 30%, 40%, 50%, 60%)
Monto de utilidad:

Costo total × Porcentaje de utilidad
$195.23 × 40% = $78.09


Precio de venta final:

Costo total + Monto de utilidad
$195.23 + $78.09 = $273.32


Precio redondeado:

ROUNDMULT($273.32, 50) = $300.00



Más Ejemplos de Redondeo Automático:

Valoración: $78.45 → $100
Resina anterior: $224.67 → $250
Resina posterior: $378.90 → $400
Extracción simple: $456.23 → $450
Endodoncia: $1,234.56 → $1,250
Corona de porcelana: $2,867.45 → $2,900

El redondeo es importante comercialmente - nadie cobra $273.32, cobras $300. Debería ser configurable (redondear a 50, a 100, o no redondear), pero es una práctica comercial estándar.
PARTE III: SISTEMA DE CONFIGURACIÓN DE CATEGORÍAS - Flexibilidad Total
Categorías Editables y Personalizables
Actualmente muchas categorías están hardcodeadas en el código, pero el sistema debe permitir que todas sean completamente editables desde la interfaz, almacenadas en la base de datos:
Tipos de Categorías a Gestionar:

Categorías de insumos:

Anestesia
Desechables
Restauración
Endodoncia
Prevención
Ortodoncia
Cirugía
Laboratorio
(Y cualquier otra que el usuario quiera crear)


Categorías de servicios:

Diagnóstico
Prevención
Restaurativa
Endodoncia
Periodoncia
Cirugía
Estética
Urgencias
(Personalizables según especialidad)


Categorías de costos fijos:

Local
Provisiones
Personal
Servicios
Mantenimiento
Marketing
(Adaptables a cada negocio)


Categorías de fuentes/vías:

Marketing Digital
Marketing Tradicional
Referencias
Walk-ins
Convenios
(Según estrategia de captación)



Todas estas categorías deben poder añadirse, editarse, desactivarse (no eliminar por integridad histórica) sin tocar el código. Cada clínica puede tener su propio set de categorías según sus necesidades.
Organización de la Configuración con Mejores Prácticas UI/UX
La configuración debe estar perfectamente organizada, no en una sola vista desordenada, sino siguiendo las mejores técnicas de UI/UX:
Configuración del Sistema (Global del Espacio de Trabajo):

Parámetros generales de la aplicación
Estructura de roles y permisos base
Categorías maestras compartidas
Plantillas de configuración
Configuración de idioma y región
Formatos de fecha y moneda

Configuración de Clínica (Específica por Ubicación):

Sección Financiera:

Depreciación de equipos
Costos fijos mensuales
Costos por tiempo
Punto de equilibrio


Sección de Inventario:

Catálogo de insumos
Gestión de proveedores
Alertas de stock mínimo


Sección de Servicios:

Costos variables por servicio
Tiempos estimados
Protocolos clínicos


Sección de Precios:

Tarifas por servicio
Políticas de descuento
Planes de pago



Esta separación evita la confusión actual donde hay "configuración" y "configuración del perfil" con información duplicada. Cada sección debe ser clara en su propósito y no duplicar información.
PARTE IV: ARQUITECTURA MULTI-TENANT - Gestión de Múltiples Clínicas
El sistema adopta una arquitectura similar a Metricool, no en términos de interfaz visual sino de estructura funcional y organizativa:
Espacios de Trabajo (Equivalente a "Marcas" en Metricool)
Los espacios de trabajo son el contenedor principal, como las marcas en Metricool. Un dentista puede tener un espacio de trabajo "Clínicas Dentales Dr. García" que agrupe todas sus ubicaciones.
Características del Espacio de Trabajo:

Vista consolidada de todas las clínicas
Métricas agregadas globales
Gestión centralizada de usuarios
Configuraciones compartidas
Reportes multi-clínica
Panel de control ejecutivo

Clínicas (Equivalente a "Conexiones" en Metricool)
Cada clínica dentro del espacio de trabajo es como una conexión en Metricool (Facebook, Instagram, etc.). Cada una mantiene su independencia operativa pero comparte ciertos elementos globales.
Características de Cada Clínica:

Base de datos propia de pacientes
Configuración independiente de costos
Tarifas específicas por ubicación
Inventario propio
Métricas individuales
Personal asignado

Funcionalidades Multi-Tenant Clave:
Pacientes Compartidos y Separados:

Cada clínica tiene sus propios pacientes
Pero se puede ver un total consolidado de todos los pacientes
Un paciente puede existir en múltiples clínicas
Historial unificado cuando el paciente visita diferentes ubicaciones

Dashboard Multinivel:

Vista ejecutiva del espacio de trabajo completo
Drill-down a métricas específicas por clínica
Comparativas entre clínicas
Tendencias consolidadas y por ubicación

Sistema de Onboarding:

Wizard inicial para crear primer espacio de trabajo
Guía paso a paso para configurar primera clínica
Plantillas de configuración rápida
Videos tutoriales contextuales
Lista de verificación de configuración

PARTE V: SISTEMA DE ROLES Y PERMISOS - Control Granular de Accesos
PROPIETARIO (Rol Único y Especial)

Es el usuario que creó originalmente el espacio de trabajo
Rol no asignable - solo existe uno
Puede transferirse a otro usuario (proceso irreversible)
Al transferir, el propietario anterior automáticamente se convierte en administrador
El nuevo propietario puede eliminar al anterior si lo desea
Control exclusivo sobre:

Métodos de pago de la suscripción
Eliminación del espacio de trabajo
Transferencia de propiedad
Configuración de facturación



SUPERADMINISTRADOR (Control Total Operativo)

Configuración completa del negocio (depreciación, costos, tarifas)
Acceso total a reportes financieros y utilidades
Ve todos los números: ganancias, pérdidas, márgenes
Gestión de métodos de pago existentes
Capacidad exclusiva de añadir otros administradores
Visualización de toda la facturación
Puede asignar roles a otros usuarios
Acceso a logs de auditoría
Exportación masiva de datos

ADMINISTRADOR (Gestión Sin Visibilidad Financiera)

Configura todos los aspectos del negocio
PERO no ve resultados financieros
Sin acceso a:

Reportes de dinero
Utilidades
Márgenes de ganancia
Punto de equilibrio


No puede añadir otros administradores
SÍ puede ejecutar pagos con métodos preestablecidos
Ve solo reportes operativos de pacientes
Gestiona personal de menor jerarquía

EDITOR (Operación Diaria)

Gestión completa de pacientes:

Añadir nuevos pacientes
Editar información de pacientes
Registrar tratamientos
Agendar citas


Sin acceso a configuración del negocio
No puede modificar:

Depreciación
Costos fijos o variables
Tarifas
Categorías


Enfocado exclusivamente en la operación clínica diaria
Puede ver reportes básicos de su propia productividad

LECTOR (Solo Consulta)

Acceso de solo lectura totalmente configurable
Se puede asignar a:

Una clínica específica
Varias clínicas seleccionadas
Todo el espacio de trabajo


Permisos granulares por sección:

Solo pacientes
Solo tratamientos
Solo reportes operativos
Configuración (sin poder modificar)
Facturación (solo consulta)
Combinaciones personalizadas


Útil para:

Contadores externos
Auditores
Consultores
Personal en entrenamiento



PARTE VI: GESTIÓN DE FUENTES Y MARKETING - Sistema Completo de Tracking
Sistema de Fuentes/Vías de Captación
El formulario de paciente nuevo DEBE incluir obligatoriamente un campo adicional para la fuente/vía de llegada. Este campo debe estar perfectamente integrado con la base de datos para permitir consultas SQL complejas sobre el origen y valor de cada paciente.
Configuración de Fuentes Personalizables:
El sistema debe permitir crear y gestionar fuentes ilimitadas, organizadas por categorías:
Marketing Digital:

Campaña Facebook Ads - Promoción Limpieza
Campaña Facebook Ads - Blanqueamiento
Campaña Google Ads - Búsqueda General
Campaña Google Ads - Remarketing
Instagram Orgánico
TikTok
WhatsApp Business

Marketing Tradicional:

Volantes Zona Norte
Volantes Zona Sur
Periódico Local
Radio FM 101.5
Espectacular Avenida Principal
Directorio Telefónico

Referencias (Con Tracking Detallado):

Referido por Paciente (selector de paciente existente)
Referido por Doctor (selector de doctores aliados)
Referido por Empleado
Referido por Proveedor

Convenios y Alianzas:

Seguro Dental AXA
Seguro MetLife
Convenio Empresa X
Convenio Escuela Y

Walk-ins y Otros:

Caminando por la zona
Vio el letrero
Emergencia
Retorno espontáneo

Tracking y Análisis Detallado de Cada Paciente
Para cada paciente, el sistema debe registrar y calcular:
Datos de Origen:

Fuente de primera llegada (inmutable)
Fecha de primera visita
Campaña específica si aplica
Costo de adquisición (si viene de campaña paga)

Historial de Tratamientos:

Todos los tratamientos realizados
Valor de cada tratamiento
Fechas de cada visita
Valor total histórico del paciente (Customer Lifetime Value)

Red de Referencias:

Si fue referido: ¿por quién?
Si ha referido: ¿a quiénes? (lista completa)
Valor total de su red de referidos
Niveles de referencia (referido de referido)

Sistema Avanzado de Asociación de Referidos
La capacidad de rastrear referidos debe ser robusta y multinivel:
Tracking de Primer Nivel:

Juan refirió a María
María refirió a Pedro y a Ana
Pedro refirió a Luis

Tracking de Valor Acumulado:

Juan generó directamente: $X (sus propios tratamientos)
Juan generó por María: $Y
Juan generó por Pedro (referido de María): $Z
Juan generó por Ana (referido de María): $W
Juan generó por Luis (referido de Pedro, referido de María): $V
Valor total de Juan: $X + $Y + $Z + $W + $V

Métricas de Referencias:

Pacientes con más referidos
Valor promedio por referido
Tasa de conversión de referidos
Tiempo promedio hasta primer referido

Filtros Avanzados para Análisis Profundo
El sistema debe incluir capacidades de filtrado sofisticadas:
Filtros de Interface Avanzada:

Slider de Montos:

"Mostrar pacientes que facturaron entre $X y $Y"
Control deslizante visual tipo range
Actualización en tiempo real de resultados


Filtros Temporales Flexibles:

Rangos predefinidos (Hoy, Ayer, Esta semana, Este mes)
Rangos personalizados con date pickers
Comparativas (vs. periodo anterior)
Filtros por día de la semana
Filtros por temporada


Filtros Combinados Complejos:

Pacientes de [Mes] + que facturaron más de [$X] + de [Fuente Y]
Nuevos pacientes + de campaña [Z] + con tratamiento [A]
Referidos + en [Periodo] + con más de [N] visitas



Diferenciación Automática e Inteligente de Pacientes:
El sistema debe clasificar automáticamente:
Pacientes Nuevos:

Primera visita en el período analizado
Sin historial previo en ninguna clínica
Marcador visual distintivo

Pacientes Recurrentes:

Con historial previo de tratamientos
Frecuencia de visitas calculada
Tiempo promedio entre visitas

Pacientes Estacionales:

Patrones de visita identificables (ej: solo limpiezas cada 6 meses)
Predicción de próxima visita probable
Alertas de reactivación

Pacientes Inactivos:

Sin visitas en X meses (configurable)
Candidatos para campañas de reactivación
Análisis de por qué dejaron de venir

Análisis de ROI por Campaña con Precisión
Cuando evalúas "¿Cuánto generó Facebook Ads este mes?", el sistema debe ser inteligente:
Cálculos Diferenciados:

Ingresos de Nueva Captación:

SOLO pacientes que llegaron por primera vez vía Facebook Ads
SOLO tratamientos en su primera visita
Excluye cualquier tratamiento posterior


Ingresos Totales de la Fuente:

Todos los tratamientos de todos los pacientes que alguna vez llegaron por Facebook Ads
Incluye tratamientos recurrentes
Muestra el Customer Lifetime Value


ROI Real de Campaña:

Inversión en campaña: $X
Ingresos primera visita: $Y
Ingresos totales históricos: $Z
ROI inmediato: (Y-X)/X × 100
ROI total: (Z-X)/X × 100



Métricas Avanzadas por Fuente:

Costo por lead
Costo por paciente convertido
Ticket promedio primera visita
Ticket promedio histórico
Tasa de retención por fuente
Valor promedio a 6 meses, 1 año, 2 años

PARTE VII: SISTEMA DE REPORTES INTEGRADO - Business Intelligence Dental
Dashboard Principal (Home) - El Centro de Comando
El home debe ser mucho más que una página de bienvenida. Debe ser el centro neurálgico de información, perfectamente sincronizado con todos los datos del sistema:
Widgets de Información en Tiempo Real:

Métricas del Día:

Pacientes atendidos hoy: X
Ingresos del día: $Y
Próximas citas: Z
Tratamientos realizados: Lista rápida


Actividad Reciente (Timeline):

"Hace 5 min: María García - Limpieza dental - $300"
"Hace 20 min: Nuevo paciente registrado - Juan Pérez"
"Hace 1 hora: Pago recibido - Ana López - $1,200"
"Hace 2 horas: Cita agendada - Pedro Ruiz - Mañana 10 AM"


Accesos Directos Inteligentes:

Botón: Registrar Nuevo Paciente
Botón: Registrar Tratamiento
Botón: Ver Agenda del Día
Botón: Cobrar Pendientes
(Personalizables según rol y frecuencia de uso)


Alertas y Notificaciones:

"3 pacientes sin confirmar para mañana"
"Stock bajo: Resina A2 (quedan 2 unidades)"
"Meta mensual: 75% alcanzada"
"Punto de equilibrio: Superado en $5,000"



Visualizaciones Gráficas Interactivas:

Gráfico de Pastel - Distribución de Pacientes por Fuente:

Facebook Ads: 35%
Referidos: 25%
Google: 20%
Walk-ins: 15%
Otros: 5%
(Clickeable para ver detalle)


Gráfico de Barras - Facturación Comparativa:

Por día de la semana actual
Por semana del mes
Por mes del año
Comparativa vs. periodo anterior
Línea de punto de equilibrio visible


Línea de Tendencia - Evolución del Negocio:

Pacientes nuevos por mes
Ingresos mensuales
Línea de tendencia proyectada
Eventos marcados (campañas, cambios de precio)


Heat Map - Ocupación de Agenda:

Visualización tipo calendario
Colores por nivel de ocupación
Identificación de horas pico
Espacios disponibles para optimizar


Gauge/Velocímetro - Punto de Equilibrio:

Visual tipo velocímetro
Zona roja: Por debajo del punto
Zona amarilla: Cerca del punto
Zona verde: Superando el punto
Indicador de proyección mensual



Sincronización Perfecta:
Todos los datos del home deben estar perfectamente sincronizados con los reportes detallados del menú de operaciones. Si el home dice "15 pacientes hoy", el reporte detallado debe mostrar exactamente esos 15 pacientes con su información completa.
Reporte de Vías de Ingreso/Marketing - Inteligencia de Captación
Este reporte especializado es fundamental para tomar decisiones de marketing:
Preguntas Clave que Debe Responder:

¿Qué vía está generando más ingresos?

Tabla rankeada por ingresos totales
Periodo seleccionable
Desglose por primera visita vs. recurrente


¿Cuántos pacientes nuevos trajo cada vía?

Números absolutos y porcentajes
Tendencia temporal (creciendo/decreciendo)
Comparativa con periodos anteriores


¿Cuál es el ticket promedio por fuente?

Primera visita
Promedio histórico
Por tipo de tratamiento


¿Qué fuente tiene mejor tasa de retención?

% de pacientes que regresan
Tiempo promedio hasta segunda visita
Número promedio de visitas por paciente


¿Cuál es el ROI de cada campaña paga?

Inversión vs. Retorno
Tiempo de recuperación
Proyección a futuro



Visualizaciones Específicas:

Funnel de Conversión por Fuente:
Leads → Citas Agendadas → Presentados → Tratamiento → Recurrencia
Matriz BCG de Fuentes:
Clasificación en Estrellas, Vacas, Perros, Interrogantes
Análisis Cohort:
Comportamiento de grupos de pacientes por mes de llegada

Reportes Operativos con Filtros Potentes
Todos los reportes deben incluir capacidades de filtrado avanzadas:
Panel de Filtros Universal:

Filtros Temporales:

Date pickers con rangos predefinidos
Comparativas automáticas
Agrupación (día, semana, mes, trimestre, año)


Filtros de Clínica:

Individual
Múltiple selección
Todas las clínicas
Grupos personalizados


Filtros de Paciente:

Nuevos/Recurrentes/Todos
Por fuente de llegada
Por valor histórico
Por frecuencia de visita
Por tipo de seguro


Filtros de Tratamiento:

Por categoría
Por servicio específico
Por rango de precio
Por duración


Filtros Financieros:

Rango de montos (con slider visual)
Pagados/Pendientes/Todos
Por método de pago
Por plan de pago



Capacidades de Exportación:

Excel con formato
PDF para impresión
CSV para análisis
API para integraciones
Programación de envío automático

Reportes Especializados Adicionales

Reporte de Productividad por Operador:

Tratamientos realizados
Ingresos generados
Tiempo promedio por tratamiento
Satisfacción del paciente


Reporte de Inventario y Consumo:

Consumo por periodo
Proyección de necesidades
Análisis de costos
Proveedores y precios


Reporte de Cobranza:

Cuentas por cobrar aging
Efectividad de cobranza
Pacientes morosos
Proyección de flujo de caja


Reporte de Satisfacción:

NPS por fuente
Comentarios y quejas
Tasa de resolución
Tendencias de satisfacción



PARTE VIII: OPERACIÓN DIARIA - El Flujo de Trabajo Real
Una vez que toda la configuración inicial está completa, el sistema entra en modo operativo. Este es el trabajo del día a día:
1. Registro de Nuevos Pacientes - Proceso Completo
Cuando llega un paciente nuevo, el proceso debe ser fluido pero completo:
Información Personal Obligatoria:

Nombre completo
Fecha de nacimiento
Género
Teléfono principal
Teléfono secundario
Email
Dirección completa
RFC (si requiere factura)

Información Crítica de Marketing:

Fuente/Vía de llegada (OBLIGATORIO - selector de fuentes configuradas)
Si es referido: ¿Por quién? (selector de pacientes existentes)
Campaña específica (si aplica)
Primera impresión/motivo de consulta

Información Clínica:

Alergias
Padecimientos
Medicamentos que toma
Última visita al dentista
Motivo de consulta principal

Información Administrativa:

Tipo de paciente (particular/asegurado)
Seguro (si aplica)
Empresa (si es por convenio)
Observaciones especiales

2. Registro de Tratamientos Realizados
Cada tratamiento debe registrarse inmediatamente después de realizarse:
Proceso de Registro:

Seleccionar paciente (con buscador inteligente)
Seleccionar servicio desde catálogo (no se puede inventar)
Confirmar o ajustar precio (toma la tarifa por defecto)
Registrar método de pago (efectivo, tarjeta, transferencia)
Añadir observaciones clínicas si es necesario
Generar recibo/factura si se requiere

Información Automática Registrada:

Fecha y hora exacta
Operador que realizó el tratamiento
Clínica donde se realizó
Insumos consumidos (según configuración del servicio)
Costo del tratamiento (para cálculos de utilidad)
Precio cobrado
Utilidad generada

3. Consulta del Dashboard - Monitoreo Constante
Durante el día, el dashboard debe consultarse regularmente para:
Monitoreo en Tiempo Real:

Ver citas próximas
Confirmar llegada de pacientes
Verificar cobros pendientes
Revisar productividad del día

Análisis Rápido:

¿Cómo vamos vs. la meta diaria?
¿Estamos sobre el punto de equilibrio?
¿Hay alertas que atender?
¿Qué fuentes están funcionando hoy?

4. Actualizaciones y Mantenimiento Ocasional
El sistema requiere actualizaciones periódicas para mantener la precisión:
Creación de Nuevos Servicios:

Primero verificar que existan todos los insumos necesarios
Si falta algún insumo, crearlo primero
Crear el costo variable del servicio
Establecer la tarifa
Activar para uso

Actualización de Costos:

Cuando cambia la renta: Actualizar costos fijos
Cuando cambian precios de insumos: Actualizar costos variables
Cuando compras equipo nuevo: Actualizar depreciación
Cuando cambias horario: Actualizar costos por tiempo

Gestión de Categorías y Fuentes:

Añadir nuevas fuentes de marketing
Reorganizar categorías según necesidad
Desactivar elementos obsoletos
Crear nuevas clasificaciones

PARTE IX: CARACTERÍSTICAS ADICIONALES DEL MVP
Portal Básico del Paciente
Como parte del MVP, incluiremos un portal simple pero funcional donde los pacientes pueden:
Acceso a Su Información:

Ver su historial completo de tratamientos
Descargar recibos y facturas
Consultar su siguiente cita programada
Ver saldos pendientes si los hay
Actualizar sus datos de contacto

Este portal no necesita ser complejo inicialmente, pero proporciona valor inmediato al reducir llamadas al consultorio y mejorar la experiencia del paciente.
Sistema de Recordatorios Automatizados
WhatsApp Básico:

Recordatorio 24 horas antes de la cita
Mensaje simple con fecha, hora y tratamiento
Opción de confirmar con respuesta SÍ/NO
Si responde NO, notificación para reagendar

Email Automático:

Confirmación al momento de agendar
Recordatorio 48 horas antes
Recibo/factura después del tratamiento
Instrucciones de cuidado post-tratamiento

Gestión de Inventario con Alertas
Control Básico pero Efectivo:

Registro de compras (entradas)
Descuento automático por tratamientos (salidas)
Stock actual visible en tiempo real
Alerta cuando queda menos del mínimo configurado
Lista de compras sugerida exportable

Sistema de Snapshot de Costos
Una característica crucial que debe estar desde el MVP: cuando se realiza un tratamiento, el sistema guarda un "snapshot" del costo exacto en ese momento. Si hoy la resina cuesta $450 y en seis meses cuesta $500, los reportes históricos mantienen el costo real del momento. Esto es fundamental para análisis de rentabilidad precisos.
Unidad Básica de Consumo (UBC)
Para resolver el problema de las múltiples presentaciones, implementamos desde el inicio el concepto de UBC. Cada insumo tiene su unidad básica (par para guantes, cartucho para anestesia, unidad para gasas) independiente de cómo se compre. El sistema calcula automáticamente el costo promedio ponderado cuando hay compras a diferentes precios.
PARTE X: VALIDACIONES Y REGLAS DE NEGOCIO
El sistema debe mantener integridad absoluta mediante validaciones estrictas:
Validaciones de Dependencia
Cadena de Dependencias Inviolable:
Depreciación → Costos Fijos → Costos por Tiempo → Punto de Equilibrio
                    ↓
              Insumos → Servicios → Tarifas
                           ↓
                     Tratamientos
Reglas Específicas:

No se puede crear una tarifa sin servicio existente
No se puede crear un servicio sin todos sus insumos
No se puede registrar tratamiento sin tarifa definida
No se puede registrar paciente sin fuente/vía
No se puede eliminar insumo si está en uso en algún servicio
No se puede eliminar servicio si tiene tratamientos históricos

Validaciones de Integridad
Datos Financieros:

Los montos no pueden ser negativos
Los porcentajes deben estar entre 0 y 100
Las fechas no pueden ser futuras para registros históricos
Los cálculos deben redondearse consistentemente

Datos Operativos:

Un paciente no puede tener dos tratamientos simultáneos
Las citas no pueden solaparse para el mismo operador
El inventario no puede ser negativo
Los tiempos deben ser realistas (1-300 minutos)

Actualizaciones en Cascada
Cuando se modifica un valor base, todos los valores dependientes deben recalcularse automáticamente:
Ejemplo - Cambio en Costos Fijos:

Usuario actualiza renta de $3,000 a $3,500
Sistema recalcula total de costos fijos
Sistema recalcula costo por hora
Sistema recalcula costo por minuto
Sistema recalcula todas las tarifas
Sistema actualiza punto de equilibrio
Dashboard refleja nuevos valores inmediatamente

PARTE XI: VISIÓN FUTURA - Evolución Post-MVP
Fase 2: Cumplimiento Regulatorio (Cuando sea viable la conexión con SAT)
Expediente Clínico Electrónico NOM-004:

Historia clínica completa digital con todos los campos mandatorios
Notas de evolución estructuradas según la norma
Consentimientos informados digitales con validez legal
Firma electrónica básica vinculada al SAT
Odontograma digital interactivo completo
Exportación en formatos estándar (HL7 CDA)

Facturación CFDI 4.0:

Generación automática de facturas con timbrado fiscal
Manejo de esquemas PPD para pagos en parcialidades
Notas de crédito y cancelaciones automáticas
Portal de facturación para pacientes
Integración directa con el SAT

Esta funcionalidad se activará cuando tengamos los medios técnicos y legales para conectar con el SAT. Por ahora, el sistema generará recibos simples que pueden convertirse en facturas cuando esta capacidad esté disponible.
Fase 3: Inteligencia Artificial Práctica
IA para Productividad:

Transcripción de voz a texto para notas clínicas
El dentista dicta mientras trabaja y el sistema formatea automáticamente
Predicción de no-shows basada en patrones históricos
Optimización automática de agenda
Sugerencias de tratamiento basadas en historial

IA para Inventario:

Predicción de consumo basada en agenda futura
Órdenes de compra automáticas optimizadas
Identificación de patrones de desperdicio
Alertas predictivas de stock

Fase 4: Experiencia del Paciente Avanzada
Portal del Paciente Completo:

Dashboard personalizado con su información
Gestión autónoma de citas con reglas de negocio
Historia clínica visual e interactiva
Odontograma evolutivo visible
Pagos en línea integrados

Comunicación Omnicanal:

WhatsApp Business API completa con plantillas aprobadas
SMS conversacionales con IA
Email marketing segmentado automáticamente
Campañas de reactivación inteligentes

Sistema de Membresías:

Planes configurables (básico, familiar, premium)
Cobro recurrente automático
Gestión del ciclo de vida completo
ROI tracking de membresías
Análisis de LTV por tipo de paciente

Fase 5: Telemedicina y Diagnóstico Asistido
Consultas Virtuales:

Video consultas integradas en el sistema
Herramientas de anotación sobre imágenes
Recetas electrónicas instantáneas
Triaje inteligente de urgencias

Asistente de Diagnóstico:

Integración con servicios de análisis de radiografías
Pre-identificación de patologías
Medición automática de pérdida ósea
Generación de reportes visuales para pacientes

Fase 6: Expansión Internacional
Adaptación por País:

México: Sistema actual con todas las NOMs cuando sea viable
Estados Unidos: HIPAA compliance, códigos ADA, insurance billing
España: RGPD, sistema de facturación europeo
Latinoamérica: Adaptaciones específicas por país

Cada versión mantendría el motor financiero interconectado como núcleo, pero adaptaría las regulaciones y requerimientos locales.
CONCLUSIÓN: Un Sistema que Crece con el Negocio
Este sistema no es solo un reemplazo de las hojas de cálculo actuales, sino una evolución que mantiene toda la lógica de negocio probada mientras añade capacidades modernas de gestión, análisis y crecimiento multi-clínica.
El MVP incluye todo lo esencial del sistema actual más las mejoras inmediatamente viables: el motor financiero interconectado completo, gestión de pacientes con tracking de fuentes, reportes inteligentes, portal básico del paciente, recordatorios automatizados, control de inventario, y arquitectura multi-tenant desde el inicio.
Las características más complejas - cumplimiento regulatorio completo, IA avanzada, telemedicina - están claramente definidas para implementación futura cuando las condiciones técnicas y legales lo permitan.
La implementación debe seguir el orden establecido, respetando las dependencias y manteniendo la integridad de los datos en todo momento. Este es un sistema vivo que crecerá con el negocio, pero sus fundamentos - la interconexión de datos, los cálculos precisos y el tracking detallado - deben permanecer inviolables.
El sistema está diseñado para comenzar simple pero poderoso, y evolucionar hacia una plataforma de inteligencia de negocio dental completa. Cada fase construye sobre la anterior sin necesidad de rehacer nada, asegurando una inversión protegida y un crecimiento sostenible.

Esta documentación representa la visión completa, exhaustiva y definitiva del Sistema de Gestión Integral para Consultorio Dental. Cada sección, cada cálculo, cada ejemplo ha sido cuidadosamente preservado de la idea original y complementado con las mejoras viables para el MVP. El sistema descrito aquí mantiene la esencia probada del negocio mientras abraza la transformación digital necesaria para competir y liderar en el mercado actual.

---

## chatgpt_caracteristicas_a_añadir_a_la_app.md
¡Excelente! He analizado a fondo la visión completa de tu proyecto, "Laralis", y la he contrastado con mi conocimiento del mercado y las tendencias para 2025 que he investigado.

Primero, quiero felicitarte. La base que has diseñado es **excepcionalmente sólida y diferenciadora**. Tu enfoque en el motor financiero —desde la depreciación de activos hasta el costo real por minuto— es un pilar que muchos competidores tratan de forma superficial. Esta es tu gran fortaleza: una herramienta de **inteligencia de negocio** para dentistas, no solo un gestor de citas.

Ahora, como tu experto de producto, mi trabajo es llevar esta visión al siguiente nivel para que no solo compita, sino que **lidere el mercado en 2025**. Basado en mi análisis, te propongo enfocarnos en tres áreas estratégicas para evolucionar Laralis.

---

### 1. Elevar la Experiencia del Paciente (Patient Engagement)

Tu sistema actual está muy centrado en la gestión interna de la clínica (lo cual es fundamental), pero la gran tendencia del mercado es empoderar al paciente. Los pacientes ahora esperan autonomía y comunicación digital. Esto no solo mejora la satisfacción, sino que reduce drásticamente la carga administrativa.

#### **Qué debemos añadir:**

* **Portal del Paciente:** Un espacio web seguro donde el paciente pueda:
    * Ver y agendar sus próximas citas.
    * Consultar su historial de tratamientos y odontogramas de forma simplificada.
    * Ver su estado de cuenta, pagos realizados y descargar facturas.
    * Llenar y firmar formularios de consentimiento y anamnesis digitalmente antes de llegar a la clínica.
    * Comunicarse de forma segura con la clínica.

* **Agendamiento Online Inteligente:** Permitir que pacientes nuevos y existentes agenden citas desde tu sitio web o el portal. El sistema debería ser lo suficientemente inteligente para ofrecer espacios según el tipo de tratamiento y la disponibilidad real del doctor.

* **Comunicación Automatizada y Personalizada:**
    * **Recordatorios de Citas:** Vía WhatsApp y/o SMS, no solo email. Con opción de confirmar, cancelar o reagendar con un solo clic/respuesta.
    * **Seguimiento Post-Tratamiento:** Enviar automáticamente indicaciones post-operatorias según el servicio realizado.
    * **Campañas de Recaptación (Recall):** Detectar automáticamente pacientes que no han vuelto para su limpieza semestral o que dejaron un tratamiento a medias y enviarles un recordatorio amigable.

#### **Prompt para la IA de codificación:**
> "Vamos a construir el **Portal del Paciente** para Laralis. Crea una nueva sección en la app con autenticación segura para pacientes. La primera versión debe incluir: un dashboard con la próxima cita, un historial simple de tratamientos pasados, y la capacidad de ver y descargar sus facturas. Utiliza Supabase para la autenticación de usuarios con un rol de 'paciente'."

---

### 2. Introducir Inteligencia y Automatización (IA)

La IA ya no es ciencia ficción; es un estándar en el software dental moderno para optimizar tareas y mejorar la precisión. Integrar IA posicionará a Laralis como una herramienta de vanguardia.

#### **Qué debemos añadir:**

* **Asistente de Diagnóstico por IA (Vision a futuro):** Integrar un modelo que pueda analizar radiografías (panorámicas, periapicales) y pre-identificar posibles caries, lesiones o problemas de pérdida ósea. Esto no reemplaza al dentista, sino que actúa como un "segundo par de ojos" para asegurar que nada se pase por alto.

* **Análisis Predictivo para Inventario:** Tu sistema ya sabe qué insumos usa cada servicio. El siguiente paso es que la IA prediga cuándo te quedarás sin stock. Basado en la agenda de citas futuras y el historial de tratamientos, el sistema puede alertar: *"Alerta: según las 5 resinas programadas para la próxima semana, te quedarás sin adhesivo dental en 8 días. ¿Quieres añadirlo a la orden de compra?"*

* **Transcripción y Resumen de Notas Clínicas:** Utilizar IA de voz a texto para que el odontólogo pueda dictar las notas del tratamiento mientras trabaja, y que el sistema las transcriba y resuma automáticamente en el expediente del paciente.

#### **Prompt para la IA de codificación:**
> "Implementemos un **sistema de alertas de inventario predictivo**. Crea un módulo que analice los tratamientos agendados para los próximos 15 días. Usando la tabla `service_supplies`, calcula el consumo proyectado de cada insumo. Compara este consumo con el stock actual (necesitaremos añadir una columna `stock_actual` a la tabla `supplies`) y genera una alerta si el stock proyectado cae por debajo de un mínimo configurable."

---

### 3. Profundizar en la Gestión Clínica y Financiera

Has sentado una base financiera increíble. Ahora, vamos a potenciarla con herramientas clínicas más profundas y una inteligencia de negocio más visual, similar a lo que ofrecen competidores de alto nivel como Dentalink o Dentidesk.

#### **Qué debemos añadir:**

* **Odontograma y Periodontograma Digital e Interactivo:** Esta es la herramienta clínica más importante. Debe ser visual e interactivo, permitiendo marcar sobre cada diente y superficie:
    * Caries, restauraciones existentes, ausencias, implantes, etc.
    * Crear "planes de tratamiento" visuales, donde marcas las necesidades en el odontograma y el sistema genera automáticamente el presupuesto a partir de la tabla de tarifas.
    * Historial visual: poder ver "fotos" del odontograma en diferentes fechas para ver la evolución del paciente.

* **Dashboard "Morning Huddle":** Un tablero específico para empezar el día. Cada mañana, el equipo se reúne y este dashboard les muestra:
    * Pacientes agendados para hoy.
    * **Oportunidades del día:** Alertas como "Juan Pérez tiene un saldo pendiente de $500" o "Ana García tiene un plan de tratamiento aprobado sin agendar".
    * Meta de facturación del día y cuánto falta para alcanzarla.
    * Cumpleaños de pacientes del día.

* **Análisis de Rentabilidad por Servicio:** Ya tienes todos los datos para esto. Necesitamos un reporte que muestre:
    * ¿Cuál es el servicio más rentable (mayor margen de ganancia)?
    * ¿Cuál es el servicio que más se vende?
    * Análisis de "Costo vs. Ingreso vs. Tiempo" para cada servicio.

#### **Prompt para la IA de codificación:**
> "Desarrolla el componente de **Odontograma Interactivo** usando SVG o Canvas. Debe mostrar una representación estándar de una dentadura adulta e infantil. Cada diente y superficie debe ser clickeable. Al hacer clic, debe abrir un menú para registrar hallazgos (ej: Caries, Restauración, Ausente). El estado de cada diente debe guardarse en la base de datos, asociado al paciente y a una fecha."

### **Qué podemos reconsiderar o simplificar inicialmente**

* **Complejidad del Tracking de Referidos:** Tu idea de un tracking de referidos multi-nivel con valor acumulado es muy potente, pero compleja de implementar y de usar al inicio.
    * **Sugerencia:** Empecemos con un sistema de referidos de **un solo nivel**. Es decir, registrar quién refirió a quién y punto. Los reportes pueden mostrar "Top 5 pacientes que más refieren". Esto ya aporta el 80% del valor con el 20% del esfuerzo.
* **Roles de Usuario Granulares:** El sistema de roles que planteas (Propietario, Superadmin, Admin, Editor, Lector) es excelente para una app madura.
    * **Sugerencia:** Para el lanzamiento inicial, podemos simplificar a 3 roles: **Propietario** (control total), **Odontólogo/Editor** (gestión clínica y de pacientes) y **Recepcionista/Lector** (agenda y consulta, sin datos financieros). Esto facilitará el desarrollo y la adopción inicial.

Con estos ajustes, Laralis no solo será un reflejo digital de una hoja de cálculo, sino un producto digital competitivo, centrado en el usuario y preparado para el futuro de la odontología.

Estoy listo para empezar a crear los prompts para la primera de estas mejoras. ¿Por cuál te gustaría comenzar?

---

## claude_caracteristicas_a_añadir_a_la_app.md
🎯 ANÁLISIS ESTRATÉGICO MEJORADO PARA LARALIS
Reconocimiento de Fortalezas Actuales
Primero, coincido con ChatGPT/Gemini en algo fundamental: tu motor financiero es excepcionalmente sólido y diferenciador. La interconexión desde depreciación → costos fijos → costos por tiempo → tarifas es un nivel de inteligencia de negocio que competidores como Dentrix o Eaglesoft tratan superficialmente. Esta es tu ventaja competitiva core que debes proteger y potenciar.
ESTRATEGIA DE IMPLEMENTACIÓN: MVP EVOLUTIVO
Basándome en el consenso de los análisis, propongo un enfoque más pragmático de 3 FASES EVOLUTIVAS:

FASE 1: FUNDAMENTOS DIGITALES (Meses 1-3)
Objetivo: Modernizar la experiencia sin perder tu fortaleza financiera
1.1 Portal del Paciente (Consenso unánime)
Por qué es crítico: Reduce 40% de llamadas administrativas y aumenta satisfacción en 35%
Implementación MVP:
javascript// Prompt específico para tu IA de desarrollo:
"Crea un portal de paciente con Supabase Auth que incluya:
1. Dashboard con próxima cita y saldo pendiente
2. Historial simplificado de tratamientos (tabla básica)
3. Descarga de facturas PDF
4. Formulario de actualización de datos personales
Usa React con Tailwind CSS para UI responsive"
Estadística del mercado (Grok): 70% de pacientes prefieren interacciones digitales en 2025
1.2 Comunicación Automatizada Inteligente
Implementación inmediata vía Twilio:

WhatsApp Business API para recordatorios (reduce no-shows 30%)
SMS bidireccional para confirmaciones
Email automático post-tratamiento con instrucciones

ROI esperado: 4x en 6 meses según datos de Weave y Solutionreach
1.3 Odontograma Digital Básico
Versión simplificada inicial:
javascript// Prompt para desarrollo:
"Implementa un odontograma SVG interactivo con:
- 32 dientes adultos clickeables
- Estados básicos: Sano, Caries, Obturado, Ausente
- Guardado en JSON en tabla 'dental_charts'
- Historial de cambios por fecha
Usa la librería react-tooth-chart si existe"

FASE 2: INTELIGENCIA ARTIFICIAL PRÁCTICA (Meses 4-6)
Objetivo: Automatización que genera ROI inmediato
2.1 IA para Inventario Predictivo
Implementación con tu data existente:
python# Pseudocódigo para tu sistema:
def predict_stock_needs():
    upcoming_treatments = get_appointments_next_30_days()
    supply_consumption = calculate_supply_usage(upcoming_treatments)
    current_stock = get_current_inventory()
    
    for supply in supplies:
        days_until_stockout = current_stock[supply] / daily_consumption[supply]
        if days_until_stockout < reorder_point:
            generate_alert(supply, days_until_stockout)
Beneficio medible: Reduce stockouts 85%, ahorra 3 horas semanales en gestión
2.2 Transcripción de Notas con Whisper API

Integración OpenAI Whisper: $0.006 por minuto
ROI: Ahorra 45 min/día al dentista
Cumplimiento HIPAA con encriptación local

2.3 Analytics Dashboard "Morning Huddle"
Como sugiere ChatGPT, pero con KPIs específicos:

Producción del día vs meta (gauge visual)
Oportunidades no realizadas (tratamientos pendientes)
Tasa de conversión por fuente
Predicción de fin de mes con ML básico


FASE 3: DIFERENCIACIÓN COMPETITIVA (Meses 7-12)
Objetivo: Features que te posicionan como líder
3.1 Membresías In-House (Mi recomendación + validación del mercado)
Datos duros:

77 millones de americanos sin seguro dental
Prácticas con membresías ven 2-3x más visitas
80% renovación anual promedio

Implementación:
sql-- Estructura de datos para membresías
CREATE TABLE membership_plans (
    id UUID PRIMARY KEY,
    name VARCHAR(100),
    monthly_fee DECIMAL(10,2),
    included_services JSONB, -- ["cleaning", "xray", "exam"]
    discount_percentage INTEGER,
    active BOOLEAN
);

CREATE TABLE patient_memberships (
    patient_id UUID REFERENCES patients,
    plan_id UUID REFERENCES membership_plans,
    start_date DATE,
    stripe_subscription_id VARCHAR(255),
    status VARCHAR(50)
);
3.2 Teledontología Integrada

Video consultas con WebRTC (no Zoom)
Prescripciones electrónicas post-consulta
ROI: $65 por consulta virtual vs $150 presencial

3.3 AI Receptionist Básica
Comenzar simple:

Auto-respuesta a llamadas perdidas
Agendamiento por voz natural
FAQ automatizado


SIMPLIFICACIONES ESTRATÉGICAS (Consenso de consejeros)
Eliminar o Posponer:

Blockchain → Posponer para Fase 4 (2026)
Tracking multinivel de referidos → Simplificar a un nivel
Roles complejos → Solo 3 roles iniciales:

Propietario (todo)
Clínico (sin finanzas)
Recepción (solo agenda)


Gamificación compleja → Comenzar con sistema de puntos simple

Mantener pero Simplificar:

Configuración de costos → Wizard con templates predefinidos
Categorías → 5 categorías base + custom
Multi-tenant → Comenzar con single-tenant, preparar arquitectura para escalar


MÉTRICAS DE ÉXITO ACTUALIZADAS
KPIs para Fase 1 (3 meses):

50% reducción en llamadas administrativas
25% aumento en confirmación de citas
15% reducción en no-shows

KPIs para Fase 2 (6 meses):

30% ahorro en tiempo de documentación
90% precisión en predicción de inventario
20% aumento en tratamientos aceptados

KPIs para Fase 3 (12 meses):

200% ROI en membresías
40% de pacientes sin seguro convertidos a membresía
35% aumento en LTV del paciente


VENTAJA COMPETITIVA SOSTENIBLE
Tu diferenciador no es una feature, es la combinación única de:

Motor financiero robusto (tu fortaleza actual)
IA práctica aplicada (no experimental)
Modelo de membresías (recurring revenue)
Simplicidad de uso (vs complejidad de Dentrix)

---

## gemini_caracteristicas_a_añadir_a_la_app.md
#### **Prompt para la IA de codificación:**
> "Implementemos un **sistema de alertas de inventario predictivo**. Crea un módulo que analice los tratamientos agendados para los próximos 15 días. Usando la tabla `service_supplies`, calcula el consumo proyectado de cada insumo. Compara este consumo con el stock actual (necesitaremos añadir una columna `stock_actual` a la tabla `supplies`) y genera una alerta si el stock proyectado cae por debajo de un mínimo configurable."

---

### 3. Profundizar en la Gestión Clínica y Financiera

Has sentado una base financiera increíble. Ahora, vamos a potenciarla con herramientas clínicas más profundas y una inteligencia de negocio más visual, similar a lo que ofrecen competidores de alto nivel como Dentalink o Dentidesk.

#### **Qué debemos añadir:**

* **Odontograma y Periodontograma Digital e Interactivo:** Esta es la herramienta clínica más importante. Debe ser visual e interactivo, permitiendo marcar sobre cada diente y superficie:
    * Caries, restauraciones existentes, ausencias, implantes, etc.
    * Crear "planes de tratamiento" visuales, donde marcas las necesidades en el odontograma y el sistema genera automáticamente el presupuesto a partir de la tabla de tarifas.
    * Historial visual: poder ver "fotos" del odontograma en diferentes fechas para ver la evolución del paciente.

* **Dashboard "Morning Huddle":** Un tablero específico para empezar el día. Cada mañana, el equipo se reúne y este dashboard les muestra:
    * Pacientes agendados para hoy.
    * **Oportunidades del día:** Alertas como "Juan Pérez tiene un saldo pendiente de $500" o "Ana García tiene un plan de tratamiento aprobado sin agendar".
    * Meta de facturación del día y cuánto falta para alcanzarla.
    * Cumpleaños de pacientes del día.

* **Análisis de Rentabilidad por Servicio:** Ya tienes todos los datos para esto. Necesitamos un reporte que muestre:
    * ¿Cuál es el servicio más rentable (mayor margen de ganancia)?
    * ¿Cuál es el servicio que más se vende?
    * Análisis de "Costo vs. Ingreso vs. Tiempo" para cada servicio.

#### **Prompt para la IA de codificación:**
> "Desarrolla el componente de **Odontograma Interactivo** usando SVG o Canvas. Debe mostrar una representación estándar de una dentadura adulta e infantil. Cada diente y superficie debe ser clickeable. Al hacer clic, debe abrir un menú para registrar hallazgos (ej: Caries, Restauración, Ausente). El estado de cada diente debe guardarse en la base de datos, asociado al paciente y a una fecha."

### **Qué podemos reconsiderar o simplificar inicialmente**

* **Complejidad del Tracking de Referidos:** Tu idea de un tracking de referidos multi-nivel con valor acumulado es muy potente, pero compleja de implementar y de usar al inicio.
    * **Sugerencia:** Empecemos con un sistema de referidos de **un solo nivel**. Es decir, registrar quién refirió a quién y punto. Los reportes pueden mostrar "Top 5 pacientes que más refieren". Esto ya aporta el 80% del valor con el 20% del esfuerzo.
* **Roles de Usuario Granulares:** El sistema de roles que planteas (Propietario, Superadmin, Admin, Editor, Lector) es excelente para una app madura.
    * **Sugerencia:** Para el lanzamiento inicial, podemos simplificar a 3 roles: **Propietario** (control total), **Odontólogo/Editor** (gestión clínica y de pacientes) y **Recepcionista/Lector** (agenda y consulta, sin datos financieros). Esto facilitará el desarrollo y la adopción inicial.

Con estos ajustes, Laralis no solo será un reflejo digital de una hoja de cálculo, sino un producto digital competitivo, centrado en el usuario y preparado para el futuro de la odontología.

Estoy listo para empezar a crear los prompts para la primera de estas mejoras. ¿Por cuál te gustaría comenzar?

---

## grok_caracteristicas_a_añadir_a_la_app.md
### Mejoras Recomendadas para la Descripción de la Aplicación: Una Visión Experta del Mercado en 2025

Como experto en productos digitales con un enfoque en el sector salud y dental, he analizado el panorama actual del software de gestión para clínicas dentales (PMS, por sus siglas en inglés) basado en tendencias del 2025. El mercado está dominado por soluciones como Dentrix, Open Dental, Curve Dental, Eaglesoft, CareStack, Tab32 y Denticon, que enfatizan la integración de IA, cloud computing, analytics predictivos y experiencias móviles para pacientes. Estas plataformas no solo replican hojas de cálculo como Google Sheets, sino que evolucionan hacia ecosistemas inteligentes que mejoran la eficiencia operativa, la retención de pacientes y el cumplimiento regulatorio (como HIPAA en EE.UU. o equivalentes globales).

Tu descripción es sólida como un espejo fiel de un sistema interconectado y financiero-centrado, pero para posicionarla como una "premonición" competitiva, debe evolucionar hacia un enfoque más innovador, centrado en el usuario y escalable. Basado en la competencia y tendencias (e.g., adopción masiva de IA para diagnósticos, cloud para multi-locaciones y analytics para ROI), sugiero cambios, adiciones y supresiones específicas. Estas recomendaciones buscan hacer la app más atractiva para inversores, usuarios y el mercado en expansión de DSOs (Dental Service Organizations), donde el crecimiento proyectado es del 10-15% anual gracias a la digitalización.

#### 1. **Adiciones Recomendadas: Incorporar Tendencias Emergentes para Mayor Innovación y Diferenciación**
   Para diferenciarse de competidores como CareStack (AI-powered) o Tab32 (cloud con patient engagement), añade features que aprovechen IA, movilidad y sostenibilidad. Estas no solo modernizan el sistema, sino que abordan dolores comunes como la retención de pacientes (baja en un 20-30% en prácticas tradicionales) y la ciberseguridad (ataques aumentaron 50% en salud en 2024-2025).

   - **Integración de IA y Machine Learning:**
     - Añade IA para diagnósticos predictivos y análisis de imágenes: Por ejemplo, algoritmos que analicen rayos X o scans intraorales para detectar caries, periodontitis o anomalías tempranas, similar a Pearl AI o Overjet. Esto podría integrarse en la sección de "Registro de Tratamientos" para sugerir planes basados en datos históricos, reduciendo errores humanos en un 25-40% según estudios de 2025.
     - Predictive analytics para retención y marketing: En el "Reporte de Vías de Ingreso/Marketing", incorpora IA que prediga churn de pacientes (e.g., basándose en frecuencia de visitas y fuentes), sugiera campañas personalizadas o calcule Lifetime Value con mayor precisión. Competidores como Adit usan esto para ROI en ads, con retornos hasta 5x.
     - Chatbots y asistentes virtuales: En "Gestión de Fuentes y Marketing", añade un chatbot impulsado por IA para reminders automáticos, scheduling y consultas iniciales via app móvil, reduciendo no-shows en un 30% (como en Weave).

   - **Funcionalidades Cloud y Móviles:**
     - Haz el sistema fully cloud-based: Similar a Curve Dental o Denticon, permite acceso remoto multi-dispositivo, backups automáticos y escalabilidad para DSOs. En "Arquitectura Multi-Tenant", enfatiza integración con apps móviles para pacientes (e.g., portal para ver historiales, pagar facturas o agendar), alineado con tendencias donde el 70% de pacientes prefieren interacciones digitales.
     - Teleodontología y VR/AR: Añade soporte para consultas virtuales y simulaciones AR para planes de tratamiento (e.g., visualizar resinas o implantes), como en 3Shape. Esto es clave en 2025 con el auge post-pandemia.

   - **Analytics Avanzados y Sostenibilidad:**
     - En "Sistema de Reportes Integrado", incorpora dashboards con IA para insights en tiempo real: e.g., pronósticos de ingresos, optimización de staff via heat maps de productividad, o análisis cohort de pacientes por fuente. CareStack destaca aquí con KPIs consolidados para multi-locaciones.
     - Sostenibilidad: Añade tracking de waste en insumos (e.g., alertas para materiales ecológicos o reducción de papel), alineado con regulaciones ambientales crecientes en 2025.

   - **Integraciones Externas:**
     - Con pagos digitales (e.g., Stripe, PayPal), seguros (verificación automática de elegibilidad) y EHR externos. Esto resuelve dolores en "Cuentas por Cobrar" y compite con Eaglesoft's integrations.

   | Feature Añadida | Beneficio Basado en Mercado | Competidor Similar |
   |-----------------|----------------------------|---------------------|
   | IA para Diagnósticos Predictivos | Mejora precisión en 30-50%; reduce costos por detección temprana | Pearl, Overjet |
   | App Móvil para Pacientes | Aumenta retención en 25%; engagement digital | Tab32, Weave |
   | Analytics Predictivos | ROI en marketing hasta 4x; optimiza recursos | CareStack, Adit |
   | Teleodontología | Acceso remoto; crece 20% anual | Curve Dental |

#### 2. **Cambios Recomendados: Modernizar y Simplificar para Mejor UX y Escalabilidad**
   Tu descripción es detallada pero algo rígida y hardcodeada, lo que contrasta con el enfoque flexible de competidores como Open Dental (open-source customizable). Cambia para enfatizar adaptabilidad, reduciendo el énfasis en flujos "inmutables" que podrían desanimar a usuarios en un mercado dinámico.

   - **De Hardcoded a Dinámico y Customizable:**
     - En "Sistema de Configuración de Categorías", elimina el hardcoding y haz todo editable via IA: e.g., categorías auto-sugeridas basadas en datos de uso, como en Denticon. Esto permite personalización rápida sin código, ideal para especialidades variadas (ortodoncia, periodoncia).
     - Flujo de Configuración: Hazlo más flexible; permite saltos condicionales (e.g., si no hay depreciación, usa defaults AI-generados). Competidores como Dentrix Ascend usan wizards intuitivos para onboarding.

   - **Enfoque en UX/UI Moderna:**
     - Reescribe "Organización de la Configuración" como mobile-first y gamificada: e.g., dashboards con visuales interactivos (gauges, heat maps) y notificaciones push, como en Curve Dental. Reduce complejidad en fases; integra un wizard AI que guíe setups basados en datos iniciales.

   - **Roles y Permisos Más Granulares:**
     - En "Sistema de Roles y Permisos", añade roles híbridos (e.g., "AI Analyst" para staff que use analytics) y permisos basados en IA (e.g., auto-restricciones por compliance). Alinea con tendencias de seguridad, donde el 80% de brechas son por accesos humanos.

   - **Validaciones y Actualizaciones:**
     - Cambia a validaciones AI-proactivas: e.g., en "Validaciones de Dependencia", usa ML para predecir impactos de cambios y sugerir ajustes automáticos, reduciendo errores en cascada.

   Estos cambios hacen la app más user-friendly, compitiendo con la simplicidad de Curve Dental mientras mantiene tu interconexión financiera.

#### 3. **Supresiones Recomendadas: Eliminar Redundancias y Elementos Obsoletos para Enfoque Ágil**
   En un mercado donde el 60% de PMS fallan por sobrecarga de features (según reseñas en Capterra 2025), suprime elementos que dupliquen o compliquen innecesariamente, enfocándote en valor core.

   - **Eliminar Hardcoding y Duplicidades:**
     - Suprime menciones a valores "hardcodeados" en "FASE 1: Depreciación" y "FASE 2: Costos Fijos"; hazlos dinámicos con templates AI. Esto evita obsolescencia, como en legacy systems como Eaglesoft.
     - En "Configuración del Sistema", elimina duplicidades entre "Global" y "Por Clínica" (e.g., categorías maestras); únelas en un framework unificado para simplicidad.

   - **Reducir Rigidez en Flujos:**
     - Suprime el "Orden Crítico e Inmutable" en "Flujo de Configuración"; hazlo modular. Competidores permiten setups paralelos, evitando frustración en onboarding.

   - **Eliminar Elementos No Esenciales:**
     - En "Sistema de Fuentes y Marketing", suprime tracking multinivel manual de referidos si no es IA-automático; enfócate en analytics agregados para evitar complejidad.
     - Quita énfasis en "Commit del Código Actual" en "Instrucción Crítica Final"; esto es interno de desarrollo, no relevante para la descripción del producto.

   Estas supresiones agilizan la descripción, haciendola más atractiva y alineada con PMS lean como Practice-Web.

#### Conclusión: Posicionando la App para el Éxito en 2025
Con estas mejoras, tu app no solo replica Sheets, sino que se convierte en un PMS inteligente y escalable, compitiendo directamente con líderes como CareStack en IA y Denticon en multi-tenant. El mercado valora soluciones que ahorren tiempo (hasta 40% en admin via AI) y mejoren ingresos (15-20% via analytics). Recomiendo priorizar un MVP con IA básica y cloud, probando con beta users en DSOs. Si implementas esto, podrías capturar el creciente segmento de prácticas digitales, proyectado en $3.5B global para 2025. Si necesitas más detalles o un roadmap, avísame.

---

## initial_idea.md
Bueno, y recuerda también de que casi siempre todos los datos estaban interconectados. Uno primero configuraba una cosa y después eso se interconectaba con lo otro. Hay que establecer también entonces validaciones. Yo creo que hay cosas que debieran convivir en como una especie de configuración inicial imprescindible. Y después de eso es que se pudiera utilizar lo que se utiliza diariamente, que es el registro de paciente y el registro de tratamiento. Yo no sé si tú lo estás leyendo en la idea inicial, en la idea del LMD, pero lo primero que uno hace creo es establecer la depreciación, porque son cosas arcodiadas que no tienen fórmula ni nada, no salen de otras tablas ni nada. Tú estableces la depreciación que te da un total de inversión. Y después los años a depreciar, los meses para depreciar. Y el único cálculo de ahí es la depreciación mensual, que no es más nada que el total de inversión entre los meses a depreciar en que tú quieres pagar esa inversión. Entonces después de establecer eso, tú estableces creo yo los costos fijos, que también son todos arcodiados. O sea, tú pones el número y se acabó, y no hay fórmula ni nada en la tabla. Lo único que pasa es que a los costos fijos le sumas el fondo de depreciación que ya se calculó anteriormente, que era la depreciación mensual. Y eso te da la suma total mensual de costos fijos. Y todavía eso es arcodiado. Todo eso lo tienes que configurar antes de empezar a utilizar la aplicación, creo yo, en cada clínica. Después los costos por tiempo. Tú pones ahí arcodiado tus días laborales, tus horas por día, horas por mes planeadas. Vienen a ser la multiplicación entre los días laborales y las horas por día. Eso sí tiene ya una fórmula. Y las horas reales, el porcentaje de horas reales, eso lo estableces tú. Dices, bueno, yo creo que sea el 80%, el 85%, el 75%, el 90%. Y entonces el cálculo que sí te da es las horas reales por mes, que no es más nada que las horas reales por mes planeadas por el porcentaje de horas reales. Por ejemplo, si los días laborales son 20, las horas por día son 7, las horas por mes planeadas son entonces 140. Pero si el porcentaje de horas reales es 80%, las horas reales por mes es 112. Luego vienen los costos por tiempo. ¿Qué es lo que haces? Tomas de la tabla de costos fijos el costo fijo mensual, la suma total mensual. Y entonces estableces el costo fijo por hora, que no es más nada que la división entre el costo fijo mensual entre las horas reales por mes. Y eso te da el costo fijo por minuto, porque lo único que haces es multiplicar el costo fijo por hora por 60. Por ejemplo, si el total de costos fijos mensuales es 18,545.33, el costo fijo por hora viene a ser 165.58 en el caso de que las horas reales por mes sean 112. Y entonces el costo fijo por minuto viene a ser 2.76. Y así se hace. Ya cuando tienes esas tres cosas, depreciación, costo fijo y costo por tiempo, ya ahí tú puedes poner, por ejemplo, los costos variables de insumo, que también son hardcodeados. Pones el insumo, la presentación, el precio por presentación, las porciones, y eso entonces te da un costo por porción. Y cuando tienes todos esos insumos, ya tú puedes crear los costos variables de cada servicio. Creas un costo variable de un servicio llamado valoración, un costo variable de un servicio llamado limpieza dental, que es lo que hace, tienes que tener un selector, que eso te lo hace todo solo, porque tú ahí lo único que tienes que poner es el insumo específicamente y la cantidad. Y ya lo otro tiene que calcularse solo. Y eso te da entonces el total de costo variable de ese servicio específico. Creo que también nos faltaría, antes de los costos variables, digo, antes de los... Bueno, no. Creo que falta ahí el punto de equilibrio, que es un poco difícil, porque es un poco a Pepe, es un poco a lo que uno diga. ¿Por qué razón? Porque el total de costos fijos mensuales, si lo tenemos, el costo variable promedio estimado es el que, por ejemplo, se puede poner 35%, 40%, eso es hardcodeado. Y el margen de contribución, a no ser que tú digas algo distinto, a no ser que tú pienses que hay otra forma de hacerlo mejor. Pero el margen de contribución viene a ser entonces lo que resta del costo variable promedio estimado. Por ejemplo, si el total de costos fijos mensuales es de 18,545.33 y el costo variable promedio estimado tú lo defines en el 35%, el margen de contribución es el 65%. Y entonces el ingreso del punto de equilibrio mensual viene a ser la división entre el total de costos fijos mensuales entre el margen de contribución. Y eso en este caso hipotético te da un 28,531.28. Eso es tu punto de equilibrio, eso te va a servir para el dashboard y para saber si te estás acercando, te estás alejando, etc. Entonces tú estableces, como hablamos, los costos variables de insumo, después estableces entonces las tarifas, que es lo último para configurar. Tienes que establecer las tarifas de los servicios de costo variable que ya tienes, no puedes inventarlas. Hay cosas que salen de otros lugares, no se pueden inventar, son selectores. Si tú quieres crear una nueva, tienes que crear, por ejemplo, si tú quieres crear una nueva tarifa, que es por el servicio, tienes que crear un nuevo costo variable. Y si ese costo variable de ese servicio incluye algún insumo que no has creado, tienes que crear primero el insumo. Si no, no se puede. Entonces estableces la tarifa. La tarifa tiene una pila de cosas que saca de otros lugares. O sea, en la tarifa tú defines el tiempo estimado del servicio. Por ejemplo, en el caso de limpieza dental, tú defines que son 60 minutos. Pero ya tú tienes el costo fijo por minuto y eso se calcula automáticamente. Entonces el costo fijo por tratamiento ya lo tienes. Y el costo variable por tratamiento también ya lo tienes. Todo eso se suma. Para lograr un costo total sin ganancia. Que le podemos llamar de otra forma más inteligente y mejor, pero bueno, te digo. Y entonces ahí tú le estableces la utilidad deseada. Luego esa utilidad deseada se te dice cuál es el monto de utilidad que tú estás teniendo. Por supuesto, porque si, por ejemplo, si el costo de una limpieza dental, el costo total es de 198.76 y la utilidad deseada es del 40%, entonces el monto de utilidad que tú estás ganando es 79.51. Y después estableces hardcodeado, bueno, hardcodeado no, perdón. Después eso sirve para calcular el monto de venta final. ¿Por qué? Porque si tú sumas el costo total sin ganancia más el monto de utilidad, eso te da el precio de venta final. Por ejemplo, si el costo total sin ganancia es de 198.76 y el monto de utilidad es 79.51, entonces el precio de venta final es de 278.27. Pero tú no puedes vender así un servicio. Por eso es que siempre hay un precio final redondeado. Ese precio final redondeado utiliza una fórmula de Google Sheet llamada round.mult, algo así. Que lo que toma es el precio de venta final por una coma y la segunda cifra es un 50. Y eso te da un 300. No sé cómo tú lo verás aquí, pero la idea es tener esos montos redondos. Ya ahí tú tienes las tarifas. Entonces lo que tú haces todos los días es trabajar en los pacientes y el registro de tratamientos y ver el dashboard. Bueno, y cambiar a veces, a veces tú cambias y creas un nuevo servicio. Para eso, digo, una nueva tarifa, que siempre es un nuevo servicio y que para eso tienes que crear un nuevo costo variable de valoración. Editas a veces la depreciación, los costos fijos, porque algunas cosas te cambian. Eso tenemos que ver después los cambios. Eso lo editamos después, pero por ahora al menos está así con lo que tenemos.

Entonces, ¿de qué trata esta aplicación? No es más nada que una aplicación con el objetivo de que mi esposa, que tiene un consultorio dental, pueda registrar todo lo necesario en datos y esos datos se puedan consultar fácilmente. Y copiar y saber y llegar a conclusiones de cuántos pacientes atendieron en un periodo de tiempo, o sea, cuáles fueron los gastos y actualizar esos gastos, cuánto es el registro de pacientes. De hecho, todo pasa a la tabla. Esa aplicación que yo quiero es un reemplazo de esta tabla para que haga las cosas que esta tabla hace. Yo no sé si tú eres capaz de ver las fórmulas internas de la tabla, porque las fórmulas te van a decir mucho. Está todo interconectado. Es decir, tú creas primero un paciente. De hecho, te lo voy a describir un poco. Te lo voy a describir un poco con palabras. A ver, tenemos varias pestañas en esta tabla de documentos de sheet. Spreadsheet, creo que es. Tenemos dashboard, registro de tratamiento, pacientes, tarifas, punto de equilibrio, costo variable de insumo, los diversos costos variables de servicio, valoración, o sea, C de valoración, que es costo variable de valoración, C de limpieza dental, que es costo variable de limpieza dental, C de resina posterior, que es costo variable de resina posterior, y así. Depreciación, costo fijo y costo por tiempo. Esas son las pestañas. Entonces, el dashboard de alguna manera recoge todo lo demás. ¿Cómo funciona esto? Bueno, a ver. Ella lo primero que hace creo que es que establece los días laborales, las horas por día, las horas por mes, el porciento de horas reales, y a eso le da unas horas reales por mes. Y luego establece el total de costo fijo mensual. Y ese total de costo fijo mensual sale de otro lugar, que ahora no sé. A ver, sale de costo fijo en C10 de la tabla de costo fijo. Es el primero que establece su costo fijo, que es lo más fácil y lo más arqueado. Los costos fijos son el local, o sea, ella establece la categoría y el concepto. Local, concepto renta, monto 3.000 pesos. Todo eso sí está sin fórmula. Local, luz, costo 250. Local, agua, costo 200 y así. Provisiones, educación continua, costo 900. Provisiones, publicidad, costo 2.000. Provisiones, rutas y mantenimiento, costo 417 y así. Fondo de depreciación, depreciación mensual, costo total. Ah, no, ahí la depreciación mensual sí tiene una fórmula, que creo que es depreciación... Ah, claro, porque la depreciación es otra tabla. Entonces lo primero que establece es la depreciación, donde hay una tabla de inversión y una tabla de depreciación mensual. La autoclave es de 7.500, que es lo que costó. La caja reveladora, 500 y así, un total de inversión de 67.000, que es la suma de todo. Años para depreciar, valor 3. Meses para depreciar, valor 36. Que eso sí es multiplicar los 3 años por 12. Depreciación mensual te da un costo, que es dividir, creo que es dividir el total de inversión entre los meses para depreciar. Y ahí te da la depreciación mensual. Entonces en costo fijo tú terminas con el fondo de depreciación, que viene a ser esa depreciación mensual, y la suma total mensual de esos costos fijos más el fondo de depreciación es lo que te da la suma total mensual de costo fijo. Y entonces después el costo por tiempo tiene el costo fijo mensual, que ya lo sacaste de la otra tabla. Sacas el costo fijo por hora, que es el costo fijo mensual entre la cantidad de horas reales por mes y te da un costo fijo por minuto. Fíjate, eso nada más son esas dos hojas.  Entonces, ya cuando tienes la depreciación, después los costos fijos y después los costos por tiempo, creo que después de eso tienes que establecer los costos variables de insumo. Porque ya tienes todos los costos fijos y ahora los costos variables te faltan de insumo. ¿Qué son los costos variables de insumo? Tú añades un insumo, la categoría del insumo. Por ejemplo, el insumo puede ser aguja, la categoría anestesia. La categoría no sé hasta qué punto sea. Deben ser tags más bien porque son muy relativos. La presentación, en este caso, por ejemplo, de anestesia sería caja. Porque es como tú la compras, como una caja. Precio de presentación 162 pesos. Porciones por presentación 100. Costo por porción 1.62. Entonces, al final ese costo por porción te va a hacer falta. Es el que te va a hacer falta. Porque el costo por porción es el precio de presentación entre la cantidad de porciones. Hay que ver eso bien porque esto es difícil. A veces hemos tenido que, después que nos compramos una caja, sino que lo que compramos es, qué sé yo, un bote que tiene otro estilo. Y nos cuesta trabajo actualizar la tabla. Eso hay que pensarlo mejor. Pero el punto es que eso no sirve para tener un costo por porción porque después vamos a decir cuántas porciones se utilizan por servicio. Después vamos a ir, por ejemplo, al costo. Después vamos a crear los costos variables por servicio. Después que tú creas todos los insumos, ya tú puedes entonces decir, a ver, vas a los insumos, o sea, creas un nuevo servicio que es limpieza dental. Entonces el costo variable de limpieza dental va a ser guantes, cubrebocas, gasas, cepillo, campo, lubricante, alcohol. Entonces todo esto ya lo tienes en los costos variables de insumo. Lo tienes arcodeado allá. Entonces el costo variable por servicio va a ser, bueno, a ver, el insumo requerido, cuántas cantidades de él lo multiplicas por el costo por porción y eso te da el costo total del insumo. Porque a veces se gasta más, a veces se gasta menos. Y eso te da un total de costo variable de limpieza dental cuando tú sumas todo eso. Y así con todo, tú creas todos los servicios que tú quieras con los costos variables de insumo. Eso nada más te está dando el costo variable de cada servicio, no te está dando el costo total del servicio. Entonces tú después tienes una tabla de punto de equilibrio. Ese punto de equilibrio tiene total de costos fijos mensuales que tú lo sacas de la tabla de costos fijos. Tienes el porcentaje de costo variable promedio estimado. Creo que esto lo sacas de la manga. Y el margen de contribución que ahora mismo no sé lo que es. Ah, sí, el margen de contribución es 1 menos el 75%. Queda un 65%. Y bueno, ya el ingreso de punto de equilibrio mensual es más bien el total de costos fijos mensuales entre el margen de contribución. Y eso te da el punto de equilibrio. El punto de equilibrio te va a servir después para el dashboard, para saber si estás por debajo, por encima, por dónde vas, tu pronóstico, etc. Las tarifas, en este caso, las estableces también. ¿Cómo las estableces? Bueno, tú eliges uno de los servicios que creaste a través del costo variable por servicio. Por ejemplo, en el caso, seguimos con el caso de la limpieza dental, uno de los servicios. Y ahí tú vas a ver, tú estableces el tiempo estimado de su servicio. Y ya tenemos establecido el costo por minuto, que se saca de la tabla de costo por tiempo. O sea, el costo fijo por minuto. Tenemos el costo fijo por tratamiento, que no es más nada que la multiplicación de minutos por el costo fijo por minuto. El costo variable por tratamiento ya lo tenemos de la tabla de la hoja de costo variable. El costo total sin ganancia no es más nada entonces que la suma del costo fijo del tratamiento más el costo variable del tratamiento. Luego, tu utilidad deseada, tú le dices un 40%, la utilidad que tú quieras. Y eso te da el monto de utilidad. El monto de utilidad es el costo total sin ganancia por, creo que tiene sentido, pero ahora no lo tengo claro, por la utilidad deseada. O sea, en este caso, por ejemplo, si el costo total es de 198.76 y la utilidad deseada es del 40%, tú vas a multiplicar 198.76 por 40% y te va a dar el monto de utilidad. Que es como lo que tú quieres ganar por ese servicio. Y el precio de venta final viene a ser entonces la suma del costo total sin ganancia más el monto de utilidad. Y eso te da el precio de venta final. Que en este caso sería 278.27, por ejemplo. Y terminas con un precio redondeado que tú redondeas, por ejemplo, con una fórmula de redondeo.multip que redondeas el precio de venta final a 50, creo que es una cosa de esas, una fórmula de Excel. Y termina dando 300. El de 278 termina dando 300, el de 405 termina dando 400, el de 918 termina dando 900 y así. El de 80 te da 100, el de 124 se redondea a 100, el de 1378 se redondea a 1400 y así. Y eso te da un precio redondeado. Eso debería ser opcional, pero ahí está. Entonces, eso sería las tarifas. Esa sería la hoja de tarifas. Luego está la hoja de paciente, que ahí empezamos con lo que sucede en el día a día, lo que tú registras en el día a día, porque todo eso fue como la configuración del negocio. 

esto al estilo de m metricool tenemos que crear un lugatr donde crear espacios de trabajo, en metricool esos son marcas,
   y cada espacio de trabajo puede tener muchas clinicas, y eso en metricool son las conexiones de cada marca. y la app 
  deberia darme un onboardin inicial de como funciona y deberia guiarte en la configuracion inicial de tu primer espacio 
  de trabjo y tu primera clinico. luego puedes tene un lugar donde cambiaer le nombre de todo , del espacio de tranajo uy 
  de las clinicas, y sus cescripciones. aun no establecemos atenticacion pero Esto debe ser espacios de trabajo estilo 
  Metricol, no por la UI, sino te estoy tratando de explicar cómo sería su función. O sea, las marcas son lo que aquí son 
  los espacios de trabajo. Y Metricol tiene conexiones en cada marca, que aquí serían las clínicas. Cada clínica tiene su 
  propio número de pacientes, o sea, cantidad de sus pacientes, su tratamiento, toda su estructura, su precio, todo. Pero 
  en cuanto a los pacientes, sí uno puede ver un total de todos los pacientes de todas sus clínicas. Eso sí lo puede ver, 
  que se comparten de todas las clínicas. Igual que en el dashboard se pueden ver métricas del espacio de trabajo y
  métricas específicas de cada clínica. Eso sí se puede hacer. Igual que en Metricol se puede ver una métrica de toda la       
  marca y métricas de cada una de las conexiones, Facebook, Instagram, etc. Entonces, se pueden asignar e invitar otros        
  usuarios al espacio de trabajo y asignarles roles. Por ejemplo, roles en clínicas específicas o en todas, si uno quiere.     
   Por ejemplo, rol de lector que solo lee lo que se le asigna, que se le puede asignar clínica o todo el espacio de
  trabajo, pero bueno, lo que sea lo lee. Y también tú puedes decir que lea las configuraciones y la facturación y todo        
  eso, o que lea nada más el registro de pacientes y los pacientes. O solamente el registro de tratamiento. O sea, el
  registro de tratamiento de los pacientes, solamente el registro de tratamiento. Rol de editor que puede añadir
  tratamientos y también puede añadir pacientes, pero no configura el negocio, no configura la depreciación, no configura      
  el costo fijo, nada de eso. Rol de superadministrador que sí configura el negocio y además puede hacer todo lo que hacen     
   los demás. Y el rol de propietario. Ah, no, y el rol de superadministrador también hace pagos con los métodos de pagos      
  que ya están hechos. Y ve la facturación de todo, de la clínica y de todo. El rol de administrador no ve cuando se está      
  ganando ni los reportes de dinero. Solo los reportes de pacientes. Ni de utilidades, ni ve la configuración. O sea, él       
  puede, o sea, no configura. O sea, él configura el negocio, pero no ve el resultado de todo eso. Y el rol de
  superadministrador puede añadir administradores. El rol de administrador no puede añadir. Pero el rol de administrador       
  sí puede ejecutar pagos. Y el rol de propietario. Este rol no se puede asignar y solo es para un usuario, el que se
  registró y creó el espacio de trabajo por primera vez. Lo que sí se puede hacer es transferirse. Y una vez que se ha
  transferido, el anterior propietario pasa a tener rol de administrador. Y el propietario nuevo lo puede eliminar. El
  propietario establece nuevos métodos de pago. Claro, todo el sistema de facturación y pago. Cuando hablo de pago, hablo      
  de pagos a la aplicación. No está todavía. ni debe estar

 En la idea inicial todas las cosas están conectadas de una manera u otra. Para que al final una persona registre un paciente, registre un nuevo tratamiento y eso le diga todo. Y haya reportes de todo. Ah, una cosa muy importante. Las campañas de publicidad. Tenemos que tener un apartado quizás, una página de fuentes. Quizás es para los pacientes, sí. Fuentes para los pacientes que nos digan cuándo un tratamiento, cuándo un paciente vino por una fuente determinada. Tú puedes crear las fuentes, por ejemplo, puedes crear campañas de Facebook Ads, campañas de Google Ads. Puedes crear publicaciones de tal lado, puedes crear no sé qué. Y en esa fuente también puedes crear referido. Que es referido de otro paciente que tú tengas en tu base de datos. Y es que tenemos que ser capaces de saber de dónde vinieron los pacientes y cuántos tratamientos se han hecho. O sea, después clasificar por fuentes para saber, por ejemplo, tal paciente que vino por Facebook Ads, se ha hecho tantos tratamientos de este tipo, tantos tratamientos de otro y ha referido tantos otros pacientes. Y entonces también tener como una especie de lugar donde podamos saber si ese paciente vino en tal semana específica. En esta semana, cuánto se ganó por tal fuente, por Facebook Ads. Porque es la primera vez que llega. Ya después, y hay que tener un filtro. O sea, ¿qué pasa? Porque si yo digo, en este mes cuánto se ganó por Facebook Ads, puede ser que sea que el mismo paciente vino una y otra y otra vez. Por lo tanto, tiene que haber un filtro de pacientes, de únicamente pacientes nuevos. No pacientes recurrentes. No tratamientos de pacientes recurrentes, sino tratamientos de pacientes nuevos. Y que ese paciente nuevo haya venido de la fuente tal que configuraste en Facebook Ads campaña. Y eso te ayuda a saber cuánto se generó en ese tiempo. 

 Necesitamos introducir un input adicional en el formulario del paciente nuevo. Este input adicional debe estar conectado a la
  base de datos de tal manera que se encuentre su relación para consultas SQL o consultas en la dependencia de la base de datos
  que tengamos, si suficientes acerca de por qué vía llegó el paciente. Las vías tienen que ser personalizables. Tenemos que
  tener una configuración de vías, así como tenemos que tener una configuración de categorías. La configuración de categorías
  nos falta. Por ejemplo, están diversas categorías, categoría de insumos, categoría de servicios, y esas categorías están
  hardcodeadas, no deberían estar hardcodeadas. Deben estar colocadas de tal forma que podamos modificarlas. Y eso no lo estamos
   teniendo en este momento. Está muy desordenado el tema de la configuración. Está en una sola vista y se necesita que sea una
  configuración con las mejores técnicas de UI, UX, UI. Y además hay un problema en la nomenclatura, y es que tenemos un menú de
   configuración con todos los costos fijos, etc. Y luego tenemos una configuración del perfil que también tiene todos los
  costos fijos. Es repetirlo por gusto y creo que no es lo más adecuado. Una cosa es la configuración del sistema y otra cosa es
   la configuración de una técnica, que pudiéramos llamarle de otra forma. Además, necesitamos que estas vías de donde llega el
  paciente puedan ser consultables, filtrables. En estos momentos el tema de los reportes es muy básico y necesitamos poder
  filtrar por fecha en esos reportes. Y además los reportes del home no están conectados o por lo menos no muestran datos. Sin
  embargo, los reportes dentro de su menú de operaciones sí muestran los datos. Por lo del home tiene que estar sincronizado.
  Además tenemos que organizarlo. Creo que al final en ese home podemos tener luego varias cosas. Así que por ahora lo más
  importante sería tener los reportes, la actividad reciente en el home, algunos reportes y algunos accesos directos como tienes
   aquí. Eso está bien, pero tienen que estar sincronizados con nosotros también. Muy importante es la capacidad que tiene que
  tener el sistema para asociar los recomendados. Porque un paciente puede haber recomendado a varios pacientes y uno tiene que
  saber qué paciente recomendó a cuántos pacientes. Además uno tiene que establecer filtros para saber si los pacientes de este
  mes que facturaron más de tanto, por ejemplo, con un slider o con algo de filtro, fueron por qué vías. Y poder diferenciar
  cuando un paciente vino de una campaña, pero después siguió viniendo regularmente. Un paciente estacional a un paciente nuevo.
   Pero esas no son configuraciones automáticas que por supuesto el sistema con todos los datos que tiene ya puede sacar. Porque
   un paciente puede haber facturado por primera vez la campaña. Por eso necesitamos un reporte de marketing también. O un
  reporte más bien de vías de ingreso. Porque necesitamos saber qué vía está dando más dinero, en qué tiempo específico, en qué
  filtro de tiempo específico. Cuántos pacientes trajo en qué tiempo de filtro específico tal vía. Un gráfico de pastel que
  podemos tener también. No en la parte de los reportes, pero en la parte de lo que sea del dashboard, el home, sí puede tener
  gráficos de pastel, gráficos de barra, etc. ¿Cuántos pacientes vinieron en dependencia de la vía? ¿Cuánto se facturó en
  dependencia de la vía? Todas esas cosas son importantes.


---

## mvp_sin_cambios.md
# Sistema de Gestión Integral para Consultorio Dental - Documentación Completa y Detallada

## Contexto y Objetivo del Proyecto

Este sistema surge de una necesidad concreta y real: reemplazar las hojas de cálculo de Google Sheets que actualmente gestiona el consultorio dental de mi esposa. La característica fundamental y más crítica de este sistema es que absolutamente todos los datos están interconectados: cada configuración inicial alimenta a la siguiente, creando una cascada de información perfectamente orquestada que culmina en el registro diario de pacientes y tratamientos.

La aplicación debe replicar exactamente la funcionalidad de las tablas actuales, pero transformándola en una interfaz moderna que permita registrar, consultar y analizar datos de manera eficiente. Las fórmulas internas del spreadsheet actual revelan la complejidad de estas interconexiones - cada celda, cada cálculo, cada referencia cruzada nos dice mucho sobre cómo debe fluir la información. Todo está interconectado: cuando cambias un valor en depreciación, afecta los costos fijos; cuando modificas los costos fijos, impacta en los costos por tiempo; cuando ajustas los costos por tiempo, se recalculan todas las tarifas.

El objetivo final es poder registrar todo lo necesario en datos y que esos datos se puedan consultar fácilmente para llegar a conclusiones precisas: cuántos pacientes se atendieron en un periodo de tiempo, cuáles fueron los gastos exactos, cómo actualizar esos gastos cuando cambian los precios, mantener un registro completo de pacientes y sus tratamientos, y sobre todo, tener reportes que permitan tomar decisiones informadas sobre el negocio.

## Estructura Original del Spreadsheet que Debemos Replicar

El documento actual de Google Sheets contiene las siguientes pestañas, cada una con una función específica y crítica en el sistema:

- **Dashboard**: La pestaña maestra que de alguna manera recoge todo lo demás, consolidando toda la información del sistema en métricas y visualizaciones clave
- **Registro de tratamiento**: El histórico completo de todos los servicios realizados, fecha por fecha, paciente por paciente
- **Pacientes**: La base de datos completa de clientes con toda su información personal y clínica
- **Tarifas**: Los precios finales de servicios, calculados automáticamente basándose en costos y utilidad deseada
- **Punto de equilibrio**: Los cálculos financieros críticos que determinan la viabilidad del negocio
- **Costo variable de insumo**: El catálogo completo de materiales con sus precios y presentaciones
- **Costos variables de servicios**: El desglose detallado por tipo de tratamiento, con pestañas individuales:
  - C de valoración (costo variable de valoración)
  - C de limpieza dental (costo variable de limpieza dental)  
  - C de resina posterior (costo variable de resina posterior)
  - C de resina anterior
  - C de extracción simple
  - C de endodoncia
  - Y así sucesivamente para cada servicio que ofrece la clínica...
- **Depreciación**: La amortización de equipos con sus cálculos mensuales
- **Costo fijo**: Todos los gastos operativos constantes del negocio
- **Costo por tiempo**: Los cálculos de eficiencia horaria que determinan cuánto cuesta cada minuto de operación

## Flujo de Configuración: El Orden Crítico e Inmutable de Implementación

### FASE 1: Depreciación - La Base Fundamental del Sistema

Lo primero que uno hace, siempre, sin excepción, es establecer la depreciación. ¿Por qué? Porque son cosas completamente hardcodeadas que no tienen fórmula, no salen de otras tablas, no dependen de nada más. Son el punto de partida absoluto del sistema.

**Tabla de Inversión en Equipos:**
Aquí se registra cada equipo dental con su costo de adquisición:
- Autoclave: $7,500 (lo que costó cuando se compró)
- Caja reveladora: $500
- Lámpara de fotocurado: $3,200
- Compresor: $8,500
- Unidad dental: $35,000
- Rayos X: $12,300
- Instrumental básico: $5,000
- **Total de inversión**: $67,000 (suma automática de todos los equipos)

**Parámetros de Depreciación:**
- Años para depreciar: 3 (este valor lo define el usuario según su estrategia financiera)
- Meses para depreciar: 36 (cálculo automático: 3 años × 12 meses)
- **Depreciación mensual** = Total de inversión ÷ Meses para depreciar
- En nuestro ejemplo: $67,000 ÷ 36 = $1,861.11 mensuales

Este valor de depreciación mensual es crítico porque se va a sumar a los costos fijos, convirtiéndose en parte del fondo de depreciación que afecta todos los cálculos posteriores.

### FASE 2: Costos Fijos - Los Gastos Operativos Invariables

Después de establecer la depreciación, y solo después, tú estableces los costos fijos. Estos también son todos hardcodeados - tú pones el número y se acabó, no hay fórmula ni nada en la tabla. Son los gastos que tienes que pagar sí o sí, trabajes o no trabajes, atiendas un paciente o cien.

**Estructura Detallada de Costos Fijos:**

**Categoría Local:**
- Renta: $3,000 (el alquiler mensual del consultorio)
- Luz: $250 (promedio mensual de electricidad)
- Agua: $200 (servicio de agua potable)
- Internet: $450 (servicio de internet de alta velocidad)
- Teléfono: $180 (línea fija del consultorio)

**Categoría Provisiones:**
- Educación continua: $900 (cursos, congresos, actualizaciones)
- Publicidad: $2,000 (Facebook Ads, Google Ads, material impreso)
- Rutas y mantenimiento: $417 (mantenimiento preventivo de equipos)
- Seguro del consultorio: $650
- Papelería y administración: $300

**Categoría Personal (si aplica):**
- Asistente dental: $4,500
- Recepcionista: $3,000
- Limpieza: $800

**Integración Crítica con Depreciación:**
Al final de la tabla de costos fijos, se añade automáticamente:
- **Fondo de depreciación**: $1,861.11 (viene de la tabla de depreciación)

**Suma total mensual de costos fijos** = Todos los costos anteriores + Fondo de depreciación
En nuestro ejemplo = $16,684.22 + $1,861.11 = **$18,545.33**

Este número es fundamental porque va a determinar cuánto cuesta mantener el consultorio abierto cada mes, independientemente de cuántos pacientes se atiendan.

### FASE 3: Costos por Tiempo - La Eficiencia Operativa Traducida a Dinero

Ahora viene la parte donde empiezan las fórmulas automáticas. Ella lo primero que hace es establecer los parámetros de tiempo, porque necesita saber cuánto cuesta cada minuto de operación del consultorio.

**Valores Configurables por el Usuario:**
- Días laborales: 20 (los días que trabaja al mes)
- Horas por día: 7 (horario de 9 AM a 5 PM con 1 hora de comida)
- Porcentaje de horas reales: 80% 

Este último punto es crítico y merece explicación: nunca trabajas el 100% del tiempo disponible. Siempre hay tiempos muertos entre pacientes, tiempo de preparación, tiempo de limpieza, pacientes que llegan tarde o que cancelan. Por eso estableces un porcentaje realista - puede ser 75%, 80%, 85%, 90% - dependiendo de qué tan eficiente sea la operación.

**Cálculos Automáticos del Sistema:**
- Horas planeadas por mes = Días laborales × Horas por día = 20 × 7 = 140 horas
- Horas reales por mes = Horas planeadas × Porcentaje de horas reales = 140 × 0.80 = 112 horas
- **Costo fijo por hora** = Costo fijo mensual ÷ Horas reales por mes
  - En nuestro ejemplo: $18,545.33 ÷ 112 = $165.58 por hora
- **Costo fijo por minuto** = Costo fijo por hora ÷ 60
  - En nuestro ejemplo: $165.58 ÷ 60 = $2.76 por minuto

Este costo por minuto es fundamental porque cada servicio tiene un tiempo estimado, y necesitamos saber exactamente cuánto nos cuesta ese tiempo en términos de costos fijos.

### FASE 4: Punto de Equilibrio - El Análisis Financiero Estratégico

El punto de equilibrio es "un poco a ojo", como decimos, porque requiere estimación basada en experiencia. Pero es absolutamente fundamental para saber si el negocio va bien o mal.

**Componentes del Cálculo:**
- **Total de costos fijos mensuales**: $18,545.33 (viene de la tabla de costos fijos)
- **Costo variable promedio estimado**: 35% (este porcentaje lo estableces basándote en experiencia - puede ser 30%, 35%, 40%, 45%)
- **Margen de contribución** = 100% - Costo variable estimado = 100% - 35% = 65%

¿Por qué es estimado? Porque en realidad cada servicio tiene su propio costo variable, pero para el punto de equilibrio necesitas un promedio general del negocio. Con el tiempo, este número se puede ajustar basándose en datos reales.

**Cálculo del Punto de Equilibrio:**
- Ingreso de punto de equilibrio mensual = Costos fijos mensuales ÷ Margen de contribución
- En nuestro ejemplo: $18,545.33 ÷ 0.65 = **$28,531.28**

Esto significa que el consultorio necesita facturar $28,531.28 al mes para cubrir todos sus costos. Todo lo que facture por encima de eso es ganancia; todo lo que esté por debajo significa pérdida. Este número aparece en el dashboard como una línea roja que no debes cruzar hacia abajo.

### FASE 5: Costos Variables de Insumo - El Catálogo Completo de Materiales

Ya cuando tienes esas tres cosas (depreciación, costo fijo y costo por tiempo), ya ahí tú puedes poner los costos variables de insumo. Estos también son hardcodeados, pero su costo por porción se calcula automáticamente.

**Estructura Detallada de Cada Insumo:**

Tomemos varios ejemplos para entender el patrón:

**Ejemplo 1 - Material de Anestesia:**
- Nombre: Aguja dental
- Categoría/Tags: Anestesia, Desechables (deben ser tags flexibles, no categorías rígidas)
- Presentación: Caja (es como viene del proveedor)
- Precio por presentación: $162
- Porciones por presentación: 100 unidades
- **Costo por porción** = $162 ÷ 100 = $1.62 por aguja

**Ejemplo 2 - Material de Limpieza:**
- Nombre: Pasta profiláctica
- Categoría/Tags: Limpieza, Profilaxis
- Presentación: Bote
- Precio por presentación: $85
- Porciones por presentación: 30 aplicaciones
- **Costo por porción** = $85 ÷ 30 = $2.83 por aplicación

**Ejemplo 3 - Material de Restauración:**
- Nombre: Resina fotocurable A2
- Categoría/Tags: Restauración, Estética
- Presentación: Jeringa de 4g
- Precio por presentación: $450
- Porciones por presentación: 8 restauraciones promedio
- **Costo por porción** = $450 ÷ 8 = $56.25 por restauración

**Problema Importante a Resolver:** 
A veces compramos el mismo insumo en diferentes presentaciones. Por ejemplo, a veces compramos guantes en caja de 100, a veces en caja de 50, a veces por paquete de 10 pares. El sistema debe ser lo suficientemente flexible para manejar estos cambios de presentación sin complicaciones. Cada vez que cambia la presentación, debes poder actualizar fácilmente sin afectar los cálculos históricos.

La lista completa puede incluir cientos de insumos: agujas, anestesia, gasas, algodón, eyectores, baberos, guantes, cubrebocas, campos, fresas de diferentes tipos, adhesivos, ácidos, resinas de diferentes colores, cementos, materiales de impresión, etc.

### FASE 6: Costos Variables por Servicio - La Composición Detallada de Cada Tratamiento

Después que tú creas todos los insumos, ya puedes entonces crear los costos variables de cada servicio. Aquí es donde defines exactamente qué insumos se usan en cada tratamiento y en qué cantidad.

El sistema debe tener un selector inteligente - tú solo tienes que elegir el insumo y poner la cantidad, y todo lo demás se calcula automáticamente.

**Ejemplo Detallado - Servicio de Limpieza Dental:**

Insumos requeridos para una limpieza:
- Guantes: 1 par × $3.50 = $3.50
- Cubrebocas: 1 unidad × $2.00 = $2.00
- Gasas: 4 unidades × $0.50 = $2.00
- Cepillo de profilaxis: 1 unidad × $12.00 = $12.00
- Pasta profiláctica: 1 porción × $2.83 = $2.83
- Campo desechable: 1 unidad × $4.00 = $4.00
- Eyector: 1 unidad × $1.50 = $1.50
- Lubricante para pieza: 0.1 porción × $8.00 = $0.80
- Alcohol para desinfección: 0.2 porción × $5.00 = $1.00

**Total costo variable de limpieza dental** = $29.63

**Ejemplo 2 - Servicio de Resina Posterior:**

Insumos requeridos:
- Guantes: 1 par × $3.50 = $3.50
- Cubrebocas: 1 unidad × $2.00 = $2.00
- Anestesia carpule: 1.5 unidades × $12.00 = $18.00
- Aguja dental: 1 unidad × $1.62 = $1.62
- Dique de goma: 1 unidad × $8.00 = $8.00
- Grapa: 1 unidad × $15.00 = $15.00
- Ácido grabador: 0.2 porción × $25.00 = $5.00
- Adhesivo: 0.3 porción × $45.00 = $13.50
- Resina A2: 1 porción × $56.25 = $56.25
- Fresas de diamante (prorrateo): 0.1 × $50.00 = $5.00
- Tiras de lija: 2 unidades × $3.00 = $6.00
- Discos de pulido: 0.5 × $10.00 = $5.00

**Total costo variable de resina posterior** = $138.87

Este proceso se repite para cada servicio que ofrece la clínica: valoración, extracciones, endodoncias, coronas, puentes, etc. Cada uno con su lista específica de insumos y cantidades.

### FASE 7: Tarifas - La Culminación del Sistema de Precios

Las tarifas son el último elemento de configuración y absolutamente todo lo anterior converge aquí. No puedes crear una tarifa sin un servicio, no puedes crear un servicio sin insumos, no puedes calcular costos sin tener la depreciación y los costos fijos. Todo está interconectado.

**Proceso Detallado de Cálculo de Tarifa - Ejemplo Limpieza Dental:**

1. **Servicio seleccionado**: Limpieza dental (desde selector, no se puede inventar)

2. **Tiempo estimado del servicio**: 60 minutos (lo establece el dentista basándose en su experiencia)

3. **Costo fijo por tratamiento**: 
   - Tiempo × Costo fijo por minuto
   - 60 minutos × $2.76 = $165.60

4. **Costo variable por tratamiento**: $29.63 (viene automáticamente de la tabla de costos variables)

5. **Costo total sin ganancia**: 
   - Costo fijo + Costo variable
   - $165.60 + $29.63 = $195.23

6. **Utilidad deseada**: 40% (este porcentaje lo decides tú - puede ser 30%, 40%, 50%, 60%)

7. **Monto de utilidad**:
   - Costo total × Porcentaje de utilidad
   - $195.23 × 40% = $78.09

8. **Precio de venta final**:
   - Costo total + Monto de utilidad
   - $195.23 + $78.09 = $273.32

9. **Precio redondeado**: 
   - ROUNDMULT($273.32, 50) = **$300.00**

**Más Ejemplos de Redondeo Automático:**
- Valoración: $78.45 → $100
- Resina anterior: $224.67 → $250
- Resina posterior: $378.90 → $400
- Extracción simple: $456.23 → $450
- Endodoncia: $1,234.56 → $1,250
- Corona de porcelana: $2,867.45 → $2,900

El redondeo es importante comercialmente - nadie cobra $273.32, cobras $300. Debería ser configurable (redondear a 50, a 100, o no redondear), pero es una práctica comercial estándar.

## Sistema de Configuración de Categorías - Flexibilidad Total

### Categorías Editables y Personalizables

Actualmente muchas categorías están hardcodeadas en el código, pero el sistema debe permitir que todas sean completamente editables desde la interfaz, almacenadas en la base de datos:

**Tipos de Categorías a Gestionar:**

1. **Categorías de insumos**: 
   - Anestesia
   - Desechables
   - Restauración
   - Endodoncia
   - Prevención
   - Ortodoncia
   - Cirugía
   - Laboratorio
   - (Y cualquier otra que el usuario quiera crear)

2. **Categorías de servicios**:
   - Diagnóstico
   - Prevención
   - Restaurativa
   - Endodoncia
   - Periodoncia
   - Cirugía
   - Estética
   - Urgencias
   - (Personalizables según especialidad)

3. **Categorías de costos fijos**:
   - Local
   - Provisiones
   - Personal
   - Servicios
   - Mantenimiento
   - Marketing
   - (Adaptables a cada negocio)

4. **Categorías de fuentes/vías**:
   - Marketing Digital
   - Marketing Tradicional
   - Referencias
   - Walk-ins
   - Convenios
   - (Según estrategia de captación)

Todas estas categorías deben poder añadirse, editarse, desactivarse (no eliminar por integridad histórica) sin tocar el código. Cada clínica puede tener su propio set de categorías según sus necesidades.

### Organización de la Configuración con Mejores Prácticas UI/UX

La configuración debe estar perfectamente organizada, no en una sola vista desordenada, sino siguiendo las mejores técnicas de UI/UX:

**Configuración del Sistema (Global del Espacio de Trabajo):**
- Parámetros generales de la aplicación
- Estructura de roles y permisos base
- Categorías maestras compartidas
- Plantillas de configuración
- Configuración de idioma y región
- Formatos de fecha y moneda

**Configuración de Clínica (Específica por Ubicación):**
- **Sección Financiera:**
  - Depreciación de equipos
  - Costos fijos mensuales
  - Costos por tiempo
  - Punto de equilibrio
  
- **Sección de Inventario:**
  - Catálogo de insumos
  - Gestión de proveedores
  - Alertas de stock mínimo
  
- **Sección de Servicios:**
  - Costos variables por servicio
  - Tiempos estimados
  - Protocolos clínicos
  
- **Sección de Precios:**
  - Tarifas por servicio
  - Políticas de descuento
  - Planes de pago

Esta separación evita la confusión actual donde hay "configuración" y "configuración del perfil" con información duplicada. Cada sección debe ser clara en su propósito y no duplicar información.

## Arquitectura Multi-Tenant Estilo Metricool - Gestión de Múltiples Clínicas

El sistema adopta una arquitectura similar a Metricool, no en términos de interfaz visual sino de estructura funcional y organizativa:

### Espacios de Trabajo (Equivalente a "Marcas" en Metricool)

Los espacios de trabajo son el contenedor principal, como las marcas en Metricool. Un dentista puede tener un espacio de trabajo "Clínicas Dentales Dr. García" que agrupe todas sus ubicaciones.

**Características del Espacio de Trabajo:**
- Vista consolidada de todas las clínicas
- Métricas agregadas globales
- Gestión centralizada de usuarios
- Configuraciones compartidas
- Reportes multi-clínica
- Panel de control ejecutivo

### Clínicas (Equivalente a "Conexiones" en Metricool)

Cada clínica dentro del espacio de trabajo es como una conexión en Metricool (Facebook, Instagram, etc.). Cada una mantiene su independencia operativa pero comparte ciertos elementos globales.

**Características de Cada Clínica:**
- Base de datos propia de pacientes
- Configuración independiente de costos
- Tarifas específicas por ubicación
- Inventario propio
- Métricas individuales
- Personal asignado

### Funcionalidades Multi-Tenant Clave:

**Pacientes Compartidos y Separados:**
- Cada clínica tiene sus propios pacientes
- Pero se puede ver un total consolidado de todos los pacientes
- Un paciente puede existir en múltiples clínicas
- Historial unificado cuando el paciente visita diferentes ubicaciones

**Dashboard Multinivel:**
- Vista ejecutiva del espacio de trabajo completo
- Drill-down a métricas específicas por clínica
- Comparativas entre clínicas
- Tendencias consolidadas y por ubicación

**Sistema de Onboarding:**
- Wizard inicial para crear primer espacio de trabajo
- Guía paso a paso para configurar primera clínica
- Plantillas de configuración rápida
- Videos tutoriales contextuales
- Lista de verificación de configuración

## Sistema de Roles y Permisos - Control Granular de Accesos

### PROPIETARIO (Rol Único y Especial)
- Es el usuario que creó originalmente el espacio de trabajo
- Rol no asignable - solo existe uno
- Puede transferirse a otro usuario (proceso irreversible)
- Al transferir, el propietario anterior automáticamente se convierte en administrador
- El nuevo propietario puede eliminar al anterior si lo desea
- Control exclusivo sobre:
  - Métodos de pago de la suscripción
  - Eliminación del espacio de trabajo
  - Transferencia de propiedad
  - Configuración de facturación

### SUPERADMINISTRADOR (Control Total Operativo)
- Configuración completa del negocio (depreciación, costos, tarifas)
- Acceso total a reportes financieros y utilidades
- Ve todos los números: ganancias, pérdidas, márgenes
- Gestión de métodos de pago existentes
- Capacidad exclusiva de añadir otros administradores
- Visualización de toda la facturación
- Puede asignar roles a otros usuarios
- Acceso a logs de auditoría
- Exportación masiva de datos

### ADMINISTRADOR (Gestión Sin Visibilidad Financiera)
- Configura todos los aspectos del negocio
- PERO no ve resultados financieros
- Sin acceso a:
  - Reportes de dinero
  - Utilidades
  - Márgenes de ganancia
  - Punto de equilibrio
- No puede añadir otros administradores
- SÍ puede ejecutar pagos con métodos preestablecidos
- Ve solo reportes operativos de pacientes
- Gestiona personal de menor jerarquía

### EDITOR (Operación Diaria)
- Gestión completa de pacientes:
  - Añadir nuevos pacientes
  - Editar información de pacientes
  - Registrar tratamientos
  - Agendar citas
- Sin acceso a configuración del negocio
- No puede modificar:
  - Depreciación
  - Costos fijos o variables
  - Tarifas
  - Categorías
- Enfocado exclusivamente en la operación clínica diaria
- Puede ver reportes básicos de su propia productividad

### LECTOR (Solo Consulta)
- Acceso de solo lectura totalmente configurable
- Se puede asignar a:
  - Una clínica específica
  - Varias clínicas seleccionadas
  - Todo el espacio de trabajo
- Permisos granulares por sección:
  - Solo pacientes
  - Solo tratamientos
  - Solo reportes operativos
  - Configuración (sin poder modificar)
  - Facturación (solo consulta)
  - Combinaciones personalizadas
- Útil para:
  - Contadores externos
  - Auditores
  - Consultores
  - Personal en entrenamiento

## Gestión de Fuentes y Marketing - Sistema Completo de Tracking

### Sistema de Fuentes/Vías de Captación

El formulario de paciente nuevo DEBE incluir obligatoriamente un campo adicional para la fuente/vía de llegada. Este campo debe estar perfectamente integrado con la base de datos para permitir consultas SQL complejas sobre el origen y valor de cada paciente.

**Configuración de Fuentes Personalizables:**

El sistema debe permitir crear y gestionar fuentes ilimitadas, organizadas por categorías:

**Marketing Digital:**
- Campaña Facebook Ads - Promoción Limpieza
- Campaña Facebook Ads - Blanqueamiento
- Campaña Google Ads - Búsqueda General
- Campaña Google Ads - Remarketing
- Instagram Orgánico
- TikTok
- WhatsApp Business

**Marketing Tradicional:**
- Volantes Zona Norte
- Volantes Zona Sur
- Periódico Local
- Radio FM 101.5
- Espectacular Avenida Principal
- Directorio Telefónico

**Referencias (Con Tracking Detallado):**
- Referido por Paciente (selector de paciente existente)
- Referido por Doctor (selector de doctores aliados)
- Referido por Empleado
- Referido por Proveedor

**Convenios y Alianzas:**
- Seguro Dental AXA
- Seguro MetLife
- Convenio Empresa X
- Convenio Escuela Y

**Walk-ins y Otros:**
- Caminando por la zona
- Vio el letrero
- Emergencia
- Retorno espontáneo

### Tracking y Análisis Detallado de Cada Paciente

Para cada paciente, el sistema debe registrar y calcular:

**Datos de Origen:**
- Fuente de primera llegada (inmutable)
- Fecha de primera visita
- Campaña específica si aplica
- Costo de adquisición (si viene de campaña paga)

**Historial de Tratamientos:**
- Todos los tratamientos realizados
- Valor de cada tratamiento
- Fechas de cada visita
- Valor total histórico del paciente (Customer Lifetime Value)

**Red de Referencias:**
- Si fue referido: ¿por quién?
- Si ha referido: ¿a quiénes? (lista completa)
- Valor total de su red de referidos
- Niveles de referencia (referido de referido)

### Sistema Avanzado de Asociación de Referidos

La capacidad de rastrear referidos debe ser robusta y multinivel:

**Tracking de Primer Nivel:**
- Juan refirió a María
- María refirió a Pedro y a Ana
- Pedro refirió a Luis

**Tracking de Valor Acumulado:**
- Juan generó directamente: $X (sus propios tratamientos)
- Juan generó por María: $Y
- Juan generó por Pedro (referido de María): $Z
- Juan generó por Ana (referido de María): $W
- Juan generó por Luis (referido de Pedro, referido de María): $V
- **Valor total de Juan**: $X + $Y + $Z + $W + $V

**Métricas de Referencias:**
- Pacientes con más referidos
- Valor promedio por referido
- Tasa de conversión de referidos
- Tiempo promedio hasta primer referido

### Filtros Avanzados para Análisis Profundo

El sistema debe incluir capacidades de filtrado sofisticadas:

**Filtros de Interface Avanzada:**

1. **Slider de Montos**: 
   - "Mostrar pacientes que facturaron entre $X y $Y"
   - Control deslizante visual tipo range
   - Actualización en tiempo real de resultados

2. **Filtros Temporales Flexibles**:
   - Rangos predefinidos (Hoy, Ayer, Esta semana, Este mes)
   - Rangos personalizados con date pickers
   - Comparativas (vs. periodo anterior)
   - Filtros por día de la semana
   - Filtros por temporada

3. **Filtros Combinados Complejos**:
   - Pacientes de [Mes] + que facturaron más de [$X] + de [Fuente Y]
   - Nuevos pacientes + de campaña [Z] + con tratamiento [A]
   - Referidos + en [Periodo] + con más de [N] visitas

**Diferenciación Automática e Inteligente de Pacientes:**

El sistema debe clasificar automáticamente:

**Pacientes Nuevos**:
- Primera visita en el período analizado
- Sin historial previo en ninguna clínica
- Marcador visual distintivo

**Pacientes Recurrentes**:
- Con historial previo de tratamientos
- Frecuencia de visitas calculada
- Tiempo promedio entre visitas

**Pacientes Estacionales**:
- Patrones de visita identificables (ej: solo limpiezas cada 6 meses)
- Predicción de próxima visita probable
- Alertas de reactivación

**Pacientes Inactivos**:
- Sin visitas en X meses (configurable)
- Candidatos para campañas de reactivación
- Análisis de por qué dejaron de venir

### Análisis de ROI por Campaña con Precisión

Cuando evalúas "¿Cuánto generó Facebook Ads este mes?", el sistema debe ser inteligente:

**Cálculos Diferenciados:**

1. **Ingresos de Nueva Captación**:
   - SOLO pacientes que llegaron por primera vez vía Facebook Ads
   - SOLO tratamientos en su primera visita
   - Excluye cualquier tratamiento posterior

2. **Ingresos Totales de la Fuente**:
   - Todos los tratamientos de todos los pacientes que alguna vez llegaron por Facebook Ads
   - Incluye tratamientos recurrentes
   - Muestra el Customer Lifetime Value

3. **ROI Real de Campaña**:
   - Inversión en campaña: $X
   - Ingresos primera visita: $Y
   - Ingresos totales históricos: $Z
   - ROI inmediato: (Y-X)/X × 100
   - ROI total: (Z-X)/X × 100

**Métricas Avanzadas por Fuente:**
- Costo por lead
- Costo por paciente convertido
- Ticket promedio primera visita
- Ticket promedio histórico
- Tasa de retención por fuente
- Valor promedio a 6 meses, 1 año, 2 años

## Sistema de Reportes Integrado - Business Intelligence Dental

### Dashboard Principal (Home) - El Centro de Comando

El home debe ser mucho más que una página de bienvenida. Debe ser el centro neurálgico de información, perfectamente sincronizado con todos los datos del sistema:

**Widgets de Información en Tiempo Real:**

1. **Métricas del Día**:
   - Pacientes atendidos hoy: X
   - Ingresos del día: $Y
   - Próximas citas: Z
   - Tratamientos realizados: Lista rápida

2. **Actividad Reciente** (Timeline):
   - "Hace 5 min: María García - Limpieza dental - $300"
   - "Hace 20 min: Nuevo paciente registrado - Juan Pérez"
   - "Hace 1 hora: Pago recibido - Ana López - $1,200"
   - "Hace 2 horas: Cita agendada - Pedro Ruiz - Mañana 10 AM"

3. **Accesos Directos Inteligentes**:
   - Botón: Registrar Nuevo Paciente
   - Botón: Registrar Tratamiento
   - Botón: Ver Agenda del Día
   - Botón: Cobrar Pendientes
   - (Personalizables según rol y frecuencia de uso)

4. **Alertas y Notificaciones**:
   - "3 pacientes sin confirmar para mañana"
   - "Stock bajo: Resina A2 (quedan 2 unidades)"
   - "Meta mensual: 75% alcanzada"
   - "Punto de equilibrio: Superado en $5,000"

**Visualizaciones Gráficas Interactivas:**

1. **Gráfico de Pastel - Distribución de Pacientes por Fuente**:
   - Facebook Ads: 35%
   - Referidos: 25%
   - Google: 20%
   - Walk-ins: 15%
   - Otros: 5%
   - (Clickeable para ver detalle)

2. **Gráfico de Barras - Facturación Comparativa**:
   - Por día de la semana actual
   - Por semana del mes
   - Por mes del año
   - Comparativa vs. periodo anterior
   - Línea de punto de equilibrio visible

3. **Línea de Tendencia - Evolución del Negocio**:
   - Pacientes nuevos por mes
   - Ingresos mensuales
   - Línea de tendencia proyectada
   - Eventos marcados (campañas, cambios de precio)

4. **Heat Map - Ocupación de Agenda**:
   - Visualización tipo calendario
   - Colores por nivel de ocupación
   - Identificación de horas pico
   - Espacios disponibles para optimizar

5. **Gauge/Velocímetro - Punto de Equilibrio**:
   - Visual tipo velocímetro
   - Zona roja: Por debajo del punto
   - Zona amarilla: Cerca del punto
   - Zona verde: Superando el punto
   - Indicador de proyección mensual

**Sincronización Perfecta:**
Todos los datos del home deben estar perfectamente sincronizados con los reportes detallados del menú de operaciones. Si el home dice "15 pacientes hoy", el reporte detallado debe mostrar exactamente esos 15 pacientes con su información completa.

### Reporte de Vías de Ingreso/Marketing - Inteligencia de Captación

Este reporte especializado es fundamental para tomar decisiones de marketing:

**Preguntas Clave que Debe Responder:**

1. **¿Qué vía está generando más ingresos?**
   - Tabla rankeada por ingresos totales
   - Periodo seleccionable
   - Desglose por primera visita vs. recurrente

2. **¿Cuántos pacientes nuevos trajo cada vía?**
   - Números absolutos y porcentajes
   - Tendencia temporal (creciendo/decreciendo)
   - Comparativa con periodos anteriores

3. **¿Cuál es el ticket promedio por fuente?**
   - Primera visita
   - Promedio histórico
   - Por tipo de tratamiento

4. **¿Qué fuente tiene mejor tasa de retención?**
   - % de pacientes que regresan
   - Tiempo promedio hasta segunda visita
   - Número promedio de visitas por paciente

5. **¿Cuál es el ROI de cada campaña paga?**
   - Inversión vs. Retorno
   - Tiempo de recuperación
   - Proyección a futuro

**Visualizaciones Específicas:**

- **Funnel de Conversión por Fuente**:
  Leads → Citas Agendadas → Presentados → Tratamiento → Recurrencia

- **Matriz BCG de Fuentes**:
  Clasificación en Estrellas, Vacas, Perros, Interrogantes

- **Análisis Cohort**:
  Comportamiento de grupos de pacientes por mes de llegada

### Reportes Operativos con Filtros Potentes

Todos los reportes deben incluir capacidades de filtrado avanzadas:

**Panel de Filtros Universal:**

1. **Filtros Temporales**:
   - Date pickers con rangos predefinidos
   - Comparativas automáticas
   - Agrupación (día, semana, mes, trimestre, año)

2. **Filtros de Clínica**:
   - Individual
   - Múltiple selección
   - Todas las clínicas
   - Grupos personalizados

3. **Filtros de Paciente**:
   - Nuevos/Recurrentes/Todos
   - Por fuente de llegada
   - Por valor histórico
   - Por frecuencia de visita
   - Por tipo de seguro

4. **Filtros de Tratamiento**:
   - Por categoría
   - Por servicio específico
   - Por rango de precio
   - Por duración

5. **Filtros Financieros**:
   - Rango de montos (con slider visual)
   - Pagados/Pendientes/Todos
   - Por método de pago
   - Por plan de pago

**Capacidades de Exportación:**
- Excel con formato
- PDF para impresión
- CSV para análisis
- API para integraciones
- Programación de envío automático

### Reportes Especializados Adicionales

1. **Reporte de Productividad por Operador**:
   - Tratamientos realizados
   - Ingresos generados
   - Tiempo promedio por tratamiento
   - Satisfacción del paciente

2. **Reporte de Inventario y Consumo**:
   - Consumo por periodo
   - Proyección de necesidades
   - Análisis de costos
   - Proveedores y precios

3. **Reporte de Cobranza**:
   - Cuentas por cobrar aging
   - Efectividad de cobranza
   - Pacientes morosos
   - Proyección de flujo de caja

4. **Reporte de Satisfacción**:
   - NPS por fuente
   - Comentarios y quejas
   - Tasa de resolución
   - Tendencias de satisfacción

## Operación Diaria - El Flujo de Trabajo Real

Una vez que toda la configuración inicial está completa, el sistema entra en modo operativo. Este es el trabajo del día a día:

### 1. Registro de Nuevos Pacientes - Proceso Completo

Cuando llega un paciente nuevo, el proceso debe ser fluido pero completo:

**Información Personal Obligatoria:**
- Nombre completo
- Fecha de nacimiento
- Género
- Teléfono principal
- Teléfono secundario
- Email
- Dirección completa
- RFC (si requiere factura)

**Información Crítica de Marketing:**
- **Fuente/Vía de llegada** (OBLIGATORIO - selector de fuentes configuradas)
- Si es referido: ¿Por quién? (selector de pacientes existentes)
- Campaña específica (si aplica)
- Primera impresión/motivo de consulta

**Información Clínica:**
- Alergias
- Padecimientos
- Medicamentos que toma
- Última visita al dentista
- Motivo de consulta principal

**Información Administrativa:**
- Tipo de paciente (particular/asegurado)
- Seguro (si aplica)
- Empresa (si es por convenio)
- Observaciones especiales

### 2. Registro de Tratamientos Realizados

Cada tratamiento debe registrarse inmediatamente después de realizarse:

**Proceso de Registro:**
1. Seleccionar paciente (con buscador inteligente)
2. Seleccionar servicio desde catálogo (no se puede inventar)
3. Confirmar o ajustar precio (toma la tarifa por defecto)
4. Registrar método de pago (efectivo, tarjeta, transferencia)
5. Añadir observaciones clínicas si es necesario
6. Generar recibo/factura si se requiere

**Información Automática Registrada:**
- Fecha y hora exacta
- Operador que realizó el tratamiento
- Clínica donde se realizó
- Insumos consumidos (según configuración del servicio)
- Costo del tratamiento (para cálculos de utilidad)
- Precio cobrado
- Utilidad generada

### 3. Consulta del Dashboard - Monitoreo Constante

Durante el día, el dashboard debe consultarse regularmente para:

**Monitoreo en Tiempo Real:**
- Ver citas próximas
- Confirmar llegada de pacientes
- Verificar cobros pendientes
- Revisar productividad del día

**Análisis Rápido:**
- ¿Cómo vamos vs. la meta diaria?
- ¿Estamos sobre el punto de equilibrio?
- ¿Hay alertas que atender?
- ¿Qué fuentes están funcionando hoy?

### 4. Actualizaciones y Mantenimiento Ocasional

El sistema requiere actualizaciones periódicas para mantener la precisión:

**Creación de Nuevos Servicios:**
1. Primero verificar que existan todos los insumos necesarios
2. Si falta algún insumo, crearlo primero
3. Crear el costo variable del servicio
4. Establecer la tarifa
5. Activar para uso

**Actualización de Costos:**
- Cuando cambia la renta: Actualizar costos fijos
- Cuando cambian precios de insumos: Actualizar costos variables
- Cuando compras equipo nuevo: Actualizar depreciación
- Cuando cambias horario: Actualizar costos por tiempo

**Gestión de Categorías y Fuentes:**
- Añadir nuevas fuentes de marketing
- Reorganizar categorías según necesidad
- Desactivar elementos obsoletos
- Crear nuevas clasificaciones

## Validaciones y Reglas de Negocio - La Integridad del Sistema

El sistema debe mantener integridad absoluta mediante validaciones estrictas:

### Validaciones de Dependencia

**Cadena de Dependencias Inviolable:**
```
Depreciación → Costos Fijos → Costos por Tiempo → Punto de Equilibrio
                                ↓
                            Insumos → Servicios → Tarifas
                                         ↓
                                    Tratamientos
```

**Reglas Específicas:**
1. No se puede crear una tarifa sin servicio existente
2. No se puede crear un servicio sin todos sus insumos
3. No se puede registrar tratamiento sin tarifa definida
4. No se puede registrar paciente sin fuente/vía
5. No se puede eliminar insumo si está en uso en algún servicio
6. No se puede eliminar servicio si tiene tratamientos históricos

### Validaciones de Integridad

**Datos Financieros:**
- Los montos no pueden ser negativos
- Los porcentajes deben estar entre 0 y 100
- Las fechas no pueden ser futuras para registros históricos
- Los cálculos deben redondearse consistentemente

**Datos Operativos:**
- Un paciente no puede tener dos tratamientos simultáneos
- Las citas no pueden solaparse para el mismo operador
- El inventario no puede ser negativo
- Los tiempos deben ser realistas (1-300 minutos)

### Actualizaciones en Cascada

Cuando se modifica un valor base, todos los valores dependientes deben recalcularse automáticamente:

**Ejemplo - Cambio en Costos Fijos:**
1. Usuario actualiza renta de $3,000 a $3,500
2. Sistema recalcula total de costos fijos
3. Sistema recalcula costo por hora
4. Sistema recalcula costo por minuto
5. Sistema recalcula todas las tarifas
6. Sistema actualiza punto de equilibrio
7. Dashboard refleja nuevos valores inmediatamente

## Instrucción Crítica Final para Implementación

**IMPORTANTE**: Antes de implementar cualquier cambio, cualquier funcionalidad, cualquier ajuste descrito en este documento, es absolutamente imperativo realizar un commit del código actual. El commit debe incluir:

1. Todos los archivos modificados
2. Mensaje descriptivo del estado actual
3. Tag de versión si es un milestone
4. Branch específico para nuevas features

Cualquier problema, bug, conflicto o issue debe resolverse completamente en el commit antes de proceder con nuevas funcionalidades. No se debe avanzar con código roto o parcialmente funcional.

---

*Esta documentación representa la visión completa, exhaustiva y definitiva del Sistema de Gestión Integral para Consultorio Dental. Cada sección, cada cálculo, cada ejemplo ha sido cuidadosamente detallado para servir como guía absoluta de implementación. El sistema descrito aquí no es solo un reemplazo de las hojas de cálculo actuales, sino una evolución que mantiene toda la lógica de negocio probada mientras añade capacidades modernas de gestión, análisis y crecimiento multi-clínica.*

---

## segunda_actualizacion.md
# LARALIS: Sistema de Inteligencia de Negocio Dental - Documentación Definitiva v2.0

## Visión General y Propósito del Sistema

### El Origen: De las Hojas de Cálculo a la Inteligencia de Negocio

Este sistema nace de una necesidad profundamente real y específica: transformar las complejas hojas de cálculo de Google Sheets que actualmente gestiona el consultorio dental de mi esposa en una plataforma digital moderna, inteligente y completamente integrada. Pero no es una simple digitalización - es una evolución completa que mantiene la lógica financiera probada mientras añade capacidades que posicionan a la clínica en la vanguardia tecnológica del 2025.

La característica más revolucionaria y diferenciadora de Laralis es su **motor financiero interconectado**: absolutamente todos los datos del sistema están vinculados en una cascada perfecta de información. Cuando modificas la depreciación de un equipo, automáticamente se recalculan los costos fijos. Cuando ajustas los costos fijos, se actualizan los costos por tiempo. Cuando cambias los costos por tiempo, todas las tarifas se recalculan instantáneamente. Esta interconexión no es solo una característica técnica - es la inteligencia de negocio que permite tomar decisiones informadas en tiempo real.

### La Propuesta de Valor Única en el Mercado

Laralis no compite en la categoría de "software de gestión dental". Compite en una categoría propia: **plataformas de inteligencia de negocio dental con cumplimiento regulatorio nativo**. Mientras que competidores como Dentrix, Eaglesoft o CareStack ofrecen gestión básica con añadidos costosos, Laralis ofrece:

1. **El único motor financiero real del mercado**: Calcula el costo exacto por minuto de operación, considerando depreciación, costos fijos, variables y eficiencia operativa real
2. **Cumplimiento mexicano desde el núcleo**: NOMs 004 y 024, CFDI 4.0, todo integrado nativamente, no como parches
3. **Inteligencia artificial práctica**: No promesas futuristas, sino IA que genera ROI inmediato
4. **Modelo de negocio recurrente integrado**: Sistema de membresías que transforma el flujo de caja

## PARTE I: CUMPLIMIENTO REGULATORIO MEXICANO - La Base Legal Inquebrantable

### Expediente Clínico Electrónico según NOM-004-SSA3-2012

El sistema no solo cumple con la norma - la excede en funcionalidad mientras mantiene simplicidad de uso. Cada expediente clínico en Laralis es un documento legal completo que incluye todos los elementos mandatorios de la norma, pero presentados de manera intuitiva y moderna.

**Historia Clínica Completa y Trazable**

Cuando un paciente llega por primera vez, el sistema guía al profesional a través de un wizard inteligente que asegura la captura de toda la información requerida por la NOM-004. Los antecedentes heredo-familiares no son solo campos de texto - son formularios estructurados que permiten identificar patrones y riesgos. Los antecedentes personales patológicos se vinculan automáticamente con alertas para tratamientos futuros. Si un paciente es diabético, el sistema alertará automáticamente antes de cualquier procedimiento quirúrgico.

La exploración física inicial incluye un odontograma digital interactivo donde cada diente es clickeable y puede registrar múltiples condiciones simultáneas. No es solo un dibujo - es un mapa inteligente que calcula automáticamente el plan de tratamiento óptimo basándose en prioridades clínicas y capacidad económica del paciente.

**Sistema de Notas de Evolución con Firma Electrónica Avanzada**

Cada nota de evolución es un documento legal inmutable. El sistema utiliza firma electrónica avanzada vinculada con el SAT, garantizando la validez jurídica de cada registro. Pero va más allá: implementa un sistema de firma biométrica táctil para pacientes, eliminando completamente el papel mientras mantiene el valor legal.

Las notas se pueden dictar por voz usando inteligencia artificial. El dentista simplemente habla mientras trabaja, y el sistema transcribe, formatea y estructura la información según los requerimientos de la norma. Al finalizar, el profesional revisa, ajusta si es necesario, y firma electrónicamente. Todo el proceso toma segundos, no minutos.

**Consentimiento Informado Digital con Validez Legal Total**

Los consentimientos informados son documentos dinámicos que se adaptan al procedimiento específico. El sistema mantiene una biblioteca de riesgos y complicaciones por procedimiento, actualizada constantemente con la literatura médica más reciente. Cuando se va a realizar una endodoncia, el consentimiento automáticamente incluye todos los riesgos específicos, las alternativas de tratamiento, y los costos detallados.

El paciente puede revisar el consentimiento en su dispositivo móvil, hacer preguntas que quedan registradas, y firmar digitalmente. Si requiere tiempo para pensarlo, puede llevarse el documento digitalmente y firmarlo desde casa. El sistema registra cada interacción, creando una bitácora completa del proceso de consentimiento.

### Interoperabilidad según NOM-024-SSA3-2012

La interoperabilidad no es una característica futura en Laralis - es una realidad presente. El sistema puede compartir información con cualquier institución de salud en México usando estándares internacionales.

**Exportación en Múltiples Formatos Estándar**

Los expedientes pueden exportarse en formato HL7 CDA (Clinical Document Architecture), el estándar internacional para intercambio de información clínica. Pero también en formatos más simples como PDF estructurado o incluso como datasets para investigación (anonimizados automáticamente).

Cuando un paciente es referido a un especialista, el sistema genera automáticamente un resumen clínico que incluye solo la información relevante, respetando el principio de mínima información necesaria. El especialista recibe un link seguro con acceso temporal a la información, y cada acceso queda registrado en la bitácora.

**Catálogos Normalizados Inteligentes**

El sistema no solo usa los catálogos estándar (CIE-10 para diagnósticos, CPT Dental para procedimientos) - los hace inteligentes. Cuando el dentista empieza a escribir "caries", el sistema sugiere automáticamente los códigos CIE-10 relevantes, pero ordenados por frecuencia de uso en esa clínica específica. Aprende de los patrones de diagnóstico y se vuelve más eficiente con el tiempo.

### Facturación CFDI 4.0 - Más Allá del Cumplimiento

La facturación no es un módulo añadido - está integrada en el corazón del sistema. Cada tratamiento registrado puede convertirse en factura con un clic, pero el sistema es mucho más inteligente que eso.

**Facturación Inteligente con Reglas de Negocio**

El sistema conoce las reglas fiscales. Si un tratamiento se paga en parcialidades, automáticamente maneja el esquema PPD (Pago en Parcialidades o Diferido) y genera los complementos de pago correspondientes. Si el paciente es una empresa, automáticamente ajusta el uso del CFDI y solicita los datos fiscales adicionales necesarios.

Pero la verdadera inteligencia está en la automatización de casos especiales. Si un paciente cancela y solicita devolución, el sistema genera automáticamente la nota de crédito vinculada a la factura original. Si hay un descuento por pronto pago, se refleja correctamente en la factura sin intervención manual.

**Portal de Facturación para Pacientes**

Los pacientes pueden acceder a un portal seguro donde ven todas sus facturas históricas, pueden descargar XMLs y PDFs, y solicitar correcciones si es necesario. El portal está vinculado con el SAT para validación automática, asegurando que cada factura emitida es válida y está correctamente timbrada.

## PARTE II: EL MOTOR FINANCIERO - La Inteligencia de Negocio que Ningún Competidor Tiene

### Sistema de Depreciación Inteligente

La depreciación en Laralis no es solo un cálculo contable - es inteligencia de negocio activa. El sistema no solo registra el valor de los equipos y su depreciación mensual, sino que proporciona insights accionables.

**Gestión Predictiva de Activos**

Cuando registras un autoclave con un costo de $7,500 y una vida útil de 3 años, el sistema no solo calcula la depreciación mensual de $208.33. También:

- Programa automáticamente mantenimientos preventivos basados en uso real
- Alerta cuando el equipo se acerca al final de su vida útil
- Sugiere el momento óptimo de reemplazo basándose en fallas históricas
- Calcula el ROI real de cada equipo basándose en los tratamientos realizados

El sistema mantiene un "snapshot" histórico del costo de depreciación en cada tratamiento. Si hace dos años la depreciación era de $1,500 mensuales y hoy es de $2,000, los tratamientos antiguos mantienen su costo histórico correcto. Esto permite análisis de rentabilidad precisos período por período.

### Costos Fijos con Inteligencia Contextual

Los costos fijos en Laralis no son solo números en una tabla - son datos vivos que informan decisiones diarias.

**Análisis de Eficiencia por Categoría**

El sistema agrupa automáticamente los costos fijos en categorías inteligentes, pero va más allá del simple agrupamiento. Por ejemplo, en la categoría "Local", no solo suma renta, luz, agua e internet. También:

- Calcula el costo por metro cuadrado y lo compara con el promedio del mercado
- Identifica oportunidades de ahorro (por ejemplo, si el consumo eléctrico aumenta inusualmente)
- Proyecta el impacto de mudarse a un local diferente con simulaciones what-if
- Sugiere momentos óptimos para renegociar contratos basándose en tendencias del mercado

**Sistema de Alertas Proactivas**

Si la renta representa más del 20% de los ingresos totales, el sistema alerta automáticamente. Si los costos de marketing superan el 15% sin un incremento proporcional en pacientes nuevos, genera una notificación. Estas no son reglas hardcodeadas - el sistema aprende los patrones normales de cada clínica y alerta sobre anomalías.

### Costos por Tiempo - La Métrica Revolucionaria

Este es el diferenciador más poderoso de Laralis. Mientras otros sistemas hablan vagamente de "productividad", Laralis calcula el costo exacto por minuto de operación.

**Eficiencia Real vs. Teórica**

El sistema no asume que trabajas el 100% del tiempo disponible. Reconoce la realidad operativa: tiempos muertos entre pacientes, preparación, limpieza, cancelaciones. Cuando configuras que tu eficiencia real es del 80%, el sistema ajusta todos los cálculos acordemente.

Pero no se queda ahí. El sistema mide continuamente tu eficiencia real basándose en datos históricos. Si configuraste 80% pero los datos muestran que realmente es 75%, el sistema lo señala y sugiere ajustes. También identifica los factores que afectan la eficiencia: ¿Los lunes tienen más cancelaciones? ¿Los tratamientos de ortodoncia tienden a extenderse más del tiempo estimado?

**Optimización Dinámica de Agenda**

Conociendo el costo por minuto, el sistema optimiza automáticamente la agenda. Si un hueco de 30 minutos tiene un costo de $83, el sistema busca activamente llenar ese espacio con tratamientos rápidos de alto margen. Puede sugerir llamar a pacientes en lista de espera para limpiezas rápidas o tratamientos menores.

### Punto de Equilibrio Dinámico y Predictivo

El punto de equilibrio en Laralis no es un número estático calculado una vez al mes. Es un indicador vivo que se actualiza en tiempo real y proporciona predicciones precisas.

**Cálculo Multicapa del Punto de Equilibrio**

El sistema calcula tres tipos de punto de equilibrio:

1. **Punto de Equilibrio Teórico**: Basado en costos fijos y margen de contribución promedio estimado
2. **Punto de Equilibrio Real**: Calculado con el mix real de servicios del período actual
3. **Punto de Equilibrio Proyectado**: Usando IA para predecir el mix de servicios futuro basándose en tendencias y estacionalidad

**Visualización Inteligente del Progreso**

El dashboard muestra el punto de equilibrio como un velocímetro inteligente que cambia de color según el progreso del día. Pero también muestra la "velocidad" a la que te acercas o alejas del punto. Si a mediodía vas al 40% del punto de equilibrio diario, el sistema calcula si el ritmo actual será suficiente para alcanzarlo al final del día.

## PARTE III: GESTIÓN DE INVENTARIO INTELIGENTE

### Catálogo de Insumos con Gestión Multi-Presentación

El problema de las diferentes presentaciones que mencionamos está completamente resuelto en Laralis. El sistema entiende que el mismo insumo puede venir en diferentes presentaciones y maneja esto inteligentemente.

**Unidad Básica de Consumo (UBC)**

Cada insumo tiene una Unidad Básica de Consumo. Para guantes, la UBC es "par". Para anestesia, es "cartucho". Para gasas, es "unidad". No importa si compras guantes en caja de 50 pares o caja de 100 pares - el sistema siempre trabaja con la UBC para mantener consistencia.

Cuando registras una compra, especificas la presentación (caja de 100) y el precio total ($350). El sistema automáticamente calcula el costo por UBC ($3.50 por par) y actualiza el costo promedio ponderado del inventario. Si la próxima compra es una caja de 50 a $180, el sistema recalcula el promedio ponderado automáticamente.

**Historial de Precios con Análisis de Tendencias**

Cada insumo mantiene un historial completo de precios por proveedor. Pero no es solo un registro histórico - es inteligencia activa:

- Identifica tendencias de precio (¿está subiendo la resina A2 consistentemente?)
- Alerta sobre variaciones inusuales (¿por qué este proveedor cobra 30% más?)
- Sugiere momentos óptimos de compra basándose en patrones históricos
- Calcula el impacto de la inflación real en cada insumo

**Sistema de Alertas Predictivas de Inventario**

Usando la agenda futura y el histórico de consumo, el sistema predice cuándo te quedarás sin cada insumo. Pero va más allá de una simple división:

- Considera la variabilidad (los viernes se usan más guantes porque hay más pacientes)
- Ajusta por estacionalidad (en diciembre hay más limpiezas por los aguinaldos)
- Incluye buffer de seguridad configurable por insumo crítico
- Genera órdenes de compra automáticas pre-llenadas para aprobación

### Costos Variables por Servicio - La Receta Versionada

Aquí es donde Laralis brilla con una innovación que ningún competidor tiene: las recetas de servicio versionadas con snapshot de costos.

**Recetas de Servicio Inteligentes**

Cada servicio tiene una "receta" - la lista de insumos necesarios. Pero estas recetas son inteligentes y versionadas:

- **Versionado Temporal**: Si cambias la receta de una limpieza dental (por ejemplo, añades enjuague fluorado), el sistema crea una nueva versión. Los tratamientos antiguos mantienen la receta anterior, los nuevos usan la actualizada.
- **Snapshot de Costos**: Cuando se realiza un tratamiento, el sistema guarda un "snapshot" del costo exacto en ese momento. Si hoy la resina cuesta $450 y en seis meses cuesta $500, los reportes históricos mantienen el costo real del momento.
- **Variaciones por Profesional**: El sistema puede manejar variaciones. Si el Dr. García usa 1.5 cartuchos de anestesia para extracciones y la Dra. López usa 2, el sistema lo registra y ajusta costos acordemente.

**Optimización Automática de Recetas**

El sistema analiza continuamente el uso real vs. el configurado. Si la receta dice 4 gasas pero consistentemente se usan 5, el sistema lo detecta y sugiere actualizar la receta. También identifica desperdicios: si sobran materiales consistentemente, sugiere reducir las cantidades.

## PARTE IV: SISTEMA DE TARIFAS INTELIGENTE

### Motor de Precios con Reglas de Negocio Complejas

El cálculo de tarifas en Laralis no es una simple suma de costos más margen. Es un motor de reglas de negocio sofisticado que considera múltiples factores.

**Cálculo Multicapa de Precios**

Para cada servicio, el sistema calcula:

1. **Costo Base**: Costos fijos por tiempo + Costos variables de insumos
2. **Ajustes Contextuales**:
    - Factor de complejidad (una extracción de molar es más compleja que un incisivo)
    - Factor de experiencia del profesional
    - Factor de ubicación (si tienes múltiples clínicas en diferentes zonas)
3. **Margen Inteligente**: No un porcentaje fijo, sino variable según:
    - Categoría del servicio (preventivos pueden tener menor margen)
    - Demanda histórica (servicios muy solicitados pueden tener mayor margen)
    - Competencia local (el sistema puede considerar precios de mercado)
4. **Redondeo Estratégico**: No solo ROUNDMULT, sino reglas complejas:
    - Precios psicológicos ($299 en vez de $300)
    - Redondeo por categoría (restauraciones a $50, limpiezas a $100)
    - Ajuste por percepción de valor

**Sistema de Precios Dinámicos**

El sistema puede manejar precios dinámicos basados en múltiples factores:

- **Por horario**: Descuentos en horas valle para optimizar ocupación
- **Por volumen**: Precios especiales para tratamientos múltiples
- **Por temporada**: Ajustes en épocas de alta/baja demanda
- **Por tipo de paciente**: Diferentes tarifas para niños, adultos mayores, estudiantes

**Simulador de Escenarios What-If**

Antes de cambiar precios, el sistema permite simular el impacto:

- ¿Qué pasa si subo las limpiezas 10%?
- ¿Cuántos pacientes menos necesito si aumento márgenes 5%?
- ¿Cuál es el precio óptimo para maximizar utilidad considerando elasticidad de demanda?

## PARTE V: EXPERIENCIA DEL PACIENTE - El Engagement del Siglo XXI

### Portal del Paciente - Su Clínica en el Bolsillo

El portal del paciente no es un añadido - es una extensión integral del sistema que transforma la experiencia del cuidado dental.

**Dashboard Personalizado del Paciente**

Cuando un paciente accede a su portal, no ve una lista genérica de opciones. Ve SU información personalizada:

- **Siguiente cita** con cuenta regresiva y opción de reagendar
- **Plan de tratamiento visual** mostrando qué se ha hecho y qué falta
- **Estado de cuenta claro** con opciones de pago en línea
- **Recordatorios personalizados** de cuidados post-tratamiento
- **Progreso de su salud bucal** con métricas gamificadas

**Gestión Autónoma de Citas**

El paciente puede:

- Ver disponibilidad real en tiempo real
- Agendar citas según tipo de tratamiento necesario
- Recibir confirmación instantánea
- Añadir la cita a su calendario personal
- Compartir la cita con familiares si es necesario

Pero el sistema es inteligente: no muestra toda la disponibilidad. Usa reglas de negocio para optimizar la agenda mientras da sensación de flexibilidad al paciente.

**Historia Clínica Interactiva**

Los pacientes pueden ver su historia clínica de manera visual e interactiva:

- Odontograma evolutivo (ver cómo ha mejorado su salud bucal)
- Radiografías con explicaciones en lenguaje simple
- Fotos de antes/después de tratamientos
- Línea de tiempo de todos sus tratamientos

### Comunicación Omnicanal Automatizada

La comunicación con pacientes no es unidireccional - es una conversación continua a través de múltiples canales.

**WhatsApp Business Integration Nativa**

No es solo enviar mensajes - es una integración completa:

- Recordatorios de citas con botones de confirmación
- Envío de recetas y cuidados post-operatorios
- Respuestas automáticas a preguntas frecuentes
- Compartir ubicación y horarios
- Envío de facturas y recibos digitales

El sistema respeta las regulaciones de WhatsApp Business, usando plantillas aprobadas y manejando opt-ins correctamente.

**Campañas de Email Marketing Segmentadas**

No enviamos el mismo email a todos. El sistema segmenta automáticamente:

- Pacientes que no vienen hace 6 meses (campaña de reactivación)
- Pacientes con tratamientos incompletos (recordatorio de continuar)
- Cumpleaños del mes (felicitación + descuento)
- Pacientes de alto valor (contenido VIP)

Cada campaña se personaliza con el historial del paciente. Si alguien se hizo una limpieza hace 5 meses, el email dice "Es casi hora de tu limpieza semestral" no un genérico "Ven a tu limpieza".

**SMS Inteligentes con AI**

Los SMS no son solo texto - son conversacionales:

- Si el paciente responde "No puedo mañana", el sistema entiende y ofrece reagendar
- Si pregunta "¿Cuánto cuesta?", responde con el precio específico de su tratamiento
- Si dice "Me duele", puede escalar a urgencia y notificar al dentista

### Sistema de Membresías In-House

Esta es una de las innovaciones más poderosas de Laralis - un sistema completo de membresías que transforma el modelo de negocio dental.

**Planes de Membresía Configurables**

El sistema permite crear múltiples planes:

- **Plan Básico**: 2 limpiezas + 1 revisión + Rayos X por $200/mes
- **Plan Familiar**: Cobertura para 4 personas con descuentos adicionales
- **Plan Premium**: Incluye blanqueamiento anual y descuentos en estética
- **Plan Empresarial**: Para empresas que quieren ofrecer beneficio dental

Cada plan es completamente configurable en servicios incluidos, descuentos aplicables, y restricciones.

**Gestión Automática de Suscripciones**

El sistema maneja todo el ciclo de vida de la membresía:

- Cobro recurrente automático (mensual/anual)
- Manejo de pagos fallidos con reintentos inteligentes
- Upgrading/Downgrading de planes
- Pausa temporal por viaje o enfermedad
- Cancelación con retención proactiva

**ROI Tracking de Membresías**

El sistema calcula continuamente el valor de las membresías:

- LTV (Lifetime Value) de miembros vs. no miembros
- Tasa de uso de beneficios
- Ingresos recurrentes vs. transaccionales
- Costo de adquisición por miembro
- Tasa de churn y razones de cancelación

## PARTE VI: INTELIGENCIA ARTIFICIAL PRÁCTICA

### IA para Notas Clínicas - El Asistente Invisible

La IA en Laralis no es experimental - es práctica y genera valor inmediato.

**Transcripción Inteligente con Contexto**

El dentista puede dictar mientras trabaja:
"Paciente presenta caries oclusal en el dos seis, profundidad media, sin compromiso pulpar aparente. Realizamos remoción de tejido careado, grabado ácido por quince segundos, aplicación de adhesivo y restauración con resina A dos. Pulido y ajuste oclusal verificado con papel de articular."

El sistema no solo transcribe - entiende:

- Convierte "dos seis" en "26" (nomenclatura dental)
- Identifica procedimientos y los codifica (CIE-10, CPT)
- Extrae datos clave (material usado: Resina A2)
- Formatea según NOM-004
- Sugiere códigos de facturación apropiados

**Asistente de Diagnóstico (Roadmap Próximo)**

Aunque el análisis de radiografías con IA propia está en roadmap, el sistema se integra con servicios como Pearl o Overjet para:

- Pre-identificar caries y patologías
- Medir pérdida ósea periodontal
- Detectar anomalías que podrían pasarse por alto
- Generar reportes visuales para educación del paciente

### Predicciones y Optimizaciones con Machine Learning

**Predicción de No-Shows**

El sistema analiza patrones históricos para predecir qué pacientes tienen alta probabilidad de no presentarse:

- Historial de cancelaciones previas
- Tipo de tratamiento (los tratamientos costosos tienen más no-shows)
- Día y hora de la cita
- Clima (sí, el mal clima aumenta cancelaciones)
- Distancia del paciente a la clínica

Con esta información, el sistema puede:

- Sobre-agendar inteligentemente
- Enviar recordatorios adicionales a pacientes de alto riesgo
- Sugerir confirmación con depósito para ciertos casos

**Optimización de Inventario con IA**

La IA analiza múltiples variables para optimizar inventario:

- Consumo histórico por día de la semana
- Tratamientos agendados en próximas 2 semanas
- Tendencias estacionales
- Lead time de proveedores
- Costo de oportunidad de stockout vs. costo de mantener inventario

El resultado: órdenes de compra automáticas optimizadas que minimizan capital de trabajo mientras aseguran disponibilidad.

### Dashboard Morning Huddle con IA

Cada mañana, la IA prepara un briefing inteligente para el equipo:

**Oportunidades del Día Identificadas por IA**

- "María García viene para limpieza pero tiene una resina pendiente de hace 3 meses - alta probabilidad de aceptación hoy"
- "Juan Pérez cumple 6 meses desde su última limpieza la próxima semana - ofrecer agendar"
- "Ana López tiene saldo pendiente de $500 - su patrón de pago indica que probablemente traiga efectivo"

**Predicciones y Alertas**

- "Probabilidad de alcanzar meta diaria: 78% basado en citas confirmadas"
- "Alerta: 3 citas de la tarde tienen alto riesgo de no-show - considerar confirmación adicional"
- "El inventario de anestesia alcanza solo para 3 días más - orden de compra recomendada"

## PARTE VII: GESTIÓN CLÍNICA AVANZADA

### Odontograma Digital Evolutivo

El odontograma en Laralis no es solo un diagrama - es un sistema de información clínica visual e inteligente.

**Representación Multi-Estado por Superficie**

Cada diente no es una unidad - tiene 5 superficies (oclusal, mesial, distal, vestibular, lingual/palatina) y cada superficie puede tener múltiples estados simultáneos:

- Caries activa
- Restauración existente (con tipo de material y fecha)
- Fractura
- Desgaste
- Sensibilidad reportada

El sistema mantiene un historial completo. Puedes ver el odontograma de hace 2 años y compararlo con el actual, mostrando visualmente el progreso (o deterioro) de la salud bucal.

**Generación Automática de Planes de Tratamiento**

Basándose en el odontograma, el sistema genera automáticamente planes de tratamiento priorizados:

1. **Prioridad Clínica**: Urgencias primero, prevención después
2. **Prioridad Financiera**: Optimizar según capacidad de pago
3. **Prioridad Estratégica**: Tratamientos que previenen problemas futuros

El plan no es solo una lista - es interactivo. El paciente puede ver qué pasa si pospone cierto tratamiento, cuánto costaría hacerlo por fases, qué alternativas existen.

### Periodontograma Digital con Análisis Predictivo

**Registro Eficiente con Voice Input**

El periodontograma se puede llenar por voz mientras se examina:
"Dos uno: tres, cuatro, tres, dos, tres, dos" (vestibular y lingual)

El sistema:

- Reconoce la nomenclatura dental
- Autocompleta valores normales
- Alerta sobre bolsas periodontales peligrosas
- Calcula automáticamente pérdida de inserción

**Análisis Evolutivo y Predicción**

El sistema no solo registra - analiza:

- Tendencia de profundidad de bolsas en el tiempo
- Predicción de pérdida dental si no se interviene
- Correlación con factores de riesgo (diabetes, tabaquismo)
- Generación automática de plan de tratamiento periodontal

### Gestión de Imágenes y Estudios

**Almacenamiento Inteligente en la Nube**

Las radiografías y fotos no se almacenan solo como archivos - son datos inteligentes:

- Compresión automática sin pérdida de calidad diagnóstica
- Etiquetado automático con IA (tipo de estudio, dientes visibles)
- Vinculación automática con tratamientos relacionados
- Comparación lado a lado de estudios en diferentes fechas

**Herramientas de Anotación y Educación**

El dentista puede:

- Dibujar sobre las imágenes para explicar al paciente
- Crear comparaciones antes/después
- Generar reportes visuales para otros profesionales
- Compartir de manera segura con especialistas

## PARTE VIII: TELEMEDICINA DENTAL

### Consultas Virtuales Integradas

La teledontología en Laralis no es un añadido - está completamente integrada en el flujo de trabajo.

**Video Consultas con Herramientas Específicas**

Durante una video consulta, el dentista tiene acceso a:

- Historial completo del paciente en pantalla compartida
- Herramientas de anotación para explicar sobre imágenes
- Capacidad de generar recetas electrónicas instantáneas
- Programación de cita presencial si es necesaria
- Cobro automático de la consulta virtual

**Triaje Inteligente de Urgencias**

Cuando un paciente solicita consulta de urgencia:

1. Sistema de pre-evaluación con fotos (el paciente sube fotos de la zona afectada)
2. IA pre-clasifica la urgencia (dolor, inflamación, trauma)
3. Routing automático al profesional disponible apropiado
4. Si requiere atención presencial inmediata, agendamiento prioritario

### Monitoreo Remoto Post-Tratamiento

**Seguimiento Automatizado**

Después de procedimientos importantes:

- Envío automático de instrucciones de cuidado
- Check-ins programados ("¿Cómo te sientes hoy?")
- Opción de enviar fotos para evaluación remota
- Escalamiento automático si hay complicaciones

**Educación Continua del Paciente**

- Videos personalizados según el tratamiento realizado
- Recordatorios de técnica de cepillado con AR (roadmap)
- Gamificación del cuidado oral (puntos por buen cuidado)

## PARTE IX: ARQUITECTURA MULTI-TENANT AVANZADA

### Espacios de Trabajo Inteligentes

La arquitectura multi-tenant de Laralis está diseñada para escalar desde un consultorio único hasta cadenas de clínicas nacionales.

**Jerarquía Flexible de Organización**

- **Nivel Corporativo**: Vista del CEO con métricas consolidadas
- **Nivel Regional**: Gerentes regionales ven sus zonas
- **Nivel Clínica**: Cada ubicación mantiene su autonomía
- **Nivel Sillón**: Métricas por unidad dental individual

**Configuración Heredable con Overrides**

Las configuraciones pueden heredarse o sobrescribirse:

- Tarifas base corporativas con ajustes locales por zona
- Protocolos clínicos estándar con variaciones por especialista
- Políticas de descuento globales con excepciones locales

### Sincronización y Trabajo Offline

**Modo Offline Completo**

Laralis puede funcionar completamente offline:

- Base de datos local encriptada
- Sincronización automática cuando hay conexión
- Resolución inteligente de conflictos
- Priorización de sincronización (urgencias primero)

**Sincronización Selectiva**

No todo se sincroniza con todos:

- Datos financieros solo para autorizados
- Historiales clínicos compartidos según necesidad
- Inventarios locales vs. centralizados
- Métricas agregadas vs. detalladas

## PARTE X: SEGURIDAD Y PRIVACIDAD

### Cumplimiento ARCO y Protección de Datos

**Gestión de Derechos ARCO**

El sistema implementa completamente los derechos ARCO (Acceso, Rectificación, Cancelación, Oposición):

- Portal de auto-servicio para solicitudes ARCO
- Workflow de aprobación y ejecución
- Bitácora de todas las solicitudes y acciones
- Generación automática de reportes de cumplimiento

**Encriptación Multi-Capa**

- Encriptación en tránsito (TLS 1.3)
- Encriptación en reposo (AES-256)
- Encriptación de campos sensibles adicional
- Gestión de llaves con rotación automática

### Control de Acceso Granular

**Permisos Basados en Contexto**

Los permisos no son estáticos - son contextuales:

- Un doctor puede ver historiales completos de SUS pacientes
- Recepción puede ver agendas pero no notas clínicas detalladas
- Contabilidad ve números pero no nombres en reportes financieros
- Los permisos pueden cambiar por horario (ej: acceso limitado fuera de horas)

**Auditoría Forense Completa**

Cada acción queda registrada:

- Quién, qué, cuándo, dónde, por qué
- Grabación de sesión para acciones críticas
- Alertas automáticas de comportamiento anormal
- Reportes de cumplimiento regulatorio automáticos

## PARTE XI: ANÁLISIS Y REPORTES AVANZADOS

### Business Intelligence Dental Específico

**Métricas Que Importan**

Laralis no muestra vanity metrics - muestra inteligencia accionable:

- **Valor por Hora de Sillón**: No solo cuánto facturas, sino cuánto ganas realmente por hora considerando todos los costos
- **Índice de Conversión de Tratamiento**: De cada 10 presupuestos, ¿cuántos se convierten? ¿Por qué se pierden los otros?
- **Velocidad de Ciclo de Efectivo**: Desde que se realiza el tratamiento hasta que se cobra, ¿cuántos días pasan?
- **Tasa de Retención Activa**: No solo quién regresa, sino quién regresa Y gasta

**Análisis Predictivo de Negocio**

- Proyección de ingresos con 85% de precisión a 30 días
- Identificación de tendencias antes de que sean obvias
- Alertas de deterioro de métricas clave
- Sugerencias de acciones correctivas basadas en datos

### Reportes Especializados por Rol

**Para el CEO/Dueño**

- Dashboard ejecutivo con KPIs en tiempo real
- Comparativas entre clínicas
- Proyecciones financieras
- ROI por inversión (equipos, marketing, personal)

**Para el Director Clínico**

- Calidad de atención (tasas de éxito, complicaciones)
- Productividad por profesional
- Adherencia a protocolos
- Necesidades de capacitación identificadas

**Para el Gerente de Marketing**

- ROI por canal detallado
- Customer Journey completo
- Análisis de churn y retención
- Segmentación automática de pacientes

## PARTE XII: INTEGRACIONES Y ECOSISTEMA

### Marketplace de Integraciones

**Integraciones Nativas de Pago**

- **Stripe/Mercado Pago/Conekta**: Pagos en línea, planes de pago, meses sin intereses
- **WhatsApp Business API**: Comunicación bidireccional completa
- **Google Calendar/Outlook**: Sincronización de agendas
- **Zoom/Google Meet**: Video consultas integradas
- **Quickbooks/CONTPAQi**: Sincronización contable

**API Abierta para Desarrolladores**

Laralis ofrece una API RESTful completa:

- Autenticación OAuth 2.0
- Rate limiting inteligente
- Webhooks para eventos
- SDKs en múltiples lenguajes
- Sandbox para desarrollo

### Ecosistema de Partners

**Red de Laboratorios Dentales**

- Envío digital de impresiones
- Tracking de trabajos en proceso
- Comunicación directa sobre casos
- Pagos automatizados

**Integración con Aseguradoras**

- Verificación de elegibilidad en tiempo real
- Envío electrónico de reclamaciones
- Pre-autorización automatizada
- Conciliación de pagos

## PARTE XIII: SOSTENIBILIDAD Y RESPONSABILIDAD SOCIAL

### Green Dentistry Dashboard

**Métricas de Impacto Ambiental**

- Huella de carbono por tratamiento
- Reducción de papel (árboles salvados)
- Gestión de residuos peligrosos
- Consumo de agua y energía

**Certificaciones y Gamificación**

- Badges de sostenibilidad para la clínica
- Comparativas con otras clínicas
- Sugerencias de mejora
- Marketing verde para pacientes eco-conscientes

## PARTE XIV: EXPERIENCIA DE USUARIO Y DISEÑO

### Interfaz Adaptativa Multi-Dispositivo

**Diseño Responsivo Inteligente**

No es solo que se vea bien en diferentes pantallas - la interfaz se adapta al contexto de uso:

- **En el sillón dental (tablet)**: Botones grandes, alto contraste, gestos para uso con guantes
- **En recepción (desktop)**: Vista de agenda ampliada, acceso rápido a funciones frecuentes
- **En casa (móvil)**: Dashboard ejecutivo, alertas importantes, aprobaciones rápidas
- **En el carro (smartwatch)**: Notificaciones críticas, confirmación de llegada

**Modo Oscuro Inteligente**

No solo invierte colores - ajusta para contexto clínico:

- Reduce fatiga visual en jornadas largas
- Mejora visibilidad de radiografías
- Ahorra batería en dispositivos móviles
- Se activa automáticamente según horario

### Experiencia de Onboarding Revolucionaria

**Wizard Inteligente de Configuración**

El sistema no te abruma con cientos de configuraciones. Te guía paso a paso:

1. **Perfil Básico** (5 minutos): Datos esenciales para empezar
2. **Importación Inteligente** (automático): Detecta y importa datos de sistemas anteriores
3. **Configuración Guiada** (30 minutos): Con videos contextuales y tips
4. **Primeros Pacientes** (asistido): El sistema te acompaña en los primeros registros
5. **Optimización Continua** (permanente): Sugerencias basadas en uso real

**Migración sin Dolor**

- Importación desde Excel/Google Sheets con mapeo inteligente
- Migración desde otros sistemas dentales
- Limpieza y deduplicación automática de datos
- Período de transición con doble sistema si es necesario

## PARTE XV: MODELO DE IMPLEMENTACIÓN Y SOPORTE

### Estrategia de Rollout por Fases

**Fase 1: Fundación (Mes 1)**

- Configuración de depreciación y costos fijos
- Catálogo básico de insumos
- Primeros 10 servicios principales
- 5 usuarios piloto

**Fase 2: Expansión (Mes 2)**

- Catálogo completo de servicios
- Todos los usuarios activos
- Historiales de pacientes migrados
- Primeras automatizaciones

**Fase 3: Optimización (Mes 3)**

- Ajuste fino de costos y tarifas
- Activación de IA y predicciones
- Campañas de marketing
- Membresías piloto

**Fase 4: Madurez (Mes 4+)**

- Todas las características activas
- Optimización basada en datos
- Expansión a más ubicaciones
- Integraciones avanzadas

### Soporte y Éxito del Cliente

**Soporte Multicanal 24/7**

- Chat en vivo con agentes especializados
- Base de conocimientos con IA
- Videos tutoriales contextuales
- Comunidad de usuarios activa

**Customer Success Proactivo**

- Check-ins mensuales programados
- Análisis de uso y recomendaciones
- Entrenamientos grupales temáticos
- Actualizaciones sobre nuevas características

## PARTE XVI: MODELO DE PRECIOS Y ROI

### Estructura de Precios Transparente

**Modelo SaaS Escalable**

- **Starter** ($999 MXN/mes): 1 sillón, 3 usuarios, características básicas
- **Professional** ($2,499 MXN/mes): Hasta 3 sillones, usuarios ilimitados, IA incluida
- **Enterprise** ($4,999 MXN/mes): Sillones ilimitados, multi-clínica, personalización completa
- **Custom**: Para cadenas y DSOs, precio por volumen

**ROI Garantizado**

Laralis se paga solo en promedio en 47 días a través de:

- Reducción de no-shows (30% menos = $15,000/mes salvados)
- Optimización de agenda (15% más eficiencia = $22,000/mes adicionales)
- Mejora en cobranza (20% más rápido = mejor flujo de caja)
- Aumento en treatment acceptance (25% más = $35,000/mes adicionales)

### Casos de Éxito Proyectados

**Clínica Individual (Dra. Martínez)**

- Antes: 60% ocupación, 20% no-shows, $180,000/mes facturación
- Después: 75% ocupación, 8% no-shows, $245,000/mes facturación
- ROI: 361% en 6 meses

**Cadena de 5 Clínicas (Grupo Dental del Valle)**

- Antes: Gestión en silos, métricas manuales, decisiones reactivas
- Después: Visión unificada, decisiones data-driven, crecimiento 40% YoY
- ROI: 580% en 12 meses

## PARTE XVII: VISIÓN FUTURA Y ROADMAP

### Innovaciones en Desarrollo

**2025 Q3-Q4**

- Integración con wearables para monitoreo de bruxismo
- Realidad aumentada para educación del paciente
- Blockchain para historiales portables
- IA generativa para planes de tratamiento

**2026**

- Marketplace de segunda opinión con especialistas
- Predicción genética de riesgos dentales
- Robots asistentes para inventario
- Metaverso dental para consultas virtuales

### Expansión Internacional

**Mercados Target**

1. México (base actual)
2. Latinoamérica (Colombia, Perú, Chile)
3. Estados Unidos (mercado hispano)
4. España y mercado europeo

## CONCLUSIÓN: MÁS QUE SOFTWARE, UNA REVOLUCIÓN

Laralis no es solo una digitalización de procesos existentes. Es una reimaginación completa de cómo debe funcionar una clínica dental en el siglo XXI.

Desde su motor financiero único que calcula el costo real por minuto de operación, hasta su sistema de membresías que transforma el modelo de negocio; desde el cumplimiento regulatorio nativo mexicano hasta la inteligencia artificial que genera ROI inmediato; desde el portal del paciente que mejora la experiencia hasta los análisis predictivos que anticipan el futuro - cada elemento de Laralis está diseñado para no solo competir, sino para liderar.

El sistema mantiene la solidez probada de las hojas de cálculo originales, pero las eleva a un nivel de sofisticación, automatización e inteligencia que posiciona a cualquier clínica que lo adopte años por delante de su competencia.

Laralis no es el futuro de la gestión dental. Es el presente para aquellos visionarios que entienden que la tecnología no es un gasto, sino la inversión más rentable que pueden hacer en su práctica.

---

*Esta documentación representa la visión completa y definitiva de Laralis: un sistema que no solo gestiona, sino que transforma la práctica dental. Cada función, cada característica, cada decisión de diseño está orientada a un único objetivo: hacer que las clínicas dentales sean más eficientes, más rentables, y brinden mejor atención a sus pacientes.*

*La complejidad técnica se esconde tras una interfaz simple. La inteligencia artificial trabaja silenciosamente en el fondo. El cumplimiento regulatorio es automático e invisible. Todo para que el profesional dental pueda enfocarse en lo que realmente importa: cuidar la salud bucal de sus pacientes.*

*Laralis: Inteligencia de Negocio Dental para el Profesional Moderno.*
