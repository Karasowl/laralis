# 📁 Scripts de Base de Datos - Laralis

Este directorio contiene scripts SQL útiles para mantener y gestionar la base de datos.

---

## 📋 Scripts Disponibles

### 1. **`diagnostico-completo-onboarding.sql`** 🔍
**Propósito**: Verificar TODAS las configuraciones necesarias para que el onboarding funcione

**Qué hace**:
- Verifica estructura de tablas `workspaces` y `clinics`
- Verifica que RLS esté habilitado
- Verifica que existan políticas de INSERT
- Identifica exactamente qué está faltando o mal configurado
- **Devuelve TODO en una sola tabla** (compatible con Supabase SQL Editor)

**Cuándo usar**:
- **SIEMPRE PRIMERO** antes de ejecutar cualquier fix
- Cuando el onboarding falla con cualquier error
- Después de ejecutar `reset-database-simple.sql`
- Para verificar que los fixes funcionaron

**Cómo usar**:
1. Copiar todo el archivo
2. Pegar en Supabase SQL Editor
3. Ejecutar
4. Buscar la fila "📊 DIAGNÓSTICO FINAL" en los resultados
5. Si dice "❌ BLOQUEADO", seguir las instrucciones

**Salida esperada**:
```
CATEGORÍA            | VERIFICACIÓN           | ESTADO                    | DETALLE
---------------------|------------------------|---------------------------|----------
📊 DIAGNÓSTICO FINAL | Estado del onboarding  | ✅ DEBERÍA FUNCIONAR ... |
```

**⚠️ IMPORTANTE**: Este script NO modifica nada, solo lee y reporta.

---

### 2. **`fix-onboarding-rls-policies.sql`** 🔐
**Propósito**: Agregar políticas RLS faltantes para que el onboarding funcione

**Qué hace**:
- Agrega política de INSERT para `workspaces` (faltaba completamente)
- Agrega política de INSERT para `clinics` basada en `created_by` (más flexible que la existente)
- Permite a usuarios autenticados crear su primer workspace y clínica

**Cuándo usar**:
- **CRÍTICO**: Ejecutar ANTES de que usuarios nuevos intenten registrarse
- Si el onboarding falla con error "Hubo un problema al crear tu configuración"
- Después de un reset de BD para restaurar las políticas necesarias

**Cómo usar**:
1. Copiar todo el archivo
2. Pegar en Supabase SQL Editor
3. Ejecutar
4. Verificar en la salida que las 3 políticas existen

**Salida esperada**:
```
tabla       | politica                                         | comando
------------|--------------------------------------------------|--------
workspaces  | Users can create their own workspaces            | INSERT
clinics     | Creators can create clinics in their workspace   | INSERT
clinics     | Admins can create clinics                        | INSERT
```

**⚠️ IMPORTANTE**: Este script es OBLIGATORIO para que el onboarding funcione. Sin él, los usuarios no podrán completar el registro.

---

### 3. **`00-structure-simple.sql`** 🔍
**Propósito**: Ver la estructura completa de la base de datos

**Qué hace**:
- Muestra todas las tablas del esquema `public`
- Lista todas las foreign keys con sus reglas CASCADE
- Devuelve todo en un solo resultado fácil de copiar

**Cuándo usar**:
- Necesitas conocer la estructura actual de la BD
- Quieres ver las dependencias entre tablas
- Necesitas documentar el esquema

**Cómo usar**:
1. Copiar todo el archivo
2. Pegar en Supabase SQL Editor
3. Ejecutar
4. Ver resultado en la columna `ESTRUCTURA_BASE_DE_DATOS`

**Salida esperada**:
```
📋 TABLAS:
  - assets
  - categories
  - clinics
  ...

🔗 FOREIGN KEYS (dependencias):
  - patients.clinic_id → clinics.id [DELETE: CASCADE]
  - treatments.patient_id → patients.id [DELETE: CASCADE]
  ...

📊 RESUMEN:
  Total tablas: 27
  Total FKs: 45
```

---

### 4. **`analyze-orphans.sql`** 🔎
**Propósito**: Detectar datos huérfanos en la base de datos

**Qué hace**:
- Analiza TODAS las foreign keys
- Busca registros que apuntan a IDs inexistentes
- Muestra un reporte completo de huérfanos encontrados

**Qué son datos huérfanos**:
Registros que tienen referencias a otros registros que ya no existen. Por ejemplo:
- Un `patient` con `clinic_id = 123` pero la clínica 123 no existe
- Un `treatment` con `patient_id = 456` pero el paciente 456 fue eliminado

**Cuándo usar**:
- Sospechas que hay datos inconsistentes
- Antes de hacer una limpieza
- Después de migraciones o cambios grandes
- Para verificar la integridad de la BD

**Cómo usar**:
1. Copiar todo el archivo
2. Pegar en Supabase SQL Editor
3. Ejecutar
4. Ver resultados en la tabla

**Salida esperada**:
```
# | Tabla               | Columna      | Apunta a         | Huérfanos | Estado
--|---------------------|--------------|------------------|-----------|-------------
1 | patients            | clinic_id    | clinics.id       | 0         | ✅ OK
2 | treatments          | patient_id   | patients.id      | 5         | ❌ PROBLEMA
3 | services            | clinic_id    | clinics.id       | 0         | ✅ OK
...

Resumen General: Total verificaciones: 19 | Con huérfanos: 1 | Total huérfanos: 5 | ⚠️ REQUIERE LIMPIEZA
```

**⚠️ Importante**: Este script solo ANALIZA, NO borra nada.

---

### 5. **`cleanup-orphans.sql`** 🧹
**Propósito**: Eliminar datos huérfanos de la base de datos

**Qué hace**:
- Elimina registros huérfanos automáticamente
- Respeta el orden de dependencias
- Muestra un resumen al final

**Cuándo usar**:
- DESPUÉS de ejecutar `analyze-orphans.sql` y confirmar que hay huérfanos
- Cuando necesitas limpiar inconsistencias
- Antes de una migración importante

**Cómo usar**:
1. **PRIMERO ejecutar `analyze-orphans.sql`** para ver qué se va a borrar
2. Copiar todo el archivo `cleanup-orphans.sql`
3. Pegar en Supabase SQL Editor
4. **REVISAR** que estás de acuerdo con borrar esos datos
5. Ejecutar
6. Verificar el resumen al final

**Salida esperada**:
```
table_name                          | record_count
------------------------------------|-------------
workspaces                          | 5
clinics                             | 12
patients                            | 350
...

✅ Cleanup completed: All orphaned records have been deleted
```

**⚠️ ADVERTENCIA**: Este script SÍ borra datos. Es IRREVERSIBLE.

**⚠️ IMPORTANTE**:
- Siempre ejecuta `analyze-orphans.sql` ANTES
- Haz backup si tienes datos importantes
- Revisa bien qué se va a borrar

---

### 6. **`reset-database-simple.sql`** 🗑️
**Propósito**: Limpiar TODA la base de datos (resetear a vacío)

**Qué hace**:
- Borra TODOS los datos de TODAS las tablas
- Borra TODOS los usuarios (auth.users)
- Preserva la estructura (tablas, FKs, índices, triggers)
- Reinicia auto-incrementos a 1
- Usa TRUNCATE CASCADE (muy rápido)

**Qué NO hace**:
- NO borra el esquema (las tablas permanecen)
- NO borra las foreign keys
- NO borra funciones ni triggers
- NO borra vistas ni políticas RLS

**Cuándo usar**:
- Desarrollo: Resetear para empezar desde cero
- Testing: Limpiar antes de pruebas
- Después de demos: Borrar datos de prueba
- Ambiente de staging: Preparar para nueva prueba

**Cuándo NO usar**:
- ❌ NUNCA en producción con datos reales
- ❌ Si solo quieres borrar datos de una clínica específica
- ❌ Si solo quieres limpiar datos huérfanos

**Cómo usar**:
1. Copiar todo el archivo
2. Pegar en Supabase SQL Editor
3. **VERIFICAR** que estás en el ambiente correcto (dev/staging)
4. Ejecutar
5. Ver progreso en pestaña "Messages"
6. **¡Listo!** - No necesitas hacer nada más

**Salida esperada** (en pestaña Messages):
```
========================================
LIMPIEZA COMPLETA DE DATOS
========================================

Conteo ANTES de limpiar:
TABLA                                    | REGISTROS
----------------------------------------------------------
patients                                 | 150
treatments                               | 320
...

Limpiando todas las tablas (TRUNCATE CASCADE)...
  ✓ patients                             (150 registros)
  ✓ treatments                           (320 registros)
  ...

Limpiando usuarios de autenticación...
  ✓ auth.users (5 usuarios eliminados)

========================================
✅ LIMPIEZA COMPLETADA EXITOSAMENTE
   Todas las tablas están vacías
========================================

ESTRUCTURA PRESERVADA:
  ✓ Tablas y columnas
  ✓ Foreign keys
  ✓ Índices
  ✓ Triggers y funciones
  ✓ Vistas
  ✓ Políticas RLS

SIGUIENTE PASO:
  → Registrar nuevo usuario en /auth/register
  → Completar onboarding (workspace + clínica)
```

**Después de ejecutar**:
- La app funciona 100% normal
- Solo está vacía (sin datos)
- Los usuarios deben registrarse de nuevo
- Hacer onboarding inicial

**⚠️ CHECKLIST ANTES DE EJECUTAR**:
- [ ] ¿Estoy en el ambiente correcto? (dev/staging, NO producción)
- [ ] ¿Tengo backup si algo sale mal?
- [ ] ¿Confirmé que puedo borrar todo?
- [ ] ¿Entiendo que esto es IRREVERSIBLE?

---

## 🎯 Guía Rápida de Uso

### Escenario 1: "El onboarding falla con cualquier error"
```
1. PRIMERO: Ejecutar diagnostico-completo-onboarding.sql
2. Leer la fila "📊 DIAGNÓSTICO FINAL"
3. Si dice "BLOQUEADO - Falta política INSERT", ejecutar: fix-onboarding-rls-policies.sql
4. Si dice "BLOQUEADO - Falta columna", revisar estructura con 00-structure-simple.sql
5. Ejecutar diagnostico-completo-onboarding.sql de nuevo para confirmar
6. Probar onboarding
```

### Escenario 2: "Quiero ver la estructura de la BD"
```
→ Usar: 00-structure-simple.sql
```

### Escenario 3: "Creo que tengo datos inconsistentes"
```
1. Usar: analyze-orphans.sql (para ver)
2. Si hay huérfanos, usar: cleanup-orphans.sql (para limpiar)
```

### Escenario 4: "Quiero empezar desde cero"
```
1. Ejecutar: reset-database-simple.sql
2. IMPORTANTE: Ejecutar: diagnostico-completo-onboarding.sql
3. Si dice "BLOQUEADO", ejecutar el fix correspondiente
4. Verificar de nuevo con diagnostico-completo-onboarding.sql
5. Ahora sí, probar onboarding
```

### Escenario 5: "Después de reset, el onboarding no funciona"
```
1. PRIMERO: diagnostico-completo-onboarding.sql (identificar qué falta)
2. Ejecutar el fix que indique el diagnóstico
3. Confirmar con diagnostico-completo-onboarding.sql
```

---

## 📚 Buenas Prácticas

### 1. Antes de ejecutar CUALQUIER script:
- Lee el archivo completo
- Entiende qué hace
- Verifica el ambiente (dev/staging/prod)
- Haz backup si es necesario

### 2. Para scripts de análisis (solo lectura):
- Ejecuta sin miedo en cualquier ambiente
- Son seguros, no modifican nada

### 3. Para scripts de limpieza (escritura):
- Ejecuta PRIMERO el script de análisis
- Revisa qué se va a borrar
- Confirma que estás de acuerdo
- Luego sí, ejecuta la limpieza

### 4. Para reset completo:
- SOLO en dev/staging
- NUNCA en producción
- Confirma 3 veces antes de ejecutar

---

## ⚠️ Recordatorios Importantes

### ✅ Scripts seguros (solo lectura):
- `diagnostico-completo-onboarding.sql` - Verificación completa del onboarding
- `00-structure-simple.sql` - Ver estructura de BD
- `analyze-orphans.sql` - Detectar datos huérfanos

### 🔧 Scripts de configuración (alteran políticas/estructura):
- `fix-onboarding-rls-policies.sql` - Agrega políticas RLS necesarias

### ⚠️ Scripts destructivos (borran datos):
- `cleanup-orphans.sql` - Borra datos huérfanos
- `reset-database-simple.sql` - Borra TODO

### 🔒 Reglas de oro:
1. **Siempre lee** el script antes de ejecutar
2. **Siempre verifica** el ambiente
3. **Siempre haz backup** si hay datos importantes
4. **Nunca ejecutes** scripts destructivos en producción sin confirmación

---

## 📖 Recursos Adicionales

- **Documentación de Supabase**: https://supabase.com/docs
- **PostgreSQL TRUNCATE**: https://www.postgresql.org/docs/current/sql-truncate.html
- **Foreign Keys**: https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-FK

---

**Última actualización**: 2025-10-18 (Agregado: diagnostico-completo-onboarding.sql - script maestro de diagnóstico)
**Autor**: Equipo Laralis
