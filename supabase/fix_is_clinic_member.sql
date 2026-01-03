-- Fix missing helper functions required by RLS policies.
-- Safe: no table drops or data changes.

create or replace function public.is_clinic_member(clinic_id uuid)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  p_clinic_id uuid := clinic_id;
begin
  if exists (
    select 1
    from public.clinic_users cu
    where cu.clinic_id = p_clinic_id
      and cu.user_id = auth.uid()
      and cu.is_active = true
  ) then
    return true;
  end if;

  -- Legacy fallback if clinic_memberships exists.
  if to_regclass('public.clinic_memberships') is not null then
    if exists (
      select 1
      from public.clinic_memberships cm
      where cm.clinic_id = p_clinic_id
        and cm.user_id = auth.uid()
        and cm.is_active = true
    ) then
      return true;
    end if;
  end if;

  if exists (
    select 1
    from public.clinics c
    join public.workspace_users wu on wu.workspace_id = c.workspace_id
    where c.id = p_clinic_id
      and wu.user_id = auth.uid()
      and wu.is_active = true
      and (
        wu.allowed_clinics = '{}'::uuid[]
        or wu.allowed_clinics is null
        or p_clinic_id = any(wu.allowed_clinics)
      )
  ) then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.is_clinic_admin(clinic_id uuid)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  p_clinic_id uuid := clinic_id;
begin
  if exists (
    select 1
    from public.clinic_users cu
    where cu.clinic_id = p_clinic_id
      and cu.user_id = auth.uid()
      and cu.role = 'admin'
      and cu.is_active = true
  ) then
    return true;
  end if;

  if exists (
    select 1
    from public.clinics c
    join public.workspace_users wu on wu.workspace_id = c.workspace_id
    where c.id = p_clinic_id
      and wu.user_id = auth.uid()
      and wu.role in ('owner', 'super_admin', 'admin')
      and wu.is_active = true
  ) then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.user_has_clinic_access(clinic_id uuid)
returns boolean
language plpgsql
security definer
stable
as $$
declare
  p_clinic_id uuid := clinic_id;
begin
  return public.is_clinic_member(p_clinic_id);
end;
$$;

grant execute on function public.is_clinic_member(uuid) to authenticated;
grant execute on function public.is_clinic_admin(uuid) to authenticated;
grant execute on function public.user_has_clinic_access(uuid) to authenticated;
