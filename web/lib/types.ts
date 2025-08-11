// Database types
export interface Organization {
  id: string;
  name: string;
  created_at?: string;
}

export interface Clinic {
  id: string;
  org_id: string;
  name: string;
  created_at?: string;
}

export interface SettingsTime {
  id?: string;
  clinic_id: string;
  work_days: number;
  hours_per_day: number;
  real_pct: number;
  updated_at?: string;
}

export interface FixedCost {
  id?: string;
  clinic_id: string;
  category: string;
  concept: string;
  amount_cents: number;
  created_at?: string;
}

export interface Supply {
  id?: string;
  clinic_id: string;
  name: string;
  category: string; // 'insumo' | 'bioseguridad' | 'consumibles' | 'materiales' | 'medicamentos' | 'equipos' | 'otros'
  presentation: string;
  price_cents: number;
  portions: number;
  cost_per_portion_cents: number;
  created_at?: string;
  updated_at?: string;
}

export interface Service {
  id?: string;
  clinic_id: string;
  name: string;
  est_minutes: number;
  created_at?: string;
}

export interface ServiceSupply {
  id?: string;
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

export interface Asset {
  id?: string;
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

// Supply categories
export type SupplyCategory = 
  | 'insumo'
  | 'bioseguridad'
  | 'consumibles'
  | 'materiales'
  | 'medicamentos'
  | 'equipos'
  | 'otros';