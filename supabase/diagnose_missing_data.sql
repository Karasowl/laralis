-- Diagnostics for missing clinic data after RLS changes.
-- Safe: read-only queries.

-- 1) Totals
select count(*) as treatments_total from public.treatments;
select count(*) as patients_total from public.patients;

-- 2) Counts by clinic
select clinic_id, count(*) as treatments_count
from public.treatments
group by clinic_id
order by treatments_count desc;

select clinic_id, count(*) as patients_count
from public.patients
group by clinic_id
order by patients_count desc;

-- 3) Clinics list
select id as clinic_id, name
from public.clinics
order by created_at desc;

-- 4) Memberships (replace email if you want to filter)
select id, email
from auth.users
order by created_at desc
limit 20;

select *
from public.clinic_users
where user_id in (
  select id from auth.users where email ilike '%YOUR_EMAIL%'
);

select *
from public.workspace_users
where user_id in (
  select id from auth.users where email ilike '%YOUR_EMAIL%'
);

-- 5) Allowed clinics check
select user_id, allowed_clinics
from public.workspace_users
where user_id in (
  select id from auth.users where email ilike '%YOUR_EMAIL%'
);

-- 6) Helper functions presence
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname in ('is_clinic_member','user_has_clinic_access','is_clinic_admin');
