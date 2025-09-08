# INSTRUCCIONES PARA ARREGLAR LA BASE DE DATOS

## Pasos a seguir:

### 1. Abre Supabase SQL Editor
- Ve a tu proyecto en Supabase
- En el menú lateral, busca "SQL Editor"
- Crea un nuevo query

### 2. Ejecuta el script completo
Copia y pega TODO el contenido del archivo `web/scripts/05-arreglar-todo.sql` y ejecuta.

Este script va a:
- ✅ Renombrar columnas en settings_time para que coincidan con el código
- ✅ Corregir los montos en fixed_costs (dividir entre 100)
- ✅ Crear la tabla service_supplies para relacionar servicios con insumos
- ✅ Crear la tabla patients para gestionar pacientes
- ✅ Crear la tabla treatments para registrar tratamientos
- ✅ Crear una vista v_dashboard_metrics para el dashboard

### 3. Verifica que todo esté bien
Al final del script verás una verificación que te mostrará:
- Si las columnas se renombraron correctamente
- Si los montos se corrigieron
- Si las tablas nuevas se crearon

### 4. Reinicia la aplicación
Después de ejecutar el script:
1. Detén el servidor de desarrollo (Ctrl+C)
2. Vuelve a ejecutar `npm run dev`
3. Prueba:
   - Configurar Tiempo (debería guardar correctamente ahora)
   - Ver Costos Fijos (debería mostrar $20 en vez de $2,000)
   - Agregar insumos a servicios (debería funcionar ahora)
   - Crear pacientes y tratamientos

## Si algo sale mal:
Si ves algún error al ejecutar el script, cópialo y pégalo aquí para que pueda ayudarte a resolverlo.

## Orden importante:
Es CRÍTICO que ejecutes el script `05-arreglar-todo.sql` antes de continuar usando la aplicación, ya que sin estos cambios muchas funciones no funcionarán correctamente.