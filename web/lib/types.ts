// Database types
export interface Organization {
  id: string;
  name: string;
  created_at?: string;
}

export interface DiscountConfig {
  enabled: boolean;
  type: 'percentage' | 'fixed';
  value: number;
}

export interface Clinic {
  id: string;
  org_id: string;
  name: string;
  global_discount_config?: DiscountConfig;
  price_rounding?: number; // Automatic price rounding (in pesos). Default: 10
  currency?: string; // ISO 4217 currency code (e.g., MXN, USD, COP). Default: MXN
  locale?: string; // Locale for number/date formatting (e.g., es-MX, en-US). Default: es-MX
  created_at?: string;
}

export interface SettingsTime {
  id?: string;
  clinic_id: string;
  work_days: number;
  hours_per_day: number;
  real_pct: number;
  monthly_goal_cents?: number | null;
  updated_at?: string;
}

export interface FixedCost {
  id: string;
  clinic_id: string;
  category: string;
  concept: string;
  amount_cents: number;
  created_at?: string;
}

export interface Supply {
  id: string;
  clinic_id: string;
  name: string;
  category: string; // 'insumo' | 'bioseguridad' | 'consumibles' | 'materiales' | 'medicamentos' | 'equipos' | 'otros'
  presentation: string;
  price_cents: number;
  portions: number;
  cost_per_portion_cents?: number;
  cost_per_unit_cents?: number;
  // Inventory fields
  stock_quantity?: number;
  min_stock_alert?: number;
  last_purchase_price_cents?: number;
  last_purchase_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Service {
  id: string;
  clinic_id: string;
  name: string;
  est_minutes: number;
  price_cents?: number;
  margin_pct?: number;
  category?: string;
  description?: string | null;
  // Discount fields (migrated from tariffs)
  discount_type?: 'none' | 'percentage' | 'fixed';
  discount_value?: number;
  discount_reason?: string | null;
  final_price_with_discount_cents?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ServiceSupply {
  id: string;
  clinic_id: string;
  service_id: string;
  supply_id: string;
  qty: number;
  created_at?: string;
  supply?: Supply; // For joins
}

export interface ServiceWithCost extends Service {
  variable_cost_cents?: number;
  fixed_cost_cents?: number;
  total_cost_cents?: number;
}

export interface Tariff {
  id: string;
  clinic_id: string;
  service_id: string;
  version: number;
  valid_from: string;
  valid_until?: string | null;
  fixed_cost_per_minute_cents: number;
  variable_cost_cents: number;
  margin_pct: number;
  price_cents: number;
  rounded_price_cents: number;
  discount_type?: 'none' | 'percentage' | 'fixed';
  discount_value?: number;
  discount_reason?: string | null;
  final_price_with_discount_cents?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Asset {
  id: string;
  clinic_id: string;
  name: string;
  purchase_price_cents: number;
  depreciation_months: number;
  purchase_date?: string;
  created_at?: string;
  updated_at?: string;
}

// API response types
export interface ApiResponse<T> {
  data?: T | null;
  error?: string;
  message?: string;
}

// Fixed cost categories (matching seed data and UI)
export type FixedCostCategory =
    | 'rent'
    | 'utilities'
    | 'salaries'
    | 'equipment'
    | 'insurance'
    | 'maintenance'
    | 'education'
    | 'advertising'
    | 'other';

export type FixedCostFrequency =
    | 'monthly'
    | 'weekly'
    | 'biweekly'
    | 'quarterly'
    | 'yearly';

// Supply categories - now flexible to support dynamic categories from database
// Previously was a fixed union type, but changed to string to support custom categories
export type SupplyCategory = string;

// Patient interface
export interface Patient {
  id: string;
  clinic_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  birth_date?: string;
  first_visit_date?: string;
  gender?: 'male' | 'female' | 'other';
  address?: string;
  city?: string;
  postal_code?: string;
  notes?: string;
  source_id?: string;
  referred_by_patient_id?: string;
  campaign_id?: string;
  platform_id?: string;
  created_at: string;
  updated_at?: string;
  // Relations (populated via joins)
  source?: PatientSource;
  campaign?: { id: string; name: string };
  platform?: { id: string; name: string; display_name?: string };
  referred_by?: { id: string; first_name: string; last_name: string };
}

// Patient source interface
export interface PatientSource {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  is_active: boolean;
  is_system: boolean;
}

// Medication (Vademecum) interface
export interface Medication {
  id: string;
  clinic_id?: string | null; // null = global medication
  name: string;
  generic_name?: string;
  brand_name?: string;
  category?: string;
  controlled_substance: boolean;
  requires_prescription: boolean;
  dosage_form?: string;
  strength?: string;
  unit?: string;
  default_dosage?: string;
  default_frequency?: string;
  default_duration?: string;
  default_instructions?: string;
  common_uses?: string[];
  contraindications?: string;
  side_effects?: string;
  interactions?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Prescription status
export type PrescriptionStatus = 'active' | 'cancelled' | 'expired' | 'dispensed';

// Prescription interface
export interface Prescription {
  id: string;
  clinic_id: string;
  patient_id: string;
  treatment_id?: string | null;
  prescription_number: string;
  prescription_date: string;
  prescriber_name: string;
  prescriber_license?: string;
  prescriber_specialty?: string;
  diagnosis?: string;
  status: PrescriptionStatus;
  valid_until?: string;
  notes?: string;
  pharmacy_notes?: string;
  pdf_generated_at?: string;
  pdf_url?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  // Relations (populated via joins)
  patient?: Patient;
  treatment?: Treatment;
  items?: PrescriptionItem[];
}

// Prescription item interface
export interface PrescriptionItem {
  id: string;
  prescription_id: string;
  medication_id?: string | null;
  medication_name: string;
  medication_strength?: string;
  medication_form?: string;
  dosage: string;
  frequency: string;
  duration?: string;
  quantity?: string;
  instructions?: string;
  sort_order: number;
  created_at?: string;
  // Relations
  medication?: Medication;
}

// Treatment interface (referenced by Prescription)
export interface Treatment {
  id: string;
  clinic_id: string;
  patient_id: string;
  service_id: string;
  treatment_date: string;
  treatment_time?: string;
  status: 'scheduled' | 'pending' | 'in_progress' | 'completed' | 'cancelled';
  tooth_number?: string;
  minutes?: number;
  notes?: string;
  price_cents: number;
  amount_paid_cents: number;
  is_paid: boolean;
  payment_method?: string;
  payment_date?: string;
  created_at?: string;
  updated_at?: string;
  // Relations
  patient?: Patient;
  service?: Service;
}

// NOTE: Quote types removed in migration 71 - quotes module deprecated
// Partial payments now handled directly in treatments via amount_paid_cents
