-- Multi-tenant migration: organizations and clinics
-- extensiones
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- nuevas tablas
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null,
  created_at timestamptz default now()
);

-- columnas clinic_id en existentes
alter table public.settings_time add column if not exists clinic_id uuid;
alter table public.fixed_costs add column if not exists clinic_id uuid;

-- Nota: Seed de demo eliminado. Las columnas mantienen valores NULL
-- hasta que la aplicación cree clínicas reales.

create index if not exists idx_settings_time_clinic on public.settings_time(clinic_id);
create index if not exists idx_fixed_costs_clinic on public.fixed_costs(clinic_id);

-- RLS OFF temporal
alter table public.organizations disable row level security;
alter table public.clinics disable row level security;
alter table public.settings_time disable row level security;
alter table public.fixed_costs disable row level security;
