-- Ensure workspace owners have access after RLS changes.
-- Safe: inserts only when missing, no deletes.

-- 1) Review current owners and whether they are workspace_users
select
  w.id as workspace_id,
  w.name as workspace_name,
  w.owner_id,
  au.email as owner_email,
  wu.id as workspace_user_id,
  wu.role as workspace_role,
  wu.is_active as workspace_active,
  wu.allowed_clinics
from public.workspaces w
left join auth.users au on au.id = w.owner_id
left join public.workspace_users wu
  on wu.workspace_id = w.id
 and wu.user_id = w.owner_id
order by w.created_at desc;

-- 2) Insert missing workspace_users rows for owners
insert into public.workspace_users (workspace_id, user_id, role, is_active)
select w.id, w.owner_id, 'owner', true
from public.workspaces w
left join public.workspace_users wu
  on wu.workspace_id = w.id
 and wu.user_id = w.owner_id
where w.owner_id is not null
  and wu.id is null;

-- 3) Optional: insert clinic_users rows for owners (admin)
-- Uncomment if you also want explicit clinic membership.
-- insert into public.clinic_users (clinic_id, user_id, role, is_active)
-- select c.id, w.owner_id, 'admin', true
-- from public.clinics c
-- join public.workspaces w on w.id = c.workspace_id
-- left join public.clinic_users cu
--   on cu.clinic_id = c.id
--  and cu.user_id = w.owner_id
-- where w.owner_id is not null
--   and cu.id is null;

-- 4) Optional: clear allowed_clinics for owners to grant all clinics
-- Uncomment only if an owner has allowed_clinics set and is blocked.
-- update public.workspace_users wu
-- set allowed_clinics = '{}'::uuid[]
-- from public.workspaces w
-- where wu.workspace_id = w.id
--   and wu.user_id = w.owner_id
--   and wu.role = 'owner';

-- 5) Verify access rows after insert
select
  w.id as workspace_id,
  w.name as workspace_name,
  w.owner_id,
  au.email as owner_email,
  wu.id as workspace_user_id,
  wu.role as workspace_role,
  wu.is_active as workspace_active,
  wu.allowed_clinics
from public.workspaces w
left join auth.users au on au.id = w.owner_id
left join public.workspace_users wu
  on wu.workspace_id = w.id
 and wu.user_id = w.owner_id
order by w.created_at desc;
