-- Migration: 65_quotes_module.sql
-- Description: Add quotes/estimates module for treatment planning
-- Date: 2025-12-12

-- =====================================================
-- QUOTES TABLE (Presupuestos)
-- =====================================================

CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  -- Quote identification
  quote_number varchar(50), -- Auto-generated: YYYY-XXXXX format
  quote_date date NOT NULL DEFAULT CURRENT_DATE,

  -- Validity
  validity_days int DEFAULT 30,
  valid_until date, -- Calculated: quote_date + validity_days

  -- Status workflow
  status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',      -- Being prepared
    'sent',       -- Sent to patient
    'accepted',   -- Patient accepted
    'rejected',   -- Patient rejected
    'expired',    -- Past valid_until date
    'converted'   -- Converted to treatments
  )),

  -- Financial summary (in cents)
  subtotal_cents bigint NOT NULL DEFAULT 0,
  discount_type varchar(20) CHECK (discount_type IN ('none', 'percentage', 'fixed')),
  discount_value numeric(10,2) DEFAULT 0,
  discount_cents bigint DEFAULT 0, -- Calculated discount amount
  tax_rate numeric(5,2) DEFAULT 0, -- Tax percentage (e.g., 16 for IVA)
  tax_cents bigint DEFAULT 0,
  total_cents bigint NOT NULL DEFAULT 0,

  -- Notes
  notes text, -- Internal notes
  patient_notes text, -- Notes visible to patient on PDF
  terms_conditions text, -- Terms and conditions text

  -- PDF tracking
  pdf_generated_at timestamptz,
  sent_at timestamptz,
  sent_via varchar(20), -- 'email', 'whatsapp', 'print'

  -- Response tracking
  responded_at timestamptz,
  response_notes text,

  -- Audit
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),

  -- Unique constraint per clinic
  CONSTRAINT unique_quote_number_per_clinic UNIQUE (clinic_id, quote_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quotes_clinic ON quotes(clinic_id);
CREATE INDEX IF NOT EXISTS idx_quotes_patient ON quotes(patient_id);
CREATE INDEX IF NOT EXISTS idx_quotes_date ON quotes(quote_date DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
CREATE INDEX IF NOT EXISTS idx_quotes_valid_until ON quotes(valid_until);

-- =====================================================
-- QUOTE ITEMS TABLE (Line items for quotes)
-- =====================================================

CREATE TABLE IF NOT EXISTS quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,

  -- Service details (snapshot for historical accuracy)
  service_name varchar(255) NOT NULL,
  service_description text,

  -- Pricing (snapshot in cents)
  quantity int NOT NULL DEFAULT 1,
  unit_price_cents bigint NOT NULL,

  -- Item-level discount
  discount_type varchar(20) DEFAULT 'none' CHECK (discount_type IN ('none', 'percentage', 'fixed')),
  discount_value numeric(10,2) DEFAULT 0,
  discount_cents bigint DEFAULT 0,

  -- Calculated totals
  subtotal_cents bigint NOT NULL, -- quantity × unit_price_cents
  total_cents bigint NOT NULL, -- subtotal - discount

  -- Additional info
  tooth_number varchar(10), -- If service is for specific tooth
  notes text,
  sort_order int DEFAULT 0,

  -- Metadata
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_service ON quote_items(service_id);

-- =====================================================
-- AUTO-GENERATE QUOTE NUMBER
-- =====================================================

CREATE OR REPLACE FUNCTION generate_quote_number()
RETURNS TRIGGER AS $$
DECLARE
  next_number int;
  year_prefix varchar(4);
BEGIN
  -- Get current year for prefix
  year_prefix := to_char(CURRENT_DATE, 'YYYY');

  -- Get the next sequential number for this clinic this year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(quote_number FROM 6) AS int)
  ), 0) + 1
  INTO next_number
  FROM quotes
  WHERE clinic_id = NEW.clinic_id
    AND quote_number LIKE year_prefix || '-%';

  -- Format: YYYY-XXXXX (e.g., 2025-00001)
  NEW.quote_number := year_prefix || '-' || LPAD(next_number::text, 5, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_quote_number
BEFORE INSERT ON quotes
FOR EACH ROW
WHEN (NEW.quote_number IS NULL)
EXECUTE FUNCTION generate_quote_number();

-- =====================================================
-- AUTO-CALCULATE VALID_UNTIL
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_quote_valid_until()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate valid_until from quote_date + validity_days
  IF NEW.validity_days IS NOT NULL AND NEW.quote_date IS NOT NULL THEN
    NEW.valid_until := NEW.quote_date + (NEW.validity_days || ' days')::interval;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_quote_valid_until
BEFORE INSERT OR UPDATE ON quotes
FOR EACH ROW
EXECUTE FUNCTION calculate_quote_valid_until();

-- =====================================================
-- AUTO-CALCULATE QUOTE ITEM TOTALS
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_quote_item_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate subtotal
  NEW.subtotal_cents := NEW.quantity * NEW.unit_price_cents;

  -- Calculate discount
  IF NEW.discount_type = 'percentage' THEN
    NEW.discount_cents := ROUND(NEW.subtotal_cents * NEW.discount_value / 100);
  ELSIF NEW.discount_type = 'fixed' THEN
    NEW.discount_cents := ROUND(NEW.discount_value * 100); -- Convert to cents
  ELSE
    NEW.discount_cents := 0;
  END IF;

  -- Calculate total
  NEW.total_cents := NEW.subtotal_cents - COALESCE(NEW.discount_cents, 0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_quote_item_totals
BEFORE INSERT OR UPDATE ON quote_items
FOR EACH ROW
EXECUTE FUNCTION calculate_quote_item_totals();

-- =====================================================
-- AUTO-CALCULATE QUOTE TOTALS
-- =====================================================

CREATE OR REPLACE FUNCTION update_quote_totals()
RETURNS TRIGGER AS $$
DECLARE
  items_subtotal bigint;
  quote_record RECORD;
  global_discount bigint;
  tax_amount bigint;
BEGIN
  -- Get the quote_id (handle both INSERT/UPDATE and DELETE)
  IF TG_OP = 'DELETE' THEN
    -- Get subtotal of remaining items
    SELECT COALESCE(SUM(total_cents), 0) INTO items_subtotal
    FROM quote_items
    WHERE quote_id = OLD.quote_id;

    -- Get quote record
    SELECT * INTO quote_record FROM quotes WHERE id = OLD.quote_id;
  ELSE
    -- Get subtotal including current item
    SELECT COALESCE(SUM(total_cents), 0) INTO items_subtotal
    FROM quote_items
    WHERE quote_id = NEW.quote_id;

    -- Get quote record
    SELECT * INTO quote_record FROM quotes WHERE id = NEW.quote_id;
  END IF;

  -- Calculate global discount
  IF quote_record.discount_type = 'percentage' THEN
    global_discount := ROUND(items_subtotal * COALESCE(quote_record.discount_value, 0) / 100);
  ELSIF quote_record.discount_type = 'fixed' THEN
    global_discount := ROUND(COALESCE(quote_record.discount_value, 0) * 100);
  ELSE
    global_discount := 0;
  END IF;

  -- Calculate tax (on subtotal minus discount)
  tax_amount := ROUND((items_subtotal - global_discount) * COALESCE(quote_record.tax_rate, 0) / 100);

  -- Update quote totals
  UPDATE quotes SET
    subtotal_cents = items_subtotal,
    discount_cents = global_discount,
    tax_cents = tax_amount,
    total_cents = items_subtotal - global_discount + tax_amount,
    updated_at = now()
  WHERE id = COALESCE(NEW.quote_id, OLD.quote_id);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_quote_totals
AFTER INSERT OR UPDATE OR DELETE ON quote_items
FOR EACH ROW
EXECUTE FUNCTION update_quote_totals();

-- =====================================================
-- UPDATE TIMESTAMP TRIGGER
-- =====================================================

CREATE TRIGGER update_quotes_timestamp
BEFORE UPDATE ON quotes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

-- Quotes policies
CREATE POLICY "Users can view own clinic quotes"
ON quotes FOR SELECT
TO authenticated
USING (
  clinic_id IN (
    SELECT c.id FROM clinics c
    JOIN workspace_members wm ON c.workspace_id = wm.workspace_id
    WHERE wm.user_id = auth.uid()
      AND wm.is_active = true
      AND wm.invitation_status = 'accepted'
  )
);

CREATE POLICY "Users can manage own clinic quotes"
ON quotes FOR ALL
TO authenticated
USING (
  clinic_id IN (
    SELECT c.id FROM clinics c
    JOIN workspace_members wm ON c.workspace_id = wm.workspace_id
    WHERE wm.user_id = auth.uid()
      AND wm.is_active = true
      AND wm.invitation_status = 'accepted'
  )
)
WITH CHECK (
  clinic_id IN (
    SELECT c.id FROM clinics c
    JOIN workspace_members wm ON c.workspace_id = wm.workspace_id
    WHERE wm.user_id = auth.uid()
      AND wm.is_active = true
      AND wm.invitation_status = 'accepted'
  )
);

-- Quote items policies (inherit from quote)
CREATE POLICY "Users can view quote items"
ON quote_items FOR SELECT
TO authenticated
USING (
  quote_id IN (
    SELECT q.id FROM quotes q
    WHERE q.clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN workspace_members wm ON c.workspace_id = wm.workspace_id
      WHERE wm.user_id = auth.uid()
        AND wm.is_active = true
        AND wm.invitation_status = 'accepted'
    )
  )
);

CREATE POLICY "Users can manage quote items"
ON quote_items FOR ALL
TO authenticated
USING (
  quote_id IN (
    SELECT q.id FROM quotes q
    WHERE q.clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN workspace_members wm ON c.workspace_id = wm.workspace_id
      WHERE wm.user_id = auth.uid()
        AND wm.is_active = true
        AND wm.invitation_status = 'accepted'
    )
  )
)
WITH CHECK (
  quote_id IN (
    SELECT q.id FROM quotes q
    WHERE q.clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN workspace_members wm ON c.workspace_id = wm.workspace_id
      WHERE wm.user_id = auth.uid()
        AND wm.is_active = true
        AND wm.invitation_status = 'accepted'
    )
  )
);

-- =====================================================
-- FUNCTION TO CONVERT QUOTE TO TREATMENTS
-- =====================================================

CREATE OR REPLACE FUNCTION convert_quote_to_treatments(
  p_quote_id uuid,
  p_treatment_date date DEFAULT CURRENT_DATE
)
RETURNS SETOF uuid AS $$
DECLARE
  v_quote RECORD;
  v_item RECORD;
  v_treatment_id uuid;
BEGIN
  -- Get quote
  SELECT * INTO v_quote FROM quotes WHERE id = p_quote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  IF v_quote.status NOT IN ('sent', 'accepted') THEN
    RAISE EXCEPTION 'Quote must be sent or accepted to convert';
  END IF;

  -- Create treatment for each item
  FOR v_item IN
    SELECT * FROM quote_items WHERE quote_id = p_quote_id ORDER BY sort_order
  LOOP
    INSERT INTO treatments (
      clinic_id,
      patient_id,
      service_id,
      treatment_date,
      price_cents,
      tooth_number,
      notes,
      status
    ) VALUES (
      v_quote.clinic_id,
      v_quote.patient_id,
      v_item.service_id,
      p_treatment_date,
      v_item.total_cents,
      v_item.tooth_number,
      v_item.notes,
      'scheduled'
    )
    RETURNING id INTO v_treatment_id;

    RETURN NEXT v_treatment_id;
  END LOOP;

  -- Update quote status
  UPDATE quotes SET status = 'converted', updated_at = now()
  WHERE id = p_quote_id;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE quotes IS 'Treatment quotes/estimates for patients';
COMMENT ON TABLE quote_items IS 'Individual service line items in a quote';
COMMENT ON COLUMN quotes.quote_number IS 'Auto-generated: YYYY-XXXXX format';
COMMENT ON COLUMN quotes.subtotal_cents IS 'Sum of all item totals before global discount';
COMMENT ON COLUMN quotes.total_cents IS 'Final total after global discount and tax';
COMMENT ON COLUMN quote_items.unit_price_cents IS 'Snapshot of service price at quote time';
COMMENT ON FUNCTION convert_quote_to_treatments IS 'Converts accepted quote into scheduled treatments';
