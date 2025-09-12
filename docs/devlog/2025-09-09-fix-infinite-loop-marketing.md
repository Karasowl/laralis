# Fix Infinite Loop in Marketing Settings

**Fecha**: 2025-09-09
**Task**: Bugfix
**Área**: UI/Marketing

## Contexto

Se reportó un error de "Maximum update depth exceeded" en el componente MarketingSettingsClient. El error ocurría después de modificar la API para permitir eliminar todas las plataformas de marketing (incluyendo las del sistema).

## Problema

El componente entraba en un loop infinito de re-renders causando que React detectara un "Maximum update depth exceeded". El stack trace indicaba que el problema estaba relacionado con Radix UI presence y compose-refs.

## Causa Raíz

El problema principal estaba en un `useEffect` mal configurado:

```typescript
// PROBLEMA: campaignForm está en las dependencias
useEffect(() => {
  campaignForm.setValue('platform_id', selectedPlatformId)
}, [selectedPlatformId, campaignForm])
```

El objeto `campaignForm` (que viene de `useForm()`) cambia de referencia en cada render cuando se llama a `setValue()`, creando un ciclo infinito:
1. El `useEffect` se ejecuta
2. Llama a `campaignForm.setValue()`
3. Esto causa un re-render
4. El objeto `campaignForm` obtiene una nueva referencia
5. El `useEffect` detecta que cambió `campaignForm` y se ejecuta de nuevo
6. Se repite infinitamente

## Qué Cambió

### 1. Corregir dependencias del useEffect principal (línea 199-201)
```typescript
// ANTES
useEffect(() => {
  campaignForm.setValue('platform_id', selectedPlatformId)
}, [selectedPlatformId, campaignForm])

// DESPUÉS
useEffect(() => {
  campaignForm.setValue('platform_id', selectedPlatformId)
}, [selectedPlatformId]) // campaignForm.setValue es estable
```

### 2. Optimizar renderizado del ActionDropdown (líneas 489-505)
Eliminé la función anónima auto-invocada (IIFE) que creaba el array de actions inline:
```typescript
// ANTES
{(() => {
  const actions: ActionItem[] = [...]
  return <ActionDropdown actions={actions} />
})()}

// DESPUÉS
<ActionDropdown 
  actions={[
    { label: t('common.edit'), ... },
    { label: t('common.delete'), ... }
  ]}
/>
```

### 3. Documentar dependencias estables en otros useEffects
Agregué comentarios explicativos para los otros `useEffect` para clarificar por qué ciertas dependencias no necesitan incluirse.

## Archivos Tocados

- `/mnt/e/dev-projects/laralis/web/app/settings/marketing/MarketingSettingsClient.tsx`

## Antes vs Después

**Antes**: La aplicación crasheaba con "Maximum update depth exceeded" al navegar a configuración de marketing.

**Después**: El componente funciona correctamente sin loops infinitos, permitiendo la gestión normal de plataformas y campañas de marketing.

## Cómo Probar

1. Iniciar el servidor de desarrollo: `npm run dev`
2. Navegar a Configuración > Marketing
3. Verificar que:
   - La página carga sin errores
   - Se pueden crear, editar y eliminar plataformas
   - Se pueden crear, editar y eliminar campañas
   - Los modales funcionan correctamente
   - No hay warnings en la consola sobre "Maximum update depth exceeded"

## Riesgos y Rollback

**Riesgos**: Mínimos, los cambios son quirúrgicos y solo afectan la gestión de dependencias de hooks.

**Rollback**: Si surge algún problema, revertir los cambios en el archivo `MarketingSettingsClient.tsx`.

## Siguientes Pasos

- Revisar otros componentes que usen `useForm` de react-hook-form para asegurar que no tengan problemas similares con las dependencias
- Considerar crear un custom hook para manejar formularios con mejor gestión de dependencias
- Agregar tests E2E para el flujo de marketing

## Lecciones Aprendidas

1. **Nunca incluir objetos de `useForm()` en dependencias de useEffect**: Los métodos como `setValue` son estables, pero el objeto completo no lo es.
2. **Evitar funciones inline complejas en JSX**: Pueden causar re-renders innecesarios y dificultar el debugging.
3. **Documentar dependencias no obvias**: Cuando se omiten dependencias intencionalmente, documentar el por qué.