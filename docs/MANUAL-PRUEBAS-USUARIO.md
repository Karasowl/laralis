# 📋 Manual de Pruebas de Usuario - Laralis Dental Manager

**Versión**: 1.0.0
**Fecha**: 2025-10-16
**Usuario de prueba**: ismaelguimarais@gmail.com / test123456

---

## 🎯 Objetivo

Este documento lista TODAS las pruebas que debes realizar como usuario para verificar el correcto funcionamiento de la aplicación. Cada prueba incluye los pasos exactos y qué verificar en cada momento.

---

## 📚 Índice

1. [Autenticación y Onboarding](#1-autenticación-y-onboarding)
2. [Configuración de Tiempo](#2-configuración-de-tiempo)
3. [Costos Fijos](#3-costos-fijos)
4. [Activos](#4-activos)
5. [Insumos](#5-insumos)
6. [Servicios](#6-servicios)
7. [Pacientes](#7-pacientes)
8. [Tratamientos](#8-tratamientos)
9. [Gastos](#9-gastos)
10. [Tarifas](#10-tarifas)
11. [Dashboard](#11-dashboard)
12. [Reportes](#12-reportes)
13. [Punto de Equilibrio](#13-punto-de-equilibrio)
14. [Marketing](#14-marketing)
15. [Configuración](#15-configuración)
16. [Multi-tenancy](#16-multi-tenancy)

---

## 0. Pruebas Automatizadas en Stage

Para abrir Cypress contra el ambiente de stage sin escribir comandos, usa el lanzador de doble clic:

```text
Abrir Cypress Stage.bat
```

La primera vez pide email/password de stage y los guarda en `apps/dental/cypress.env.json`, que esta ignorado por Git.

Guia completa: [Cypress Stage Testing](./STAGE-CYPRESS-TESTING.md)

Para no depender de memoria de chat, la estrategia de deteccion sistematica de bugs vive en [Laralis Stage QA Harness](./qa/README.md). Ese documento define que se debe probar, con que dataset, contra que resultados esperados y como convertir cada bug en regresion automatizada.

---

## 1. Autenticación y Onboarding

### 1.1 Registro de Usuario Nuevo
**No automatizable - requiere verificación de email**

#### Pasos:
1. Ir a `/auth/register`
2. Llenar formulario con email válido
3. Enviar formulario

#### Verificar:
- ✅ Recibir email de verificación
- ✅ Clic en link del email te lleva a `/auth/verify-email`
- ✅ Mensaje de éxito después de verificar
- ✅ Redirect automático a `/onboarding`

---

### 1.2 Login
**Automatizable**

#### Pasos:
1. Ir a `/auth/login`
2. Ingresar: `ismaelguimarais@gmail.com` / `test123456`
3. Click en "Iniciar Sesión"

#### Verificar:
- ✅ Si no tiene onboarding → redirect a `/onboarding`
- ✅ Si tiene onboarding completo → redirect a `/` (dashboard)
- ✅ Token guardado en localStorage/cookies
- ✅ Sidebar muestra nombre de usuario
- ✅ Selector de clínicas visible (si tiene más de una)

---

### 1.3 Onboarding - Crear Workspace y Clínica
**Obligatorio después del registro**

#### Pasos:
1. Después de login, deberías estar en `/onboarding`
2. **Paso 1 - Workspace**:
   - Nombre: "Mi Consultorio Dental"
   - Click "Continuar"
3. **Paso 2 - Primera Clínica**:
   - Nombre: "Clínica Centro"
   - Dirección: "Av. Principal 123"
   - Teléfono: "1234567890" (opcional)
   - Click "Finalizar"

#### Verificar:
- ✅ Después de crear workspace, avanza automáticamente a paso 2
- ✅ Después de crear clínica, redirect a `/setup`
- ✅ En `/setup` aparece mensaje "¡Bienvenido! Completa la configuración inicial"
- ✅ Sidebar ya muestra las secciones de la app
- ✅ El selector de clínicas en sidebar muestra "Clínica Centro"

---

### 1.4 Setup Inicial
**Configuración obligatoria antes de usar la app**

#### Pasos en `/setup`:
1. **Configuración de Tiempo**:
   - Días laborales: 20
   - Horas por día: 8
   - Porcentaje real: 75 (representa 75% = 0.75)
   - Click "Guardar"

2. **Costos Fijos** (al menos uno):
   - Categoría: "Renta"
   - Concepto: "Renta mensual consultorio"
   - Monto: $10,000.00
   - Click "Agregar"

3. Click en "Completar Configuración"

#### Verificar:
- ✅ Después de guardar tiempo, aparece sección de costos fijos
- ✅ Después de agregar costo fijo, el botón "Completar Configuración" se habilita
- ✅ Al completar, redirect a `/` (dashboard)
- ✅ Dashboard muestra datos iniciales
- ✅ Costo por minuto se calcula automáticamente

---

### 1.5 Logout
**Automatizable**

#### Pasos:
1. Click en tu nombre de usuario (arriba a la derecha)
2. Click en "Cerrar Sesión"

#### Verificar:
- ✅ Redirect a `/auth/login`
- ✅ Token eliminado
- ✅ No puedes acceder a rutas protegidas sin login

---

### 1.6 Recuperar Contraseña
**No automatizable - requiere email**

#### Pasos:
1. En `/auth/login`, click "¿Olvidaste tu contraseña?"
2. Ir a `/auth/forgot-password`
3. Ingresar email
4. Enviar

#### Verificar:
- ✅ Recibir email con link de reset
- ✅ Link te lleva a `/auth/reset-password?token=...`
- ✅ Puedes ingresar nueva contraseña
- ✅ Después de reset, puedes hacer login con nueva contraseña

---

## 2. Configuración de Tiempo

**Ruta**: `/time`
**Dependencias**: Ninguna
**Impacto**: Afecta cálculo de costo fijo por minuto

---

### 2.1 Ver Configuración Actual

#### Pasos:
1. Ir a `/time`

#### Verificar:
- ✅ Se muestra configuración actual (si existe)
- ✅ Se muestra cálculo en vivo:
  - Días laborales × Horas por día = Horas totales
  - Horas totales × Porcentaje real = Horas efectivas
  - Horas efectivas × 60 = Minutos efectivos mensuales
- ✅ Si hay costos fijos, se muestra "Costo por minuto"

---

### 2.2 Crear/Editar Configuración

#### Pasos:
1. En `/time`, llenar formulario:
   - Días laborales: 22
   - Horas por día: 8
   - Porcentaje real: 80
2. Click "Guardar"

#### Verificar:
- ✅ Mensaje de éxito
- ✅ Cálculos se actualizan en vivo
- ✅ Si cambias los valores, el cálculo se recalcula inmediatamente
- ✅ Costo por minuto se actualiza (si hay costos fijos)
- ✅ **CRÍTICO**: Ve a Dashboard y verifica que el KPI de "Costo/Minuto" refleje el nuevo valor

---

### 2.3 Validaciones

#### Probar:
1. Días laborales = 0 → debe dar error
2. Días laborales = -5 → debe dar error
3. Horas por día = 0 → debe dar error
4. Porcentaje real = 0 → debe dar error
5. Porcentaje real = 150 → debe dar error (máximo 100)

#### Verificar:
- ✅ No permite guardar valores inválidos
- ✅ Muestra mensajes de error claros

---

## 3. Costos Fijos

**Ruta**: `/fixed-costs`
**Dependencias**: Configuración de tiempo debe existir
**Impacto**: Afecta costo por minuto y punto de equilibrio

---

### 3.1 Listar Costos Fijos

#### Pasos:
1. Ir a `/fixed-costs`

#### Verificar:
- ✅ Tabla muestra todos los costos fijos
- ✅ Columnas: Categoría, Concepto, Monto, Acciones
- ✅ Montos se muestran en formato moneda (MXN)
- ✅ Hay un total al final de la tabla
- ✅ Si no hay costos, muestra EmptyState con botón "Agregar primero"

---

### 3.2 Crear Costo Fijo

#### Pasos:
1. Click en "Agregar Costo Fijo"
2. Llenar:
   - Categoría: "Servicios"
   - Concepto: "Internet y teléfono"
   - Monto: $1,500.00
3. Click "Guardar"

#### Verificar:
- ✅ Modal se cierra
- ✅ Mensaje de éxito
- ✅ Nuevo costo aparece en la tabla
- ✅ Total se actualiza
- ✅ **CRÍTICO**: Ve a `/time` y verifica que "Costo por minuto" se actualizó
- ✅ **CRÍTICO**: Ve a Dashboard y verifica que el KPI "Costo/Minuto" refleje el cambio

---

### 3.3 Editar Costo Fijo

#### Pasos:
1. En tabla, click en icono de editar (Pencil)
2. Cambiar monto a $2,000.00
3. Click "Guardar"

#### Verificar:
- ✅ Modal se cierra
- ✅ Mensaje de éxito
- ✅ Monto actualizado en tabla
- ✅ Total recalculado
- ✅ Costo por minuto actualizado (verificar en `/time`)

---

### 3.4 Eliminar Costo Fijo

#### Pasos:
1. Click en icono de eliminar (Trash)
2. Confirmar en el diálogo

#### Verificar:
- ✅ Diálogo de confirmación aparece
- ✅ Mensaje de éxito después de eliminar
- ✅ Costo desaparece de la tabla
- ✅ Total se actualiza
- ✅ Si eliminas todos, aparece EmptyState
- ✅ Costo por minuto se actualiza

---

### 3.5 Categorías de Costos Fijos

#### Categorías comunes a probar:
- Renta
- Servicios (luz, agua, internet)
- Salarios
- Seguros
- Mantenimiento
- Marketing
- Otros

#### Verificar:
- ✅ Puedes filtrar por categoría (si existe filtro)
- ✅ Total por categoría se muestra correctamente

---

## 4. Activos

**Ruta**: `/assets`
**Dependencias**: Ninguna
**Impacto**: Afecta cálculo de depreciación en costo fijo por minuto

---

### 4.1 Listar Activos

#### Pasos:
1. Ir a `/assets`

#### Verificar:
- ✅ Tabla con: Nombre, Costo inicial, Vida útil, Valor residual, Depreciación mensual, Acciones
- ✅ Card con resumen en la parte superior:
  - Valor Total de Activos
  - Depreciación Mensual Total
  - Vida Útil Promedio
- ✅ Valores monetarios en formato MXN

---

### 4.2 Crear Activo

#### Pasos:
1. Click "Agregar Activo"
2. Llenar formulario:
   - Nombre: "Sillón Dental Profesional"
   - Costo Inicial: $50,000.00
   - Vida Útil: 60 meses (5 años)
   - Valor Residual: $5,000.00
3. Click "Guardar"

#### Verificar:
- ✅ Modal se cierra
- ✅ Mensaje de éxito
- ✅ Activo aparece en tabla
- ✅ **Depreciación mensual calculada correctamente**:
  - Fórmula: (Costo Inicial - Valor Residual) / Vida Útil
  - Esperado: ($50,000 - $5,000) / 60 = $750.00/mes
- ✅ Resumen actualizado:
  - Valor total aumenta
  - Depreciación mensual total aumenta
  - Vida útil promedio se recalcula

---

### 4.3 Editar Activo

#### Pasos:
1. Click en editar (Pencil)
2. Cambiar vida útil a 48 meses
3. Guardar

#### Verificar:
- ✅ Depreciación mensual se recalcula: ($50,000 - $5,000) / 48 = $937.50/mes
- ✅ Resumen actualizado

---

### 4.4 Eliminar Activo

#### Pasos:
1. Click en eliminar (Trash)
2. Confirmar

#### Verificar:
- ✅ Activo eliminado
- ✅ Resumen actualizado

---

### 4.5 Verificación de Cálculos

#### Crear varios activos y verificar:

**Activo 1: Unidad Dental**
- Costo: $80,000
- Vida útil: 72 meses
- Valor residual: $8,000
- **Depreciación esperada**: $1,000/mes

**Activo 2: Rayos X**
- Costo: $120,000
- Vida útil: 96 meses
- Valor residual: $12,000
- **Depreciación esperada**: $1,125/mes

**Activo 3: Compresor**
- Costo: $15,000
- Vida útil: 60 meses
- Valor residual: $1,500
- **Depreciación esperada**: $225/mes

#### Verificar:
- ✅ Depreciación mensual total = $2,350/mes
- ✅ Valor total activos = $215,000
- ✅ Vida útil promedio = 76 meses

---

## 5. Insumos

**Ruta**: `/supplies`
**Dependencias**: Ninguna
**Impacto**: Afecta costo variable de servicios y tratamientos

---

### 5.1 Listar Insumos

#### Pasos:
1. Ir a `/supplies`

#### Verificar:
- ✅ Tabla con: Nombre, Categoría, Precio, Porciones, Costo/Porción, Acciones
- ✅ Filtros funcionales:
  - Por categoría
  - Búsqueda por nombre
- ✅ **Costo por porción calculado**: Precio / Porciones

---

### 5.2 Crear Insumo

#### Pasos:
1. Click "Agregar Insumo"
2. Llenar:
   - Nombre: "Composite Universal"
   - Categoría: "Materiales"
   - Precio: $500.00
   - Porciones: 20
   - Unidad: "aplicaciones"
   - Notas: "Composite fotopolimerizable"
3. Guardar

#### Verificar:
- ✅ Insumo aparece en tabla
- ✅ **Costo/Porción**: $500.00 / 20 = $25.00
- ✅ Filtro por categoría "Materiales" muestra el insumo

---

### 5.3 Crear Múltiples Insumos de Prueba

**Crear los siguientes para pruebas posteriores:**

**Insumo 1: Anestesia**
- Precio: $200.00
- Porciones: 50
- Categoría: "Medicamentos"
- **Costo/Porción**: $4.00

**Insumo 2: Guantes (caja)**
- Precio: $150.00
- Porciones: 100
- Categoría: "Desechables"
- **Costo/Porción**: $1.50

**Insumo 3: Amalgama**
- Precio: $800.00
- Porciones: 30
- Categoría: "Materiales"
- **Costo/Porción**: $26.67

**Insumo 4: Hilo Dental (rollo)**
- Precio: $50.00
- Porciones: 25
- Categoría: "Desechables"
- **Costo/Porción**: $2.00

#### Verificar:
- ✅ Todos los insumos aparecen en tabla
- ✅ Cálculos de costo/porción correctos
- ✅ Filtros funcionan

---

### 5.4 Editar Insumo

#### Pasos:
1. Editar "Composite Universal"
2. Cambiar precio a $600.00
3. Guardar

#### Verificar:
- ✅ Costo/Porción actualizado: $600 / 20 = $30.00
- ✅ **IMPORTANTE**: Ir a servicios que usen este insumo y verificar que el costo variable se actualizó

---

### 5.5 Eliminar Insumo

#### Pasos:
1. Intentar eliminar "Composite Universal" (si está en algún servicio)

#### Verificar:
- ✅ Si está en uso, debe mostrar error o advertencia
- ✅ Si no está en uso, se elimina correctamente

---

## 6. Servicios

**Ruta**: `/services`
**Dependencias**: Insumos deben existir
**Impacto**: Afecta tratamientos y tarifas

---

### 6.1 Listar Servicios

#### Pasos:
1. Ir a `/services`

#### Verificar:
- ✅ Tabla con: Nombre, Duración, Costo Variable, Acciones
- ✅ Duración en minutos
- ✅ Costo variable en MXN

---

### 6.2 Crear Servicio Simple (sin insumos)

#### Pasos:
1. Click "Agregar Servicio"
2. Llenar:
   - Nombre: "Consulta General"
   - Duración: 30 minutos
   - No agregar insumos
3. Guardar

#### Verificar:
- ✅ Servicio creado
- ✅ Costo variable = $0.00
- ✅ En vista de detalle, sección de insumos vacía

---

### 6.3 Crear Servicio con Insumos (Receta)

#### Pasos:
1. Click "Agregar Servicio"
2. Llenar:
   - Nombre: "Resina Compuesta"
   - Duración: 45 minutos
3. **Agregar insumos** (click "Agregar Insumo"):
   - Insumo 1: "Composite Universal" → Cantidad: 2 porciones
   - Insumo 2: "Anestesia" → Cantidad: 1 porción
   - Insumo 3: "Guantes" → Cantidad: 2 porciones
4. Guardar

#### Verificar MIENTRAS LLENAS EL FORMULARIO:
- ✅ **Preview en vivo del costo variable**:
  - Composite: 2 × $30.00 = $60.00
  - Anestesia: 1 × $4.00 = $4.00
  - Guantes: 2 × $1.50 = $3.00
  - **Total esperado**: $67.00

#### Verificar DESPUÉS DE GUARDAR:
- ✅ Servicio aparece en tabla con costo variable = $67.00
- ✅ Click en el servicio para ver detalle
- ✅ Detalle muestra:
  - Lista de insumos con cantidades
  - Costo individual de cada insumo
  - Costo variable total
  - Duración en minutos

---

### 6.4 Crear Servicio Complejo

#### Pasos:
1. Crear servicio "Corona de Porcelana"
2. Duración: 90 minutos
3. Agregar insumos:
   - Anestesia: 2
   - Guantes: 4
   - Composite: 3
   - Hilo Dental: 1

#### Verificar cálculo:
- ✅ Anestesia: 2 × $4.00 = $8.00
- ✅ Guantes: 4 × $1.50 = $6.00
- ✅ Composite: 3 × $30.00 = $90.00
- ✅ Hilo Dental: 1 × $2.00 = $2.00
- ✅ **Total**: $106.00

---

### 6.5 Editar Servicio - Cambiar Duración

#### Pasos:
1. Editar "Resina Compuesta"
2. Cambiar duración de 45 a 60 minutos
3. Guardar

#### Verificar:
- ✅ Duración actualizada
- ✅ Costo variable NO cambia (solo cambia si modificas insumos)
- ✅ **IMPORTANTE**: Cuando crees un tratamiento con este servicio, el costo fijo debe calcularse con 60 minutos

---

### 6.6 Editar Servicio - Modificar Insumos

#### Pasos:
1. Editar "Resina Compuesta"
2. Cambiar cantidad de Composite de 2 a 3 porciones
3. Guardar

#### Verificar:
- ✅ **Cálculo actualizado**:
  - Composite: 3 × $30.00 = $90.00
  - Anestesia: 1 × $4.00 = $4.00
  - Guantes: 2 × $1.50 = $3.00
  - **Nuevo total**: $97.00
- ✅ Tabla refleja nuevo costo variable
- ✅ **CRÍTICO**: Los tratamientos NUEVOS usan el nuevo costo, pero los tratamientos EXISTENTES mantienen el snapshot antiguo

---

### 6.7 Eliminar Servicio

#### Pasos:
1. Intentar eliminar servicio que tiene tratamientos asociados

#### Verificar:
- ✅ Debe mostrar error o advertencia
- ✅ Eliminar servicio sin tratamientos funciona correctamente

---

## 7. Pacientes

**Ruta**: `/patients`
**Dependencias**: Ninguna
**Impacto**: Requerido para crear tratamientos

---

### 7.1 Listar Pacientes

#### Pasos:
1. Ir a `/patients`

#### Verificar:
- ✅ Tabla con: Nombre, Email, Teléfono, Fecha de registro, Acciones
- ✅ Búsqueda funciona
- ✅ Si no hay pacientes, EmptyState

---

### 7.2 Crear Paciente

#### Pasos:
1. Click "Agregar Paciente"
2. Llenar:
   - Nombre: "Juan Pérez"
   - Email: "juan@example.com"
   - Teléfono: "5551234567"
   - Fecha de nacimiento: "15/05/1985"
   - Dirección: "Calle Falsa 123"
   - Notas: "Alérgico a la penicilina"
3. Guardar

#### Verificar:
- ✅ Paciente aparece en tabla
- ✅ Edad calculada correctamente a partir de fecha de nacimiento
- ✅ Búsqueda por nombre funciona

---

### 7.3 Crear Pacientes de Prueba

**Crear al menos 5 pacientes para pruebas posteriores:**

1. María González - maria@example.com
2. Pedro Martínez - pedro@example.com
3. Ana López - ana@example.com
4. Carlos Rodríguez - carlos@example.com
5. Laura Sánchez - laura@example.com

---

### 7.4 Editar Paciente

#### Pasos:
1. Editar "Juan Pérez"
2. Cambiar teléfono
3. Agregar en notas: "Última limpieza: 01/03/2024"
4. Guardar

#### Verificar:
- ✅ Cambios guardados
- ✅ Historial de tratamientos NO se afecta

---

### 7.5 Ver Detalle de Paciente

#### Pasos:
1. Click en nombre del paciente

#### Verificar:
- ✅ Vista de detalle con información completa
- ✅ **Historial de tratamientos** (si tiene)
- ✅ Total gastado por el paciente
- ✅ Última visita
- ✅ Botón para crear nuevo tratamiento

---

### 7.6 Eliminar Paciente

#### Pasos:
1. Intentar eliminar paciente con tratamientos

#### Verificar:
- ✅ Debe mostrar advertencia
- ✅ Eliminar paciente sin tratamientos funciona

---

## 8. Tratamientos

**Ruta**: `/treatments`
**Dependencias**: Pacientes, Servicios, Configuración de Tiempo, Costos Fijos
**Impacto**: Genera ingresos, afecta reportes y dashboard

---

### 8.1 Listar Tratamientos

#### Pasos:
1. Ir a `/treatments`

#### Verificar:
- ✅ Tabla con: Fecha, Paciente, Servicio, Precio, Estado, Acciones
- ✅ Filtros:
  - Por fecha (rango)
  - Por paciente
  - Por servicio
  - Por estado (completado, pendiente, cancelado)
- ✅ Ordenamiento por fecha (más reciente primero)

---

### 8.2 Crear Tratamiento - Flujo Completo

#### Pre-requisitos:
- ✅ Configuración de tiempo creada (ej: 20 días, 8 horas, 75%)
- ✅ Costos fijos creados (ej: total $15,000/mes)
- ✅ Costo por minuto calculado (ej: $15.63/min)
- ✅ Servicio "Resina Compuesta" creado:
  - Duración: 60 minutos
  - Costo variable: $97.00

#### Pasos:
1. Click "Agregar Tratamiento"
2. Llenar:
   - Paciente: "Juan Pérez"
   - Servicio: "Resina Compuesta"
   - Fecha: Hoy
   - **Observar que se auto-cargan:**
     - Duración: 60 minutos
     - Margen: 40% (valor por defecto)
3. **ANTES de guardar, verificar el preview de costos:**

#### Verificar CÁLCULOS EN VIVO:
```
Duración del servicio: 60 min
Costo fijo por minuto: $15.63/min

1. Costo Fijo = 60 min × $15.63/min = $937.80
2. Costo Variable = $97.00 (del servicio)
3. Costo Base = $937.80 + $97.00 = $1,034.80
4. Margen (40%) = $1,034.80 × 0.40 = $413.92
5. Precio Final = $1,034.80 + $413.92 = $1,448.72
```

#### Verificar:
- ✅ Preview muestra desglose de costos
- ✅ **Precio final sugerido**: ~$1,448.72
- ✅ Puedes ajustar el margen y ver cómo cambia el precio
- ✅ Puedes sobrescribir el precio manualmente

4. Click "Guardar"

#### Verificar DESPUÉS de guardar:
- ✅ Tratamiento aparece en tabla con precio correcto
- ✅ **Ir al Dashboard**:
  - Total de ingresos aumenta
  - Contador de tratamientos aumenta
  - Gráfica de ingresos muestra el nuevo punto
- ✅ **Ir al perfil del paciente "Juan Pérez"**:
  - Tratamiento aparece en su historial
  - Total gastado por el paciente se actualiza

---

### 8.3 Crear Tratamiento con Diferentes Márgenes

#### Crear 3 tratamientos con el mismo servicio pero márgenes diferentes:

**Tratamiento 1: Margen 30%**
- Paciente: María González
- Servicio: Resina Compuesta
- Margen: 30%
- **Precio esperado**: $1,034.80 × 1.30 = $1,345.24

**Tratamiento 2: Margen 50%**
- Paciente: Pedro Martínez
- Servicio: Resina Compuesta
- Margen: 50%
- **Precio esperado**: $1,034.80 × 1.50 = $1,552.20

**Tratamiento 3: Margen 60%**
- Paciente: Ana López
- Servicio: Resina Compuesta
- Margen: 60%
- **Precio esperado**: $1,034.80 × 1.60 = $1,655.68

#### Verificar:
- ✅ Cada tratamiento tiene precio diferente
- ✅ Dashboard refleja todos los ingresos
- ✅ Reportes muestran margen promedio correcto

---

### 8.4 Crear Tratamiento con Precio Personalizado

#### Pasos:
1. Crear nuevo tratamiento
2. En lugar de usar el precio sugerido, ingresar manualmente: $2,000.00
3. Guardar

#### Verificar:
- ✅ Precio guardado es $2,000.00 (no el calculado)
- ✅ Snapshot de costos se guarda correctamente
- ✅ En reportes, puedes ver el margen real logrado

---

### 8.5 Verificar Snapshot Inmutable

#### Objetivo: Verificar que cambiar servicios/insumos NO afecta tratamientos históricos

#### Pasos:
1. Crear tratamiento con "Resina Compuesta" (precio actual)
2. **Anotar el precio del tratamiento**: Ej. $1,448.72
3. Ir a `/supplies` y editar "Composite Universal":
   - Cambiar precio de $600 a $800
   - Nuevo costo/porción: $40.00
4. Ir a `/services` y ver "Resina Compuesta":
   - **Nuevo costo variable**: 3 × $40 + $4 + $3 = $127.00 (aumentó $30)
5. **Volver a `/treatments`**

#### Verificar:
- ✅ El tratamiento anterior SIGUE mostrando $1,448.72
- ✅ NO se recalculó con el nuevo costo variable
- ✅ Si creas un tratamiento NUEVO con el mismo servicio:
  - Costo variable será $127.00
  - Precio será mayor: ~$1,478.72

**Esto es CRÍTICO**: Los tratamientos guardan un snapshot inmutable de los costos al momento de creación.

---

### 8.6 Editar Tratamiento

#### Pasos:
1. Editar un tratamiento existente
2. Cambiar fecha
3. Cambiar estado a "Completado"
4. Agregar notas: "Paciente satisfecho"
5. Guardar

#### Verificar:
- ✅ Cambios guardados
- ✅ **Precio NO se recalcula** (usa snapshot original)
- ✅ En dashboard, tratamientos "Completados" vs "Pendientes" se reflejan correctamente

---

### 8.7 Eliminar Tratamiento

#### Pasos:
1. Eliminar un tratamiento
2. Confirmar

#### Verificar:
- ✅ Tratamiento eliminado
- ✅ **Dashboard actualizado**:
  - Total de ingresos disminuye
  - Contador de tratamientos disminuye
- ✅ En perfil del paciente, el tratamiento ya no aparece

---

### 8.8 Crear Tratamientos en Diferentes Fechas (Para Reportes)

#### Crear 10 tratamientos distribuidos en 3 meses:

**Mes 1 (Enero 2024):**
- 3 tratamientos de diferentes servicios
- Total: ~$4,000

**Mes 2 (Febrero 2024):**
- 4 tratamientos
- Total: ~$6,000

**Mes 3 (Marzo 2024):**
- 3 tratamientos
- Total: ~$5,000

#### Verificar:
- ✅ Dashboard muestra datos del mes actual
- ✅ Reportes permiten filtrar por mes
- ✅ Gráficas muestran evolución mensual

---

## 9. Gastos

**Ruta**: `/expenses`
**Dependencias**: Ninguna (pero se usan en reportes)
**Impacto**: Afecta análisis de rentabilidad

---

### 9.1 Listar Gastos

#### Pasos:
1. Ir a `/expenses`

#### Verificar:
- ✅ Tabla con: Fecha, Categoría, Concepto, Monto, Acciones
- ✅ Filtros:
  - Por fecha
  - Por categoría
  - Búsqueda por concepto
- ✅ Tarjetas de resumen:
  - Total del mes actual
  - Promedio mensual
  - Categoría con más gasto

---

### 9.2 Crear Gasto

#### Pasos:
1. Click "Agregar Gasto"
2. Llenar:
   - Fecha: Hoy
   - Categoría: "Insumos"
   - Concepto: "Compra de materiales dentales"
   - Monto: $3,500.00
   - Notas: "Proveedor X"
3. Guardar

#### Verificar:
- ✅ Gasto aparece en tabla
- ✅ Resumen actualizado:
  - Total del mes aumenta
- ✅ Dashboard muestra el gasto (si tiene widget de gastos)

---

### 9.3 Crear Gastos por Categoría

**Crear al menos un gasto de cada categoría:**

1. **Insumos**: Compra de materiales - $3,500
2. **Mantenimiento**: Reparación de equipo - $1,200
3. **Marketing**: Anuncios en redes sociales - $800
4. **Salarios**: Pago asistente - $8,000
5. **Servicios**: Luz y agua - $600
6. **Otros**: Capacitación - $1,500

#### Verificar:
- ✅ Filtro por categoría funciona
- ✅ Resumen muestra categoría con más gasto
- ✅ **Ir a Reportes** y verificar que se reflejan en el análisis de gastos

---

### 9.4 Editar Gasto

#### Pasos:
1. Editar un gasto
2. Cambiar monto
3. Guardar

#### Verificar:
- ✅ Cambios guardados
- ✅ Resumen actualizado
- ✅ Reportes actualizados

---

### 9.5 Eliminar Gasto

#### Pasos:
1. Eliminar gasto
2. Confirmar

#### Verificar:
- ✅ Gasto eliminado
- ✅ Resumen actualizado

---

### 9.6 Alertas de Gastos (Si existe)

#### Si hay sistema de alertas:
1. Configurar alerta: "Gastos en Insumos > $5,000"
2. Crear gasto de $6,000 en Insumos

#### Verificar:
- ✅ Alerta se dispara
- ✅ Notificación visible en dashboard

---

## 10. Tarifas

**Ruta**: `/tariffs`
**Dependencias**: Configuración de Tiempo, Servicios
**Impacto**: Precios sugeridos para tratamientos

---

### 10.1 Listar Tarifas

#### Pasos:
1. Ir a `/tariffs`

#### Verificar:
- ✅ Tabla con todos los servicios
- ✅ Columnas:
  - Servicio
  - Duración (min)
  - Costo Fijo
  - Costo Variable
  - Costo Base
  - Margen (%)
  - Precio Sugerido
- ✅ Cada fila muestra cálculo completo

---

### 10.2 Ver Desglose de Tarifa

#### Pasos:
1. Click en un servicio para ver detalle

#### Verificar desglose completo:
```
Servicio: Resina Compuesta
Duración: 60 min
Costo por minuto: $15.63

Costos:
- Costo Fijo: 60 × $15.63 = $937.80
- Costo Variable: $127.00
- Costo Base: $1,064.80

Márgenes sugeridos:
- 30%: $1,384.24
- 40%: $1,490.72
- 50%: $1,597.20
- 60%: $1,703.68
```

#### Verificar:
- ✅ Cálculos matemáticos correctos
- ✅ Múltiples opciones de margen
- ✅ Puedes copiar precio para usarlo en tratamientos

---

### 10.3 Actualización Automática de Tarifas

#### Escenario: Cambiar costo por minuto y verificar actualización

#### Pasos:
1. **Anotar tarifa actual** de "Resina Compuesta": Ej. $1,490.72 (40% margen)
2. Ir a `/fixed-costs`
3. Agregar nuevo costo fijo: $2,000
4. **Verificar en `/time`** que costo/minuto aumentó (ej: de $15.63 a $17.71)
5. **Volver a `/tariffs`**

#### Verificar:
- ✅ **Precio sugerido se actualizó automáticamente**:
  - Nuevo costo fijo: 60 × $17.71 = $1,062.60
  - Costo base: $1,062.60 + $127.00 = $1,189.60
  - Precio (40%): $1,665.44
- ✅ Todos los servicios reflejan el nuevo costo/minuto
- ✅ Los tratamientos EXISTENTES siguen con su snapshot antiguo
- ✅ Los tratamientos NUEVOS usarán las nuevas tarifas

---

### 10.4 Impacto de Cambio en Insumos

#### Pasos:
1. Editar insumo usado en servicio
2. Aumentar precio
3. Volver a `/tariffs`

#### Verificar:
- ✅ Costo variable del servicio aumentó
- ✅ Precio sugerido aumentó
- ✅ Tratamientos nuevos usarán nuevo precio

---

## 11. Dashboard

**Ruta**: `/` (página principal)
**Dependencias**: Todas las demás secciones
**Impacto**: Vista consolidada de la operación

---

### 11.1 KPIs Principales

#### Verificar que se muestran:

1. **Ingresos del Mes**
   - Suma de todos los tratamientos del mes actual
   - Comparación con mes anterior (% de cambio)

2. **Tratamientos Realizados**
   - Contador de tratamientos del mes
   - Comparación con mes anterior

3. **Pacientes Nuevos**
   - Pacientes registrados este mes
   - Comparación con mes anterior

4. **Costo por Minuto**
   - Calculado de Configuración de Tiempo + Costos Fijos
   - Icono de alerta si no está configurado

#### Verificar interactividad:
- ✅ Click en cada KPI lleva a sección correspondiente
- ✅ Iconos de tendencia (↑↓) funcionan
- ✅ Colores: verde para aumento, rojo para disminución

---

### 11.2 Gráfica de Ingresos

#### Verificar:
- ✅ Muestra últimos 6-12 meses
- ✅ Barras/líneas con valores correctos
- ✅ Tooltips muestran valor exacto al hover
- ✅ Eje X: meses
- ✅ Eje Y: montos en MXN
- ✅ Permite cambiar vista (mensual/semanal/diaria)

---

### 11.3 Gráfica de Tratamientos por Servicio

#### Verificar:
- ✅ Muestra distribución de servicios
- ✅ Top 5 servicios más realizados
- ✅ Porcentajes suman 100%
- ✅ Colores diferentes por servicio

---

### 11.4 Últimos Tratamientos

#### Verificar:
- ✅ Lista de últimos 5-10 tratamientos
- ✅ Muestra: Fecha, Paciente, Servicio, Monto
- ✅ Click en tratamiento lleva a detalle
- ✅ Botón "Ver todos" lleva a `/treatments`

---

### 11.5 Próximas Citas (Si existe)

#### Si hay módulo de citas:
- ✅ Lista de citas del día/semana
- ✅ Estado: Confirmada, Pendiente, Cancelada
- ✅ Acciones rápidas (confirmar, cancelar)

---

### 11.6 Alertas y Notificaciones

#### Verificar:
- ✅ Alerta si no hay configuración de tiempo
- ✅ Alerta si no hay costos fijos
- ✅ Alerta si no hay servicios creados
- ✅ Notificación de gastos elevados (si aplica)

---

### 11.7 Actualización en Tiempo Real

#### Flujo de prueba:
1. Estar en Dashboard
2. Abrir nueva pestaña
3. Crear un nuevo tratamiento
4. Volver al Dashboard

#### Verificar:
- ✅ Refrescar página muestra nuevos datos
- ✅ (Si hay real-time) Los KPIs se actualizan automáticamente

---

## 12. Reportes

**Ruta**: `/reports`
**Dependencias**: Tratamientos, Gastos
**Impacto**: Análisis de rentabilidad y toma de decisiones

---

### 12.1 Reporte de Ingresos

#### Pasos:
1. Ir a `/reports`
2. Seleccionar "Reporte de Ingresos"
3. Filtrar por mes actual

#### Verificar:
- ✅ **Total de ingresos**: Suma de todos los tratamientos del mes
- ✅ **Desglose por servicio**: Cuánto generó cada servicio
- ✅ **Desglose por paciente**: Top pacientes que más gastaron
- ✅ **Promedio por tratamiento**: Total / Número de tratamientos
- ✅ **Tratamientos por día**: Distribución en el mes
- ✅ Gráficas visuales
- ✅ Botón de exportar a PDF/Excel

---

### 12.2 Reporte de Gastos

#### Pasos:
1. Seleccionar "Reporte de Gastos"
2. Filtrar por mes

#### Verificar:
- ✅ **Total de gastos** del mes
- ✅ **Desglose por categoría**: Porcentaje de cada categoría
- ✅ **Top 5 gastos más altos**
- ✅ **Comparación con mes anterior**
- ✅ Gráfica de pastel/barras
- ✅ Tendencia mensual

---

### 12.3 Reporte de Rentabilidad

#### Pasos:
1. Seleccionar "Reporte de Rentabilidad"
2. Filtrar por mes

#### Verificar cálculos:
```
Ingresos: $50,000
Gastos fijos: $15,000
Gastos variables: $8,000 (de tratamientos)
Otros gastos: $5,000

Utilidad Bruta = Ingresos - Gastos variables = $42,000
Utilidad Neta = Ingresos - Todos los gastos = $22,000
Margen Neto = ($22,000 / $50,000) × 100 = 44%
```

#### Verificar:
- ✅ Cálculos matemáticos correctos
- ✅ **Utilidad Bruta** calculada correctamente
- ✅ **Utilidad Neta** calculada correctamente
- ✅ **Margen de Utilidad** en porcentaje
- ✅ Comparación con meses anteriores
- ✅ Indicadores de rendimiento (bueno/regular/malo)

---

### 12.4 Reporte de Servicios Más Rentables

#### Pasos:
1. Seleccionar "Servicios Más Rentables"
2. Ver análisis

#### Verificar:
Para cada servicio, debe mostrar:
- ✅ **Cantidad de veces realizado**
- ✅ **Ingreso total generado**
- ✅ **Costo promedio**
- ✅ **Margen promedio**
- ✅ **Rentabilidad**: (Ingreso - Costo) / Costo
- ✅ Ordenado de más a menos rentable

---

### 12.5 Reporte de Pacientes

#### Pasos:
1. Seleccionar "Reporte de Pacientes"

#### Verificar:
- ✅ **Pacientes activos**: Con tratamiento en últimos 3 meses
- ✅ **Pacientes inactivos**: Sin tratamiento en 3+ meses
- ✅ **Valor promedio por paciente**: Total gastado / Número de pacientes
- ✅ **Top 10 pacientes**: Los que más han gastado
- ✅ **Pacientes nuevos por mes**: Gráfica de adquisición
- ✅ **Tasa de retención**: Pacientes que regresan

---

### 12.6 Exportar Reportes

#### Pasos:
1. En cualquier reporte, click "Exportar"
2. Seleccionar formato: PDF o Excel
3. Descargar

#### Verificar:
- ✅ Archivo descargado correctamente
- ✅ **PDF**: Formato profesional, con logo, fecha, tablas y gráficas
- ✅ **Excel**: Datos en tabla, fácil de manipular, fórmulas incluidas
- ✅ Nombre del archivo incluye fecha y tipo de reporte

---

### 12.7 Filtros y Comparaciones

#### Probar:
1. Filtrar por rango de fechas personalizado
2. Comparar dos meses diferentes
3. Filtrar por servicio específico
4. Filtrar por categoría de gasto

#### Verificar:
- ✅ Filtros se aplican correctamente
- ✅ Gráficas se actualizan
- ✅ Totales se recalculan
- ✅ Comparaciones muestran % de cambio

---

## 13. Punto de Equilibrio

**Ruta**: `/equilibrium`
**Dependencias**: Configuración de Tiempo, Costos Fijos, Servicios
**Impacto**: Análisis financiero crítico

---

### 13.1 Cálculo del Punto de Equilibrio

#### Pre-requisitos para el cálculo:
- Costos fijos totales: Ej. $15,000/mes
- Servicios con costos variables calculados
- Margen promedio de tratamientos

#### Pasos:
1. Ir a `/equilibrium`

#### Verificar cálculos:

**Supongamos:**
- Costos fijos mensuales: $15,000
- Costo variable promedio: 35% (del precio de venta)
- Margen de contribución: 65%

```
Punto de Equilibrio = Costos Fijos / Margen de Contribución
Punto de Equilibrio = $15,000 / 0.65
Punto de Equilibrio = $23,076.92
```

#### Verificar en la página:
- ✅ **Costos fijos mensuales**: $15,000
- ✅ **Margen de contribución**: 65%
- ✅ **Punto de equilibrio en ingresos**: $23,076.92
- ✅ Si precio promedio por tratamiento es $1,500:
  - **Tratamientos necesarios**: $23,076.92 / $1,500 = 16 tratamientos/mes

---

### 13.2 Análisis de Escenarios

#### Verificar que puedas simular:

**Escenario 1: Aumentar costos fijos**
- Cambiar costos fijos a $18,000
- **Nuevo punto de equilibrio**: $27,692.31
- **Tratamientos necesarios**: 19

**Escenario 2: Reducir costos variables**
- Optimizar recetas para bajar costo variable a 30%
- Margen de contribución: 70%
- **Nuevo punto de equilibrio**: $21,428.57
- **Tratamientos necesarios**: 15

**Escenario 3: Aumentar precios**
- Precio promedio de $1,500 a $1,800
- Costos fijos: $15,000
- **Tratamientos necesarios**: $23,076.92 / $1,800 = 13

#### Verificar:
- ✅ Calculadora de escenarios funciona
- ✅ Resultados actualizados en tiempo real
- ✅ Gráficas muestran impacto visual

---

### 13.3 Margen de Seguridad

#### Pasos:
1. Con ingresos actuales del mes: Ej. $35,000
2. Punto de equilibrio: $23,076.92

#### Verificar cálculo:
```
Margen de Seguridad = Ingresos Actuales - Punto de Equilibrio
Margen de Seguridad = $35,000 - $23,076.92 = $11,923.08

Porcentaje = ($11,923.08 / $35,000) × 100 = 34.07%
```

#### Verificar en la página:
- ✅ **Margen de seguridad**: $11,923.08
- ✅ **Porcentaje**: 34.07%
- ✅ Indicador visual: Verde si > 30%, Amarillo si 15-30%, Rojo si < 15%
- ✅ Interpretación: "Estás 34% por encima del punto de equilibrio"

---

### 13.4 Gráfica de Punto de Equilibrio

#### Verificar:
- ✅ **Eje X**: Número de tratamientos (0 a 30)
- ✅ **Eje Y**: Ingresos/Costos en pesos
- ✅ **Línea roja**: Costos fijos (horizontal en $15,000)
- ✅ **Línea azul**: Costos totales (fijos + variables crecientes)
- ✅ **Línea verde**: Ingresos (crecimiento lineal)
- ✅ **Punto de intersección**: Donde se cruzan costos e ingresos (punto de equilibrio)
- ✅ **Área sombreada**: Zona de pérdida (antes del punto) y zona de ganancia (después)

---

### 13.5 Análisis de Apalancamiento Operativo

#### Si existe esta métrica:
```
Apalancamiento Operativo = Margen de Contribución / Utilidad Operativa

Ejemplo:
Ingresos: $35,000
Costos variables: $12,250 (35%)
Margen de contribución: $22,750 (65%)
Costos fijos: $15,000
Utilidad operativa: $7,750

Apalancamiento = $22,750 / $7,750 = 2.94
```

#### Interpretación:
- ✅ Apalancamiento de 2.94 significa: Por cada 1% de aumento en ventas, la utilidad aumenta 2.94%
- ✅ Indicador muestra sensibilidad del negocio a cambios en volumen

---

## 14. Marketing

**Ruta**: `/marketing`
**Dependencias**: Pacientes, Tratamientos
**Impacto**: Análisis de adquisición y ROI

---

### 14.1 Campañas de Marketing

#### Pasos:
1. Ir a `/marketing`
2. Click "Nueva Campaña"

#### Crear campaña:
- Nombre: "Promoción Limpieza Dental"
- Medio: "Facebook Ads"
- Fecha inicio: 01/03/2024
- Fecha fin: 31/03/2024
- Presupuesto: $2,000
- Objetivo: Adquirir 20 pacientes nuevos

#### Verificar:
- ✅ Campaña aparece en lista
- ✅ Estado: Activa / Finalizada (según fechas)

---

### 14.2 Asignar Pacientes a Campaña

#### Pasos:
1. Al crear/editar paciente
2. Campo "Fuente": Seleccionar "Promoción Limpieza Dental"
3. Guardar

#### Crear 15 pacientes con esta fuente

#### Verificar en página de campaña:
- ✅ **Pacientes adquiridos**: 15
- ✅ **Costo por adquisición**: $2,000 / 15 = $133.33 por paciente

---

### 14.3 Calcular ROI de Campaña

#### Datos:
- Inversión: $2,000
- 15 pacientes adquiridos
- Cada paciente hizo en promedio 2 tratamientos
- Ingreso promedio: $1,500 por tratamiento
- Total ingresos generados: 15 × 2 × $1,500 = $45,000

#### Verificar cálculo de ROI:
```
ROI = ((Ingresos - Inversión) / Inversión) × 100
ROI = (($45,000 - $2,000) / $2,000) × 100 = 2,150%
```

#### Verificar en la página:
- ✅ **Inversión**: $2,000
- ✅ **Ingresos generados**: $45,000
- ✅ **ROI**: 2,150%
- ✅ **Ganancia neta**: $43,000
- ✅ Indicador: Verde (ROI positivo)

---

### 14.4 Comparar Campañas

#### Crear 3 campañas con diferentes resultados:

**Campaña A: Facebook Ads**
- Inversión: $2,000
- Pacientes: 15
- ROI: 2,150%

**Campaña B: Google Ads**
- Inversión: $3,000
- Pacientes: 10
- ROI: 800%

**Campaña C: Volantes**
- Inversión: $500
- Pacientes: 3
- ROI: 500%

#### Verificar:
- ✅ Tabla comparativa de campañas
- ✅ Ordenar por ROI (mayor a menor)
- ✅ Gráfica de barras con ROI de cada campaña
- ✅ Recomendación: "Facebook Ads es tu mejor canal"

---

### 14.5 Pacientes por Fuente

#### Verificar:
- ✅ Gráfica de pastel: Distribución de pacientes por fuente
  - Facebook Ads: 40%
  - Google Ads: 25%
  - Referidos: 20%
  - Volantes: 10%
  - Orgánico: 5%
- ✅ Tabla con detalle de cada fuente

---

### 14.6 Análisis de Retención por Fuente

#### Verificar:
- ✅ Tasa de retorno de pacientes según su fuente
- ✅ Valor de vida del cliente (LTV) por fuente
- ✅ Ejemplo:
  - Pacientes de referidos: LTV $8,000
  - Pacientes de Facebook: LTV $5,500
  - Pacientes de volantes: LTV $3,000

---

## 15. Configuración

**Ruta**: `/settings`

---

### 15.1 Configuración de Cuenta

#### Pasos:
1. Ir a `/settings/account`

#### Verificar:
- ✅ Nombre de usuario
- ✅ Email (no editable)
- ✅ Fecha de registro
- ✅ Botón "Cambiar Contraseña"
- ✅ Botón "Eliminar Cuenta" (con confirmación doble)

---

### 15.2 Cambiar Contraseña

#### Pasos:
1. Click "Cambiar Contraseña"
2. Ingresar contraseña actual
3. Ingresar nueva contraseña (debe cumplir requisitos)
4. Confirmar nueva contraseña
5. Guardar

#### Verificar:
- ✅ Validación de requisitos:
  - Mínimo 8 caracteres
  - Al menos una mayúscula
  - Al menos un número
- ✅ Contraseñas deben coincidir
- ✅ Mensaje de éxito
- ✅ Puedes hacer login con nueva contraseña

---

### 15.3 Preferencias

#### Pasos:
1. Ir a `/settings/preferences`

#### Verificar opciones:
- ✅ **Idioma**: Español / English
- ✅ **Moneda**: MXN / USD / etc.
- ✅ **Formato de fecha**: dd/mm/yyyy vs mm/dd/yyyy
- ✅ **Zona horaria**: America/Mexico_City
- ✅ **Notificaciones**: Email, Push

#### Cambiar idioma a inglés:
- ✅ Toda la UI se traduce
- ✅ Montos siguen en formato correcto
- ✅ Fechas cambian de formato

---

### 15.4 Seguridad

#### Pasos:
1. Ir a `/settings/security`

#### Verificar:
- ✅ **Autenticación de dos factores (2FA)**:
  - Estado: Activada / Desactivada
  - Botón para activar/desactivar
- ✅ **Sesiones activas**:
  - Lista de dispositivos con sesión abierta
  - Botón "Cerrar todas las sesiones"
- ✅ **Historial de actividad**:
  - Login, logout, cambios importantes

---

### 15.5 Gestión de Datos

#### Pasos:
1. Ir a `/settings/data`

#### Verificar opciones:

**Exportar Datos:**
- ✅ Botón "Exportar todos mis datos"
- ✅ Descarga archivo ZIP con:
  - Pacientes (CSV)
  - Tratamientos (CSV)
  - Gastos (CSV)
  - Configuraciones (JSON)

**Importar Datos:**
- ✅ Subir archivo CSV con formato específico
- ✅ Validación de formato
- ✅ Preview antes de importar
- ✅ Importación exitosa con resumen

---

### 15.6 Eliminar Cuenta

**No automatizable - Requiere confirmación extrema**

#### Pasos:
1. Ir a `/settings/account`
2. Click "Eliminar Cuenta"
3. **Primera confirmación**: Diálogo advierte que es PERMANENTE
4. **Segunda confirmación**: Escribir "ELIMINAR" en campo de texto
5. Ingresar contraseña
6. Confirmar

#### Verificar:
- ✅ No permite eliminación accidental
- ✅ Requiere múltiples confirmaciones
- ✅ Después de eliminar:
  - Todos los datos se borran
  - Logout automático
  - No puedes hacer login con esa cuenta

---

### 15.7 Reset de Base de Datos

**EXTREMADAMENTE PELIGROSO - Solo en desarrollo**

#### Pasos:
1. Ir a `/settings/reset`
2. Click "Resetear Base de Datos"
3. Confirmar con contraseña

#### Verificar:
- ✅ **TODOS los datos se eliminan**:
  - Configuración de tiempo
  - Costos fijos
  - Activos
  - Insumos
  - Servicios
  - Pacientes
  - Tratamientos
  - Gastos
  - Marketing
- ✅ Redirect a `/setup` (configuración inicial)
- ✅ App vuelve a estado "recién instalada"

---

## 16. Multi-tenancy

**Objetivo**: Verificar aislamiento entre clínicas

---

### 16.1 Crear Segunda Clínica

#### Pasos:
1. En sidebar, click en selector de clínicas (dropdown)
2. Click "Agregar Clínica"
3. Llenar:
   - Nombre: "Clínica Sur"
   - Dirección: "Av. Sur 456"
4. Guardar

#### Verificar:
- ✅ Nueva clínica aparece en selector
- ✅ Al seleccionarla, cambia contexto

---

### 16.2 Configurar Segunda Clínica

#### En contexto de "Clínica Sur":
1. Configurar tiempo:
   - 18 días laborales
   - 9 horas por día
   - 70% efectividad
2. Agregar costos fijos: $12,000/mes
3. Crear diferentes insumos
4. Crear diferentes servicios

#### Verificar:
- ✅ Configuraciones independientes de "Clínica Centro"

---

### 16.3 Verificar Aislamiento de Datos

#### Crear datos en "Clínica Sur":
- 3 pacientes
- 5 tratamientos
- 2 gastos

#### Cambiar a "Clínica Centro":

#### Verificar:
- ✅ No ves los pacientes de "Clínica Sur"
- ✅ No ves los tratamientos de "Clínica Sur"
- ✅ Dashboard muestra solo datos de "Clínica Centro"
- ✅ Reportes filtran por clínica actual

---

### 16.4 Comparar Métricas entre Clínicas

#### Crear tabla comparativa manual:

| Métrica | Clínica Centro | Clínica Sur |
|---------|----------------|-------------|
| Costo/minuto | $15.63 | $13.50 |
| Pacientes | 25 | 3 |
| Tratamientos (mes) | 45 | 5 |
| Ingresos (mes) | $55,000 | $8,000 |
| Punto de equilibrio | $23,076 | $17,142 |

#### Verificar:
- ✅ Cada clínica tiene métricas independientes
- ✅ Dashboard cambia al cambiar de clínica
- ✅ (Si existe) Reporte consolidado muestra ambas clínicas

---

### 16.5 Eliminar Clínica

#### Pasos:
1. Ir a `/settings/workspaces`
2. Ver lista de clínicas
3. Click "Eliminar" en "Clínica Sur"
4. Confirmar

#### Verificar:
- ✅ Advertencia si tiene datos
- ✅ Al confirmar, clínica y TODOS sus datos se eliminan
- ✅ Si eliminas la clínica activa, cambia automáticamente a otra
- ✅ No puedes eliminar la última clínica

---

## 🎯 Checklist General

### Flujo Completo de Usuario Nuevo

Ejecutar esta secuencia completa sin errores:

1. ✅ Registro → Verificación email → Login
2. ✅ Onboarding: Crear workspace y clínica
3. ✅ Setup: Configurar tiempo y costos fijos
4. ✅ Crear 3 insumos
5. ✅ Crear 2 servicios con recetas
6. ✅ Crear 5 pacientes
7. ✅ Crear 10 tratamientos (diferentes fechas)
8. ✅ Crear 5 gastos
9. ✅ Ver Dashboard actualizado con todos los datos
10. ✅ Generar reporte de rentabilidad
11. ✅ Verificar punto de equilibrio
12. ✅ Exportar datos
13. ✅ Crear segunda clínica
14. ✅ Verificar aislamiento de datos
15. ✅ Logout

---

## 🧮 Verificaciones Matemáticas Críticas

### Cálculo 1: Costo por Minuto
```
Días laborales: 20
Horas por día: 8
Porcentaje real: 75%

Minutos efectivos = 20 × 8 × 60 × 0.75 = 7,200 min/mes

Costos fijos totales: $15,000

Costo por minuto = $15,000 / 7,200 = $2.08/min
```

### Cálculo 2: Precio de Tratamiento
```
Servicio: 60 min, costo variable $100
Costo fijo: 60 × $2.08 = $124.80
Costo base: $124.80 + $100 = $224.80
Margen 40%: $224.80 × 0.40 = $89.92
Precio final: $224.80 + $89.92 = $314.72
```

### Cálculo 3: Punto de Equilibrio
```
Costos fijos: $15,000
Margen de contribución: 65%
Punto de equilibrio = $15,000 / 0.65 = $23,076.92
```

**IMPORTANTE**: Verifica MANUALMENTE cada uno de estos cálculos en la UI.

---

## 📱 Pruebas de Responsividad

### Desktop (1920x1080)
- ✅ Sidebar siempre visible
- ✅ Tablas con todas las columnas
- ✅ Gráficas en tamaño completo

### Tablet (768x1024)
- ✅ Sidebar colapsable
- ✅ Tablas con scroll horizontal
- ✅ KPIs en 2 columnas

### Mobile (375x667)
- ✅ Sidebar oculto, abre con menú hamburguesa
- ✅ Tablas responsive, columnas prioritarias
- ✅ KPIs en 1 columna
- ✅ Formularios adaptados (inputs full-width)

---

## 🐛 Casos Borde y Errores

### Probar con Datos Inválidos:
- ✅ Campos vacíos en formularios → Error claro
- ✅ Números negativos donde no aplican → Error
- ✅ Fechas futuras en tratamientos → Advertencia o permitido según regla de negocio
- ✅ Eliminar entidad con dependencias → Error o confirmación
- ✅ Sesión expirada → Redirect a login

### Probar sin Dependencias:
- ✅ Crear tratamiento sin servicios → Error claro
- ✅ Ver tarifas sin configuración de tiempo → Mensaje de advertencia
- ✅ Dashboard sin datos → EmptyStates apropiados

---

## 📊 Métricas de Éxito

### Performance:
- ✅ Página carga en < 2 segundos
- ✅ Transiciones suaves (sin lag)
- ✅ Tablas con 100+ registros cargan rápido

### UX:
- ✅ Tooltips informativos en campos complejos
- ✅ Mensajes de error claros
- ✅ Confirmaciones para acciones destructivas
- ✅ Feedback visual (spinners, toasts)

### Consistencia:
- ✅ Iconos según ICONOGRAPHY.md
- ✅ Colores consistentes
- ✅ Espaciado uniforme
- ✅ Tipografía consistente

---

## 🚀 Siguiente Nivel

### Pruebas de Estrés:
- ✅ Crear 1,000 pacientes
- ✅ Crear 5,000 tratamientos
- ✅ Generar reporte de año completo
- ✅ Verificar que no hay degradación de performance

---

**Fin del Manual de Pruebas**

Este documento debe actualizarse cuando:
- Se agreguen nuevas funcionalidades
- Se modifiquen cálculos existentes
- Se detecten bugs en los flujos de prueba

**Última actualización**: 2025-10-16
