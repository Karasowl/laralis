-- Migration: Assets (equipment) and monthly depreciation aggregation

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id),
  name text not null,
  purchase_price_cents integer not null check (purchase_price_cents >= 0),
  depreciation_months integer not null check (depreciation_months > 0),
  purchase_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_assets_clinic on public.assets(clinic_id);

-- trigger to update updated_at
create or replace function update_assets_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language 'plpgsql';

create trigger trg_assets_updated_at
before update on public.assets
for each row execute function update_assets_updated_at();

-- RLS OFF temporal (se activará más adelante con auth)
alter table public.assets disable row level security;



