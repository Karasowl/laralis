// Database types
export interface SettingsTime {
  id?: string;
  work_days: number;
  hours_per_day: number;
  real_pct: number;
  updated_at?: string;
}

export interface FixedCost {
  id?: string;
  category: string;
  concept: string;
  amount_cents: number;
  created_at?: string;
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
  | 'other';