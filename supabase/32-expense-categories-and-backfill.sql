-- =============================================================
-- Fase 1: Categorías de Gastos (multi‑tenant) + Backfill
-- Ubicación del archivo: supabase/32-expense-categories-and-backfill.sql
-- Cómo usar: copia el contenido en el SQL Editor de Supabase y ejecuta.
-- Si ves algún error, copia el output y te envío un fix inmediato.
--
-- Requisitos previos (ya existen en este proyecto, ver 31-categories-system.sql):
--   - Tabla category_types(clinic_id, code, name, ...)
--   - Tabla categories(id, clinic_id, category_type_id, code, name, ...)
--   - Tabla clinics(id)
--   - Tabla expenses(id, clinic_id, category, ...)
-- =============================================================

-- 0) Asegurar índices base en category_types y categories
create unique index if not exists ux_category_types_clinic_code
  on category_types(clinic_id, code);

create index if not exists idx_categories_lookup
  on categories(clinic_id, category_type_id, is_active, display_order);

DO $$
BEGIN
  -- Primero intentamos insertando con display_name; si la columna no existe, caemos al insert sin ella
  BEGIN
    INSERT INTO category_types (clinic_id, code, name, display_name, description, is_system)
    SELECT c.id, 'expenses', 'Gastos', 'Gastos', 'Categorías de gastos', true
    FROM clinics c
    LEFT JOIN category_types ct
      ON ct.clinic_id = c.id AND ct.code = 'expenses'
    WHERE ct.id IS NULL
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN undefined_column THEN
    INSERT INTO category_types (clinic_id, code, name, description, is_system)
    SELECT c.id, 'expenses', 'Gastos', 'Categorías de gastos', true
    FROM clinics c
    LEFT JOIN category_types ct
      ON ct.clinic_id = c.id AND ct.code = 'expenses'
    WHERE ct.id IS NULL
    ON CONFLICT DO NOTHING;
  END;
END $$;

DO $$
BEGIN
  -- Intentar con display_name; si la columna no existe, caer al insert sin ella
  BEGIN
    WITH expense_type AS (
      SELECT ct.id AS category_type_id, ct.clinic_id
      FROM category_types ct
      WHERE ct.code = 'expenses'
    )
    INSERT INTO categories (
      clinic_id, category_type_id, code, name, display_name, description, display_order,
      is_active, is_system, metadata
    )
    SELECT et.clinic_id, et.category_type_id, v.code, v.name, v.name, v.descr, v.ord,
           true, true, '{}'::jsonb
    FROM expense_type et
    CROSS JOIN (VALUES
      ('EQUIPOS','Equipos','Compras de equipos y mobiliario',10),
      ('INSUMOS','Insumos','Materiales y consumibles',20),
      ('SERVICIOS','Servicios','Servicios (luz, agua, internet, etc.)',30),
      ('MANTENIMIENTO','Mantenimiento','Mantenimiento de equipos/instalaciones',40),
      ('MARKETING','Marketing','Publicidad y promoción',50),
      ('ADMIN','Administrativos','Gastos administrativos',60),
      ('PERSONAL','Personal','Nómina y beneficios',70),
      ('OTROS','Otros','Otros gastos',90)
    ) AS v(code,name,descr,ord)
    LEFT JOIN categories c
      ON c.clinic_id = et.clinic_id
     AND c.category_type_id = et.category_type_id
     AND c.code = v.code
    WHERE c.id IS NULL
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN undefined_column THEN
    WITH expense_type AS (
      SELECT ct.id AS category_type_id, ct.clinic_id
      FROM category_types ct
      WHERE ct.code = 'expenses'
    )
    INSERT INTO categories (
      clinic_id, category_type_id, code, name, description, display_order,
      is_active, is_system, metadata
    )
    SELECT et.clinic_id, et.category_type_id, v.code, v.name, v.descr, v.ord,
           true, true, '{}'::jsonb
    FROM expense_type et
    CROSS JOIN (VALUES
      ('EQUIPOS','Equipos','Compras de equipos y mobiliario',10),
      ('INSUMOS','Insumos','Materiales y consumibles',20),
      ('SERVICIOS','Servicios','Servicios (luz, agua, internet, etc.)',30),
      ('MANTENIMIENTO','Mantenimiento','Mantenimiento de equipos/instalaciones',40),
      ('MARKETING','Marketing','Publicidad y promoción',50),
      ('ADMIN','Administrativos','Gastos administrativos',60),
      ('PERSONAL','Personal','Nómina y beneficios',70),
      ('OTROS','Otros','Otros gastos',90)
    ) AS v(code,name,descr,ord)
    LEFT JOIN categories c
      ON c.clinic_id = et.clinic_id
     AND c.category_type_id = et.category_type_id
     AND c.code = v.code
    WHERE c.id IS NULL
    ON CONFLICT DO NOTHING;
  END;
END $$;

-- 3) Agregar FK category_id en expenses (nullable durante la migración)
alter table if exists expenses
  add column if not exists category_id uuid null;

do $$ begin
  -- agregar la FK si no existe
  if not exists (
    select 1
    from pg_constraint
    where conname = 'fk_expenses_category'
  ) then
    alter table expenses
      add constraint fk_expenses_category
      foreign key (category_id) references categories(id);
  end if;
exception when others then
  raise notice 'Aviso: no se pudo crear FK (puede existir). Detalle: %', sqlerrm;
end $$;

create index if not exists idx_expenses_category_id on expenses(category_id);

-- 4) Backfill: mapear gastos existentes a category_id
-- 4.1 intentar por code (UPPER(category))
with expense_type as (
  select ct.clinic_id, ct.id as category_type_id
  from category_types ct
  where ct.code = 'expenses'
)
update expenses e
set category_id = c.id
from expense_type et
join categories c
  on c.clinic_id = et.clinic_id
 and c.category_type_id = et.category_type_id
where e.clinic_id = et.clinic_id
  and e.category_id is null
  and c.code = upper(coalesce(e.category, ''));

-- 4.2 intentar por nombre (ILIKE)
with expense_type as (
  select ct.clinic_id, ct.id as category_type_id
  from category_types ct
  where ct.code = 'expenses'
)
update expenses e
set category_id = c.id
from expense_type et
join categories c
  on c.clinic_id = et.clinic_id
 and c.category_type_id = et.category_type_id
where e.clinic_id = et.clinic_id
  and e.category_id is null
  and c.name ilike coalesce(e.category, '');

-- 4.3 fallback a OTROS
with expense_type as (
  select ct.clinic_id, ct.id as category_type_id
  from category_types ct
  where ct.code = 'expenses'
),
otros as (
  select c.clinic_id, c.id
  from categories c
  join expense_type et
    on et.clinic_id = c.clinic_id
   and et.category_type_id = c.category_type_id
  where c.code = 'OTROS'
)
update expenses e
set category_id = o.id
from otros o
where e.clinic_id = o.clinic_id
  and e.category_id is null;

-- 5) (Opcional) endurecer después de migrar todo
-- alter table expenses alter column category_id set not null;

-- 6) Comprobaciones rápidas (ejecuta estas SELECTs manualmente si quieres verificar)
-- select clinic_id, code, name from category_types where code='expenses';
-- select clinic_id, code, name from categories c
--  join category_types ct on ct.id = c.category_type_id
--  where ct.code='expenses'
--  order by clinic_id, display_order;
-- select count(*) as total, count(category_id) as mapeados from expenses;
