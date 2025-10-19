# Troubleshooting: Problemas de Reset de Datos y Caché Persistente

**Fecha**: 2025-10-18
**Tipo**: Guía de Solución de Problemas
**Prioridad**: P0 - Crítico

## 🚨 **Síntomas del Problema**

Si experimentas alguno de estos síntomas, estás afectado por este bug:

1. **✅ Script de reset ejecutado → ❌ Datos siguen apareciendo**
   - Ejecutas `reset-database-simple.sql`
   - Las tablas aparecen "vacías" en SQL
   - Pero al registrarte de nuevo, aparecen clínicas/workspaces viejos

2. **"Failed to create clinic"** aparece de forma inconsistente
   - A veces funciona, a veces no
   - Mismo usuario, mismo navegador, resultados diferentes

3. **Clínicas "fantasma" aparecen después de resetear**
   - Borras todos los datos en Supabase
   - Te registras como nuevo usuario
   - Aparecen clínicas que "no deberían existir"
   - El onboarding te lleva a `/setup` en vez de crear workspace/clínica

4. **Comportamiento diferente entre dispositivos**
   - En tu computadora funciona
   - En el teléfono de otra persona no funciona
   - O viceversa

## 🔍 **Causas Raíz**

Este problema es causado por **3 bugs interconectados**:

### Bug #1: Script de Reset NO borra datos correctamente

**Archivo afectado**: `scripts/reset-database-simple.sql`

**Problema**:
```sql
-- El script hace esto:
1. DISABLE ROW LEVEL SECURITY ✅
2. TRUNCATE TABLE clinics CASCADE ❌ (TRIGGERS se ejecutan)
3. ENABLE ROW LEVEL SECURITY ✅
```

**Por qué falla**:
- Durante el `TRUNCATE`, los TRIGGERS se ejecutan
- `trigger_insert_default_patient_sources` intenta INSERT en `patient_sources`
- `trigger_insert_default_categories` intenta INSERT en `custom_categories`
- Si las funciones trigger NO son `SECURITY DEFINER`, las políticas RLS las bloquean
- El TRUNCATE falla **silenciosamente** dejando datos huérfanos

**Evidencia**:
```
Usuario ejecuta reset → Parece que funciona
Pero en realidad: Algunas filas quedaron sin borrar
Próximo registro: Datos viejos aparecen como fantasmas
```

### Bug #2: Caché Persistente del Navegador

**Archivos afectados**: Cookies, LocalStorage, SessionStorage

**Problema**:
```javascript
// Next.js guarda en cookies:
clinicId = "aff0b9bc-2acb-4d43-a2a9-29fdc61752e2"
workspaceId = "xyz..."

// El guard de onboarding lee las cookies:
if (hasClinicId) {
  redirect('/setup') // ❌ Asume que existe aunque NO existe en BD
}
```

**Por qué falla**:
1. Usuario completa onboarding → Cookies guardadas ✅
2. Desarrollador ejecuta reset en Supabase → BD limpia ✅
3. Usuario se registra de nuevo → **Cookies SIGUEN AHÍ** ❌
4. Frontend lee `clinicId` de cookies → Redirige a `/setup`
5. Pero la clínica NO existe en BD → Errores extraños

**Evidencia**:
- "Clínicas fantasma" aparecen solo en navegadores ya usados
- En modo incógnito funciona correctamente
- Diferentes usuarios ven datos diferentes (sus propias cookies)

### Bug #3: Orden de Ejecución Incorrecto

**Scripts afectados**:
- `fix-rls-policies-complete.sql`
- `FIX-ONBOARDING-COMPLETO-V3.sql`
- `reset-database-simple.sql`

**Problema**:
```
Usuario ejecuta en este orden:
1. fix-rls-policies-complete.sql → Crea políticas RLS ✅
2. FIX-ONBOARDING-COMPLETO-V3.sql → SECURITY DEFINER ✅
3. reset-database-simple.sql → ❌ FALLA

¿Por qué falla el reset?
- Las políticas RLS están activas
- Los triggers intentan INSERT
- Las funciones pueden haber perdido SECURITY DEFINER
- Las políticas bloquean los INSERTs
- El reset falla parcialmente
```

**Resultado**: Base de datos en estado inconsistente.

## ✅ **Solución Completa**

### Opción A: Script TODO-EN-UNO (RECOMENDADO)

Este script hace TODO en el orden correcto automáticamente.

#### Paso 1: Ejecutar Script Principal

```bash
1. Ve a Supabase Dashboard → SQL Editor
2. Abre: scripts/COMPLETE-RESET-AND-SETUP.sql
3. Copia TODO el contenido
4. Pega en SQL Editor
5. Click "Run" (▶️)
6. Espera 30-60 segundos
7. Verifica que el mensaje final sea: "✅ TODO CONFIGURADO CORRECTAMENTE"
```

**¿Qué hace este script?**
- ✅ Deshabilita triggers ANTES del reset (evita errores)
- ✅ Borra todos los datos correctamente
- ✅ Configura políticas RLS completas
- ✅ Crea funciones helper con SECURITY DEFINER
- ✅ Configura onboarding (category_types + triggers)
- ✅ Re-habilita todo al final
- ✅ Verifica que todo funcione

#### Paso 2: Limpiar Caché del Navegador

**Opción 2A: Usar Script Automático** (RECOMENDADO)
```bash
1. Abrir la aplicación en el navegador
2. Presionar F12 (DevTools)
3. Ir a pestaña "Console"
4. Abrir: scripts/clear-browser-cache.js
5. Copiar TODO el contenido
6. Pegar en la consola
7. Presionar Enter
8. Verificar mensaje: "✅ LIMPIEZA COMPLETADA"
9. Recargar página: Ctrl+Shift+R
```

**Opción 2B: Limpieza Manual**
```bash
1. F12 → Application tab
2. Storage → Clear site data
3. Marcar TODAS las opciones:
   ✓ Cookies
   ✓ Local and session storage
   ✓ IndexedDB
   ✓ Web SQL
   ✓ Cache storage
   ✓ Service workers
4. Click "Clear site data"
5. Recargar: Ctrl+Shift+R
```

**Opción 2C: Modo Incógnito** (MÁS SIMPLE)
```bash
1. Cerrar TODAS las pestañas de la aplicación
2. Abrir navegador en modo incógnito (Ctrl+Shift+N)
3. Ir a la aplicación
4. Registrarse como nuevo usuario
```

#### Paso 3: Probar Onboarding

```bash
1. Ir a /auth/register
2. Registrarse con email NUEVO (nunca usado antes)
3. Completar datos de workspace
4. Completar datos de clínica
5. Click "Siguiente"

✅ Debe funcionar SIN errores:
   - Workspace creado
   - Clínica creada
   - Redirige a /setup (6 pasos)
   - Puede guardar assets sin errores

❌ Si aparece "Failed to create clinic":
   - El script SQL NO se ejecutó correctamente
   - Revisar mensajes de error en Supabase
   - Volver a ejecutar scripts/COMPLETE-RESET-AND-SETUP.sql
```

### Opción B: Scripts Individuales (Para Debugging)

Si el script TODO-EN-UNO falla, ejecuta paso a paso:

#### 1. Reset Mejorado
```bash
Ejecutar: scripts/reset-database-FIXED.sql
Verificar: Mensaje "✅ RESET COMPLETADO EXITOSAMENTE"
```

#### 2. Políticas RLS Completas
```bash
Ejecutar: scripts/fix-rls-policies-complete.sql
Verificar: "✅ ÉXITO: Todas las tablas críticas (10) tienen políticas RLS"
```

#### 3. Fix de Onboarding
```bash
Ejecutar: scripts/FIX-ONBOARDING-COMPLETO-V3.sql
Verificar: "✅ TODO LISTO - Onboarding debería funcionar"
```

#### 4. Limpiar Caché
```bash
Ejecutar: scripts/clear-browser-cache.js en consola del navegador
O usar modo incógnito
```

## 🧪 **Cómo Verificar que el Fix Funcionó**

### Test 1: Base de Datos Limpia

```sql
-- Ejecutar en Supabase SQL Editor
SELECT 'workspaces' as tabla, COUNT(*) as registros FROM workspaces
UNION ALL
SELECT 'clinics', COUNT(*) FROM clinics
UNION ALL
SELECT 'patients', COUNT(*) FROM patients
UNION ALL
SELECT 'auth.users', COUNT(*) FROM auth.users;

-- Resultado esperado: 0 en todas las filas
```

### Test 2: Políticas RLS Activas

```sql
-- Ejecutar: scripts/verify-rls-fix.sql

-- Resultado esperado:
-- ✅ 2 funciones helper existen
-- ✅ 10 tablas con RLS activo
-- ✅ 10 tablas con 4 políticas cada una
```

### Test 3: Caché Limpio

```javascript
// En la consola del navegador (F12)
console.log('Cookies:', document.cookie);
console.log('localStorage:', localStorage.length);
console.log('sessionStorage:', sessionStorage.length);

// Resultado esperado:
// Cookies: (vacío)
// localStorage: 0
// sessionStorage: 0
```

### Test 4: Onboarding Funcional (E2E)

```bash
1. Modo incógnito
2. /auth/register
3. Email: test-{timestamp}@test.com
4. Completar workspace: "Mi Clínica Test"
5. Completar clínica: "Clínica Central"
6. Click "Siguiente"

Verificar:
✅ NO aparece "Failed to create clinic"
✅ Redirige a /setup
✅ Muestra "0 de 6 pasos listos"
✅ Puede guardar assets sin errores
✅ Puede crear insumos sin errores
✅ Puede crear servicios sin errores
```

## 📋 **Checklist de Solución**

Use esta checklist para asegurarse de que ejecutó todos los pasos:

- [ ] 1. Ejecutado `scripts/COMPLETE-RESET-AND-SETUP.sql` en Supabase
- [ ] 2. Verificado mensaje "✅ TODO CONFIGURADO CORRECTAMENTE"
- [ ] 3. Limpiado caché del navegador (script o modo incógnito)
- [ ] 4. Verificado que no hay cookies de la aplicación
- [ ] 5. Registrado nuevo usuario con email nunca usado
- [ ] 6. Completado onboarding SIN errores
- [ ] 7. Verificado que puede crear workspace/clínica
- [ ] 8. Verificado que puede completar los 6 pasos de setup
- [ ] 9. Probado crear servicio (sin errores en Network Activity)
- [ ] 10. Probado dashboard (gráficos cargan correctamente)

## ⚠️ **Problemas Comunes y Soluciones**

### Problema: "Quedan X registros sin limpiar"

**Solución**:
```bash
1. Borrar usuarios manualmente:
   - Dashboard > Authentication > Users
   - Seleccionar todos
   - Delete
2. Re-ejecutar scripts/COMPLETE-RESET-AND-SETUP.sql
```

### Problema: "Funciones NO son SECURITY DEFINER"

**Solución**:
```bash
1. Ejecutar SOLO la parte 5 del script:
   - Copiar desde "PARTE 5: FIX DE ONBOARDING"
   - Hasta antes de "PARTE 6"
2. Pegar en SQL Editor
3. Ejecutar
```

### Problema: "Políticas RLS bloqueando operaciones"

**Solución**:
```bash
1. Verificar que las funciones helper existen:
   SELECT proname FROM pg_proc WHERE proname = 'user_has_clinic_access';

2. Si no existen, ejecutar:
   scripts/fix-rls-policies-complete.sql
```

### Problema: "Clínicas fantasma siguen apareciendo"

**Causa**: Caché del navegador NO limpiado

**Solución**:
```bash
1. CERRAR todas las pestañas de la app
2. CERRAR el navegador completamente
3. Abrir navegador en modo incógnito
4. Probar ahí (estado 100% limpio garantizado)
```

### Problema: "A veces funciona, a veces no"

**Causa**: Diferentes dispositivos/navegadores con diferentes cookies

**Solución**:
```bash
1. Limpiar caché en TODOS los dispositivos/navegadores
2. O usar SOLO modo incógnito para pruebas
3. Educar a usuarios a limpiar caché después de resets
```

## 📚 **Archivos Relacionados**

### Scripts SQL
- `scripts/COMPLETE-RESET-AND-SETUP.sql` - **Script principal TODO-EN-UNO**
- `scripts/reset-database-FIXED.sql` - Reset mejorado (standalone)
- `scripts/fix-rls-policies-complete.sql` - Políticas RLS completas
- `scripts/FIX-ONBOARDING-COMPLETO-V3.sql` - Fix de onboarding
- `scripts/verify-rls-fix.sql` - Verificación de RLS
- `scripts/diagnostic-rls-status.sql` - Diagnóstico de estado

### Scripts JavaScript
- `scripts/clear-browser-cache.js` - Limpieza automática de caché

### Documentación
- `docs/devlog/2025-10-18-fix-services-revenue-rls-errors.md` - Fix de políticas RLS
- `docs/devlog/2025-10-18-fix-onboarding-multiple-issues.md` - Fix de onboarding
- `docs/TROUBLESHOOTING-RESET-AND-CACHE.md` - **Este documento**

## 🎯 **Prevención Futura**

Para evitar este problema en el futuro:

### 1. **Siempre usar el script TODO-EN-UNO**
```bash
NO usar: reset-database-simple.sql (DEPRECATED)
SÍ usar: COMPLETE-RESET-AND-SETUP.sql
```

### 2. **Siempre limpiar caché después de reset**
```bash
Crear un procedimiento estándar:
1. Reset en Supabase
2. Limpiar caché INMEDIATAMENTE
3. Probar en modo incógnito primero
```

### 3. **Educación de testers**
```bash
Documentar en onboarding de desarrolladores:
- Cómo resetear correctamente
- Por qué el caché causa problemas
- Cómo usar modo incógnito
```

### 4. **Automatización con Scripts**
```bash
Crear comando npm:
npm run reset:complete

Que ejecute:
1. Script SQL via Supabase CLI
2. Script de limpieza de caché
3. Abrir navegador en modo incógnito automáticamente
```

## 📝 **Notas Técnicas**

### ¿Por qué los triggers causan problemas durante TRUNCATE?

PostgreSQL ejecuta triggers **ANTES** de completar el TRUNCATE:
```sql
TRUNCATE clinics CASCADE;
  ↓
  Trigger: insert_default_patient_sources()
    ↓
    INSERT INTO patient_sources (...) -- Si falla por RLS...
    ↓
  TRUNCATE falla o se completa parcialmente
```

### ¿Por qué SECURITY DEFINER es necesario?

```sql
-- SIN SECURITY DEFINER:
CREATE FUNCTION insert_default_patient_sources() -- Ejecuta como usuario
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO patient_sources (...); -- ❌ Bloqueado por RLS
END;
$$;

-- CON SECURITY DEFINER:
CREATE FUNCTION insert_default_patient_sources() -- Ejecuta como owner de la función
RETURNS TRIGGER
SECURITY DEFINER -- ✅ Bypasea RLS
SET search_path = public -- Previene SQL injection
AS $$
BEGIN
  INSERT INTO patient_sources (...); -- ✅ Permitido
END;
$$;
```

### ¿Por qué el caché persiste?

Next.js usa cookies para:
1. Server-side rendering (SSR)
2. Persistencia entre recargas
3. Autenticación

Las cookies NO se borran cuando:
- Ejecutas SQL en Supabase
- Haces deploy de código nuevo
- Recargas la página (F5)

SOLO se borran cuando:
- Limpias caché manualmente
- Usas modo incógnito
- Las cookies expiran

---

**✅ Si seguiste esta guía completa, el problema debe estar resuelto.**

**⚠️ Si el problema persiste, reporta en el equipo con:**
1. Captura de pantalla del error
2. Output del script SQL
3. Output del script de caché
4. Navegador y dispositivo usado