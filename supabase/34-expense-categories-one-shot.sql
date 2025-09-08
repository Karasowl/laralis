-- =============================================================
-- One‑shot: normaliza categorías + seed de Gastos + backfill
-- Ejecútalo solo este archivo en el SQL Editor de Supabase.
-- Es idempotente: lo puedes correr más de una vez.
-- =============================================================

-- 0) Normalizar columnas mínimas necesarias (compatibilidad)
DO $$ BEGIN
  -- category_types
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='category_types' AND column_name='clinic_id'
  ) THEN
    ALTER TABLE category_types ADD COLUMN clinic_id UUID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='category_types' AND column_name='code'
  ) THEN
    ALTER TABLE category_types ADD COLUMN code VARCHAR(50);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='category_types' AND column_name='name'
  ) THEN
    ALTER TABLE category_types ADD COLUMN name VARCHAR(100);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='category_types' AND column_name='display_name'
  ) THEN
    ALTER TABLE category_types ADD COLUMN display_name VARCHAR(100);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='category_types' AND column_name='is_system'
  ) THEN
    ALTER TABLE category_types ADD COLUMN is_system BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='category_types' AND column_name='is_active'
  ) THEN
    ALTER TABLE category_types ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='category_types' AND column_name='created_at'
  ) THEN
    ALTER TABLE category_types ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='category_types' AND column_name='updated_at'
  ) THEN
    ALTER TABLE category_types ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- categories
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='categories' AND column_name='clinic_id'
  ) THEN
    ALTER TABLE categories ADD COLUMN clinic_id UUID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='categories' AND column_name='category_type_id'
  ) THEN
    ALTER TABLE categories ADD COLUMN category_type_id UUID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='categories' AND column_name='parent_id'
  ) THEN
    ALTER TABLE categories ADD COLUMN parent_id UUID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='categories' AND column_name='code'
  ) THEN
    ALTER TABLE categories ADD COLUMN code VARCHAR(50);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='categories' AND column_name='name'
  ) THEN
    ALTER TABLE categories ADD COLUMN name VARCHAR(100);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='categories' AND column_name='display_name'
  ) THEN
    ALTER TABLE categories ADD COLUMN display_name VARCHAR(100);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='categories' AND column_name='entity_type'
  ) THEN
    ALTER TABLE categories ADD COLUMN entity_type VARCHAR(50);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='categories' AND column_name='description'
  ) THEN
    ALTER TABLE categories ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='categories' AND column_name='icon'
  ) THEN
    ALTER TABLE categories ADD COLUMN icon VARCHAR(50);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='categories' AND column_name='color'
  ) THEN
    ALTER TABLE categories ADD COLUMN color VARCHAR(7);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='categories' AND column_name='display_order'
  ) THEN
    ALTER TABLE categories ADD COLUMN display_order INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='categories' AND column_name='is_system'
  ) THEN
    ALTER TABLE categories ADD COLUMN is_system BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='categories' AND column_name='is_active'
  ) THEN
    ALTER TABLE categories ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='categories' AND column_name='metadata'
  ) THEN
    ALTER TABLE categories ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='categories' AND column_name='created_at'
  ) THEN
    ALTER TABLE categories ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='categories' AND column_name='updated_at'
  ) THEN
    ALTER TABLE categories ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- 1) Arreglar display_name nulos por compatibilidad
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='category_types' AND column_name='display_name'
  ) THEN
    UPDATE category_types SET display_name = name WHERE display_name IS NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='categories' AND column_name='display_name'
  ) THEN
    UPDATE categories SET display_name = name WHERE display_name IS NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='categories' AND column_name='entity_type'
  ) THEN
    -- Si existe entity_type y hay nulos para categorías de gastos, poner 'expenses'
    WITH expense_type AS (
      SELECT id FROM category_types WHERE code = 'expenses'
    )
    UPDATE categories c
    SET entity_type = 'expenses'
    FROM expense_type et
    WHERE c.category_type_id = et.id AND (c.entity_type IS NULL OR c.entity_type = '');
  END IF;
END $$;

-- 2) Eliminar constraints únicas globales que chocan (si existen)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='category_types_name_key' AND conrelid='public.category_types'::regclass
  ) THEN ALTER TABLE category_types DROP CONSTRAINT category_types_name_key; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='category_types_code_key' AND conrelid='public.category_types'::regclass
  ) THEN ALTER TABLE category_types DROP CONSTRAINT category_types_code_key; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='category_types_display_name_key' AND conrelid='public.category_types'::regclass
  ) THEN ALTER TABLE category_types DROP CONSTRAINT category_types_display_name_key; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='categories_name_key' AND conrelid='public.categories'::regclass
  ) THEN ALTER TABLE categories DROP CONSTRAINT categories_name_key; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='categories_code_key' AND conrelid='public.categories'::regclass
  ) THEN ALTER TABLE categories DROP CONSTRAINT categories_code_key; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='categories_display_name_key' AND conrelid='public.categories'::regclass
  ) THEN ALTER TABLE categories DROP CONSTRAINT categories_display_name_key; END IF;
END $$;

-- 3) Índices/únicos correctos (multi‑tenant)
CREATE UNIQUE INDEX IF NOT EXISTS ux_category_types_clinic_code ON category_types(clinic_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS ux_categories_clinic_type_code ON categories(clinic_id, category_type_id, code);
CREATE INDEX IF NOT EXISTS idx_categories_lookup ON categories(clinic_id, category_type_id, is_active, display_order);

-- 4) Sembrar el tipo 'expenses' por clínica (idempotente y seguro)
INSERT INTO category_types (clinic_id, code, name, display_name, description, is_system)
SELECT c.id, 'expenses', 'Gastos', 'Gastos', 'Categorías de gastos', true
FROM clinics c
LEFT JOIN category_types ct
  ON ct.clinic_id = c.id AND ct.code = 'expenses'
WHERE ct.id IS NULL
ON CONFLICT DO NOTHING;

-- 5) Sembrar categorías base de Gastos por clínica (compatibles con entity_type/display_name)
DO $$
BEGIN
  -- Intento 1: con entity_type y display_name
  BEGIN
    WITH expense_type AS (
      SELECT ct.id AS category_type_id, ct.clinic_id
      FROM category_types ct
      WHERE ct.code = 'expenses'
    )
    INSERT INTO categories (
      clinic_id, category_type_id, code, name, display_name, entity_type, description, display_order,
      is_active, is_system, metadata
    )
    SELECT et.clinic_id, et.category_type_id, v.code, v.name, v.name, 'expenses', v.descr, v.ord, true, false, '{}'::jsonb
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
    -- Intento 2: sin entity_type, con display_name
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
      SELECT et.clinic_id, et.category_type_id, v.code, v.name, v.name, v.descr, v.ord, true, false, '{}'::jsonb
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
      -- Intento 3: ni entity_type ni display_name
      WITH expense_type AS (
        SELECT ct.id AS category_type_id, ct.clinic_id
        FROM category_types ct
        WHERE ct.code = 'expenses'
      )
      INSERT INTO categories (
        clinic_id, category_type_id, code, name, description, display_order,
        is_active, is_system, metadata
      )
      SELECT et.clinic_id, et.category_type_id, v.code, v.name, v.descr, v.ord, true, false, '{}'::jsonb
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
  END;
END $$;

-- 6) Columna y FK en expenses + índice
ALTER TABLE IF EXISTS expenses ADD COLUMN IF NOT EXISTS category_id UUID NULL;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='fk_expenses_category'
  ) THEN
    ALTER TABLE expenses
      ADD CONSTRAINT fk_expenses_category FOREIGN KEY (category_id) REFERENCES categories(id);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Aviso: no se pudo crear FK (puede existir). Detalle: %', SQLERRM;
END $$;
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);

-- 7) Backfill a category_id
WITH expense_type AS (
  SELECT ct.clinic_id, ct.id AS category_type_id
  FROM category_types ct
  WHERE ct.code = 'expenses'
)
UPDATE expenses e
SET category_id = c.id
FROM expense_type et
JOIN categories c
  ON c.clinic_id = et.clinic_id
 AND c.category_type_id = et.category_type_id
WHERE e.clinic_id = et.clinic_id
  AND e.category_id IS NULL
  AND c.code = UPPER(COALESCE(e.category, ''));

WITH expense_type AS (
  SELECT ct.clinic_id, ct.id AS category_type_id
  FROM category_types ct
  WHERE ct.code = 'expenses'
)
UPDATE expenses e
SET category_id = c.id
FROM expense_type et
JOIN categories c
  ON c.clinic_id = et.clinic_id
 AND c.category_type_id = et.category_type_id
WHERE e.clinic_id = et.clinic_id
  AND e.category_id IS NULL
  AND c.name ILIKE COALESCE(e.category, '');

WITH expense_type AS (
  SELECT ct.clinic_id, ct.id AS category_type_id
  FROM category_types ct
  WHERE ct.code = 'expenses'
), otros AS (
  SELECT c.clinic_id, c.id
  FROM categories c
  JOIN expense_type et
    ON et.clinic_id = c.clinic_id
   AND et.category_type_id = c.category_type_id
  WHERE c.code = 'OTROS'
)
UPDATE expenses e
SET category_id = o.id
FROM otros o
WHERE e.clinic_id = o.clinic_id
  AND e.category_id IS NULL;

-- 8) Verificaciones rápidas (opcional, ejecuta manualmente si quieres)
-- select clinic_id, code, name from category_types where code='expenses';
-- select clinic_id, code, name from categories c
--  join category_types ct on ct.id = c.category_type_id
--  where ct.code='expenses'
--  order by clinic_id, display_order;
-- select count(*) as total, count(category_id) as mapeados from expenses;
