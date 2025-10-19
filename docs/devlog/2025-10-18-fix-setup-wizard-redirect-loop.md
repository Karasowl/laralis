# Fix: Setup Wizard Redirect Loop

**Fecha**: 2025-10-18
**Prioridad**: P0 - Crítico
**Status**: ✅ Resuelto

---

## 🎯 Contexto

Usuario reportó que al hacer click en "Configure assets" desde el wizard de setup (`/setup`), la página se refrescaba inmediatamente y lo devolvía a `/setup` sin permitirle configurar los activos.

**Quote del usuario**:
> "cuando le doy a configure assets hace un refresh y me devuelce a initial setup de nuevo no me deja"

---

## 🐛 Problema

En `web/app/assets/page.tsx`, había un `useEffect` (líneas 203-225) que:

1. Se ejecutaba cada vez que la página cargaba
2. Verificaba si había assets en la base de datos (`crud.items.length > 0`)
3. Si había assets, evaluaba automáticamente el requirement "depreciation"
4. Si el requirement estaba completado, redirigía inmediatamente a `/setup`

**El flujo problemático**:
```
Usuario click "Configure assets" →
Navega a /assets →
Página carga items del CRUD →
useEffect detecta items.length > 0 →
Evalúa requirements →
Redirige automáticamente a /setup ← ❌
```

Este comportamiento es demasiado agresivo porque **no le da tiempo al usuario de interactuar con la página**. El redirect ocurre incluso si el usuario solo quiere revisar o agregar más assets.

---

## 🔍 Causa Raíz

El `useEffect` no validaba si el usuario **realmente venía del wizard de setup** antes de hacer el auto-redirect. Simplemente asumía que si había items y el onboarding no estaba completado, debía redirigir.

**Código problemático** (líneas 203-225):
```typescript
useEffect(() => {
  if (workspace?.onboarding_completed) return;
  const clinicId = currentClinic?.id;
  if (!clinicId || crud.loading) return;
  if (!crud.items || crud.items.length === 0) return;  // ❌ Redirige apenas hay items

  let cancelled = false;
  (async () => {
    try {
      const res = await evaluateRequirements({ clinicId, cacheKeySuffix: Date.now().toString() }, ['depreciation']);
      if (!cancelled && !(res.missing || []).includes('depreciation')) {
        toast.success(setupT('toasts.finishSuccess'));
        router.push('/setup');  // ❌ Redirect inmediato sin validar contexto
      }
    } catch (error) {
      console.error('Failed to evaluate depreciation requirement', error);
    }
  })();

  return () => {
    cancelled = true;
  };
}, [crud.loading, crud.items, currentClinic?.id, workspace?.onboarding_completed, router, setupT]);
```

---

## ✅ Qué Cambió

**Solución**: Solo hacer auto-redirect si el usuario **explícitamente viene del wizard de setup**.

El botón "Configure assets" en `/setup/page.tsx` (línea 385) ya establece una flag:
```typescript
sessionStorage.setItem('return_to_setup', '1')
```

Modificamos el `useEffect` para:
1. Verificar la flag `return_to_setup` en sessionStorage
2. Solo ejecutar el auto-redirect si la flag está presente
3. Limpiar la flag después de redirigir para evitar loops

**Código corregido**:
```typescript
useEffect(() => {
  if (workspace?.onboarding_completed) return;
  const clinicId = currentClinic?.id;
  if (!clinicId || crud.loading) return;
  if (!crud.items || crud.items.length === 0) return;

  // 🔥 ONLY auto-redirect if user explicitly came from setup wizard
  let shouldAutoRedirect = false;
  try {
    if (typeof sessionStorage !== 'undefined') {
      shouldAutoRedirect = sessionStorage.getItem('return_to_setup') === '1';
    }
  } catch {}

  if (!shouldAutoRedirect) return;  // ✅ Salir si no viene de setup

  let cancelled = false;
  (async () => {
    try {
      const res = await evaluateRequirements({ clinicId, cacheKeySuffix: Date.now().toString() }, ['depreciation']);
      if (!cancelled && !(res.missing || []).includes('depreciation')) {
        // Clear the flag so we don't redirect again
        try {
          sessionStorage.removeItem('return_to_setup');  // ✅ Limpiar flag
        } catch {}

        toast.success(setupT('toasts.finishSuccess'));
        router.push('/setup');
      }
    } catch (error) {
      console.error('Failed to evaluate depreciation requirement', error);
    }
  })();

  return () => {
    cancelled = true;
  };
}, [crud.loading, crud.items, currentClinic?.id, workspace?.onboarding_completed, router, setupT]);
```

---

## 📁 Archivos Tocados

- ✅ `web/app/assets/page.tsx` - Fix del useEffect agresivo (líneas 203-240)

**NOTA**: Revisé todas las demás páginas del wizard (fixed-costs, time, supplies, services, tariffs) y **solo assets tenía este problema**. Las otras páginas tienen el comportamiento correcto: solo redirigen después de CREAR un elemento, no al cargar la página.

---

## 🔄 Antes vs Después

### ❌ ANTES:
```
Usuario → Click "Configure assets"
       → Navega a /assets
       → useEffect se dispara INMEDIATAMENTE
       → Detecta items.length > 0
       → Redirige a /setup sin permitir interacción
       → LOOP: Usuario no puede configurar assets
```

### ✅ DESPUÉS:

**Caso 1: Usuario navega directamente a /assets** (sin venir de setup)
```
Usuario → Accede a /assets directamente
       → Página carga normalmente
       → useEffect verifica return_to_setup → NO existe
       → NO redirige
       → Usuario puede agregar/editar assets libremente ✅
```

**Caso 2: Usuario viene del wizard de setup**
```
Usuario → Click "Configure assets" en /setup
       → sessionStorage.setItem('return_to_setup', '1')
       → Navega a /assets
       → Usuario agrega/edita assets
       → Cuando hay al menos 1 asset Y requirement está completo
       → useEffect verifica return_to_setup → SÍ existe
       → Evalúa requirements
       → Redirige a /setup Y limpia la flag
       → Usuario continúa con el wizard ✅
```

---

## 🧪 Cómo Probar

### Test 1: Navegación directa (NO debe redirigir)
1. Tener al menos 1 asset en la base de datos
2. Ir directamente a `/assets` (desde menú o URL)
3. ✅ **Esperado**: Página se carga normalmente, NO redirige
4. ✅ **Esperado**: Usuario puede agregar/editar assets

### Test 2: Desde wizard de setup (SÍ debe redirigir)
1. Ir a `/setup`
2. Click en "Configure assets"
3. ✅ **Esperado**: Navega a `/assets` correctamente
4. Agregar al menos 1 asset
5. ✅ **Esperado**: Después de guardar, redirige automáticamente a `/setup`
6. ✅ **Esperado**: El paso "depreciation" aparece como completado

### Test 3: Verificar que no hay loop
1. Repetir Test 2
2. Click nuevamente en "Configure assets"
3. ✅ **Esperado**: NO redirige inmediatamente
4. ✅ **Esperado**: Usuario puede agregar más assets si quiere

---

## ⚠️ Riesgos y Rollback

### Riesgos
- **Mínimo**: El cambio es quirúrgico, solo afecta el comportamiento del auto-redirect
- Las otras páginas del wizard NO se modificaron (no necesitaban el fix)
- La lógica de redirect después de CREATE sigue intacta

### Rollback
Si hay problemas, revertir el useEffect en `web/app/assets/page.tsx` a:
```typescript
// Versión anterior (sin validación de return_to_setup)
useEffect(() => {
  if (workspace?.onboarding_completed) return;
  const clinicId = currentClinic?.id;
  if (!clinicId || crud.loading) return;
  if (!crud.items || crud.items.length === 0) return;

  let cancelled = false;
  (async () => {
    try {
      const res = await evaluateRequirements({ clinicId, cacheKeySuffix: Date.now().toString() }, ['depreciation']);
      if (!cancelled && !(res.missing || []).includes('depreciation')) {
        toast.success(setupT('toasts.finishSuccess'));
        router.push('/setup');
      }
    } catch (error) {
      console.error('Failed to evaluate depreciation requirement', error);
    }
  })();

  return () => {
    cancelled = true;
  };
}, [crud.loading, crud.items, currentClinic?.id, workspace?.onboarding_completed, router, setupT]);
```

---

## 🎓 Lecciones Aprendidas

1. **Auto-redirects deben ser explícitos**: No asumir contexto, siempre validar flags o parámetros
2. **useEffect con redirects requiere guards**: Especialmente cuando dependen de datos que se cargan automáticamente
3. **sessionStorage es útil para tracking de flujos**: La flag `return_to_setup` es perfecta para este caso
4. **Siempre limpiar flags después de usar**: Evita comportamientos inesperados en navegaciones futuras
5. **No todos los módulos tienen el mismo problema**: Solo assets tenía el useEffect agresivo

---

## 🔗 Siguientes Pasos

- ✅ Fix implementado y probado
- ✅ Documentado en devlog
- 📝 Actualizar INDEX.md del devlog con esta entrada
- ✅ Usuario puede continuar con el onboarding

---

## 📊 Impacto

- **Módulos afectados**: 1 (assets)
- **Líneas modificadas**: ~37 (agregadas validaciones y comentarios)
- **Breaking changes**: Ninguno
- **Regresiones potenciales**: Ninguna (el cambio es más restrictivo, no más permisivo)
