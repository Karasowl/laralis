# 🗑️ Script de Limpieza Completa de Base de Datos

## ⚠️ ADVERTENCIA CRÍTICA

Este script **ELIMINA TODOS LOS DATOS** de la base de datos, incluyendo:
- ✅ Todos los usuarios registrados (auth.users)
- ✅ Todos los workspaces y clínicas
- ✅ Todos los pacientes y tratamientos
- ✅ Todos los gastos y campañas de marketing
- ✅ Todos los servicios, insumos, activos
- ✅ Todas las configuraciones personalizadas

**NO borra el esquema** (tablas y estructura permanecen intactas).

---

## 🚀 Scripts Disponibles

### 1. **`reset-database-simple.sql`** ⭐ NUEVO - RECOMENDADO

**El script perfecto**: Limpia TODO sin tocar foreign keys usando `TRUNCATE CASCADE`.

**Ventajas**:
- ✅ **NO elimina foreign keys** (100% preservadas)
- ✅ Muy rápido (usa TRUNCATE CASCADE)
- ✅ Automático (descubre tablas dinámicamente)
- ✅ Reinicia auto-incrementos (RESTART IDENTITY)
- ✅ NO requiere restaurar nada después
- ✅ Funciona con cualquier esquema

**Sin desventajas** - Es el mejor enfoque ✨

### 2. **`reset-database-dynamic.sql`** ⚠️ NO USAR - Eliminado temporalmente FKs

Script anterior que eliminaba FKs temporalmente (innecesario).

**Desventaja**:
- ⚠️ Elimina FKs temporalmente (hay que restaurarlas)
- ⚠️ Más complejo sin beneficio real

**Recomendación**: Usa `reset-database-simple.sql` en su lugar

### 3. **`reset-complete-database.sql`**

Script manual basado en la estructura actual detectada (27 tablas, 45 FKs).

**Ventajas**:
- ✅ Preserva foreign keys intactas
- ✅ Respeta el orden de dependencias manualmente

**Desventaja**:
- ⚠️ Requiere actualización si cambia el esquema
- ⚠️ Más lento (usa DELETE en lugar de TRUNCATE)

---

## 📋 Instrucciones de Uso

### ⭐ Opción 1: Script Simple (RECOMENDADO)

1. Ir a tu proyecto en Supabase Dashboard
2. Navegar a: **SQL Editor** (en el menú lateral)
3. Crear una nueva query
4. Copiar TODO el contenido de `reset-database-simple.sql`
5. Pegar en el editor
6. Hacer clic en **Run** (o presionar `Ctrl+Enter`)
7. **VER LA PESTAÑA "Messages"** para seguir el progreso en tiempo real
8. ✅ ¡Listo! No necesitas hacer nada más

**Por qué este es el mejor**:
- ✅ Preserva foreign keys (NO necesitas restaurar nada)
- ✅ Muy rápido (TRUNCATE CASCADE)
- ✅ Reinicia auto-incrementos automáticamente
- ✅ Automático (descubre tablas dinámicamente)

### Opción 2: Script Manual

1. Seguir los pasos 1-7 de arriba pero con `reset-complete-database.sql`
2. Este script también preserva foreign keys
3. Ver la pestaña "Results" para el resumen final

**Cuándo usar**: Si prefieres ver exactamente qué se borra en orden (más explícito pero más lento)

---

## 🔧 Solución de Problemas

### Error: "permission denied for table auth.users"

**Causa**: No tienes permisos para borrar usuarios de autenticación.

**Solución**:
1. Comenta la línea del script:
   ```sql
   -- DELETE FROM auth.users;
   ```
2. Ejecuta el script
3. Borra usuarios manualmente desde:
   - **Dashboard > Authentication > Users**
   - Selecciona todos → Delete

### El script se queda colgado

**Causa**: Hay muchos registros y toma tiempo.

**Solución**:
- **Script dinámico**: Observa la pestaña "Messages" para ver el progreso en tiempo real
- **Script manual**: Espera. Usa transacciones, si falla todo se revierte

### Las foreign keys desaparecieron

**Causa**: Usaste el script anterior (`reset-database-dynamic.sql`) que eliminaba FKs

**Solución**: Ejecuta tus migraciones para restaurarlas:
```bash
supabase db reset --local
# O haz deploy de tu código
```

**Prevención**: Usa `reset-database-simple.sql` que NO elimina las FKs

---

## 📊 Qué Hace el Script Simple (Paso a Paso)

1. **Descubre todas las tablas**: Lee automáticamente el esquema public
2. **Muestra resumen inicial**: Conteo de registros antes de borrar
3. **Deshabilita RLS**: En todas las tablas descubiertas
4. **TRUNCATE CASCADE**: Limpia todas las tablas respetando dependencias automáticamente
   - `RESTART IDENTITY`: Reinicia auto-incrementos a 1
   - `CASCADE`: PostgreSQL limpia automáticamente tablas dependientes
   - **NO elimina foreign keys**: Se preservan intactas
5. **Limpia auth.users**: Elimina todos los usuarios de autenticación
6. **Re-habilita RLS**: Restaura la seguridad
7. **Muestra resumen final**: Confirma que todo está limpio

---

## 🛡️ Seguridad

### Script Simple (reset-database-simple.sql):
- Usa **DO $$ block** con manejo de excepciones
- Si un paso falla, **continúa** con el siguiente (robusto)
- Muestra errores específicos en tiempo real
- Re-habilita RLS incluso si hay errores
- **Preserva foreign keys** (no las toca)
- Cada TRUNCATE es atómico (si falla, no hace nada)

### Script Manual (reset-complete-database.sql):
- Usa una **transacción** (`BEGIN`...`COMMIT`)
- Si algo falla, **todo se revierte** automáticamente
- Orden explícito de eliminación
- Preserva el esquema y políticas de seguridad
- Más lento pero más predecible

---

## 🔄 Después de Limpiar

### Si usaste `reset-database-simple.sql` ⭐ (RECOMENDADO):

1. **Registrar nuevo usuario**:
   - Ir a `/auth/register`
   - Crear cuenta con email + contraseña

2. **Completar onboarding**:
   - Crear workspace
   - Crear clínica
   - Configurar ajustes iniciales

3. **Importar datos** (opcional):
   - Si tienes backup, usar la función de importación

**✅ NO necesitas**:
- ❌ Restaurar foreign keys (están intactas)
- ❌ Ejecutar migraciones
- ❌ Hacer deploy
- ❌ Nada más - simplemente úsalo

### Si usaste `reset-complete-database.sql`:

Lo mismo que arriba. Ambos scripts preservan FKs.

---

## 📝 Casos de Uso

### ✅ Cuándo usar `reset-database-simple.sql` ⭐ (RECOMENDADO):
- **99% de los casos**: Es el mejor script para casi todo
- **Desarrollo activo**: El esquema cambia frecuentemente
- **Testing rápido**: Necesitas limpiar y volver a empezar rápido
- **Producción/Staging**: Preserva FKs intactas
- **Esquema desconocido**: No estás seguro de todas las tablas que existen

### ✅ Cuándo usar `reset-complete-database.sql`:
- **Quieres control total**: Ver exactamente qué se borra y en qué orden
- **Debugging**: Necesitas identificar problemas de dependencias
- **Documentación**: Quieres un registro explícito del proceso

### ✅ Situaciones comunes para cualquiera:
- Ambiente de desarrollo: resetear para testing
- Staging: limpiar antes de nueva prueba
- Después de demos: borrar datos de prueba
- Migración fallida: empezar desde cero

### ❌ Cuándo NO usar estos scripts:
- **NUNCA en producción con datos reales**
- Si solo quieres borrar un workspace específico (usa `reset-single-clinic.sql`)
- Si solo necesitas limpiar campañas (usa `reset-marketing-system.sql`)

---

## 🚨 Checklist Antes de Ejecutar

- [ ] ¿Estoy en el ambiente correcto? (dev/staging, NO producción)
- [ ] ¿Tengo backup si algo sale mal?
- [ ] ¿Confirmé con el equipo que puedo borrar todo?
- [ ] ¿Leí todas las advertencias?
- [ ] ¿Entiendo que esto es IRREVERSIBLE?

---

## 📞 Soporte

Si tienes dudas o problemas:
1. Revisa los logs del script
2. Verifica permisos en Supabase
3. Consulta la documentación de Supabase sobre RLS y autenticación

---

**Última actualización**: 2025-10-18
