-- Migration 74: Guard against numeric overflow in service pricing fields
-- Date: 2026-02-17
-- Context: Some environments still keep stricter numeric/integer definitions.
-- This migration widens service-related numeric columns without changing semantics.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'margin_pct'
  ) THEN
    ALTER TABLE public.services
      ALTER COLUMN margin_pct TYPE NUMERIC;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'discount_value'
  ) THEN
    ALTER TABLE public.services
      ALTER COLUMN discount_value TYPE NUMERIC;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'final_price_with_discount_cents'
  ) THEN
    ALTER TABLE public.services
      ALTER COLUMN final_price_with_discount_cents TYPE BIGINT;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'treatments' AND column_name = 'margin_pct'
  ) THEN
    ALTER TABLE public.treatments
      ALTER COLUMN margin_pct TYPE NUMERIC;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tariffs' AND column_name = 'margin_pct'
  ) THEN
    ALTER TABLE public.tariffs
      ALTER COLUMN margin_pct TYPE NUMERIC;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tariffs' AND column_name = 'discount_value'
  ) THEN
    ALTER TABLE public.tariffs
      ALTER COLUMN discount_value TYPE NUMERIC;
  END IF;
END $$;
