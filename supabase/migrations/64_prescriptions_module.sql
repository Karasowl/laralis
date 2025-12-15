-- Migration: 64_prescriptions_module.sql
-- Description: Add prescriptions module with vademecum (medication catalog)
-- Date: 2025-12-12

-- =====================================================
-- MEDICATIONS CATALOG (Vademecum)
-- =====================================================
-- Global medication catalog that clinics can use
-- Clinics can also add their own custom medications

CREATE TABLE IF NOT EXISTS medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES clinics(id) ON DELETE CASCADE,
  -- clinic_id NULL = global medication (shared across all clinics)
  -- clinic_id SET = clinic-specific medication

  -- Basic info
  name varchar(255) NOT NULL,
  generic_name varchar(255),
  brand_name varchar(255),

  -- Classification
  category varchar(100), -- e.g., 'antibiotic', 'analgesic', 'anti-inflammatory'
  controlled_substance boolean DEFAULT false,
  requires_prescription boolean DEFAULT true,

  -- Dosage forms
  dosage_form varchar(100), -- e.g., 'tablet', 'capsule', 'suspension', 'injection'
  strength varchar(100), -- e.g., '500mg', '250mg/5ml'
  unit varchar(50), -- e.g., 'mg', 'ml', 'g'

  -- Default prescription values (can be overridden per prescription)
  default_dosage varchar(100), -- e.g., '1 tablet'
  default_frequency varchar(100), -- e.g., 'every 8 hours'
  default_duration varchar(100), -- e.g., '7 days'
  default_instructions text, -- e.g., 'Take with food'

  -- Dental-specific
  common_uses text[], -- e.g., ['tooth infection', 'post-extraction', 'pain relief']
  contraindications text,
  side_effects text,
  interactions text,

  -- Status
  is_active boolean DEFAULT true,

  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_medications_clinic ON medications(clinic_id);
CREATE INDEX IF NOT EXISTS idx_medications_name ON medications(name);
CREATE INDEX IF NOT EXISTS idx_medications_category ON medications(category);
CREATE INDEX IF NOT EXISTS idx_medications_active ON medications(is_active) WHERE is_active = true;

-- =====================================================
-- PRESCRIPTIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  treatment_id uuid REFERENCES treatments(id) ON DELETE SET NULL,
  -- treatment_id can be NULL for prescriptions not linked to a specific treatment

  -- Prescription metadata
  prescription_number varchar(50), -- Auto-generated sequential number
  prescription_date date NOT NULL DEFAULT CURRENT_DATE,

  -- Doctor info (denormalized for historical accuracy)
  prescriber_name varchar(255) NOT NULL,
  prescriber_license varchar(100), -- Professional license number
  prescriber_specialty varchar(100),

  -- Diagnosis/Reason
  diagnosis text,

  -- Status
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'dispensed')),

  -- Validity
  valid_until date, -- When the prescription expires

  -- Notes
  notes text,
  pharmacy_notes text, -- Instructions for the pharmacy

  -- PDF tracking
  pdf_generated_at timestamptz,
  pdf_url text, -- If stored externally

  -- Audit
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),

  -- Ensure prescription number is unique per clinic
  CONSTRAINT unique_prescription_number_per_clinic UNIQUE (clinic_id, prescription_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prescriptions_clinic ON prescriptions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_treatment ON prescriptions(treatment_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_date ON prescriptions(prescription_date DESC);
CREATE INDEX IF NOT EXISTS idx_prescriptions_status ON prescriptions(status);

-- =====================================================
-- PRESCRIPTION ITEMS (Individual medications in a prescription)
-- =====================================================

CREATE TABLE IF NOT EXISTS prescription_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  medication_id uuid REFERENCES medications(id) ON DELETE SET NULL,
  -- medication_id can be NULL for custom/one-off medications

  -- Medication details (stored for historical accuracy even if medication changes)
  medication_name varchar(255) NOT NULL,
  medication_strength varchar(100),
  medication_form varchar(100),

  -- Prescription details
  dosage varchar(100) NOT NULL, -- e.g., '1 tablet', '10ml'
  frequency varchar(100) NOT NULL, -- e.g., 'every 8 hours', 'twice daily'
  duration varchar(100), -- e.g., '7 days', '2 weeks'
  quantity varchar(100), -- e.g., '21 tablets', '1 bottle'

  -- Instructions
  instructions text, -- e.g., 'Take with food', 'Do not consume alcohol'

  -- Order in prescription
  sort_order int DEFAULT 0,

  -- Metadata
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription ON prescription_items(prescription_id);
CREATE INDEX IF NOT EXISTS idx_prescription_items_medication ON prescription_items(medication_id);

-- =====================================================
-- AUTO-GENERATE PRESCRIPTION NUMBER
-- =====================================================

CREATE OR REPLACE FUNCTION generate_prescription_number()
RETURNS TRIGGER AS $$
DECLARE
  next_number int;
  year_prefix varchar(4);
BEGIN
  -- Get current year for prefix
  year_prefix := to_char(CURRENT_DATE, 'YYYY');

  -- Get the next sequential number for this clinic this year
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(prescription_number FROM 6) AS int)
  ), 0) + 1
  INTO next_number
  FROM prescriptions
  WHERE clinic_id = NEW.clinic_id
    AND prescription_number LIKE year_prefix || '-%';

  -- Format: YYYY-XXXXX (e.g., 2025-00001)
  NEW.prescription_number := year_prefix || '-' || LPAD(next_number::text, 5, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_prescription_number
BEFORE INSERT ON prescriptions
FOR EACH ROW
WHEN (NEW.prescription_number IS NULL)
EXECUTE FUNCTION generate_prescription_number();

-- =====================================================
-- UPDATE TIMESTAMP TRIGGERS
-- =====================================================

CREATE TRIGGER update_medications_timestamp
BEFORE UPDATE ON medications
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prescriptions_timestamp
BEFORE UPDATE ON prescriptions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;

-- Medications policies
-- Users can see global medications (clinic_id IS NULL) OR their clinic's medications
CREATE POLICY "Users can view global and own clinic medications"
ON medications FOR SELECT
TO authenticated
USING (
  clinic_id IS NULL
  OR clinic_id IN (
    SELECT c.id FROM clinics c
    JOIN workspace_members wm ON c.workspace_id = wm.workspace_id
    WHERE wm.user_id = auth.uid()
      AND wm.is_active = true
      AND wm.invitation_status = 'accepted'
  )
);

CREATE POLICY "Users can manage own clinic medications"
ON medications FOR ALL
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

-- Prescriptions policies
CREATE POLICY "Users can view own clinic prescriptions"
ON prescriptions FOR SELECT
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

CREATE POLICY "Users can manage own clinic prescriptions"
ON prescriptions FOR ALL
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

-- Prescription items policies (inherit from prescription)
CREATE POLICY "Users can view prescription items"
ON prescription_items FOR SELECT
TO authenticated
USING (
  prescription_id IN (
    SELECT p.id FROM prescriptions p
    WHERE p.clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN workspace_members wm ON c.workspace_id = wm.workspace_id
      WHERE wm.user_id = auth.uid()
        AND wm.is_active = true
        AND wm.invitation_status = 'accepted'
    )
  )
);

CREATE POLICY "Users can manage prescription items"
ON prescription_items FOR ALL
TO authenticated
USING (
  prescription_id IN (
    SELECT p.id FROM prescriptions p
    WHERE p.clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN workspace_members wm ON c.workspace_id = wm.workspace_id
      WHERE wm.user_id = auth.uid()
        AND wm.is_active = true
        AND wm.invitation_status = 'accepted'
    )
  )
)
WITH CHECK (
  prescription_id IN (
    SELECT p.id FROM prescriptions p
    WHERE p.clinic_id IN (
      SELECT c.id FROM clinics c
      JOIN workspace_members wm ON c.workspace_id = wm.workspace_id
      WHERE wm.user_id = auth.uid()
        AND wm.is_active = true
        AND wm.invitation_status = 'accepted'
    )
  )
);

-- =====================================================
-- SEED DEFAULT DENTAL MEDICATIONS (Global catalog)
-- =====================================================

INSERT INTO medications (
  clinic_id, name, generic_name, category, dosage_form, strength, unit,
  default_dosage, default_frequency, default_duration, default_instructions,
  common_uses, controlled_substance
) VALUES
-- Antibiotics
(NULL, 'Amoxicilina', 'Amoxicillin', 'antibiotic', 'capsule', '500mg', 'mg',
 '1 cápsula', 'cada 8 horas', '7 días', 'Tomar con alimentos',
 ARRAY['infección dental', 'absceso', 'profilaxis'], false),

(NULL, 'Amoxicilina/Ácido Clavulánico', 'Amoxicillin/Clavulanic Acid', 'antibiotic', 'tablet', '875/125mg', 'mg',
 '1 tableta', 'cada 12 horas', '7 días', 'Tomar con alimentos',
 ARRAY['infección severa', 'absceso periapical'], false),

(NULL, 'Azitromicina', 'Azithromycin', 'antibiotic', 'tablet', '500mg', 'mg',
 '1 tableta', 'cada 24 horas', '3 días', 'Puede tomarse con o sin alimentos',
 ARRAY['infección dental', 'alergia a penicilina'], false),

(NULL, 'Clindamicina', 'Clindamycin', 'antibiotic', 'capsule', '300mg', 'mg',
 '1 cápsula', 'cada 8 horas', '7 días', 'Tomar con abundante agua',
 ARRAY['infección ósea', 'alergia a penicilina', 'periodontitis'], false),

(NULL, 'Metronidazol', 'Metronidazole', 'antibiotic', 'tablet', '500mg', 'mg',
 '1 tableta', 'cada 8 horas', '7 días', 'No consumir alcohol durante el tratamiento',
 ARRAY['infección anaeróbica', 'periodontitis', 'GUNA'], false),

-- Analgesics
(NULL, 'Paracetamol', 'Acetaminophen', 'analgesic', 'tablet', '500mg', 'mg',
 '1-2 tabletas', 'cada 6-8 horas', 'según dolor', 'No exceder 4g diarios',
 ARRAY['dolor leve', 'fiebre'], false),

(NULL, 'Ibuprofeno', 'Ibuprofen', 'analgesic', 'tablet', '400mg', 'mg',
 '1 tableta', 'cada 8 horas', '3-5 días', 'Tomar con alimentos',
 ARRAY['dolor moderado', 'inflamación', 'post-extracción'], false),

(NULL, 'Naproxeno', 'Naproxen', 'analgesic', 'tablet', '550mg', 'mg',
 '1 tableta', 'cada 12 horas', '3-5 días', 'Tomar con alimentos',
 ARRAY['dolor moderado', 'inflamación'], false),

(NULL, 'Ketorolaco', 'Ketorolac', 'analgesic', 'tablet', '10mg', 'mg',
 '1 tableta', 'cada 8 horas', '5 días máximo', 'Uso máximo 5 días. Tomar con alimentos',
 ARRAY['dolor severo', 'post-cirugía'], false),

-- Controlled substances (marked)
(NULL, 'Tramadol', 'Tramadol', 'analgesic', 'capsule', '50mg', 'mg',
 '1 cápsula', 'cada 8 horas', '3-5 días', 'Puede causar somnolencia. No conducir',
 ARRAY['dolor severo', 'post-cirugía'], true),

-- Anti-inflammatory
(NULL, 'Dexametasona', 'Dexamethasone', 'corticosteroid', 'tablet', '4mg', 'mg',
 '1 tableta', 'cada 24 horas', '3 días', 'Tomar por la mañana con alimentos',
 ARRAY['inflamación severa', 'edema post-quirúrgico'], false),

(NULL, 'Nimesulida', 'Nimesulide', 'anti-inflammatory', 'tablet', '100mg', 'mg',
 '1 tableta', 'cada 12 horas', '5 días', 'Tomar después de alimentos',
 ARRAY['dolor', 'inflamación'], false),

-- Antiseptics
(NULL, 'Clorhexidina', 'Chlorhexidine', 'antiseptic', 'solution', '0.12%', '%',
 '15ml', '2 veces al día', '7-14 días', 'Enjuagar por 30 segundos. No enjuagar con agua después',
 ARRAY['gingivitis', 'post-cirugía', 'pericoronitis'], false),

-- Antifungals
(NULL, 'Nistatina', 'Nystatin', 'antifungal', 'suspension', '100,000 UI/ml', 'UI/ml',
 '5ml', '4 veces al día', '14 días', 'Mantener en boca 2 minutos antes de tragar',
 ARRAY['candidiasis oral', 'estomatitis'], false),

(NULL, 'Fluconazol', 'Fluconazole', 'antifungal', 'capsule', '150mg', 'mg',
 '1 cápsula', 'dosis única', 'dosis única', 'Puede repetirse en 7 días si es necesario',
 ARRAY['candidiasis oral severa'], false)

ON CONFLICT DO NOTHING;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE medications IS 'Vademecum: catalog of medications. clinic_id NULL = global, SET = clinic-specific';
COMMENT ON TABLE prescriptions IS 'Medical prescriptions issued by the clinic';
COMMENT ON TABLE prescription_items IS 'Individual medications in a prescription';
COMMENT ON COLUMN medications.controlled_substance IS 'Requires special handling/documentation';
COMMENT ON COLUMN prescriptions.prescription_number IS 'Auto-generated: YYYY-XXXXX format';
