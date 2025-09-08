-- Fix de compatibilidad: normaliza el esquema de categorías existente
-- Úsalo si el script 31-categories-system.sql falla por columnas faltantes

-- 1) Agregar columna clinic_id si no existe
DO $$ BEGIN
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
    WHERE table_schema='public' AND table_name='category_types' AND column_name='description'
  ) THEN
    ALTER TABLE category_types ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='category_types' AND column_name='icon'
  ) THEN
    ALTER TABLE category_types ADD COLUMN icon VARCHAR(50);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='category_types' AND column_name='color'
  ) THEN
    ALTER TABLE category_types ADD COLUMN color VARCHAR(7);
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
END $$;

-- Backfill: si existe display_name y está NULL, copiar desde name
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='category_types' AND column_name='display_name'
  ) THEN
    UPDATE category_types SET display_name = name WHERE display_name IS NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='categories' AND column_name='clinic_id'
  ) THEN
    ALTER TABLE categories ADD COLUMN clinic_id UUID;
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

-- 2b) Normalizar constraints únicas que bloquean multi-tenant
DO $$ BEGIN
  -- category_types: eliminar UNIQUE(name) o UNIQUE(code) globales si existen
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'category_types_name_key'
      AND conrelid = 'public.category_types'::regclass
  ) THEN
    ALTER TABLE category_types DROP CONSTRAINT category_types_name_key;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'category_types_code_key'
      AND conrelid = 'public.category_types'::regclass
  ) THEN
    ALTER TABLE category_types DROP CONSTRAINT category_types_code_key;
  END IF;
  -- categories: eliminar UNIQUE(name) o UNIQUE(code) globales si existen
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'categories_name_key'
      AND conrelid = 'public.categories'::regclass
  ) THEN
    ALTER TABLE categories DROP CONSTRAINT categories_name_key;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'categories_code_key'
      AND conrelid = 'public.categories'::regclass
  ) THEN
    ALTER TABLE categories DROP CONSTRAINT categories_code_key;
  END IF;
END $$;

-- 2c) Asegurar unicidad correcta por clínica
CREATE UNIQUE INDEX IF NOT EXISTS ux_category_types_clinic_code
  ON category_types(clinic_id, code);

CREATE UNIQUE INDEX IF NOT EXISTS ux_categories_clinic_type_code
  ON categories(clinic_id, category_type_id, code);

-- 2) Agregar columna category_type_id en categories si faltara (compatibilidad)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='categories' AND column_name='category_type_id'
  ) THEN
    ALTER TABLE categories ADD COLUMN category_type_id UUID;
  END IF;
END $$;

-- 3) Crear índices solo si existe la columna
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='category_types' AND column_name='clinic_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_category_types_clinic ON category_types(clinic_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='categories' AND column_name='clinic_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_categories_clinic ON categories(clinic_id);
  END IF;
END $$;

-- 4) Triggers de updated_at si faltan
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_category_types_updated_at'
  ) THEN
    CREATE TRIGGER update_category_types_updated_at BEFORE UPDATE ON category_types
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_categories_updated_at'
  ) THEN
    CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
