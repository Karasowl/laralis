# INSTRUCCIONES ACTUALIZADAS PARA ARREGLAR LA BASE DE DATOS

## ⚠️ IMPORTANTE: Usa el script 06-fix-all-ordered.sql

El script anterior tenía un error. Por favor usa el nuevo script que está ordenado correctamente.

## Pasos a seguir:

### 1. Abre Supabase SQL Editor
- Ve a tu proyecto en Supabase
- En el menú lateral, busca "SQL Editor"
- Crea un nuevo query

### 2. Ejecuta el script completo
Copia y pega TODO el contenido del archivo `web/scripts/06-fix-all-ordered.sql` y ejecuta.

Este script va a:
- ✅ Renombrar columnas en settings_time de forma segura
- ✅ Corregir los montos en fixed_costs (dividir entre 100)
- ✅ Crear la tabla service_supplies para relacionar servicios con insumos
- ✅ Crear la tabla patients para gestionar pacientes
- ✅ Crear la tabla treatments con el nombre correcto de columna (price_cents)
- ✅ Crear una vista v_dashboard_metrics para el dashboard

### 3. Verifica los resultados
Al final del script verás varias verificaciones:
- La primera mostrará si settings_time tiene las columnas correctas
- La segunda mostrará los montos de fixed_costs corregidos
- La tercera confirmará que todas las tablas nuevas se crearon
- La cuarta mostrará ejemplos de los datos corregidos

### 4. Reinicia la aplicación
Después de ejecutar el script exitosamente:
1. Detén el servidor de desarrollo (Ctrl+C)
2. Vuelve a ejecutar `npm run dev`
3. Prueba:
   - Configurar Tiempo (debería guardar correctamente ahora)
   - Ver Costos Fijos (debería mostrar $20 en vez de $2,000)
   - Crear y buscar pacientes
   - Agregar insumos a servicios

## Solución de problemas:

### Si ves el error "column already exists"
Esto significa que algunas partes del script ya se ejecutaron. Es seguro, el script está diseñado para manejar esto.

### Si ves el error "column does not exist"
Revisa qué columnas existen actualmente ejecutando:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('settings_time', 'treatments');
```

### Si necesitas revertir cambios
Guarda este script de reversión por si acaso:
```sql
-- Solo ejecutar si necesitas revertir
ALTER TABLE settings_time RENAME COLUMN real_pct TO real_hours_percentage;
ALTER TABLE settings_time RENAME COLUMN work_days TO working_days_per_month;
UPDATE fixed_costs SET amount_cents = amount_cents * 100;
DROP TABLE IF EXISTS treatments CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS service_supplies CASCADE;
DROP VIEW IF EXISTS v_dashboard_metrics;
```

## Confirmación de éxito:
Si todo salió bien, deberías ver al final del script:
- settings_time: tiene_real_pct = true, tiene_work_days = true
- fixed_costs: montos entre 1000-50000 centavos (10-500 pesos)
- Todas las tablas con estado "✓ Creada"