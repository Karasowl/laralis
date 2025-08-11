# 🚨 EJECUTA ESTE SCRIPT FINAL

## Script a ejecutar: `08-fix-simple.sql`

Este es el script definitivo que arregla todos los problemas sin errores.

## ¿Qué hace este script?

1. **Arregla settings_time** - Renombra columnas de forma segura (maneja si ya existen)
2. **Corrige fixed_costs** - Divide montos entre 100 si están muy altos
3. **Crea service_supplies** - Para relacionar servicios con insumos
4. **Crea patients** - Tabla de pacientes
5. **Recrea treatments** - Con estructura correcta y columna `is_paid`
6. **Crea vista del dashboard** - Para métricas

## Instrucciones:

### 1. Abre Supabase SQL Editor

### 2. Copia TODO el contenido de `web/scripts/08-fix-simple.sql`

### 3. Pégalo y ejecuta

### 4. Revisa los resultados
Al final verás:
- Lista de tablas con ✓ o ✗
- Verificación de columnas clave
- Muestra de datos de fixed_costs

## ¿Qué esperar?

Deberías ver:
```
✓ Existe     para todas las tablas
✓            para todas las columnas clave
Montos razonables en fixed_costs (ej: 2000 centavos = $20 pesos)
```

## Si algo falla:

Este script está diseñado para NO fallar. Maneja todos los casos:
- Si una columna ya existe, no intenta crearla de nuevo
- Si una tabla ya existe, no intenta crearla de nuevo
- Los foreign keys se agregan solo si no existen

## Después de ejecutar:

1. **Reinicia el servidor** (Ctrl+C y `npm run dev`)
2. **Prueba**:
   - Crear pacientes
   - Configurar tiempo
   - Ver costos fijos (deberían mostrar $20 no $2000)

## Nota importante:

La tabla `treatments` usa `is_paid` en vez de `paid`. Esto es intencional para evitar conflictos con palabras reservadas de SQL.