# Instrucciones para Ejecutar la Migración 28_add_cascade_delete.sql

## Pasos:

1. **Abre el SQL Editor de Supabase:**
   https://supabase.com/dashboard/project/ojlfihowjakbgobbrwjz/sql

2. **Copia el contenido del archivo:**
   `supabase/migrations/28_add_cascade_delete.sql`

3. **Pega el SQL en el editor**

4. **Click en "Run" o presiona Ctrl+Enter**

5. **Verifica que aparezca:**
   ✅ Success. No rows returned

## ¿Qué hace esta migración?

Agrega CASCADE DELETE a todas las relaciones de la base de datos:

### Flujo de eliminación:
- Eliminar WORKSPACE → Elimina todas sus CLINICS
- Eliminar CLINIC → Elimina TODOS los datos relacionados:
  - settings_time
  - fixed_costs  
  - assets
  - supplies
  - services (y sus service_supplies)
  - patients (y sus treatments)
  - treatments
  - expenses
  - tariffs
  - marketing_platforms (y sus campaigns)
  - expense_categories

## Validación post-migración:

Puedes verificar que funciona con esta consulta:

```sql
-- Ver las foreign keys con CASCADE
SELECT
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    rc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND rc.delete_rule = 'CASCADE'
ORDER BY tc.table_name, kcu.column_name;
```

Deberías ver todas las tablas con CASCADE configurado.
