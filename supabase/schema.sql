-- Habilitar extensiones útiles
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Settings de tiempo laboral (solo 1 registro por práctica)
create table if not exists public.settings_time (
  id uuid primary key default gen_random_uuid(),
  work_days int not null,
  hours_per_day int not null,
  real_pct numeric not null check (real_pct >= 0 and real_pct <= 1),
  updated_at timestamptz default now()
);

-- Costos fijos mensuales
create table if not exists public.fixed_costs (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  concept text not null,
  amount_cents int not null check (amount_cents >= 0),
  created_at timestamptz default now()
);

-- Placeholders para tablas futuras (solo id y timestamps)
create table if not exists public.supplies (
  id uuid primary key default gen_random_uuid(), 
  created_at timestamptz default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(), 
  created_at timestamptz default now()
);

create table if not exists public.service_supplies (
  id uuid primary key default gen_random_uuid(), 
  created_at timestamptz default now()
);

create table if not exists public.tariffs (
  id uuid primary key default gen_random_uuid(), 
  created_at timestamptz default now()
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(), 
  created_at timestamptz default now()
);

create table if not exists public.treatments (
  id uuid primary key default gen_random_uuid(), 
  created_at timestamptz default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(), 
  created_at timestamptz default now()
);

-- RLS OFF temporal (solo DEV). Activaremos RLS en otro PR con auth
alter table public.settings_time disable row level security;
alter table public.fixed_costs disable row level security;
alter table public.supplies disable row level security;
alter table public.services disable row level security;
alter table public.service_supplies disable row level security;
alter table public.tariffs disable row level security;
alter table public.patients disable row level security;
alter table public.treatments disable row level security;
alter table public.expenses disable row level security;