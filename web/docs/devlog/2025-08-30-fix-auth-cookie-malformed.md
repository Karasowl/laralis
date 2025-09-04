# Fix: Problema de cookies malformadas en autenticación móvil

**Fecha**: 2025-08-30  
**Task**: BUGFIX-20250830-auth-cookie-mobile  
**PR**: #fix-auth-cookies

## Contexto

Los usuarios experimentaban un problema crítico donde al navegar desde el Dashboard a la página de Pacientes en vista móvil, se les pedía iniciar sesión nuevamente. El error en consola mostraba:

```
Failed to parse cookie string: SyntaxError: Unexpected token 'b', "base64-eyJ"... is not valid JSON
```

## Problema

Las cookies de autenticación de Supabase estaban siendo malformadas con un prefijo "base64-" que causaba que JSON.parse fallara al intentar leer el valor de la cookie. Esto ocurría principalmente en navegación móvil.

## Causa raíz

1. **Manejo inconsistente de cookies**: El middleware creaba múltiples objetos NextResponse, lo que podía causar problemas de sincronización de cookies
2. **Falta de validación**: No se validaba ni limpiaba el formato de las cookies antes de procesarlas
3. **Versiones de @supabase/ssr**: Posible incompatibilidad con el manejo de cookies en ciertas versiones

## Qué cambió

### 1. Middleware mejorado (`middleware.ts`)
- Se usa un único objeto `response` en lugar de recrearlo múltiples veces
- Se agregó validación y limpieza de cookies con prefijo "base64-"
- Se sanitizan las cookies tanto al leer como al escribir

### 2. Cliente de servidor mejorado (`lib/supabase/server.ts`)
- Se agregó validación para detectar y limpiar cookies malformadas
- Se mejoraron los logs de debug para rastrear problemas

### 3. Cliente del navegador mejorado (`lib/supabase/client.ts`)
- Se implementó manejo manual de cookies con validación
- Se agregó decodificación/codificación segura con URIComponent
- Se previene la escritura de cookies malformadas

### 4. Sistema de limpieza automática
- Nuevo archivo `lib/supabase/clean-cookies.ts` con utilidades de limpieza
- Componente `CookieCleanup` que limpia cookies al montar la app
- Limpieza automática cuando la app vuelve a ser visible

### 5. Página de diagnóstico (`app/test-auth/page.tsx`)
- Herramienta para verificar el estado de autenticación
- Detección de cookies malformadas
- Botones para limpiar cookies y probar navegación

## Archivos tocados

- `E:\dev-projects\laralis\web\middleware.ts` - Validación de cookies mejorada
- `E:\dev-projects\laralis\web\lib\supabase\server.ts` - Limpieza de cookies en servidor
- `E:\dev-projects\laralis\web\lib\supabase\client.ts` - Manejo robusto de cookies en cliente
- `E:\dev-projects\laralis\web\lib\supabase\clean-cookies.ts` - Utilidades de limpieza (nuevo)
- `E:\dev-projects\laralis\web\components\providers\cookie-cleanup.tsx` - Componente de limpieza (nuevo)
- `E:\dev-projects\laralis\web\app\layout.tsx` - Integración del componente de limpieza
- `E:\dev-projects\laralis\web\app\test-auth\page.tsx` - Página de diagnóstico mejorada

## Antes vs Después

### Antes
- Cookies podían tener formato: `sb-token=base64-eyJ...`
- JSON.parse fallaba con: `Unexpected token 'b'`
- Usuarios perdían sesión al navegar en móvil

### Después
- Se detectan y limpian cookies malformadas automáticamente
- Se previene la escritura de cookies con formato incorrecto
- La sesión persiste correctamente en todas las navegaciones

## Cómo probar

1. **Verificar estado actual**:
   - Navegar a `/test-auth` para ver el estado de autenticación
   - Verificar que no hay cookies malformadas (con prefijo base64-)

2. **Probar navegación móvil**:
   - Abrir DevTools y activar vista móvil
   - Iniciar sesión normalmente
   - Navegar entre Dashboard → Pacientes → Tratamientos
   - Verificar que NO se pide volver a iniciar sesión

3. **Probar limpieza automática**:
   - Si hay cookies malformadas, se limpiarán automáticamente
   - Verificar en `/test-auth` que las cookies están limpias

4. **Probar con diferentes tamaños de pantalla**:
   - Desktop (>1024px)
   - Tablet (768-1024px)
   - Móvil (<768px)

## Riesgos y rollback

### Riesgos
- Mínimos: los cambios son principalmente defensivos y de validación
- Si un usuario tiene cookies muy corruptas, podría necesitar limpiar manualmente

### Rollback
Si es necesario revertir:
1. Revertir los cambios en los archivos de Supabase
2. Eliminar los componentes de limpieza
3. Los usuarios pueden limpiar cookies manualmente con: `localStorage.clear(); sessionStorage.clear()`

## Siguientes pasos

- [ ] TASK-20250830-monitor-auth - Monitorear logs de autenticación por 48h
- [ ] TASK-20250830-upgrade-supabase - Considerar actualizar @supabase/ssr a última versión
- [ ] TASK-20250830-auth-persistence - Implementar mejor persistencia de sesión offline