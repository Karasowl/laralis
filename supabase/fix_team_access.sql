-- Fix team access for a specific user + clinic.
-- Update the values below before running.

do $$
declare
  v_user_email text := 'conladoctoralara@gmail.com';
  v_clinic_id uuid := '8e540d51-57b2-4e16-88c5-be613979e533';

  v_user_id uuid;
  v_workspace_id uuid;
  v_workspace_owner_id uuid;
  v_target_role text;
  v_current_role text;
  v_allowed_clinics uuid[];
  v_custom_role_id uuid;
  v_template_scope text;
  v_template_active boolean;
begin
  select id into v_user_id
  from auth.users
  where email = v_user_email;

  if v_user_id is null then
    raise exception 'No user found for email %', v_user_email;
  end if;

  select workspace_id into v_workspace_id
  from public.clinics
  where id = v_clinic_id;

  if v_workspace_id is null then
    raise exception 'No clinic found for id %', v_clinic_id;
  end if;

  select owner_id into v_workspace_owner_id
  from public.workspaces
  where id = v_workspace_id;

  if v_workspace_owner_id = v_user_id then
    v_target_role := 'owner';
  else
    v_target_role := 'admin';
  end if;

  select role, allowed_clinics, custom_role_id
  into v_current_role, v_allowed_clinics, v_custom_role_id
  from public.workspace_users
  where workspace_id = v_workspace_id
    and user_id = v_user_id;

  if v_current_role is null then
    insert into public.workspace_users (
      workspace_id,
      user_id,
      role,
      allowed_clinics,
      is_active,
      joined_at
    ) values (
      v_workspace_id,
      v_user_id,
      v_target_role,
      '{}'::uuid[],
      true,
      now()
    );
  else
    if v_target_role = 'owner' and v_current_role <> 'owner' then
      update public.workspace_users
      set role = 'owner',
          is_active = true
      where workspace_id = v_workspace_id
        and user_id = v_user_id;
    elsif v_target_role = 'admin'
      and v_current_role not in ('owner', 'super_admin', 'admin') then
      update public.workspace_users
      set role = 'admin',
          is_active = true
      where workspace_id = v_workspace_id
        and user_id = v_user_id;
    else
      update public.workspace_users
      set is_active = true
      where workspace_id = v_workspace_id
        and user_id = v_user_id;
    end if;
  end if;

  -- Ensure current clinic is included if access is restricted.
  if v_allowed_clinics is not null
    and array_length(v_allowed_clinics, 1) > 0
    and not (v_clinic_id = any(v_allowed_clinics)) then
    update public.workspace_users
    set allowed_clinics = array_append(v_allowed_clinics, v_clinic_id)
    where workspace_id = v_workspace_id
      and user_id = v_user_id;
  end if;

  -- Clear invalid custom_role_id to avoid blank permission maps.
  if v_custom_role_id is not null then
    select scope, is_active
    into v_template_scope, v_template_active
    from public.custom_role_templates
    where id = v_custom_role_id;

    if v_template_scope is distinct from 'workspace'
      or v_template_active is distinct from true then
      update public.workspace_users
      set custom_role_id = null
      where workspace_id = v_workspace_id
        and user_id = v_user_id;
    end if;
  end if;

  -- Ensure admin can view team.
  insert into public.role_permissions (role, scope, resource, action, allowed)
  values ('admin', 'workspace', 'team', 'view', true)
  on conflict (role, scope, resource, action)
  do update set allowed = excluded.allowed;
end $$;

-- Sanity check
select
  wu.user_id,
  wu.role,
  wu.is_active,
  wu.allowed_clinics,
  wu.custom_role_id,
  crt.scope as custom_role_scope,
  crt.is_active as custom_role_active
from public.workspace_users wu
left join public.custom_role_templates crt on crt.id = wu.custom_role_id
where wu.user_id = (select id from auth.users where email = 'conladoctoralara@gmail.com');
