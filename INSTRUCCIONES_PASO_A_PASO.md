# INSTRUCCIONES PASO A PASO - SCRIPT SEGURO

## ⚠️ IMPORTANTE: Ejecuta sección por sección

El problema es que la tabla `treatments` ya existe pero con columnas diferentes. Este nuevo script te permite ejecutar cada sección por separado para evitar errores.

## Pasos:

### 1. Abre el script `07-fix-step-by-step.sql`

### 2. Ejecuta PRIMERO la SECCIÓN 1 (Diagnóstico)
```sql
-- Copia y ejecuta solo la SECCIÓN 1
```
Esto te mostrará:
- Qué columnas tiene cada tabla
- Qué tablas existen y cuáles no

### 3. Basándote en el diagnóstico:

#### Si `settings_time` tiene `real_hours_percentage`:
Descomenta y ejecuta:
```sql
ALTER TABLE settings_time RENAME COLUMN real_hours_percentage TO real_pct;
```

#### Si `settings_time` tiene `working_days_per_month`:
Descomenta y ejecuta:
```sql
ALTER TABLE settings_time RENAME COLUMN working_days_per_month TO work_days;
```

### 4. Ejecuta SECCIÓN 3 (fixed_costs)
- Primero verás los montos actuales
- Si están muy altos (ej: 200000 en vez de 2000), descomenta y ejecuta el UPDATE

### 5. Ejecuta SECCIÓN 4, 5, 6 en orden
Estas crearán las tablas que faltan

### 6. Ejecuta SECCIÓN 7 (Vista del dashboard)
Esto creará la vista para las métricas

### 7. Ejecuta SECCIÓN 8 (Verificación)
Confirma que todo quedó bien

## Nota importante sobre `treatments`:
La tabla se recreará con la columna `is_paid` en vez de `paid` para evitar conflictos. El código de la aplicación deberá actualizarse para usar `is_paid`.

## Si algo sale mal:
Cada sección es independiente. Si una falla, puedes:
1. Leer el error
2. Ajustar esa sección específica
3. Volver a ejecutarla

## Resultado esperado:
Al final deberías ver:
- ✓ OK para todas las tablas
- `settings_time tiene real_pct: true`
- `settings_time tiene work_days: true`
- `treatments tiene is_paid: true`