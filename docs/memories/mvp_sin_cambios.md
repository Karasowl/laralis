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