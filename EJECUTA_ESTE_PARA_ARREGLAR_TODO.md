# 🚨 EJECUTA ESTE SCRIPT PARA ARREGLAR LOS PROBLEMAS RESTANTES

## Script: `11-fix-remaining-issues.sql`

Este script arregla TODOS los problemas que reportaste:

1. ✅ **Costos Fijos mostrando $2,900 en vez de $29**
2. ✅ **Pacientes que no se guardan**
3. ✅ **Categorías duplicadas en Servicios**
4. ✅ **Permisos de base de datos**

## Instrucciones:

### 1. Abre Supabase SQL Editor

### 2. Ejecuta el script
Copia y pega TODO el contenido de: `web/scripts/11-fix-remaining-issues.sql`

### 3. Verifica los resultados
El script te mostrará:
- Estado de fixed_costs antes y después
- Si la tabla patients existe
- Categorías duplicadas eliminadas
- Permisos otorgados

## Después de ejecutar:

### 1. Reinicia el servidor
```bash
Ctrl+C
npm run dev
```

### 2. Prueba de nuevo:

#### Costos Fijos
- Crea un nuevo costo de $29
- Debe guardarse como $29, NO como $2,900

#### Pacientes
- Crea un nuevo paciente
- Debe guardarse correctamente
- La lista debe actualizarse

#### Servicios
- Las categorías NO deben aparecer duplicadas
- Debe poder agregar insumos

## Si algo sigue sin funcionar:

Abre las DevTools del navegador (F12) y revisa:
1. La pestaña **Console** para ver errores JavaScript
2. La pestaña **Network** para ver si las llamadas al API fallan

Comparte cualquier error que veas para poder ayudarte.