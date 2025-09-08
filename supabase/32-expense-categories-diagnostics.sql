-- Diagnóstico rápido de esquema para categorías y gastos
-- Copia/pega este bloque en el SQL Editor de Supabase y ejecuta.

-- 1) Columnas relacionadas con 'clinic' en las tablas clave
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('category_types','categories','expenses')
  and (column_name ilike '%clinic%' or column_name ilike '%workspace%')
order by table_name, column_name;

-- 2) Columnas completas por tabla (para confirmar nombres)
select 'category_types' as tbl, json_agg(column_name order by ordinal_position) as cols
from information_schema.columns where table_schema='public' and table_name='category_types';

select 'categories' as tbl, json_agg(column_name order by ordinal_position) as cols
from information_schema.columns where table_schema='public' and table_name='categories';

select 'expenses' as tbl, json_agg(column_name order by ordinal_position) as cols
from information_schema.columns where table_schema='public' and table_name='expenses';

