-- Migration: Supplies, Services and Service-Supply relationships

-- Supplies table
create table if not exists public.supplies (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  name text not null,
  category text,
  presentation text,
  price_cents integer not null check (price_cents >= 0),
  portions integer not null check (portions > 0),
  created_at timestamptz default now()
);

-- Services table
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  name text not null,
  est_minutes integer not null check (est_minutes > 0),
  created_at timestamptz default now()
);

-- Service-Supply junction table (recipe ingredients)
create table if not exists public.service_supplies (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  service_id uuid not null references public.services(id) on delete cascade,
  supply_id uuid not null references public.supplies(id),
  qty numeric not null check (qty >= 0),
  created_at timestamptz default now(),
  unique(service_id, supply_id)
);

-- Indexes for performance
create index if not exists idx_supplies_clinic on public.supplies(clinic_id);
create index if not exists idx_services_clinic on public.services(clinic_id);
create index if not exists idx_service_supplies_clinic on public.service_supplies(clinic_id);
create index if not exists idx_service_supplies_service on public.service_supplies(service_id);

-- RLS remains disabled for now
alter table public.supplies disable row level security;
alter table public.services disable row level security;
alter table public.service_supplies disable row level security;