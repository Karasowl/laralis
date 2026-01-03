-- Ensure workspace owners are also clinic_users admins.
-- Safe: inserts only when missing.

-- 1) Review current clinic membership for owners
select
  c.id as clinic_id,
  c.name as clinic_name,
  c.workspace_id,
  w.owner_id,
  au.email as owner_email,
  cu.id as clinic_user_id,
  cu.role as clinic_role,
  cu.is_active as clinic_active
from public.clinics c
join public.workspaces w on w.id = c.workspace_id
left join auth.users au on au.id = w.owner_id
left join public.clinic_users cu
  on cu.clinic_id = c.id
 and cu.user_id = w.owner_id
order by c.created_at desc;

-- 2) Insert missing clinic_users rows for owners
insert into public.clinic_users (clinic_id, user_id, role, is_active)
select c.id, w.owner_id, 'admin', true
from public.clinics c
join public.workspaces w on w.id = c.workspace_id
left join public.clinic_users cu
  on cu.clinic_id = c.id
 and cu.user_id = w.owner_id
where w.owner_id is not null
  and cu.id is null;

-- 3) Verify after insert
select
  c.id as clinic_id,
  c.name as clinic_name,
  c.workspace_id,
  w.owner_id,
  au.email as owner_email,
  cu.id as clinic_user_id,
  cu.role as clinic_role,
  cu.is_active as clinic_active
from public.clinics c
join public.workspaces w on w.id = c.workspace_id
left join auth.users au on au.id = w.owner_id
left join public.clinic_users cu
  on cu.clinic_id = c.id
 and cu.user_id = w.owner_id
order by c.created_at desc;
